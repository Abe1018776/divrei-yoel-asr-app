import { supabase } from './auth.js';

const PAGE_SIZE = 1000;

async function fetchAll(table, select = '*') {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (error) { console.error(`Error fetching ${table}:`, error); break; }
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export async function loadFromSupabase() {
  const [audio, transcripts, mappings, alignments, reviews, edits] = await Promise.all([
    fetchAll('audio_files', 'id,name,r2_link,drive_link,year,month,day,type,duration_minutes,is_selected_50hr,is_benchmark,comments,trim_start,trim_end,name_history'),
    fetchAll('transcripts', 'id,name,year,month,day,first_line,drive_link,r2_transcript_link,source_transcript_id,name_history'),
    fetchAll('mappings'),
    fetchAll('alignments', 'audio_id,avg_confidence,low_confidence_count,aligned_at'),
    fetchAll('reviews'),
    fetchAll('transcript_edits')
  ]);
  return { audio, transcripts, mappings, alignments, reviews, edits };
}

export async function loadTranscriptText(transcriptId) {
  const { data, error } = await supabase.from('transcripts').select('text').eq('id', transcriptId).single();
  if (error) { console.error('Error loading transcript text:', error); return null; }
  return data?.text;
}

export async function loadAlignmentWords(audioId) {
  const { data, error } = await supabase.from('alignments').select('words').eq('audio_id', audioId).single();
  if (error) { console.error('Error loading alignment words:', error); return null; }
  return data?.words;
}

export async function syncMapping(audioId, mapping) {
  const { error } = await supabase.from('mappings').upsert({
    audio_id: audioId, transcript_id: mapping.transcriptId,
    confidence: mapping.confidence, match_reason: mapping.matchReason,
    confirmed_by: mapping.confirmedBy || 'user'
  });
  if (error) console.error('Error syncing mapping:', error);
}

export async function syncCleaning(audioId, data) {
  const { error } = await supabase.from('transcript_edits').upsert({
    audio_id: audioId, version: 'cleaned', text: data.cleanedText,
    original_text: data.originalText, clean_rate: data.cleanRate, created_by: 'system'
  }, { onConflict: 'audio_id,version' });
  if (error) console.error('Error syncing cleaning:', error);
}

export async function syncAlignment(audioId, data) {
  const { error } = await supabase.from('alignments').upsert({
    audio_id: audioId, words: data.words, avg_confidence: data.avgConfidence,
    low_confidence_count: data.lowConfidenceCount, aligned_at: new Date().toISOString()
  });
  if (error) console.error('Error syncing alignment:', error);
}

export async function syncReview(audioId, data) {
  const { error } = await supabase.from('reviews').upsert({
    audio_id: audioId, status: data.status, edited_text: data.editedText,
    reviewed_at: new Date().toISOString()
  });
  if (error) console.error('Error syncing review:', error);
}

export async function syncEditedText(audioId, text) {
  const { error } = await supabase.from('transcript_edits').upsert({
    audio_id: audioId, version: 'edited', text, created_by: 'user'
  }, { onConflict: 'audio_id,version' });
  if (error) console.error('Error syncing edited text:', error);
}

export async function ensureAudioFile(audio) {
  const { error } = await supabase.from('audio_files').upsert(audio);
  if (error) console.error('Error ensuring audio file:', error);
}

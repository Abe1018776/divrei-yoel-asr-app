export function cleanText(rawText) {
  if (!rawText) return { cleanedText: '', originalText: '', cleanRate: 0 };
  let text = rawText;

  // Pass 1: Remove [brackets]
  text = text.replace(/\[[^\]]*\]/g, '');
  // Pass 2: Remove parentheses but keep words inside
  text = text.replace(/[()]/g, '');
  // Pass 3: Remove section markers
  text = text.replace(/סעיף\s*\S*/g, '');
  text = text.replace(/\*{2,}/g, '');
  text = text.replace(/^\s*\d+[.)]\s*/gm, '');
  // Pass 4: Normalize quotes
  text = text.replace(/[""״«»]/g, '');
  // Pass 5: Normalize hyphens
  text = text.replace(/—/g, ' ');
  text = text.replace(/^-\s*/gm, '');
  text = text.replace(/(\S)-(\S)/g, '$1 $2');
  // Pass 6: Remove question marks
  text = text.replace(/\?/g, '');
  // Pass 7: Remove ellipsis
  text = text.replace(/\.{2,}/g, '');
  text = text.replace(/…/g, '');
  // Pass 8: Remove zero-width chars
  text = text.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');
  text = text.replace(/['']/g, "'");
  // Pass 9: Collapse whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/ {2,}/g, ' ');
  text = text.split('\n').map(l => l.trim()).join('\n').trim();

  const originalWords = rawText.split(/\s+/).filter(Boolean).length;
  const cleanedWords = text.split(/\s+/).filter(Boolean).length;
  const cleanRate = originalWords > 0 ? Math.round((cleanedWords / originalWords) * 100) : 100;

  return { cleanedText: text, originalText: rawText, cleanRate };
}

export async function batchClean(audioIds, state, loadTranscriptText, onProgress) {
  let done = 0;
  for (const audioId of audioIds) {
    const mapping = state.mappings[audioId];
    if (!mapping) { done++; onProgress(done, audioIds.length); continue; }
    const text = await loadTranscriptText(mapping.transcriptId);
    if (!text) { done++; onProgress(done, audioIds.length); continue; }
    const result = cleanText(text);
    state.cleaning[audioId] = result;
    done++;
    onProgress(done, audioIds.length);
  }
}

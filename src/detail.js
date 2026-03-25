import { checkAuth } from './auth.js';
import { loadFromSupabase, loadTranscriptText, loadAlignmentWords, syncReview, syncEditedText } from './db.js';
import { initState, mergeSupabaseData, getState, updateState } from './state.js';
import { renderReviewPanel, setupKaraokeMode, setupWordEditing } from './review.js';
import { getPipelineStatus } from './utils.js';
import { exportVideo, downloadBlob } from './video-export.js';

async function init() {
  const session = await checkAuth();
  if (!session) return;

  const params = new URLSearchParams(window.location.search);
  const audioId = params.get('id');
  if (!audioId) { window.location.href = '/'; return; }

  const remote = await loadFromSupabase();
  initState(remote);
  mergeSupabaseData(remote);

  const state = getState();
  const audio = state.audio.find(a => a.id === audioId);
  if (!audio) { document.getElementById('file-title').textContent = 'File not found'; return; }

  document.getElementById('file-title').textContent = audio.name || audio.id;

  const player = document.getElementById('audio-player');
  player.src = audio.r2_link || audio.drive_link || '';
  if (audio.duration_minutes) document.getElementById('duration-display').textContent = `${audio.duration_minutes.toFixed(1)} min`;

  const trim = state.trims[audioId] || {};
  document.getElementById('trim-start').value = trim.start || 0;
  document.getElementById('trim-end').value = trim.end || (audio.duration_minutes ? audio.duration_minutes * 60 : 0);

  const mapping = state.mappings[audioId];
  if (mapping) {
    const text = await loadTranscriptText(mapping.transcriptId);
    const cleaning = state.cleaning[audioId];

    if (text) document.getElementById('original-content').textContent = text;
    if (cleaning) document.getElementById('cleaned-content').textContent = cleaning.cleanedText;

    const words = await loadAlignmentWords(audioId);
    if (words) {
      const { originalHtml, cleanedHtml } = renderReviewPanel(words, cleaning?.cleanedText || '', cleaning?.originalText || text || '');
      document.getElementById('original-content').innerHTML = originalHtml;
      document.getElementById('cleaned-content').innerHTML = cleanedHtml;

      setupKaraokeMode(player, document.getElementById('cleaned-content'));
      setupWordEditing(document.getElementById('cleaned-content'), async (index, newWord) => {
        words[index].word = newWord;
        await syncEditedText(audioId, words.map(w => w.word).join(' '));
      });

      const alignment = state.alignments[audioId];
      if (alignment) {
        document.getElementById('avg-confidence').textContent = (alignment.avgConfidence * 100).toFixed(1) + '%';
        document.getElementById('low-confidence-count').textContent = alignment.lowConfidenceCount;
      }

      setupVideoExport(audio, words, state);
    }

    const transcript = state.transcripts.find(t => t.id === mapping.transcriptId);
    if (transcript) {
      document.getElementById('meta-date').textContent = `${transcript.year || ''}/${transcript.month || ''}/${transcript.day || ''}`;
      document.getElementById('meta-first-line').textContent = transcript.first_line || '—';
    }
  }

  document.getElementById('btn-approve').addEventListener('click', async () => {
    updateState('reviews', audioId, { status: 'approved', reviewedAt: new Date().toISOString() });
    await syncReview(audioId, { status: 'approved' });
    document.getElementById('btn-approve').textContent = 'Approved';
  });
  document.getElementById('btn-reject').addEventListener('click', async () => {
    updateState('reviews', audioId, { status: 'rejected', reviewedAt: new Date().toISOString() });
    await syncReview(audioId, { status: 'rejected' });
    document.getElementById('btn-reject').textContent = 'Rejected';
  });
  document.getElementById('btn-skip').addEventListener('click', async () => {
    updateState('reviews', audioId, { status: 'skipped', reviewedAt: new Date().toISOString() });
    await syncReview(audioId, { status: 'skipped' });
    window.history.back();
  });
}

function setupVideoExport(audio, words, state) {
  const btn = document.getElementById('btn-export-video');
  const progressDiv = document.getElementById('export-progress');
  const progressFill = document.getElementById('export-progress-fill');
  const progressText = document.getElementById('export-progress-text');

  const trim = state.trims[audio.id] || {};
  document.getElementById('snippet-start').value = trim.start || 0;
  document.getElementById('snippet-end').value = trim.end || Math.min(60, (audio.duration_minutes || 1) * 60);

  btn.addEventListener('click', async () => {
    const snippetStart = parseFloat(document.getElementById('snippet-start').value) || 0;
    const snippetEnd = parseFloat(document.getElementById('snippet-end').value) || 60;
    const bgTemplate = document.getElementById('bg-template').value;

    btn.disabled = true;
    progressDiv.style.display = 'block';

    try {
      const blob = await exportVideo({
        audioUrl: audio.r2_link || audio.drive_link, words,
        snippetStart, snippetEnd, backgroundTemplate: bgTemplate,
        title: 'דברי יואל', subtitle: audio.name || '',
        onProgress: ({ stage, progress }) => {
          progressFill.style.width = `${Math.round(progress * 100)}%`;
          progressText.textContent = `${stage}... ${Math.round(progress * 100)}%`;
        }
      });
      downloadBlob(blob, `divrei-yoel-${audio.id}-${snippetStart}-${snippetEnd}.mp4`);
    } catch (e) {
      console.error('Export failed:', e);
      progressText.textContent = `Error: ${e.message}`;
    } finally { btn.disabled = false; }
  });
}

init();

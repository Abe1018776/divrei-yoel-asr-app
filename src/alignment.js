const MAX_TEXT_LENGTH = 15000;
const MAX_RETRIES = 15;
const RETRY_DELAY = 10000;

export async function alignAudio(audioUrl, text, trimStart, trimEnd, audioDuration) {
  const chunks = splitTextIntoChunks(text, MAX_TEXT_LENGTH);
  const allWords = [];
  let chunkStart = trimStart || 0;
  const totalDuration = (trimEnd || audioDuration || 0) - chunkStart;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const fraction = chunk.split(/\s+/).length / text.split(/\s+/).length;
    const chunkEnd = chunkStart + (totalDuration * fraction * 1.3);

    const body = { text: chunk, mode: 'align' };

    if (audioUrl.includes('kohnai.ai') || audioUrl.includes('r2.dev')) {
      body.audio_url = audioUrl;
      body.trim_start = chunkStart;
      body.trim_end = Math.min(chunkEnd, trimEnd || audioDuration || 999999);
      body.audio_duration = audioDuration;
    } else {
      const resp = await fetch(audioUrl);
      const blob = await resp.blob();
      body.base64 = await blobToBase64(blob);
      body.format = '.mp3';
    }

    const data = await fetchWithRetry('/api/align', body);
    if (data?.timestamps) {
      allWords.push(...data.timestamps);
      if (data.timestamps.length > 0) {
        chunkStart = data.timestamps[data.timestamps.length - 1].end;
      }
    }
  }

  const avgConfidence = allWords.length > 0
    ? allWords.reduce((sum, w) => sum + (w.confidence || 0), 0) / allWords.length : 0;
  const lowConfidenceCount = allWords.filter(w => (w.confidence || 0) < 0.4).length;
  return { words: allWords, avgConfidence, lowConfidenceCount };
}

function splitTextIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf(' ', maxLen);
    if (splitAt === -1) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function fetchWithRetry(url, body) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (resp.ok) return resp.json();
      if (resp.status !== 502 && resp.status !== 504) throw new Error(`Alignment failed: ${resp.status}`);
    } catch (e) {
      if (attempt >= MAX_RETRIES - 1) throw e;
    }
    await new Promise(r => setTimeout(r, RETRY_DELAY));
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function batchAlign(audioIds, state, onProgress) {
  let done = 0;
  for (const audioId of audioIds) {
    const audio = state.audio.find(a => a.id === audioId);
    const cleaning = state.cleaning[audioId];
    if (!audio || !cleaning) { done++; onProgress(done, audioIds.length); continue; }
    const trim = state.trims[audioId] || {};
    const result = await alignAudio(
      audio.r2_link || audio.drive_link, cleaning.cleanedText,
      trim.start, trim.end, audio.duration_minutes ? audio.duration_minutes * 60 : 0
    );
    state.alignments[audioId] = result;
    done++;
    onProgress(done, audioIds.length);
  }
}

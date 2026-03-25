import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { generateKaraokeASS } from './karaoke-subtitles.js';
import { generateBackgroundImage } from './background-design.js';

let ffmpeg = null;

async function loadFFmpeg(onProgress) {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => { if (onProgress) onProgress(progress); });
  ffmpeg.on('log', ({ message }) => console.log('[FFmpeg]', message));

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ffmpeg;
}

export async function exportVideo({ audioUrl, words, snippetStart, snippetEnd, backgroundTemplate, title, subtitle, onProgress }) {
  onProgress?.({ stage: 'loading', progress: 0 });
  const ff = await loadFFmpeg((p) => onProgress?.({ stage: 'encoding', progress: p }));

  const snippetWords = words.filter(w => w.end >= snippetStart && w.start <= snippetEnd).map(w => ({
    ...w, start: Math.max(0, w.start - snippetStart), end: Math.min(snippetEnd - snippetStart, w.end - snippetStart)
  }));
  const duration = snippetEnd - snippetStart;

  onProgress?.({ stage: 'background', progress: 0.1 });
  const bgBlob = await generateBackgroundImage({ template: backgroundTemplate, title: title || 'דברי יואל', subtitle: subtitle || '', width: 1920, height: 1080 });

  onProgress?.({ stage: 'subtitles', progress: 0.2 });
  const assContent = generateKaraokeASS(snippetWords, duration, {
    fontName: 'David', fontSize: 48,
    primaryColor: '&H00FFFFFF', highlightColor: '&H0000D4FF', outlineColor: '&H00000000'
  });

  onProgress?.({ stage: 'audio', progress: 0.3 });
  let audioData;
  if (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:')) {
    audioData = await fetchFile(audioUrl);
  } else {
    const proxyUrl = `/api/audio?url=${encodeURIComponent(audioUrl)}`;
    audioData = await fetchFile(proxyUrl);
  }

  await ff.writeFile('bg.png', await fetchFile(bgBlob));
  await ff.writeFile('audio.mp3', audioData);
  await ff.writeFile('subs.ass', assContent);

  onProgress?.({ stage: 'encoding', progress: 0.4 });
  await ff.exec([
    '-loop', '1', '-i', 'bg.png', '-i', 'audio.mp3',
    '-ss', String(snippetStart), '-t', String(duration),
    '-vf', 'ass=subs.ass', '-c:v', 'libx264', '-tune', 'stillimage',
    '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-shortest', '-y', 'output.mp4'
  ]);

  onProgress?.({ stage: 'finishing', progress: 0.95 });
  const data = await ff.readFile('output.mp4');
  const blob = new Blob([data.buffer], { type: 'video/mp4' });

  await ff.deleteFile('bg.png');
  await ff.deleteFile('audio.mp3');
  await ff.deleteFile('subs.ass');
  await ff.deleteFile('output.mp4');

  onProgress?.({ stage: 'done', progress: 1 });
  return blob;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

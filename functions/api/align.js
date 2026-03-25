export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await request.json();
    let audioBase64 = body.base64;
    let format = body.format || '.mp3';

    if (body.audio_url) {
      const url = new URL(body.audio_url);
      if (!url.hostname.includes('kohnai.ai') && !url.hostname.includes('r2.dev')) {
        return new Response('Invalid audio host', { status: 400 });
      }
      const audioResp = await fetch(body.audio_url);
      if (!audioResp.ok) return new Response('Failed to fetch audio', { status: 502 });
      let audioBuffer = await audioResp.arrayBuffer();

      if (body.trim_start && body.audio_duration) {
        const startPct = body.trim_start / body.audio_duration;
        const endPct = body.trim_end ? body.trim_end / body.audio_duration : 1;
        audioBuffer = audioBuffer.slice(
          Math.floor(startPct * audioBuffer.byteLength),
          Math.floor(endPct * audioBuffer.byteLength)
        );
      }
      const bytes = new Uint8Array(audioBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      audioBase64 = btoa(binary);
      const ext = body.audio_url.split('.').pop().split('?')[0];
      format = '.' + (ext || 'mp3');
    }

    const alignBody = { audio: audioBase64, format, text: body.text, mode: body.mode || 'align' };
    let lastError;
    for (let i = 0; i < 15; i++) {
      try {
        const resp = await fetch('https://align.kohnai.ai/api/align', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alignBody)
        });
        if (resp.ok) {
          const data = await resp.json();
          return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        if (resp.status !== 502 && resp.status !== 504) return new Response(`Alignment server error: ${resp.status}`, { status: resp.status });
        lastError = `HTTP ${resp.status}`;
      } catch (e) { lastError = e.message; }
      await new Promise(r => setTimeout(r, 10000));
    }
    return new Response(`Alignment failed after retries: ${lastError}`, { status: 504 });
  } catch (e) { return new Response(`Error: ${e.message}`, { status: 500 }); }
}

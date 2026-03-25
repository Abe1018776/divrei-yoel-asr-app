export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await request.json();
    const provider = body.provider || 'whisper';

    if (provider === 'whisper') {
      const alignResp = await fetch(new URL('/api/align', request.url).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, mode: 'transcribe' })
      });
      return alignResp;
    }

    if (provider === 'yiddish-labs') {
      const apiKey = env.YL_API_KEY;
      if (!apiKey) return new Response('Yiddish Labs API key not configured', { status: 500 });
      let audioBlob;
      if (body.audio_url) { const resp = await fetch(body.audio_url); audioBlob = await resp.blob(); }
      else return new Response('audio_url required', { status: 400 });
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('language', 'yi');
      const ylResp = await fetch('https://app.yiddishlabs.com/api/v1/transcriptions/sync', {
        method: 'POST', headers: { 'X-API-KEY': apiKey }, body: formData
      });
      const result = await ylResp.json();
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    if (provider === 'gemini') {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) return new Response('Gemini API key not configured', { status: 500 });
      let audioBase64;
      if (body.audio_url) {
        const resp = await fetch(body.audio_url);
        const buffer = await resp.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        audioBase64 = btoa(binary);
      }
      const model = body.gemini_model || 'gemini-2.0-flash';
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inlineData: { mimeType: 'audio/mpeg', data: audioBase64 } },
            { text: body.prompt || 'Transcribe this Yiddish audio accurately. Return only the transcription text.' }
          ]}]})
        }
      );
      const result = await geminiResp.json();
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    return new Response(`Unknown provider: ${provider}`, { status: 400 });
  } catch (e) { return new Response(`Error: ${e.message}`, { status: 500 }); }
}

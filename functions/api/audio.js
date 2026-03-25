export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const audioUrl = url.searchParams.get('url');
  if (!audioUrl) return new Response('Missing url parameter', { status: 400 });

  try {
    const parsed = new URL(audioUrl);
    if (!parsed.hostname.includes('kohnai.ai') && !parsed.hostname.includes('r2.dev')) {
      return new Response('Invalid host', { status: 400 });
    }
  } catch { return new Response('Invalid URL', { status: 400 }); }

  const resp = await fetch(audioUrl);
  if (!resp.ok) return new Response('Failed to fetch audio', { status: resp.status });

  const ext = audioUrl.split('.').pop().split('?')[0].toLowerCase();
  const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', webm: 'audio/webm', flac: 'audio/flac', ogg: 'audio/ogg' };

  return new Response(resp.body, {
    headers: {
      'Content-Type': mimeMap[ext] || resp.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

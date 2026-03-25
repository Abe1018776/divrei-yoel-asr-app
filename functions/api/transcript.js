export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const name = url.searchParams.get('name');
  if (!name) return new Response('Missing name parameter', { status: 400 });

  const transcriptUrl = `https://audio.kohnai.ai/transcripts-txt/${encodeURIComponent(name)}`;
  try {
    const resp = await fetch(transcriptUrl);
    if (!resp.ok) return new Response('Transcript not found', { status: 404 });
    return new Response(resp.body, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) { return new Response(`Error: ${e.message}`, { status: 500 }); }
}

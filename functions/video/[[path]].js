/** Serve /video/* with HTTP Range support. Pages static assets always answer 200 with the whole file,
 *  so browsers could not seek (skip buttons, chapters, dragging the scrubber) in the tutorial videos. */
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(new Request(url.origin + url.pathname, { headers: { 'Accept-Encoding': 'identity' } }));
  const headers = new Headers(res.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.delete('Content-Encoding');
  const range = request.headers.get('Range');
  if (!res.ok || !range) return new Response(request.method === 'HEAD' ? null : res.body, { status: res.status, headers });
  let size = Number(res.headers.get('Content-Length'));
  let whole = null;
  if (!size) {
    whole = new Uint8Array(await res.arrayBuffer());
    size = whole.byteLength;
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start;
  let end;
  if (m && m[1] !== '') {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  } else if (m && m[2] !== '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  }
  if (start == null || start > end || start >= size) {
    if (!whole && res.body) res.body.cancel();
    headers.set('Content-Range', `bytes */${size}`);
    headers.delete('Content-Length');
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  if (request.method === 'HEAD') {
    if (!whole && res.body) res.body.cancel();
    return new Response(null, { status: 206, headers });
  }
  if (whole) return new Response(whole.subarray(start, end + 1), { status: 206, headers });
  if (start === 0 && end === size - 1) return new Response(res.body, { status: 206, headers });

  let pos = 0;
  const slice = new TransformStream({
    transform(chunk, ctl) {
      const from = pos;
      pos += chunk.byteLength;
      if (pos <= start || from > end) return;
      ctl.enqueue(chunk.subarray(Math.max(0, start - from), Math.min(chunk.byteLength, end - from + 1)));
      if (pos > end) ctl.terminate();
    },
  });
  res.body.pipeTo(slice.writable).catch(() => {});
  return new Response(slice.readable, { status: 206, headers });
}

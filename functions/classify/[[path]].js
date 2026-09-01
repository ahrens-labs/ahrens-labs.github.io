/** Serve classify.html for /classify/* paths without extensionless-URL redirect loops. */
export async function onRequest(context) {
  const { request, next, env } = context;
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  if (pathname === '/classify') {
    return next();
  }
  if (!env.ASSETS) {
    return next();
  }
  const assetUrl = new URL('/classify', request.url);
  const assetRequest = new Request(assetUrl, {
    method: request.method,
    headers: request.headers,
    redirect: 'manual',
  });
  return env.ASSETS.fetch(assetRequest);
}

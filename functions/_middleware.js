/** Proxy /link and /link/* to the Link CRM worker without a functions/link/ directory (avoids link.html redirect loop). */
export async function onRequest(context) {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname;
  if (path === '/link' || path.startsWith('/link/')) {
    if (!env.LINK) {
      return new Response('link is not configured on this Pages project.', { status: 503 });
    }
    return env.LINK.fetch(request);
  }
  return next();
}

/** Proxy /link and /link/* to the Link CRM worker (service binding: LINK). */
export async function onRequest(context) {
  const { request, env } = context;
  if (!env.LINK) {
    return new Response('Link is not configured on this Pages project.', { status: 503 });
  }
  return env.LINK.fetch(request);
}

// Streaming AI chat for /api/chat-stream (Netlify Functions v2 can stream a Response body;
// the Express app in api.ts is wrapped by serverless-http, which buffers the whole answer).
// The chat logic itself lives in server.ts (prepareChat / streamChat) so local dev and
// production behave the same (including the system prompt, so the Solution A/B/C answer format
// in SOLUTION_FORMAT applies here too). Events are newline-delimited JSON.
type Context = { ip?: string };

process.env.NETLIFY = process.env.NETLIFY || 'true'; // server.ts must not start its own HTTP server here
const serverPromise = import('../../server');

export default async (req: Request, context: Context) => {
  if (req.method === 'GET') {
    await serverPromise; // pre-warm: load the module (and the Gemini SDK) before the first question
    return new Response(JSON.stringify({ ok: true, warm: true }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { prepareChat, streamChat, rateLimitOk, verifyAuthorizationHeader, SIGN_IN_REQUIRED } = await serverPromise;
  // Members only: the browser sends its Firebase ID token (same check as the Express AI routes).
  const user = await verifyAuthorizationHeader(req.headers.get('authorization'));
  if (!user) {
    return new Response(JSON.stringify({ error: SIGN_IN_REQUIRED }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (!rateLimitOk(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please wait a few minutes and try again.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '300' } });
  }
  let body: any = null;
  try { body = await req.json(); } catch { /* handled below */ }
  const prep = await prepareChat(body);
  if (prep.error) return new Response(JSON.stringify({ error: prep.error }), { status: prep.status || 400, headers: { 'Content-Type': 'application/json' } });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of streamChat(prep)) controller.enqueue(enc.encode(JSON.stringify(ev) + '\n'));
      } catch (e: any) {
        controller.enqueue(enc.encode(JSON.stringify({ error: 'The AI service is busy or unavailable right now. Please try again in a minute.' }) + '\n'));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  });
};

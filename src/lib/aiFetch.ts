import { authedFetch } from './signInGate';

/**
 * fetch() for the AI routes. Sends the Firebase ID token (the server requires sign-in for the AI
 * routes) and opens the login wall for guests. The free Gemini tier is sometimes saturated for a
 * few seconds, so a busy (503) or gateway-timeout (502/504) answer is retried once automatically
 * before the user sees an error. Same signature as fetch().
 */
export async function aiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await authedFetch(input, init);
  if (res.status !== 503 && res.status !== 502 && res.status !== 504) return res;
  await new Promise((r) => setTimeout(r, 1200));
  try {
    return await authedFetch(input, init);
  } catch {
    return res;
  }
}

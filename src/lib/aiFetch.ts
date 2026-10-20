/**
 * fetch() for the AI routes. The free Gemini tier is sometimes saturated for a few seconds,
 * so a busy (503) or gateway-timeout (502/504) answer is retried once automatically before
 * the user sees an error. Same signature as fetch().
 */
export async function aiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 503 && res.status !== 502 && res.status !== 504) return res;
  await new Promise((r) => setTimeout(r, 1200));
  try {
    return await fetch(input, init);
  } catch {
    return res;
  }
}

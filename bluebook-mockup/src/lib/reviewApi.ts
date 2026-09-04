const API_FALLBACKS = ['http://127.0.0.1:4173', 'http://127.0.0.1:4174']

/** Locate the serve.ts review API: same origin first, then the known local
 *  ports (the app may be served by a plain static server without the API). */
export async function probeApi(): Promise<string | null> {
  for (const base of ['', ...API_FALLBACKS]) {
    try {
      const r = await fetch(`${base}/api/curated-status`, { signal: AbortSignal.timeout(2000) })
      if (r.ok) return base
    } catch {
      // try the next base
    }
  }
  return null
}

/** POST an in-test question error report. Returns an error message or null. */
export async function reportQuestionError(
  base: string,
  sourceId: string,
  note: string,
): Promise<string | null> {
  try {
    const r = await fetch(`${base}/api/report-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, note }),
    })
    const body = (await r.json()) as { error?: string }
    if (!r.ok) return body.error ?? `HTTP ${r.status}`
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

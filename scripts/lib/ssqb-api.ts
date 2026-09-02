/**
 * ssqb-api — best-effort adapter for the College Board SAT Suite Question
 * Bank (SSQB) internal question API. The API is UNDOCUMENTED and requires a
 * logged-in browser session cookie; this adapter is therefore strictly
 * opportunistic:
 *
 *   - SATQB_COOKIE unset  -> null immediately (pure-vision runs work).
 *   - SATQB_COOKIE set    -> try a few plausible endpoint shapes for the
 *     question; ANY failure (network, 401/403/404, unexpected JSON) -> null.
 *
 * A non-null result carries exact official text (math already in LaTeX on
 * the CB side) and is preferred over vision transcription by the caller.
 * When every guess fails, the caller falls back to vision — this module
 * never throws by design.
 */

export interface OfficialMath {
  stem?: string;
  /** Choice letter -> text, e.g. { A: '...', B: '...' }. */
  choices?: Record<string, string>;
  rationale?: string;
  correctAnswer?: string;
}

const BASES = [
  'https://satquestionbank.collegeboard.org',
  'https://satsuitequestionbank.collegeboard.org',
];
const PATHS = ['/api/questions/', '/api/question/'];
const FETCH_TIMEOUT_MS = 10_000;

/** Pick the first non-empty string among several possible JSON fields. */
function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

/** Map whatever the endpoint returned onto OfficialMath; null if unusable. */
function toOfficialMath(raw: unknown): OfficialMath | null {
  if (typeof raw !== 'object' || raw === null) return null;
  // Tolerate a wrapper ({question: {...}} / {data: {...}}) or a flat object.
  const o = raw as Record<string, unknown>;
  const q = (typeof o['question'] === 'object' && o['question'] !== null
    ? o['question']
    : typeof o['data'] === 'object' && o['data'] !== null
      ? o['data']
      : o) as Record<string, unknown>;
  const out: OfficialMath = {};
  const stem = pick(q, ['stem', 'question', 'prompt', 'body']);
  if (stem !== undefined) out.stem = stem;
  const rationale = pick(q, ['rationale', 'explanation', 'answerExplanation']);
  if (rationale !== undefined) out.rationale = rationale;
  const correct = pick(q, ['correctAnswer', 'correct_answer', 'answer', 'key']);
  if (correct !== undefined) out.correctAnswer = correct;
  const rawChoices = q['choices'] ?? q['answerChoices'] ?? q['options'];
  if (Array.isArray(rawChoices)) {
    const choices: Record<string, string> = {};
    for (const c of rawChoices) {
      if (typeof c !== 'object' || c === null) continue;
      const id = (c as Record<string, unknown>)['id'] ?? (c as Record<string, unknown>)['letter'];
      const text = (c as Record<string, unknown>)['text'] ?? (c as Record<string, unknown>)['body'];
      if (typeof id === 'string' && typeof text === 'string' && text.trim() !== '') {
        choices[id.toUpperCase()] = text;
      }
    }
    if (Object.keys(choices).length > 0) out.choices = choices;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function fetchOfficialMath(sourceId: string): Promise<OfficialMath | null> {
  const cookie = process.env.SATQB_COOKIE;
  if (cookie === undefined || cookie === '') return null; // no session: vision-only mode
  const rawId = sourceId.replace(/^ssqb-/, '');
  for (const base of BASES) {
    for (const p of PATHS) {
      try {
        const res = await fetch(`${base}${p}${rawId}`, {
          headers: { Cookie: cookie, Accept: 'application/json' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) continue; // 401/403/404: try the next shape
        const mapped = toOfficialMath(await res.json());
        if (mapped !== null) return mapped;
      } catch {
        // network/timeout/JSON-parse failure: try the next shape, then give up
      }
    }
  }
  return null;
}

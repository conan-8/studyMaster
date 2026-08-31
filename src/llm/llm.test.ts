/**
 * Suite for the LLM provider abstraction layer (src/llm/).
 *
 * Part of the npm-test glob (src/llm/*.test.ts); also runnable directly:
 *   npx tsx --test src/llm/llm.test.ts
 *
 * No network access: the OpenRouter provider is exercised exclusively through
 * an injected fetchImpl double.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { MockProvider, mockFromFiles } from './mock.js';
import type { MockScript } from './mock.js';
import {
  OpenRouterProvider,
  OPENROUTER_URL,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
} from './openrouter.js';
import {
  KimiProvider,
  KIMI_URL,
  DEFAULT_MODEL as KIMI_DEFAULT_MODEL,
} from './kimi.js';
import { resolveProvider, SUPPORTED_PROVIDERS } from './factory.js';
import { LLMError } from './types.js';
import type { LLMRequest } from './types.js';

const REQ: LLMRequest = {
  messages: [
    { role: 'system', content: 'You generate JSON.' },
    { role: 'user', content: '{"topic":"fractions"}' },
  ],
};

/** Run fn with the given env vars set; restore the prior values afterwards. */
async function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => unknown | Promise<unknown>,
): Promise<void> {
  const prior = new Map<string, string | undefined>();
  for (const key of Object.keys(vars)) {
    prior.set(key, process.env[key]);
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// MockProvider
// ---------------------------------------------------------------------------

void test('mock: scripts are consumed in order', async () => {
  const provider = new MockProvider('mock-1', [
    { content: 'first' },
    { content: 'second' },
  ]);
  const a = await provider.complete(REQ);
  const b = await provider.complete(REQ);
  assert.strictEqual(a.content, 'first');
  assert.strictEqual(b.content, 'second');
  assert.strictEqual(a.provider, 'mock');
  assert.strictEqual(a.model, 'mock-1');
  assert.deepStrictEqual(a.usage, { promptTokens: 0, completionTokens: 0 });
});

void test('mock: two identical providers are deterministic (identical results)', async () => {
  const scripts: MockScript[] = [{ content: '{"a":1}' }, { content: '{"b":2}' }];
  const p1 = new MockProvider('mock-1', scripts);
  const p2 = new MockProvider('mock-1', scripts);
  for (let i = 0; i < scripts.length; i += 1) {
    assert.deepStrictEqual(await p1.complete(REQ), await p2.complete(REQ));
  }
});

void test('mock: {error} script throws LLMError tagged [mock]', async () => {
  const provider = new MockProvider('mock-1', [{ error: 'boom' }]);
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.strictEqual(err.provider, 'mock');
    assert.ok(err.message.startsWith('[mock]'));
    assert.ok(err.message.includes('boom'));
    return true;
  });
});

void test('mock: exhausted scripts throw with consumed count', async () => {
  const provider = new MockProvider('mock-1', [{ content: 'only one' }]);
  await provider.complete(REQ);
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.strictEqual(
      err.message,
      '[mock] mock provider exhausted: 1 scripts consumed',
    );
    return true;
  });
});

void test('mock: empty scripts are legal at construction, fail on complete()', async () => {
  const provider = new MockProvider('mock-1', []);
  await assert.rejects(provider.complete(REQ), /exhausted: 0 scripts consumed/);
});

void test('mockFromFiles: one script per file, content trimmed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-mock-'));
  try {
    const f1 = path.join(dir, 'a.json');
    const f2 = path.join(dir, 'b.txt');
    fs.writeFileSync(f1, '  {"q":"one"}\n\n');
    fs.writeFileSync(f2, 'plain text  ');
    const scripts = mockFromFiles([f1, f2]);
    assert.deepStrictEqual(scripts, [
      { content: '{"q":"one"}' },
      { content: 'plain text' },
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// OpenRouterProvider
// ---------------------------------------------------------------------------

type FetchCall = { url: string | URL | Request; init?: RequestInit };

function recordingFetch(
  payload: unknown,
  status = 200,
): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

void test('openrouter: constructor throws LLMError with env-var instructions when key missing', async () => {
  await withEnv({ OPENROUTER_API_KEY: undefined }, () => {
    assert.throws(
      () => new OpenRouterProvider(),
      (err: unknown) => {
        assert.ok(err instanceof LLMError);
        assert.strictEqual(err.provider, 'openrouter');
        assert.ok(err.message.includes('OPENROUTER_API_KEY'));
        return true;
      },
    );
  });
});

void test('openrouter: model fallback order opts.model > OPENROUTER_MODEL > default', async () => {
  await withEnv({ OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'env/model' }, () => {
    assert.strictEqual(new OpenRouterProvider().defaultModel, 'env/model');
    assert.strictEqual(
      new OpenRouterProvider({ model: 'opt/model' }).defaultModel,
      'opt/model',
    );
  });
  await withEnv(
    { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: undefined },
    () => {
      assert.strictEqual(new OpenRouterProvider().defaultModel, DEFAULT_MODEL);
      assert.strictEqual(DEFAULT_MODEL, 'minimax/minimax-m3');
    },
  );
});

void test('openrouter: request shape — URL, headers, defaults, response_format only in jsonMode', async () => {
  const payload = {
    choices: [{ message: { content: '{"ok":true}' } }],
    model: 'minimax/minimax-m3',
    usage: { prompt_tokens: 11, completion_tokens: 7 },
  };
  const { fetchImpl, calls } = recordingFetch(payload);
  const provider = new OpenRouterProvider({ apiKey: 'sk-test-key', fetchImpl });

  const res = await provider.complete({ ...REQ, jsonMode: true });
  assert.strictEqual(res.content, '{"ok":true}');
  assert.strictEqual(res.model, 'minimax/minimax-m3');
  assert.strictEqual(res.provider, 'openrouter');
  assert.deepStrictEqual(res.usage, { promptTokens: 11, completionTokens: 7 });

  assert.strictEqual(calls.length, 1);
  const call = calls[0]!;
  assert.strictEqual(call.url, OPENROUTER_URL);
  const headers = call.init!.headers as Record<string, string>;
  assert.strictEqual(headers['Authorization'], 'Bearer sk-test-key');
  assert.strictEqual(headers['Content-Type'], 'application/json');
  const body = JSON.parse(call.init!.body as string) as Record<string, unknown>;
  assert.strictEqual(body['model'], 'minimax/minimax-m3');
  assert.deepStrictEqual(body['messages'], REQ.messages);
  assert.strictEqual(body['temperature'], 0.7);
  assert.strictEqual(body['max_tokens'], 4096);
  assert.deepStrictEqual(body['response_format'], { type: 'json_object' });

  // jsonMode off → no response_format; explicit temperature/maxTokens honoured.
  const res2 = await provider.complete({
    ...REQ,
    temperature: 0.1,
    maxTokens: 128,
  });
  assert.strictEqual(res2.content, '{"ok":true}');
  const body2 = JSON.parse(calls[1]!.init!.body as string) as Record<string, unknown>;
  assert.ok(!('response_format' in body2), 'response_format must be absent without jsonMode');
  assert.strictEqual(body2['temperature'], 0.1);
  assert.strictEqual(body2['max_tokens'], 128);
});

void test('openrouter: non-2xx → LLMError with status + body preview, key redacted', async () => {
  const longBody = `upstream exploded ${'x'.repeat(600)}`;
  const fetchImpl = (async () =>
    ({
      ok: false,
      status: 429,
      text: async () => longBody,
      json: async () => ({}),
    }) as Response) as typeof fetch;
  const provider = new OpenRouterProvider({ apiKey: 'sk-secret-key', fetchImpl });
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.strictEqual(err.provider, 'openrouter');
    assert.ok(err.message.includes('429'), 'message must contain the status');
    assert.ok(err.message.includes('upstream exploded'));
    // first 500 chars of body only
    assert.ok(!err.message.includes('x'.repeat(500)), 'body preview must be truncated');
    // Authorization header value must never leak into errors
    assert.ok(!err.message.includes('sk-secret-key'), 'API key must be redacted');
    return true;
  });
});

void test('openrouter: timeout fires with tiny timeoutMs + never-resolving fetchImpl', async () => {
  const neverResolving = (() =>
    new Promise<Response>(() => {
      /* never resolves */
    })) as typeof fetch;
  const provider = new OpenRouterProvider({
    apiKey: 'k',
    fetchImpl: neverResolving,
    timeoutMs: 20,
  });
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.ok(err.message.includes('timed out after 20ms'));
    return true;
  });
});

void test('openrouter: malformed success payload → LLMError describing what came back', async () => {
  const { fetchImpl } = recordingFetch({ choices: [] });
  const provider = new OpenRouterProvider({ apiKey: 'k', fetchImpl });
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.ok(err.message.includes('choices[0].message.content'));
    return true;
  });
});

void test('openrouter: model falls back to this.model when response omits it', async () => {
  const { fetchImpl } = recordingFetch({
    choices: [{ message: { content: 'hi' } }],
  });
  const provider = new OpenRouterProvider({
    apiKey: 'k',
    model: 'opt/model',
    fetchImpl,
  });
  const res = await provider.complete(REQ);
  assert.strictEqual(res.model, 'opt/model');
  assert.strictEqual(res.usage, undefined);
});

void test('openrouter: defaults — timeout 60s and global fetch when not injected', async () => {
  await withEnv({ OPENROUTER_API_KEY: 'k' }, () => {
    const provider = new OpenRouterProvider();
    assert.strictEqual(provider.name, 'openrouter');
    assert.strictEqual(provider.defaultModel, DEFAULT_MODEL);
    assert.strictEqual(DEFAULT_TIMEOUT_MS, 60_000);
  });
});

// ---------------------------------------------------------------------------
// kimi
// ---------------------------------------------------------------------------

void test('kimi: constructor throws LLMError with env-var instructions when key missing', async () => {
  await withEnv({ KIMI_API_KEY: undefined }, () => {
    assert.throws(
      () => new KimiProvider(),
      (err: unknown) => {
        assert.ok(err instanceof LLMError);
        assert.strictEqual(err.provider, 'kimi');
        assert.ok(err.message.includes('KIMI_API_KEY'));
        return true;
      },
    );
  });
});

void test('kimi: model fallback order opts.model > KIMI_MODEL > default', async () => {
  await withEnv({ KIMI_API_KEY: 'k', KIMI_MODEL: 'k3' }, () => {
    assert.strictEqual(new KimiProvider().defaultModel, 'k3');
    assert.strictEqual(new KimiProvider({ model: 'opt' }).defaultModel, 'opt');
  });
  await withEnv({ KIMI_API_KEY: 'k', KIMI_MODEL: undefined }, () => {
    assert.strictEqual(new KimiProvider().defaultModel, KIMI_DEFAULT_MODEL);
    assert.strictEqual(KIMI_DEFAULT_MODEL, 'k3');
  });
});

void test('kimi: request shape — URL, headers, defaults, response_format only in jsonMode', async () => {
  const payload = {
    choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
    model: 'k3',
    usage: { prompt_tokens: 11, completion_tokens: 7 },
  };
  const { fetchImpl, calls } = recordingFetch(payload);
  const provider = new KimiProvider({ apiKey: 'sk-test-key', fetchImpl });

  const res = await provider.complete({ ...REQ, jsonMode: true });
  assert.strictEqual(res.content, '{"ok":true}');
  assert.strictEqual(res.model, 'k3');
  assert.strictEqual(res.provider, 'kimi');
  assert.deepStrictEqual(res.usage, { promptTokens: 11, completionTokens: 7 });

  assert.strictEqual(calls.length, 1);
  const call = calls[0]!;
  assert.strictEqual(call.url, KIMI_URL);
  const headers = call.init!.headers as Record<string, string>;
  assert.strictEqual(headers['Authorization'], 'Bearer sk-test-key');
  assert.strictEqual(headers['Content-Type'], 'application/json');
  const body = JSON.parse(call.init!.body as string) as Record<string, unknown>;
  assert.strictEqual(body['model'], 'k3');
  assert.deepStrictEqual(body['messages'], REQ.messages);
  assert.strictEqual(body['temperature'], 1);
  assert.strictEqual(body['max_tokens'], 16384);
  assert.deepStrictEqual(body['response_format'], { type: 'json_object' });

  const res2 = await provider.complete({ ...REQ, maxTokens: 128 });
  assert.strictEqual(res2.content, '{"ok":true}');
  const body2 = JSON.parse(calls[1]!.init!.body as string) as Record<string, unknown>;
  assert.ok(!('response_format' in body2), 'response_format must be absent without jsonMode');
  assert.strictEqual(body2['max_tokens'], 128);
});

void test('kimi: non-2xx → LLMError with status + body preview, key redacted', async () => {
  const longBody = `upstream exploded ${'x'.repeat(600)}`;
  const fetchImpl = (async () =>
    ({
      ok: false,
      status: 401,
      text: async () => longBody,
      json: async () => ({}),
    }) as Response) as typeof fetch;
  const provider = new KimiProvider({ apiKey: 'sk-secret-key', fetchImpl });
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.strictEqual(err.provider, 'kimi');
    assert.ok(err.message.includes('401'), 'message must contain the status');
    assert.ok(err.message.includes('upstream exploded'));
    assert.ok(!err.message.includes('x'.repeat(500)), 'body preview must be truncated');
    assert.ok(!err.message.includes('sk-secret-key'), 'API key must be redacted');
    return true;
  });
});

void test('kimi: truncated reasoning (empty content + finish_reason length) → helpful LLMError', async () => {
  const { fetchImpl } = recordingFetch({
    choices: [{ message: { content: '' }, finish_reason: 'length' }],
  });
  const provider = new KimiProvider({ apiKey: 'k', fetchImpl });
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.strictEqual(err.provider, 'kimi');
    assert.ok(err.message.includes('max_tokens'));
    return true;
  });
});

void test('kimi: malformed success payload → LLMError describing what came back', async () => {
  const { fetchImpl } = recordingFetch({ choices: [] });
  const provider = new KimiProvider({ apiKey: 'k', fetchImpl });
  await assert.rejects(provider.complete(REQ), (err: unknown) => {
    assert.ok(err instanceof LLMError);
    assert.ok(err.message.includes('choices[0].message.content'));
    return true;
  });
});

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

void test('factory: default is mock with no scripts (constructs, complete() exhausts)', async () => {
  await withEnv({ GENERATOR_PROVIDER: undefined }, async () => {
    const provider = resolveProvider();
    assert.ok(provider instanceof MockProvider);
    assert.strictEqual(provider.name, 'mock');
    assert.strictEqual(provider.defaultModel, 'mock-1');
    await assert.rejects(provider.complete(REQ), /exhausted: 0 scripts consumed/);
  });
});

void test('factory: GENERATOR_PROVIDER env is honoured; explicit arg wins', async () => {
  await withEnv({ GENERATOR_PROVIDER: 'mock' }, () => {
    const provider = resolveProvider(undefined, {
      scripts: [{ content: 'canned' }],
    });
    assert.ok(provider instanceof MockProvider);
  });
  await withEnv(
    { GENERATOR_PROVIDER: 'mock', OPENROUTER_API_KEY: 'k' },
    () => {
      const provider = resolveProvider('openrouter');
      assert.ok(provider instanceof OpenRouterProvider);
    },
  );
});

void test('factory: kimi by name', async () => {
  await withEnv({ KIMI_API_KEY: 'k' }, () => {
    assert.ok(resolveProvider('kimi') instanceof KimiProvider);
  });
});

void test('factory: openrouter by name; unknown name lists supported providers', async () => {
  await withEnv({ OPENROUTER_API_KEY: 'k' }, () => {
    assert.ok(resolveProvider('openrouter') instanceof OpenRouterProvider);
    assert.throws(
      () => resolveProvider('anthropic'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("'anthropic'"));
        assert.ok(err.message.includes(SUPPORTED_PROVIDERS.join(', ')));
        return true;
      },
    );
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { checkGoogleOAuthReadiness } from "../lib/google-oauth";

const config = {
  url: "https://mimo-demo.supabase.co",
  key: "sb_publishable_mock_key_1234567890",
  redirectTo: "http://localhost:3000/auth/callback",
};
const privateValue = "private-token-and-secret-must-not-leak";

function assertSafe(result: Awaited<ReturnType<typeof checkGoogleOAuthReadiness>>) {
  assert.deepEqual(Object.keys(result).sort(), ["code", "error", "ready"]);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(privateValue), false);
  assert.equal(serialized.includes(config.key), false);
  assert.equal(serialized.includes("validation_failed"), false);
}

function checkResponse(response: Response) {
  return checkGoogleOAuthReadiness({ ...config, fetcher: async () => response });
}

test("enabled Google settings cannot hide a missing OAuth secret from authorize", async () => {
  let requests = 0;
  const result = await checkGoogleOAuthReadiness({
    ...config,
    fetcher: async (input) => {
      requests += 1;
      assert.equal(new URL(String(input)).pathname, "/auth/v1/authorize");
      // A settings response with external.google=true is not readiness evidence.
      return Response.json({
        code: 400,
        error_code: "validation_failed",
        msg: `Unsupported provider: missing OAuth secret ${privateValue}`,
      }, { status: 400 });
    },
  });
  assert.equal(requests, 1);
  assert.equal(result.ready, false);
  assert.equal(result.code, "missing_oauth_secret");
  assert.match(result.error!, /save Google's Web OAuth Client Secret/);
  assert.match(result.error!, /not a Supabase key/);
  assert.match(result.error!, /Supabase → Authentication → Providers → Google/);
  assert.doesNotMatch(result.error!, /not enabled/);
  assertSafe(result);
});

test("disabled Google provider is blocked distinctly", async () => {
  const result = await checkResponse(Response.json({
    msg: `Unsupported provider: provider is not enabled ${privateValue}`,
  }, { status: 400 }));
  assert.equal(result.ready, false);
  assert.equal(result.code, "provider_disabled");
  assert.match(result.error!, /Google sign-in is not enabled in Supabase/);
  assertSafe(result);
});

test("Google redirects are checked manually with a bounded, uncached GET to the configured Supabase only", async (t) => {
  const originalTimeout = AbortSignal.timeout;
  const timeout = t.mock.method(AbortSignal, "timeout", (milliseconds: number) => originalTimeout(milliseconds));
  let requests = 0;
  const response = new Response(privateValue, {
    status: 302,
    headers: { location: `https://accounts.google.com/o/oauth2/v2/auth?state=${privateValue}` },
  });
  const result = await checkGoogleOAuthReadiness({
    ...config,
    url: `${config.url}/ignored-path?ignored=value#ignored`,
    redirectTo: `${config.redirectTo}?next=%2Fmemories&mode=link`,
    fetcher: async (input, init) => {
      requests += 1;
      const target = new URL(String(input));
      assert.equal(target.origin, config.url);
      assert.equal(target.pathname, "/auth/v1/authorize");
      assert.deepEqual([...target.searchParams], [
        ["provider", "google"],
        ["redirect_to", `${config.redirectTo}?next=%2Fmemories&mode=link`],
      ]);
      assert.equal(target.hash, "");
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "manual");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.credentials, "omit");
      assert.equal(init?.body, undefined);
      assert.ok(init?.signal instanceof AbortSignal);
      assert.equal(init.signal.aborted, false);
      const headers = new Headers(init.headers);
      assert.equal(headers.get("apikey"), config.key);
      assert.equal(headers.get("authorization"), `Bearer ${config.key}`);
      return response;
    },
  });
  assert.equal(requests, 1);
  assert.deepEqual(timeout.mock.calls.map((call) => call.arguments), [[8000]]);
  assert.deepEqual(result, { ready: true, code: "ready", error: null });
  assert.equal(response.bodyUsed, false);
  assertSafe(result);
});

test("standard HTTP redirect statuses with a Google HTTPS location are ready", async () => {
  for (const status of [301, 303, 307, 308]) {
    const result = await checkResponse(new Response(null, {
      status,
      headers: { location: "https://accounts.google.com/o/oauth2/v2/auth" },
    }));
    assert.deepEqual(result, { ready: true, code: "ready", error: null });
  }
});

test("missing, malformed, and unsafe redirect locations are rejected without disclosure", async () => {
  for (const location of [
    null,
    "",
    privateValue,
    "/relative/path",
    "//accounts.google.com/o/oauth2/auth",
    `http://accounts.google.com/?state=${privateValue}`,
    `https://accounts.google.com.evil.example/?state=${privateValue}`,
    `https://accounts.google.com@evil.example/?state=${privateValue}`,
    `https://${privateValue}@accounts.google.com/`,
    `https://accounts.google.com:444/?state=${privateValue}`,
    `javascript:alert('${privateValue}')`,
    `https://evil.example/?next=https://accounts.google.com&state=${privateValue}`,
  ]) {
    const response = new Response(privateValue, {
      status: 302,
      headers: location === null ? {} : { location },
    });
    const result = await checkResponse(response);
    assert.equal(result.ready, false);
    assert.equal(result.code, "invalid_provider_redirect");
    assert.equal(response.bodyUsed, false);
    assertSafe(result);
  }
});

test("invalid Supabase configuration never makes a network request", async () => {
  for (const invalid of [
    { url: undefined },
    { key: undefined },
    { url: "not-a-url" },
    { url: "https://your-project.supabase.co" },
    { url: "http://mimo-demo.supabase.co" },
    { url: "https://evil.example" },
    { url: `https://${privateValue}@mimo-demo.supabase.co` },
    { key: "your-publishable-anon-key" },
    { key: "short" },
  ]) {
    let requests = 0;
    const result = await checkGoogleOAuthReadiness({
      ...config,
      ...invalid,
      fetcher: async () => {
        requests += 1;
        throw new Error(privateValue);
      },
    });
    assert.equal(requests, 0);
    assert.equal(result.ready, false);
    assert.equal(result.code, "invalid_config");
    assertSafe(result);
  }
});

test("invalid callback URLs are rejected before any network request", async () => {
  for (const redirectTo of ["", "/auth/callback", "javascript:alert(1)", "ftp://localhost/callback", `https://${privateValue}@example.com/callback`]) {
    let requests = 0;
    const result = await checkGoogleOAuthReadiness({
      ...config,
      redirectTo,
      fetcher: async () => {
        requests += 1;
        throw new Error(privateValue);
      },
    });
    assert.equal(requests, 0);
    assert.equal(result.ready, false);
    assert.equal(result.code, "invalid_redirect");
    assertSafe(result);
  }
});

test("network failures and timeouts return sanitized errors", async () => {
  for (const [failure, code] of [
    [new Error(privateValue), "network_error"],
    [new DOMException(privateValue, "TimeoutError"), "timeout"],
    [new DOMException(privateValue, "AbortError"), "timeout"],
  ] as const) {
    const result = await checkGoogleOAuthReadiness({
      ...config,
      fetcher: async () => { throw failure; },
    });
    assert.equal(result.ready, false);
    assert.equal(result.code, code);
    assert.ok(result.error);
    assertSafe(result);
  }
});

test("an aborted timeout signal is handled without waiting eight seconds", async (t) => {
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, 8000);
    const controller = new AbortController();
    controller.abort(new Error(privateValue));
    return controller.signal;
  });
  const result = await checkGoogleOAuthReadiness({
    ...config,
    fetcher: async (_input, init) => {
      init?.signal?.throwIfAborted();
      throw new Error("Expected an aborted signal");
    },
  });
  assert.equal(result.ready, false);
  assert.equal(result.code, "timeout");
  assertSafe(result);
});

test("malformed JSON and malformed or unknown provider errors are safe", async () => {
  const responses = [
    new Response(`<html>${privateValue}</html>`, { status: 400 }),
    Response.json(null, { status: 400 }),
    Response.json([privateValue], { status: 400 }),
    Response.json({ msg: { secret: privateValue } }, { status: 400 }),
    Response.json({ msg: 123, error_code: privateValue }, { status: 400 }),
    Response.json({ message: `missing OAuth secret ${privateValue}` }, { status: 400 }),
    Response.json({ msg: `Unsupported provider: ${privateValue}`, error_code: "validation_failed" }, { status: 400 }),
  ];
  for (const [index, response] of responses.entries()) {
    const result = await checkResponse(response);
    assert.equal(result.ready, false);
    assert.equal(result.code, index === 0 ? "invalid_response" : "provider_error");
    assert.ok(result.error);
    assertSafe(result);
  }
});

test("timeouts while reading the error body are safe", async () => {
  const response = new Response(null, { status: 400 });
  response.json = async () => { throw new DOMException(privateValue, "TimeoutError"); };
  const result = await checkResponse(response);
  assert.equal(result.ready, false);
  assert.equal(result.code, "timeout");
  assertSafe(result);
});

test("unexpected statuses and opaque redirects are not readiness evidence", async () => {
  const responses = [
    ...[200, 204, 401, 403, 429, 500].map((status) => new Response(null, {
      status,
      headers: { location: `https://accounts.google.com/?state=${privateValue}` },
    })),
    Response.error(),
  ];
  for (const response of responses) {
    const result = await checkResponse(response);
    assert.equal(result.ready, false);
    assert.equal(result.code, "unexpected_status");
    assert.equal(response.bodyUsed, false);
    assertSafe(result);
  }
});

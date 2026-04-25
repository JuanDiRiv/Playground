/* eslint-disable */
/**
 * Worker that runs user JS code against an array of test bodies.
 * Each test calls `expect(...).toBe/toEqual/...` and may `await wait(ms)`.
 *
 * Message in:  { code: string, tests: Array<{ name, body }> }
 * Message out: { type: 'done', results: Array<{ name, ok, error? }> }
 *           or { type: 'error', error: string }
 */
self.onmessage = async (event) => {
  const { code, tests } = event.data ?? {};

  const expect = (actual) => ({
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new Error(
          `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`expected falsy, got ${JSON.stringify(actual)}`);
    },
    toThrow() {
      let threw = false;
      try {
        if (typeof actual === "function") actual();
      } catch {
        threw = true;
      }
      if (!threw) throw new Error("expected function to throw");
    },
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const testBlocks = (tests ?? [])
      .map(
        (t, i) =>
          `try { await (async () => { ${t.body} })(); __results.push({ name: ${JSON.stringify(
            t.name,
          )}, ok: true }); } catch (e) { __results.push({ name: ${JSON.stringify(
            t.name,
          )}, ok: false, error: String(e && e.message ? e.message : e) }); }`,
      )
      .join("\n");

    const body = `${code}\nreturn (async () => { const __results = []; ${testBlocks} return __results; })();`;
    const fn = new Function("expect", "wait", body);
    const results = await fn(expect, wait);
    self.postMessage({ type: "done", results });
  } catch (err) {
    self.postMessage({
      type: "error",
      error: String(err && err.message ? err.message : err),
    });
  }
};

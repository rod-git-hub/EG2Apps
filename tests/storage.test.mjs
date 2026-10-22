// Storage: Even's storage (a fake bridge here), chunking of large values, batched writes, flush, retry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChunked, saveChunked, Store } from "../packages/shared/src/storage.ts";

/** A fake Even storage: getLocalStorage returns "" for a missing key, like the SDK. */
function fakeKV() {
  const data = new Map();
  let failing = false;
  return {
    data,
    fail(on) { failing = on; },
    kv: {
      get: async (k) => data.get(k) ?? "",
      set: async (k, v) => { if (failing) return false; data.set(k, v); return true; },
    },
  };
}

test("chunked save/load round trip, including values over 50,000 characters", async () => {
  const { kv, data } = fakeKV();
  const big = "é".repeat(120_000);
  assert.equal(await saveChunked(kv, "k", big), true);
  assert.equal(data.get("k.n"), "3");
  assert.equal(await loadChunked(kv, "k"), big);
  assert.equal(await saveChunked(kv, "k", "small"), true);
  assert.equal(await loadChunked(kv, "k"), "small");
  await saveChunked(kv, "k", null);
  assert.equal(await loadChunked(kv, "k"), null);
  assert.equal(await loadChunked(kv, "never-set"), null);
});

test("values load at start-up, writes are batched, flush saves, a restart reads them back", async () => {
  const s = fakeKV();
  await saveChunked(s.kv, "eg2notes.v1", '{"a":1}');
  const store = new Store(["eg2notes.v1", "eg2notes.settings"]);
  await store.init(s.kv, () => {});
  assert.equal(store.read("eg2notes.v1"), '{"a":1}');
  assert.equal(store.read("eg2notes.settings"), null);
  store.write("eg2notes.v1", '{"a":2}');
  store.write("eg2notes.v1", '{"a":3}'); // several edits → one write
  assert.equal(store.read("eg2notes.v1"), '{"a":3}', "readable at once");
  assert.equal(store.pending, true);
  await store.flush();
  assert.equal(store.pending, false);
  const again = new Store(["eg2notes.v1"]);
  await again.init(s.kv, () => {});
  assert.equal(again.read("eg2notes.v1"), '{"a":3}');
});

test("a failed write is reported and retried on the next flush", async () => {
  const s = fakeKV();
  const errors = [];
  const store = new Store(["k"]);
  await store.init(s.kv, (m) => errors.push(m));
  s.fail(true);
  store.write("k", "v");
  await store.flush();
  assert.equal(errors.length, 1);
  assert.equal(store.pending, true);
  s.fail(false);
  await store.flush();
  assert.equal(await loadChunked(s.kv, "k"), "v");
});

test("without the Even app (plain browser, no storage here), reads come back empty", async () => {
  const store = new Store(["k"]);
  await store.init(null, () => {});
  assert.equal(store.read("k"), null);
});

test("evenStorageWorks: true when a marker saves and reads back; false for a bridge with no Even app behind it", async () => {
  const { evenStorageWorks } = await import("../packages/shared/src/storage.ts");
  const real = fakeKV();
  assert.equal(await evenStorageWorks(real.kv), true);
  assert.equal(real.data.get("eg2.storage-check"), "", "the marker is cleared at once");
  const dead = { get: async () => "", set: async () => false }; // a plain browser's bridge (measured 2026-10-21)
  assert.equal(await evenStorageWorks(dead), false);
  const throwing = { get: async () => { throw new Error("no handler"); }, set: async () => { throw new Error("no handler"); } };
  assert.equal(await evenStorageWorks(throwing), false);
});

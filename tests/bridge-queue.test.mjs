// Tests for packages/shared/src/bridge-queue.ts: calls run one at a time, in order,
// each with a time limit, and a failed call doesn't block the next one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { serial } from "../packages/shared/src/bridge-queue.ts";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("runs calls one at a time, in order", async () => {
  const log = [];
  const call = (name, ms) => () => {
    log.push(`start ${name}`);
    return wait(ms).then(() => {
      log.push(`end ${name}`);
      return name;
    });
  };
  const results = await Promise.all([serial(call("a", 30), 1000), serial(call("b", 5), 1000)]);
  assert.deepEqual(results, ["a", "b"]);
  assert.deepEqual(log, ["start a", "end a", "start b", "end b"]);
});

test("a call that takes too long fails with a time-out", async () => {
  await assert.rejects(serial(() => wait(200), 20), /timed out after 20 ms/);
});

test("a failed call doesn't block the next one", async () => {
  const failed = serial(() => Promise.reject(new Error("boom")), 1000);
  const next = serial(() => Promise.resolve("ok"), 1000);
  await assert.rejects(failed, /boom/);
  assert.equal(await next, "ok");
});

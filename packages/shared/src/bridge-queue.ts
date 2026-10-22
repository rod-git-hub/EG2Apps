// One queue for every call to the Even app bridge: glasses drawing and storage.
// Even's guidance (glasses-ui skill): overlapping bridge calls, e.g. a render and a
// storage write, can crash the connection, and one flaky hop can hang for ~30 s,
// so calls run one at a time, each with a time limit.

let tail: Promise<unknown> = Promise.resolve();

/** Each call's name, how long it waited for the ones before it and how long it took (slow-link capture). */
let trace: (name: string, waitMs: number, runMs: number) => void = () => {};
export function onBridgeCall(fn: (name: string, waitMs: number, runMs: number) => void): void {
  trace = fn;
}

export function serial<T>(fn: () => Promise<T>, timeoutMs: number, name = "call"): Promise<T> {
  const queued = performance.now();
  const run = tail.then(
    () =>
      new Promise<T>((resolve, reject) => {
        const started = performance.now();
        let traced = false;
        const done = (): void => {
          if (!traced) trace(name, started - queued, performance.now() - started);
          traced = true;
        };
        const timer = setTimeout(() => { done(); reject(new Error(`Even app call timed out after ${timeoutMs} ms`)); }, timeoutMs);
        fn().then(
          (v) => { clearTimeout(timer); done(); resolve(v); },
          (e: unknown) => { clearTimeout(timer); done(); reject(e); },
        );
      }),
  );
  tail = run.catch(() => undefined); // a failed call doesn't block the next one
  return run;
}

// The app's data on the phone. Inside the Even app (installed, QR or simulator): Even's storage through the SDK
// (bridge.setLocalStorage), as Even recommends for all app state. The page's own browser storage is not used there:
// an installed app is served from http://127.0.0.1 on a port that changes every launch, and browser storage is tied to
// the port, so it would be lost. In a plain browser (preview, no Even app): browser localStorage.
//
// Values are loaded into memory at start-up, so reads are instant. Writes are saved shortly after a change (several
// edits → one write), through the shared bridge queue, in chunks of ≤ 50,000 characters (Even's guidance for large
// values). flush() saves at once (Even took the screen, the phone is locking, the app is closing).
// Measured on a phone (2026-10-21): values up to 1,000,000 characters save and read back intact in ~0.1 s.

import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { serial } from "./bridge-queue.ts";

/** What the Even bridge offers: getLocalStorage returns "" for a missing key. */
export interface AsyncKV {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<boolean>;
}

export const CHUNK_CHARS = 50_000;
const SAVE_DELAY_MS = 300;
const CALL_MS = 10_000;

/** Even's storage through the shared bridge queue (one bridge call at a time). */
export function bridgeKV(bridge: Pick<EvenAppBridge, "getLocalStorage" | "setLocalStorage">): AsyncKV {
  return {
    get: (key) => serial(() => bridge.getLocalStorage(key), CALL_MS, "storage get"),
    set: (key, value) => serial(() => bridge.setLocalStorage(key, value), CALL_MS, "storage set"),
  };
}

/**
 * True when Even's storage really works here. Outside the Even app (a plain browser) the SDK still returns a bridge,
 * but its reads give "" and its saves answer false (measured 2026-10-21), so the app checks by saving a marker and
 * reading it back.
 */
export async function evenStorageWorks(kv: AsyncKV, marker = "eg2.storage-check"): Promise<boolean> {
  try {
    const value = String(Math.random()).slice(2, 10);
    const works = (await kv.set(marker, value)) === true && (await kv.get(marker)) === value;
    if (works) await kv.set(marker, ""); // cleared at once: nothing about when the app was used stays behind
    return works;
  } catch {
    return false;
  }
}

/** Saves a value as `key.0`, `key.1`… plus the count in `key.n` (written last). null clears it. */
export async function saveChunked(kv: AsyncKV, key: string, value: string | null): Promise<boolean> {
  if (value === null) return kv.set(`${key}.n`, "");
  const n = Math.max(1, Math.ceil(value.length / CHUNK_CHARS));
  for (let i = 0; i < n; i++) {
    if (!(await kv.set(`${key}.${i}`, value.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS)))) return false;
  }
  return kv.set(`${key}.n`, String(n));
}

export async function loadChunked(kv: AsyncKV, key: string): Promise<string | null> {
  const n = Number(await kv.get(`${key}.n`));
  if (!Number.isInteger(n) || n < 1) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(await kv.get(`${key}.${i}`));
  return parts.join("");
}

function browserGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function browserSet(key: string, value: string | null): boolean {
  try {
    if (!globalThis.localStorage) return false;
    if (value === null) globalThis.localStorage.removeItem(key);
    else globalThis.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** An app's stored values: a fixed list of keys, cached in memory, saved in the background. */
export class Store<K extends string> {
  private readonly keys: readonly K[];
  private readonly cache = new Map<K, string | null>();
  private readonly dirty = new Set<K>();
  private backend: AsyncKV | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private reportError: (message: string) => void = () => {};

  constructor(keys: readonly K[]) {
    this.keys = keys;
  }

  /** Loads every key (from Even's storage, or the browser's when `kv` is null). */
  async init(kv: AsyncKV | null, onError: (message: string) => void): Promise<void> {
    this.backend = kv;
    this.reportError = onError;
    this.cache.clear();
    this.dirty.clear();
    for (const key of this.keys) this.cache.set(key, kv ? await loadChunked(kv, key) : browserGet(key));
  }

  read(key: K): string | null {
    return this.cache.get(key) ?? null;
  }

  /** Saves (or with null, clears) a value: at once in memory, shortly after on the phone. */
  write(key: K, value: string | null): void {
    this.cache.set(key, value);
    if (!this.backend) {
      if (!browserSet(key, value)) this.reportError(`couldn't save ${key} (browser storage unavailable or full)`);
      return;
    }
    this.dirty.add(key);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  /** True while changes wait to be saved. */
  get pending(): boolean {
    return this.dirty.size > 0;
  }

  /** Writes pending values now. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    const kv = this.backend;
    if (!kv) return;
    for (const key of [...this.dirty]) {
      this.dirty.delete(key);
      const ok = await saveChunked(kv, key, this.cache.get(key) ?? null).catch(() => false);
      if (!ok) {
        this.dirty.add(key); // try again with the next write or flush
        this.reportError(`couldn't save ${key} in the Even app's storage`);
      }
    }
  }
}

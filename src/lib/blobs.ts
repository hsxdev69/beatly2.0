/** Offline media storage (downloads + local files) using the Cache API. Client-only. */
const CACHE = "echo-media-v1";

function key(id: string) {
  return `${window.location.origin}/__media/${encodeURIComponent(id)}`;
}

export function storageAvailable(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  if (!storageAvailable()) throw new Error("Offline storage unavailable");
  const cache = await caches.open(CACHE);
  await cache.put(key(id), new Response(blob, { headers: { "content-type": blob.type || "audio/mp4", "content-length": String(blob.size) } }));
}

export async function getBlobUrl(id: string): Promise<string | null> {
  if (!storageAvailable()) return null;
  const cache = await caches.open(CACHE);
  const res = await cache.match(key(id));
  if (!res) return null;
  return URL.createObjectURL(await res.blob());
}

export async function hasBlob(id: string): Promise<boolean> {
  if (!storageAvailable()) return false;
  const cache = await caches.open(CACHE);
  return !!(await cache.match(key(id)));
}

export async function deleteBlob(id: string): Promise<void> {
  if (!storageAvailable()) return;
  const cache = await caches.open(CACHE);
  await cache.delete(key(id));
}

export async function clearBlobs(): Promise<void> {
  if (!storageAvailable()) return;
  await caches.delete(CACHE);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

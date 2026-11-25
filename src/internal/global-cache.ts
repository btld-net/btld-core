type Tag = string;
type Key = string;
type Timestamp = number;

interface StoredElement {
  readonly tag: Tag;
  readonly key: Key;
  readonly element: HTMLElement;
  readonly bucket: Timestamp | undefined;
}

interface ExpireBucket {
  readonly entries: Set<StoredElement>;
  readonly timer: ReturnType<typeof setTimeout>;
}

const _registry = {
  mapping: new Map<Tag, Tag>(),
  byKey: new Map<Tag, Map<Key, StoredElement>>(),
  byElement: new Map<HTMLElement, StoredElement>(),
  byBucket: new Map<Timestamp, ExpireBucket>(),
};

declare global {
  var __btld_v1: typeof _registry;
}

export const registry = (globalThis.__btld_v1 ??= _registry);

const MAX_TTL = 60 * 60 * 1000; // ttl > 1h doesnt make sense in the browser

function bucketFor(ttl?: number): Timestamp | undefined {
  if (ttl === undefined || ttl === Infinity) return undefined;
  if (!(ttl > 0)) throw RangeError('Negative ttl');
  return Math.ceil((performance.now() + Math.min(ttl, MAX_TTL)) / 100) * 100;
}

function schedule(at: Timestamp): ReturnType<typeof setTimeout> {
  return setTimeout(() => expire(at), at - performance.now());
}

function expire(at: Timestamp): void {
  const bucket = registry.byBucket.get(at);
  for (const entry of bucket?.entries || []) remove(entry);
}

function remove(entry: StoredElement | undefined): void {
  if (!entry) return;

  // Top level byKey maps are not removed.
  // Safe by invariant: a linked entry is present in every index.
  registry.byElement.delete(entry.element);
  registry.byKey.get(entry.tag)!.delete(entry.key);

  if (entry.bucket !== undefined) {
    const bucket = registry.byBucket.get(entry.bucket)!;
    bucket.entries.delete(entry);
    if (bucket.entries.size === 0) {
      clearTimeout(bucket.timer);
      registry.byBucket.delete(entry.bucket);
    }
  }
}

export function storeElement(element: HTMLElement, key: Key, ttl?: number): void {
  const entry = { tag: element.localName, key, element, bucket: bucketFor(ttl) };
  remove(registry.byElement.get(element));
  remove(registry.byKey.get(entry.tag)?.get(entry.key));

  let slots = registry.byKey.get(entry.tag);
  if (!slots) registry.byKey.set(entry.tag, (slots = new Map()));
  slots.set(entry.key, entry);

  registry.byElement.set(entry.element, entry);

  if (entry.bucket !== undefined) {
    let bucket = registry.byBucket.get(entry.bucket);
    if (!bucket) {
      bucket = { entries: new Set(), timer: schedule(entry.bucket) };
      registry.byBucket.set(entry.bucket, bucket);
    }
    bucket.entries.add(entry);
  }
}

export function retrieveElement(tag: Tag, key?: Key, mapped?: boolean): HTMLElement {
  const from = tag.toLowerCase();
  // Transitive mappings (A -> B -> C) are intentionally not followed.
  const target = mapped ? (registry.mapping.get(from) ?? from) : from;

  const entry = key === undefined ? undefined : registry.byKey.get(target)?.get(key);
  if (!entry) return document.createElement(target);
  remove(entry);
  return entry.element;
}

export function globalTagMapping(from: Tag, to: Tag) {
  registry.mapping.set(from.toLowerCase(), to.toLowerCase());
}

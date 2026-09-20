const memory = new Map<string, unknown>();

export function cacheGet<T>(key: string): T | undefined {
  return memory.get(key) as T | undefined;
}

export function cacheSet<T>(key: string, value: T): T {
  memory.set(key, value);
  return value;
}

export function cacheHas(key: string): boolean {
  return memory.has(key);
}

export function cacheClear(prefix?: string) {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key === prefix || key.startsWith(`${prefix}`)) memory.delete(key);
  }
}

export function cacheSize(): number {
  return memory.size;
}

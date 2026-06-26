type Awaitable<T> = T | Promise<T>;

export type CooldownEntry<Metadata> = {
  readonly metadata: Metadata;
  readonly expiresAt: number;
};

export type CooldownStore<Metadata> = {
  readonly get: (key: string, now: number) => Awaitable<CooldownEntry<Metadata> | null>;
  readonly set: (key: string, entry: CooldownEntry<Metadata>) => Awaitable<void>;
  readonly delete: (key: string) => Awaitable<unknown>;
};

export type CooldownDecision<Metadata> =
  | { readonly shouldCooldown: false }
  | {
      readonly shouldCooldown: true;
      readonly metadata: Metadata;
      readonly ttlMs?: number;
    };

export type WithCooldownOptions<T, Metadata> = {
  readonly key: string;
  readonly store: CooldownStore<Metadata>;
  readonly ttlMs: number;
  readonly now?: () => number;
  readonly getFreshValue: () => Awaitable<T>;
  readonly classifyError: (error: unknown) => CooldownDecision<Metadata>;
  readonly getCooldownValue: (entry: CooldownEntry<Metadata>) => Awaitable<T>;
};

export async function withCooldown<T, Metadata>({
  key,
  store,
  ttlMs,
  now = Date.now,
  getFreshValue,
  classifyError,
  getCooldownValue,
}: WithCooldownOptions<T, Metadata>): Promise<T> {
  const currentTime = now();
  const existing = await store.get(key, currentTime);

  if (existing) {
    return getCooldownValue(existing);
  }

  try {
    const value = await getFreshValue();
    await store.delete(key);
    return value;
  } catch (error) {
    const decision = classifyError(error);

    if (decision.shouldCooldown) {
      await store.set(key, {
        metadata: decision.metadata,
        expiresAt: now() + (decision.ttlMs ?? ttlMs),
      });
    }

    throw error;
  }
}

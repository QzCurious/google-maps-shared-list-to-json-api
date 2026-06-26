import { createHash } from "node:crypto";
import type { DbClient } from "../db/client.js";
import {
  withCooldown,
  type CooldownDecision,
  type CooldownStore,
} from "../services/exports.js";
import { GoogleMapsUpstreamError, type GoogleMapsUpstreamFailureReason } from "./errors.js";
import { fetchListSnapshot } from "./fetchListSnapshot.js";
import { resolveSharedListLink } from "./resolveSharedListLink.js";
import type { ListSnapshot } from "./listSnapshot.js";
import {
  createSqliteGoogleMapsFetchFailureCooldownStore,
  createSqliteGoogleMapsListSnapshotStore,
  createSqliteGoogleMapsSharedListLinkResolutionStore,
  type FetchFailureCooldownOperation,
  type GoogleMapsFetchFailureCooldownStore,
  type ResolvedGoogleMapsSharedListLink,
  type StoredListSnapshot,
} from "./sqliteStore.js";

export type SnapshotFreshness = {
  readonly etag: string;
  readonly maxAgeSeconds: number;
  readonly expiresAt: number;
};

export type AcquiredListSnapshot = {
  readonly snapshot: ListSnapshot;
  readonly freshness: SnapshotFreshness;
};

export type SharedListLinkInvalidation = {
  readonly linkResolutionDeleted: boolean;
  readonly linkResolutionFailureCooldownDeleted: boolean;
  readonly listSnapshotDeleted: boolean;
  readonly listSnapshotFailureCooldownDeleted: boolean;
  readonly listId: string | null;
};

export type GoogleMapsListAcquisition = {
  readonly getListSnapshot: (sharedListLink: string) => Promise<AcquiredListSnapshot>;
  readonly invalidateSharedListLink: (
    sharedListLink: string,
  ) => Promise<SharedListLinkInvalidation>;
};

export type GoogleMapsListAcquisitionPolicy = {
  readonly linkResolutionTtlMs: number;
  readonly listSnapshotTtlMs: number;
  readonly fetchFailureCooldownTtlMs: number;
};

type GoogleMapsListAcquisitionOptions = {
  readonly database: DbClient;
  readonly policy?: Partial<GoogleMapsListAcquisitionPolicy>;
};

const DEFAULT_POLICY: GoogleMapsListAcquisitionPolicy = {
  linkResolutionTtlMs: 60 * 60 * 1000,
  listSnapshotTtlMs: 60 * 60 * 1000,
  fetchFailureCooldownTtlMs: 5 * 60 * 1000,
};

type FetchFailureCooldownMetadata = {
  readonly reason: GoogleMapsUpstreamFailureReason;
  readonly errorMessage: string;
  readonly rawResponseText: string | null;
  readonly status: number | null;
};

function createSnapshotEtag(snapshotJson: string) {
  return `"${createHash("sha256").update(snapshotJson).digest("hex")}"`;
}

function toFreshness(snapshot: StoredListSnapshot): SnapshotFreshness {
  return {
    etag: snapshot.etag,
    maxAgeSeconds: Math.max(0, Math.floor((snapshot.expiresAt - Date.now()) / 1000)),
    expiresAt: snapshot.expiresAt,
  };
}

function cooldownToError(cooldown: FetchFailureCooldownMetadata): GoogleMapsUpstreamError {
  return new GoogleMapsUpstreamError(cooldown.errorMessage, cooldown.reason, {
    status: cooldown.status ?? undefined,
    rawResponseText: cooldown.rawResponseText ?? undefined,
  });
}

function toCooldownMetadata(error: GoogleMapsUpstreamError): FetchFailureCooldownMetadata {
  return {
    reason: error.reason,
    errorMessage: error.message,
    rawResponseText: error.rawResponseText ?? null,
    status: error.status ?? null,
  };
}

function classifyGoogleMapsUpstreamError(
  error: unknown,
): CooldownDecision<FetchFailureCooldownMetadata> {
  if (!(error instanceof GoogleMapsUpstreamError)) {
    return { shouldCooldown: false };
  }

  return {
    shouldCooldown: true,
    metadata: toCooldownMetadata(error),
  };
}

function createFetchFailureCooldownAdapter(
  store: GoogleMapsFetchFailureCooldownStore,
  operation: FetchFailureCooldownOperation,
): CooldownStore<FetchFailureCooldownMetadata> {
  return {
    async get(key, now) {
      const cooldown = await store.getFetchFailureCooldown(operation, key, now);
      if (!cooldown) return null;

      return {
        metadata: {
          reason: cooldown.reason,
          errorMessage: cooldown.errorMessage,
          rawResponseText: cooldown.rawResponseText,
          status: cooldown.status,
        },
        expiresAt: cooldown.expiresAt,
      };
    },

    async set(key, entry) {
      await store.putFetchFailureCooldown({
        operation,
        key,
        ...entry.metadata,
        expiresAt: entry.expiresAt,
      });
    },

    async delete(key) {
      await store.deleteFetchFailureCooldown(operation, key);
    },
  };
}

export function createGoogleMapsListAcquisition({
  database,
  policy: policyOverrides = {},
}: GoogleMapsListAcquisitionOptions): GoogleMapsListAcquisition {
  const linkResolutionStore = createSqliteGoogleMapsSharedListLinkResolutionStore(database);
  const listSnapshotStore = createSqliteGoogleMapsListSnapshotStore(database);
  const fetchFailureCooldownStore = createSqliteGoogleMapsFetchFailureCooldownStore(database);
  const linkResolutionFailureCooldownStore = createFetchFailureCooldownAdapter(
    fetchFailureCooldownStore,
    "link-resolution",
  );
  const listSnapshotFailureCooldownStore = createFetchFailureCooldownAdapter(
    fetchFailureCooldownStore,
    "list-snapshot",
  );
  const policy = { ...DEFAULT_POLICY, ...policyOverrides };

  async function getResolvedLink(
    sharedListLink: string,
    now: number,
  ): Promise<ResolvedGoogleMapsSharedListLink> {
    const cached = await linkResolutionStore.getLinkResolution(sharedListLink, now);
    if (cached) return cached;

    return withCooldown({
      key: sharedListLink,
      store: linkResolutionFailureCooldownStore,
      ttlMs: policy.fetchFailureCooldownTtlMs,
      getFreshValue: async () => {
        const resolved = await resolveSharedListLink(sharedListLink);
        const resolution = {
          link: sharedListLink,
          listId: resolved.listId,
          resolvedUrl: resolved.resolvedUrl,
          expiresAt: now + policy.linkResolutionTtlMs,
        };
        await linkResolutionStore.putLinkResolution(resolution);
        return resolution;
      },
      classifyError: classifyGoogleMapsUpstreamError,
      getCooldownValue(entry) {
        throw cooldownToError(entry.metadata);
      },
    });
  }

  async function getFetchedSnapshot(listId: string, now: number) {
    return withCooldown({
      key: listId,
      store: listSnapshotFailureCooldownStore,
      ttlMs: policy.fetchFailureCooldownTtlMs,
      getFreshValue: () => fetchListSnapshot(listId),
      classifyError: classifyGoogleMapsUpstreamError,
      getCooldownValue(entry) {
        throw cooldownToError(entry.metadata);
      },
    });
  }

  return {
    async getListSnapshot(sharedListLink) {
      const now = Date.now();
      const resolution = await getResolvedLink(sharedListLink, now);

      const cachedSnapshot = await listSnapshotStore.getListSnapshot(resolution.listId, now);
      if (cachedSnapshot) {
        return {
          snapshot: cachedSnapshot.snapshot,
          freshness: toFreshness(cachedSnapshot),
        };
      }

      const fetched = await getFetchedSnapshot(resolution.listId, now);
      const snapshotJson = JSON.stringify(fetched.snapshot);
      const storedSnapshot = {
        listId: resolution.listId,
        snapshot: fetched.snapshot,
        rawResponseText: fetched.rawResponseText,
        etag: createSnapshotEtag(snapshotJson),
        expiresAt: Date.now() + policy.listSnapshotTtlMs,
      };

      await listSnapshotStore.putListSnapshot(storedSnapshot);

      return {
        snapshot: storedSnapshot.snapshot,
        freshness: toFreshness(storedSnapshot),
      };
    },

    async invalidateSharedListLink(sharedListLink): Promise<SharedListLinkInvalidation> {
      const deletedResolution = await linkResolutionStore.deleteLinkResolution(sharedListLink);
      const linkResolutionFailureCooldownDeleted =
        await fetchFailureCooldownStore.deleteFetchFailureCooldown(
          "link-resolution",
          sharedListLink,
        );

      if (!deletedResolution.listId) {
        return {
          linkResolutionDeleted: deletedResolution.deleted,
          linkResolutionFailureCooldownDeleted,
          listSnapshotDeleted: false,
          listSnapshotFailureCooldownDeleted: false,
          listId: null,
        };
      }

      const [listSnapshotDeleted, listSnapshotFailureCooldownDeleted] = await Promise.all([
        listSnapshotStore.deleteListSnapshot(deletedResolution.listId),
        fetchFailureCooldownStore.deleteFetchFailureCooldown(
          "list-snapshot",
          deletedResolution.listId,
        ),
      ]);

      return {
        linkResolutionDeleted: deletedResolution.deleted,
        linkResolutionFailureCooldownDeleted,
        listSnapshotDeleted,
        listSnapshotFailureCooldownDeleted,
        listId: deletedResolution.listId,
      };
    },
  };
}

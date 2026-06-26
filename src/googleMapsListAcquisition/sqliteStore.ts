import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbClient } from "../db/client.js";
import {
  googleMapsFetchFailureCooldowns,
  googleMapsListSnapshots,
  googleMapsSharedListLinkResolutions,
} from "../db/schema.js";
import type { GoogleMapsUpstreamFailureReason } from "./errors.js";
import { ListSnapshotSchema, type ListSnapshot } from "./listSnapshot.js";

function isFresh(expiresAt: number, now: number) {
  return expiresAt > now;
}

export type ResolvedGoogleMapsSharedListLink = {
  readonly link: string;
  readonly listId: string;
  readonly resolvedUrl: string;
  readonly expiresAt: number;
};

export type LinkResolutionDeletionResult = {
  readonly deleted: boolean;
  readonly listId: string | null;
};

export type GoogleMapsSharedListLinkResolutionStore = {
  readonly getLinkResolution: (
    link: string,
    now: number,
  ) => Promise<ResolvedGoogleMapsSharedListLink | null>;
  readonly putLinkResolution: (resolution: ResolvedGoogleMapsSharedListLink) => Promise<void>;
  readonly deleteLinkResolution: (link: string) => Promise<LinkResolutionDeletionResult>;
};

export function createSqliteGoogleMapsSharedListLinkResolutionStore({
  db,
}: DbClient): GoogleMapsSharedListLinkResolutionStore {
  function deleteLinkResolution(link: string): LinkResolutionDeletionResult {
    const row = db
      .select()
      .from(googleMapsSharedListLinkResolutions)
      .where(eq(googleMapsSharedListLinkResolutions.link, link))
      .get();

    db.delete(googleMapsSharedListLinkResolutions)
      .where(eq(googleMapsSharedListLinkResolutions.link, link))
      .run();

    return {
      deleted: row !== undefined,
      listId: row?.listId ?? null,
    };
  }

  return {
    async getLinkResolution(link, now) {
      const row = db
        .select()
        .from(googleMapsSharedListLinkResolutions)
        .where(eq(googleMapsSharedListLinkResolutions.link, link))
        .get();

      if (!row) return null;
      if (!isFresh(row.expiresAt, now)) {
        deleteLinkResolution(link);
        return null;
      }

      return {
        link: row.link,
        listId: row.listId,
        resolvedUrl: row.resolvedUrl,
        expiresAt: row.expiresAt,
      } satisfies ResolvedGoogleMapsSharedListLink;
    },

    async putLinkResolution(resolution) {
      const timestamp = Date.now();
      db.insert(googleMapsSharedListLinkResolutions)
        .values({
          ...resolution,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: googleMapsSharedListLinkResolutions.link,
          set: {
            listId: resolution.listId,
            resolvedUrl: resolution.resolvedUrl,
            expiresAt: resolution.expiresAt,
            updatedAt: timestamp,
          },
        })
        .run();
    },

    async deleteLinkResolution(link) {
      return deleteLinkResolution(link);
    },
  };
}

const StoredListSnapshotSchema = z.object({
  listId: z.string(),
  snapshot: ListSnapshotSchema,
  rawResponseText: z.string(),
  etag: z.string(),
  expiresAt: z.number(),
});

export type StoredListSnapshot = {
  readonly listId: string;
  readonly snapshot: ListSnapshot;
  readonly rawResponseText: string;
  readonly etag: string;
  readonly expiresAt: number;
};

export type GoogleMapsListSnapshotStore = {
  readonly getListSnapshot: (listId: string, now: number) => Promise<StoredListSnapshot | null>;
  readonly putListSnapshot: (snapshot: StoredListSnapshot) => Promise<void>;
  readonly deleteListSnapshot: (listId: string) => Promise<boolean>;
};

function parseSnapshot(row: typeof googleMapsListSnapshots.$inferSelect): StoredListSnapshot | null {
  const parsed = StoredListSnapshotSchema.safeParse({
    listId: row.listId,
    snapshot: JSON.parse(row.snapshotJson),
    rawResponseText: row.rawResponseText,
    etag: row.etag,
    expiresAt: row.expiresAt,
  });

  return parsed.success ? parsed.data : null;
}

export function createSqliteGoogleMapsListSnapshotStore({
  db,
}: DbClient): GoogleMapsListSnapshotStore {
  function deleteListSnapshot(listId: string): boolean {
    const row = db
      .select({ listId: googleMapsListSnapshots.listId })
      .from(googleMapsListSnapshots)
      .where(eq(googleMapsListSnapshots.listId, listId))
      .get();

    db.delete(googleMapsListSnapshots)
      .where(eq(googleMapsListSnapshots.listId, listId))
      .run();

    return row !== undefined;
  }

  return {
    async getListSnapshot(listId, now) {
      const row = db
        .select()
        .from(googleMapsListSnapshots)
        .where(eq(googleMapsListSnapshots.listId, listId))
        .get();

      if (!row) return null;
      if (!isFresh(row.expiresAt, now)) {
        deleteListSnapshot(listId);
        return null;
      }

      const parsed = parseSnapshot(row);
      if (!parsed) {
        deleteListSnapshot(listId);
        return null;
      }

      return parsed;
    },

    async putListSnapshot(snapshot) {
      const timestamp = Date.now();
      db.insert(googleMapsListSnapshots)
        .values({
          listId: snapshot.listId,
          snapshotJson: JSON.stringify(snapshot.snapshot),
          rawResponseText: snapshot.rawResponseText,
          etag: snapshot.etag,
          expiresAt: snapshot.expiresAt,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: googleMapsListSnapshots.listId,
          set: {
            snapshotJson: JSON.stringify(snapshot.snapshot),
            rawResponseText: snapshot.rawResponseText,
            etag: snapshot.etag,
            expiresAt: snapshot.expiresAt,
            updatedAt: timestamp,
          },
        })
        .run();
    },

    async deleteListSnapshot(listId) {
      return deleteListSnapshot(listId);
    },
  };
}

export type FetchFailureCooldownOperation = "link-resolution" | "list-snapshot";

export type StoredFetchFailureCooldown = {
  readonly operation: FetchFailureCooldownOperation;
  readonly key: string;
  readonly reason: GoogleMapsUpstreamFailureReason;
  readonly errorMessage: string;
  readonly rawResponseText: string | null;
  readonly status: number | null;
  readonly expiresAt: number;
};

export type GoogleMapsFetchFailureCooldownStore = {
  readonly getFetchFailureCooldown: (
    operation: FetchFailureCooldownOperation,
    key: string,
    now: number,
  ) => Promise<StoredFetchFailureCooldown | null>;
  readonly putFetchFailureCooldown: (cooldown: StoredFetchFailureCooldown) => Promise<void>;
  readonly deleteFetchFailureCooldown: (
    operation: FetchFailureCooldownOperation,
    key: string,
  ) => Promise<boolean>;
};

export function createSqliteGoogleMapsFetchFailureCooldownStore({
  db,
}: DbClient): GoogleMapsFetchFailureCooldownStore {
  function deleteFetchFailureCooldown(
    operation: FetchFailureCooldownOperation,
    key: string,
  ): boolean {
    const where = and(
      eq(googleMapsFetchFailureCooldowns.operation, operation),
      eq(googleMapsFetchFailureCooldowns.key, key),
    );
    const row = db
      .select({
        operation: googleMapsFetchFailureCooldowns.operation,
        key: googleMapsFetchFailureCooldowns.key,
      })
      .from(googleMapsFetchFailureCooldowns)
      .where(where)
      .get();

    db.delete(googleMapsFetchFailureCooldowns).where(where).run();
    return row !== undefined;
  }

  return {
    async getFetchFailureCooldown(operation, key, now) {
      const row = db
        .select()
        .from(googleMapsFetchFailureCooldowns)
        .where(
          and(
            eq(googleMapsFetchFailureCooldowns.operation, operation),
            eq(googleMapsFetchFailureCooldowns.key, key),
          ),
        )
        .get();

      if (!row) return null;
      if (!isFresh(row.expiresAt, now)) {
        deleteFetchFailureCooldown(operation, key);
        return null;
      }

      return {
        operation: row.operation,
        key: row.key,
        reason: row.reason,
        errorMessage: row.errorMessage,
        rawResponseText: row.rawResponseText,
        status: row.status,
        expiresAt: row.expiresAt,
      } satisfies StoredFetchFailureCooldown;
    },

    async putFetchFailureCooldown(cooldown) {
      const timestamp = Date.now();
      db.insert(googleMapsFetchFailureCooldowns)
        .values({
          ...cooldown,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: [
            googleMapsFetchFailureCooldowns.operation,
            googleMapsFetchFailureCooldowns.key,
          ],
          set: {
            reason: cooldown.reason,
            errorMessage: cooldown.errorMessage,
            rawResponseText: cooldown.rawResponseText,
            status: cooldown.status,
            expiresAt: cooldown.expiresAt,
            updatedAt: timestamp,
          },
        })
        .run();
    },

    async deleteFetchFailureCooldown(operation, key) {
      return deleteFetchFailureCooldown(operation, key);
    },
  };
}

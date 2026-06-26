import { z } from "zod";

export const PlaceEntrySchema = z.object({
  name: z.string(),
  address: z.string(),
  note: z.string(),
  googleMapsUrl: z.string().url().nullable(),
});

export const ListSnapshotSchema = z.object({
  listId: z.string(),
  places: z.array(PlaceEntrySchema),
});

export type PlaceEntry = z.infer<typeof PlaceEntrySchema>;
export type ListSnapshot = z.infer<typeof ListSnapshotSchema>;

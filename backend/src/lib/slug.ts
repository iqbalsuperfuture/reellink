import { eq } from "drizzle-orm";
import slugify from "slugify";

import { db } from "../db/client";
import { reels } from "../db/schema";

const createSlugBase = (value: string) =>
  slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  });

export const generateUniqueReelSlug = async (
  title: string,
  currentReelId?: string,
) => {
  const baseSlug = createSlugBase(title) || "reel";
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await db.query.reels.findFirst({
      columns: { id: true },
      where: eq(reels.slug, candidate),
    });

    if (!existing || existing.id === currentReelId) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
};

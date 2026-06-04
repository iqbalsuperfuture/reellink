import { sql } from "drizzle-orm";

import { db, queryClient } from "./client";
import {
  analyticsEvents,
  creatorProfiles,
  reels,
  resources,
  users,
} from "./schema";
import { createId } from "../lib/ids";
import { generateUniqueReelSlug } from "../lib/slug";
import { hashPassword, sha256 } from "../lib/security";

const seed = async () => {
  const userId = createId("usr");
  const creatorId = createId("cr");
  const reelId = createId("reel");
  const productId = createId("res");
  const affiliateId = createId("res");
  const blogId = createId("res");
  const passwordHash = await hashPassword("Password123!");
  const slug = await generateUniqueReelSlug("Summer Outfit Ideas");

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      truncate table
        analytics_events,
        resources,
        reels,
        refresh_tokens,
        creator_profiles,
        users
      restart identity cascade
    `);

    await tx.insert(users).values({
      id: userId,
      email: "creator@reellink.dev",
      passwordHash,
      role: "CREATOR",
    });

    await tx.insert(creatorProfiles).values({
      id: creatorId,
      userId,
      username: "style_by_ana",
      displayName: "Ana",
      instagramUsername: "style_by_ana",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
      bio: "Fashion creator sharing outfits, travel, and daily finds.",
      plan: "FREE",
    });

    await tx.insert(reels).values({
      id: reelId,
      creatorId,
      instagramUrl: "https://www.instagram.com/reel/C123ABC/",
      instagramShortcode: "C123ABC",
      title: "Summer Outfit Ideas",
      caption: "Three easy outfits for hot days and city weekends.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1529139574466-a303027c1d8b",
      slug,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    });

    await tx.insert(resources).values([
      {
        id: productId,
        reelId,
        type: "PRODUCT",
        title: "Linen Green Dress",
        description: "The exact dress featured in the reel.",
        url: "https://example.com/linen-green-dress",
        imageUrl:
          "https://images.unsplash.com/photo-1496747611176-843222e1e57c",
        price: "49.99",
        currency: "USD",
        brand: "Coastline",
        category: "Dresses",
        position: 1,
      },
      {
        id: affiliateId,
        reelId,
        type: "AFFILIATE",
        title: "Creator Favorite Sandals",
        description: "Comfortable neutral sandals that go with everything.",
        url: "https://example.com/favorite-sandals",
        price: "69.00",
        currency: "USD",
        brand: "Sunwalk",
        category: "Shoes",
        position: 2,
      },
      {
        id: blogId,
        reelId,
        type: "BLOG",
        title: "Full Styling Notes",
        description: "Read the longer version with fit notes and alternatives.",
        url: "https://example.com/styling-notes",
        position: 3,
      },
    ]);

    await tx.insert(analyticsEvents).values([
      {
        id: createId("evt"),
        creatorId,
        reelId,
        eventType: "REEL_VIEW",
        ipHash: sha256("127.0.0.1"),
        userAgent: "Seed Agent",
        referrer: "https://instagram.com",
        country: "US",
        deviceType: "MOBILE",
      },
      {
        id: createId("evt"),
        creatorId,
        reelId,
        resourceId: productId,
        eventType: "RESOURCE_CLICK",
        ipHash: sha256("127.0.0.2"),
        userAgent: "Seed Agent",
        referrer: "https://instagram.com",
        country: "US",
        deviceType: "MOBILE",
      },
      {
        id: createId("evt"),
        creatorId,
        reelId,
        resourceId: blogId,
        eventType: "SAVE_REEL",
        ipHash: sha256("127.0.0.3"),
        userAgent: "Seed Agent",
        referrer: "https://instagram.com",
        country: "AE",
        deviceType: "DESKTOP",
      },
    ]);
  });

  console.log("Seed complete.");
};

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });

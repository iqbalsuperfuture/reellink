import { and, eq, gt, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "../db/client";
import { creatorProfiles, refreshTokens, users } from "../db/schema";
import {
  getTokenExpiryDate,
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
} from "../lib/auth";

export const buildAuthTokens = async (input: {
  userId: string;
  creatorId: string;
  role: "CREATOR" | "ADMIN";
}) => {
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(input),
    issueRefreshToken({ userId: input.userId }),
  ]);

  await db.insert(refreshTokens).values({
    id: refreshToken.tokenId,
    userId: input.userId,
    tokenHash: refreshToken.tokenHash,
    expiresAt: getTokenExpiryDate(refreshToken.decoded),
  });

  return {
    accessToken,
    refreshToken: refreshToken.token,
  };
};

export const verifyAndLoadRefreshSession = async (token: string) => {
  const payload = await verifyRefreshToken(token);

  if (payload.tokenType !== "refresh" || !payload.sub || !payload.jti) {
    throw new HTTPException(401, { message: "Invalid refresh token." });
  }

  const refreshToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.id, payload.jti),
      eq(refreshTokens.userId, payload.sub),
      isNull(refreshTokens.revokedAt),
      gt(refreshTokens.expiresAt, new Date()),
    ),
  });

  if (!refreshToken) {
    throw new HTTPException(401, { message: "Refresh token is no longer valid." });
  }

  const result = await db
    .select({
      user: users,
      profile: creatorProfiles,
    })
    .from(users)
    .innerJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(eq(users.id, payload.sub))
    .limit(1);

  const row = result[0];

  if (!row) {
    throw new HTTPException(401, { message: "Refresh token user not found." });
  }

  return {
    refreshToken,
    user: row.user,
    profile: row.profile,
  };
};

export const revokeRefreshToken = async (refreshTokenId: string) => {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, refreshTokenId));
};

import {
  SignJWT,
  decodeJwt,
  jwtVerify,
  errors as joseErrors,
  type JWTPayload,
} from "jose";

import { env } from "../config/env";
import { createId } from "./ids";
import { sha256 } from "./security";
import type { AccessTokenPayload, RefreshTokenPayload } from "./types";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export const issueAccessToken = async (payload: {
  userId: string;
  creatorId: string;
  role: "CREATOR" | "ADMIN";
}) =>
  new SignJWT({
    role: payload.role,
    creatorId: payload.creatorId,
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setJti(createId("at"))
    .setExpirationTime(env.ACCESS_TOKEN_EXPIRES_IN)
    .sign(accessSecret);

export const issueRefreshToken = async (payload: { userId: string }) => {
  const tokenId = createId("rt");
  const token = await new SignJWT({ tokenType: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setJti(tokenId)
    .setExpirationTime(env.REFRESH_TOKEN_EXPIRES_IN)
    .sign(refreshSecret);

  return {
    tokenId,
    token,
    tokenHash: sha256(token),
    decoded: decodeJwt(token),
  };
};

export const verifyAccessToken = async (token: string) => {
  const result = await jwtVerify(token, accessSecret);
  return result.payload as AccessTokenPayload;
};

export const verifyRefreshToken = async (token: string) => {
  const result = await jwtVerify(token, refreshSecret);
  return result.payload as RefreshTokenPayload;
};

export const getTokenExpiryDate = (payload: JWTPayload) => {
  if (!payload.exp) {
    throw new Error("Token is missing an expiry.");
  }

  return new Date(payload.exp * 1000);
};

export const isJoseJwtError = (error: unknown) =>
  error instanceof joseErrors.JWTExpired ||
  error instanceof joseErrors.JWTInvalid ||
  error instanceof joseErrors.JWSSignatureVerificationFailed;

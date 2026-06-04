import type { JWTPayload } from "jose";

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  role: "CREATOR" | "ADMIN";
  creatorId: string;
  tokenType: "access";
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  tokenType: "refresh";
}

export type AppBindings = {
  Variables: {
    auth: AccessTokenPayload;
  };
};

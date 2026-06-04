import { createHash } from "node:crypto";
import argon2 from "argon2";

export const hashPassword = (value: string) => argon2.hash(value);

export const verifyPassword = (hash: string, value: string) =>
  argon2.verify(hash, value);

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

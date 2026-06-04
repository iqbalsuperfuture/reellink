import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generateNanoid = customAlphabet(alphabet, 16);

export const createId = (prefix: string) => `${prefix}_${generateNanoid()}`;

const UNSAFE_PROTOCOLS = new Set(["javascript:", "data:", "file:"]);
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

export const assertSafeUrl = (value: string) => {
  const url = new URL(value);

  if (UNSAFE_PROTOCOLS.has(url.protocol) || !SAFE_PROTOCOLS.has(url.protocol)) {
    throw new Error("Unsupported URL protocol.");
  }

  return url.toString();
};

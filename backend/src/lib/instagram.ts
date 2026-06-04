const INSTAGRAM_REEL_REGEX =
  /^https?:\/\/(?:www\.)?instagram\.com\/reel\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/i;

export const extractInstagramShortcode = (instagramUrl: string) => {
  const normalized = instagramUrl.trim();
  const match = normalized.match(INSTAGRAM_REEL_REGEX);

  if (!match?.[1]) {
    throw new Error("Invalid Instagram Reel URL.");
  }

  return match[1];
};

export const normalizeInstagramReelUrl = (instagramUrl: string) => {
  const shortcode = extractInstagramShortcode(instagramUrl);

  return {
    shortcode,
    normalizedUrl: `https://www.instagram.com/reel/${shortcode}/`,
  };
};

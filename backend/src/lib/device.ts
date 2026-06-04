export const detectDeviceType = (userAgent?: string | null) => {
  if (!userAgent) {
    return "UNKNOWN";
  }

  const value = userAgent.toLowerCase();

  if (value.includes("ipad") || value.includes("tablet")) {
    return "TABLET";
  }

  if (
    value.includes("iphone") ||
    value.includes("android") ||
    value.includes("mobile")
  ) {
    return "MOBILE";
  }

  return "DESKTOP";
};

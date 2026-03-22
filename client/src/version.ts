function generateVersion(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `ver ${yy}${mm}${dd}-${hh}${min}`;
}

// In production builds, EXPO_PUBLIC_BUILD_VERSION is baked in at build time.
// In dev, it falls back to a live timestamp.
export const BUILD_VERSION: string =
  process.env.EXPO_PUBLIC_BUILD_VERSION || generateVersion();

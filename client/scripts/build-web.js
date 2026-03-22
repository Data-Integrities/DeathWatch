/**
 * Build script for Expo web export.
 *
 * Reads the version stamp from .build-version (created by `npm run stamp`)
 * and passes it as EXPO_PUBLIC_BUILD_VERSION so Metro bakes it into the bundle.
 *
 * Usage:
 *   npm run stamp        # on dev, before creating tarballs
 *   npm run build:web    # on server (or dev), reads .build-version
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', '.build-version');

let version;
if (fs.existsSync(versionFile)) {
  version = fs.readFileSync(versionFile, 'utf8').trim();
  console.log(`Build version: ${version}`);
} else {
  // Fallback: generate now
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  version = `ver ${yy}${mm}${dd}-${hh}${min}`;
  console.log(`No .build-version found, using: ${version}`);
}

execSync('npx expo export --platform web --no-minify --clear', {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_BUILD_VERSION: version },
});

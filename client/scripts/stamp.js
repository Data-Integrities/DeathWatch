/**
 * Writes the current timestamp as a build version to .build-version
 * and updates .env with EXPO_PUBLIC_BUILD_VERSION so both dev (Metro)
 * and production builds (build-web.js) use the same version.
 */
const fs = require('fs');
const path = require('path');

const d = new Date();
const yy = String(d.getFullYear()).slice(2);
const mm = String(d.getMonth() + 1).padStart(2, '0');
const dd = String(d.getDate()).padStart(2, '0');
const hh = String(d.getHours()).padStart(2, '0');
const min = String(d.getMinutes()).padStart(2, '0');
const version = `ver ${yy}${mm}${dd}-${hh}${min}`;

const clientDir = path.join(__dirname, '..');

// Write .build-version (travels with tarballs to staging/prod)
fs.writeFileSync(path.join(clientDir, '.build-version'), version);

// Update .env so Metro dev server picks it up too
const envPath = path.join(clientDir, '.env');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  // Remove existing line if present
  envContent = envContent.replace(/^EXPO_PUBLIC_BUILD_VERSION=.*\n?/m, '');
}
// Ensure trailing newline before appending
if (envContent && !envContent.endsWith('\n')) envContent += '\n';
envContent += `EXPO_PUBLIC_BUILD_VERSION=${version}\n`;
fs.writeFileSync(envPath, envContent);

console.log(`Stamped: ${version}`);

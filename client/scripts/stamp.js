/**
 * Writes the current timestamp as a build version to .build-version.
 * Run this on dev before creating deployment tarballs so the version
 * travels with the code to staging/prod.
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

const outPath = path.join(__dirname, '..', '.build-version');
fs.writeFileSync(outPath, version);
console.log(`Stamped: ${version}`);

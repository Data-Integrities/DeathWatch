const now = new Date();
const yy = String(now.getFullYear()).slice(2);
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const hh = String(now.getHours()).padStart(2, '0');
const min = String(now.getMinutes()).padStart(2, '0');

export const BUILD_VERSION = `ver ${yy}${mm}${dd}-${hh}${min}`;

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { logger } = require('./logger');

class FileCache {
  constructor(cacheDir) {
    this.cacheDir = cacheDir || config.cacheDir;
  }

  _getFilePath(key) {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  get(key) {
    const filePath = this._getFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      logger.warn(`Cache read error for ${key}:`, err);
    }
    return null;
  }

  set(key, value) {
    const filePath = this._getFilePath(key);
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
    } catch (err) {
      logger.warn(`Cache write error for ${key}:`, err);
    }
  }

  delete(key) {
    const filePath = this._getFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (err) {
      logger.warn(`Cache delete error for ${key}:`, err);
    }
    return false;
  }

  clear() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        }
      }
    } catch (err) {
      logger.warn('Cache clear error:', err);
    }
  }
}

const cache = new FileCache();

module.exports = { FileCache, cache };

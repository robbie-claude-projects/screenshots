// File Manager Utilities
// Handles file operations and cleanup

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

/**
 * Ensure screenshots directory exists
 */
export const ensureScreenshotsDir = async () => {
  try {
    await fs.access(SCREENSHOTS_DIR);
  } catch {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  }
};

/**
 * Get file age in hours
 * @param {string} filePath - Path to file
 * @returns {number} - Age in hours
 */
const getFileAgeHours = async (filePath) => {
  const stats = await fs.stat(filePath);
  const now = Date.now();
  const created = stats.mtime.getTime();
  return (now - created) / (1000 * 60 * 60);
};

/**
 * Clean up old screenshot files
 * @param {number} maxAgeHours - Maximum age in hours (default from config)
 * @returns {object} - { deleted: number, errors: number }
 */
export const cleanupOldScreenshots = async (maxAgeHours = config.cleanupHours) => {
  let deleted = 0;
  let errors = 0;

  try {
    await ensureScreenshotsDir();
    const files = await fs.readdir(SCREENSHOTS_DIR);

    for (const file of files) {
      // Only clean up screenshot and metadata files
      if (!file.endsWith('.png') && !file.endsWith('.json') && !file.endsWith('.zip')) {
        continue;
      }

      const filePath = path.join(SCREENSHOTS_DIR, file);

      try {
        const ageHours = await getFileAgeHours(filePath);

        if (ageHours > maxAgeHours) {
          await fs.unlink(filePath);
          deleted++;
          console.log(`Cleaned up: ${file} (${ageHours.toFixed(1)} hours old)`);
        }
      } catch (error) {
        errors++;
        console.error(`Failed to clean up ${file}:`, error.message);
      }
    }

    if (deleted > 0 || errors > 0) {
      console.log(`Cleanup complete: ${deleted} deleted, ${errors} errors`);
    }
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    errors++;
  }

  return { deleted, errors };
};

/**
 * Get screenshot directory stats
 * @returns {object} - { fileCount, totalSizeBytes }
 */
export const getScreenshotStats = async () => {
  let fileCount = 0;
  let totalSizeBytes = 0;

  try {
    await ensureScreenshotsDir();
    const files = await fs.readdir(SCREENSHOTS_DIR);

    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.json') || file.endsWith('.zip')) {
        const filePath = path.join(SCREENSHOTS_DIR, file);
        const stats = await fs.stat(filePath);
        fileCount++;
        totalSizeBytes += stats.size;
      }
    }
  } catch (error) {
    console.error('Failed to get stats:', error.message);
  }

  return { fileCount, totalSizeBytes };
};

/**
 * Start automatic cleanup interval
 * @param {number} intervalHours - How often to run cleanup
 */
export const startAutoCleanup = (intervalHours = 1) => {
  if (!config.enableAutoCleanup) {
    console.log('Auto cleanup disabled');
    return null;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`Starting auto cleanup every ${intervalHours} hour(s), removing files older than ${config.cleanupHours} hours`);

  // Run initial cleanup
  cleanupOldScreenshots();

  // Set up interval
  return setInterval(() => {
    cleanupOldScreenshots();
  }, intervalMs);
};

export default {
  ensureScreenshotsDir,
  cleanupOldScreenshots,
  getScreenshotStats,
  startAutoCleanup
};

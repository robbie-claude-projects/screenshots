// Application Configuration
// Can be overridden via environment variables

export const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Screenshot settings
  screenshotDir: process.env.SCREENSHOT_DIR || './screenshots',
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT, 10) || 3,
  timeoutMs: parseInt(process.env.TIMEOUT_MS, 10) || 60000,

  // Cleanup settings
  cleanupHours: parseInt(process.env.CLEANUP_HOURS, 10) || 24,
  enableAutoCleanup: process.env.ENABLE_AUTO_CLEANUP !== 'false',

  // Image quality (0-100 for JPEG, ignored for PNG)
  imageQuality: parseInt(process.env.IMAGE_QUALITY, 10) || 90,

  // Retry settings
  maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 1,
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS, 10) || 5000
};

export default config;

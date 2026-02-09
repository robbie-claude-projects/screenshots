import puppeteer from 'puppeteer';

const BROWSER_CONFIG = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ]
};

const DEFAULT_VIEWPORT = {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 2
};

// Viewport presets for different devices
export const VIEWPORT_PRESETS = {
  desktop: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2,
    label: 'Desktop (1920x1080)'
  },
  laptop: {
    width: 1366,
    height: 768,
    deviceScaleFactor: 2,
    label: 'Laptop (1366x768)'
  },
  mobile: {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    label: 'Mobile (375x667)'
  }
};

// Get viewport by name or return default
export const getViewport = (viewportName) => {
  if (viewportName && VIEWPORT_PRESETS[viewportName]) {
    const { label, ...viewport } = VIEWPORT_PRESETS[viewportName];
    return viewport;
  }
  return DEFAULT_VIEWPORT;
};

let browserInstance = null;

export const getBrowser = async () => {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch(BROWSER_CONFIG);
  }
  return browserInstance;
};

export const closeBrowser = async () => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};

export const captureScreenshot = async (url, outputPath, options = {}) => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const viewport = options.viewport || DEFAULT_VIEWPORT;
    await page.setViewport(viewport);

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Run beforeCapture callback if provided (for ad detection/replacement)
    let callbackResult = null;
    if (options.beforeCapture && typeof options.beforeCapture === 'function') {
      callbackResult = await options.beforeCapture(page);
    }

    await page.screenshot({
      path: outputPath,
      fullPage: false
    });

    return { success: true, path: outputPath, callbackResult };
  } finally {
    await page.close();
  }
};

export default {
  getBrowser,
  closeBrowser,
  captureScreenshot,
  VIEWPORT_PRESETS,
  getViewport
};

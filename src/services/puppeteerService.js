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

// Errors that should trigger a retry
const RETRYABLE_ERRORS = [
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_CONNECTION_REFUSED',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_NETWORK_CHANGED',
  'net::ERR_INTERNET_DISCONNECTED',
  'Timeout',
  'Navigation timeout'
];

// Check if error is retryable
const isRetryableError = (error) => {
  const message = error.message || '';
  return RETRYABLE_ERRORS.some(errType => message.includes(errType));
};

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Common cookie consent button selectors - ordered by specificity
const COOKIE_CONSENT_SELECTORS = [
  // Common "Accept All" buttons
  'button[id*="accept"]',
  'button[id*="Accept"]',
  'button[class*="accept"]',
  'button[class*="Accept"]',
  'a[id*="accept"]',
  'a[class*="accept"]',

  // GDPR/Privacy specific
  'button[id*="consent"]',
  'button[class*="consent"]',
  'button[id*="cookie"]',
  'button[class*="cookie"]',
  'button[id*="agree"]',
  'button[class*="agree"]',

  // Common CMP (Consent Management Platform) buttons
  '[data-testid="accept-all"]',
  '[data-testid="cookie-accept"]',
  '[aria-label*="Accept"]',
  '[aria-label*="accept"]',
  '[aria-label*="Agree"]',

  // OneTrust (common CMP)
  '#onetrust-accept-btn-handler',
  '.onetrust-accept-btn-handler',

  // Cookiebot
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',

  // TrustArc
  '.trustarc-agree-btn',

  // Quantcast
  '.qc-cmp2-summary-buttons button[mode="primary"]',

  // Generic text-based selectors (less reliable but useful fallback)
  'button:has-text("Accept All")',
  'button:has-text("Accept all")',
  'button:has-text("Accept")',
  'button:has-text("I agree")',
  'button:has-text("Agree")',
  'button:has-text("OK")',
  'button:has-text("Allow")',
  'button:has-text("Allow all")',

  // Disney/ESPN specific (from the screenshot)
  '[data-testid="Confirm"]',
  'button.acceptAll',
  'button[title="Accept All"]',
];

// Attempt to dismiss cookie consent banners
const dismissCookieConsent = async (page) => {
  try {
    // Wait a moment for cookie banners to appear
    await delay(1000);

    for (const selector of COOKIE_CONSENT_SELECTORS) {
      try {
        // Check if selector uses :has-text (not native, need to handle differently)
        if (selector.includes(':has-text')) {
          const textMatch = selector.match(/:has-text\("(.+)"\)/);
          if (textMatch) {
            const buttonText = textMatch[1];
            const clicked = await page.evaluate((text) => {
              const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"]'));
              for (const btn of buttons) {
                if (btn.innerText && btn.innerText.trim().toLowerCase().includes(text.toLowerCase())) {
                  const rect = btn.getBoundingClientRect();
                  // Check if button is visible
                  if (rect.width > 0 && rect.height > 0) {
                    btn.click();
                    return true;
                  }
                }
              }
              return false;
            }, buttonText);

            if (clicked) {
              console.log(`Cookie consent dismissed using text match: "${buttonText}"`);
              await delay(500);
              return true;
            }
          }
          continue;
        }

        // Try standard selector
        const button = await page.$(selector);
        if (button) {
          const isVisible = await page.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 &&
                   rect.height > 0 &&
                   style.visibility !== 'hidden' &&
                   style.display !== 'none';
          }, button);

          if (isVisible) {
            await button.click();
            console.log(`Cookie consent dismissed using selector: ${selector}`);
            await delay(500);
            return true;
          }
        }
      } catch {
        // Selector didn't match or click failed, try next
        continue;
      }
    }

    // No cookie banner found or dismissed
    return false;
  } catch (error) {
    console.warn('Error while attempting to dismiss cookie consent:', error.message);
    return false;
  }
};

// Navigate to URL with retry logic
const navigateWithRetry = async (page, url, maxRetries = 1, retryDelayMs = 5000) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries} for: ${url}`);
        await delay(retryDelayMs);
      }

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      return; // Success
    } catch (error) {
      lastError = error;

      // Only retry for specific network/timeout errors
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error;
      }

      console.log(`Navigation failed (${error.message}), will retry...`);
    }
  }

  throw lastError;
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

    // Navigate with retry logic for network failures
    await navigateWithRetry(page, url, options.maxRetries || 1, options.retryDelayMs || 5000);

    // Attempt to dismiss cookie consent banners
    const cookieDismissed = await dismissCookieConsent(page);
    if (cookieDismissed) {
      // Wait for any animations to complete after dismissing
      await delay(500);
    }

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

export { dismissCookieConsent };

export default {
  getBrowser,
  closeBrowser,
  captureScreenshot,
  dismissCookieConsent,
  VIEWPORT_PRESETS,
  getViewport
};

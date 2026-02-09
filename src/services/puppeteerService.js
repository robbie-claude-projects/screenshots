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

// CSS to hide ONLY specific known cookie consent banners (not generic patterns)
// This is applied AFTER consent is dismissed, not before
const COOKIE_BANNER_HIDE_CSS = `
  /* OneTrust - specific containers only */
  #onetrust-consent-sdk,
  #onetrust-banner-sdk,
  .onetrust-pc-dark-filter,

  /* Cookiebot - specific containers only */
  #CybotCookiebotDialog,
  #CybotCookiebotDialogBodyUnderlay,

  /* TrustArc */
  .truste_overlay,
  .truste_box_overlay,
  #truste-consent-track,

  /* Quantcast */
  .qc-cmp2-container,
  #qc-cmp2-container,

  /* Sourcepoint - specific container */
  div[id^="sp_message_container"],

  /* Didomi */
  #didomi-host,

  /* Cookie Control */
  #ccc,
  #ccc-overlay {
    display: none !important;
    visibility: hidden !important;
  }

  /* Remove body scroll lock */
  body.sp-message-open,
  body.didomi-popup-open,
  body.ccc-open {
    overflow: auto !important;
    position: static !important;
  }
`;

// Common cookie consent button selectors - ordered by priority
const COOKIE_CONSENT_SELECTORS = [
  // Primary - specific CMP buttons
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  '.qc-cmp2-summary-buttons button[mode="primary"]',
  '.trustarc-agree-btn',
  '.sp_choice_type_11',
  '[data-choice-type="ACCEPT_ALL"]',
  '#didomi-notice-agree-button',
  '.didomi-continue-without-agreeing',

  // Secondary - attribute-based
  'button[id*="accept"]',
  'button[id*="Accept"]',
  'button[class*="accept"]',
  'button[class*="Accept"]',
  'button[id*="consent"]',
  'button[class*="consent"]',
  'button[id*="agree"]',
  'button[class*="agree"]',
  'a[id*="accept"]',
  'a[class*="accept"]',

  // Tertiary - aria/data attributes
  '[aria-label*="Accept"]',
  '[aria-label*="accept"]',
  '[aria-label*="Agree"]',
  '[data-testid="accept-all"]',
  '[data-testid="cookie-accept"]',
  '[data-testid="Confirm"]',

  // Quaternary - title attributes
  'button[title*="Accept All"]',
  'button[title*="Accept all"]',
  'button[title*="Continue"]',
];

// Text patterns to match for accept buttons (case insensitive)
const ACCEPT_TEXT_PATTERNS = [
  /^accept\s*all$/i,
  /^accept\s*all\s*(&|and)\s*continue$/i,
  /^accept\s*cookies?$/i,
  /^accept$/i,
  /^i\s*accept$/i,
  /^agree$/i,
  /^i\s*agree$/i,
  /^agree\s*all$/i,
  /^allow\s*all$/i,
  /^allow$/i,
  /^ok$/i,
  /^got\s*it$/i,
  /^continue$/i,
  /^i\s*understand$/i,
  /^close$/i,
];

// Inject CSS to hide cookie banners
const injectCookieBannerHideCSS = async (page) => {
  try {
    await page.addStyleTag({ content: COOKIE_BANNER_HIDE_CSS });
    console.log('Injected CSS to hide cookie banners');
    return true;
  } catch (error) {
    console.warn('Failed to inject cookie banner CSS:', error.message);
    return false;
  }
};

// Remove cookie banner elements from DOM - only specific known CMP containers
const removeCookieBannerElements = async (page) => {
  try {
    const removedCount = await page.evaluate(() => {
      let count = 0;
      // Only remove specific known CMP containers - NOT generic patterns
      const selectorsToRemove = [
        '#onetrust-consent-sdk',
        '#CybotCookiebotDialog',
        '#CybotCookiebotDialogBodyUnderlay',
        '.qc-cmp2-container',
        '#qc-cmp2-container',
        '#didomi-host',
        '#truste-consent-track',
        '.truste_overlay',
        '#ccc',
        '#ccc-overlay'
      ];

      selectorsToRemove.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            el.remove();
            count++;
          });
        } catch {
          // Invalid selector, skip
        }
      });

      // Remove Sourcepoint containers (they have dynamic IDs)
      document.querySelectorAll('div[id^="sp_message_container"]').forEach(el => {
        el.remove();
        count++;
      });

      // Remove body classes that lock scrolling
      document.body.classList.remove(
        'sp-message-open',
        'didomi-popup-open',
        'ccc-open'
      );
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.documentElement.style.overflow = '';

      return count;
    });

    if (removedCount > 0) {
      console.log(`Removed ${removedCount} cookie banner elements from DOM`);
    }
    return removedCount;
  } catch (error) {
    console.warn('Failed to remove cookie banner elements:', error.message);
    return 0;
  }
};

// Try clicking consent button in a frame (page or iframe)
const tryClickConsentInFrame = async (frame) => {
  try {
    // First try selector-based approach
    for (const selector of COOKIE_CONSENT_SELECTORS) {
      try {
        const button = await frame.$(selector);
        if (button) {
          const isVisible = await frame.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 &&
                   rect.height > 0 &&
                   style.visibility !== 'hidden' &&
                   style.display !== 'none' &&
                   style.opacity !== '0';
          }, button);

          if (isVisible) {
            await button.click();
            return { clicked: true, method: `selector: ${selector}` };
          }
        }
      } catch {
        // Selector didn't match, try next
      }
    }

    // Then try text-based approach
    const clicked = await frame.evaluate((patterns) => {
      const buttons = Array.from(document.querySelectorAll(
        'button, a[role="button"], [role="button"], a, span[onclick], div[onclick]'
      ));

      for (const btn of buttons) {
        const text = btn.innerText?.trim() || '';
        const title = btn.getAttribute('title') || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';

        // Check all text sources
        const textSources = [text, title, ariaLabel];

        for (const textSource of textSources) {
          if (!textSource) continue;

          for (const patternObj of patterns) {
            const pattern = new RegExp(patternObj.source, patternObj.flags);
            if (pattern.test(textSource)) {
              const rect = btn.getBoundingClientRect();
              const style = window.getComputedStyle(btn);

              // Check if button is visible
              if (rect.width > 0 && rect.height > 0 &&
                  style.visibility !== 'hidden' &&
                  style.display !== 'none') {
                btn.click();
                return textSource;
              }
            }
          }
        }
      }
      return null;
    }, ACCEPT_TEXT_PATTERNS.map(p => ({ source: p.source, flags: p.flags })));

    if (clicked) {
      return { clicked: true, method: `text match: "${clicked}"` };
    }

    return { clicked: false };
  } catch {
    return { clicked: false };
  }
};

// Comprehensive cookie consent dismissal
const dismissCookieConsent = async (page) => {
  let dismissed = false;

  try {
    // Step 1: Wait for cookie banners to appear (they often load async)
    // Don't inject CSS yet - we need buttons to be visible for clicking
    await delay(1500);

    // Step 2: Try clicking on main page first
    const mainResult = await tryClickConsentInFrame(page);
    if (mainResult.clicked) {
      console.log(`Cookie consent dismissed on main page using ${mainResult.method}`);
      dismissed = true;
      await delay(1000); // Wait for banner to dismiss
    }

    // Step 3: Check ALL iframes (not just consent-related URLs)
    if (!dismissed) {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;

        try {
          const frameResult = await tryClickConsentInFrame(frame);
          if (frameResult.clicked) {
            console.log(`Cookie consent dismissed in iframe using ${frameResult.method}`);
            dismissed = true;
            await delay(1000); // Wait for banner to dismiss
            break;
          }
        } catch {
          // Frame might be inaccessible, continue
        }
      }
    }

    // Step 4: If not dismissed yet, wait and try again (late-loading banners)
    if (!dismissed) {
      await delay(1500);
      const retryResult = await tryClickConsentInFrame(page);
      if (retryResult.clicked) {
        console.log(`Cookie consent dismissed on retry using ${retryResult.method}`);
        dismissed = true;
        await delay(1000);
      }

      // Try iframes again
      if (!dismissed) {
        const frames = page.frames();
        for (const frame of frames) {
          if (frame === page.mainFrame()) continue;
          try {
            const frameResult = await tryClickConsentInFrame(frame);
            if (frameResult.clicked) {
              console.log(`Cookie consent dismissed in iframe on retry using ${frameResult.method}`);
              dismissed = true;
              await delay(1000);
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }

    // Step 5: ONLY after attempting to dismiss, inject CSS and remove elements
    // This ensures we don't hide buttons we need to click
    if (dismissed) {
      await injectCookieBannerHideCSS(page);
      await removeCookieBannerElements(page);
    }

    return dismissed;
  } catch (error) {
    console.warn('Error during cookie consent dismissal:', error.message);
    return dismissed;
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

// Wait for page to have visible content
const waitForPageContent = async (page, timeout = 10000) => {
  try {
    // Wait for body to exist and have content
    await page.waitForFunction(() => {
      const body = document.body;
      if (!body) return false;
      // Check that body has some visible content
      const hasContent = body.innerText.trim().length > 100 ||
                        body.querySelectorAll('img, video, canvas').length > 0;
      return hasContent;
    }, { timeout });
    return true;
  } catch {
    console.warn('Timeout waiting for page content, proceeding anyway');
    return false;
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

    // Set extra headers for better compatibility
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Navigate with retry logic for network failures
    await navigateWithRetry(page, url, options.maxRetries || 1, options.retryDelayMs || 5000);

    // Wait for page to have actual visible content
    await waitForPageContent(page, 15000);

    // Additional wait for dynamic content and ads to load
    await delay(3000);

    // Attempt to dismiss cookie consent banners
    await dismissCookieConsent(page);

    // Wait for page to stabilize after cookie dismissal
    await delay(2000);

    // Run beforeCapture callback if provided (for ad detection/replacement)
    let callbackResult = null;
    if (options.beforeCapture && typeof options.beforeCapture === 'function') {
      callbackResult = await options.beforeCapture(page, viewport);
    }

    // Wait for ad replacements to render
    await delay(2000);

    // Final cleanup - only remove specific known CMP containers
    await removeCookieBannerElements(page);

    await page.screenshot({
      path: outputPath,
      fullPage: false
    });

    return { success: true, path: outputPath, callbackResult };
  } finally {
    await page.close();
  }
};

export { dismissCookieConsent, removeCookieBannerElements };

export default {
  getBrowser,
  closeBrowser,
  captureScreenshot,
  dismissCookieConsent,
  removeCookieBannerElements,
  VIEWPORT_PRESETS,
  getViewport
};

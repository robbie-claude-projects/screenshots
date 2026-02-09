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

// CSS to hide common cookie consent banners and overlays
const COOKIE_BANNER_HIDE_CSS = `
  /* OneTrust */
  #onetrust-consent-sdk,
  #onetrust-banner-sdk,
  .onetrust-pc-dark-filter,
  .ot-fade-in,

  /* Cookiebot */
  #CybotCookiebotDialog,
  #CybotCookiebotDialogBodyUnderlay,

  /* TrustArc */
  .truste_overlay,
  .truste_box_overlay,
  #truste-consent-track,

  /* Quantcast */
  .qc-cmp2-container,
  #qc-cmp2-container,

  /* Sourcepoint */
  div[class*="sp_message_container"],
  .sp-message-open,
  div[data-sp-message],

  /* Didomi */
  #didomi-host,
  .didomi-popup-container,

  /* Generic cookie banner patterns */
  [class*="cookie-banner"],
  [class*="cookie-consent"],
  [class*="cookie-notice"],
  [class*="cookie-popup"],
  [class*="cookie-modal"],
  [class*="cookie-overlay"],
  [class*="gdpr-banner"],
  [class*="gdpr-consent"],
  [class*="gdpr-popup"],
  [class*="privacy-banner"],
  [class*="privacy-consent"],
  [class*="privacy-popup"],
  [class*="consent-banner"],
  [class*="consent-modal"],
  [class*="consent-popup"],
  [class*="consent-overlay"],
  [id*="cookie-banner"],
  [id*="cookie-consent"],
  [id*="cookie-notice"],
  [id*="cookie-popup"],
  [id*="gdpr-banner"],
  [id*="gdpr-consent"],
  [id*="privacy-banner"],
  [id*="consent-banner"],
  [id*="consent-modal"],

  /* Common modal/overlay patterns that might be consent related */
  .cc-window,
  .cc-banner,
  .cc-overlay,
  #cc-main,
  .js-cookie-consent,
  .cookie-law-info-bar,
  .cli-modal,
  .eupopup,
  .eu-cookie-bar,
  .cc_banner,
  .cc_container,

  /* Overlay backdrops */
  [class*="cookie"][class*="overlay"],
  [class*="consent"][class*="overlay"],
  [class*="gdpr"][class*="overlay"],
  [class*="privacy"][class*="backdrop"],
  [class*="consent"][class*="backdrop"] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  /* Remove body scroll lock that consent managers often add */
  body.sp-message-open,
  body.didomi-popup-open,
  body.cookie-consent-open,
  body.modal-open {
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

// Remove cookie banner elements from DOM
const removeCookieBannerElements = async (page) => {
  try {
    const removedCount = await page.evaluate(() => {
      let count = 0;
      const selectorsToRemove = [
        '#onetrust-consent-sdk',
        '#CybotCookiebotDialog',
        '.qc-cmp2-container',
        '#qc-cmp2-container',
        '#didomi-host',
        'div[class*="sp_message_container"]',
        '[class*="cookie-banner"]',
        '[class*="cookie-consent"]',
        '[class*="cookie-notice"]',
        '[class*="cookie-popup"]',
        '[class*="gdpr-banner"]',
        '[class*="consent-banner"]',
        '[class*="consent-modal"]',
        '.cc-window',
        '.cc-banner',
        '#cc-main'
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

      // Also remove fixed/sticky overlays that look like consent dialogs
      const allElements = document.querySelectorAll('div, aside, section');
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
        const hasHighZIndex = parseInt(style.zIndex) > 999;
        const coversScreen = el.offsetWidth > window.innerWidth * 0.5 ||
                             el.offsetHeight > window.innerHeight * 0.3;

        if (isFixedOrSticky && hasHighZIndex) {
          const text = el.innerText?.toLowerCase() || '';
          const hasCookieText = text.includes('cookie') ||
                                text.includes('consent') ||
                                text.includes('privacy') ||
                                text.includes('gdpr') ||
                                text.includes('accept') ||
                                text.includes('agree');
          if (hasCookieText && coversScreen) {
            el.remove();
            count++;
          }
        }
      });

      // Remove body classes that lock scrolling
      document.body.classList.remove(
        'sp-message-open',
        'didomi-popup-open',
        'cookie-consent-open',
        'modal-open',
        'no-scroll',
        'overflow-hidden'
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
    // Step 1: Inject CSS to hide banners immediately
    await injectCookieBannerHideCSS(page);

    // Step 2: Wait for cookie banners to appear (they often load async)
    await delay(2000);

    // Step 3: Try clicking on main page
    const mainResult = await tryClickConsentInFrame(page);
    if (mainResult.clicked) {
      console.log(`Cookie consent dismissed on main page using ${mainResult.method}`);
      dismissed = true;
    }

    // Step 4: Check ALL iframes (not just consent-related URLs)
    if (!dismissed) {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;

        try {
          const frameResult = await tryClickConsentInFrame(frame);
          if (frameResult.clicked) {
            console.log(`Cookie consent dismissed in iframe using ${frameResult.method}`);
            dismissed = true;
            break;
          }
        } catch {
          // Frame might be inaccessible, continue
        }
      }
    }

    // Step 5: Remove any remaining cookie banner elements from DOM
    await delay(500);
    await removeCookieBannerElements(page);

    // Step 6: Re-inject CSS in case page modified styles
    await injectCookieBannerHideCSS(page);

    // Step 7: Final cleanup - try again after a delay (some banners appear late)
    if (!dismissed) {
      await delay(1000);
      const retryResult = await tryClickConsentInFrame(page);
      if (retryResult.clicked) {
        console.log(`Cookie consent dismissed on retry using ${retryResult.method}`);
        dismissed = true;
      }
    }

    // Final DOM cleanup
    await removeCookieBannerElements(page);

    return dismissed;
  } catch (error) {
    console.warn('Error during cookie consent dismissal:', error.message);
    // Still try to remove elements even if clicking failed
    await removeCookieBannerElements(page);
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

    // Wait for page to fully settle (ads and dynamic content to load)
    await delay(2000);

    // Attempt to dismiss cookie consent banners (comprehensive approach)
    await dismissCookieConsent(page);

    // Additional wait after cookie dismissal for page to stabilize
    await delay(1000);

    // Run beforeCapture callback if provided (for ad detection/replacement)
    let callbackResult = null;
    if (options.beforeCapture && typeof options.beforeCapture === 'function') {
      callbackResult = await options.beforeCapture(page, viewport);
    }

    // Wait for ad replacements to render
    await delay(1500);

    // Final cookie banner cleanup before screenshot
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

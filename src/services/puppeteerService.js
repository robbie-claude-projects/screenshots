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

// ============================================================================
// POPUP/MODAL DISMISSAL - Subscription, Newsletter, Marketing Overlays
// ============================================================================

// Common popup/modal close button selectors
const POPUP_CLOSE_SELECTORS = [
  // Close buttons (X icons)
  '[aria-label="Close"]',
  '[aria-label="close"]',
  '[aria-label="Close modal"]',
  '[aria-label="Dismiss"]',
  'button.close',
  'button.close-btn',
  'button.close-button',
  'button[class*="close"]',
  'a.close',
  '.modal-close',
  '.modal__close',
  '.popup-close',
  '.popup__close',
  '.overlay-close',
  '[data-dismiss="modal"]',
  '[data-action="close"]',
  '[data-close]',
  '[data-testid="close-button"]',
  '[data-testid="modal-close"]',

  // Specific sites
  '.pn-Modal__close', // Piano
  '.tp-close', // Third-party modals
  '.newsletter-close',
  '.subscribe-close',
  '.paywall-close',

  // SVG close icons inside buttons
  'button svg[class*="close"]',
  'button:has(svg[viewBox="0 0 24 24"])', // Common icon size

  // Generic X buttons
  'button:has(span:only-child)',
];

// Text patterns for popup close/dismiss buttons
const POPUP_CLOSE_TEXT_PATTERNS = [
  /^×$/,  // × character
  /^✕$/,  // ✕ character
  /^x$/i,
  /^close$/i,
  /^dismiss$/i,
  /^no\s*thanks?$/i,
  /^not\s*now$/i,
  /^maybe\s*later$/i,
  /^skip$/i,
  /^cancel$/i,
  /^continue\s*(to\s*)?(site|reading|article)?$/i,
  /^i('?m)?\s*not\s*interested$/i,
  /^no,?\s*thanks?$/i,
  /^remind\s*me\s*later$/i,
];

// Selectors for popup/modal containers to remove
const POPUP_CONTAINER_SELECTORS = [
  // Generic modal patterns
  '.modal[aria-modal="true"]',
  '[role="dialog"]',
  '.modal-overlay',
  '.modal-backdrop',
  '.overlay',
  '.popup-overlay',

  // Subscription/Newsletter specific
  '[class*="subscribe-modal"]',
  '[class*="subscription-modal"]',
  '[class*="newsletter-modal"]',
  '[class*="paywall"]',
  '[class*="regwall"]',
  '[id*="subscribe-modal"]',
  '[id*="newsletter-modal"]',

  // Premium/Registration walls
  '[class*="premium-modal"]',
  '[class*="register-modal"]',
  '[class*="signup-modal"]',
  '[class*="login-modal"]',

  // Piano (common paywall provider)
  '.tp-modal',
  '.tp-iframe-wrapper',
  '#tp-global-wrapper',
  '[id^="offer-"]',

  // Specific site patterns
  '.pn-Modal__overlay', // Piano
  '.c-Modal', // Generic component
  '[class*="InlineSubscribe"]',
  '[class*="StickySubscribe"]',

  // Backdrop/overlay patterns
  '.backdrop',
  '[class*="backdrop"]',
  '[class*="overlay"]:not(video):not(.ad)',
];

// Try to click popup close buttons
const tryClosePopup = async (page) => {
  try {
    // Strategy 1: Click close buttons by selector
    for (const selector of POPUP_CLOSE_SELECTORS) {
      try {
        const buttons = await page.$$(selector);
        for (const button of buttons) {
          const isVisible = await page.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            // Check if in viewport and visible
            return rect.width > 0 &&
                   rect.height > 0 &&
                   rect.top >= 0 &&
                   rect.top < window.innerHeight &&
                   style.visibility !== 'hidden' &&
                   style.display !== 'none' &&
                   style.opacity !== '0';
          }, button);

          if (isVisible) {
            await button.click();
            console.log(`Popup closed using selector: ${selector}`);
            return true;
          }
        }
      } catch {
        // Selector didn't match or click failed
      }
    }

    // Strategy 2: Find close buttons by text content
    const closedByText = await page.evaluate((patterns) => {
      // Look for buttons/links with close-related text
      const candidates = document.querySelectorAll(
        'button, a, span[onclick], div[onclick], [role="button"]'
      );

      for (const el of candidates) {
        const text = (el.innerText || el.textContent || '').trim();
        const ariaLabel = el.getAttribute('aria-label') || '';

        // Check text content
        for (const patternObj of patterns) {
          const pattern = new RegExp(patternObj.source, patternObj.flags);
          if (pattern.test(text) || pattern.test(ariaLabel)) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            if (rect.width > 0 && rect.height > 0 &&
                rect.top >= 0 && rect.top < window.innerHeight &&
                style.visibility !== 'hidden' &&
                style.display !== 'none') {
              el.click();
              return text || ariaLabel;
            }
          }
        }
      }

      // Strategy 3: Look for X close icons in modal headers
      const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"], [class*="popup"]');
      for (const modal of modals) {
        const rect = modal.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // Find close buttons in top-right area of modal
        const closeBtn = modal.querySelector(
          'button:first-child, button:last-child, [class*="close"], [aria-label*="close" i], [aria-label*="Close"]'
        );
        if (closeBtn) {
          const btnRect = closeBtn.getBoundingClientRect();
          // Check if button is in top-right quadrant of modal
          if (btnRect.right >= rect.right - 100 && btnRect.top <= rect.top + 100) {
            closeBtn.click();
            return 'close button in modal header';
          }
        }
      }

      return null;
    }, POPUP_CLOSE_TEXT_PATTERNS.map(p => ({ source: p.source, flags: p.flags })));

    if (closedByText) {
      console.log(`Popup closed using text match: "${closedByText}"`);
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Error trying to close popup:', error.message);
    return false;
  }
};

// Remove popup elements from DOM
const removePopupElements = async (page) => {
  try {
    const result = await page.evaluate((selectors) => {
      let removedCount = 0;
      const removedTypes = [];

      // Remove popup containers
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            // Don't remove elements that are part of the main content
            const isMainContent = el.closest('article, main, .content, #content');
            if (!isMainContent && el.parentElement) {
              el.remove();
              removedCount++;
            }
          });
        } catch {
          // Invalid selector
        }
      }

      // Remove fixed/sticky overlays that cover the page
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Check for full-screen overlays
        if ((style.position === 'fixed' || style.position === 'absolute') &&
            rect.width >= window.innerWidth * 0.5 &&
            rect.height >= window.innerHeight * 0.5 &&
            style.zIndex && parseInt(style.zIndex) > 1000) {

          // Check if it looks like a modal/overlay (has backdrop or high z-index)
          const hasBackdrop = style.backgroundColor.includes('rgba') ||
                             parseFloat(style.opacity) < 1 ||
                             el.classList.toString().includes('modal') ||
                             el.classList.toString().includes('overlay') ||
                             el.classList.toString().includes('backdrop');

          // Don't remove video players or ad containers
          const isMedia = el.tagName === 'VIDEO' ||
                         el.querySelector('video') ||
                         el.classList.toString().includes('ad') ||
                         el.classList.toString().includes('player');

          if (hasBackdrop && !isMedia) {
            el.remove();
            removedCount++;
            removedTypes.push('full-screen overlay');
          }
        }
      }

      // Remove body scroll lock
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';

      // Remove common modal-open classes
      document.body.classList.remove(
        'modal-open',
        'has-modal',
        'no-scroll',
        'overflow-hidden',
        'modal-active',
        'popup-open'
      );

      return { removedCount, removedTypes };
    }, POPUP_CONTAINER_SELECTORS);

    if (result.removedCount > 0) {
      console.log(`Removed ${result.removedCount} popup elements`);
    }
    return result.removedCount;
  } catch (error) {
    console.warn('Error removing popup elements:', error.message);
    return 0;
  }
};

// Main popup dismissal function
const dismissPopups = async (page) => {
  let dismissed = false;

  try {
    // Try clicking close buttons first
    dismissed = await tryClosePopup(page);

    if (dismissed) {
      await delay(500); // Wait for animation
    }

    // Try again after a short delay (some popups appear late)
    if (!dismissed) {
      await delay(1000);
      dismissed = await tryClosePopup(page);
      if (dismissed) {
        await delay(500);
      }
    }

    // Always try to remove remaining popup elements
    await removePopupElements(page);

    // Press Escape key as fallback (closes many modals)
    try {
      await page.keyboard.press('Escape');
      await delay(300);
    } catch {
      // Ignore keyboard errors
    }

    return dismissed;
  } catch (error) {
    console.warn('Error during popup dismissal:', error.message);
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

// ============================================================================
// COMPREHENSIVE PAGE LOADING DETECTION
// ============================================================================

/**
 * Wait for images in the viewport to load
 * Checks that visible images have finished loading (naturalWidth > 0)
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<object>} - { loaded: number, pending: number, failed: number }
 */
const waitForViewportImagesToLoad = async (page, timeout = 15000) => {
  const startTime = Date.now();
  let lastStatus = { loaded: 0, pending: 0, failed: 0 };

  try {
    while (Date.now() - startTime < timeout) {
      const status = await page.evaluate(() => {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Get all images that are at least partially in viewport
        const images = Array.from(document.querySelectorAll('img'));
        const viewportImages = images.filter(img => {
          const rect = img.getBoundingClientRect();
          // Check if image is in viewport (with some buffer)
          return rect.bottom > -100 &&
                 rect.top < viewportHeight + 100 &&
                 rect.right > 0 &&
                 rect.left < viewportWidth &&
                 rect.width > 10 && rect.height > 10; // Ignore tiny images
        });

        let loaded = 0;
        let pending = 0;
        let failed = 0;

        for (const img of viewportImages) {
          if (img.complete) {
            if (img.naturalWidth > 0) {
              loaded++;
            } else {
              // Image loaded but has no content (failed or placeholder)
              failed++;
            }
          } else {
            pending++;
          }
        }

        return { loaded, pending, failed, total: viewportImages.length };
      });

      lastStatus = status;

      // If no pending images, we're done
      if (status.pending === 0) {
        console.log(`Viewport images loaded: ${status.loaded}/${status.total} (${status.failed} failed)`);
        return status;
      }

      // Wait a bit before checking again
      await delay(300);
    }

    console.log(`Image loading timeout - loaded: ${lastStatus.loaded}, pending: ${lastStatus.pending}`);
    return lastStatus;
  } catch (error) {
    console.warn('Error waiting for images:', error.message);
    return lastStatus;
  }
};

/**
 * Wait for ad iframes to load content
 * Checks iframes that look like ad containers for content
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<object>} - { loaded: number, pending: number }
 */
const waitForAdIframesToLoad = async (page, timeout = 10000) => {
  const startTime = Date.now();
  let lastStatus = { loaded: 0, pending: 0 };

  try {
    while (Date.now() - startTime < timeout) {
      const status = await page.evaluate(() => {
        const viewportHeight = window.innerHeight;

        // Find iframes that might be ad containers
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const adIframes = iframes.filter(iframe => {
          const rect = iframe.getBoundingClientRect();
          // Only check iframes in viewport with reasonable ad-like sizes
          const inViewport = rect.top < viewportHeight && rect.bottom > 0;
          const reasonableSize = rect.width >= 100 && rect.height >= 50;

          // Check if it looks like an ad iframe
          const src = iframe.src || '';
          const id = iframe.id || '';
          const className = iframe.className || '';

          const looksLikeAd =
            src.includes('ad') ||
            src.includes('doubleclick') ||
            src.includes('googlesyndication') ||
            src.includes('amazon-adsystem') ||
            id.toLowerCase().includes('ad') ||
            className.toLowerCase().includes('ad') ||
            iframe.closest('[class*="ad"]') !== null ||
            iframe.closest('[id*="ad"]') !== null;

          return inViewport && reasonableSize && looksLikeAd;
        });

        let loaded = 0;
        let pending = 0;

        for (const iframe of adIframes) {
          try {
            // Check if iframe has loaded (has contentWindow)
            // Note: Cross-origin iframes won't allow content inspection
            const hasContent = iframe.contentWindow &&
                              iframe.contentDocument &&
                              iframe.contentDocument.body &&
                              iframe.contentDocument.body.innerHTML.length > 0;

            if (hasContent) {
              loaded++;
            } else if (iframe.src) {
              // Has src but no content yet - might be loading
              pending++;
            } else {
              loaded++; // No src means it's likely filled programmatically
            }
          } catch {
            // Cross-origin iframe - assume loaded if it has a src
            if (iframe.src) {
              loaded++;
            }
          }
        }

        return { loaded, pending, total: adIframes.length };
      });

      lastStatus = status;

      // If we have some loaded iframes and few pending, we're good
      if (status.pending <= 1 || status.loaded >= status.total * 0.7) {
        console.log(`Ad iframes status: ${status.loaded}/${status.total} loaded`);
        return status;
      }

      await delay(500);
    }

    console.log(`Ad iframe loading timeout - loaded: ${lastStatus.loaded}, pending: ${lastStatus.pending}`);
    return lastStatus;
  } catch (error) {
    console.warn('Error waiting for ad iframes:', error.message);
    return lastStatus;
  }
};

/**
 * Wait for DOM to stabilize (stop changing)
 * Monitors for new elements being added to the DOM
 * @param {Page} page - Puppeteer page
 * @param {number} stableTime - Time with no changes to consider stable (ms)
 * @param {number} timeout - Maximum time to wait (ms)
 * @returns {Promise<boolean>} - True if DOM stabilized
 */
const waitForDOMStability = async (page, stableTime = 2000, timeout = 10000) => {
  try {
    const stable = await page.evaluate(async (stableTimeMs, timeoutMs) => {
      return new Promise((resolve) => {
        let lastChangeTime = Date.now();
        let elementCount = document.querySelectorAll('*').length;
        const startTime = Date.now();

        const checkStability = () => {
          const currentCount = document.querySelectorAll('*').length;
          const now = Date.now();

          if (currentCount !== elementCount) {
            elementCount = currentCount;
            lastChangeTime = now;
          }

          // Check if stable for required time
          if (now - lastChangeTime >= stableTimeMs) {
            resolve(true);
            return;
          }

          // Check for timeout
          if (now - startTime >= timeoutMs) {
            resolve(false);
            return;
          }

          // Check again in 200ms
          setTimeout(checkStability, 200);
        };

        // Also observe mutations for more accurate detection
        const observer = new MutationObserver(() => {
          lastChangeTime = Date.now();
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });

        // Start stability check
        setTimeout(checkStability, 200);

        // Cleanup observer on timeout
        setTimeout(() => {
          observer.disconnect();
        }, timeoutMs);
      });
    }, stableTime, timeout);

    console.log(`DOM stability: ${stable ? 'stable' : 'still changing'}`);
    return stable;
  } catch (error) {
    console.warn('Error checking DOM stability:', error.message);
    return false;
  }
};

/**
 * Wait for network activity to settle
 * More comprehensive than networkidle2 - waits for extended quiet period
 * @param {Page} page - Puppeteer page
 * @param {number} idleTime - Time with minimal requests to consider idle (ms)
 * @param {number} timeout - Maximum time to wait (ms)
 * @returns {Promise<boolean>} - True if network settled
 */
const waitForNetworkSettled = async (page, idleTime = 2000, timeout = 15000) => {
  return new Promise((resolve) => {
    let inflight = 0;
    let lastActivityTime = Date.now();
    const startTime = Date.now();
    let checkInterval;

    const onRequest = () => {
      inflight++;
      lastActivityTime = Date.now();
    };

    const onResponse = () => {
      inflight = Math.max(0, inflight - 1);
      if (inflight <= 2) {
        lastActivityTime = Date.now();
      }
    };

    const onFailed = () => {
      inflight = Math.max(0, inflight - 1);
    };

    const cleanup = () => {
      clearInterval(checkInterval);
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfailed', onFailed);
    };

    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfailed', onFailed);

    checkInterval = setInterval(() => {
      const now = Date.now();

      // Network is settled if we have few in-flight requests and
      // haven't had significant activity for idleTime
      if (inflight <= 2 && now - lastActivityTime >= idleTime) {
        cleanup();
        console.log('Network settled');
        resolve(true);
        return;
      }

      // Timeout
      if (now - startTime >= timeout) {
        cleanup();
        console.log(`Network settle timeout (${inflight} requests in flight)`);
        resolve(false);
      }
    }, 300);
  });
};

/**
 * Comprehensive wait for full page load
 * Combines multiple strategies to ensure page is fully rendered
 * @param {Page} page - Puppeteer page
 * @param {object} options - Wait options
 * @returns {Promise<object>} - Load status
 */
const waitForFullPageLoad = async (page, options = {}) => {
  const {
    waitForImages = true,
    waitForAds = true,
    waitForStability = true,
    waitForNetwork = true,
    maxWaitTime = 20000, // Maximum total wait time
    imageTimeout = 12000,
    adTimeout = 8000,
    stabilityTimeout = 6000,
    networkIdleTime = 2000
  } = options;

  const startTime = Date.now();
  const results = {
    images: null,
    ads: null,
    domStable: false,
    networkSettled: false,
    totalTime: 0
  };

  console.log('Waiting for full page load...');

  // Run parallel waits where possible
  const waitPromises = [];

  if (waitForImages) {
    waitPromises.push(
      waitForViewportImagesToLoad(page, imageTimeout).then(r => { results.images = r; })
    );
  }

  if (waitForAds) {
    waitPromises.push(
      waitForAdIframesToLoad(page, adTimeout).then(r => { results.ads = r; })
    );
  }

  if (waitForNetwork) {
    waitPromises.push(
      waitForNetworkSettled(page, networkIdleTime, Math.min(networkIdleTime + 5000, maxWaitTime))
        .then(r => { results.networkSettled = r; })
    );
  }

  // Wait for all parallel checks with overall timeout
  await Promise.race([
    Promise.all(waitPromises),
    delay(maxWaitTime)
  ]);

  // Check DOM stability last (after other content has loaded)
  if (waitForStability && Date.now() - startTime < maxWaitTime) {
    const remainingTime = Math.min(stabilityTimeout, maxWaitTime - (Date.now() - startTime));
    if (remainingTime > 1000) {
      results.domStable = await waitForDOMStability(page, 1500, remainingTime);
    }
  }

  results.totalTime = Date.now() - startTime;

  console.log(`Page load complete in ${results.totalTime}ms:`, {
    images: results.images ? `${results.images.loaded}/${results.images.total}` : 'skipped',
    ads: results.ads ? `${results.ads.loaded}/${results.ads.total}` : 'skipped',
    domStable: results.domStable,
    networkSettled: results.networkSettled
  });

  return results;
};

/**
 * Trigger lazy loading by scrolling viewport slightly
 * Some sites only load images when they're about to enter viewport
 * @param {Page} page - Puppeteer page
 */
const triggerLazyLoading = async (page) => {
  try {
    await page.evaluate(() => {
      // Scroll down slightly to trigger lazy loading
      window.scrollBy(0, 100);

      // Trigger any resize/scroll event listeners
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));

      // Scroll back to top
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    });

    await delay(500);
    console.log('Triggered lazy loading');
  } catch (error) {
    console.warn('Error triggering lazy loading:', error.message);
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

    // Wait for page to have actual visible content (basic check)
    await waitForPageContent(page, 15000);

    // Trigger lazy loading by scrolling slightly (for sites that use IntersectionObserver)
    await triggerLazyLoading(page);

    // Comprehensive wait for full page load
    // This waits for images, ad iframes, network activity, and DOM stability
    await waitForFullPageLoad(page, {
      waitForImages: true,
      waitForAds: true,
      waitForStability: true,
      waitForNetwork: true,
      maxWaitTime: 25000,    // Maximum total wait time
      imageTimeout: 15000,   // Wait up to 15s for viewport images
      adTimeout: 12000,      // Wait up to 12s for ad iframes
      stabilityTimeout: 5000, // Wait up to 5s for DOM to stabilize
      networkIdleTime: 2500  // Require 2.5s of network quiet time
    });

    // Attempt to dismiss cookie consent banners
    await dismissCookieConsent(page);

    // Attempt to dismiss popups (subscription, newsletter, etc.)
    await dismissPopups(page);

    // Short wait for any animations/transitions after popup dismissal
    await delay(1000);

    // Run beforeCapture callback if provided (for ad detection/replacement)
    let callbackResult = null;
    if (options.beforeCapture && typeof options.beforeCapture === 'function') {
      callbackResult = await options.beforeCapture(page, viewport);
    }

    // Wait for ad replacements to render and any new images to load
    await delay(1500);

    // Quick check for any newly added images after ad replacement
    await waitForViewportImagesToLoad(page, 5000);

    // Final cleanup - remove any remaining popups and cookie banners
    await removePopupElements(page);
    await removeCookieBannerElements(page);

    // Final brief pause to ensure all rendering is complete
    await delay(500);

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

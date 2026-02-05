// Ad Detection Module - Iframe and CSS-based detection
// Scans pages for ad placements using multiple detection methods

// Known ad server domains
const AD_SERVER_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'adnxs.com',
  'advertising.com',
  'adserver.com',
  'serving-sys.com',
  'googleadservices.com',
  'moatads.com',
  'adsrvr.org',
  'rubiconproject.com'
];

// IAB Standard ad sizes for reference
const IAB_SIZES = {
  '300x250': 'Medium Rectangle',
  '728x90': 'Leaderboard',
  '300x600': 'Half Page',
  '320x50': 'Mobile Banner',
  '320x100': 'Large Mobile Banner',
  '160x600': 'Wide Skyscraper',
  '970x250': 'Billboard',
  '970x90': 'Super Leaderboard'
};

// Common ad container CSS selectors
const AD_CONTAINER_SELECTORS = [
  '.ad',
  '.ads',
  '.advertisement',
  '.adslot',
  '.ad-slot',
  '.ad-container',
  '.ad-wrapper',
  '.ad-unit',
  '.adunit',
  '.ad-banner',
  '.banner-ad',
  '[class*="ad-"]',
  '[class*="-ad"]',
  '[id*="ad-"]',
  '[id*="-ad"]',
  '[data-ad]',
  '[data-ad-slot]',
  '[data-google-query-id]'
];

// Patterns to identify ad-related class/id names
const AD_PATTERNS = [
  /^ad$/i,
  /^ads$/i,
  /^ad[-_]/i,
  /[-_]ad$/i,
  /[-_]ad[-_]/i,
  /advertisement/i,
  /adslot/i,
  /adunit/i,
  /ad[-_]?banner/i,
  /banner[-_]?ad/i,
  /sponsored/i,
  /dfp[-_]/i,
  /gpt[-_]?ad/i
];

/**
 * Check if a URL contains any known ad server domain
 * @param {string} src - The iframe src URL
 * @returns {boolean} - True if the URL is from an ad server
 */
export const isAdServerUrl = (src) => {
  if (!src) return false;
  const lowerSrc = src.toLowerCase();
  return AD_SERVER_DOMAINS.some(domain => lowerSrc.includes(domain));
};

/**
 * Get the IAB size name for given dimensions
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @returns {string|null} - IAB size name or null if not standard
 */
export const getIABSizeName = (width, height) => {
  const sizeKey = `${width}x${height}`;
  return IAB_SIZES[sizeKey] || null;
};

/**
 * Check if dimensions match any IAB standard size (with tolerance)
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @param {number} tolerance - Pixel tolerance for matching (default 5)
 * @returns {string|null} - Matching IAB size string or null
 */
export const matchIABSize = (width, height, tolerance = 5) => {
  for (const sizeKey of Object.keys(IAB_SIZES)) {
    const [iabWidth, iabHeight] = sizeKey.split('x').map(Number);
    if (
      Math.abs(width - iabWidth) <= tolerance &&
      Math.abs(height - iabHeight) <= tolerance
    ) {
      return sizeKey;
    }
  }
  return null;
};

/**
 * Check if a class or id name matches ad patterns
 * @param {string} name - Class or id name to check
 * @returns {boolean} - True if name matches ad patterns
 */
export const isAdRelatedName = (name) => {
  if (!name) return false;
  return AD_PATTERNS.some(pattern => pattern.test(name));
};

/**
 * Detect ad placements on a page using iframe analysis
 * This function runs in the browser context via page.evaluate()
 * @param {object} page - Puppeteer page object
 * @returns {Promise<Array>} - Array of detected ad placements
 */
export const detectIframeAds = async (page) => {
  const placements = await page.evaluate((adDomains) => {
    const results = [];
    const iframes = document.querySelectorAll('iframe');

    iframes.forEach((iframe, index) => {
      const src = iframe.src || iframe.getAttribute('data-src') || '';
      const isAdServer = adDomains.some(domain =>
        src.toLowerCase().includes(domain)
      );

      if (isAdServer) {
        const rect = iframe.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);

        // Generate a unique selector for this iframe
        let selector = '';
        if (iframe.id) {
          selector = `#${iframe.id}`;
        } else if (iframe.name) {
          selector = `iframe[name="${iframe.name}"]`;
        } else {
          selector = `iframe:nth-of-type(${index + 1})`;
        }

        results.push({
          selector,
          size: { width, height },
          sizeString: `${width}x${height}`,
          type: 'iframe',
          src,
          visible: rect.width > 0 && rect.height > 0
        });
      }
    });

    return results;
  }, AD_SERVER_DOMAINS);

  // Add IAB size names to placements
  return placements.map(placement => ({
    ...placement,
    iabSize: getIABSizeName(placement.size.width, placement.size.height)
  }));
};

/**
 * Detect ad placements using CSS selectors and patterns
 * @param {object} page - Puppeteer page object
 * @returns {Promise<Array>} - Array of detected ad placements
 */
export const detectCSSAds = async (page) => {
  const placements = await page.evaluate((selectors, patterns) => {
    const results = [];
    const processedElements = new Set();

    // Convert pattern strings back to RegExp
    const adPatterns = patterns.map(p => new RegExp(p.source, p.flags));

    // Helper to check if element matches ad patterns
    const matchesAdPattern = (element) => {
      const classes = Array.from(element.classList || []);
      const id = element.id || '';

      // Check id
      if (id && adPatterns.some(pattern => pattern.test(id))) {
        return true;
      }

      // Check classes
      return classes.some(cls => adPatterns.some(pattern => pattern.test(cls)));
    };

    // Helper to generate selector for element
    const generateSelector = (element) => {
      if (element.id) {
        return `#${element.id}`;
      }
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          return `.${classes[0]}`;
        }
      }
      return element.tagName.toLowerCase();
    };

    // Helper to get unique identifier for deduplication
    const getElementKey = (element) => {
      const rect = element.getBoundingClientRect();
      return `${rect.left}-${rect.top}-${rect.width}-${rect.height}`;
    };

    // Search using predefined selectors
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const key = getElementKey(element);
          if (processedElements.has(key)) return;

          const rect = element.getBoundingClientRect();
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);

          // Only include visible elements with reasonable dimensions
          if (width >= 50 && height >= 50 && width <= 1000 && height <= 700) {
            processedElements.add(key);
            results.push({
              selector: generateSelector(element),
              size: { width, height },
              sizeString: `${width}x${height}`,
              type: 'css',
              matchedSelector: selector,
              visible: rect.width > 0 && rect.height > 0
            });
          }
        });
      } catch {
        // Invalid selector, skip
      }
    });

    // Search all elements for ad-related class/id patterns
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      const key = getElementKey(element);
      if (processedElements.has(key)) return;

      if (matchesAdPattern(element)) {
        const rect = element.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);

        // Only include visible elements with reasonable dimensions
        if (width >= 50 && height >= 50 && width <= 1000 && height <= 700) {
          processedElements.add(key);
          results.push({
            selector: generateSelector(element),
            size: { width, height },
            sizeString: `${width}x${height}`,
            type: 'css',
            matchedSelector: 'pattern-match',
            visible: rect.width > 0 && rect.height > 0
          });
        }
      }
    });

    return results;
  }, AD_CONTAINER_SELECTORS, AD_PATTERNS.map(p => ({ source: p.source, flags: p.flags })));

  // Add IAB size names to placements
  return placements.map(placement => ({
    ...placement,
    iabSize: getIABSizeName(placement.size.width, placement.size.height) ||
             (matchIABSize(placement.size.width, placement.size.height) ?
               IAB_SIZES[matchIABSize(placement.size.width, placement.size.height)] : null)
  }));
};

/**
 * Detect all ad placements using both iframe and CSS methods
 * @param {object} page - Puppeteer page object
 * @returns {Promise<Array>} - Combined array of detected ad placements
 */
export const detectAds = async (page) => {
  const [iframeAds, cssAds] = await Promise.all([
    detectIframeAds(page),
    detectCSSAds(page)
  ]);

  // Combine results, avoiding duplicates based on position
  const allAds = [...iframeAds];
  const existingPositions = new Set(
    iframeAds.map(ad => `${ad.size.width}-${ad.size.height}-${ad.selector}`)
  );

  cssAds.forEach(ad => {
    const key = `${ad.size.width}-${ad.size.height}-${ad.selector}`;
    if (!existingPositions.has(key)) {
      allAds.push(ad);
      existingPositions.add(key);
    }
  });

  return allAds;
};

/**
 * Get list of known ad server domains
 * @returns {Array<string>} - List of ad server domains
 */
export const getAdServerDomains = () => [...AD_SERVER_DOMAINS];

/**
 * Get IAB standard sizes
 * @returns {object} - Object mapping size strings to names
 */
export const getIABSizes = () => ({ ...IAB_SIZES });

/**
 * Get ad container selectors
 * @returns {Array<string>} - List of CSS selectors for ad containers
 */
export const getAdContainerSelectors = () => [...AD_CONTAINER_SELECTORS];

/**
 * Get ad-related name patterns
 * @returns {Array<RegExp>} - List of patterns for ad-related names
 */
export const getAdPatterns = () => AD_PATTERNS.map(p => new RegExp(p.source, p.flags));

export default {
  detectAds,
  detectIframeAds,
  detectCSSAds,
  isAdServerUrl,
  isAdRelatedName,
  getIABSizeName,
  matchIABSize,
  getAdServerDomains,
  getIABSizes,
  getAdContainerSelectors,
  getAdPatterns
};

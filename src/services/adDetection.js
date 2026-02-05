// Ad Detection Module - Iframe-based detection
// Scans pages for ad placements by detecting iframes from known ad servers

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
 * Get list of known ad server domains
 * @returns {Array<string>} - List of ad server domains
 */
export const getAdServerDomains = () => [...AD_SERVER_DOMAINS];

/**
 * Get IAB standard sizes
 * @returns {object} - Object mapping size strings to names
 */
export const getIABSizes = () => ({ ...IAB_SIZES });

export default {
  detectIframeAds,
  isAdServerUrl,
  getIABSizeName,
  getAdServerDomains,
  getIABSizes
};

// Ad Replacement Module
// Replaces detected ad placements with client ad creatives

import { matchIABSize } from './adDetection.js';

/**
 * Parse ad size string into width and height
 * @param {string} sizeString - Size string like "300x250"
 * @returns {object|null} - { width, height } or null if invalid
 */
export const parseSize = (sizeString) => {
  if (!sizeString || typeof sizeString !== 'string') return null;
  const match = sizeString.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10)
  };
};

/**
 * Match client ads to detected placements by size
 * @param {Array} placements - Detected ad placements
 * @param {Array} clientAds - Client ads with { url, size } properties
 * @returns {Array} - Array of matches { placement, clientAd }
 */
export const matchAdsToplacements = (placements, clientAds) => {
  const matches = [];
  const usedPlacements = new Set();

  // Sort client ads by size to prioritize exact matches
  const sortedClientAds = [...clientAds].sort((a, b) => {
    const sizeA = parseSize(a.size);
    const sizeB = parseSize(b.size);
    if (!sizeA || !sizeB) return 0;
    return (sizeB.width * sizeB.height) - (sizeA.width * sizeA.height);
  });

  for (const clientAd of sortedClientAds) {
    const targetSize = parseSize(clientAd.size);
    if (!targetSize) continue;

    // Find matching placements for this ad size
    for (const placement of placements) {
      if (usedPlacements.has(placement.selector)) continue;

      const placementSize = placement.size;

      // Check for exact match or match within tolerance
      const isExactMatch =
        placementSize.width === targetSize.width &&
        placementSize.height === targetSize.height;

      const isToleranceMatch = matchIABSize(
        placementSize.width,
        placementSize.height,
        10
      ) === clientAd.size;

      if (isExactMatch || isToleranceMatch) {
        matches.push({
          placement,
          clientAd
        });
        usedPlacements.add(placement.selector);
        break; // Move to next client ad
      }
    }
  }

  return matches;
};

/**
 * Replace ads on the page with client ad creatives
 * @param {object} page - Puppeteer page object
 * @param {Array} matches - Array of { placement, clientAd } matches
 * @returns {Promise<object>} - Results of replacement { successful, failed }
 */
export const replaceAds = async (page, matches) => {
  const results = {
    successful: [],
    failed: []
  };

  for (const match of matches) {
    const { placement, clientAd } = match;

    try {
      const replaced = await page.evaluate((selector, adUrl, adSize, placementType) => {
        // Find the element
        let element = document.querySelector(selector);

        if (!element) {
          // Try alternative selectors
          if (selector.startsWith('.')) {
            const className = selector.substring(1);
            element = document.querySelector(`[class*="${className}"]`);
          }
        }

        if (!element) {
          return { success: false, error: 'Element not found' };
        }

        try {
          if (placementType === 'iframe') {
            // Replace iframe src
            if (element.tagName === 'IFRAME') {
              element.src = adUrl;
              element.style.border = 'none';
            } else {
              // Find iframe within the element
              const iframe = element.querySelector('iframe');
              if (iframe) {
                iframe.src = adUrl;
                iframe.style.border = 'none';
              } else {
                // Create new iframe
                const newIframe = document.createElement('iframe');
                newIframe.src = adUrl;
                newIframe.width = adSize.width;
                newIframe.height = adSize.height;
                newIframe.style.border = 'none';
                newIframe.scrolling = 'no';
                element.innerHTML = '';
                element.appendChild(newIframe);
              }
            }
          } else {
            // CSS-based ad: replace with image
            element.innerHTML = '';
            element.style.width = `${adSize.width}px`;
            element.style.height = `${adSize.height}px`;
            element.style.overflow = 'hidden';
            element.style.display = 'flex';
            element.style.alignItems = 'center';
            element.style.justifyContent = 'center';

            // Check if URL is an image or iframe source
            const isImageUrl = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(adUrl);

            if (isImageUrl) {
              const img = document.createElement('img');
              img.src = adUrl;
              img.style.maxWidth = '100%';
              img.style.maxHeight = '100%';
              img.style.objectFit = 'contain';
              element.appendChild(img);
            } else {
              // Treat as iframe source
              const iframe = document.createElement('iframe');
              iframe.src = adUrl;
              iframe.width = adSize.width;
              iframe.height = adSize.height;
              iframe.style.border = 'none';
              iframe.scrolling = 'no';
              element.appendChild(iframe);
            }
          }

          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }, placement.selector, clientAd.url, parseSize(clientAd.size), placement.type);

      if (replaced.success) {
        results.successful.push({
          selector: placement.selector,
          size: clientAd.size,
          url: clientAd.url,
          type: placement.type
        });
        console.log(`Replaced ad at ${placement.selector} with ${clientAd.size} creative`);
      } else {
        results.failed.push({
          selector: placement.selector,
          size: clientAd.size,
          url: clientAd.url,
          error: replaced.error
        });
        console.log(`Failed to replace ad at ${placement.selector}: ${replaced.error}`);
      }
    } catch (error) {
      results.failed.push({
        selector: placement.selector,
        size: clientAd.size,
        url: clientAd.url,
        error: error.message
      });
      console.log(`Error replacing ad at ${placement.selector}: ${error.message}`);
    }
  }

  return results;
};

/**
 * Wait for ad creatives to load
 * @param {object} page - Puppeteer page object
 * @param {number} delayMs - Delay in milliseconds (default 3000)
 */
export const waitForAdsToLoad = async (page, delayMs = 3000) => {
  // Wait for network to be idle
  try {
    await page.waitForNetworkIdle({ timeout: delayMs });
  } catch {
    // Timeout is fine, continue anyway
  }

  // Additional delay to ensure rendering
  await new Promise(resolve => setTimeout(resolve, delayMs));
};

/**
 * Process ad replacement workflow
 * @param {object} page - Puppeteer page object
 * @param {Array} placements - Detected ad placements
 * @param {Array} clientAds - Client ads with { url, size } properties
 * @returns {Promise<object>} - Replacement results
 */
export const processAdReplacement = async (page, placements, clientAds) => {
  // Filter out empty client ads
  const validClientAds = clientAds.filter(ad => ad.url && ad.url.trim() !== '');

  if (validClientAds.length === 0) {
    console.log('No valid client ads provided');
    return { successful: [], failed: [], matches: [] };
  }

  if (placements.length === 0) {
    console.log('No ad placements detected for replacement');
    return { successful: [], failed: [], matches: [] };
  }

  // Match ads to placements
  const matches = matchAdsToplacements(placements, validClientAds);
  console.log(`Matched ${matches.length} client ads to placements`);

  if (matches.length === 0) {
    console.log('No size matches found between client ads and detected placements');
    return { successful: [], failed: [], matches: [] };
  }

  // Replace ads
  const results = await replaceAds(page, matches);

  // Wait for new ads to load
  await waitForAdsToLoad(page);

  return {
    ...results,
    matches: matches.map(m => ({
      placement: m.placement.selector,
      clientAd: { url: m.clientAd.url, size: m.clientAd.size }
    }))
  };
};

export default {
  parseSize,
  matchAdsToplacements,
  replaceAds,
  waitForAdsToLoad,
  processAdReplacement
};

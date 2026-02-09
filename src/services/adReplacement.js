// Ad Replacement Module
// Replaces detected ad placements with client ad creatives

import { matchIABSize, matchVideoAspectRatio } from './adDetection.js';
import { getBrowser } from './puppeteerService.js';
import path from 'path';
import fs from 'fs';

// Directory for temporary creative screenshots
const TEMP_CREATIVE_DIR = path.join(process.cwd(), 'screenshots', 'temp_creatives');

// Ensure temp creative directory exists
const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_CREATIVE_DIR)) {
    fs.mkdirSync(TEMP_CREATIVE_DIR, { recursive: true });
  }
};

/**
 * Check if URL is a Google DV360 preview URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if DV360 preview URL
 */
export const isDV360PreviewUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'displayvideo.google.com' &&
           parsed.pathname.includes('/doubleclick/preview');
  } catch {
    return false;
  }
};

/**
 * Extract size parameters from DV360 preview URL
 * @param {string} url - DV360 preview URL
 * @returns {object|null} - { width, height } or null
 */
export const extractDV360Size = (url) => {
  try {
    const parsed = new URL(url);
    const flexWidth = parsed.searchParams.get('flexWidth');
    const flexHeight = parsed.searchParams.get('flexHeight');

    if (flexWidth && flexHeight) {
      return {
        width: parseInt(flexWidth, 10),
        height: parseInt(flexHeight, 10)
      };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Extract ad creative from DV360 preview page as screenshot
 * @param {string} previewUrl - DV360 preview URL
 * @param {string} adId - Unique identifier for the ad
 * @returns {Promise<string|null>} - Path to screenshot or null on failure
 */
export const extractDV360Creative = async (previewUrl, adId) => {
  ensureTempDir();

  const browser = await getBrowser();
  let page = null;

  try {
    page = await browser.newPage();

    // Get size from URL parameters
    const size = extractDV360Size(previewUrl);
    const width = size?.width || 300;
    const height = size?.height || 250;

    // Set viewport to match ad size with some padding for the preview interface
    await page.setViewport({
      width: Math.max(width + 200, 800),
      height: Math.max(height + 200, 600),
      deviceScaleFactor: 2
    });

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    console.log(`Loading DV360 preview for extraction: ${previewUrl}`);

    // Navigate to preview page
    await page.goto(previewUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for the ad to fully render
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Try to find the actual ad creative within the preview page
    const creativeInfo = await page.evaluate((expectedWidth, expectedHeight) => {
      // Strategy 1: Look for iframes containing ad content
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        const rect = iframe.getBoundingClientRect();
        // Check if iframe dimensions roughly match expected ad size
        const widthMatch = Math.abs(rect.width - expectedWidth) < 50;
        const heightMatch = Math.abs(rect.height - expectedHeight) < 50;

        if (widthMatch && heightMatch && rect.width > 100 && rect.height > 50) {
          return {
            type: 'iframe',
            selector: `iframe[src="${iframe.src}"]`,
            bounds: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          };
        }
      }

      // Strategy 2: Look for preview container with specific classes
      const previewSelectors = [
        '.creative-preview-container',
        '.preview-creative',
        '[class*="preview"][class*="creative"]',
        '[class*="ad-preview"]',
        '.creative-frame',
        '[data-creative-preview]',
        // DV360 specific containers
        '.preview-wrapper',
        '[class*="PreviewFrame"]',
        'creative-preview'
      ];

      for (const selector of previewSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          const rect = container.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 50) {
            return {
              type: 'container',
              selector: selector,
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            };
          }
        }
      }

      // Strategy 3: Find any element matching the expected dimensions
      const allElements = document.querySelectorAll('div, iframe, img');
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        const widthMatch = Math.abs(rect.width - expectedWidth) < 20;
        const heightMatch = Math.abs(rect.height - expectedHeight) < 20;

        if (widthMatch && heightMatch && rect.width > 100) {
          // Make sure it's not a tiny element or hidden
          const style = window.getComputedStyle(el);
          if (style.visibility !== 'hidden' && style.display !== 'none') {
            return {
              type: 'element',
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            };
          }
        }
      }

      // Strategy 4: Look for the largest visible element that could be the ad
      let bestCandidate = null;
      let bestArea = 0;

      const candidates = document.querySelectorAll('iframe, [class*="creative"], [class*="preview"], [class*="ad"]');
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;

        // Must be visible and have reasonable size
        if (rect.width >= 100 && rect.height >= 50 && area > bestArea) {
          const style = window.getComputedStyle(el);
          if (style.visibility !== 'hidden' && style.display !== 'none') {
            bestArea = area;
            bestCandidate = {
              type: 'best-match',
              bounds: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            };
          }
        }
      }

      return bestCandidate;
    }, width, height);

    if (!creativeInfo) {
      console.warn('Could not locate ad creative in DV360 preview page');
      // Take screenshot of entire page as fallback
      const fallbackPath = path.join(TEMP_CREATIVE_DIR, `dv360_fallback_${adId}.png`);
      await page.screenshot({ path: fallbackPath, fullPage: false });
      return fallbackPath;
    }

    console.log(`Found creative element: ${creativeInfo.type}`, creativeInfo.bounds);

    // Take screenshot of just the creative area
    const screenshotPath = path.join(TEMP_CREATIVE_DIR, `dv360_${adId}.png`);

    await page.screenshot({
      path: screenshotPath,
      clip: {
        x: Math.max(0, Math.floor(creativeInfo.bounds.x)),
        y: Math.max(0, Math.floor(creativeInfo.bounds.y)),
        width: Math.ceil(creativeInfo.bounds.width),
        height: Math.ceil(creativeInfo.bounds.height)
      }
    });

    console.log(`Extracted DV360 creative screenshot: ${screenshotPath}`);
    return screenshotPath;

  } catch (error) {
    console.error('Failed to extract DV360 creative:', error.message);
    return null;
  } finally {
    if (page) {
      await page.close();
    }
  }
};

/**
 * Convert image file to base64 data URL
 * @param {string} filePath - Path to image file
 * @returns {string|null} - Base64 data URL or null on failure
 */
const fileToBase64DataUrl = (filePath) => {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Failed to convert file to base64: ${error.message}`);
    return null;
  }
};

/**
 * Pre-process client ads to handle DV360 URLs
 * Extracts creatives from DV360 preview pages and converts to base64 data URLs
 * @param {Array} clientAds - Client ads array
 * @returns {Promise<Array>} - Processed client ads with DV360 URLs converted
 */
export const preprocessClientAds = async (clientAds) => {
  const processedAds = [];

  for (let i = 0; i < clientAds.length; i++) {
    const ad = clientAds[i];

    if (ad.url && isDV360PreviewUrl(ad.url)) {
      console.log(`Processing DV360 preview URL: ${ad.url}`);

      // Extract the creative from DV360 preview
      const screenshotPath = await extractDV360Creative(ad.url, `ad_${i}_${Date.now()}`);

      if (screenshotPath) {
        // Convert screenshot to base64 data URL for browser context
        const dataUrl = fileToBase64DataUrl(screenshotPath);

        if (dataUrl) {
          processedAds.push({
            ...ad,
            originalUrl: ad.url,
            url: dataUrl,
            isDV360Extracted: true
          });
          console.log(`DV360 creative extracted and converted to base64 for ad ${i}`);

          // Clean up temporary file
          try {
            fs.unlinkSync(screenshotPath);
          } catch {
            // Ignore cleanup errors
          }
        } else {
          // Keep original URL as fallback
          console.warn(`Failed to convert DV360 creative to base64 for ad ${i}, using original URL`);
          processedAds.push(ad);
        }
      } else {
        // Keep original URL as fallback
        console.warn(`Failed to extract DV360 creative for ad ${i}, using original URL`);
        processedAds.push(ad);
      }
    } else {
      processedAds.push(ad);
    }
  }

  return processedAds;
};

// SVG play button overlay for video ad placements
const PLAY_BUTTON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;opacity:0.9;pointer-events:none;">
  <circle cx="50" cy="50" r="45" fill="rgba(0,0,0,0.6)" stroke="white" stroke-width="3"/>
  <polygon points="40,30 40,70 75,50" fill="white"/>
</svg>
`;

/**
 * Check if two sizes match within a percentage tolerance
 * @param {object} size1 - { width, height }
 * @param {object} size2 - { width, height }
 * @param {number} tolerancePercent - Tolerance as percentage (e.g., 15 for 15%)
 * @returns {boolean} - True if sizes match within tolerance
 */
const sizesMatchWithTolerance = (size1, size2, tolerancePercent = 15) => {
  const widthDiff = Math.abs(size1.width - size2.width);
  const heightDiff = Math.abs(size1.height - size2.height);

  const widthTolerance = Math.max(size1.width, size2.width) * (tolerancePercent / 100);
  const heightTolerance = Math.max(size1.height, size2.height) * (tolerancePercent / 100);

  return widthDiff <= widthTolerance && heightDiff <= heightTolerance;
};

/**
 * Check if aspect ratios match (for flexible size matching)
 * @param {object} size1 - { width, height }
 * @param {object} size2 - { width, height }
 * @param {number} tolerance - Aspect ratio tolerance (e.g., 0.1 for 10%)
 * @returns {boolean} - True if aspect ratios are similar
 */
const aspectRatiosMatch = (size1, size2, tolerance = 0.15) => {
  const ratio1 = size1.width / size1.height;
  const ratio2 = size2.width / size2.height;
  return Math.abs(ratio1 - ratio2) / Math.max(ratio1, ratio2) <= tolerance;
};

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
 * Uses a multi-tier matching approach:
 * 1. Exact size match
 * 2. IAB standard size match (within 20px tolerance)
 * 3. Flexible tolerance match (within 15% and similar aspect ratio)
 * @param {Array} placements - Detected ad placements
 * @param {Array} clientAds - Client ads with { url, size } properties
 * @returns {Array} - Array of matches { placement, clientAd }
 */
export const matchAdsToplacements = (placements, clientAds) => {
  const matches = [];
  const usedPlacements = new Set();
  const usedClientAds = new Set();

  // Sort client ads by size (largest first) to prioritize bigger placements
  const sortedClientAds = [...clientAds].sort((a, b) => {
    const sizeA = parseSize(a.size);
    const sizeB = parseSize(b.size);
    if (!sizeA || !sizeB) return 0;
    return (sizeB.width * sizeB.height) - (sizeA.width * sizeA.height);
  });

  // Sort placements by size (largest first) to match bigger ads first
  const sortedPlacements = [...placements].sort((a, b) => {
    return (b.size.width * b.size.height) - (a.size.width * a.size.height);
  });

  // Pass 1: Exact matches
  for (const clientAd of sortedClientAds) {
    if (usedClientAds.has(clientAd.url)) continue;
    const targetSize = parseSize(clientAd.size);
    if (!targetSize) continue;

    for (const placement of sortedPlacements) {
      if (usedPlacements.has(placement.selector)) continue;

      const placementSize = placement.size;
      const isExactMatch =
        placementSize.width === targetSize.width &&
        placementSize.height === targetSize.height;

      if (isExactMatch) {
        matches.push({ placement, clientAd, matchType: 'exact' });
        usedPlacements.add(placement.selector);
        usedClientAds.add(clientAd.url);
        console.log(`Exact match: ${clientAd.size} -> ${placement.sizeString} at ${placement.selector}`);
        break;
      }
    }
  }

  // Pass 2: IAB tolerance matches (within 20px)
  for (const clientAd of sortedClientAds) {
    if (usedClientAds.has(clientAd.url)) continue;
    const targetSize = parseSize(clientAd.size);
    if (!targetSize) continue;

    for (const placement of sortedPlacements) {
      if (usedPlacements.has(placement.selector)) continue;

      const placementSize = placement.size;

      // Check if placement matches an IAB size that equals the client ad size
      const iabMatch = matchIABSize(placementSize.width, placementSize.height, 20);
      if (iabMatch === clientAd.size) {
        matches.push({ placement, clientAd, matchType: 'iab-tolerance' });
        usedPlacements.add(placement.selector);
        usedClientAds.add(clientAd.url);
        console.log(`IAB tolerance match: ${clientAd.size} -> ${placement.sizeString} (${iabMatch}) at ${placement.selector}`);
        break;
      }
    }
  }

  // Pass 3: Flexible tolerance matches (within 15% and similar aspect ratio)
  for (const clientAd of sortedClientAds) {
    if (usedClientAds.has(clientAd.url)) continue;
    const targetSize = parseSize(clientAd.size);
    if (!targetSize) continue;

    for (const placement of sortedPlacements) {
      if (usedPlacements.has(placement.selector)) continue;

      const placementSize = placement.size;

      // Check if sizes are within 15% tolerance AND have similar aspect ratio
      const toleranceMatch = sizesMatchWithTolerance(placementSize, targetSize, 15);
      const ratioMatch = aspectRatiosMatch(placementSize, targetSize, 0.15);

      if (toleranceMatch && ratioMatch) {
        matches.push({ placement, clientAd, matchType: 'flexible-tolerance' });
        usedPlacements.add(placement.selector);
        usedClientAds.add(clientAd.url);
        console.log(`Flexible match: ${clientAd.size} -> ${placement.sizeString} at ${placement.selector}`);
        break;
      }
    }
  }

  // Log unmatched client ads for debugging
  for (const clientAd of sortedClientAds) {
    if (!usedClientAds.has(clientAd.url)) {
      console.log(`No placement found for client ad: ${clientAd.size} (${clientAd.url.substring(0, 50)}...)`);
    }
  }

  // Log unmatched placements for debugging
  for (const placement of sortedPlacements) {
    if (!usedPlacements.has(placement.selector)) {
      console.log(`No client ad matched for placement: ${placement.sizeString} at ${placement.selector}`);
    }
  }

  return matches;
};

/**
 * Match video ads to video placements
 * Video ads can match any video placement regardless of exact size
 * @param {Array} placements - Detected video placements (type === 'video')
 * @param {Array} videoAds - Video ads with { url, type: 'video' } properties
 * @returns {Array} - Array of matches { placement, clientAd }
 */
export const matchVideoAdsToplacements = (placements, videoAds) => {
  const matches = [];
  const usedPlacements = new Set();

  // Filter to only video placements
  const videoPlacements = placements.filter(p => p.type === 'video');

  // Sort video placements by size (largest first)
  const sortedPlacements = [...videoPlacements].sort((a, b) => {
    return (b.size.width * b.size.height) - (a.size.width * a.size.height);
  });

  for (const videoAd of videoAds) {
    // Find a matching video placement
    for (const placement of sortedPlacements) {
      if (usedPlacements.has(placement.selector)) continue;

      // Match if it's a video placement (already filtered) and has 16:9 aspect ratio
      const aspectRatio = matchVideoAspectRatio(placement.size.width, placement.size.height);
      if (aspectRatio === '16:9' || placement.subtype === 'native' || placement.subtype === 'iframe') {
        matches.push({
          placement,
          clientAd: videoAd,
          isVideo: true
        });
        usedPlacements.add(placement.selector);
        break;
      }
    }
  }

  return matches;
};

/**
 * Replace ads on the page with client ad creatives
 * @param {object} page - Puppeteer page object
 * @param {Array} matches - Array of { placement, clientAd, isVideo } matches
 * @returns {Promise<object>} - Results of replacement { successful, failed }
 */
export const replaceAds = async (page, matches) => {
  const results = {
    successful: [],
    failed: []
  };

  for (const match of matches) {
    const { placement, clientAd, isVideo = false } = match;

    try {
      // Use the PLACEMENT size (detected slot size), not the client ad size
      // This ensures the creative fills the actual ad slot on the page
      const placementSize = placement.size;

      const replaced = await page.evaluate((selector, adUrl, targetSize, placementType, isVideoAd, playButtonSvg) => {
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

        // Get the actual current dimensions of the element
        const rect = element.getBoundingClientRect();
        const actualWidth = Math.round(rect.width) || targetSize.width;
        const actualHeight = Math.round(rect.height) || targetSize.height;

        try {
          // Check if URL is an image (including base64 data URLs)
          const isImageUrl = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(adUrl) ||
                             /^data:image\//i.test(adUrl);

          // Handle video ad replacements
          if (isVideoAd || placementType === 'video') {
            // Create container for video thumbnail with play button overlay
            element.innerHTML = '';
            element.style.width = `${actualWidth}px`;
            element.style.height = `${actualHeight}px`;
            element.style.position = 'relative';
            element.style.overflow = 'hidden';
            element.style.backgroundColor = '#000';

            if (isImageUrl) {
              // Use image as video thumbnail
              const img = document.createElement('img');
              img.src = adUrl;
              img.style.width = '100%';
              img.style.height = '100%';
              img.style.objectFit = 'cover';
              element.appendChild(img);
            } else {
              // For non-image URLs, create a dark background with the URL displayed
              const placeholder = document.createElement('div');
              placeholder.style.width = '100%';
              placeholder.style.height = '100%';
              placeholder.style.backgroundColor = '#1a1a1a';
              placeholder.style.backgroundImage = `url(${adUrl})`;
              placeholder.style.backgroundSize = 'cover';
              placeholder.style.backgroundPosition = 'center';
              element.appendChild(placeholder);
            }

            // Add play button overlay
            const playButtonContainer = document.createElement('div');
            playButtonContainer.innerHTML = playButtonSvg;
            playButtonContainer.style.position = 'absolute';
            playButtonContainer.style.top = '0';
            playButtonContainer.style.left = '0';
            playButtonContainer.style.width = '100%';
            playButtonContainer.style.height = '100%';
            playButtonContainer.style.pointerEvents = 'none';
            element.appendChild(playButtonContainer);

            return { success: true, isVideo: true, renderedSize: { width: actualWidth, height: actualHeight } };
          }

          // For ALL ad types (iframe or CSS), if the creative is an image, use img tag
          // This handles DV360 extracted creatives correctly
          if (isImageUrl) {
            element.innerHTML = '';
            element.style.width = `${actualWidth}px`;
            element.style.height = `${actualHeight}px`;
            element.style.overflow = 'hidden';
            element.style.display = 'block';
            element.style.position = 'relative';

            const img = document.createElement('img');
            img.src = adUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'fill'; // Fill the entire container
            img.style.display = 'block';
            element.appendChild(img);

            return { success: true, renderedSize: { width: actualWidth, height: actualHeight } };
          }

          // Handle non-image URLs (iframe sources)
          if (placementType === 'iframe') {
            // Replace iframe src
            if (element.tagName === 'IFRAME') {
              element.src = adUrl;
              element.style.border = 'none';
              element.style.width = `${actualWidth}px`;
              element.style.height = `${actualHeight}px`;
            } else {
              // Find iframe within the element
              const iframe = element.querySelector('iframe');
              if (iframe) {
                iframe.src = adUrl;
                iframe.style.border = 'none';
                iframe.style.width = `${actualWidth}px`;
                iframe.style.height = `${actualHeight}px`;
              } else {
                // Create new iframe
                const newIframe = document.createElement('iframe');
                newIframe.src = adUrl;
                newIframe.style.width = `${actualWidth}px`;
                newIframe.style.height = `${actualHeight}px`;
                newIframe.style.border = 'none';
                newIframe.scrolling = 'no';
                element.innerHTML = '';
                element.appendChild(newIframe);
              }
            }
          } else {
            // CSS-based ad with non-image URL: create iframe
            element.innerHTML = '';
            element.style.width = `${actualWidth}px`;
            element.style.height = `${actualHeight}px`;
            element.style.overflow = 'hidden';

            const iframe = document.createElement('iframe');
            iframe.src = adUrl;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.scrolling = 'no';
            element.appendChild(iframe);
          }

          return { success: true, renderedSize: { width: actualWidth, height: actualHeight } };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }, placement.selector, clientAd.url, placementSize, placement.type, isVideo, PLAY_BUTTON_SVG);

      if (replaced.success) {
        const renderedSize = replaced.renderedSize || placementSize;
        results.successful.push({
          selector: placement.selector,
          originalPlacementSize: placement.sizeString,
          renderedSize: `${renderedSize.width}x${renderedSize.height}`,
          clientAdSize: clientAd.size,
          url: clientAd.url,
          type: isVideo ? 'video' : placement.type,
          isVideo: replaced.isVideo || false
        });
        console.log(`Replaced ad at ${placement.selector}: placement ${placement.sizeString}, rendered ${renderedSize.width}x${renderedSize.height}`);
      } else {
        results.failed.push({
          selector: placement.selector,
          size: clientAd.size || placement.sizeString,
          url: clientAd.url,
          error: replaced.error
        });
        console.log(`Failed to replace ad at ${placement.selector}: ${replaced.error}`);
      }
    } catch (error) {
      results.failed.push({
        selector: placement.selector,
        size: clientAd.size || placement.sizeString,
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
 * @param {Array} clientAds - Client ads with { url, size, type } properties
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

  // Pre-process client ads to handle DV360 preview URLs
  // This extracts creatives from preview pages and converts to local screenshots
  console.log('Pre-processing client ads for DV360 URLs...');
  const processedClientAds = await preprocessClientAds(validClientAds);
  console.log(`Processed ${processedClientAds.length} client ads`);

  // Separate regular ads from video ads
  const regularAds = processedClientAds.filter(ad => ad.type !== 'video');
  const videoAds = processedClientAds.filter(ad => ad.type === 'video');

  // Separate regular placements from video placements
  const regularPlacements = placements.filter(p => p.type !== 'video');
  const videoPlacements = placements.filter(p => p.type === 'video');

  // Match regular ads to placements
  const regularMatches = matchAdsToplacements(regularPlacements, regularAds);
  console.log(`Matched ${regularMatches.length} regular ads to placements`);

  // Match video ads to video placements
  const videoMatches = matchVideoAdsToplacements(videoPlacements, videoAds);
  console.log(`Matched ${videoMatches.length} video ads to video placements`);

  const allMatches = [...regularMatches, ...videoMatches];

  if (allMatches.length === 0) {
    console.log('No matches found between client ads and detected placements');
    return { successful: [], failed: [], matches: [] };
  }

  // Replace ads
  const results = await replaceAds(page, allMatches);

  // Wait for new ads to load
  await waitForAdsToLoad(page);

  return {
    ...results,
    matches: allMatches.map(m => ({
      placement: m.placement.selector,
      clientAd: {
        url: m.clientAd.originalUrl || m.clientAd.url, // Return original URL in metadata
        size: m.clientAd.size,
        type: m.clientAd.type,
        isDV360Extracted: m.clientAd.isDV360Extracted || false
      },
      isVideo: m.isVideo || false
    }))
  };
};

export default {
  parseSize,
  matchAdsToplacements,
  matchVideoAdsToplacements,
  replaceAds,
  waitForAdsToLoad,
  processAdReplacement,
  isDV360PreviewUrl,
  extractDV360Size,
  extractDV360Creative,
  preprocessClientAds
};

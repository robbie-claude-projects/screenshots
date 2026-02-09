// Ad Replacement Module
// Replaces detected ad placements with client ad creatives

import { matchIABSize, matchVideoAspectRatio } from './adDetection.js';

// SVG play button overlay for video ad placements
const PLAY_BUTTON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;opacity:0.9;pointer-events:none;">
  <circle cx="50" cy="50" r="45" fill="rgba(0,0,0,0.6)" stroke="white" stroke-width="3"/>
  <polygon points="40,30 40,70 75,50" fill="white"/>
</svg>
`;

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
      const replaced = await page.evaluate((selector, adUrl, adSize, placementType, isVideoAd, playButtonSvg) => {
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
          // Handle video ad replacements
          if (isVideoAd || placementType === 'video') {
            const rect = element.getBoundingClientRect();
            const width = adSize ? adSize.width : Math.round(rect.width);
            const height = adSize ? adSize.height : Math.round(rect.height);

            // Create container for video thumbnail with play button overlay
            element.innerHTML = '';
            element.style.width = `${width}px`;
            element.style.height = `${height}px`;
            element.style.position = 'relative';
            element.style.overflow = 'hidden';
            element.style.backgroundColor = '#000';

            // Check if URL is an image (thumbnail) or video
            const isImageUrl = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(adUrl);

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

            return { success: true, isVideo: true };
          }

          // Handle regular ad replacements (iframe or CSS)
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
      }, placement.selector, clientAd.url, parseSize(clientAd.size), placement.type, isVideo, PLAY_BUTTON_SVG);

      if (replaced.success) {
        results.successful.push({
          selector: placement.selector,
          size: clientAd.size || placement.sizeString,
          url: clientAd.url,
          type: isVideo ? 'video' : placement.type,
          isVideo: replaced.isVideo || false
        });
        console.log(`Replaced ${isVideo ? 'video ' : ''}ad at ${placement.selector} with ${clientAd.size || 'video'} creative`);
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

  // Separate regular ads from video ads
  const regularAds = validClientAds.filter(ad => ad.type !== 'video');
  const videoAds = validClientAds.filter(ad => ad.type === 'video');

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
      clientAd: { url: m.clientAd.url, size: m.clientAd.size, type: m.clientAd.type },
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
  processAdReplacement
};

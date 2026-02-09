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

// Video player related domains (for iframe video detection)
const VIDEO_PLAYER_DOMAINS = [
  'youtube.com',
  'youtube-nocookie.com',
  'vimeo.com',
  'dailymotion.com',
  'player.vimeo.com',
  'players.brightcove.net',
  'fast.wistia.net',
  'jwplayer.com',
  'video.js',
  'vidyard.com'
];

// Video-related CSS selectors
const VIDEO_SELECTORS = [
  'video',
  '.video-player',
  '.video-container',
  '.video-wrapper',
  '[class*="video-"]',
  '[class*="-video"]',
  '[id*="video"]',
  '.player',
  '.jwplayer',
  '.vjs-tech',
  '.brightcove-player'
];

// Standard video aspect ratios
const VIDEO_ASPECT_RATIOS = {
  '16:9': 16 / 9,    // Standard HD
  '4:3': 4 / 3,      // Classic TV
  '21:9': 21 / 9     // Ultrawide
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
 * Check if a URL is a video player URL
 * @param {string} src - The iframe src URL
 * @returns {boolean} - True if the URL is from a video player
 */
export const isVideoPlayerUrl = (src) => {
  if (!src) return false;
  const lowerSrc = src.toLowerCase();
  return VIDEO_PLAYER_DOMAINS.some(domain => lowerSrc.includes(domain));
};

/**
 * Check if dimensions match a video aspect ratio (with tolerance)
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @param {number} tolerance - Tolerance for aspect ratio matching (default 0.1)
 * @returns {string|null} - Matching aspect ratio name or null
 */
export const matchVideoAspectRatio = (width, height, tolerance = 0.1) => {
  if (!width || !height || height === 0) return null;
  const ratio = width / height;

  for (const [name, targetRatio] of Object.entries(VIDEO_ASPECT_RATIOS)) {
    if (Math.abs(ratio - targetRatio) <= tolerance) {
      return name;
    }
  }
  return null;
};

/**
 * Check if dimensions are 16:9 aspect ratio
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @returns {boolean} - True if dimensions are 16:9
 */
export const isVideoAspectRatio = (width, height) => {
  return matchVideoAspectRatio(width, height) === '16:9';
};

/**
 * Detect video ad placements on a page
 * @param {object} page - Puppeteer page object
 * @returns {Promise<Array>} - Array of detected video placements
 */
export const detectVideoAds = async (page) => {
  const placements = await page.evaluate((videoDomains, videoSelectors) => {
    const results = [];
    const processedElements = new Set();

    // Helper to get unique identifier for deduplication
    const getElementKey = (element) => {
      const rect = element.getBoundingClientRect();
      return `video-${rect.left}-${rect.top}-${rect.width}-${rect.height}`;
    };

    // Helper to generate selector for element
    const generateSelector = (element, index = 0) => {
      if (element.id) {
        return `#${element.id}`;
      }
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          return `.${classes[0]}`;
        }
      }
      return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
    };

    // Detect video iframes (YouTube, Vimeo, etc.)
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe, index) => {
      const src = iframe.src || iframe.getAttribute('data-src') || '';
      const isVideoPlayer = videoDomains.some(domain =>
        src.toLowerCase().includes(domain)
      );

      if (isVideoPlayer) {
        const key = getElementKey(iframe);
        if (processedElements.has(key)) return;

        const rect = iframe.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);

        if (width >= 200 && height >= 100) {
          processedElements.add(key);
          results.push({
            selector: generateSelector(iframe, index),
            size: { width, height },
            sizeString: `${width}x${height}`,
            type: 'video',
            subtype: 'iframe',
            src,
            visible: rect.width > 0 && rect.height > 0
          });
        }
      }
    });

    // Detect native video elements
    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
      const key = getElementKey(video);
      if (processedElements.has(key)) return;

      const rect = video.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      if (width >= 200 && height >= 100) {
        processedElements.add(key);
        results.push({
          selector: generateSelector(video, index),
          size: { width, height },
          sizeString: `${width}x${height}`,
          type: 'video',
          subtype: 'native',
          src: video.src || video.currentSrc || '',
          visible: rect.width > 0 && rect.height > 0
        });
      }
    });

    // Detect video containers using CSS selectors
    videoSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element, index) => {
          // Skip video and iframe tags (already processed)
          if (element.tagName === 'VIDEO' || element.tagName === 'IFRAME') return;

          const key = getElementKey(element);
          if (processedElements.has(key)) return;

          const rect = element.getBoundingClientRect();
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);

          // Check for 16:9 aspect ratio (common video format)
          const aspectRatio = width / height;
          const is16by9 = Math.abs(aspectRatio - (16 / 9)) < 0.1;

          if (width >= 200 && height >= 100 && is16by9) {
            processedElements.add(key);
            results.push({
              selector: generateSelector(element, index),
              size: { width, height },
              sizeString: `${width}x${height}`,
              type: 'video',
              subtype: 'container',
              matchedSelector: selector,
              visible: rect.width > 0 && rect.height > 0
            });
          }
        });
      } catch {
        // Invalid selector, skip
      }
    });

    return results;
  }, VIDEO_PLAYER_DOMAINS, VIDEO_SELECTORS);

  // Add aspect ratio info to placements
  return placements.map(placement => ({
    ...placement,
    aspectRatio: matchVideoAspectRatio(placement.size.width, placement.size.height)
  }));
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

    // Helper to generate a UNIQUE selector for element
    const generateSelector = (element, index = 0) => {
      // Strategy 1: Use ID if available (most reliable)
      if (element.id) {
        return `#${CSS.escape(element.id)}`;
      }

      // Strategy 2: Use data attributes if available
      const dataAttrs = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'))
        .slice(0, 2);
      if (dataAttrs.length > 0) {
        const attrSelector = dataAttrs
          .map(attr => `[${attr.name}="${CSS.escape(attr.value)}"]`)
          .join('');
        const matches = document.querySelectorAll(attrSelector);
        if (matches.length === 1) {
          return attrSelector;
        }
      }

      // Strategy 3: Build a path from parent with ID
      let current = element;
      let path = [];
      while (current && current !== document.body) {
        if (current.id) {
          path.unshift(`#${CSS.escape(current.id)}`);
          break;
        }
        // Get nth-child position
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const idx = siblings.indexOf(current) + 1;
          const tag = current.tagName.toLowerCase();
          path.unshift(`${tag}:nth-child(${idx})`);
        }
        current = current.parentElement;
      }
      if (path.length > 0 && path[0].startsWith('#')) {
        // Found a parent with ID, use that path
        const fullPath = path.join(' > ');
        const matches = document.querySelectorAll(fullPath);
        if (matches.length === 1) {
          return fullPath;
        }
      }

      // Strategy 4: Use class combination with nth-of-type
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c.trim() && !c.includes(':'));
        if (classes.length > 0) {
          const tag = element.tagName.toLowerCase();
          const parent = element.parentElement;
          if (parent) {
            const sameClassSiblings = Array.from(parent.querySelectorAll(`:scope > ${tag}.${CSS.escape(classes[0])}`));
            const idx = sameClassSiblings.indexOf(element) + 1;
            if (idx > 0) {
              const selector = `${tag}.${CSS.escape(classes[0])}:nth-of-type(${idx})`;
              // Verify uniqueness from body
              const fullSelector = parent.id
                ? `#${CSS.escape(parent.id)} > ${selector}`
                : selector;
              return fullSelector;
            }
          }
          return `.${CSS.escape(classes[0])}`;
        }
      }

      // Strategy 5: Fallback to position-based selector
      const rect = element.getBoundingClientRect();
      return `[data-ad-position="${Math.round(rect.left)}-${Math.round(rect.top)}"]`;
    };

    // Helper to mark element with position data for fallback selection
    const markElementPosition = (element) => {
      const rect = element.getBoundingClientRect();
      element.setAttribute('data-ad-position', `${Math.round(rect.left)}-${Math.round(rect.top)}`);
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
          // Expanded limits to accommodate billboard (970x250) and larger formats
          if (width >= 50 && height >= 50 && width <= 1200 && height <= 800) {
            processedElements.add(key);
            // Mark element for position-based fallback selection
            markElementPosition(element);
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
        // Expanded limits to accommodate billboard (970x250) and larger formats
        if (width >= 50 && height >= 50 && width <= 1200 && height <= 800) {
          processedElements.add(key);
          // Mark element for position-based fallback selection
          markElementPosition(element);
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
 * Check if an element is within the viewport bounds
 * @param {object} elementBounds - Object with top, bottom, left, right properties
 * @param {object} viewport - Object with width and height properties
 * @returns {boolean} - True if element is at least partially visible in viewport
 */
const isInViewport = (elementBounds, viewport) => {
  const { top, bottom, left, right } = elementBounds;
  const viewportHeight = viewport.height;
  const viewportWidth = viewport.width;

  // Check if element is at least partially visible in the viewport
  const isVerticallyVisible = top < viewportHeight && bottom > 0;
  const isHorizontallyVisible = left < viewportWidth && right > 0;

  return isVerticallyVisible && isHorizontallyVisible;
};

/**
 * Filter ads to only include those visible in the viewport
 * @param {object} page - Puppeteer page object
 * @param {Array} ads - Array of detected ad placements
 * @param {object} viewport - Viewport dimensions { width, height }
 * @returns {Promise<Array>} - Filtered array of visible ad placements
 */
export const filterAdsByViewport = async (page, ads, viewport) => {
  if (!viewport || !ads.length) return ads;

  const visibleAds = await page.evaluate((adsData, viewportDimensions) => {
    return adsData.filter(ad => {
      try {
        const element = document.querySelector(ad.selector);
        if (!element) return false;

        const rect = element.getBoundingClientRect();

        // Check if element is at least partially visible in the viewport
        const isVerticallyVisible = rect.top < viewportDimensions.height && rect.bottom > 0;
        const isHorizontallyVisible = rect.left < viewportDimensions.width && rect.right > 0;

        // Also verify the element has actual dimensions
        const hasSize = rect.width > 0 && rect.height > 0;

        return isVerticallyVisible && isHorizontallyVisible && hasSize;
      } catch {
        return false;
      }
    });
  }, ads, viewport);

  return visibleAds;
};

/**
 * Detect all ad placements using iframe, CSS, and video methods
 * @param {object} page - Puppeteer page object
 * @param {object} options - Detection options
 * @param {boolean} options.includeVideo - Whether to include video placements (default: true)
 * @param {object} options.viewport - Viewport dimensions to filter visible ads (optional)
 * @param {boolean} options.viewportOnly - Only return ads visible in viewport (default: true)
 * @returns {Promise<Array>} - Combined array of detected ad placements
 */
export const detectAds = async (page, options = {}) => {
  const { includeVideo = true, viewport = null, viewportOnly = true } = options;

  const detectionPromises = [
    detectIframeAds(page),
    detectCSSAds(page)
  ];

  if (includeVideo) {
    detectionPromises.push(detectVideoAds(page));
  }

  const results = await Promise.all(detectionPromises);
  const [iframeAds, cssAds, videoAds = []] = results;

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

  // Add video placements
  videoAds.forEach(ad => {
    const key = `${ad.size.width}-${ad.size.height}-${ad.selector}`;
    if (!existingPositions.has(key)) {
      allAds.push(ad);
      existingPositions.add(key);
    }
  });

  // Filter to viewport-visible ads if requested
  if (viewportOnly && viewport) {
    const visibleAds = await filterAdsByViewport(page, allAds, viewport);
    console.log(`Found ${allAds.length} total ads, ${visibleAds.length} visible in viewport`);
    return visibleAds;
  }

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

/**
 * Get video player domains
 * @returns {Array<string>} - List of video player domains
 */
export const getVideoPlayerDomains = () => [...VIDEO_PLAYER_DOMAINS];

/**
 * Get video selectors
 * @returns {Array<string>} - List of video CSS selectors
 */
export const getVideoSelectors = () => [...VIDEO_SELECTORS];

export default {
  detectAds,
  detectIframeAds,
  detectCSSAds,
  detectVideoAds,
  filterAdsByViewport,
  isAdServerUrl,
  isAdRelatedName,
  isVideoPlayerUrl,
  isVideoAspectRatio,
  matchVideoAspectRatio,
  getIABSizeName,
  matchIABSize,
  getAdServerDomains,
  getIABSizes,
  getAdContainerSelectors,
  getAdPatterns,
  getVideoPlayerDomains,
  getVideoSelectors
};

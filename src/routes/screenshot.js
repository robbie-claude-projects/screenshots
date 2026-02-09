import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { captureScreenshot } from '../services/puppeteerService.js';
import { detectAds } from '../services/adDetection.js';
import { processAdReplacement } from '../services/adReplacement.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

// Ensure screenshots directory exists
const ensureScreenshotsDir = async () => {
  try {
    await fs.access(SCREENSHOTS_DIR);
  } catch {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  }
};

// Validate URL format
const isValidUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Generate timestamp-based filename
const generateFilename = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${timestamp}.png`;
};

// POST /api/screenshot
router.post('/', async (req, res) => {
  const { url, adCreatives = [] } = req.body;

  // Validate URL
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      details: 'Please provide a URL in the request body'
    });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format',
      details: 'URL must be a valid HTTP or HTTPS URL'
    });
  }

  // Validate ad creatives if provided
  const validAdCreatives = adCreatives.filter(ad =>
    ad && ad.url && ad.url.trim() !== '' && ad.size
  );

  try {
    await ensureScreenshotsDir();

    const filename = generateFilename();
    const outputPath = path.join(SCREENSHOTS_DIR, filename);

    console.log(`Capturing screenshot of: ${url}`);
    if (validAdCreatives.length > 0) {
      console.log(`With ${validAdCreatives.length} ad creative(s) to replace`);
    }

    // Ad detection and replacement callback
    let detectedAds = [];
    let replacementResults = null;

    const beforeCapture = async (page) => {
      // Detect ads on page
      detectedAds = await detectAds(page);

      if (detectedAds.length > 0) {
        const iframeCount = detectedAds.filter(ad => ad.type === 'iframe').length;
        const cssCount = detectedAds.filter(ad => ad.type === 'css').length;
        console.log(`Detected ${detectedAds.length} ad placement(s): ${iframeCount} iframe, ${cssCount} CSS`);
        detectedAds.forEach((ad, index) => {
          console.log(`  ${index + 1}. ${ad.sizeString} (${ad.iabSize || 'non-standard'}) - ${ad.type}`);
        });

        // Replace ads if client ads were provided
        if (validAdCreatives.length > 0) {
          console.log('Processing ad replacement...');
          replacementResults = await processAdReplacement(page, detectedAds, validAdCreatives);
          console.log(`Replacement complete: ${replacementResults.successful.length} successful, ${replacementResults.failed.length} failed`);
        }
      } else {
        console.log('No ad placements detected');
      }

      return { detectedAds, replacementResults };
    };

    const result = await captureScreenshot(url, outputPath, { beforeCapture });

    console.log(`Screenshot saved: ${filename}`);

    const response = {
      success: true,
      filename,
      message: 'Screenshot captured successfully',
      detectedAds: result.callbackResult?.detectedAds || []
    };

    // Include replacement results if ads were replaced
    if (result.callbackResult?.replacementResults) {
      response.adReplacement = {
        successful: result.callbackResult.replacementResults.successful.length,
        failed: result.callbackResult.replacementResults.failed.length,
        details: result.callbackResult.replacementResults
      };
    }

    res.json(response);
  } catch (error) {
    console.error(`Screenshot capture failed for ${url}:`, error.message);

    // Determine error type for user-friendly message
    let errorMessage = 'Failed to capture screenshot';
    let details = error.message;

    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      errorMessage = 'Could not resolve URL';
      details = 'The website address could not be found. Please check the URL.';
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      errorMessage = 'Connection refused';
      details = 'The website refused the connection. It may be down or blocking requests.';
    } else if (error.message.includes('Timeout')) {
      errorMessage = 'Page load timeout';
      details = 'The page took too long to load. Try again or check if the website is accessible.';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

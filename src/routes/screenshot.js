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

// Generate unique job ID
const generateJobId = () => {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// POST /api/batch-screenshot
router.post('/batch', async (req, res) => {
  const { urls = [], adCreatives = [] } = req.body;

  // Validate URLs array
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'URLs array is required',
      details: 'Please provide an array of URLs in the request body'
    });
  }

  // Filter and validate URLs
  const validUrls = urls.filter(url => url && typeof url === 'string' && isValidUrl(url.trim()));

  if (validUrls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid URLs provided',
      details: 'All provided URLs are invalid. URLs must be valid HTTP or HTTPS URLs.'
    });
  }

  // Validate ad creatives if provided
  const validAdCreatives = adCreatives.filter(ad =>
    ad && ad.url && ad.url.trim() !== '' && ad.size
  );

  const jobId = generateJobId();
  const results = [];

  console.log(`Starting batch job ${jobId} with ${validUrls.length} URL(s)`);

  try {
    await ensureScreenshotsDir();

    // Process each URL sequentially
    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i].trim();
      const progress = { current: i + 1, total: validUrls.length };

      console.log(`[${jobId}] Processing ${progress.current}/${progress.total}: ${url}`);

      try {
        const filename = `${jobId}-${i + 1}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        const outputPath = path.join(SCREENSHOTS_DIR, filename);

        // Ad detection and replacement callback
        let detectedAds = [];
        let replacementResults = null;

        const beforeCapture = async (page) => {
          detectedAds = await detectAds(page);

          if (detectedAds.length > 0 && validAdCreatives.length > 0) {
            replacementResults = await processAdReplacement(page, detectedAds, validAdCreatives);
          }

          return { detectedAds, replacementResults };
        };

        const result = await captureScreenshot(url, outputPath, { beforeCapture });

        results.push({
          url,
          success: true,
          filename,
          detectedAds: result.callbackResult?.detectedAds?.length || 0,
          adsReplaced: result.callbackResult?.replacementResults?.successful?.length || 0
        });

        console.log(`[${jobId}] Completed ${progress.current}/${progress.total}: ${filename}`);
      } catch (error) {
        console.error(`[${jobId}] Failed ${progress.current}/${progress.total}: ${error.message}`);

        results.push({
          url,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[${jobId}] Batch complete: ${successCount} successful, ${failCount} failed`);

    res.json({
      success: true,
      jobId,
      message: `Batch processing complete: ${successCount} successful, ${failCount} failed`,
      totalUrls: validUrls.length,
      successful: successCount,
      failed: failCount,
      results
    });
  } catch (error) {
    console.error(`[${jobId}] Batch processing error:`, error.message);

    res.status(500).json({
      success: false,
      jobId,
      error: 'Batch processing failed',
      details: error.message,
      results
    });
  }
});

export default router;

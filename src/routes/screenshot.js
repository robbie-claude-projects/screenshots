import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import archiver from 'archiver';
import { captureScreenshot, getViewport, VIEWPORT_PRESETS } from '../services/puppeteerService.js';
import { detectAds } from '../services/adDetection.js';
import { processAdReplacement } from '../services/adReplacement.js';
import { validateUrl, validateUrls, validateAdCreatives, formatError } from '../utils/validation.js';

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

// Generate timestamp-based filename with optional viewport
const generateFilename = (viewportName = 'desktop') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${viewportName}-${timestamp}.png`;
};

// Convert custom selectors to placement format for ad replacement
const customSelectorsToplacements = async (page, selectors) => {
  return page.evaluate((sels) => {
    const placements = [];

    sels.forEach((selector, index) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, elIndex) => {
          const rect = el.getBoundingClientRect();
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);

          if (width > 0 && height > 0) {
            placements.push({
              selector: `${selector}:nth-of-type(${elIndex + 1})`,
              originalSelector: selector,
              width,
              height,
              sizeString: `${width}x${height}`,
              type: 'custom',
              element: el.tagName.toLowerCase(),
              index: placements.length
            });
          }
        });
      } catch (e) {
        console.error(`Invalid selector: ${selector}`, e);
      }
    });

    return placements;
  }, selectors);
};

// POST /api/screenshot
router.post('/', async (req, res) => {
  const { url, adCreatives = [], viewport: viewportName = 'desktop', customSelectors = [] } = req.body;

  // Validate URL using validation utility
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return res.status(400).json({
      success: false,
      error: urlValidation.error,
      details: 'Please provide a valid HTTP or HTTPS URL'
    });
  }

  // Validate viewport
  const validViewportNames = Object.keys(VIEWPORT_PRESETS);
  const normalizedViewport = validViewportNames.includes(viewportName) ? viewportName : 'desktop';
  const viewport = getViewport(normalizedViewport);

  // Validate ad creatives using validation utility
  const adValidation = validateAdCreatives(adCreatives);
  const validAdCreatives = adValidation.valid;

  // Log any invalid ad creatives
  if (adValidation.invalid.length > 0) {
    console.log(`Warning: ${adValidation.invalid.length} invalid ad creative(s) skipped`);
  }

  try {
    await ensureScreenshotsDir();

    const filename = generateFilename(normalizedViewport);
    const outputPath = path.join(SCREENSHOTS_DIR, filename);

    // Parse and validate custom selectors
    const validCustomSelectors = Array.isArray(customSelectors)
      ? customSelectors.filter(s => typeof s === 'string' && s.trim() !== '')
      : [];
    const useCustomSelectors = validCustomSelectors.length > 0;

    console.log(`Capturing screenshot of: ${url} (viewport: ${normalizedViewport})`);
    if (useCustomSelectors) {
      console.log(`Using ${validCustomSelectors.length} custom selector(s)`);
    }
    if (validAdCreatives.length > 0) {
      console.log(`With ${validAdCreatives.length} ad creative(s) to replace`);
    }

    // Ad detection and replacement callback
    let detectedAds = [];
    let replacementResults = null;

    const beforeCapture = async (page) => {
      // Use custom selectors or auto-detect
      if (useCustomSelectors) {
        console.log('Using custom selectors (skipping auto-detection)');
        detectedAds = await customSelectorsToplacements(page, validCustomSelectors);
        console.log(`Found ${detectedAds.length} element(s) matching custom selectors`);
      } else {
        // Detect ads on page
        detectedAds = await detectAds(page);
      }

      if (detectedAds.length > 0) {
        if (!useCustomSelectors) {
          const iframeCount = detectedAds.filter(ad => ad.type === 'iframe').length;
          const cssCount = detectedAds.filter(ad => ad.type === 'css').length;
          console.log(`Detected ${detectedAds.length} ad placement(s): ${iframeCount} iframe, ${cssCount} CSS`);
        }
        detectedAds.forEach((ad, index) => {
          console.log(`  ${index + 1}. ${ad.sizeString} (${ad.iabSize || ad.type}) - ${ad.type}`);
        });

        // Replace ads if client ads were provided
        if (validAdCreatives.length > 0) {
          console.log('Processing ad replacement...');
          replacementResults = await processAdReplacement(page, detectedAds, validAdCreatives);
          console.log(`Replacement complete: ${replacementResults.successful.length} successful, ${replacementResults.failed.length} failed`);
        }
      } else {
        console.log(useCustomSelectors ? 'No elements matched custom selectors' : 'No ad placements detected');
      }

      return { detectedAds, replacementResults };
    };

    const result = await captureScreenshot(url, outputPath, { beforeCapture, viewport });

    console.log(`Screenshot saved: ${filename}`);

    const response = {
      success: true,
      filename,
      message: 'Screenshot captured successfully',
      viewport: normalizedViewport,
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

    // Use formatError utility for user-friendly messages
    const formattedError = formatError(error, 'Screenshot capture');

    res.status(500).json({
      success: false,
      error: formattedError.message,
      details: formattedError.details,
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
  const { urls = [], adCreatives = [], viewport: viewportName = 'desktop', customSelectors = [] } = req.body;

  // Validate URLs array
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'URLs array is required',
      details: 'Please provide an array of URLs in the request body'
    });
  }

  // Use validation utility for URLs
  const urlValidation = validateUrls(urls);
  const validUrls = urlValidation.valid;

  // Log invalid and duplicate URLs
  if (urlValidation.invalid.length > 0) {
    console.log(`Warning: ${urlValidation.invalid.length} invalid URL(s) skipped`);
    urlValidation.invalid.forEach(inv => console.log(`  - Invalid: ${inv.url} (${inv.error})`));
  }
  if (urlValidation.duplicates.length > 0) {
    console.log(`Warning: ${urlValidation.duplicates.length} duplicate URL(s) skipped`);
  }

  if (validUrls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid URLs provided',
      details: 'All provided URLs are invalid. URLs must be valid HTTP or HTTPS URLs.',
      invalidUrls: urlValidation.invalid.map(inv => ({ url: inv.url, error: inv.error }))
    });
  }

  // Validate viewport
  const validViewportNames = Object.keys(VIEWPORT_PRESETS);
  const normalizedViewport = validViewportNames.includes(viewportName) ? viewportName : 'desktop';
  const viewport = getViewport(normalizedViewport);

  // Validate ad creatives using validation utility
  const adValidation = validateAdCreatives(adCreatives);
  const validAdCreatives = adValidation.valid;

  // Log any invalid ad creatives
  if (adValidation.invalid.length > 0) {
    console.log(`Warning: ${adValidation.invalid.length} invalid ad creative(s) skipped`);
  }

  // Parse and validate custom selectors
  const validCustomSelectors = Array.isArray(customSelectors)
    ? customSelectors.filter(s => typeof s === 'string' && s.trim() !== '')
    : [];
  const useCustomSelectors = validCustomSelectors.length > 0;

  const jobId = generateJobId();
  const results = [];

  console.log(`Starting batch job ${jobId} with ${validUrls.length} URL(s) (viewport: ${normalizedViewport})`);
  if (useCustomSelectors) {
    console.log(`Using ${validCustomSelectors.length} custom selector(s)`);
  }

  try {
    await ensureScreenshotsDir();

    // Process each URL sequentially
    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i].trim();
      const progress = { current: i + 1, total: validUrls.length };

      console.log(`[${jobId}] Processing ${progress.current}/${progress.total}: ${url}`);

      try {
        const filename = `${jobId}-${normalizedViewport}-${i + 1}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        const outputPath = path.join(SCREENSHOTS_DIR, filename);

        // Ad detection and replacement callback
        let detectedAds = [];
        let replacementResults = null;

        const beforeCapture = async (page) => {
          // Use custom selectors or auto-detect
          if (useCustomSelectors) {
            detectedAds = await customSelectorsToplacements(page, validCustomSelectors);
          } else {
            detectedAds = await detectAds(page);
          }

          if (detectedAds.length > 0 && validAdCreatives.length > 0) {
            replacementResults = await processAdReplacement(page, detectedAds, validAdCreatives);
          }

          return { detectedAds, replacementResults };
        };

        const result = await captureScreenshot(url, outputPath, { beforeCapture, viewport });

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

    // Generate metadata for the job
    const metadata = {
      jobId,
      timestamp: new Date().toISOString(),
      viewport: normalizedViewport,
      totalUrls: validUrls.length,
      successful: successCount,
      failed: failCount,
      urlsProcessed: validUrls,
      adCreativesUsed: validAdCreatives.map(ad => ({
        url: ad.url,
        size: ad.size,
        type: ad.type || 'display'
      })),
      customSelectors: useCustomSelectors ? validCustomSelectors : null,
      results: results.map(r => ({
        url: r.url,
        success: r.success,
        filename: r.filename || null,
        detectedAds: r.detectedAds || 0,
        adsReplaced: r.adsReplaced || 0,
        error: r.error || null
      }))
    };

    // Save metadata to file
    const metadataPath = path.join(SCREENSHOTS_DIR, `${jobId}-metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`[${jobId}] Metadata saved: ${jobId}-metadata.json`);

    res.json({
      success: true,
      jobId,
      message: `Batch processing complete: ${successCount} successful, ${failCount} failed`,
      viewport: normalizedViewport,
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

// GET /api/screenshot/download/:jobId
router.get('/download/:jobId', async (req, res) => {
  const { jobId } = req.params;

  // Validate job ID format
  if (!jobId || !jobId.startsWith('job-')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid job ID',
      details: 'Job ID must be in the format job-timestamp-randomstring'
    });
  }

  try {
    // Find all screenshots for this job
    const files = await fs.readdir(SCREENSHOTS_DIR);
    const jobFiles = files.filter(file => file.startsWith(jobId) && file.endsWith('.png'));
    const metadataFile = `${jobId}-metadata.json`;
    const hasMetadata = files.includes(metadataFile);

    if (jobFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No screenshots found',
        details: `No screenshots found for job ID: ${jobId}`
      });
    }

    console.log(`Creating ZIP for job ${jobId} with ${jobFiles.length} file(s)${hasMetadata ? ' + metadata' : ''}`);

    // Create ZIP filename
    const zipFilename = `${jobId}-screenshots.zip`;
    const zipPath = path.join(SCREENSHOTS_DIR, zipFilename);

    // Create write stream for ZIP file
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error(`ZIP creation error for ${jobId}:`, err.message);
      throw err;
    });

    // Pipe archive to output file
    archive.pipe(output);

    // Add each screenshot to the archive
    for (const file of jobFiles) {
      const filePath = path.join(SCREENSHOTS_DIR, file);
      archive.file(filePath, { name: file });
    }

    // Add metadata.json if it exists
    if (hasMetadata) {
      const metadataPath = path.join(SCREENSHOTS_DIR, metadataFile);
      archive.file(metadataPath, { name: 'metadata.json' });
    }

    // Wait for archive to finalize
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.finalize();
    });

    console.log(`ZIP created: ${zipFilename} (${archive.pointer()} bytes)`);

    // Send ZIP file for download
    res.download(zipPath, zipFilename, async (err) => {
      if (err) {
        console.error(`Download error for ${jobId}:`, err.message);
      }

      // Clean up: delete ZIP file, screenshots, and metadata after download
      try {
        // Delete ZIP file
        await fs.unlink(zipPath);
        console.log(`Cleaned up ZIP: ${zipFilename}`);

        // Delete individual screenshots
        for (const file of jobFiles) {
          const filePath = path.join(SCREENSHOTS_DIR, file);
          await fs.unlink(filePath);
        }
        console.log(`Cleaned up ${jobFiles.length} screenshot(s) for job ${jobId}`);

        // Delete metadata file if it exists
        if (hasMetadata) {
          const metadataPath = path.join(SCREENSHOTS_DIR, metadataFile);
          await fs.unlink(metadataPath);
          console.log(`Cleaned up metadata for job ${jobId}`);
        }
      } catch (cleanupError) {
        console.error(`Cleanup error for ${jobId}:`, cleanupError.message);
      }
    });
  } catch (error) {
    console.error(`Download failed for ${jobId}:`, error.message);

    res.status(500).json({
      success: false,
      error: 'Failed to create download',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

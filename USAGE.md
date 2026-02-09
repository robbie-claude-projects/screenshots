# Usage Guide

This guide provides detailed examples for using the Ad Placement Visualization Tool.

## Table of Contents

- [Quick Start](#quick-start)
- [Single URL Screenshot](#single-url-screenshot)
- [Batch Processing](#batch-processing)
- [Using Ad Creatives](#using-ad-creatives)
- [Video Ad Support](#video-ad-support)
- [Custom CSS Selectors](#custom-css-selectors)
- [API Examples](#api-examples)
- [Metadata Files](#metadata-files)

## Quick Start

1. Start the server:
   ```bash
   npm start
   ```

2. Open http://localhost:3000 in your browser

3. Enter a website URL in the text area

4. Click "Generate Screenshots"

5. Download the result

## Single URL Screenshot

### Via Web Interface

1. Enter a single URL in the "Target URLs" textarea:
   ```
   https://www.example-news-site.com
   ```

2. Select viewport (Desktop, Laptop, or Mobile)

3. Click "Generate Screenshots"

4. View and download the screenshot

### Via API

```bash
curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example-news-site.com",
    "viewport": "desktop"
  }'
```

Response:
```json
{
  "success": true,
  "filename": "screenshot-desktop-2025-02-09T12-30-45-123Z.png",
  "message": "Screenshot captured successfully",
  "viewport": "desktop",
  "detectedAds": [
    {
      "selector": "iframe[src*='doubleclick']",
      "sizeString": "300x250",
      "type": "iframe",
      "iabSize": "Medium Rectangle"
    }
  ]
}
```

## Batch Processing

### Via Web Interface

1. Enter multiple URLs (one per line):
   ```
   https://www.site1.com
   https://www.site2.com
   https://www.site3.com
   ```

2. Select viewport

3. Optionally add ad creatives

4. Click "Generate Screenshots"

5. View results summary showing:
   - Total URLs processed
   - Successful captures
   - Failed captures
   - Total ads detected/replaced

6. Click "Download All as ZIP" to get all screenshots with metadata

### Via API

```bash
curl -X POST http://localhost:3000/api/screenshot/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://www.site1.com",
      "https://www.site2.com",
      "https://www.site3.com"
    ],
    "viewport": "desktop",
    "adCreatives": [
      { "url": "https://cdn.example.com/ad-300x250.jpg", "size": "300x250" }
    ]
  }'
```

Response:
```json
{
  "success": true,
  "jobId": "job-1707481234567-abc1234",
  "message": "Batch processing complete: 3 successful, 0 failed",
  "viewport": "desktop",
  "totalUrls": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "url": "https://www.site1.com",
      "success": true,
      "filename": "job-1707481234567-abc1234-desktop-1-2025-02-09T12-30-45-123Z.png",
      "detectedAds": 2,
      "adsReplaced": 1
    }
  ]
}
```

## Using Ad Creatives

### Matching Ad Sizes

The tool matches your ad creatives to detected placements by size. For best results:

1. **Prepare ad images** in standard IAB sizes:
   - 300x250 (Medium Rectangle) - Most common
   - 728x90 (Leaderboard)
   - 300x600 (Half Page)

2. **Host images** on a publicly accessible URL

3. **Enter ad details** in the form:
   - Ad Creative URL: `https://cdn.yoursite.com/client-ad-300x250.jpg`
   - Size: Select matching size from dropdown

### Example with Multiple Ad Sizes

```json
{
  "url": "https://www.news-site.com",
  "adCreatives": [
    { "url": "https://cdn.example.com/ad-300x250.jpg", "size": "300x250" },
    { "url": "https://cdn.example.com/ad-728x90.jpg", "size": "728x90" },
    { "url": "https://cdn.example.com/ad-300x600.jpg", "size": "300x600" }
  ]
}
```

The tool will:
1. Detect all ad placements on the page
2. Match each of your ad creatives to compatible placements
3. Replace the original ads with your creatives
4. Capture the screenshot with your ads visible

## Video Ad Support

### Adding Video Ad Thumbnails

For video ad placements (YouTube embeds, video players):

1. Prepare a **thumbnail image** for your video ad

2. Enter the thumbnail URL in the "Video Ad Creatives" section

3. The tool will:
   - Detect video players on the page
   - Replace them with your thumbnail
   - Add a play button overlay for realistic appearance

### API Example

```bash
curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.video-site.com",
    "adCreatives": [
      { "url": "https://cdn.example.com/video-thumb.jpg", "type": "video" }
    ]
  }'
```

## Custom CSS Selectors

### When to Use

Use custom selectors when:
- Auto-detection doesn't find the ad placements
- You want to target specific elements on the page
- The page uses non-standard ad containers

### Via Web Interface

1. Expand "Advanced Options"

2. Check "Use custom CSS selectors"

3. Enter selectors (one per line):
   ```
   #header-ad-slot
   .sidebar .advertisement
   [data-ad-unit="main-content"]
   ```

### Selector Examples

| Selector | Description |
|----------|-------------|
| `#ad-container` | Element with ID "ad-container" |
| `.advertisement` | Elements with class "advertisement" |
| `.sidebar .ad` | Elements with class "ad" inside ".sidebar" |
| `[data-ad-slot]` | Elements with data-ad-slot attribute |
| `iframe[src*="ads"]` | Iframes with "ads" in their src |
| `div[class*="ad-unit"]` | Divs with "ad-unit" in class name |

### API Example with Custom Selectors

```bash
curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.custom-site.com",
    "customSelectors": [
      "#main-ad-slot",
      ".sidebar-advertisement",
      "[data-ad-id]"
    ],
    "adCreatives": [
      { "url": "https://cdn.example.com/ad.jpg", "size": "300x250" }
    ]
  }'
```

## API Examples

### cURL Examples

**Single screenshot with all options:**
```bash
curl -X POST http://localhost:3000/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com",
    "viewport": "laptop",
    "adCreatives": [
      { "url": "https://cdn.example.com/ad.jpg", "size": "300x250" }
    ],
    "customSelectors": [".ad-slot"]
  }'
```

**Download batch as ZIP:**
```bash
curl -O http://localhost:3000/api/screenshot/download/job-1707481234567-abc1234
```

### JavaScript/Fetch Examples

**Single screenshot:**
```javascript
const response = await fetch('/api/screenshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.example.com',
    viewport: 'desktop',
    adCreatives: [
      { url: 'https://cdn.example.com/ad.jpg', size: '300x250' }
    ]
  })
});
const data = await response.json();
console.log(`Screenshot saved: ${data.filename}`);
```

**Batch processing:**
```javascript
const response = await fetch('/api/screenshot/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    urls: [
      'https://site1.com',
      'https://site2.com'
    ],
    viewport: 'desktop',
    adCreatives: [
      { url: 'https://cdn.example.com/ad.jpg', size: '300x250' }
    ]
  })
});
const data = await response.json();
console.log(`Job ID: ${data.jobId}`);
console.log(`Successful: ${data.successful}, Failed: ${data.failed}`);
```

## Metadata Files

### Batch Job Metadata

Each batch job generates a metadata.json file included in the ZIP download:

```json
{
  "jobId": "job-1707481234567-abc1234",
  "timestamp": "2025-02-09T12:30:45.123Z",
  "viewport": "desktop",
  "totalUrls": 3,
  "successful": 3,
  "failed": 0,
  "urlsProcessed": [
    "https://site1.com",
    "https://site2.com",
    "https://site3.com"
  ],
  "adCreativesUsed": [
    { "url": "https://cdn.example.com/ad.jpg", "size": "300x250", "type": "display" }
  ],
  "customSelectors": null,
  "results": [
    {
      "url": "https://site1.com",
      "success": true,
      "filename": "job-...-1-....png",
      "detectedAds": 2,
      "adsReplaced": 1,
      "error": null
    }
  ]
}
```

### Using Metadata for Reports

The metadata can be used to:
- Generate client reports
- Track ad placement statistics
- Audit which ads were replaced
- Debug failed captures

## Tips for Best Results

1. **Use high-quality ad images** - The tool displays ads at their actual size

2. **Match ad sizes exactly** - 300x250 ads won't work in 728x90 slots

3. **Test with a single URL first** - Verify detection before batch processing

4. **Use custom selectors for problematic sites** - If auto-detection fails

5. **Check the metadata** - Review which ads were detected and replaced

6. **Allow sufficient timeout** - Some sites load ads dynamically

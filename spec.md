# Ad Placement Visualization Tool - Project Specification

## Project Overview

A web-based application that automates the creation of mockup screenshots showing client ads placed on specified websites. This tool replaces the manual Photoshop process currently used to create deliverables that demonstrate ad campaign placements.

## Core Problem

Currently, the agency manually uses Photoshop to:
1. Take screenshots of contextually relevant websites
2. Identify ad placements on those pages
3. Manually swap existing ads with client campaign ads
4. Export final images as deliverables to clients

This process is time-consuming, requires design skills, and is difficult to scale across multiple URLs and ad variations.

## Solution

An automated tool that:
- Loads specified URLs in a controlled browser environment
- Detects ad placements on the page (IAB standard sizes)
- Swaps detected ads with client-provided ad creative
- Captures high-quality screenshots
- Exports images ready for client delivery

## Technical Approach

### Architecture
- **Backend**: Node.js with Puppeteer for browser automation and screenshot capture
- **Frontend**: Simple web interface for input configuration and download management
- **Processing**: Headless browser manipulation with DOM injection

### Core Technology Stack
- Puppeteer (headless Chrome) for page loading and manipulation
- Express.js for web server
- DOM manipulation to replace ad content
- Screenshot capture with viewport control

## User Stories & Requirements

### User Story 1: Configure Ad Placement Job
**As a** agency producer
**I want to** specify target URLs and ad creative
**So that** I can generate mockup screenshots efficiently

**Acceptance Criteria:**
- User can input multiple URLs (one per line or comma-separated)
- User can provide ad creative via:
  - Ad server URLs for HTML5/GIF display ads (IAB standard sizes)
  - Ad server URLs for 16:9 video ads
- User can specify which ad creative to use for which URL
- Input validation ensures URLs and ad links are properly formatted

### User Story 2: Automatic Ad Detection
**As a** user
**I want to** automatically detect ad placements on target websites
**So that** I don't need to manually identify where ads appear

**Acceptance Criteria:**
- System detects iframe-based ad placements
- System identifies common IAB standard ad sizes:
  - 300x250 (Medium Rectangle)
  - 728x90 (Leaderboard)
  - 300x600 (Half Page)
  - 320x50 (Mobile Banner)
  - 160x600 (Wide Skyscraper)
  - 970x250 (Billboard)
  - 320x100 (Large Mobile Banner)
- System detects video ad placements (16:9 aspect ratio)
- Fallback: Allow manual specification of CSS selectors for ad containers

### User Story 3: Ad Replacement
**As a** user
**I want to** see client ads seamlessly integrated into target websites
**So that** the mockups look realistic

**Acceptance Criteria:**
- Client ad creative replaces detected ad placements
- Replacement maintains proper dimensions and aspect ratios
- HTML5 ads render correctly in placement
- GIF ads display properly
- Video ads show as static frame or thumbnail (not auto-playing)
- Replacement happens before screenshot capture
- No visible artifacts or loading states in final screenshot

### User Story 4: Screenshot Capture
**As a** user
**I want to** capture high-quality screenshots
**So that** deliverables are professional

**Acceptance Criteria:**
- Screenshots captured at standard desktop resolution (1920x1080 or configurable)
- Full page screenshots available as option
- Screenshots saved in high quality (PNG format)
- Filename includes URL identifier and timestamp
- Option to capture at mobile viewport sizes

### User Story 5: Batch Processing
**As a** user
**I want to** process multiple URLs with multiple ad variations
**So that** I can create complete campaign deliverable sets efficiently

**Acceptance Criteria:**
- Process multiple URLs in sequence
- Apply same ad creative across all URLs
- Or apply different ads to different URLs (via mapping configuration)
- Progress indicator shows processing status
- All screenshots bundled for download

### User Story 6: Export & Download
**As a** user
**I want to** download all generated screenshots
**So that** I can deliver them to clients

**Acceptance Criteria:**
- All screenshots packaged in ZIP file
- Clear naming convention (e.g., `website-domain_ad-name_timestamp.png`)
- Option to preview screenshots before download
- Metadata file included with job details (URLs, ads used, timestamp)

## Detailed Feature Requirements

### 1. Web Interface

**Input Form:**
- Text area for URLs (one per line)
- Ad creative input sections:
  - Display ad URL inputs (with size dropdown: 300x250, 728x90, etc.)
  - Video ad URL inputs
  - Option to add multiple ad variations
- Advanced options (collapsible):
  - Viewport size selection (Desktop 1920x1080, Laptop 1366x768, Mobile 375x667)
  - Full page vs. viewport screenshot
  - Wait time before capture (for page load)
  - Custom CSS selectors for ad placements (manual override)
- Submit button to start processing

**Processing View:**
- Progress bar or loading indicator
- List of URLs showing processing status
- Real-time log output (optional, for debugging)

**Results View:**
- Thumbnail grid of generated screenshots
- Preview modal for full-size viewing
- Download all button (ZIP)
- Download individual screenshots
- Option to restart with modified parameters

### 2. Ad Detection Logic

**Iframe Detection:**
```
- Scan page for <iframe> elements
- Check iframe src for common ad server domains:
  - doubleclick.net
  - googlesyndication.com
  - adnxs.com
  - advertising.com
  - etc.
- Measure iframe dimensions
- Match dimensions to IAB standard sizes
```

**CSS-Based Detection:**
```
- Look for common ad container classes:
  - .ad, .advertisement, .adslot, .ad-container
  - [id*="ad"], [class*="ad"]
- Check container dimensions
- Identify as ad placement if size matches IAB standards
```

**Video Ad Detection:**
```
- Look for video players with 16:9 aspect ratio
- Check for common video ad containers
- Identify video ad iframes
```

### 3. Ad Replacement Logic

**For Display Ads (HTML5/GIF):**
```
1. Identify target placement size (e.g., 300x250)
2. Match to appropriate client ad creative of same size
3. Replace iframe src with client ad server URL
4. OR replace container innerHTML with <img> or <iframe> pointing to client creative
5. Ensure no cross-origin restrictions interfere
6. Wait for ad creative to fully load
```

**For Video Ads:**
```
1. Identify video ad placement
2. Replace with static frame from client video ad
3. Option: Show video player interface with client branding
4. Include play button overlay (non-functional, for visual only)
```

**Handling Edge Cases:**
```
- If no matching size ad creative provided, skip that placement
- If multiple placements of same size exist, use same ad or cycle through variations
- Log any placements that couldn't be replaced
```

### 4. Screenshot Capture

**Configuration:**
- Viewport dimensions (width x height)
- Full page vs. viewport only
- Image format: PNG (high quality)
- Delay before capture (default: 3 seconds after page load + ad replacement)

**Process:**
```
1. Navigate to URL
2. Wait for page load (networkidle2)
3. Execute ad detection logic
4. Inject ad replacement code
5. Wait for ad creative to load
6. Wait additional buffer time (configurable)
7. Capture screenshot
8. Save with descriptive filename
```

### 5. File Naming & Organization

**Naming Convention:**
```
{url-domain}_{ad-size/type}_{timestamp}.png

Examples:
- nytimes-com_300x250_20250205-143022.png
- cnn-com_728x90_20250205-143045.png
- espn-com_video-16-9_20250205-143109.png
```

**Metadata File (metadata.json):**
```json
{
  "job_id": "uuid",
  "timestamp": "2025-02-05T14:30:22Z",
  "urls_processed": [
    {
      "url": "https://www.nytimes.com",
      "placements_detected": 3,
      "placements_replaced": 2,
      "ads_used": ["300x250_campaign-a.html", "728x90_campaign-a.html"],
      "screenshot": "nytimes-com_300x250_20250205-143022.png"
    }
  ],
  "total_screenshots": 5,
  "viewport": "1920x1080"
}
```

## Technical Specifications

### Ad Size Standards (IAB)

**Desktop Display:**
- 300x250 - Medium Rectangle
- 728x90 - Leaderboard
- 300x600 - Half Page
- 160x600 - Wide Skyscraper
- 970x250 - Billboard
- 970x90 - Super Leaderboard

**Mobile Display:**
- 320x50 - Mobile Banner
- 320x100 - Large Mobile Banner
- 300x250 - Medium Rectangle (mobile)

**Video:**
- 16:9 aspect ratio (e.g., 640x360, 1280x720, 1920x1080)

### Browser Automation Details

**Puppeteer Configuration:**
```javascript
{
  headless: true,
  defaultViewport: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2 // for retina/high-DPI
  },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security', // May be needed for ad injection
    '--disable-features=IsolateOrigins,site-per-process'
  ]
}
```

**Wait Conditions:**
- Page load: `waitUntil: 'networkidle2'`
- Ad creative load: `waitForSelector()` or fixed delay
- Minimum wait before screenshot: 3 seconds

### Ad Injection Method

**Option 1: Replace Iframe Source**
```javascript
// Find ad iframe
const adIframe = await page.$('iframe[src*="doubleclick"]');
// Replace with client ad
await page.evaluate((iframe, adUrl) => {
  iframe.src = adUrl;
}, adIframe, clientAdUrl);
```

**Option 2: Replace Container Content**
```javascript
// Find ad container
const adContainer = await page.$('.ad-container');
// Inject client ad
await page.evaluate((container, adHtml) => {
  container.innerHTML = adHtml;
}, adContainer, clientAdHtml);
```

**Option 3: DOM Manipulation**
```javascript
await page.evaluate((selector, adUrl, width, height) => {
  const container = document.querySelector(selector);
  container.innerHTML = `<iframe src="${adUrl}" width="${width}" height="${height}" frameborder="0"></iframe>`;
}, adSelector, clientAdUrl, adWidth, adHeight);
```

## Error Handling

### Common Scenarios:

1. **URL Fails to Load**
   - Retry once after 5 seconds
   - If still fails, log error and continue to next URL
   - Include failed URLs in report

2. **No Ad Placements Detected**
   - Log warning
   - Option: Capture screenshot anyway with notation
   - Report to user

3. **Ad Creative Fails to Load**
   - Log error
   - Continue with screenshot of original page
   - Flag in report

4. **Cross-Origin Restrictions**
   - Attempt alternative injection method
   - If all methods fail, log and report

5. **Timeout Handling**
   - Maximum processing time per URL: 60 seconds
   - If exceeded, save screenshot of current state and continue

## Non-Functional Requirements

### Performance
- Process single URL with ad replacement in < 30 seconds
- Support batch processing of up to 50 URLs
- Generate screenshots at 2x resolution for quality

### Usability
- Simple, intuitive interface requiring no technical knowledge
- Clear error messages and status updates
- Preview capability before final download

### Reliability
- Graceful error handling with informative messages
- Progress saved if process interrupted
- Retry logic for network failures

### Security
- No storage of sensitive client ad creative
- Temporary files cleaned up after job completion
- Input validation to prevent malicious URLs

## Out of Scope (Future Considerations)

- Automated ad placement detection using ML/AI
- Real-time collaboration features
- Cloud storage integration
- Advanced editing (brightness, contrast adjustments)
- A/B testing variations
- Scheduled/automated screenshot capture
- Integration with project management tools
- API for programmatic access

## Success Metrics

- Reduces time to create deliverable from 30 minutes (manual) to < 5 minutes (automated)
- Supports 90%+ of common website layouts
- Produces client-ready screenshots without post-processing
- Handles IAB standard ad sizes correctly 100% of time

## Development Phases

### Phase 1: MVP (Minimum Viable Product)
- Basic web interface for URL and ad input
- Single viewport size (desktop 1920x1080)
- Iframe-based ad detection
- Simple ad replacement for display ads (300x250, 728x90)
- Screenshot capture and download
- Process one URL at a time

### Phase 2: Enhanced Features
- Batch processing (multiple URLs)
- Support for all IAB standard sizes
- Video ad placement support
- Multiple viewport sizes
- Full page screenshot option
- ZIP download for batch results

### Phase 3: Advanced Capabilities
- Custom CSS selector input for manual placement specification
- Preview before download
- Job history/saved configurations
- Enhanced error reporting and logs
- Mobile viewport support

### Phase 4: Polish & Optimization
- Performance optimization for large batches
- Better ad detection algorithms
- UI/UX improvements
- Comprehensive error handling
- Documentation and user guide

## Technical Constraints

- Must run in standard Node.js environment (v18+)
- Should work on MacOS, Linux, and Windows
- Puppeteer requires sufficient system resources (consider Docker for deployment)
- Ad server URLs must be publicly accessible (no authentication)
- Target websites must not block headless browsers (may need user-agent spoofing)

## Deployment Considerations

**Local Development:**
- Run on localhost with simple npm start
- Hot reload for development

**Production Options:**
- Docker container for consistent environment
- Could be deployed to cloud (AWS, GCP, Azure) if scaling needed
- Or remain as local tool run on agency machines

## Open Questions / Decisions Needed

1. **Ad Creative Hosting:** Where are client ad server URLs hosted? Any authentication required?
2. **Ad-to-URL Mapping:** Should there be 1:1 mapping (specific ads to specific URLs) or many-to-many?
3. **Screenshot Quality vs. File Size:** What's the acceptable file size for deliverables?
4. **Anti-Bot Detection:** Some websites block headless browsers - acceptable to spoof user agent?
5. **Video Ad Handling:** Static frame acceptable or need animated preview?
6. **Batch Size Limits:** What's the maximum number of URLs/ads in a typical job?
7. **Delivery Format:** Just ZIP of PNGs, or also need PDF compilation?

## Appendix: Example Workflows

### Workflow 1: Simple Single Campaign
```
Input:
- URLs: nytimes.com, washingtonpost.com, cnn.com
- Ads: 300x250_banner.html (from ad server URL)

Process:
1. Load each URL
2. Detect 300x250 placements
3. Replace with client banner
4. Capture screenshots
5. Download as campaign-screenshots.zip

Output:
- nytimes-com_300x250_20250205-143022.png
- washingtonpost-com_300x250_20250205-143035.png
- cnn-com_300x250_20250205-143048.png
```

### Workflow 2: Multi-Format Campaign
```
Input:
- URLs: espn.com, bleacherreport.com
- Ads: 
  - 728x90_leaderboard.html
  - 300x250_banner.html
  - video_16-9.mp4 (ad server URL)

Process:
1. Load espn.com
2. Detect: 1 leaderboard, 2 medium rectangles, 1 video placement
3. Replace with corresponding client ads
4. Capture screenshot
5. Repeat for bleacherreport.com

Output:
- espn-com_full-page_20250205-143022.png (showing all placements)
- bleacherreport-com_full-page_20250205-143055.png
```

## Glossary

- **IAB**: Interactive Advertising Bureau - industry organization that sets digital advertising standards
- **Ad Server**: Platform that hosts and delivers ad creative (e.g., Google Ad Manager, Flashtalking)
- **Display Ad**: Static or animated image-based advertisement (HTML5, GIF, JPG)
- **Video Ad**: 16:9 video advertisement, typically pre-roll or in-stream
- **Placement**: Location on webpage where ad appears
- **Viewport**: Visible area of web page in browser
- **Headless Browser**: Browser without GUI, controlled programmatically
- **DOM**: Document Object Model - structure of web page elements

---

**Document Version:** 1.0  
**Last Updated:** February 5, 2025  
**Author:** Agency Team  
**Status:** Ready for Development

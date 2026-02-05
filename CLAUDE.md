# Ad Placement Visualization Tool - Claude Code Instructions

## Project Overview

This is a Node.js application that automates the creation of mockup screenshots showing client ads placed on specified websites, replacing the manual Photoshop workflow currently used by the advertising agency.

## Technology Stack

- **Backend**: Node.js (v18+) with Express.js
- **Browser Automation**: Puppeteer (headless Chrome)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Testing**: Jest
- **File Processing**: Archiver (for ZIP creation)

## Key Commands

```bash
# Development
npm start              # Start the server (port 3000)
npm run dev           # Start with hot reload (if configured)

# Testing
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode

# Utilities
npm run clean         # Clean up temporary files and old screenshots
npm run lint          # Run ESLint
```

## Project Structure

```
ad-placement-tool/
├── src/
│   ├── server.js              # Express server setup
│   ├── routes/
│   │   ├── screenshot.js      # Screenshot capture endpoints
│   │   └── download.js        # ZIP download endpoints
│   ├── services/
│   │   ├── adDetection.js     # Ad placement detection logic
│   │   ├── adReplacement.js   # Ad replacement logic
│   │   └── puppeteerService.js # Puppeteer configuration
│   └── utils/
│       ├── validation.js      # Input validation
│       └── fileManager.js     # File operations
├── public/
│   ├── index.html            # Main interface
│   ├── styles.css            # Styling
│   └── app.js                # Frontend JavaScript
├── screenshots/              # Temporary screenshot storage
├── tests/                    # Test files
├── spec.md                   # Full project specification
├── prompt_plan.md           # Sequential implementation prompts
└── CLAUDE.md                # This file
```

## Code Style & Conventions

### JavaScript

- **Use ES6+ features**: async/await, arrow functions, destructuring
- **Modules**: Use ES6 imports/exports (not CommonJS require)
- **Naming**:
  - camelCase for variables and functions
  - PascalCase for classes
  - UPPER_SNAKE_CASE for constants
- **Async**: Always use async/await, never raw Promises
- **Error handling**: Always use try-catch blocks for async operations

### Example Patterns

**Good:**
```javascript
const captureScreenshot = async (url, options) => {
  try {
    const browser = await puppeteer.launch(BROWSER_CONFIG);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    return await page.screenshot({ path: options.outputPath });
  } catch (error) {
    logger.error(`Screenshot failed for ${url}:`, error);
    throw new Error(`Failed to capture screenshot: ${error.message}`);
  }
};
```

**Bad:**
```javascript
function captureScreenshot(url, options, callback) {
  puppeteer.launch(BROWSER_CONFIG).then(browser => {
    browser.newPage().then(page => {
      // Callback hell and no error handling
    });
  });
}
```

### File Operations

- ALWAYS validate URLs before processing
- ALWAYS clean up temporary files after job completion
- Use path.join() for cross-platform path construction
- Store screenshots in `screenshots/` directory with job-based subdirectories

### Puppeteer Best Practices

- **MUST**: Always close browser instances with `await browser.close()`
- **MUST**: Set proper wait conditions before screenshot: `waitUntil: 'networkidle2'`
- **MUST**: Use proper viewport configuration for consistent screenshots
- **RECOMMENDED**: Add 3-second delay after ad replacement before capture
- **SECURITY**: Disable web security only when necessary for ad injection

**Puppeteer Configuration:**
```javascript
const BROWSER_CONFIG = {
  headless: true,
  defaultViewport: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2 // High DPI for quality
  },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security', // Only if needed for ad injection
  ]
};
```

## IAB Standard Ad Sizes

Always reference these standard sizes for ad detection:

```javascript
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
```

## Ad Detection Logic

**Priority Order:**
1. Check iframe src for known ad server domains
2. Check for common ad container classes/IDs
3. Measure dimensions and match to IAB standards
4. Return all detected placements with metadata

**Known Ad Server Domains:**
- doubleclick.net
- googlesyndication.com
- adnxs.com
- advertising.com
- adserver.com
- serving-sys.com

## Error Handling Requirements

**MUST handle these scenarios:**

1. **URL Load Failures**
   - Retry once after 5 seconds
   - Log error and continue to next URL
   - Include failed URLs in report

2. **No Ad Placements Detected**
   - Log warning but continue
   - Capture screenshot anyway
   - Note in metadata that no placements were found

3. **Ad Creative Load Failures**
   - Log error
   - Use original page ad or leave empty
   - Flag in final report

4. **Timeout Handling**
   - Maximum 60 seconds per URL
   - If exceeded, capture current state
   - Move to next URL

**Error Response Format:**
```javascript
{
  success: false,
  error: "User-friendly error message",
  details: "Technical details for debugging",
  timestamp: "2025-02-05T14:30:22Z"
}
```

## Testing Requirements

**Unit Tests Required For:**
- Ad detection logic (both iframe and CSS methods)
- Ad replacement logic
- URL validation
- File operations

**Integration Tests Required For:**
- Full screenshot capture flow
- Batch processing
- ZIP creation and download

**Test Data:**
- Use mock HTML pages for ad detection tests
- Use publicly accessible test URLs for integration tests
- Mock Puppeteer for unit tests to avoid launching actual browsers

## Security Considerations

- **NEVER** store client ad creative permanently
- **ALWAYS** validate and sanitize user inputs (URLs)
- **MUST** clean up temporary files after job completion
- **RECOMMENDED** Add rate limiting to prevent abuse
- **AVOID** executing arbitrary code from user input

## Performance Guidelines

- **Browser Reuse**: Keep single browser instance alive for batch processing
- **Parallel Processing**: Process up to 3 URLs concurrently (configurable)
- **Cleanup**: Remove screenshots older than 24 hours
- **Memory**: Monitor memory usage for large batches
- **Timeout**: 60 seconds maximum per URL

## Logging

Use structured logging with levels:

```javascript
logger.info('Processing URL', { url, jobId, timestamp });
logger.warn('No ad placements detected', { url, jobId });
logger.error('Screenshot capture failed', { url, error: error.message });
```

## Environment Variables

```bash
PORT=3000                    # Server port
NODE_ENV=development        # development | production
SCREENSHOT_DIR=./screenshots # Screenshot storage path
MAX_CONCURRENT=3            # Max parallel processes
TIMEOUT_MS=60000           # Per-URL timeout
CLEANUP_HOURS=24           # Screenshot retention time
```

## Common Pitfalls to Avoid

1. **DON'T** launch new browser for each URL - reuse instances
2. **DON'T** forget to close browser instances - causes memory leaks
3. **DON'T** skip input validation - prevents injection attacks
4. **DON'T** use synchronous file operations - blocks event loop
5. **DON'T** forget error handling in async functions
6. **DON'T** hardcode file paths - use path.join() for cross-platform compatibility

## Browser Anti-Detection

Some websites block headless browsers. If needed:

```javascript
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9'
});
```

## Git Workflow

- Create feature branches: `feature/ad-detection`, `feature/batch-processing`
- Commit after each completed feature
- Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`
- Keep commits focused and atomic

## Documentation

- Update README.md with usage instructions
- Add JSDoc comments for public functions
- Include code examples in documentation
- Document any non-obvious decisions or workarounds

## When to Ask for Clarification

Ask the user if:
- Ad server URLs require authentication
- Specific website layouts are causing issues
- Performance requirements change (batch size, timeout)
- File size vs. quality trade-offs need decisions
- New edge cases are discovered

## Integration Points

This tool is designed to be standalone, but consider future integrations:
- Project management tools (JIRA, Asana)
- Cloud storage (AWS S3, Google Drive)
- Slack/Teams for notifications
- Campaign management platforms

---

**Remember**: This tool replaces manual Photoshop work, so the quality of output screenshots is paramount. Always prioritize realistic-looking ad placements over speed.

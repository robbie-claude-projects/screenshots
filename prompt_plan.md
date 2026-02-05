# Ad Placement Visualization Tool - Prompt Plan

This document provides sequential prompts for implementing the Ad Placement Visualization Tool using Claude Code. Work through each prompt in order, ensuring tests pass and the application builds/runs before moving to the next step.

## Setup Instructions

Before starting, ensure:
1. You have Node.js v18+ installed
2. You have created an empty GitHub repository
3. You have cloned the repository locally
4. You have Claude Code installed and configured

## Prompt Sequence

### ✅ Prompt 1: Project Initialization & Structure
```
Initialize a new Node.js project for the Ad Placement Visualization Tool. 

Set up the basic project structure with:
- Package.json with necessary dependencies (Express, Puppeteer)
- Basic folder structure (src/, public/, tests/)
- .gitignore file
- README.md with project description
- Basic Express server that serves "Hello World" on port 3000

Add a npm start script that runs the server.
Ensure the server starts successfully and responds to HTTP requests.

Commit this as "Initial project setup"
```

### ✅ Prompt 2: Frontend Interface Structure
```
Create a basic web interface for the ad placement tool.

Requirements:
- HTML page with form for URL input (textarea)
- Form section for ad creative inputs (text inputs for ad server URLs)
- Dropdown for ad size selection (300x250, 728x90, 300x600)
- Submit button
- Basic CSS styling (clean, professional look)
- Responsive design that works on desktop

Serve this from the Express server at the root route (/).
Test that the form displays correctly in a browser.

Commit as "Add frontend interface structure"
```

### ✅ Prompt 3: Screenshot Capture (Basic)
```
Implement basic screenshot capture functionality using Puppeteer.

Create a route POST /api/screenshot that:
- Accepts URL in request body
- Uses Puppeteer to load the URL
- Captures a screenshot at 1920x1080 viewport
- Saves screenshot to /screenshots directory with timestamp filename
- Returns success status and filename

Add error handling for:
- Invalid URLs
- Page load failures
- Puppeteer errors

Add a simple test that verifies screenshot capture works.

Commit as "Implement basic screenshot capture"
```

### ✅ Prompt 4: Ad Detection - Iframe Method
```
Implement iframe-based ad detection on loaded pages.

Create a module (src/adDetection.js) that:
- Scans page for all <iframe> elements
- Checks iframe src attributes for common ad server domains:
  - doubleclick.net, googlesyndication.com, adnxs.com, advertising.com
- Measures iframe dimensions
- Returns array of detected ad placements with: selector, size, type

Integrate this into the screenshot route - log detected ads before capture.

Add test cases for ad detection logic.

Commit as "Add iframe-based ad detection"
```

### ✅ Prompt 5: Ad Detection - CSS Method
```
Enhance ad detection with CSS-based detection.

Update src/adDetection.js to also:
- Scan for common ad container classes (.ad, .advertisement, .adslot)
- Scan for elements with id/class containing "ad"
- Check dimensions of these containers
- Match dimensions to IAB standard sizes (300x250, 728x90, 300x600, etc.)
- Return combined results from iframe and CSS detection

Update tests to cover CSS detection scenarios.

Commit as "Add CSS-based ad detection"
```

### ✅ Prompt 6: Ad Replacement Logic
```
Implement ad replacement functionality.

Create a module (src/adReplacement.js) that:
- Takes detected ad placements and client ad URLs as input
- Matches client ads to detected placements by size
- Uses Puppeteer page.evaluate() to replace iframe src OR container innerHTML
- Handles multiple placements of same size
- Logs successful and failed replacements

Update the screenshot route to:
- Accept ad creative URLs in request body
- Detect ads on page
- Replace with client ads
- Wait for ad creative to load (3 second delay)
- Then capture screenshot

Add tests for replacement logic.

Commit as "Implement ad replacement logic"
```

### ✅ Prompt 7: Frontend-Backend Integration
```
Connect the frontend form to the backend API.

Update the frontend to:
- Gather form data (URLs, ad creative URLs, ad sizes)
- Send POST request to /api/screenshot endpoint
- Display loading state while processing
- Show success message with download link when complete
- Display errors if request fails

Update backend to:
- Accept multiple ad creative inputs
- Return screenshot file path in response
- Serve screenshots from /screenshots directory

Test the full flow: submit form → process → download screenshot.

Commit as "Connect frontend to backend API"
```

### ✅ Prompt 8: Batch Processing
```
Implement batch processing for multiple URLs.

Create a new route POST /api/batch-screenshot that:
- Accepts array of URLs and array of ad creatives
- Processes each URL sequentially
- Captures screenshot for each
- Returns array of results (success/failure status and filenames)

Update frontend to:
- Accept multiple URLs (one per line in textarea)
- Show progress indicator (e.g., "Processing 2 of 5...")
- Display list of completed screenshots

Add error handling to continue processing if one URL fails.

Commit as "Add batch processing support"
```

### ✅ Prompt 9: Download & Packaging
```
Implement ZIP download for batch results.

Add dependency: archiver (npm package for ZIP creation)

Create a route GET /api/download/:jobId that:
- Takes job ID parameter
- Finds all screenshots for that job
- Creates ZIP file containing all screenshots
- Returns ZIP file for download
- Cleans up temporary files after download

Update batch processing to:
- Generate unique job ID for each batch
- Save screenshots with job ID reference
- Return job ID to frontend

Update frontend to:
- Receive job ID after processing
- Show "Download All" button that requests ZIP
- Trigger file download

Commit as "Add ZIP download for batch results"
```

### ✅ Prompt 10: Viewport Configuration
```
Add viewport size configuration options.

Update the API to accept viewport parameter:
- Desktop: 1920x1080 (default)
- Laptop: 1366x768
- Mobile: 375x667

Update Puppeteer configuration to use specified viewport.

Add frontend dropdown for viewport selection.

Update screenshots to include viewport size in filename.

Add tests for different viewport sizes.

Commit as "Add viewport configuration"
```

### ✅ Prompt 11: Video Ad Support
```
Add support for video ad placements.

Update ad detection to:
- Identify video player elements (video tags, video iframes)
- Check for 16:9 aspect ratio
- Classify as video ad placement

Update ad replacement to:
- Accept video ad URLs
- For video placements, show static frame or thumbnail
- Add play button overlay (non-functional, visual only)

Update frontend to have separate input section for video ads.

Commit as "Add video ad placement support"
```

### ✅ Prompt 12: Metadata & Reporting
```
Generate metadata file for each job.

Create metadata.json for each batch job containing:
- Job ID and timestamp
- List of URLs processed
- Number of placements detected/replaced per URL
- Ads used for each URL
- Screenshot filenames
- Viewport settings

Include metadata.json in ZIP download.

Add a results summary view on frontend showing:
- Total URLs processed
- Total placements replaced
- List of screenshots with thumbnails

Commit as "Add metadata generation and reporting"
```

### ✅ Prompt 13: Error Handling & Validation
```
Enhance error handling and input validation.

Add validation for:
- URL format (must be valid HTTP/HTTPS)
- Ad creative URLs (must be valid URLs)
- Duplicate URLs
- Empty inputs

Improve error messages to be user-friendly.

Add retry logic:
- Retry failed page loads once after 5 second delay
- Continue batch processing if one URL fails
- Report all errors in final results

Add comprehensive error logging.

Commit as "Enhance error handling and validation"
```

### ✅ Prompt 14: Custom Selectors (Advanced)
```
Add manual CSS selector override option.

Update frontend with "Advanced Options" collapsible section containing:
- Checkbox to enable manual selector mode
- Text input for custom CSS selectors (one per line)

Update backend to:
- Accept custom selectors in request
- Use custom selectors if provided (skip auto-detection)
- Apply ad replacements to specified selectors

Add documentation in UI explaining selector format.

Commit as "Add custom CSS selector support"
```

### ✅ Prompt 15: Testing & Documentation
```
Add comprehensive tests and documentation.

Create tests for:
- Ad detection (iframe and CSS methods)
- Ad replacement logic
- Screenshot capture
- Batch processing
- Error handling scenarios

Update README.md with:
- Installation instructions
- Usage guide with examples
- API documentation
- Troubleshooting section
- Known limitations

Create a USAGE.md file with detailed examples and screenshots.

Ensure all tests pass with npm test.

Commit as "Add tests and documentation"
```

### ✅ Prompt 16: Performance Optimization
```
Optimize performance for batch processing.

Implement:
- Connection reuse for Puppeteer (don't restart browser for each URL)
- Parallel processing option (process 3 URLs concurrently)
- Image optimization (reduce file size without quality loss)
- Cleanup of old screenshots (remove files older than 24 hours)

Add configuration options for:
- Maximum concurrent processes
- Screenshot retention time

Monitor and log processing times.

Commit as "Optimize batch processing performance"
```

### ✅ Prompt 17: Final Polish & Edge Cases
```
Handle edge cases and polish the UI.

Address:
- Websites that block headless browsers (add user-agent spoofing)
- Cross-origin restrictions (handle with appropriate error messages)
- Very slow-loading pages (add configurable timeout)
- Pages with no ad placements (provide helpful message)
- Ad creative that fails to load (log and continue)

UI improvements:
- Loading spinners
- Better progress indicators
- Toast notifications for success/error
- Keyboard shortcuts (Enter to submit)

Commit as "Final polish and edge case handling"
```

### ✅ Prompt 18: Deployment Preparation
```
Prepare the application for deployment.

Create:
- Dockerfile for containerized deployment
- docker-compose.yml for easy local setup
- Environment variable configuration (.env.example)
- Production configuration (ports, paths, etc.)

Add deployment documentation to README.md covering:
- Docker deployment
- Local deployment
- Environment variables
- System requirements

Create a DEPLOYMENT.md with detailed deployment instructions.

Commit as "Add deployment configuration"
```

## Testing Checklist

After completing all prompts, verify:

- [ ] Server starts without errors
- [ ] Frontend loads and displays correctly
- [ ] Single URL screenshot works
- [ ] Ad detection identifies placements correctly
- [ ] Ad replacement shows client ads
- [ ] Batch processing works for multiple URLs
- [ ] ZIP download contains all screenshots
- [ ] Viewport configuration changes screenshot size
- [ ] Video ad placements are handled
- [ ] Error handling works gracefully
- [ ] All tests pass
- [ ] Documentation is complete and accurate

## Notes for Claude Code

**Context Management:**
- After Prompt 8, consider starting a new Claude Code session to avoid context overflow
- Reference spec.md frequently to stay aligned with requirements
- Run tests after each prompt to catch issues early

**Git Workflow:**
- Create feature branch for each prompt (e.g., `git checkout -b feature/ad-detection`)
- Commit after each completed prompt
- Push to GitHub regularly

**Testing:**
- Use Jest or Mocha for unit tests
- Test with real websites (have Claude suggest test URLs)
- Verify screenshots visually, not just programmatically

**Common Issues:**
- Puppeteer may need additional flags for some environments
- Some websites have anti-bot protection
- Large batches may require increased memory

---

**How to Use This File:**

1. Save both spec.md and prompt_plan.md in your repository root
2. Start Claude Code in your project directory
3. Open this file with `@prompt_plan.md`
4. Execute each prompt in sequence
5. Mark prompts as ✅ when completed
6. Commit after each prompt
7. Run `npm test` before moving to next prompt

# Ad Placement Visualization Tool

A Node.js application that automates the creation of mockup screenshots showing client ads placed on specified websites. This tool replaces the manual Photoshop workflow for advertising agencies.

## Features

- **Screenshot Capture**: Capture high-quality screenshots of web pages
- **Ad Detection**: Automatically detect ad placements using iframe and CSS-based detection
- **Ad Replacement**: Replace existing ads with client ad creatives
- **Batch Processing**: Process multiple URLs in a single job
- **ZIP Download**: Download all screenshots as a ZIP with metadata
- **Viewport Configuration**: Support for desktop, laptop, and mobile viewports
- **Video Ad Support**: Handle video ad placements with play button overlay
- **Custom Selectors**: Manual CSS selector override for precise ad targeting

## Prerequisites

- Node.js v18 or higher
- npm
- Chrome/Chromium (automatically installed by Puppeteer)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd ad-placement-tool

# Install dependencies
npm install

# Install Chromium for Puppeteer (if not auto-installed)
npx puppeteer browsers install chrome
```

## Usage

### Starting the Server

```bash
npm start
```

The server will start on port 3000. Open http://localhost:3000 in your browser.

### Basic Workflow

1. Enter the URL(s) of websites where you want to visualize ad placements
2. Upload or enter URLs to your ad creative images
3. Select the appropriate ad sizes (300x250, 728x90, 300x600)
4. Choose a viewport size (desktop, laptop, mobile)
5. Click "Generate Screenshots"
6. Download individual screenshots or all as ZIP

### API Endpoints

#### Single Screenshot
```http
POST /api/screenshot
Content-Type: application/json

{
  "url": "https://example.com",
  "viewport": "desktop",
  "adCreatives": [
    { "url": "https://example.com/ad.jpg", "size": "300x250" }
  ]
}
```

#### Batch Processing
```http
POST /api/screenshot/batch
Content-Type: application/json

{
  "urls": ["https://example.com", "https://test.com"],
  "viewport": "desktop",
  "adCreatives": [
    { "url": "https://example.com/ad.jpg", "size": "300x250" }
  ]
}
```

#### Download ZIP
```http
GET /api/screenshot/download/:jobId
```

### Custom CSS Selectors

For precise ad targeting, use the Advanced Options section:

1. Check "Use custom CSS selectors"
2. Enter CSS selectors (one per line):
   ```
   #sidebar .ad-slot
   .header-banner
   [data-ad-unit='leaderboard']
   ```

## Project Structure

```
ad-placement-tool/
├── src/
│   ├── server.js              # Express server setup
│   ├── routes/
│   │   └── screenshot.js      # Screenshot API endpoints
│   ├── services/
│   │   ├── adDetection.js     # Ad placement detection
│   │   ├── adReplacement.js   # Ad replacement logic
│   │   └── puppeteerService.js # Puppeteer configuration
│   └── utils/
│       └── validation.js      # Input validation utilities
├── public/
│   ├── index.html             # Main interface
│   ├── styles.css             # Styling
│   └── app.js                 # Frontend JavaScript
├── tests/                     # Test files
├── screenshots/               # Temporary screenshot storage
└── package.json
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Supported Ad Sizes (IAB Standards)

| Size | Name |
|------|------|
| 300x250 | Medium Rectangle |
| 728x90 | Leaderboard |
| 300x600 | Half Page |
| 320x50 | Mobile Banner |
| 320x100 | Large Mobile Banner |
| 160x600 | Wide Skyscraper |
| 970x250 | Billboard |
| 970x90 | Super Leaderboard |

## Viewport Presets

| Name | Dimensions |
|------|------------|
| Desktop | 1920x1080 |
| Laptop | 1366x768 |
| Mobile | 375x667 |

## Troubleshooting

### Chrome/Puppeteer Issues

If you see "Could not find Chrome" errors:
```bash
npx puppeteer browsers install chrome
```

### Websites Blocking Screenshots

Some websites block headless browsers. The tool includes user-agent spoofing, but some sites may still block access.

### Timeout Errors

For slow-loading pages, the tool will retry once after 5 seconds. If the page still times out, it will be marked as failed in batch results.

### No Ad Placements Detected

If no ads are detected:
- The page may not have standard ad placements
- Use custom CSS selectors to target specific elements
- Check if the page loads ads dynamically after page load

## Known Limitations

- Some websites with aggressive anti-bot protection may not work
- Video ads display as static thumbnails with a play button overlay
- Maximum 60-second timeout per URL
- Screenshots capture the viewport area only (not full page)

## Technology Stack

- **Backend**: Node.js with Express.js
- **Browser Automation**: Puppeteer (headless Chrome)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Testing**: Jest
- **ZIP Creation**: Archiver

## License

ISC

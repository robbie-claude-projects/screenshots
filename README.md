# Ad Placement Visualization Tool

A Node.js application that automates the creation of mockup screenshots showing client ads placed on specified websites. This tool replaces the manual Photoshop workflow for advertising agencies.

## Features

- Capture screenshots of web pages
- Detect ad placements on pages (iframe and CSS-based detection)
- Replace existing ads with client ad creatives
- Batch processing for multiple URLs
- ZIP download for batch results
- Support for multiple viewport sizes

## Prerequisites

- Node.js v18 or higher
- npm

## Installation

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

The server will start on port 3000. Open http://localhost:3000 in your browser.

## Project Structure

```
ad-placement-tool/
├── src/           # Server-side source code
├── public/        # Frontend assets (HTML, CSS, JS)
├── tests/         # Test files
├── screenshots/   # Temporary screenshot storage
└── package.json
```

## Technology Stack

- **Backend**: Node.js with Express.js
- **Browser Automation**: Puppeteer
- **Frontend**: Vanilla HTML/CSS/JavaScript

## License

ISC

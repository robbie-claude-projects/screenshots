import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import screenshotRouter from './routes/screenshot.js';
import config from './config.js';
import { startAutoCleanup } from './utils/fileManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve screenshots directory
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

// API routes
app.use('/api/screenshot', screenshotRouter);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Max concurrent screenshots: ${config.maxConcurrent}`);

  // Start automatic cleanup
  startAutoCleanup(1); // Run every hour
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;

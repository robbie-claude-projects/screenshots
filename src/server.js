import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import screenshotRouter from './routes/screenshot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve screenshots directory
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

// API routes
app.use('/api/screenshot', screenshotRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;

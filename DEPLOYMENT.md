# Deployment Guide

This guide covers various deployment options for the Ad Placement Visualization Tool.

## Table of Contents

- [Docker Deployment](#docker-deployment)
- [Local Deployment](#local-deployment)
- [Production Configuration](#production-configuration)
- [Environment Variables](#environment-variables)
- [System Requirements](#system-requirements)
- [Troubleshooting](#troubleshooting)

## Docker Deployment

### Prerequisites

- Docker 20.10 or higher
- Docker Compose 2.0 or higher

### Quick Start

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ad-placement-tool
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start with Docker Compose:
   ```bash
   docker-compose up -d
   ```

4. Access the application at http://localhost:3000

### Building the Docker Image

```bash
docker build -t ad-placement-tool .
```

### Running the Container Manually

```bash
docker run -d \
  --name ad-placement-tool \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MAX_CONCURRENT=3 \
  --cap-add=SYS_ADMIN \
  ad-placement-tool
```

### Stopping the Service

```bash
docker-compose down
```

### Viewing Logs

```bash
docker-compose logs -f ad-placement-tool
```

## Local Deployment

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Chrome/Chromium browser

### Installation

1. Clone and install:
   ```bash
   git clone <repository-url>
   cd ad-placement-tool
   npm install
   ```

2. Install Chromium for Puppeteer:
   ```bash
   npx puppeteer browsers install chrome
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env as needed
   ```

4. Start the server:
   ```bash
   npm start
   ```

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

## Production Configuration

### Recommended Settings

```env
NODE_ENV=production
PORT=3000
MAX_CONCURRENT=3
TIMEOUT_MS=60000
CLEANUP_HOURS=24
ENABLE_AUTO_CLEANUP=true
```

### Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeout for long-running screenshot operations
        proxy_connect_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

### HTTPS with Let's Encrypt

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # ... rest of configuration
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `MAX_CONCURRENT` | Max parallel screenshots | `3` |
| `TIMEOUT_MS` | Page load timeout (ms) | `60000` |
| `CLEANUP_HOURS` | Delete screenshots older than | `24` |
| `ENABLE_AUTO_CLEANUP` | Enable automatic cleanup | `true` |
| `IMAGE_QUALITY` | JPEG quality (0-100) | `90` |
| `MAX_RETRIES` | Retry failed loads | `1` |
| `RETRY_DELAY_MS` | Delay between retries (ms) | `5000` |

## System Requirements

### Minimum

- 1 CPU core
- 1 GB RAM
- 5 GB disk space

### Recommended

- 2+ CPU cores
- 2 GB RAM
- 10 GB disk space

### For High Volume

- 4+ CPU cores
- 4 GB RAM
- 50 GB disk space
- SSD storage

## Troubleshooting

### Chrome/Puppeteer Issues

**Error: "Could not find Chrome"**

```bash
# Reinstall Chromium
npx puppeteer browsers install chrome

# Or set custom path
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

**Error: "Failed to launch Chrome" in Docker**

Ensure the container has the `SYS_ADMIN` capability:
```yaml
cap_add:
  - SYS_ADMIN
```

### Memory Issues

If running out of memory:

1. Reduce `MAX_CONCURRENT` setting
2. Increase container memory limit
3. Enable swap if needed

### Permission Issues

```bash
# Fix screenshot directory permissions
mkdir -p screenshots
chmod 755 screenshots
```

### Network Issues

If pages fail to load:

1. Check internet connectivity
2. Verify DNS resolution
3. Check for firewall rules blocking outbound traffic

### Performance Issues

1. Monitor with `docker stats`
2. Check disk I/O
3. Review `CLEANUP_HOURS` setting
4. Consider SSD storage

## Monitoring

### Health Check

```bash
curl http://localhost:3000
```

### Container Status

```bash
docker-compose ps
docker stats ad-placement-tool
```

### Application Logs

```bash
# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

## Backup and Restore

### Backup Screenshots

```bash
# Create backup
docker cp ad-placement-tool:/app/screenshots ./screenshots-backup

# Or with docker-compose
docker-compose exec ad-placement-tool tar czf - /app/screenshots > backup.tar.gz
```

### Restore Screenshots

```bash
# Restore from backup
docker cp ./screenshots-backup/. ad-placement-tool:/app/screenshots/
```

## Scaling

For high-volume deployments, consider:

1. **Load Balancing**: Deploy multiple instances behind a load balancer
2. **Shared Storage**: Use NFS or cloud storage for screenshots
3. **Queue System**: Add Redis/RabbitMQ for job queuing
4. **CDN**: Serve screenshots via CDN for faster delivery

## Security Recommendations

1. Run container as non-root user (already configured)
2. Use HTTPS in production
3. Implement rate limiting
4. Restrict network access if not public-facing
5. Regular security updates
6. Monitor for suspicious activity

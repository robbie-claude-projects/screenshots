// Ad Placement Visualization Tool - Frontend JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('screenshot-form');
  const resultsSection = document.getElementById('results');
  const resultsContent = document.getElementById('results-content');
  const submitBtn = form.querySelector('.submit-btn');
  const manualSelectorsCheckbox = document.getElementById('manual-selectors');
  const customSelectorsGroup = document.getElementById('custom-selectors-group');

  // Toggle custom selectors visibility
  manualSelectorsCheckbox.addEventListener('change', () => {
    if (manualSelectorsCheckbox.checked) {
      customSelectorsGroup.classList.remove('hidden');
    } else {
      customSelectorsGroup.classList.add('hidden');
    }
  });

  // Show loading state for single URL
  const showLoading = (message = 'Capturing screenshot and detecting ads...') => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  };

  // Show batch progress
  const showBatchProgress = (current, total) => {
    resultsContent.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Processing ${current} of ${total} URLs...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(current / total) * 100}%"></div>
        </div>
      </div>
    `;
  };

  // Reset button state
  const resetButton = () => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate Screenshots';
  };

  // Show error message
  const showError = (error, details) => {
    resultsContent.innerHTML = `
      <div class="error-message">
        <h3>Error</h3>
        <p><strong>${error}</strong></p>
        <p>${details || ''}</p>
      </div>
    `;
  };

  // Show success message with single screenshot
  const showSuccess = (data) => {
    let html = `
      <div class="success-message">
        <h3>Screenshot Captured Successfully</h3>
        <div class="screenshot-result">
          <a href="/screenshots/${data.filename}" target="_blank" class="screenshot-link">
            <img src="/screenshots/${data.filename}" alt="Screenshot" class="screenshot-preview">
          </a>
          <div class="screenshot-actions">
            <a href="/screenshots/${data.filename}" download class="download-btn">Download Screenshot</a>
          </div>
        </div>
    `;

    // Show detected ads info
    if (data.detectedAds && data.detectedAds.length > 0) {
      html += `
        <div class="detected-ads">
          <h4>Detected Ad Placements (${data.detectedAds.length})</h4>
          <ul>
            ${data.detectedAds.map(ad => `
              <li>${ad.sizeString} (${ad.iabSize || 'non-standard'}) - ${ad.type}</li>
            `).join('')}
          </ul>
        </div>
      `;
    } else {
      html += `<p class="no-ads">No ad placements detected on this page.</p>`;
    }

    // Show replacement results if ads were replaced
    if (data.adReplacement) {
      html += `
        <div class="replacement-results">
          <h4>Ad Replacement Results</h4>
          <p>Successful: ${data.adReplacement.successful} | Failed: ${data.adReplacement.failed}</p>
        </div>
      `;
    }

    html += '</div>';
    resultsContent.innerHTML = html;
  };

  // Download all screenshots as ZIP - exposed to window for onclick
  window.downloadAllAsZip = async (jobId) => {
    const downloadBtn = document.getElementById('download-all-btn');
    const originalText = downloadBtn.textContent;

    try {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Preparing ZIP...';

      // Trigger download via hidden link
      const link = document.createElement('a');
      link.href = `/api/screenshot/download/${jobId}`;
      link.download = `${jobId}-screenshots.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Note: The download might take a moment, reset button after short delay
      setTimeout(() => {
        downloadBtn.disabled = false;
        downloadBtn.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error('Download failed:', error);
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download Failed - Try Again';
    }
  };

  // Show batch results
  const showBatchResults = (data) => {
    // Store jobId for download function
    window.currentJobId = data.jobId;

    // Calculate totals
    const totalAdsDetected = data.results.reduce((sum, r) => sum + (r.detectedAds || 0), 0);
    const totalAdsReplaced = data.results.reduce((sum, r) => sum + (r.adsReplaced || 0), 0);

    let html = `
      <div class="success-message">
        <h3>Batch Processing Complete</h3>
        <div class="batch-summary">
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">${data.totalUrls}</span>
              <span class="stat-label">URLs Processed</span>
            </div>
            <div class="stat-item success-stat">
              <span class="stat-value">${data.successful}</span>
              <span class="stat-label">Successful</span>
            </div>
            <div class="stat-item ${data.failed > 0 ? 'failed-stat' : ''}">
              <span class="stat-value">${data.failed}</span>
              <span class="stat-label">Failed</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${totalAdsDetected}</span>
              <span class="stat-label">Ads Detected</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${totalAdsReplaced}</span>
              <span class="stat-label">Ads Replaced</span>
            </div>
          </div>
          <p class="job-id-info"><strong>Job ID:</strong> ${data.jobId}</p>
          ${data.viewport ? `<p class="viewport-info"><strong>Viewport:</strong> ${data.viewport}</p>` : ''}
        </div>
        ${data.successful > 0 ? `
        <div class="download-all-section">
          <button id="download-all-btn" class="download-all-btn" onclick="window.downloadAllAsZip('${data.jobId}')">
            Download All as ZIP (includes metadata)
          </button>
        </div>
        ` : ''}
        <div class="batch-results">
          <h4>Screenshots</h4>
          <div class="results-list">
    `;

    data.results.forEach((result, index) => {
      if (result.success) {
        html += `
          <div class="result-item success">
            <div class="result-header">
              <span class="result-number">${index + 1}</span>
              <span class="result-status">Success</span>
            </div>
            <p class="result-url">${result.url}</p>
            <div class="result-preview">
              <a href="/screenshots/${result.filename}" target="_blank">
                <img src="/screenshots/${result.filename}" alt="Screenshot ${index + 1}" class="batch-preview">
              </a>
            </div>
            <div class="result-details">
              <span>Ads detected: ${result.detectedAds}</span>
              <span>Ads replaced: ${result.adsReplaced}</span>
            </div>
            <a href="/screenshots/${result.filename}" download class="download-btn small">Download</a>
          </div>
        `;
      } else {
        html += `
          <div class="result-item failed">
            <div class="result-header">
              <span class="result-number">${index + 1}</span>
              <span class="result-status">Failed</span>
            </div>
            <p class="result-url">${result.url}</p>
            <p class="result-error">${result.error}</p>
          </div>
        `;
      }
    });

    html += `
          </div>
        </div>
      </div>
    `;

    resultsContent.innerHTML = html;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      // Get form data
      const formData = new FormData(form);
      const urlsText = formData.get('urls');
      const viewport = formData.get('viewport') || 'desktop';
      const adCreativeUrls = formData.getAll('adCreatives[]');
      const adSizes = formData.getAll('adSizes[]');
      const videoAdUrls = formData.getAll('videoAds[]');
      const useCustomSelectors = formData.get('useCustomSelectors') === 'on';
      const customSelectorsText = formData.get('customSelectors') || '';

      // Parse custom selectors if enabled
      const customSelectors = useCustomSelectors
        ? customSelectorsText.split('\n').map(s => s.trim()).filter(s => s !== '')
        : [];

      // Parse URLs
      const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u !== '');

      if (urls.length === 0) {
        showError('No URLs provided', 'Please enter at least one URL to capture.');
        return;
      }

      // Build regular ad creatives array
      const regularAdCreatives = adCreativeUrls
        .map((url, index) => ({
          url: url.trim(),
          size: adSizes[index],
          type: 'display'
        }))
        .filter(ad => ad.url !== '');

      // Build video ad creatives array
      const videoAdCreatives = videoAdUrls
        .map(url => ({
          url: url.trim(),
          type: 'video'
        }))
        .filter(ad => ad.url !== '');

      // Combine all ad creatives
      const adCreatives = [...regularAdCreatives, ...videoAdCreatives];

      // Determine if batch or single processing
      if (urls.length === 1) {
        // Single URL processing
        showLoading();

        const response = await fetch('/api/screenshot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: urls[0],
            viewport,
            adCreatives,
            customSelectors: customSelectors.length > 0 ? customSelectors : undefined
          })
        });

        const data = await response.json();

        if (data.success) {
          showSuccess(data);
        } else {
          showError(data.error, data.details);
        }
      } else {
        // Batch processing
        showLoading(`Processing ${urls.length} URLs...`);

        const response = await fetch('/api/screenshot/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            urls,
            viewport,
            adCreatives,
            customSelectors: customSelectors.length > 0 ? customSelectors : undefined
          })
        });

        const data = await response.json();

        if (data.success) {
          showBatchResults(data);
        } else {
          showError(data.error, data.details);
        }
      }
    } catch (error) {
      console.error('Request failed:', error);
      showError('Request Failed', 'Could not connect to the server. Please try again.');
    } finally {
      resetButton();
    }
  });
});

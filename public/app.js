// Ad Placement Visualization Tool - Frontend JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('screenshot-form');
  const resultsSection = document.getElementById('results');
  const resultsContent = document.getElementById('results-content');
  const submitBtn = form.querySelector('.submit-btn');

  // Show loading state
  const showLoading = () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Capturing screenshot and detecting ads...</p>
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

  // Show success message with screenshot
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    try {
      // Get form data
      const formData = new FormData(form);
      const urlsText = formData.get('urls');
      const adCreativeUrls = formData.getAll('adCreatives[]');
      const adSizes = formData.getAll('adSizes[]');

      // Parse URLs (first URL for single screenshot)
      const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u !== '');

      if (urls.length === 0) {
        showError('No URLs provided', 'Please enter at least one URL to capture.');
        resetButton();
        return;
      }

      // Build ad creatives array
      const adCreatives = adCreativeUrls
        .map((url, index) => ({
          url: url.trim(),
          size: adSizes[index]
        }))
        .filter(ad => ad.url !== '');

      // Make API request (single URL for now)
      const response = await fetch('/api/screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: urls[0],
          adCreatives
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data);
      } else {
        showError(data.error, data.details);
      }
    } catch (error) {
      console.error('Request failed:', error);
      showError('Request Failed', 'Could not connect to the server. Please try again.');
    } finally {
      resetButton();
    }
  });
});

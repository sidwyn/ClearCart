// Content script for Amazon search pages
(function() {
  'use strict';

  // Remove sponsored content immediately
  function removeSponsoredContent() {
    // Remove sponsored search results
    const sponsoredResults = document.querySelectorAll('[data-component-type="s-search-result"][data-sponsoring]');
    sponsoredResults.forEach(result => {
      result.style.display = 'none';
    });

    // Remove other sponsored elements
    const sponsoredElements = document.querySelectorAll(
      '.s-sponsored-info-icon, .puis-sponsored-label-text, .AdHolder, [data-cy="sponsored-label"]'
    );
    sponsoredElements.forEach(element => {
      element.style.display = 'none';
    });
  }

  // Get product URLs from search results
  function getProductUrls() {
    const productLinks = [];
    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    
    searchResults.forEach(result => {
      // Skip sponsored results
      if (result.hasAttribute('data-sponsoring')) {
        return;
      }

      const titleLink = result.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
      if (titleLink) {
        const url = new URL(titleLink.href, window.location.origin);
        // Clean URL to just include the product ID
        const productId = url.pathname.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/);
        if (productId) {
          const cleanUrl = `${url.origin}/dp/${productId[2]}`;
          productLinks.push(cleanUrl);
        }
      }
    });

    return [...new Set(productLinks)]; // Remove duplicates
  }

  // Add trust score indicators to product links
  function addTrustScoreIndicators() {
    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    searchResults.forEach(result => {
      // Skip sponsored results
      if (result.hasAttribute('data-sponsoring')) {
        return;
      }
      
      const titleLink = result.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
      if (titleLink && !result.querySelector('.trust-score-product-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'trust-score-product-indicator';
        indicator.textContent = 'TS';
        indicator.title = 'Trust Score Available - Click to analyze';
        
        // Find the title container and add indicator there
        const titleContainer = result.querySelector('[data-cy="title-recipe"], h2, .s-size-mini');
        if (titleContainer) {
          titleContainer.appendChild(indicator);
        }
      }
    });
  }

  // Analyze products in background without opening tabs
  function analyzeProducts() {
    const productUrls = getProductUrls();
    console.log(`Found ${productUrls.length} products to analyze`);

    if (productUrls.length === 0) {
      updateAnalyzeButtonText('No products found');
      return;
    }

    // Update button to show progress
    updateAnalyzeButtonText(`Analyzing ${Math.min(productUrls.length, 5)} products...`);
    
    // Limit to first 5 products to avoid overwhelming
    const urlsToAnalyze = productUrls.slice(0, 5);
    
    // Send message to background script for analysis
    chrome.runtime.sendMessage({
      action: 'analyzeProducts',
      urls: urlsToAnalyze
    });
    
    // Reset button after a delay
    setTimeout(() => {
      updateAnalyzeButtonText('Analyze Trust Scores');
    }, 10000);
  }

  // Initialize
  function initialize() {
    // Remove sponsored content immediately and on DOM changes
    removeSponsoredContent();
    
    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      removeSponsoredContent();
      addTrustScoreIndicators();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Add trust score indicators
    addTrustScoreIndicators();

    // Add analyze button
    addAnalyzeButton();
  }

  // Add analyze button to the page
  function addAnalyzeButton() {
    if (document.querySelector('.trust-score-analyze-button')) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'trust-score-analyze-button';
    button.textContent = 'Analyze Trust Scores';
    button.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      background: #ff9900;
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    button.addEventListener('click', analyzeProducts);
    document.body.appendChild(button);
  }

  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateTrustScore') {
      // Update trust score indicator for specific product
      updateProductTrustScore(request.productUrl, request.trustScore);
    } else if (request.action === 'parseProductHTML') {
      // Parse HTML for background script (since DOMParser isn't available there)
      try {
        const productData = parseProductHTML(request.html, request.productUrl);
        sendResponse({ success: true, data: productData });
      } catch (error) {
        console.error('Error parsing HTML:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep message channel open for async response
    }
  });

  function updateProductTrustScore(productUrl, trustScore) {
    const productId = productUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!productId) return;

    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    searchResults.forEach(result => {
      const productLink = result.querySelector(`a[href*="${productId}"]`);
      if (productLink) {
        const indicator = result.querySelector('.trust-score-product-indicator');
        if (indicator) {
          indicator.textContent = trustScore.toString();
          indicator.className = `trust-score-product-indicator ${getTrustScoreClass(trustScore)}`;
        }
      }
    });
  }

  function getTrustScoreClass(score) {
    if (score >= 80) return 'trust-score-high';
    if (score >= 60) return 'trust-score-medium';
    return 'trust-score-low';
  }

  function updateAnalyzeButtonText(text) {
    const button = document.querySelector('.trust-score-analyze-button');
    if (button) {
      button.textContent = text;
    }
  }

  // Parse product HTML to extract review data (for background script)
  function parseProductHTML(html, productUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const data = {
      productUrl: productUrl,
      productTitle: '',
      totalReviews: 0,
      averageRating: 0,
      verifiedPercentage: 0,
      ratingDistribution: {},
      reviews: [],
      reviewTimestamps: []
    };

    try {
      // Get product title
      const titleElement = doc.querySelector('#productTitle');
      data.productTitle = titleElement ? titleElement.textContent.trim() : '';

      // Get average rating
      const ratingElement = doc.querySelector('[data-hook="average-star-rating"] .a-offscreen, .a-icon-alt');
      if (ratingElement) {
        const ratingText = ratingElement.textContent;
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        data.averageRating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
      }

      // Get total review count
      const reviewCountElement = doc.querySelector('[data-hook="total-review-count"]');
      if (reviewCountElement) {
        const countText = reviewCountElement.textContent.replace(/,/g, '');
        const countMatch = countText.match(/(\d+)/);
        data.totalReviews = countMatch ? parseInt(countMatch[1]) : 0;
      }

      // Get rating distribution
      const histogramElements = doc.querySelectorAll('[data-hook="histogram-count"]');
      histogramElements.forEach((element, index) => {
        const percentage = parseFloat(element.textContent.replace('%', ''));
        data.ratingDistribution[5 - index] = percentage;
      });

      // Get sample reviews from the page
      const reviewElements = doc.querySelectorAll('[data-hook="review"]');
      reviewElements.forEach(reviewEl => {
        try {
          const review = {
            text: '',
            rating: 0,
            isVerified: false,
            date: '',
            helpful: 0
          };

          // Get review text
          const textElement = reviewEl.querySelector('[data-hook="review-body"] span');
          review.text = textElement ? textElement.textContent.trim() : '';

          // Get rating
          const ratingElement = reviewEl.querySelector('[data-hook="review-star-rating"] .a-offscreen');
          if (ratingElement) {
            const ratingMatch = ratingElement.textContent.match(/(\d+)/);
            review.rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;
          }

          // Check if verified purchase
          review.isVerified = !!reviewEl.querySelector('[data-hook="avp-badge"]');

          // Get review date
          const dateElement = reviewEl.querySelector('[data-hook="review-date"]');
          if (dateElement) {
            review.date = dateElement.textContent.trim();
            data.reviewTimestamps.push(review.date);
          }

          if (review.text && review.text.length > 10) {
            data.reviews.push(review);
          }
        } catch (error) {
          console.error('Error parsing review:', error);
        }
      });

      // Calculate verified percentage
      const verifiedCount = data.reviews.filter(r => r.isVerified).length;
      data.verifiedPercentage = data.reviews.length > 0 ? (verifiedCount / data.reviews.length) * 100 : 0;

    } catch (error) {
      console.error('Error parsing product HTML:', error);
    }

    return data;
  }

})();
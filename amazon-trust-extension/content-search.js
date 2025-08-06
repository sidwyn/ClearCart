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

  // Open product pages in background tabs for analysis
  function analyzeProducts() {
    const productUrls = getProductUrls();
    console.log(`Found ${productUrls.length} products to analyze`);

    // Limit to first 10 products to avoid overwhelming
    const urlsToAnalyze = productUrls.slice(0, 10);
    
    // Send message to background script to open tabs
    chrome.runtime.sendMessage({
      action: 'analyzeProducts',
      urls: urlsToAnalyze
    });
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

})();
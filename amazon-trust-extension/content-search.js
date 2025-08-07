// Content script for Amazon search pages
(function() {
  'use strict';

  console.log('Amazon Trust Score extension loaded on:', window.location.href);

  // Track analyzed products to avoid duplicate analysis
  const analyzedProducts = new Set();
  const analysisQueue = new Set();
  let totalProductsToAnalyze = 0;
  let analysisInProgress = false;

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
    
    console.log(`Found ${searchResults.length} search results`);
    
    searchResults.forEach((result, index) => {
      // Skip sponsored results
      if (result.hasAttribute('data-sponsoring')) {
        console.log(`Skipping sponsored result ${index}`);
        return;
      }

      const titleLink = result.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
      console.log(`Result ${index} titleLink:`, titleLink?.href);
      
      if (titleLink) {
        try {
          const url = new URL(titleLink.href, window.location.origin);
          // Clean URL to just include the product ID
          const productId = url.pathname.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/);
          if (productId) {
            const cleanUrl = `${url.origin}/dp/${productId[2]}`;
            productLinks.push(cleanUrl);
            console.log(`Added product ${index}:`, cleanUrl);
          } else {
            console.log(`No product ID found in ${index}:`, url.pathname);
          }
        } catch (error) {
          console.error(`Error parsing URL for result ${index}:`, error);
        }
      }
    });

    console.log(`Total product URLs found:`, productLinks.length);
    return [...new Set(productLinks)]; // Remove duplicates
  }

  // Add trust score indicators to visible product links
  function addTrustScoreIndicators() {
    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    searchResults.forEach(result => {
      // Skip sponsored results
      if (result.hasAttribute('data-sponsoring')) {
        return;
      }
      
      // Only add indicators to visible results
      if (!isElementVisible(result)) {
        return;
      }
      
      const titleLink = result.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
      if (titleLink && !result.querySelector('.trust-score-product-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'trust-score-product-indicator loading';
        indicator.textContent = 'TS';
        indicator.setAttribute('data-loading', 'true');
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'trust-score-tooltip';
        tooltip.textContent = 'Click to see analysis details...';
        indicator.appendChild(tooltip);
        
        // Make indicator clickable
        indicator.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const breakdown = indicator.getAttribute('data-breakdown');
          if (breakdown) {
            showTrustScoreModal(JSON.parse(breakdown));
          }
        });
        
        // Find the title container and add indicator there
        const titleContainer = result.querySelector('[data-cy="title-recipe"], h2, .s-size-mini');
        if (titleContainer) {
          titleContainer.appendChild(indicator);
        }
        
        // Start analyzing this product immediately
        analyzeVisibleProduct(result, titleLink.href);
      }
    });
  }

  // Check if element is visible in viewport
  function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  // Analyze a single visible product
  function analyzeVisibleProduct(resultElement, productUrl) {
    const productId = productUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!productId) {
      console.log('No product ID found in URL:', productUrl);
      return;
    }
    
    // Avoid duplicate analysis
    if (analyzedProducts.has(productId) || analysisQueue.has(productId)) {
      console.log('Product already analyzed or in queue:', productId);
      return;
    }
    
    console.log('Starting analysis for product:', productId, productUrl);
    analysisQueue.add(productId);
    
    // Send message to background script for analysis
    chrome.runtime.sendMessage({
      action: 'analyzeProducts',
      urls: [productUrl]
    });
  }

  // Handle scroll to analyze new visible products
  function handleScroll() {
    addTrustScoreIndicators();
  }

  // Analyze ALL products on the page (button functionality)
  function analyzeProducts() {
    console.log('analyzeProducts() function called');
    const productUrls = getProductUrls();
    console.log(`Found ${productUrls.length} products to analyze`, productUrls);

    if (productUrls.length === 0) {
      updateAnalyzeButtonText('No products found');
      return;
    }

    // Clear existing tracking to allow re-analysis
    analyzedProducts.clear();
    analysisQueue.clear();
    totalProductsToAnalyze = productUrls.length;
    analysisInProgress = true;

    // Update button to show progress with warning
    updateAnalyzeButtonText(`Analyzing ${productUrls.length} products... (may be slow)`);
    
    // Add indicators to ALL products on the page (not just visible ones)
    addTrustScoreIndicatorsToAll();
    
    // Check completion periodically
    checkAnalysisCompletion();
  }

  // Add indicators to ALL products on page (for button click)
  function addTrustScoreIndicatorsToAll() {
    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    searchResults.forEach(result => {
      // Skip sponsored results
      if (result.hasAttribute('data-sponsoring')) {
        return;
      }
      
      const titleLink = result.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
      if (titleLink && !result.querySelector('.trust-score-product-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'trust-score-product-indicator loading';
        indicator.textContent = 'TS';
        indicator.setAttribute('data-loading', 'true');
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'trust-score-tooltip';
        tooltip.textContent = 'Click to see analysis details...';
        indicator.appendChild(tooltip);
        
        // Make indicator clickable
        indicator.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const breakdown = indicator.getAttribute('data-breakdown');
          if (breakdown) {
            showTrustScoreModal(JSON.parse(breakdown));
          }
        });
        
        // Find the title container and add indicator there
        const titleContainer = result.querySelector('[data-cy="title-recipe"], h2, .s-size-mini');
        if (titleContainer) {
          titleContainer.appendChild(indicator);
        }
        
        // Start analyzing this product
        analyzeVisibleProduct(result, titleLink.href);
      }
    });
  }

  // Initialize
  function initialize() {
    // Remove sponsored content immediately and on DOM changes
    removeSponsoredContent();
    
    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      removeSponsoredContent();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Add scroll listener for smart analysis
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 200);
    });

    // Add trust score indicators to initially visible products
    addTrustScoreIndicators();

    // Add analyze button
    addAnalyzeButton();
    
    // Add keyboard shortcut to show button again if hidden
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+A to show analyze button again
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        sessionStorage.removeItem('hideAnalyzeButton');
        if (!document.querySelector('.trust-score-analyze-button')) {
          addAnalyzeButton();
        }
        console.log('Analyze button restored via keyboard shortcut');
      }
    });
  }

  // Add analyze button to the page
  function addAnalyzeButton() {
    console.log('addAnalyzeButton called');
    
    if (document.querySelector('.trust-score-analyze-button')) {
      console.log('Analyze button already exists');
      return;
    }

    // Check if user has hidden the button this session
    const isHidden = sessionStorage.getItem('hideAnalyzeButton');
    console.log('hideAnalyzeButton session value:', isHidden);
    if (isHidden === 'true') {
      console.log('Analyze button hidden by user preference');
      return;
    }

    console.log('Creating analyze button');

    const button = document.createElement('button');
    button.className = 'trust-score-analyze-button';
    button.textContent = 'Analyze All Products';
    button.style.cssText = `
      position: fixed;
      top: 103px;
      right: 20px;
      z-index: 10000;
      background: rgba(139, 92, 246, 0.9);
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      backdrop-filter: blur(2px);
      transition: all 0.2s ease;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(139, 92, 246, 1)';
      button.style.transform = 'translateY(-1px)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(139, 92, 246, 0.9)';
      button.style.transform = 'translateY(0)';
    });
    
    button.title = 'Analyze trust scores for ALL products on this page (may take a while)';

    button.addEventListener('click', () => {
      console.log('Analyze button clicked!');
      analyzeProducts();
    });
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: fixed;
      top: 89px;
      right: 17px;
      z-index: 10001;
      background: rgba(139, 92, 246, 0.9);
      color: white;
      border: 2px solid white;
      padding: 4px;
      border-radius: 50%;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      backdrop-filter: blur(2px);
      transition: all 0.2s ease;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    `;
    
    closeButton.title = 'Hide analyze button';
    
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(139, 92, 246, 1)';
      closeButton.style.borderColor = 'white';
      closeButton.style.transform = 'scale(1.1)';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(139, 92, 246, 0.9)';
      closeButton.style.borderColor = 'white';
      closeButton.style.transform = 'scale(1)';
    });
    
    closeButton.addEventListener('click', () => {
      button.remove();
      closeButton.remove();
      // Store preference to not show button again this session
      sessionStorage.setItem('hideAnalyzeButton', 'true');
    });
    
    document.body.appendChild(button);
    document.body.appendChild(closeButton);
    console.log('Analyze button and close button added to page');
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
      updateProductTrustScore(request.productUrl, request.trustScore, request.breakdown);
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

  function updateProductTrustScore(productUrl, trustScore, breakdown) {
    const productId = productUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!productId) return;

    // Mark as analyzed
    analyzedProducts.add(productId);
    analysisQueue.delete(productId);

    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    searchResults.forEach(result => {
      const productLink = result.querySelector(`a[href*="${productId}"]`);
      if (productLink) {
        const indicator = result.querySelector('.trust-score-product-indicator');
        if (indicator) {
          // Update indicator
          indicator.textContent = trustScore.toString();
          indicator.className = `trust-score-product-indicator ${getTrustScoreClass(trustScore)}`;
          indicator.removeAttribute('data-loading');
          
          // Store breakdown data for modal
          indicator.setAttribute('data-breakdown', JSON.stringify({ trustScore, breakdown }));
          
          // Update tooltip with detailed breakdown
          const tooltip = indicator.querySelector('.trust-score-tooltip');
          if (tooltip && breakdown) {
            tooltip.innerHTML = generateTooltipContent(trustScore, breakdown);
          }
        }
      }
    });
  }

  // Generate detailed tooltip content
  function generateTooltipContent(trustScore, breakdown) {
    const trustLevel = getTrustLevel(trustScore);
    const emoji = getTrustEmoji(trustScore);
    
    let content = `<strong>${emoji} ${trustScore}/100 - ${trustLevel}</strong><br><br>`;
    
    // Explain the scoring breakdown
    content += `<strong>How we calculated this score:</strong><br>`;
    content += `📊 Review Quality: ${breakdown.review_stats_score}/50 pts<br>`;
    content += `🤖 Review Authenticity: ${breakdown.review_analysis_score}/50 pts<br><br>`;
    
    // Add the most important factors that influenced the score
    if (breakdown.comments && breakdown.comments.length > 0) {
      content += `<strong>Main factors:</strong><br>`;
      const topFactors = getTopFactors(breakdown.comments, trustScore);
      topFactors.forEach(factor => {
        content += `${factor.icon} ${factor.text}<br>`;
      });
      content += `<br><em>💡 Click for detailed breakdown</em>`;
    } else {
      content += `<em>💡 Click for detailed breakdown</em>`;
    }
    
    return content;
  }

  function getTrustLevel(score) {
    if (score >= 70) return 'Highly Trustworthy';
    if (score >= 50) return 'Moderately Trustworthy';
    return 'Low Trust';
  }

  function getTrustEmoji(score) {
    if (score >= 70) return '✅';
    if (score >= 50) return '⚠️';
    return '🚨';
  }

  // Convert technical comments into user-friendly explanations
  function getTopFactors(comments, score) {
    const factors = [];
    
    comments.forEach(comment => {
      const lowerComment = comment.toLowerCase();
      
      if (lowerComment.includes('high number of reviews') || lowerComment.includes('1000+')) {
        factors.push({ icon: '👥', text: 'Lots of customer reviews (1000+)' });
      } else if (lowerComment.includes('good number of reviews') || lowerComment.includes('500+')) {
        factors.push({ icon: '👥', text: 'Good amount of reviews (500+)' });
      } else if (lowerComment.includes('moderate number') || lowerComment.includes('100+')) {
        factors.push({ icon: '👥', text: 'Moderate reviews (100+)' });
      } else if (lowerComment.includes('few reviews') || lowerComment.includes('<50')) {
        factors.push({ icon: '👥', text: 'Very few reviews' });
      }
      
      if (lowerComment.includes('optimal average rating')) {
        factors.push({ icon: '⭐', text: 'Perfect rating range (4.5-4.7)' });
      } else if (lowerComment.includes('very high average rating')) {
        factors.push({ icon: '⭐', text: 'Suspiciously high ratings (4.8+)' });
      } else if (lowerComment.includes('good average rating')) {
        factors.push({ icon: '⭐', text: 'Good average rating' });
      } else if (lowerComment.includes('lower average rating')) {
        factors.push({ icon: '⭐', text: 'Below average ratings' });
      }
      
      if (lowerComment.includes('excellent verified purchase')) {
        factors.push({ icon: '✅', text: '90%+ verified purchases' });
      } else if (lowerComment.includes('good verified purchase')) {
        factors.push({ icon: '✅', text: '70%+ verified purchases' });
      } else if (lowerComment.includes('low verified purchase')) {
        factors.push({ icon: '❌', text: 'Too many unverified purchases' });
      }
      
      if (lowerComment.includes('balanced rating distribution')) {
        factors.push({ icon: '📊', text: 'Natural rating spread' });
      } else if (lowerComment.includes('skewed toward 5-star')) {
        factors.push({ icon: '📊', text: 'Too many 5-star reviews' });
      }
      
      if (lowerComment.includes('detailed reviews')) {
        factors.push({ icon: '📝', text: 'Reviews contain helpful details' });
      } else if (lowerComment.includes('repetitive')) {
        factors.push({ icon: '🔄', text: 'Many similar/copy-paste reviews' });
      }
      
      if (lowerComment.includes('realistic rating distribution')) {
        factors.push({ icon: '🎯', text: 'Reviews seem genuine' });
      }
    });
    
    // Return top 3 most relevant factors
    return factors.slice(0, 3);
  }

  function getTrustScoreClass(score) {
    if (score >= 70) return 'trust-score-high';
    if (score >= 50) return 'trust-score-medium';
    return 'trust-score-low';
  }

  function updateAnalyzeButtonText(text) {
    const button = document.querySelector('.trust-score-analyze-button');
    if (button) {
      button.textContent = text;
    }
  }

  // Check if analysis is complete and update button accordingly
  function checkAnalysisCompletion() {
    if (!analysisInProgress) return;
    
    const completionInterval = setInterval(() => {
      if (!analysisInProgress) {
        clearInterval(completionInterval);
        return;
      }
      
      // Count products with completed analysis (not loading)
      const completedCount = document.querySelectorAll('.trust-score-product-indicator:not([data-loading])').length;
      console.log(`Analysis progress: ${completedCount}/${totalProductsToAnalyze} products completed`);
      
      // Update button with progress
      if (completedCount < totalProductsToAnalyze) {
        updateAnalyzeButtonText(`Analyzing... ${completedCount}/${totalProductsToAnalyze} complete`);
      } else {
        // All analysis complete
        analysisInProgress = false;
        updateAnalyzeButtonText('Analysis Complete');
        
        // Check if ranking should be applied
        chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
          const shouldRank = response && response.enableRanking !== false;
          console.log('Ranking enabled:', shouldRank);
          
          if (shouldRank) {
            setTimeout(() => {
              rankProductsByTrustScore();
              updateAnalyzeButtonText('Analysis Complete - Ranked');
              
              // Scroll to top of results after ranking
              scrollToTopOfResults();
              
              // Reset to default after showing completion message
              setTimeout(() => {
                updateAnalyzeButtonText('Analyze All Products');
              }, 3000);
            }, 1000);
          } else {
            // Scroll to top of results even without ranking
            scrollToTopOfResults();
            
            // Reset to default after showing completion message
            setTimeout(() => {
              updateAnalyzeButtonText('Analyze All Products');
            }, 3000);
          }
        });
        
        clearInterval(completionInterval);
      }
    }, 1000); // Check every second
  }

  // Rank products by trust score (highest first)
  function rankProductsByTrustScore() {
    console.log('Ranking products by trust score...');
    
    const searchResultsContainer = document.querySelector('[data-component-type="s-search-result"]')?.parentElement;
    if (!searchResultsContainer) {
      console.log('Could not find search results container');
      return;
    }

    // Get all product results with trust scores
    const productResults = [];
    const searchResults = document.querySelectorAll('[data-component-type="s-search-result"]');
    
    searchResults.forEach(result => {
      // Skip sponsored results
      if (result.hasAttribute('data-sponsoring')) {
        return;
      }
      
      const trustScoreIndicator = result.querySelector('.trust-score-product-indicator');
      let trustScore = -1; // Default for products without scores
      
      if (trustScoreIndicator && !trustScoreIndicator.hasAttribute('data-loading')) {
        const scoreText = trustScoreIndicator.textContent;
        if (scoreText && scoreText !== 'TS') {
          trustScore = parseInt(scoreText) || -1;
        }
      }
      
      productResults.push({
        element: result,
        trustScore: trustScore,
        originalPosition: Array.from(searchResults).indexOf(result)
      });
    });

    // Sort by trust score (highest first), then by original position for ties
    productResults.sort((a, b) => {
      if (a.trustScore !== b.trustScore) {
        return b.trustScore - a.trustScore; // Descending trust score
      }
      return a.originalPosition - b.originalPosition; // Original order for ties
    });

    // Reorder the DOM elements
    productResults.forEach((productData, index) => {
      const element = productData.element;
      const parent = element.parentElement;
      
      // Remove and re-append to move to new position
      parent.removeChild(element);
      parent.appendChild(element);
    });

    console.log(`Ranked ${productResults.length} products by trust score`);
    
    // Add visual indicator that ranking was applied
    addRankingIndicator();
  }

  // Add visual indicator that products have been ranked
  function addRankingIndicator() {
    // Remove existing indicator
    const existingIndicator = document.querySelector('.trust-score-ranking-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    const indicator = document.createElement('div');
    indicator.className = 'trust-score-ranking-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 140px;
      right: 20px;
      z-index: 9999;
      background: rgba(34, 197, 94, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      backdrop-filter: blur(2px);
      transition: opacity 0.3s ease;
    `;
    indicator.textContent = '📊 Ranked by Trust Score';
    
    document.body.appendChild(indicator);
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      if (indicator.parentElement) {
        indicator.style.opacity = '0';
        setTimeout(() => {
          if (indicator.parentElement) {
            indicator.remove();
          }
        }, 300);
      }
    }, 4000);
  }

  // Scroll to the top of search results
  function scrollToTopOfResults() {
    console.log('Scrolling to top of search results...');
    
    // Find the first search result
    const firstResult = document.querySelector('[data-component-type="s-search-result"]:not([data-sponsoring])');
    
    if (firstResult) {
      // Scroll to the first result with some offset for better visibility
      const offsetTop = firstResult.offsetTop - 100; // 100px offset from top
      window.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: 'smooth'
      });
      console.log('Scrolled to first search result');
    } else {
      // Fallback: scroll to a reasonable position near the search results
      const searchContainer = document.querySelector('[data-component-type="s-search-result"]')?.parentElement;
      if (searchContainer) {
        const offsetTop = searchContainer.offsetTop - 100;
        window.scrollTo({
          top: Math.max(0, offsetTop),
          behavior: 'smooth'
        });
        console.log('Scrolled to search results container');
      } else {
        // Ultimate fallback: scroll to top of page
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        console.log('Scrolled to top of page');
      }
    }
  }

  // Show detailed trust score modal
  function showTrustScoreModal(data) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.trust-score-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const { trustScore, breakdown } = data;
    const trustLevel = getTrustLevel(trustScore);
    const emoji = getTrustEmoji(trustScore);

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'trust-score-modal';
    
    modal.innerHTML = `
      <div class="trust-score-modal-content">
        <div class="trust-score-modal-header">
          <h3 class="trust-score-modal-title">Trust Score Analysis</h3>
          <button class="trust-score-modal-close">×</button>
        </div>
        
        <div class="trust-score-modal-score ${getTrustScoreClass(trustScore)}">
          <div class="trust-score-modal-score-number ${getTrustScoreClass(trustScore)}">${emoji} ${trustScore}/100</div>
          <div class="trust-score-modal-score-label">${trustLevel}</div>
        </div>
        
        <div class="trust-score-modal-breakdown">
          <div class="trust-score-modal-section">
            <h4>📊 Review Quality: ${breakdown.review_stats_score}/50 points</h4>
            <p>Based on number of reviews, rating patterns, verification status, and review distribution.</p>
          </div>
          
          <div class="trust-score-modal-section">
            <h4>🤖 Review Authenticity: ${breakdown.review_analysis_score}/50 points</h4>
            <p>AI analysis of review content for fake patterns, repetitive text, and suspicious behavior.</p>
          </div>
        </div>
        
        <div class="trust-score-modal-factors">
          <h4>Key Factors That Influenced This Score:</h4>
          ${generateModalFactors(breakdown.comments, trustScore)}
        </div>
      </div>
    `;

    // Add close functionality
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    const closeButton = modal.querySelector('.trust-score-modal-close');
    closeButton.addEventListener('click', () => {
      modal.remove();
    });

    // Add to page
    document.body.appendChild(modal);
  }

  // Generate detailed factors for modal
  function generateModalFactors(comments, trustScore) {
    const factors = getTopFactors(comments, trustScore);
    
    if (factors.length === 0) {
      return '<div class="trust-score-modal-factor">No specific factors identified.</div>';
    }

    return factors.map(factor => 
      `<div class="trust-score-modal-factor">${factor.icon} ${factor.text}</div>`
    ).join('');
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
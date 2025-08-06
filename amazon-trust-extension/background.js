// Background service worker
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Store API key and settings
let openaiApiKey = '';

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Amazon Trust Score extension installed');
  
  // Load saved settings
  chrome.storage.local.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey) {
      openaiApiKey = result.openaiApiKey;
    }
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'analyzeProducts':
      handleAnalyzeProducts(request.urls, sender.tab.id);
      break;
      
    case 'scrapeReviews':
      handleScrapeReviews(request.productUrl, request.reviewsUrl, sender.tab.id);
      break;
      
    case 'analyzeWithOpenAI':
      handleOpenAIAnalysis(request.prompt)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep message channel open for async response
      
    case 'trustScoreCalculated':
      handleTrustScoreCalculated(request.productUrl, request.trustScore, sender.tab.id);
      break;
      
    case 'setApiKey':
      handleSetApiKey(request.apiKey);
      sendResponse({ success: true });
      break;
      
    case 'getSettings':
      sendResponse({ apiKey: !!openaiApiKey });
      break;
  }
});

// Open product pages in background tabs for analysis
async function handleAnalyzeProducts(urls, sourceTabId) {
  console.log(`Opening ${urls.length} product pages for analysis`);
  
  for (const url of urls.slice(0, 5)) { // Limit to 5 to avoid overwhelming
    try {
      // Create new tab
      const tab = await chrome.tabs.create({
        url: url,
        active: false // Open in background
      });
      
      // Store reference to source tab
      chrome.storage.local.set({
        [`tab_${tab.id}_source`]: sourceTabId
      });
      
      // Close tab after analysis (with delay)
      setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
      }, 15000);
      
    } catch (error) {
      console.error('Error creating tab for analysis:', error);
    }
    
    // Add delay between tab creations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Handle reviews scraping in separate tab
async function handleScrapeReviews(productUrl, reviewsUrl, sourceTabId) {
  try {
    const tab = await chrome.tabs.create({
      url: reviewsUrl,
      active: false
    });
    
    // Inject review scraping script
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapeReviewsFromPage,
        args: [productUrl, sourceTabId]
      });
    }, 3000);
    
    // Close tab after scraping
    setTimeout(() => {
      chrome.tabs.remove(tab.id).catch(() => {});
    }, 10000);
    
  } catch (error) {
    console.error('Error scraping reviews:', error);
  }
}

// Function to be injected into reviews page
function scrapeReviewsFromPage(productUrl, sourceTabId) {
  const reviews = [];
  let currentPage = 1;
  const maxPages = 3;
  
  function scrapeCurrentPage() {
    const reviewElements = document.querySelectorAll('[data-hook="review"]');
    
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
        }

        if (review.text && review.text.length > 10) {
          reviews.push(review);
        }
      } catch (error) {
        console.error('Error parsing review:', error);
      }
    });

    // Try to go to next page
    if (currentPage < maxPages) {
      const nextButton = document.querySelector('.a-pagination .a-last a');
      if (nextButton && !nextButton.classList.contains('a-disabled')) {
        currentPage++;
        nextButton.click();
        setTimeout(scrapeCurrentPage, 2000);
        return;
      }
    }
    
    // Send scraped reviews back
    chrome.runtime.sendMessage({
      action: 'reviewsScraped',
      productUrl: productUrl,
      reviews: reviews,
      sourceTabId: sourceTabId
    });
  }
  
  scrapeCurrentPage();
}

// Handle OpenAI API calls
async function handleOpenAIAnalysis(prompt) {
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// Handle trust score calculation results
function handleTrustScoreCalculated(productUrl, trustScore, tabId) {
  // Send to source search page if available
  chrome.storage.local.get([`tab_${tabId}_source`], (result) => {
    const sourceTabId = result[`tab_${tabId}_source`];
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'updateTrustScore',
        productUrl: productUrl,
        trustScore: trustScore
      }).catch(() => {});
    }
  });
}

// Handle API key storage
function handleSetApiKey(apiKey) {
  openaiApiKey = apiKey;
  chrome.storage.local.set({ openaiApiKey: apiKey });
}

// Handle tab removal cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up stored tab references
  chrome.storage.local.remove(`tab_${tabId}_source`);
});
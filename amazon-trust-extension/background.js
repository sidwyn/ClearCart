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
  console.log('Background received message:', request.action, request);
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

// Analyze product pages without opening tabs
async function handleAnalyzeProducts(urls, sourceTabId) {
  console.log(`Analyzing ${urls.length} products in background`, urls, 'for tab', sourceTabId);
  
  for (const url of urls.slice(0, 5)) { // Limit to 5 to avoid overwhelming
    try {
      await analyzeProductInBackground(url, sourceTabId);
    } catch (error) {
      console.error('Error analyzing product:', error);
    }
    
    // Add delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Analyze a single product without opening a tab
async function analyzeProductInBackground(productUrl, sourceTabId) {
  try {
    // Fetch the product page HTML
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Send HTML to content script for parsing (since DOMParser isn't available in service worker)
    const productData = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(sourceTabId, {
        action: 'parseProductHTML',
        html: html,
        productUrl: productUrl
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error('Failed to parse HTML'));
        }
      });
    });
    
    // Calculate trust score
    const trustScore = await calculateTrustScoreFromData(productData);
    
    // Send results back to search page
    chrome.tabs.sendMessage(sourceTabId, {
      action: 'updateTrustScore',
      productUrl: productUrl,
      trustScore: trustScore.trust_score,
      breakdown: trustScore.breakdown
    }).catch(() => {
      // Tab might be closed, ignore error
    });
    
  } catch (error) {
    console.error(`Error analyzing product ${productUrl}:`, error);
  }
}


// Calculate trust score from parsed data
async function calculateTrustScoreFromData(data) {
  let reviewStatsScore = 0;
  let reviewAnalysisScore = 25; // Base score
  let comments = [];

  // Section 1: Review Stats (max 50 pts)
  
  // Number of reviews (10 pts)
  if (data.totalReviews >= 1000) {
    reviewStatsScore += 10;
    comments.push('High number of reviews (1000+)');
  } else if (data.totalReviews >= 500) {
    reviewStatsScore += 7;
    comments.push('Good number of reviews (500+)');
  } else if (data.totalReviews >= 100) {
    reviewStatsScore += 4;
    comments.push('Moderate number of reviews (100+)');
  } else if (data.totalReviews >= 50) {
    reviewStatsScore += 1;
    comments.push('Few reviews (50+)');
  } else {
    comments.push('Very few reviews (<50)');
  }

  // Average rating (10 pts)
  if (data.averageRating >= 4.5 && data.averageRating <= 4.7) {
    reviewStatsScore += 10;
    comments.push('Optimal average rating (4.5-4.7)');
  } else if (data.averageRating >= 4.8) {
    reviewStatsScore += 7;
    comments.push('Very high average rating (4.8+)');
  } else if (data.averageRating >= 4.0) {
    reviewStatsScore += 5;
    comments.push('Good average rating (4.0+)');
  } else {
    reviewStatsScore += 3;
    comments.push('Lower average rating (<4.0)');
  }

  // Verified purchase percentage (10 pts)
  if (data.verifiedPercentage >= 90) {
    reviewStatsScore += 10;
    comments.push('Excellent verified purchase ratio (90%+)');
  } else if (data.verifiedPercentage >= 70) {
    reviewStatsScore += 5;
    comments.push('Good verified purchase ratio (70-89%)');
  } else {
    reviewStatsScore += 1;
    comments.push('Low verified purchase ratio (<70%)');
  }

  // Rating distribution (10 pts)
  const fiveStarPercentage = data.ratingDistribution[5] || 0;
  if (fiveStarPercentage < 80) {
    reviewStatsScore += 10;
    comments.push('Balanced rating distribution');
  } else {
    reviewStatsScore += 4;
    comments.push('Skewed toward 5-star reviews');
  }

  // Review recency (10 pts) - simplified analysis
  if (data.reviewTimestamps.length > 0) {
    reviewStatsScore += 8; // Assume good spread for now
    comments.push('Reviews spread over time');
  }

  // Section 2: Review Authenticity (max 50 pts)
  if (data.reviews.length > 0) {
    try {
      const analysisResult = await analyzeReviewsWithAI(data.reviews.slice(0, 20));
      reviewAnalysisScore += analysisResult.score;
      comments.push(...analysisResult.comments);
    } catch (error) {
      // Fallback to rule-based analysis
      const fallbackAnalysis = analyzeReviewsFallback(data.reviews);
      reviewAnalysisScore += fallbackAnalysis.score;
      comments.push(...fallbackAnalysis.comments);
    }
  } else {
    comments.push('No detailed reviews available for analysis');
  }

  const totalScore = Math.min(100, reviewStatsScore + reviewAnalysisScore);

  return {
    trust_score: totalScore,
    breakdown: {
      review_stats_score: reviewStatsScore,
      review_analysis_score: reviewAnalysisScore,
      comments: comments
    }
  };
}

// Fallback rule-based analysis
function analyzeReviewsFallback(reviews) {
  let score = 0;
  const comments = [];
  
  // Check for repetitive content
  const reviewTexts = reviews.map(r => r.text.toLowerCase());
  const uniqueTexts = new Set(reviewTexts);
  if (uniqueTexts.size < reviewTexts.length * 0.8) {
    score -= 10;
    comments.push('Some repetitive review content detected');
  }
  
  // Check for detailed reviews
  const detailedReviews = reviews.filter(r => r.text.length > 100);
  if (detailedReviews.length > reviews.length * 0.6) {
    score += 10;
    comments.push('Many detailed reviews found');
  }
  
  // Check rating distribution in sample
  const ratings = reviews.map(r => r.rating);
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  if (avgRating < 4.8) {
    score += 5;
    comments.push('Realistic rating distribution in sample');
  }
  
  return { score, comments };
}

// Handle reviews scraping (now unused but kept for potential future use)
async function handleScrapeReviews(productUrl, reviewsUrl, sourceTabId) {
  console.log('Review scraping called but not implemented in background mode');
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
  console.log(`Trust score calculated for ${productUrl}: ${trustScore}`);
}

// Handle API key storage
function handleSetApiKey(apiKey) {
  openaiApiKey = apiKey;
  chrome.storage.local.set({ openaiApiKey: apiKey });
}

// Background analysis doesn't need tab cleanup
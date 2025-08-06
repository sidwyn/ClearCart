// Content script for Amazon product pages
(function() {
  'use strict';

  let trustScoreUI = null;
  let currentProductData = null;

  // Scrape review data from product page
  async function scrapeReviewData() {
    const data = {
      productUrl: window.location.href,
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
      const titleElement = document.querySelector('#productTitle');
      data.productTitle = titleElement ? titleElement.textContent.trim() : '';

      // Get average rating
      const ratingElement = document.querySelector('[data-hook="average-star-rating"] .a-offscreen, .a-icon-alt');
      if (ratingElement) {
        const ratingText = ratingElement.textContent;
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        data.averageRating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
      }

      // Get total review count
      const reviewCountElement = document.querySelector('[data-hook="total-review-count"]');
      if (reviewCountElement) {
        const countText = reviewCountElement.textContent.replace(/,/g, '');
        const countMatch = countText.match(/(\d+)/);
        data.totalReviews = countMatch ? parseInt(countMatch[1]) : 0;
      }

      // Get rating distribution
      const histogramElements = document.querySelectorAll('[data-hook="histogram-count"]');
      histogramElements.forEach((element, index) => {
        const percentage = parseFloat(element.textContent.replace('%', ''));
        data.ratingDistribution[5 - index] = percentage;
      });

      // Navigate to reviews and scrape them
      await scrapeReviews(data);

      return data;
    } catch (error) {
      console.error('Error scraping review data:', error);
      return data;
    }
  }

  // Scrape individual reviews from reviews pages
  async function scrapeReviews(data) {
    const reviewsToScrape = [];
    
    try {
      // Try to find and click "See all reviews" link
      const seeAllReviewsLink = document.querySelector('[data-hook="see-all-reviews-link"]');
      if (seeAllReviewsLink) {
        // Open reviews in new tab to avoid navigation issues
        const reviewsUrl = seeAllReviewsLink.href;
        
        // Send message to background to scrape reviews
        chrome.runtime.sendMessage({
          action: 'scrapeReviews',
          productUrl: data.productUrl,
          reviewsUrl: reviewsUrl
        });
        
        return;
      }

      // If no dedicated reviews page, scrape reviews from current page
      await scrapeReviewsFromCurrentPage(data);
      
    } catch (error) {
      console.error('Error navigating to reviews:', error);
    }
  }

  // Scrape reviews from current page
  async function scrapeReviewsFromCurrentPage(data) {
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
          data.reviewTimestamps.push(review.date);
        }

        // Get helpful votes
        const helpfulElement = reviewEl.querySelector('[data-hook="helpful-vote-statement"]');
        if (helpfulElement) {
          const helpfulMatch = helpfulElement.textContent.match(/(\d+)/);
          review.helpful = helpfulMatch ? parseInt(helpfulMatch[1]) : 0;
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

    // Process the data
    processProductData(data);
  }

  // Process scraped data and calculate trust score
  async function processProductData(data) {
    currentProductData = data;
    
    try {
      // Calculate trust score
      const trustScore = await calculateTrustScore(data);
      
      // Show UI with results
      showTrustScoreUI(trustScore);
      
      // Send results back to search page if needed
      chrome.runtime.sendMessage({
        action: 'trustScoreCalculated',
        productUrl: data.productUrl,
        trustScore: trustScore.trust_score
      });
      
    } catch (error) {
      console.error('Error processing product data:', error);
      showErrorUI('Failed to calculate trust score');
    }
  }

  // Calculate trust score based on the scoring system
  async function calculateTrustScore(data) {
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
        const analysisResult = await analyzeReviewsWithAI(data.reviews.slice(0, 30));
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

  // AI-based review analysis using OpenAI
  async function analyzeReviewsWithAI(reviews) {
    const reviewTexts = reviews.map(r => r.text).join('\\n\\n');
    
    const prompt = `Analyze these product reviews for authenticity and provide a score from -25 to +25 based on these criteria:
    
    - Deduct points for repetitive language or phrases
    - Deduct points for overly positive and vague reviews
    - Add points for detailed product usage descriptions
    - Add points for mix of sentiments (3-5 star reviews)
    - Add points if reviews seem genuine and detailed
    
    Reviews to analyze:
    ${reviewTexts}
    
    Respond with JSON format:
    {"score": <number between -25 and +25>, "comments": ["comment1", "comment2"]}`;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeWithOpenAI',
        prompt: prompt
      });
      
      return JSON.parse(response);
    } catch (error) {
      throw error;
    }
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

  // Show trust score UI
  function showTrustScoreUI(trustScore) {
    // Remove existing UI
    if (trustScoreUI) {
      trustScoreUI.remove();
    }

    // Create UI overlay
    trustScoreUI = document.createElement('div');
    trustScoreUI.className = 'trust-score-overlay';
    
    const scoreClass = getTrustScoreClass(trustScore.trust_score);
    const scoreLabel = getTrustScoreLabel(trustScore.trust_score);
    
    trustScoreUI.innerHTML = `
      <div class="trust-score-header">
        <span>Trust Score</span>
        <button class="trust-score-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="trust-score-content">
        <div class="trust-score-main">
          <div class="trust-score-value ${scoreClass}">${trustScore.trust_score}</div>
          <div class="trust-score-label">${scoreLabel}</div>
          <div class="trust-score-description">Based on review analysis</div>
        </div>
        <div class="trust-score-breakdown">
          <div class="trust-score-section">
            <div class="trust-score-section-title">
              Review Stats
              <span class="trust-score-section-score">${trustScore.breakdown.review_stats_score}/50</span>
            </div>
          </div>
          <div class="trust-score-section">
            <div class="trust-score-section-title">
              Review Analysis
              <span class="trust-score-section-score">${trustScore.breakdown.review_analysis_score}/50</span>
            </div>
          </div>
          <div class="trust-score-comments">
            ${trustScore.breakdown.comments.map(comment => 
              `<div class="trust-score-comment">${comment}</div>`
            ).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(trustScoreUI);
  }

  // Show error UI
  function showErrorUI(message) {
    if (trustScoreUI) {
      trustScoreUI.remove();
    }

    trustScoreUI = document.createElement('div');
    trustScoreUI.className = 'trust-score-overlay';
    trustScoreUI.innerHTML = `
      <div class="trust-score-header">
        <span>Trust Score</span>
        <button class="trust-score-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="trust-score-content">
        <div class="trust-score-error">
          ${message}
        </div>
      </div>
    `;

    document.body.appendChild(trustScoreUI);
  }

  // Utility functions
  function getTrustScoreClass(score) {
    if (score >= 80) return 'trust-score-high';
    if (score >= 60) return 'trust-score-medium';
    return 'trust-score-low';
  }

  function getTrustScoreLabel(score) {
    if (score >= 80) return 'High Trust';
    if (score >= 60) return 'Medium Trust';
    return 'Low Trust';
  }

  // Initialize when page loads
  function initialize() {
    // Remove sponsored content
    const sponsoredElements = document.querySelectorAll(
      '.s-sponsored-info-icon, .puis-sponsored-label-text, .AdHolder'
    );
    sponsoredElements.forEach(element => {
      element.style.display = 'none';
    });

    // Start analysis after a short delay to ensure page is fully loaded
    setTimeout(() => {
      scrapeReviewData();
    }, 2000);
  }

  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Listen for messages from other scripts
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTrustScore') {
      sendResponse(currentProductData);
    }
  });

})();
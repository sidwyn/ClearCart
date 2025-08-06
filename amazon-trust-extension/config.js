// Configuration and constants
const CONFIG = {
  OPENAI_API_KEY: '', // Will be loaded from storage
  MAX_REVIEWS_TO_ANALYZE: 50,
  TRUST_SCORE_THRESHOLDS: {
    HIGH: 80,
    MEDIUM: 60,
    LOW: 40
  },
  REVIEW_PAGES_TO_SCRAPE: 3,
  SELECTORS: {
    // Amazon search page selectors
    SEARCH_RESULTS: '[data-component-type="s-search-result"]',
    PRODUCT_LINKS: 'a[href*="/dp/"], a[href*="/gp/product/"]',
    SPONSORED: '[data-component-type="s-search-result"][data-sponsoring]',
    
    // Product page selectors
    PRODUCT_TITLE: '#productTitle',
    RATING: '[data-hook="average-star-rating"] .a-offscreen',
    REVIEW_COUNT: '[data-hook="total-review-count"]',
    RATING_HISTOGRAM: '[data-hook="histogram-count"]',
    REVIEWS_SECTION: '[data-hook="reviews-medley-footer"]',
    REVIEW_ITEMS: '[data-hook="review"]',
    REVIEW_TEXT: '[data-hook="review-body"] span',
    REVIEW_RATING: '[data-hook="review-star-rating"] .a-offscreen',
    VERIFIED_PURCHASE: '[data-hook="avp-badge"]',
    REVIEW_DATE: '[data-hook="review-date"]',
    NEXT_REVIEWS_PAGE: '.a-pagination .a-last a'
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
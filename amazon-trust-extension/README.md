# Amazon Trust Score Extension

A Chrome extension that analyzes Amazon product reviews to generate trust scores and removes sponsored content for unbiased shopping.

## Features

- **Trust Score Analysis (0-100)**: Comprehensive scoring based on review statistics and authenticity
- **Sponsored Content Removal**: Automatically hides sponsored products and ads
- **AI-Powered Review Analysis**: Uses OpenAI to detect fake or suspicious reviews
- **Real-time Analysis**: Analyzes products as you browse
- **Detailed Breakdown**: Shows scoring rationale and review insights

## Installation

1. Download or clone this extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `amazon-trust-extension` folder
5. The extension should now appear in your Chrome toolbar

## Setup

1. Click the extension icon in your Chrome toolbar
2. Enter your OpenAI API key (required for AI analysis)
3. The extension is now ready to use

### OpenAI API Key

You'll need an OpenAI API key for the AI-powered review analysis:

1. Go to [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Enter it in the extension popup
4. Set the environment variable name as: `OPENAI_API_KEY`

## Usage

### On Amazon Search Pages

1. Visit any Amazon search page (e.g., `amazon.com/s?k=headphones`)
2. Sponsored content will be automatically removed
3. Click the "Analyze Trust Scores" button that appears
4. The extension will open product pages in background tabs for analysis
5. Trust scores will appear next to product titles once calculated

### On Product Pages

1. Visit any Amazon product page
2. The extension will automatically analyze the product's reviews
3. A trust score overlay will appear showing:
   - Overall trust score (0-100)
   - Review statistics breakdown
   - AI analysis comments
   - Authenticity insights

## Trust Score Calculation

### Review Stats (50 points max)
- **Review Count** (10 pts): More reviews = higher score
- **Average Rating** (10 pts): 4.5-4.7 optimal, too perfect is suspicious  
- **Verified Purchases** (10 pts): Higher verified percentage is better
- **Rating Distribution** (10 pts): Balanced ratings are more trustworthy
- **Review Recency** (10 pts): Reviews spread over time vs. sudden bursts

### Review Analysis (50 points max)
- **AI Analysis**: Detects repetitive language, generic reviews, detailed usage descriptions
- **Sentiment Analysis**: Balanced mix of ratings vs. suspicious uniformity
- **Verification Alignment**: Verified reviews should align with overall sentiment

## Files Structure

```
amazon-trust-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for API calls
├── content-search.js      # Script for search pages
├── content-product.js     # Script for product pages  
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── styles.css            # Extension styles
├── config.js             # Configuration constants
└── README.md             # This file
```

## Privacy & Security

- The extension only runs on Amazon.com domains
- Review data is sent to OpenAI for analysis (see OpenAI's privacy policy)
- Your API key is stored locally in Chrome's storage
- No personal data is collected or transmitted

## Troubleshooting

**Trust scores not appearing:**
- Check that your OpenAI API key is valid
- Ensure you have sufficient API credits
- Check the browser console for error messages

**Extension not working on Amazon:**
- Verify the extension is enabled
- Refresh the Amazon page
- Check that you're on a supported Amazon domain (.com)

**Sponsored content still showing:**
- The extension targets known sponsored selectors
- Amazon may use new selectors that aren't covered yet
- Report issues for updates

## Development

To modify or extend this extension:

1. Edit the relevant files
2. Reload the extension in `chrome://extensions/`
3. Test on Amazon pages

Key files:
- `content-search.js`: Modify search page behavior
- `content-product.js`: Modify product page analysis
- `background.js`: Modify API integrations
- `styles.css`: Modify visual appearance

## Version History

**1.0.0** - Initial release
- Trust score calculation
- OpenAI integration
- Sponsored content removal
- Product analysis automation
# Debug Steps

## 1. Check if extension is loaded
- Open Amazon search page (e.g., `amazon.com/s?k=headphones`)
- Open Developer Console (F12)
- Look for: "Amazon Trust Score extension loaded on: [URL]"

## 2. Check if button is created
- Look for: "Creating analyze button"
- Look for: "Analyze button added to page"
- Should see purple "Analyze All Products" button in top-right

## 3. Check if button click works
- Click the purple button
- Look for: "Analyze button clicked!"
- Look for: "analyzeProducts() function called"
- Look for: "Found X products to analyze"

## 4. Check if products are detected
- Should see console logs for each search result
- Look for: "Result 0 titleLink: [URL]"
- Look for: "Added product 0: [Clean URL]"

## 5. Check if background script receives messages
- Look for: "Background received message: analyzeProducts"
- Look for: "Analyzing X products in background"

## Common Issues:
1. **Extension not loading**: Check manifest.json matches pattern
2. **No button**: Check if URL matches `*://*.amazon.com/s*`
3. **No products found**: Check if Amazon changed their HTML structure
4. **No background messages**: Check permissions in manifest

## Test URL:
`https://www.amazon.com/s?k=baby+washcloth`
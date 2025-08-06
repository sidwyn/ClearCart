# ClearCart Icons

The extension needs PNG icons in these sizes:
- `icon-16.png` (16x16 pixels)
- `icon-32.png` (32x32 pixels) 
- `icon-48.png` (48x48 pixels)
- `icon-128.png` (128x128 pixels)

## Design Concept
- **Background**: White circle with light gray border
- **Icon**: Green checkmark (✓) - simple and clean
- **Color**: #22C55E (green-500)
- **Style**: Clean, minimalist, professional

## Quick Generation Options:

### Option 1: Use the Python script
```bash
cd amazon-trust-extension
python3 create-simple-icons.py
```
(Requires: `pip install Pillow`)

### Option 2: Use the HTML generator
1. Open `create-icons.html` in your browser
2. Click the download buttons for each size

### Option 3: Manual creation
Use any image editor to create PNG files matching the SVG design in `icon.svg`.

## Temporary Workaround
If you want to test the extension immediately without icons, you can:
1. Comment out the `icons` sections in `manifest.json`
2. The extension will work without custom icons (using default Chrome extension icon)
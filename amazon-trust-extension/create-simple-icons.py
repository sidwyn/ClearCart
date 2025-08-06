#!/usr/bin/env python3
"""
Simple icon generator for ClearCart extension.
Creates purple shopping cart icons with green checkmarks.
"""

from PIL import Image, ImageDraw
import os

def create_icon(size):
    # Create image with white background and light border
    img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Light gray border circle
    margin = 1
    border_color = (224, 224, 224, 255)
    draw.ellipse([margin, margin, size-margin, size-margin], 
                outline=border_color, width=max(1, int(size / 64)))
    
    # Scale factor
    scale = size / 128
    
    # Green checkmark
    check_color = (34, 197, 94, 255)  # #22C55E
    check_width = max(2, int(size / 10))
    
    # Checkmark points (centered and larger)
    x1, y1 = int(35 * scale), int(64 * scale)
    x2, y2 = int(55 * scale), int(84 * scale) 
    x3, y3 = int(93 * scale), int(46 * scale)
    
    # Draw checkmark with rounded ends
    draw.line([x1, y1, x2, y2], fill=check_color, width=check_width)
    draw.line([x2, y2, x3, y3], fill=check_color, width=check_width)
    
    return img

def main():
    # Create icons directory
    icons_dir = 'icons'
    os.makedirs(icons_dir, exist_ok=True)
    
    # Generate icons
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        filename = f'{icons_dir}/icon-{size}.png'
        icon.save(filename, 'PNG')
        print(f'Created {filename}')
    
    print('All icons created successfully!')

if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print("PIL (Pillow) is required to generate icons.")
        print("Install with: pip install Pillow")
        print("Alternatively, you can create the icons manually or use the HTML generator.")
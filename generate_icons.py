import os
import fitz  # PyMuPDF

def render_svg_to_png(svg_path, output_path, target_size):
    # Open the SVG file
    doc = fitz.open(svg_path)
    page = doc[0]
    
    # Get the bounding box of the page
    rect = page.rect
    width = rect.width
    height = rect.height
    
    # Calculate scale factor
    scale_x = target_size / width
    scale_y = target_size / height
    
    # We want to maintain aspect ratio and fit within target_size
    scale = min(scale_x, scale_y)
    
    # Create transformation matrix
    mat = fitz.Matrix(scale, scale)
    
    # Render page to a pixmap (image representation) with transparency
    pix = page.get_pixmap(matrix=mat, alpha=True)
    
    # Save output
    pix.save(output_path)
    print(f"Rendered {svg_path} to {output_path} ({target_size}x{target_size})")

def main():
    os.makedirs("icons", exist_ok=True)
    sizes = [16, 48, 128]
    svg_file = "logo.svg"
    
    if not os.path.exists(svg_file):
        print(f"Error: {svg_file} not found!")
        return
        
    for size in sizes:
        # Write to root icons
        render_svg_to_png(svg_file, f"icons/icon{size}.png", size)
        # Write to SQUEEZE main icons
        os.makedirs("SQUEEZE main/icons", exist_ok=True)
        render_svg_to_png(svg_file, f"SQUEEZE main/icons/icon{size}.png", size)

if __name__ == "__main__":
    main()

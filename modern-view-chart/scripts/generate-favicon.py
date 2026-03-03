from PIL import Image
import os

def generate_favicon():
    source_path = r'd:\TradingWeb\BE_ViewChart\modern-view-chart\public\brand\vivutrade-logo-transparent.png'
    output_ico_path = r'd:\TradingWeb\BE_ViewChart\modern-view-chart\public\favicon.ico'
    output_app_ico_path = r'd:\TradingWeb\BE_ViewChart\modern-view-chart\src\app\favicon.ico'
    
    if not os.path.exists(source_path):
        print(f"Error: Source file not found at {source_path}")
        return

    try:
        img = Image.open(source_path)
        
        # Next.js favicon is usually a list of sizes
        icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
        
        # Save as .ico in both locations to be safe
        img.save(output_ico_path, format='ICO', sizes=icon_sizes)
        print(f"Successfully generated {output_ico_path}")
        
        img.save(output_app_ico_path, format='ICO', sizes=icon_sizes)
        print(f"Successfully generated {output_app_ico_path}")
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    generate_favicon()

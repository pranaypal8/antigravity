import os
import re

new_font = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Manrope:wght@300;400;500;600;700&family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap'

base_dir = r"c:/Users/prana/OneDrive/Documents/antigravity/specialone"

count = 0
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith(".html"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            
            new_content = re.sub(
                r'https://fonts\.googleapis\.com/css2\?family=(?!Material\+Symbols)[^"]+',
                new_font,
                content
            )
            
            if content != new_content:
                with open(path, "w", encoding="utf-8") as file:
                    file.write(new_content)
                count += 1

print(f"Updated {count} files")

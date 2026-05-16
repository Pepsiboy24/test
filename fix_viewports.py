import os
import glob

html_files = glob.glob('**/*.html', recursive=True)
count = 0
for file in html_files:
    # Skip node_modules if it exists
    if 'node_modules' in file: continue
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if '<meta name="viewport"' not in content:
        print(f"Missing viewport meta tag in {file}")
        # Find </head> and insert before
        if '</head>' in content:
            new_meta = '\n    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n'
            content = content.replace('</head>', new_meta + '</head>')
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            count += 1
            print(f" -> Injected successfully.")
        else:
            print(f" -> ERROR: No </head> found in {file}")

print(f"Injected viewport meta tag into {count} files.")

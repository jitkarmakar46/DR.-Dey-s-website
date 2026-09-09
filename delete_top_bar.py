import re

with open('/tmp/github_home.jsx', 'r') as f:
    content = f.read()

# Delete top-bar
content = re.sub(r'\{/\* Medical Top Bar \*/\}\s*<div className="top-bar">.*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(content)

with open('/Users/jitkarmakar/Desktop/UPLOAD_THESE_TO_GITHUB/Home.jsx', 'w') as f:
    f.write(content)

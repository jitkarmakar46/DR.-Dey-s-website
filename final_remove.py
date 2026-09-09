import re

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'r') as f:
    content = f.read()

# Completely remove trust badges
content = re.sub(r'\{/\* Trust Indicators \*/\}.*?</section>', '</section>', content, flags=re.DOTALL)
content = re.sub(r'<div className="trust-badges">.*?</div>\s*</div>\s*</div>\s*</section>', '</div>\n                </div>\n            </section>', content, flags=re.DOTALL)

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(content)

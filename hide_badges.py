with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'r') as f:
    content = f.read()

# Add to the end of the file right before the last closing brace
mobile_additions = """
    .trust-badges {
        display: none !important;
    }
"""

content = content.rstrip()
if content.endswith('}'):
    content = content[:-1] + mobile_additions + '\n}'

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'w') as f:
    f.write(content)

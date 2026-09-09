with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'r') as f:
    content = f.read()

# Make sure body is fixed to prevent bounce on iOS entirely
ios_fix = """
html, body {
    overscroll-behavior-y: none;
    background-color: var(--medical-blue-light);
    height: 100%;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
}
#root {
    min-height: 100%;
}
"""
content = content.replace("html {\n    overscroll-behavior-y: none;\n    background-color: var(--medical-blue-light);\n}", "")
content = content.replace("body {\n    overscroll-behavior-y: none;\n    background-color: var(--medical-blue-light);\n}", "")
content = ios_fix + content

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'w') as f:
    f.write(content)
with open('/Users/jitkarmakar/Desktop/UPLOAD_THESE_TO_GITHUB/index.css', 'w') as f:
    f.write(content)

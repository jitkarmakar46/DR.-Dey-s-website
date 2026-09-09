with open('/tmp/frontend/frontend/src/index.css', 'r') as f:
    content = f.read()

# Add overscroll behavior
if 'overscroll-behavior-y' not in content:
    content = content.replace("body {", "body {\n    overscroll-behavior-y: none;\n    background-color: var(--medical-blue-light);")
    content = content.replace("html {", "html {\n    overscroll-behavior-y: none;\n    background-color: var(--medical-blue-light);")

# Update .form-control for select
if 'select.form-control' not in content:
    content = content.replace(".form-control {", "select.form-control {\n    padding-right: 40px;\n    -webkit-appearance: none;\n    -moz-appearance: none;\n    appearance: none;\n    background-image: url('data:image/svg+xml;utf8,<svg fill=\"%23000000\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>');\n    background-repeat: no-repeat;\n    background-position: right 12px center;\n}\n.form-control {")

# Modify mobile media query
mobile_additions = """
    /* Classy and minimal buttons for mobile hero */
    .hero-buttons {
        flex-direction: row !important;
        gap: 12px !important;
        width: 100%;
        justify-content: center;
    }
    .hero-buttons .btn {
        font-size: 0.85rem !important;
        padding: 10px 18px !important;
        border-radius: 9999px !important;
        flex: 1; /* Make them equal size */
        max-width: 160px;
    }
    /* Auto-typing height for 3 lines */
    .hero-title {
        min-height: 160px !important;
    }
    /* Make input boxes more spaced out in the form */
    .form-group {
        margin-bottom: 20px !important;
    }
"""
if '.hero-buttons' not in content:
    content = content.replace("/* Fit panels inside the screen */", mobile_additions + "\n    /* Fit panels inside the screen */")

with open('/tmp/frontend/frontend/src/index.css', 'w') as f:
    f.write(content)

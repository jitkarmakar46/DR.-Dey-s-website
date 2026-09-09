with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'r') as f:
    lines = f.readlines()

import_line = ""
other_lines = []
for line in lines:
    if line.startswith("@import"):
        import_line = line
    else:
        other_lines.append(line)

final_content = import_line + "".join(other_lines)

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'w') as f:
    f.write(final_content)
with open('/Users/jitkarmakar/Desktop/UPLOAD_THESE_TO_GITHUB/index.css', 'w') as f:
    f.write(final_content)

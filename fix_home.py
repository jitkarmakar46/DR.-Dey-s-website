import re

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'r') as f:
    content = f.read()

# Fix the Top Badges
old_badges = """<div className="trust-badges">
                        <div className="trust-badge">
                            <ShieldCheck size={18} />
                            <span>15+ Years Experience</span>
                        </div>
                        <div className="trust-badge">
                            <Award size={18} />
                            <span>Certified Excellence</span>
                        </div>
                    </div>
                </div>
            </section>"""
new_badges = """<div className="trust-badges">
                        <div className="trust-badge"><ShieldCheck size={20} /> <span>Premium Care</span></div>
                        <div className="trust-badge"><Award size={20} /> <span>Certified Clinic</span></div>
                        <div className="trust-badge"><PhoneCall size={20} /> <span>24/7 Support</span></div>
                    </div>
                </div>
            </section>"""

# It seems the badges might look different. Let's just use regex more carefully, or replace the whole section.
# I will use a regex to replace the entire <div className="trust-badges"> to the closing </section>
content = re.sub(r'<div className="trust-badges">.*?</section>', new_badges, content, flags=re.DOTALL)

# Fix the footer text that might have "Comprehensive Patient Care"
content = content.replace("<Activity size={14} /> Comprehensive Patient Care", "<Activity size={14} /> Premium Care")

# Fix jumping pill: The CSS was overriding transition.
# Ensure `Home.jsx` pill uses smooth transitions inline, or CSS does it.
# Actually, the user says "it must shows an animation to moving in left to right... not jumping".
# If it jumps, it means `transition` is missing from `.nav-pill`.

# Fix Scroll Spy sticking to Home
# Update IntersectionObserver rootMargin
content = content.replace("rootMargin: '-120px 0px -50% 0px'", "rootMargin: '-150px 0px -40% 0px'")
content = content.replace("rootMargin: '-10% 0px -50% 0px'", "rootMargin: '-150px 0px -40% 0px'")

# Write back
with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(content)

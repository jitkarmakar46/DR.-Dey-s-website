with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'r') as f:
    content = f.read()

badges = """
                        {/* Trust Indicators */}
                        <div className="trust-badges">
                            <div className="trust-badge"><ShieldCheck size={20} /> <span>Premium Care</span></div>
                            <div className="trust-badge"><Award size={20} /> <span>Certified Clinic</span></div>
                            <div className="trust-badge"><PhoneCall size={20} /> <span>24/7 Support</span></div>
                        </div>
"""

# Insert it back after hero-buttons
content = content.replace("Check Status</a>\n                        </div>", "Check Status</a>\n                        </div>" + badges)

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(content)

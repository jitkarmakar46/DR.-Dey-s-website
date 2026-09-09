import re

# ================================
# 1. UPDATE HOME.JSX
# ================================
with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'r') as f:
    home_content = f.read()

# Change Navbar Text to be concise so it fits perfectly in equal gaps
home_content = home_content.replace('>Track Status</a>', '>Track</a>')
home_content = home_content.replace('>Book Appointment</a>', '>Book</a>')

# Fix Auto-Typing height to prevent jumping on mobile
home_content = home_content.replace("<h1 style={{ minHeight: '120px' }}>", "<h1 className=\"hero-title\">")

# Fix Tracking ID Box Overflow and add "Copy" text
old_tracking_box = """<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '8px 0', background: 'rgba(2, 132, 199, 0.05)', padding: '8px 16px', borderRadius: '12px', width: 'max-content', marginLeft: 'auto', marginRight: 'auto' }}>
                                            <div style={{ fontSize: '1.75rem', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>{bookingResult.trackingId}</div>
                                            <button type="button" onClick={() => { navigator.clipboard.writeText(bookingResult.trackingId); alert('Tracking ID Copied!'); }} style={{ padding: '8px', background: 'var(--medical-blue)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)' }} title="Copy Tracking ID">
                                                <Copy size={18} />
                                            </button>
                                        </div>"""

new_tracking_box = """<div className="tracking-id-container">
                                            <div className="tracking-id-text">{bookingResult.trackingId}</div>
                                            <button type="button" onClick={() => { navigator.clipboard.writeText(bookingResult.trackingId); alert('Tracking ID Copied!'); }} className="copy-btn">
                                                <Copy size={16} /> <span style={{ marginLeft: '6px', fontSize: '0.9rem', fontWeight: 600 }}>Copy</span>
                                            </button>
                                        </div>"""
home_content = home_content.replace(old_tracking_box, new_tracking_box)

# Fix Trust Badges to be professional and single-line
old_badges_start = '<div className="trust-badges">'
old_badges_end = '</div>\n                </div>\n            </section>'

badges_regex = r'<div className="trust-badges">.*?</section>'
new_badges = """<div className="trust-badges">
                        <div className="trust-badge"><ShieldCheck size={20} /> <span>Premium Care</span></div>
                        <div className="trust-badge"><Award size={20} /> <span>Certified Clinic</span></div>
                        <div className="trust-badge"><PhoneCall size={20} /> <span>24/7 Support</span></div>
                    </div>
                </div>
            </section>"""
home_content = re.sub(badges_regex, new_badges, home_content, flags=re.DOTALL)

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(home_content)


# ================================
# 2. UPDATE INDEX.CSS
# ================================
with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'r') as f:
    css_content = f.read()

# Add styles for the new elements before the media query
new_styles = """
.hero-title {
    min-height: 140px;
}
.tracking-id-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 16px auto;
    background: rgba(2, 132, 199, 0.05);
    padding: 12px 16px;
    border-radius: 12px;
    width: 100%;
    max-width: 340px;
    box-sizing: border-box;
    border: 1px solid rgba(2, 132, 199, 0.1);
}
.tracking-id-text {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.05em;
}
.copy-btn {
    padding: 8px 16px;
    background: var(--medical-blue);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
    transition: all 0.2s ease;
}
.copy-btn:active {
    transform: scale(0.95);
}
"""

css_content = css_content.replace('.hero h1 {', new_styles + '\n.hero h1 {')

# Rewrite the mobile media query
css_content = re.sub(r'/\* ========================================= \*/\n/\* PERFECT MOBILE RESPONSIVENESS.*', '', css_content, flags=re.DOTALL)

new_mobile_block = """/* ========================================= */
/* PERFECT MOBILE RESPONSIVENESS (SMARTPHONES) */
/* ========================================= */
@media (max-width: 768px) {
    /* Prevent tap highlights */
    * { -webkit-tap-highlight-color: transparent !important; }

    /* Kill laggy snap animations */
    html, body, .app-container {
        scroll-snap-type: none !important;
        -webkit-scroll-snap-type: none !important;
        animation: none !important;
        scroll-behavior: smooth !important;
    }

    /* Keep Pill Glass effect but highly optimized */
    .nav-pill {
        display: block !important;
        background: rgba(2, 132, 199, 0.1) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
        border: 1px solid rgba(2, 132, 199, 0.2) !important;
        border-radius: 9999px !important;
        box-shadow: inset 0 2px 4px rgba(255,255,255,0.3), 0 4px 10px rgba(2, 132, 199, 0.1) !important;
    }

    /* Equal distance professional navigation grid */
    .nav-container {
        flex-direction: column;
        height: auto;
        padding: 10px 0 8px 0;
        gap: 12px;
    }
    .nav-links-container {
        width: 100%;
        padding: 0 16px;
        box-sizing: border-box;
    }
    .nav-links {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        width: 100%;
        position: relative;
        gap: 0;
    }
    .nav-links a {
        font-size: 0.85rem !important;
        padding: 10px 0 !important;
        background: transparent !important;
        text-align: center;
        user-select: none !important;
        font-weight: 600;
        z-index: 2;
    }

    /* Fix Auto-Typing height jumping */
    .hero-title {
        min-height: 120px !important;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .hero-title span {
        white-space: nowrap; /* Prevents text from breaking and jumping */
    }

    /* Professional, compact trust badges in one line */
    .trust-badges {
        flex-direction: row !important;
        justify-content: center;
        gap: 16px !important;
        flex-wrap: wrap;
        padding-top: 24px;
        border-top: 1px solid rgba(0,0,0,0.05);
    }
    .trust-badge {
        font-size: 0.8rem !important;
        gap: 6px !important;
    }

    /* Scaling */
    .hero h1 { font-size: 1.8rem !important; }
    .section-title { font-size: 1.6rem !important; margin-bottom: 24px !important; }
    .glass-panel { padding: 24px 16px !important; margin: 0; }
    
    /* Perfect Scroll Margin for anchor links */
    .section, .hero {
        scroll-snap-align: none !important;
        min-height: auto !important;
        padding: 40px 0 !important;
        scroll-margin-top: 120px !important; 
    }

    /* Tracking Box */
    .tracking-id-text { font-size: 1.25rem !important; }
}
"""

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'w') as f:
    f.write(css_content.strip() + '\n\n' + new_mobile_block)


import re

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'r') as f:
    content = f.read()

content = re.sub(r'/\* ========================================= \*/\n/\* PERFECT MOBILE RESPONSIVENESS.*', '', content, flags=re.DOTALL)

new_mobile_block = """/* ========================================= */
/* PERFECT MOBILE RESPONSIVENESS (SMARTPHONES) */
/* ========================================= */
@media (max-width: 768px) {
    /* 0. Prevent grey rectangular selection boxes when tapping */
    * {
        -webkit-tap-highlight-color: transparent !important;
    }

    /* 1. Stop all lag and stuttering */
    html, body, .app-container {
        scroll-snap-type: none !important;
        -webkit-scroll-snap-type: none !important;
        animation: none !important;
        scroll-behavior: smooth !important;
    }
    
    .service-card, .glass-panel, .navbar {
        backdrop-filter: blur(2px) !important;
        -webkit-backdrop-filter: blur(2px) !important;
        background: rgba(255, 255, 255, 0.98) !important;
    }

    /* 2. Navigation bar styling & Fitting all 4 buttons */
    .nav-container {
        flex-direction: column;
        height: auto;
        padding: 10px 0 5px 0;
        gap: 10px;
    }
    .nav-links-container {
        width: 100vw;
        padding: 0 4px;
        box-sizing: border-box;
    }

    .nav-links {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        width: 100%;
        gap: 2px;
        position: relative;
    }
    
    /* 3. The Liquid Glass Pill (Optimized for zero lag) */
    .nav-pill {
        display: block !important;
        /* Removing blur entirely for butter-smooth 60fps sliding on mobile */
        background: rgba(2, 132, 199, 0.12) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid rgba(2, 132, 199, 0.2) !important;
        border-radius: 8px !important;
        box-shadow: none !important;
    }
    .nav-links a {
        font-size: 0.72rem !important; /* Small enough to fit all 4 comfortably */
        padding: 8px 4px !important;
        background: transparent !important;
        border-radius: 8px;
        text-align: center;
        flex: 1;
        user-select: none !important;
        -webkit-user-select: none !important;
        line-height: 1.2;
    }
    .nav-links a.active {
        background: transparent !important;
    }

    /* 4. Fix Cut-off headings when clicking buttons */
    .section, .hero {
        scroll-snap-align: none !important;
        min-height: auto !important;
        padding: 40px 0 !important;
        scroll-margin-top: 100px !important; 
    }

    /* 5. Fit panels inside the screen */
    .hero h1 {
        font-size: 2rem !important;
    }
    .section-title {
        font-size: 1.8rem !important;
        margin-bottom: 30px !important;
    }
    .glass-panel {
        padding: 24px 16px !important;
        margin: 0 10px;
    }
    .services-grid {
        grid-template-columns: 1fr !important;
        gap: 16px !important;
    }
    .trust-badges {
        flex-direction: column;
        align-items: center;
        gap: 16px;
    }
}
"""

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'w') as f:
    f.write(content.strip() + '\n\n' + new_mobile_block)


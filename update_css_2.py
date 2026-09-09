import re

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/index.css', 'r') as f:
    content = f.read()

# Remove the old mobile responsiveness block
content = re.sub(r'/\* ========================================= \*/\n/\* PERFECT MOBILE RESPONSIVENESS.*', '', content, flags=re.DOTALL)

new_mobile_block = """/* ========================================= */
/* PERFECT MOBILE RESPONSIVENESS (SMARTPHONES) */
/* ========================================= */
@media (max-width: 768px) {
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

    /* 2. Navigation bar styling & Hiding Scrollbars */
    .nav-container {
        flex-direction: column;
        height: auto;
        padding: 10px 0;
        gap: 10px;
    }
    .nav-links-container {
        width: 100vw;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 5px;
        /* Hide the ugly grey scrollbar */
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
    }
    .nav-links-container::-webkit-scrollbar {
        display: none !important; /* Hides scrollbar on Chrome/Safari/iOS */
    }

    .nav-links {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap !important;
        justify-content: flex-start;
        width: max-content;
        margin: 0 auto;
        gap: 6px;
        padding: 0 10px;
        position: relative;
    }
    
    /* 3. The Liquid Glass Pill (Restored & Upgraded) */
    .nav-pill {
        display: block !important; /* Bring back the pill! */
        background: linear-gradient(90deg, rgba(2, 132, 199, 0.15), rgba(2, 132, 199, 0.05)) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        border: 1px solid rgba(2, 132, 199, 0.2) !important;
        border-radius: 9999px !important;
        box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 10px rgba(2, 132, 199, 0.1) !important;
    }
    .nav-links a {
        white-space: nowrap;
        font-size: 0.9rem !important;
        padding: 8px 14px !important;
        background: transparent !important; /* Remove individual backgrounds to let pill shine */
        border-radius: 8px;
    }
    .nav-links a.active {
        background: transparent !important; /* Remove individual backgrounds */
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


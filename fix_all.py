import re

# ------------- FIX HOME.JSX -------------
with open('/tmp/clean_home.jsx', 'r') as f:
    home_content = f.read()

# 1. Remove Top Badges completely
home_content = re.sub(
    r'\{/\* Trust Indicators \*/\}.*?<div className="trust-badge">.*?Flexible Timings\n                            </div>\n                        </div>',
    '',
    home_content,
    flags=re.DOTALL
)

# 2. Fix 3-Line Typing
old_typewriter = """const Typewriter = () => {
    const text1 = "Advanced Healthcare,";
    const text2 = "Compassionate Healing.";
    const [currentText1, setCurrentText1] = useState('');
    const [currentText2, setCurrentText2] = useState('');
    const [phase, setPhase] = useState(0);
    const containerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                // Restart animation when scrolled into view
                setCurrentText1('');
                setCurrentText2('');
                setPhase(1);
            }
        }, { threshold: 0.5 });
        
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (phase === 1) {
            if (currentText1.length < text1.length) {
                const timeout = setTimeout(() => {
                    setCurrentText1(text1.slice(0, currentText1.length + 1));
                }, 40); // typing speed
                return () => clearTimeout(timeout);
            } else {
                const pause = setTimeout(() => setPhase(2), 350); // Pause before line 2
                return () => clearTimeout(pause);
            }
        } else if (phase === 2) {
            if (currentText2.length < text2.length) {
                const timeout = setTimeout(() => {
                    setCurrentText2(text2.slice(0, currentText2.length + 1));
                }, 40);
                return () => clearTimeout(timeout);
            }
        }
    }, [currentText1, currentText2, phase]);

    return (
        <div ref={containerRef} style={{ minHeight: '120px' }}>
            <h1 className="hero-title" style={{ margin: 0 }}>
            <span style={{ position: 'relative', display: 'inline-block', color: 'var(--medical-blue)' }}>
                {currentText1}
                {phase === 1 && <span className="typing-cursor"></span>}
                <span style={{ visibility: 'hidden' }}>{text1.slice(currentText1.length)}</span>
            </span>
            <br />
            <span style={{ position: 'relative' }}>
                {currentText2}
                {(phase === 2 || phase === 3) && <span className="typing-cursor"></span>}
                <span style={{ visibility: 'hidden' }}>{text2.slice(currentText2.length)}</span>
            </span>
        </h1>
        </div>
    );
};"""

new_typewriter = """const Typewriter = () => {
    const text1 = "Advanced Healthcare";
    const text2 = "Compassionate";
    const text3 = "Healing";
    const [currentText1, setCurrentText1] = useState('');
    const [currentText2, setCurrentText2] = useState('');
    const [currentText3, setCurrentText3] = useState('');
    const [phase, setPhase] = useState(0);
    const containerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                // Restart animation when scrolled into view
                setCurrentText1('');
                setCurrentText2('');
                setCurrentText3('');
                setPhase(1);
            }
        }, { threshold: 0.5 });
        
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (phase === 1) {
            if (currentText1.length < text1.length) {
                const timeout = setTimeout(() => setCurrentText1(text1.slice(0, currentText1.length + 1)), 40);
                return () => clearTimeout(timeout);
            } else {
                const pause = setTimeout(() => setPhase(2), 350);
                return () => clearTimeout(pause);
            }
        } else if (phase === 2) {
            if (currentText2.length < text2.length) {
                const timeout = setTimeout(() => setCurrentText2(text2.slice(0, currentText2.length + 1)), 40);
                return () => clearTimeout(timeout);
            } else {
                const pause = setTimeout(() => setPhase(3), 350);
                return () => clearTimeout(pause);
            }
        } else if (phase === 3) {
            if (currentText3.length < text3.length) {
                const timeout = setTimeout(() => setCurrentText3(text3.slice(0, currentText3.length + 1)), 40);
                return () => clearTimeout(timeout);
            }
        }
    }, [currentText1, currentText2, currentText3, phase]);

    return (
        <div ref={containerRef} style={{ minHeight: '160px' }}>
            <h1 className="hero-title" style={{ margin: 0 }}>
            <span style={{ display: 'block', color: 'var(--medical-blue)' }}>
                {currentText1}
                {phase === 1 && <span className="typing-cursor"></span>}
            </span>
            <span style={{ display: 'block' }}>
                {currentText2}
                {phase === 2 && <span className="typing-cursor"></span>}
            </span>
            <span style={{ display: 'block' }}>
                {currentText3}
                {phase === 3 && <span className="typing-cursor"></span>}
            </span>
        </h1>
        </div>
    );
};"""

home_content = home_content.replace(old_typewriter, new_typewriter)

# 3. Add dateType state and update input
home_content = home_content.replace("const [formData, setFormData] = useState({", "const [dateType, setDateType] = useState('text');\n    const [formData, setFormData] = useState({")
old_date = """<input type="date" className="form-control" required min={new Date().toISOString().split('T')[0]} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />"""
new_date = """<input type={dateType} placeholder="Select Date" onFocus={() => setDateType('date')} onBlur={(e) => {if(!e.target.value) setDateType('text')}} className="form-control" required min={new Date().toISOString().split('T')[0]} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />"""
home_content = home_content.replace(old_date, new_date)

# 4. Wrap buttons in .hero-buttons so we can style them minimally on mobile
home_content = home_content.replace("<div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>", "<div className=\"hero-buttons\" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>")

with open('/tmp/clean_home.jsx', 'w') as f:
    f.write(home_content)

# ------------- FIX INDEX.CSS -------------
with open('/tmp/clean_index.css', 'r') as f:
    css_content = f.read()

# Remove white bar bounce via overscroll-behavior
css_content = css_content.replace("body {\n    margin: 0;", "body {\n    margin: 0;\n    overscroll-behavior-y: none;\n    background-color: var(--medical-blue-light);")
css_content = css_content.replace("html {\n    scroll-behavior: smooth;", "html {\n    scroll-behavior: smooth;\n    overscroll-behavior-y: none;\n    background-color: var(--medical-blue-light);")

# Update select dropdowns to add gap for arrows
css_content = css_content.replace(".form-control {\n    width: 100%;", "select.form-control {\n    padding-right: 40px;\n    -webkit-appearance: none;\n    -moz-appearance: none;\n    appearance: none;\n    background-image: url('data:image/svg+xml;utf8,<svg fill=\"%23000000\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>');\n    background-repeat: no-repeat;\n    background-position: right 12px center;\n}\n.form-control {\n    width: 100%;")

# Classy, minimal buttons for mobile
mobile_css = """
    .hero-buttons {
        display: flex;
        flex-direction: row !important;
        gap: 12px !important;
        width: 100%;
        justify-content: center;
        margin-bottom: 24px;
    }
    .hero-buttons .btn {
        font-size: 0.85rem !important;
        padding: 10px 18px !important;
        border-radius: 9999px !important;
        flex: 1;
        max-width: 160px;
    }
"""

# Insert mobile_css into the @media (max-width: 768px) block
css_content = css_content.rstrip()
if css_content.endswith('}'):
    css_content = css_content[:-1] + mobile_css + '\n}'

with open('/tmp/clean_index.css', 'w') as f:
    f.write(css_content)


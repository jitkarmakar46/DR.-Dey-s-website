import re

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'r') as f:
    content = f.read()

# 1. Remove Trust Badges Completely
content = re.sub(r'<div className="trust-badges">.*?</div>\s*</div>\s*</div>\s*</section>', '</div>\n                </div>\n            </section>', content, flags=re.DOTALL)

# 2. Update Typing Logic for 3 lines
old_state_vars = """    const text1 = "Advanced Healthcare,";
    const text2 = "Compassionate Healing.";
    const [currentText1, setCurrentText1] = useState('');
    const [currentText2, setCurrentText2] = useState('');
    const [phase, setPhase] = useState(0);"""
new_state_vars = """    const text1 = "Advanced Healthcare";
    const text2 = "Compassionate";
    const text3 = "Healing";
    const [currentText1, setCurrentText1] = useState('');
    const [currentText2, setCurrentText2] = useState('');
    const [currentText3, setCurrentText3] = useState('');
    const [phase, setPhase] = useState(1);
    const [dateType, setDateType] = useState('text');"""
content = content.replace(old_state_vars, new_state_vars)

old_typing_effect = """useEffect(() => {
        if (phase === 1) {
            if (currentText1.length < text1.length) {
                const timeout = setTimeout(() => {
                    setCurrentText1(text1.slice(0, currentText1.length + 1));
                }, 50);
                return () => clearTimeout(timeout);
            } else {
                const timeout = setTimeout(() => setPhase(2), 500);
                return () => clearTimeout(timeout);
            }
        } else if (phase === 2) {
            if (currentText2.length < text2.length) {
                const timeout = setTimeout(() => {
                    setCurrentText2(text2.slice(0, currentText2.length + 1));
                }, 50);
                return () => clearTimeout(timeout);
            }
        }
    }, [currentText1, currentText2, phase]);"""
new_typing_effect = """useEffect(() => {
        if (phase === 1) {
            if (currentText1.length < text1.length) {
                const timeout = setTimeout(() => setCurrentText1(text1.slice(0, currentText1.length + 1)), 50);
                return () => clearTimeout(timeout);
            } else {
                const timeout = setTimeout(() => setPhase(2), 300);
                return () => clearTimeout(timeout);
            }
        } else if (phase === 2) {
            if (currentText2.length < text2.length) {
                const timeout = setTimeout(() => setCurrentText2(text2.slice(0, currentText2.length + 1)), 50);
                return () => clearTimeout(timeout);
            } else {
                const timeout = setTimeout(() => setPhase(3), 300);
                return () => clearTimeout(timeout);
            }
        } else if (phase === 3) {
            if (currentText3.length < text3.length) {
                const timeout = setTimeout(() => setCurrentText3(text3.slice(0, currentText3.length + 1)), 50);
                return () => clearTimeout(timeout);
            }
        }
    }, [currentText1, currentText2, currentText3, phase]);"""
content = content.replace(old_typing_effect, new_typing_effect)

content = content.replace("setCurrentText1('');\n                setCurrentText2('');\n                setPhase(1);", "setCurrentText1('');\n                setCurrentText2('');\n                setCurrentText3('');\n                setPhase(1);")

# Wait, what if the phase reset is:
content = content.replace("setCurrentText1('');\n                setCurrentText2('');\n                setPhase(0);", "setCurrentText1('');\n                setCurrentText2('');\n                setCurrentText3('');\n                setPhase(1);")

old_title = """<h1 className="hero-title">
                            <span style={{ display: 'block', color: 'var(--medical-blue)' }}>{currentText1}</span>
                            <span style={{ display: 'block' }}>{currentText2}<span className="typing-cursor"></span></span>
                        </h1>"""
new_title = """<h1 className="hero-title">
                            <span style={{ display: 'block', color: 'var(--medical-blue)' }}>{currentText1}{phase === 1 && <span className="typing-cursor"></span>}</span>
                            <span style={{ display: 'block' }}>{currentText2}{phase === 2 && <span className="typing-cursor"></span>}</span>
                            <span style={{ display: 'block' }}>{currentText3}{phase === 3 && <span className="typing-cursor"></span>}</span>
                        </h1>"""
content = content.replace(old_title, new_title)

# Hero Buttons styling
content = content.replace("<div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>\n                            <a href=\"#appointment\" className=\"btn btn-primary\">\n                                Schedule Visit <ChevronRight size={16} style={{marginLeft: '6px'}}/>\n                            </a>\n                            <a href=\"#track\" className=\"btn btn-secondary\">Check Status</a>\n                        </div>", "<div className=\"hero-buttons\" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>\n                            <a href=\"#appointment\" className=\"btn btn-primary\">\n                                Schedule Visit <ChevronRight size={16} style={{marginLeft: '6px'}}/>\n                            </a>\n                            <a href=\"#track\" className=\"btn btn-secondary\">Check Status</a>\n                        </div>")

# 3. Date Placeholder Hack
content = content.replace("<input type=\"date\" className=\"form-control\" required min={new Date().toISOString().split('T')[0]} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />", "<input type={dateType} placeholder=\"Select Date\" onFocus={() => setDateType('date')} onBlur={(e) => {if(!e.target.value) setDateType('text')}} className=\"form-control\" required min={new Date().toISOString().split('T')[0]} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />")

# 4. Padding to arrows
content = content.replace("""<option value="" disabled>Select Concern</option>""", """<option value="" disabled>Select Concern &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</option>""")
content = content.replace("""<option value="" disabled>Select Time Slot</option>""", """<option value="" disabled>Select Time Slot &nbsp;&nbsp;&nbsp;&nbsp;</option>""")

# 5. Fix pill selection on mobile Services (Observer rootMargin)
# It's currently rootMargin: '-150px 0px -40% 0px' maybe? Let's verify.
content = re.sub(r"rootMargin:\s*'-?\d+px\s+\d+px\s+-?\d+%\s+\d+px'", "rootMargin: '-160px 0px -60% 0px'", content)

with open('/tmp/frontend/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(content)

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'r') as f:
    c = f.read()

c = c.replace("""<div className="trust-badges">
                        <div className="trust-badge"><ShieldCheck size={20} /> <span>Premium Care</span></div>
                        <div className="trust-badge"><Award size={20} /> <span>Certified Clinic</span></div>
                        <div className="trust-badge"><PhoneCall size={20} /> <span>24/7 Support</span></div>
                    </div>
                </div>
            </section>""",
"""<div className="trust-badges">
                        <div className="trust-badge"><ShieldCheck size={20} /> <span>Premium Care</span></div>
                        <div className="trust-badge"><Award size={20} /> <span>Certified Clinic</span></div>
                        <div className="trust-badge"><PhoneCall size={20} /> <span>24/7 Support</span></div>
                    </div>
                    </div>
                </div>
            </section>""")

with open('/Users/jitkarmakar/Desktop/dilip dey website/frontend/src/pages/Home.jsx', 'w') as f:
    f.write(c)

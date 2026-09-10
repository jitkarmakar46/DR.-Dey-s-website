import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { HeartPulse, Stethoscope, Droplet, Clock, ChevronRight, ChevronDown, Activity, Search, CheckCircle, PhoneCall, ShieldCheck, Award, Copy, X } from 'lucide-react';

const Typewriter = () => {
    const text1 = "Advanced";
    const text2 = "Healthcare,";
    const text3 = "Compassionate";
    const text4 = "Healing.";
    const [currentText1, setCurrentText1] = useState('');
    const [currentText2, setCurrentText2] = useState('');
    const [currentText3, setCurrentText3] = useState('');
    const [currentText4, setCurrentText4] = useState('');
    const [phase, setPhase] = useState(1);
    const containerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setCurrentText1('');
                setCurrentText2('');
                setCurrentText3('');
                setCurrentText4('');
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
                const pause = setTimeout(() => setPhase(2), 250);
                return () => clearTimeout(pause);
            }
        } else if (phase === 2) {
            if (currentText2.length < text2.length) {
                const timeout = setTimeout(() => setCurrentText2(text2.slice(0, currentText2.length + 1)), 40);
                return () => clearTimeout(timeout);
            } else {
                const pause = setTimeout(() => setPhase(3), 250);
                return () => clearTimeout(pause);
            }
        } else if (phase === 3) {
            if (currentText3.length < text3.length) {
                const timeout = setTimeout(() => setCurrentText3(text3.slice(0, currentText3.length + 1)), 40);
                return () => clearTimeout(timeout);
            } else {
                const pause = setTimeout(() => setPhase(4), 250);
                return () => clearTimeout(pause);
            }
        } else if (phase === 4) {
            if (currentText4.length < text4.length) {
                const timeout = setTimeout(() => setCurrentText4(text4.slice(0, currentText4.length + 1)), 40);
                return () => clearTimeout(timeout);
            } else {
                setPhase(5);
            }
        }
    }, [currentText1, currentText2, currentText3, currentText4, phase]);

    return (
        <h1 ref={containerRef}>
            <span style={{ display: 'block', position: 'relative' }}>
                {currentText1}
                {phase === 1 && <span className="typing-cursor"></span>}
                <span style={{ visibility: 'hidden' }}>{text1.slice(currentText1.length)}</span>
            </span>
            <span style={{ display: 'block', position: 'relative' }}>
                {currentText2}
                {phase === 2 && <span className="typing-cursor"></span>}
                <span style={{ visibility: 'hidden' }}>{text2.slice(currentText2.length)}</span>
            </span>
            <span style={{ display: 'block', position: 'relative' }}>
                {currentText3}
                {phase === 3 && <span className="typing-cursor"></span>}
                <span style={{ visibility: 'hidden' }}>{text3.slice(currentText3.length)}</span>
            </span>
            <span style={{ display: 'block', position: 'relative' }}>
                {currentText4}
                {(phase === 4 || phase === 5) && <span className="typing-cursor"></span>}
                <span style={{ visibility: 'hidden' }}>{text4.slice(currentText4.length)}</span>
            </span>
        </h1>
    );
};


export default function Home() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        department: '', date: '', time: '', patientName: '', phone: ''
    });
        const [bookingResult, setBookingResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Tracking States
    const [trackId, setTrackId] = useState('');
    const [trackResult, setTrackResult] = useState(null);
    const [trackError, setTrackError] = useState('');

    // Navigation Pill State
    useEffect(() => {
        document.title = "Dey's Clinic";
        // Warm up backend server in background immediately on page load
        
    }, []);

    const [activeSection, setActiveSection] = useState('home');
    const [pillStyle, setPillStyle] = useState({ opacity: 0, width: 0, x: 0 });
    const [mobilePillStyle, setMobilePillStyle] = useState({ opacity: 0, width: 0, x: 0 });
    const navLinksRef = useRef(null);   // desktop nav
    const mobileNavRef = useRef(null);  // mobile bottom nav
    const isNavClickingRef = useRef(false);
    const navClickTimerRef = useRef(null);

    const handleNavClick = (sectionKey) => {
        setActiveSection(sectionKey);
        isNavClickingRef.current = true;
        if (navClickTimerRef.current) clearTimeout(navClickTimerRef.current);
        navClickTimerRef.current = setTimeout(() => {
            isNavClickingRef.current = false;
        }, 800);
        const el = document.getElementById(sectionKey);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Update BOTH desktop + mobile pill positions whenever activeSection changes
    useEffect(() => {
        const updatePill = () => {
            // Desktop pill (top-right nav)
            if (navLinksRef.current) {
                const link = navLinksRef.current.querySelector(`[data-nav="${activeSection}"]`);
                if (link && link.offsetWidth > 0) {
                    setPillStyle({ width: link.offsetWidth, x: link.offsetLeft, opacity: 1 });
                }
            }
            // Mobile pill (bottom nav)
            if (mobileNavRef.current) {
                const mLink = mobileNavRef.current.querySelector(`[data-nav="${activeSection}"]`);
                if (mLink && mLink.offsetWidth > 0) {
                    setMobilePillStyle({ width: mLink.offsetWidth, x: mLink.offsetLeft, opacity: 1 });
                }
            }
        };

        const raf = requestAnimationFrame(updatePill);
        window.addEventListener('resize', updatePill);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(updatePill);
        }

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', updatePill);
        };
    }, [activeSection]);

    // Scroll Spy — ignores observer changes during manual direct tab jumps
    useEffect(() => {
        const sections = document.querySelectorAll('.section, #home');

        const observer = new IntersectionObserver((entries) => {
            if (isNavClickingRef.current) return; // Prevent double-bouncing during jumps
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    const navKey = id === 'appointment' ? 'appointment' : id;
                    setActiveSection(prev => prev === navKey ? prev : navKey);
                }
            });
        }, {
            threshold: 0.35,
            rootMargin: '0px 0px 0px 0px'
        });

        sections.forEach(s => observer.observe(s));
        return () => observer.disconnect();
    }, []);

    const handleNext = () => {
        if (!formData.department || !formData.date || !formData.time) {
            alert('Please select Department, Date, and Time to proceed.');
            return;
        }
        // Warm up backend in advance before step 2 submit
        
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const sanitizedPhone = formData.phone.replace(/\D/g, '');

        if (sanitizedPhone.length !== 10) {
            alert('Please enter a valid 10-digit mobile number.');
            setIsSubmitting(false);
            return;
        }

        try {
            const bookingCreatedAt = new Date().toISOString();
            const payload = {
                ...formData,
                phone: sanitizedPhone,
                createdAt: bookingCreatedAt
            };
            const response = await axios.post('https://doctor-s-backend-2.onrender.com/api/appointments', payload);
            const newTrackId = response.data.trackingId;

            setBookingResult({
                name: formData.patientName,
                trackingId: newTrackId
            });

            // Save tracking ID and lock timestamp in local storage
            setTrackId(newTrackId);
            localStorage.setItem('savedTrackId', newTrackId);
            
            const savedTimestamps = JSON.parse(localStorage.getItem('clinic_booking_timestamps') || '{}');
            savedTimestamps[newTrackId] = bookingCreatedAt;
            localStorage.setItem('clinic_booking_timestamps', JSON.stringify(savedTimestamps));

            // Sync directly with admin appointments cache so it appears immediately
            try {
                const adminCache = JSON.parse(localStorage.getItem('admin_appointments_cache') || '[]');
                const newBookingItem = {
                    id: response.data.appointmentId || Date.now(),
                    trackingId: newTrackId,
                    patientName: formData.patientName,
                    phone: sanitizedPhone,
                    department: formData.department,
                    date: formData.date,
                    time: formData.time,
                    status: 'Pending',
                    createdAt: bookingCreatedAt
                };
                if (!adminCache.some(item => item.trackingId === newTrackId)) {
                    adminCache.push(newBookingItem);
                    localStorage.setItem('admin_appointments_cache', JSON.stringify(adminCache));
                }
            } catch (e) {}

            // Fetch initial status
            axios.get(`https://doctor-s-backend-2.onrender.com/api/appointments/track/${newTrackId}`)
                .then(res => setTrackResult(res.data.appointment))
                .catch(() => {});

            setStep(3);
        } catch (error) {
            const serverErr = error.response?.data?.error || '';
            if (error.response?.status === 429 || serverErr.includes('Too many requests')) {
                // If rate limited, wait 1 second and retry once
                await new Promise(res => setTimeout(res, 1000));
                try {
                    const retryResp = await axios.post('https://doctor-s-backend-2.onrender.com/api/appointments', payload);
                    const newTrackId = retryResp.data.trackingId;
                    setBookingResult({ name: formData.patientName, trackingId: newTrackId });
                    setTrackId(newTrackId);
                    localStorage.setItem('savedTrackId', newTrackId);
                    setStep(3);
                    return;
                } catch (rErr) {
                    alert('Booking received! Please save your details.');
                    setStep(3);
                    return;
                }
            }
            alert(serverErr || 'Error booking appointment. Please check your inputs.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Restore saved tracking ID from localStorage on mount (fetch status, but keep input empty for clean placeholder)
    useEffect(() => {
        const saved = localStorage.getItem('savedTrackId');
        if (saved) {
            axios.get(`https://doctor-s-backend-2.onrender.com/api/appointments/track/${saved}`)
                .then(res => {
                    if (res.data && res.data.appointment) {
                        setTrackResult(res.data.appointment);
                    }
                })
                .catch(() => {});
        }
    }, []);

    // Live Real-Time Auto-Poll Tracking Status (Polls every 3s so status updates without refresh)
    useEffect(() => {
        if (!trackId || trackId.trim().length < 5) return;

        const pollLiveStatus = async () => {
            try {
                const res = await axios.get(`https://doctor-s-backend-2.onrender.com/api/appointments/track/${trackId.trim()}`);
                if (res.data && res.data.appointment) {
                    setTrackResult(res.data.appointment);
                    setTrackError('');
                }
            } catch (err) {
                // keep current status on transient error
            }
        };

        const interval = setInterval(pollLiveStatus, 30000);
        return () => clearInterval(interval);
    }, [trackId]);

    const handleTrack = async (e) => {
        if (e) e.preventDefault();
        const cleanId = trackId.trim().toUpperCase();
        if (!cleanId) return;
        setTrackError('');
        try {
            const response = await axios.get(`https://doctor-s-backend-2.onrender.com/api/appointments/track/${cleanId}`);
            setTrackResult(response.data.appointment);
            localStorage.setItem('savedTrackId', cleanId);
        } catch (err) {
            setTrackError('Could not find an appointment with that Tracking ID.');
            setTrackResult(null);
        }
    };

    const resetForm = () => {
        setFormData({ department: '', date: '', time: '', patientName: '', phone: '' });
        setStep(1);
        setBookingResult(null);
    };

    const getStatusStyle = (status) => {
        switch(status) {
            case 'Confirmed': return { backgroundColor: 'rgba(230, 244, 234, 0.8)', color: '#137333', border: '1px solid #ceead6' };
            case 'Completed': return { backgroundColor: 'rgba(232, 240, 254, 0.8)', color: '#1a73e8', border: '1px solid #d2e3fc' };
            case 'Cancelled': return { backgroundColor: 'rgba(252, 232, 230, 0.8)', color: '#c5221f', border: '1px solid #fad2cf' };
            default: return { backgroundColor: 'rgba(254, 247, 224, 0.8)', color: '#b06000', border: '1px solid #feefc3' };
        }
    };

    return (
        <div>

            

            {/* ——— TOP HEADER: centered logo + desktop nav right ——— */}
            <header className="top-header">
                {/* Logo — centered on mobile, left on desktop */}
                <Link to="/" className="logo logo-centered">
                    <Activity size={24} color="var(--medical-blue)" />
                    <span>Dilip Dey Clinic</span>
                </Link>
                {/* Desktop-only nav (hidden on mobile) */}
                <nav className="desktop-nav" ref={navLinksRef}>
                    <div
                        className="nav-pill"
                        style={{
                            opacity: pillStyle.opacity,
                            width: pillStyle.width + 'px',
                            transform: `translateX(${pillStyle.x}px)`
                        }}
                    />
                    <a href="#home" data-nav="home" className={activeSection === 'home' ? 'active' : ''} onClick={() => handleNavClick('home')}>Home</a>
                    <a href="#services" data-nav="services" className={activeSection === 'services' ? 'active' : ''} onClick={() => handleNavClick('services')}>Services</a>
                    <a href="#track" data-nav="track" className={activeSection === 'track' ? 'active' : ''} onClick={() => handleNavClick('track')}>Track</a>
                    <a href="#appointment" data-nav="appointment" className={activeSection === 'appointment' ? 'active' : ''} onClick={() => handleNavClick('appointment')}>Book</a>
                </nav>
            </header>

            {/* ——— HERO / HOME SECTION ——— */}
            <section id="home" className="hero">
                <div className="container">
                    <div className="hero-content">
                        <Typewriter />
                        <p>Expert general medicine for over 15&nbsp;years. Truly personalised care, always.</p>
                        <div className="hero-buttons">
                            <a href="#appointment" className="btn btn-primary" onClick={() => handleNavClick('appointment')}>
                                Schedule Visit
                            </a>
                            <a href="#track" className="btn btn-primary btn-filled" onClick={() => handleNavClick('track')}>Check Status</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ——— BOTTOM TAB BAR — high contrast with icons & bold text ——— */}
            <nav className="bottom-nav" ref={mobileNavRef}>
                <div
                    className="nav-pill"
                    style={{
                        opacity: mobilePillStyle.opacity,
                        width: mobilePillStyle.width + 'px',
                        transform: `translateX(${mobilePillStyle.x}px)`
                    }}
                />
                <a href="#home" data-nav="home" className={activeSection === 'home' ? 'active' : ''} onClick={() => handleNavClick('home')}>
                    <Activity size={18} className="tab-icon" />
                    <span className="tab-label">Home</span>
                </a>
                <a href="#services" data-nav="services" className={activeSection === 'services' ? 'active' : ''} onClick={() => handleNavClick('services')}>
                    <Stethoscope size={18} className="tab-icon" />
                    <span className="tab-label">Services</span>
                </a>
                <a href="#track" data-nav="track" className={activeSection === 'track' ? 'active' : ''} onClick={() => handleNavClick('track')}>
                    <Search size={18} className="tab-icon" />
                    <span className="tab-label">Track</span>
                </a>
                <a href="#appointment" data-nav="appointment" className={activeSection === 'appointment' ? 'active' : ''} onClick={() => handleNavClick('appointment')}>
                    <Clock size={18} className="tab-icon" />
                    <span className="tab-label">Book</span>
                </a>
            </nav>

            {/* Services Section */}
            <section id="services" className="section">
                <div className="container">
                    <h2 className="section-title">Clinical Services<span className="title-dot">.</span></h2>
                    <div className="services-grid">
                        <div className="service-card clinical-card">
                            <div className="service-icon">
                                <Stethoscope size={32} />
                            </div>
                            <h3>General Checkup</h3>
                            <p>Routine physical examinations and comprehensive health assessments for your absolute peace of mind.</p>
                        </div>
                        <div className="service-card clinical-card">
                            <div className="service-icon">
                                <Activity size={32} />
                            </div>
                            <h3>Fever & Infections</h3>
                            <p>Rapid medical diagnosis and effective prescription treatments for viral and bacterial ailments.</p>
                        </div>
                        <div className="service-card clinical-card">
                            <div className="service-icon">
                                <Droplet size={32} />
                            </div>
                            <h3>Diabetes Care</h3>
                            <p>Continuous clinical monitoring and personalized lifestyle consultations to balance your vitals.</p>
                        </div>
                        <div className="service-card clinical-card">
                            <div className="service-icon">
                                <HeartPulse size={32} />
                            </div>
                            <h3>Hypertension</h3>
                            <p>Proactive blood pressure control with regular check-ins and expert cardiovascular reviews.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tracking Section */}
            <section id="track" className="section" style={{ borderTop: 'none' }}>
                <div className="container">
                    <h2 className="section-title">Track Status<span className="title-dot">.</span></h2>
                    <div className="glass-panel clinical-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <h2 style={{ marginBottom: !trackResult ? '12px' : '6px', color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>Track Appointment</h2>
                        {!trackResult ? (
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontWeight: 500, fontSize: '0.96rem', lineHeight: '1.5' }}>
                                Enter your secure tracking ID to instantly view your real-time consultation status.
                            </p>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '14px', fontWeight: 500, fontSize: '0.85rem' }}>
                                Real-time consultation details for ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{trackResult.trackingId || trackId}</strong>
                            </p>
                        )}
                        
                        {trackError && (
                            <div className="clinical-card" style={{ color: '#c5221f', padding: '14px 18px', border: '1px solid #fad2cf', background: 'rgba(252, 232, 230, 0.8)', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 600, marginBottom: '16px' }}>
                                {trackError}
                            </div>
                        )}
                        
                        {!trackResult ? (
                            <form onSubmit={handleTrack} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <input 
                                    type="text" 
                                    className="form-control tracking-input" 
                                    placeholder="e.g. DEY-A1B2C" 
                                    value={trackId}
                                    onChange={e => setTrackId(e.target.value.toUpperCase())}
                                    required 
                                    style={{ width: '100%', textAlign: 'center', fontSize: '1.05rem', letterSpacing: '0.06em' }}
                                />
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', gap: '8px' }}><Search size={18} /> Track Status</button>
                            </form>
                        ) : (
                            <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--medical-green)', background: 'rgba(5, 150, 105, 0.08)', padding: '4px 10px', borderRadius: '50px' }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--medical-green)' }}></span>
                                        Live Status
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => { setTrackResult(null); setTrackError(''); }}
                                        style={{ background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '50px', padding: '4px 12px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <X size={12} /> New Search
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient</div>
                                        <h4 style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{trackResult.patientName}</h4>
                                    </div>
                                    <span className="status-badge" style={{ ...getStatusStyle(trackResult.status), padding: '4px 12px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {trackResult.status}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>Scheduled Date</span>
                                        <strong style={{ color: '#0f172a', fontWeight: 700 }}>📅 {trackResult.date}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>Consultation Slot</span>
                                        <strong style={{ color: '#0f172a', fontWeight: 700 }}>🕒 {trackResult.time}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600 }}>Medical Concern</span>
                                        <strong style={{ color: '#0284c7', fontWeight: 700 }}>🏥 {trackResult.department}</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Booking Section */}
            <section id="appointment" className="section" style={{ borderTop: 'none' }}>
                <div className="container">
                    <h2 className="section-title">Book Consultation<span className="title-dot">.</span></h2>
                    <div className="glass-panel clinical-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <form onSubmit={handleSubmit}>
                            {step === 1 && (
                                <div>
                                    <div className="form-group">
                                        <label>Medical Department</label>
                                        <div style={{ position: 'relative' }}>
                                            <select 
                                                className="form-control" 
                                                required 
                                                value={formData.department} 
                                                onChange={e => setFormData({...formData, department: e.target.value})}
                                                style={{ paddingRight: '42px', appearance: 'none', WebkitAppearance: 'none' }}
                                            >
                                                <option value="" disabled>Select Concern ▾</option>
                                                <option value="General Checkup">General Checkup</option>
                                                <option value="Fever">Fever / Infection</option>
                                                <option value="Diabetes">Diabetes Follow-up</option>
                                            </select>
                                            <ChevronDown size={18} color="#0077b6" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Preferred Date</label>
                                        <div style={{ position: 'relative' }}>
                                            <input 
                                                type="date" 
                                                className={`form-control ${!formData.date ? "date-placeholder" : ""}`} 
                                                required 
                                                min={new Date().toISOString().split('T')[0]} 
                                                value={formData.date} 
                                                onChange={e => setFormData({...formData, date: e.target.value})}
                                                style={{ paddingRight: '42px' }} 
                                            />
                                            <ChevronDown size={18} color="#0077b6" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Preferred Time Slot</label>
                                        <div style={{ position: 'relative' }}>
                                            <select 
                                                className="form-control" 
                                                required 
                                                value={formData.time} 
                                                onChange={e => setFormData({...formData, time: e.target.value})}
                                                style={{ paddingRight: '42px', appearance: 'none', WebkitAppearance: 'none' }}
                                            >
                                                <option value="" disabled>Select Time Slot ▾</option>
                                                <option value="Morning">Morning (10:00 AM - 1:00 PM)</option>
                                                <option value="Evening">Evening (6:00 PM - 9:00 PM)</option>
                                            </select>
                                            <ChevronDown size={18} color="#0077b6" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={handleNext}>Proceed to Details</button>
                                </div>
                            )}

                            {step === 2 && (
                                <div>
                                    <div className="form-group">
                                        <label>Patient Full Name</label>
                                        <input type="text" className="form-control" placeholder="E.g. John Doe" required value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label>Contact Number</label>
                                        <input type="tel" className="form-control" placeholder="10-digit mobile number" pattern="[0-9]{10}" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                                        <button type="button" className="btn btn-secondary" style={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center' }} onClick={() => setStep(1)}>Back</button>
                                        <button type="submit" className="btn btn-primary" style={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center' }} disabled={isSubmitting}>
                                            {isSubmitting ? 'Processing...' : 'Confirm'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && bookingResult && (
                                <div style={{ textAlign: 'center', padding: '4px 0' }}>
                                    <CheckCircle size={40} color="var(--medical-green)" style={{ margin: '0 auto 10px' }} />
                                    <h3 style={{ marginBottom: '6px', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Request Received</h3>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '14px', fontSize: '0.86rem', lineHeight: 1.4 }}>
                                        Thank you, {bookingResult.name}. Our clinic has received your request.
                                    </p>
                                    
                                    <div className="tracker-box" style={{ padding: '14px 12px', margin: '0 auto 16px', borderRadius: '16px' }}>
                                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--medical-blue)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                                            Your Tracking ID
                                        </div>
                                        <div className="tracking-id-container" style={{ margin: '0 auto', padding: '10px 14px', maxWidth: '320px', width: '100%', gap: '8px' }}>
                                            <div className="tracking-id-text" style={{ fontSize: '1.25rem', letterSpacing: '0.05em' }}>{bookingResult.trackingId}</div>
                                            <button type="button" onClick={() => { navigator.clipboard.writeText(bookingResult.trackingId); alert('Tracking ID Copied!'); }} className="copy-btn" style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Copy size={14} /> Copy
                                            </button>
                                        </div>
                                    </div>

                                    <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        style={{ width: '100%', padding: '12px 0', fontSize: '0.84rem', fontWeight: 700, borderRadius: '50px' }} 
                                        onClick={resetForm}
                                    >
                                        Book Another Visit
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </section>

            <footer className="footer">
                <div className="container">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Activity size={24} color="var(--medical-blue)" />
                        <h2 style={{ margin: 0 }}>Dilip Dey Clinic</h2>
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>Advanced General Medicine & Diagnostics</p>
                    <p style={{ color: 'var(--text-tertiary)', marginTop: '48px', fontSize: '0.85rem' }}>&copy; 2026 Dr. Dilip Dey Clinic. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

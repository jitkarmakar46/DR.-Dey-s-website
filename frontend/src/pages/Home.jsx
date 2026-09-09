import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { HeartPulse, Stethoscope, Droplet, Clock, ChevronRight, Activity, Search, CheckCircle, PhoneCall, ShieldCheck, Award, Copy } from 'lucide-react';

const Typewriter = () => {
    const text1 = "Advanced Healthcare";
    const text2 = "Compassionate";
    const text3 = "Healing";
    const [currentText1, setCurrentText1] = useState('');
    const [currentText2, setCurrentText2] = useState('');
    const [currentText3, setCurrentText3] = useState('');
    const [phase, setPhase] = useState(1);
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
            } else {
                setPhase(3); // Done typing
            }
        }
    }, [currentText1, currentText2, phase]);

    // Render using hidden text to maintain exact height and prevent jumping layout shifts
    return (
        <h1 ref={containerRef}>
            <span style={{ position: 'relative' }}>
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
    );
};

export default function Home() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        department: '', date: '', time: '', patientName: '', phone: ''
    });
    const [dateType, setDateType] = useState('text');
    const [bookingResult, setBookingResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Tracking States
    const [trackId, setTrackId] = useState('');
    const [trackResult, setTrackResult] = useState(null);
    const [trackError, setTrackError] = useState('');

    // Navigation Pill State
    useEffect(() => {
        document.title = "Dey's";
    }, []);

    const [activeSection, setActiveSection] = useState('home');
    const [pillStyle, setPillStyle] = useState({ opacity: 0, width: 0, x: 0 });
    const navLinksRef = useRef(null);

    // Update active nav pill position
    useEffect(() => {
        if (!navLinksRef.current) return;
        const activeLink = navLinksRef.current.querySelector(`[data-nav="${activeSection}"]`);
        if (activeLink) {
            setPillStyle({
                width: activeLink.offsetWidth,
                x: activeLink.offsetLeft,
                opacity: 1
            });
        }
    }, [activeSection]);

    // Scroll Spy
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        }, { threshold: 0.3, rootMargin: '-160px 0px -60% 0px' });

        document.querySelectorAll('.section, #home').forEach(section => {
            observer.observe(section);
        });

        return () => observer.disconnect();
    }, []);

    // Update pill position when activeSection changes
    useEffect(() => {
        if (!navLinksRef.current) return;
        if (!activeSection) {
            setPillStyle({ opacity: 0, width: 0, x: 0 });
            return;
        }
        
        const activeLink = navLinksRef.current.querySelector(`[data-nav="${activeSection}"]`);
        if (activeLink) {
            setPillStyle({
                opacity: 1,
                width: activeLink.offsetWidth,
                x: activeLink.offsetLeft
            });
        }
    }, [activeSection]);

    const handleNext = () => {
        if (!formData.department || !formData.date || !formData.time) {
            alert('Please select Department, Date, and Time to proceed.');
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await axios.post('https://doctor-s-backend-2.onrender.com/api/appointments', formData);
            setBookingResult({
                name: formData.patientName,
                trackingId: response.data.trackingId
            });
            setStep(3);
        } catch (error) {
            alert(error.response?.data?.error || 'Error booking appointment. Please check your inputs.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTrack = async (e) => {
        e.preventDefault();
        if (!trackId) return;
        setTrackError('');
        setTrackResult(null);
        try {
            const response = await axios.get(`https://doctor-s-backend-2.onrender.com/api/appointments/track/${trackId}`);
            setTrackResult(response.data.appointment);
        } catch (err) {
            setTrackError('Could not find an appointment with that Tracking ID.');
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

            

            {/* Navbar */}
            <header className="navbar">
                <div className="container nav-container">
                    <Link to="/" className="logo">
                        <Activity size={28} color="var(--medical-blue)" />
                        Dilip Dey Clinic
                    </Link>
                    
                    <div className="nav-links-container">
                        <nav className="nav-links" ref={navLinksRef}>
                            <a href="#home" data-nav="home" className={activeSection === 'home' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveSection('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Home</a>
                            <a href="#services" data-nav="services" className={activeSection === 'services' ? 'active' : ''} onClick={() => setActiveSection('services')}>Services</a>
                            <a href="#track" data-nav="track" className={activeSection === 'track' ? 'active' : ''} onClick={() => setActiveSection('track')}>Track</a>
                            <a href="#appointment" data-nav="appointment" className={activeSection === 'appointment' ? 'active' : ''} onClick={() => setActiveSection('appointment')}>Book</a>
                        </nav>
                        
                        {/* The Animated Glass Pill */}
                        <div 
                            className="nav-pill" 
                            style={{ 
                                opacity: pillStyle.opacity, 
                                width: pillStyle.width, 
                                transform: `translateX(${pillStyle.x}px)` 
                            }} 
                        />
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section id="home" className="hero">
                <div className="container">
                    <div className="hero-content">
                        <Typewriter />
                        <p>Providing expert general medicine for over 15 years. Schedule a consultation and experience truly personalized medical attention.</p>
                        <div className="hero-buttons" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <a href="#appointment" className="btn btn-primary">
                                Schedule Visit <ChevronRight size={16} style={{marginLeft: '6px'}}/>
                            </a>
                            <a href="#track" className="btn btn-secondary">Check Status</a>
                        </div>
                            </div></div></section>

            {/* Services Section */}
            <section id="services" className="section">
                <div className="container">
                    <h2 className="section-title">Clinical Services</h2>
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
                    <h2 className="section-title">Track Status</h2>
                    <div className="glass-panel clinical-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 600 }}>Track Appointment</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontWeight: 400 }}>Enter your Tracking ID below to verify if your consultation has been confirmed by our staff.</p>
                        
                        <form onSubmit={handleTrack} style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="e.g. DEY-A1B2C" 
                                value={trackId}
                                onChange={e => setTrackId(e.target.value.toUpperCase())}
                                required 
                                style={{ flex: 1 }}
                            />
                            <button type="submit" className="btn btn-primary"><Search size={18} /></button>
                        </form>

                        {trackError && <div className="clinical-card" style={{ color: '#c5221f', padding: '16px', border: '1px solid #fad2cf', background: 'rgba(252, 232, 230, 0.8)', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500 }}>{trackError}</div>}
                        
                        {trackResult && (
                            <div className="clinical-card" style={{ padding: '32px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{trackResult.patientName}</h4>
                                    <span className="status-badge" style={getStatusStyle(trackResult.status)}>{trackResult.status}</span>
                                </div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}><span>Date</span> <strong style={{color: 'var(--text-primary)'}}>{trackResult.date}</strong></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}><span>Time</span> <strong style={{color: 'var(--text-primary)'}}>{trackResult.time}</strong></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Department</span> <strong style={{color: 'var(--text-primary)'}}>{trackResult.department}</strong></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Booking Section */}
            <section id="appointment" className="section" style={{ borderTop: 'none' }}>
                <div className="container">
                    <h2 className="section-title">Book Consultation</h2>
                    <div className="glass-panel clinical-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <form onSubmit={handleSubmit}>
                            {step === 1 && (
                                <div>
                                    <div className="form-group">
                                        <label>Medical Department</label>
                                        <select className="form-control" required value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                                            <option value="" disabled>Select Concern &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</option>
                                            <option value="General Checkup">General Checkup</option>
                                            <option value="Fever">Fever / Infection</option>
                                            <option value="Diabetes">Diabetes Follow-up</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Preferred Date</label>
                                        <input type={dateType} placeholder="Select Date" onFocus={() => setDateType('date')} onBlur={(e) => {if(!e.target.value) setDateType('text')}} className="form-control" required min={new Date().toISOString().split('T')[0]} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label>Preferred Time Slot</label>
                                        <select className="form-control" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})}>
                                            <option value="" disabled>Select Time Slot &nbsp;&nbsp;&nbsp;&nbsp;</option>
                                            <option value="Morning">Morning (10:00 AM - 1:00 PM)</option>
                                            <option value="Evening">Evening (6:00 PM - 9:00 PM)</option>
                                        </select>
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
                                        <input type="tel" className="form-control" placeholder="10-digit mobile number" pattern="[0-9]{10}" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
                                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isSubmitting}>
                                            {isSubmitting ? 'Processing...' : 'Confirm Appointment'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && bookingResult && (
                                <div style={{ textAlign: 'center' }}>
                                    <CheckCircle size={48} color="var(--medical-green)" style={{ margin: '0 auto 24px' }} />
                                    <h3 style={{ marginBottom: '16px', fontSize: '1.25rem', fontWeight: 600 }}>Request Received</h3>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Thank you, {bookingResult.name}. Our clinic has received your request.</p>
                                    
                                    <div className="tracker-box">
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--medical-blue)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Tracking ID</div>
                                        <div className="tracking-id-container">
                                            <div className="tracking-id-text">{bookingResult.trackingId}</div>
                                            <button type="button" onClick={() => { navigator.clipboard.writeText(bookingResult.trackingId); alert('Tracking ID Copied!'); }} className="copy-btn">
                                                <Copy size={16} /> <span style={{ marginLeft: '6px', fontSize: '0.9rem', fontWeight: 600 }}>Copy</span>
                                            </button>
                                        </div>
                                    </div>

                                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '32px' }} onClick={resetForm}>Book Another Visit</button>
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

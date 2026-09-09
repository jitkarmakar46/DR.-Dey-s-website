import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, Search, Download, CheckCircle, Clock, Activity, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
    useEffect(() => {
        document.title = "Admin's Page";
    }, []);

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    
    // UI States
    const [activeTab, setActiveTab] = useState('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const fetchAppointments = useCallback(async () => {
        try {
            const res = await axios.get('https://doctor-s-backend-2.onrender.com/api/appointments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAppointments(res.data.appointments);
            setError(null);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                handleLogout();
            } else {
                setError('Failed to load appointments. Is the backend running?');
            }
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchAppointments();
        }
    }, [token, fetchAppointments]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('https://doctor-s-backend-2.onrender.com/api/login', { password });
            const jwtToken = res.data.token;
            setToken(jwtToken);
            localStorage.setItem('adminToken', jwtToken);
            setLoginError('');
        } catch (err) {
            setLoginError('Incorrect password or server error');
        }
    };

    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem('adminToken');
    };

    const updateStatus = async (id, status) => {
        try {
            await axios.put(`https://doctor-s-backend-2.onrender.com/api/appointments/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAppointments(); // Refresh data
        } catch (err) {
            if (err.response && err.response.status === 401) {
                handleLogout();
            } else {
                alert('Error updating status');
            }
        }
    };

    const deleteAppointment = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this appointment log? This cannot be undone.')) return;
        try {
            await axios.delete(`https://doctor-s-backend-2.onrender.com/api/appointments/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAppointments(); // Refresh data
        } catch (err) {
            if (err.response && err.response.status === 401) {
                handleLogout();
            } else {
                alert('Error deleting appointment');
            }
        }
    };

    // --- Derived Data & Analytics ---
    const todayStr = new Date().toISOString().split('T')[0];
    
    const stats = useMemo(() => {
        const todayCount = appointments.filter(a => a.date === todayStr).length;
        const pendingCount = appointments.filter(a => a.status === 'Pending').length;
        const uniquePatients = new Set(appointments.map(a => a.phone)).size;
        return { todayCount, pendingCount, uniquePatients, total: appointments.length };
    }, [appointments, todayStr]);

    const uniquePatientsList = useMemo(() => {
        const map = new Map();
        appointments.forEach(app => {
            if (!map.has(app.phone)) {
                map.set(app.phone, { name: app.patientName, phone: app.phone, visits: 1, lastVisit: app.date });
            } else {
                const p = map.get(app.phone);
                p.visits += 1;
                if (new Date(app.date) > new Date(p.lastVisit)) p.lastVisit = app.date;
            }
        });
        return Array.from(map.values());
    }, [appointments]);

    const filteredAppointments = useMemo(() => {
        return appointments.filter(app => {
            const matchesSearch = app.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  app.phone.includes(searchTerm);
            const matchesFilter = statusFilter === 'All' || app.status === statusFilter;
            return matchesSearch && matchesFilter;
        });
    }, [appointments, searchTerm, statusFilter]);

    // --- Export Functionality ---
    const exportToCSV = () => {
        const headers = ['Date', 'Time', 'Patient Name', 'Phone', 'Department', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredAppointments.map(a => `"${a.date}","${a.time}","${a.patientName}","${a.phone}","${a.department}","${a.status}"`)
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `appointments_export_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusStyle = (status) => {
        switch(status) {
            case 'Confirmed': return { backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #ceead6' };
            case 'Completed': return { backgroundColor: '#e8f0fe', color: '#1a73e8', border: '1px solid #d2e3fc' };
            case 'Cancelled': return { backgroundColor: '#fce8e6', color: '#c5221f', border: '1px solid #fad2cf' };
            default: return { backgroundColor: '#fef7e0', color: '#b06000', border: '1px solid #feefc3' };
        }
    };

    // --- RENDER LOGIN ---
    if (!token) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
                <div className="glass-panel" style={{ textAlign: 'center', width: '100%', maxWidth: '420px', padding: '48px 40px' }}>
                    <div style={{background: 'var(--medical-blue-light)', color: 'var(--medical-blue)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'}}>
                        <Activity size={32} />
                    </div>
                    <h2 style={{ marginBottom: '8px' }}>Staff Portal</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>Secure clinical administration</p>
                    
                    {loginError && <p style={{ color: '#c5221f', marginBottom: '24px', fontSize: '0.9rem', backgroundColor: '#fce8e6', padding: '12px', borderRadius: '6px', border: '1px solid #fad2cf' }}>{loginError}</p>}
                    
                    <form onSubmit={handleLogin}>
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label>Master Password</label>
                            <input 
                                type="password" 
                                placeholder="Enter access code" 
                                className="form-control"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Authenticate</button>
                    </form>
                    <Link to="/" style={{ display: 'inline-block', marginTop: '32px', color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={e=>e.target.style.color='var(--medical-blue)'} onMouseOut={e=>e.target.style.color='var(--text-tertiary)'}>← Return to Public Website</Link>
                </div>
            </div>
        );
    }

    // --- RENDER DASHBOARD ---
    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
            {/* SIDEBAR */}
            <div style={{ width: '280px', backgroundColor: 'var(--text-primary)', color: 'white', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '32px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{background: 'var(--medical-blue)', padding: '8px', borderRadius: '8px'}}>
                        <Activity size={20} color="white" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Dey Clinic Admin</h2>
                </div>
                
                <nav style={{ flex: 1, padding: '24px 12px' }}>
                    {[
                        { id: 'overview', icon: <LayoutDashboard size={20}/>, label: 'Overview' },
                        { id: 'appointments', icon: <Calendar size={20}/>, label: 'Appointments' },
                        { id: 'patients', icon: <Users size={20}/>, label: 'Patient Directory' }
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                                backgroundColor: activeTab === item.id ? 'var(--medical-blue)' : 'transparent',
                                color: activeTab === item.id ? 'white' : '#94a3b8',
                                border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem', fontWeight: 500, borderRadius: '8px', transition: 'all 0.2s', marginBottom: '8px'
                            }}
                        >
                            {item.icon} {item.label}
                        </button>
                    ))}
                </nav>

                <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'transparent', color: '#f87171', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500 }}>
                        <LogOut size={20} /> Terminate Session
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 600, textTransform: 'capitalize', letterSpacing: '-0.02em' }}>
                        {activeTab.replace('-', ' ')}
                    </h1>
                    <Link to="/" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Live Site ↗</Link>
                </div>

                {loading && <div style={{textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)'}}>Syncing clinical data...</div>}
                {error && <div style={{backgroundColor: '#fce8e6', color: '#c5221f', border: '1px solid #fad2cf', padding: '16px', borderRadius: '8px', marginBottom: '24px'}}>{error}</div>}

                {!loading && !error && (
                    <>
                        {/* TAB: OVERVIEW */}
                        {activeTab === 'overview' && (
                            <div>
                                {/* KPI Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '48px' }}>
                                    <div className="service-card" style={{ padding: '24px', borderTop: '4px solid var(--medical-blue)' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Today's Appointments</div>
                                        <div style={{ fontSize: '3rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{stats.todayCount}</div>
                                    </div>
                                    <div className="service-card" style={{ padding: '24px', borderTop: '4px solid #f59e0b' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Pending Requests</div>
                                        <div style={{ fontSize: '3rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{stats.pendingCount}</div>
                                    </div>
                                    <div className="service-card" style={{ padding: '24px', borderTop: '4px solid var(--medical-green)' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Registered Patients</div>
                                        <div style={{ fontSize: '3rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{stats.uniquePatients}</div>
                                    </div>
                                </div>

                                {/* Recent Activity */}
                                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-color)' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Needs Attention (Pending)</h3>
                                        <button onClick={() => setActiveTab('appointments')} style={{ background: 'none', border: 'none', color: 'var(--medical-blue)', cursor: 'pointer', fontWeight: 500 }}>View All →</button>
                                    </div>
                                    <div>
                                        {appointments.filter(a => a.status === 'Pending').length === 0 ? (
                                            <p style={{ color: 'var(--text-tertiary)', padding: '40px', textAlign: 'center', margin: 0 }}>No pending requests at the moment. You're all caught up!</p>
                                        ) : (
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                {appointments.filter(a => a.status === 'Pending').slice(0, 5).map(app => (
                                                    <li key={app.id} style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px', fontSize: '1.05rem', fontWeight: 500 }}>{app.patientName}</strong>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Calendar size={14}/> {app.date} at {app.time}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <button onClick={() => updateStatus(app.id, 'Confirmed')} className="btn" style={{ background: 'var(--medical-green)', color: 'white' }}>Confirm</button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: APPOINTMENTS */}
                        {activeTab === 'appointments' && (
                            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Toolbar */}
                                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'var(--bg-color)' }}>
                                    <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                                        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                                            <Search size={18} color="var(--text-tertiary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                            <input 
                                                type="text" 
                                                placeholder="Search name or phone..." 
                                                className="form-control"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                style={{ paddingLeft: '40px' }}
                                            />
                                        </div>
                                        <select 
                                            value={statusFilter} 
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="form-control"
                                            style={{ width: 'auto' }}
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <button onClick={exportToCSV} className="btn btn-secondary" style={{ display: 'flex', gap: '8px' }}>
                                        <Download size={18} /> Export CSV
                                    </button>
                                </div>

                                {/* Table */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Date & Time</th>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Patient Info</th>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Tracking ID</th>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Status</th>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAppointments.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No appointments found.</td>
                                                </tr>
                                            ) : (
                                                filteredAppointments.map(app => (
                                                    <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '20px 32px' }}>
                                                            <strong style={{ color: 'var(--text-primary)', display: 'block', fontWeight: 500 }}>{app.date}</strong>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{app.time}</span>
                                                        </td>
                                                        <td style={{ padding: '20px 32px' }}>
                                                            <strong style={{ color: 'var(--text-primary)', display: 'block', fontWeight: 500 }}>{app.patientName}</strong>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{app.phone}</span>
                                                        </td>
                                                        <td style={{ padding: '20px 32px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{app.trackingId}</td>
                                                        <td style={{ padding: '20px 32px' }}>
                                                            <span className="status-badge" style={getStatusStyle(app.status)}>{app.status}</span>
                                                        </td>
                                                        <td style={{ padding: '20px 32px' }}>
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                {app.status === 'Pending' && (
                                                                    <>
                                                                        <button onClick={() => updateStatus(app.id, 'Confirmed')} className="btn" style={{ background: 'var(--medical-green)', color: 'white', padding: '6px 12px', fontSize: '0.85rem' }}>Confirm</button>
                                                                        <button onClick={() => updateStatus(app.id, 'Cancelled')} className="btn" style={{ background: '#c5221f', color: 'white', padding: '6px 12px', fontSize: '0.85rem' }}>Cancel</button>
                                                                    </>
                                                                )}
                                                                {app.status === 'Confirmed' && (
                                                                    <button onClick={() => updateStatus(app.id, 'Completed')} className="btn" style={{ background: 'var(--medical-blue)', color: 'white', padding: '6px 12px', fontSize: '0.85rem' }}>Mark Complete</button>
                                                                )}
                                                                <button onClick={() => deleteAppointment(app.id)} title="Delete Log" style={{ cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)', border: 'none', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} onMouseOver={(e) => e.currentTarget.style.color = '#c5221f'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* TAB: PATIENTS */}
                        {activeTab === 'patients' && (
                            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Clinical Patient Database</h3>
                                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Automatically generated from consultation history.</p>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Patient Name</th>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Phone Number</th>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Total Visits</th>
                                                <th style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Last Visit Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uniquePatientsList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No patients registered yet.</td>
                                                </tr>
                                            ) : (
                                                uniquePatientsList.map((patient, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '20px 32px', fontWeight: 500, color: 'var(--text-primary)' }}>{patient.name}</td>
                                                        <td style={{ padding: '20px 32px', color: 'var(--text-secondary)' }}>{patient.phone}</td>
                                                        <td style={{ padding: '20px 32px' }}>
                                                            <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600 }}>{patient.visits}</span>
                                                        </td>
                                                        <td style={{ padding: '20px 32px', color: 'var(--text-secondary)' }}>{patient.lastVisit}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

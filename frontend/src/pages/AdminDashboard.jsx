import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
    LayoutDashboard, Calendar, Users, LogOut, Search, Download, 
    CheckCircle, Clock, Activity, Trash2, ArrowUpDown, Filter, 
    Sparkles, AlertCircle, RefreshCw, Phone, Copy, Check, ChevronRight,
    CalendarCheck, UserCheck, Stethoscope
} from 'lucide-react';

// Universal helper to normalize any date string format into YYYY-MM-DD
const normalizeDateStr = (rawDate) => {
    if (!rawDate) return '';
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    
    const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const day = String(ddmmyyyy[1]).padStart(2, '0');
        const month = String(ddmmyyyy[2]).padStart(2, '0');
        const year = ddmmyyyy[3];
        return `${year}-${month}-${day}`;
    }

    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Universal helper to parse and extract reliable appointment creation date and timestamp
const extractBookingInfo = (app, savedTimestamps) => {
    if (!app) return { dateStr: '', timestamp: 0, formattedDate: '', formattedTime: '' };

    const key = app.trackingId || `id_${app.id}`;
    let raw = app.createdAt || app.created_at || (savedTimestamps && (savedTimestamps[key] || (app.trackingId && savedTimestamps[app.trackingId]) || (app.id && savedTimestamps[`id_${app.id}`])));
    
    let dateObj = null;

    if (raw) {
        let safeStr = String(raw).trim();
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(safeStr)) {
            safeStr = safeStr.replace(' ', 'T') + 'Z';
        }
        const d = new Date(safeStr);
        if (!isNaN(d.getTime())) {
            dateObj = d;
        }
    }

    if (!dateObj && app.date) {
        let safeDate = normalizeDateStr(app.date);
        if (safeDate) {
            const idOffset = (Number(app.id) || 0) * 1000;
            const d = new Date(`${safeDate}T09:00:00`);
            if (!isNaN(d.getTime())) {
                dateObj = new Date(d.getTime() + idOffset);
            }
        }
    }

    if (!dateObj) {
        const idOffset = (Number(app.id) || 0) * 1000;
        dateObj = new Date(1788998400000 + idOffset);
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const timestamp = dateObj.getTime();

    const formattedDate = dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    
    const formattedTime = dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return { dateStr, timestamp, formattedDate, formattedTime };
};

export default function AdminDashboard() {
    // Security: strictly ask for password on every single reload or visit
    useEffect(() => {
        document.title = "Admin Portal | Dr. Dey Clinic";
        document.body.classList.add('admin-view');
        try {
            localStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminToken');
        } catch (e) {}

        return () => {
            document.body.classList.remove('admin-view');
        };
    }, []);

    // Screen width listener
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Quick tracking ID copy feedback state
    const [copiedTrackingId, setCopiedTrackingId] = useState(null);
    const copyTrackingId = (code) => {
        if (!code) return;
        try {
            navigator.clipboard.writeText(code);
            setCopiedTrackingId(code);
            setTimeout(() => setCopiedTrackingId(null), 2000);
        } catch (err) {}
    };

    const [appointments, setAppointments] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('admin_appointments_cache') || '[]');
        } catch (e) {
            return [];
        }
    });
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [refreshStatus, setRefreshStatus] = useState('idle'); // 'idle' | 'syncing' | 'success' | 'error'
    const [refreshFeedback, setRefreshFeedback] = useState('');
    
    // STRICT SECURITY: Token is stored purely in React memory.
    const [token, setToken] = useState(null);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    
    // UI & Filter States
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'appointments' | 'patients'
    // appointmentViewMode: 'all' | 'date_wise'
    const [appointmentViewMode, setAppointmentViewMode] = useState('all');
    // dateFilterField: 'visitDate' | 'bookingDate'
    const [dateFilterField, setDateFilterField] = useState('visitDate');
    const [selectedDateFilter, setSelectedDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [sortBy, setSortBy] = useState('booked_asc');

    const handleLogout = useCallback(() => {
        setToken(null);
        try {
            localStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminToken');
        } catch (e) {}
    }, []);

    const isSameAppointment = (a, b) => {
        if (!a || !b) return false;
        if (a.trackingId && b.trackingId) {
            return a.trackingId === b.trackingId;
        }
        return a.patientName === b.patientName && a.phone === b.phone && a.date === b.date && a.time === b.time;
    };

    const fetchAppointments = useCallback(async (isSilent = false, onProgress = null) => {
        const savedCache = JSON.parse(localStorage.getItem('admin_appointments_cache') || '[]');
        const savedTimestamps = JSON.parse(localStorage.getItem('clinic_booking_timestamps') || '{}');
        const activeToken = token;

        if (!activeToken) {
            setLoading(false);
            setIsSyncing(false);
            return null;
        }

        if (!isSilent) {
            setIsSyncing(true);
        }

        const maxAttempts = 3;
        let lastError = null;

        try {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    if (attempt > 1 && typeof onProgress === 'function') {
                        onProgress(`Syncing with server database... (${attempt}/${maxAttempts})`);
                    }

                    const res = await axios.get(`https://doctor-s-backend-2.onrender.com/api/appointments?_t=${Date.now()}`, {
                        headers: { Authorization: `Bearer ${activeToken}` },
                        timeout: 25000
                    });
                    
                    if (res.data && Array.isArray(res.data.appointments)) {
                        const backendList = res.data.appointments;
                        const mergedList = [...backendList];

                        const missingOnBackend = [];
                        savedCache.forEach(cached => {
                            if (!cached) return;
                            const exists = mergedList.some(b => isSameAppointment(cached, b));
                            if (!exists) {
                                mergedList.push(cached);
                                missingOnBackend.push(cached);
                            }
                        });

                        mergedList.forEach(item => {
                            if (item.trackingId) {
                                if (item.createdAt) {
                                    savedTimestamps[item.trackingId] = item.createdAt;
                                } else if (savedTimestamps[item.trackingId]) {
                                    item.createdAt = savedTimestamps[item.trackingId];
                                }
                            }
                        });

                        localStorage.setItem('clinic_booking_timestamps', JSON.stringify(savedTimestamps));
                        localStorage.setItem('admin_appointments_cache', JSON.stringify(mergedList));

                        setAppointments(mergedList);

                        if (missingOnBackend.length > 0) {
                            axios.post('https://doctor-s-backend-2.onrender.com/api/appointments/sync', {
                                appointments: missingOnBackend
                            }, {
                                headers: { Authorization: `Bearer ${activeToken}` }
                            }).catch(() => {});
                        }

                        return mergedList;
                    }
                } catch (err) {
                    lastError = err;
                    if (err.response && err.response.status === 401) {
                        handleLogout();
                        throw err;
                    }
                    if (attempt < maxAttempts) {
                        await new Promise(r => setTimeout(r, attempt * 1200));
                    }
                }
            }

            if (lastError) throw lastError;
        } finally {
            setIsSyncing(false);
            setLoading(false);
        }
    }, [token, handleLogout]);

    const handleManualRefresh = async () => {
        setIsSyncing(true);
        setRefreshStatus('syncing');
        setRefreshFeedback('Connecting to server database...');
        try {
            const logs = await fetchAppointments(false, (msg) => setRefreshFeedback(msg));
            const count = logs ? logs.length : appointments.length;
            setRefreshStatus('success');
            setRefreshFeedback(`✓ Synchronized ${count} record${count !== 1 ? 's' : ''} from server.`);
            setTimeout(() => {
                setRefreshStatus('idle');
                setRefreshFeedback('');
            }, 3000);
        } catch (e) {
            setRefreshStatus('error');
            if (e && e.response && e.response.status === 401) {
                setRefreshFeedback('⚠ Session expired. Please log in again.');
            } else {
                setRefreshFeedback('⚠ Network connection slow. Keeping local records safe.');
            }
            setTimeout(() => {
                setRefreshStatus('idle');
                setRefreshFeedback('');
            }, 3500);
        } finally {
            setIsSyncing(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        const savedCache = JSON.parse(localStorage.getItem('admin_appointments_cache') || '[]');
        if (savedCache.length > 0) {
            setAppointments(savedCache);
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!token) return;
        fetchAppointments(false);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchAppointments(true);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') fetchAppointments(true);
        }, 20000);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token, fetchAppointments]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('https://doctor-s-backend-2.onrender.com/api/login', { password });
            setToken(res.data.token);
            setPassword('');
            setLoginError('');
        } catch (err) {
            setLoginError('Incorrect password or server error');
        }
    };

    const updateStatus = async (id, status) => {
        setAppointments(prev => {
            const updated = prev.map(a => a.id === id ? { ...a, status } : a);
            localStorage.setItem('admin_appointments_cache', JSON.stringify(updated));
            return updated;
        });
        try {
            await axios.put(`https://doctor-s-backend-2.onrender.com/api/appointments/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 401) {
                handleLogout();
            } else {
                fetchAppointments(false);
            }
        }
    };

    const deleteAppointment = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this appointment log? This cannot be undone.')) return;
        setAppointments(prev => {
            const updated = prev.filter(a => a.id !== id);
            localStorage.setItem('admin_appointments_cache', JSON.stringify(updated));
            return updated;
        });
        try {
            await axios.delete(`https://doctor-s-backend-2.onrender.com/api/appointments/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 401) {
                handleLogout();
            } else {
                fetchAppointments(false);
            }
        }
    };

    const getExactBookingDateTime = (app) => {
        const savedTimestamps = JSON.parse(localStorage.getItem('clinic_booking_timestamps') || '{}');
        return extractBookingInfo(app, savedTimestamps);
    };

    const todayStr = new Date().toISOString().split('T')[0];
    
    const stats = useMemo(() => {
        const todayCount = appointments.filter(a => normalizeDateStr(a.date) === todayStr).length;
        const pendingCount = appointments.filter(a => a.status === 'Pending').length;
        const confirmedCount = appointments.filter(a => a.status === 'Confirmed').length;
        const completedCount = appointments.filter(a => a.status === 'Completed').length;
        const cancelledCount = appointments.filter(a => a.status === 'Cancelled').length;
        const uniquePatients = new Set(appointments.map(a => a.phone)).size;
        return { todayCount, pendingCount, confirmedCount, completedCount, cancelledCount, uniquePatients, total: appointments.length };
    }, [appointments, todayStr]);

    const uniquePatientsList = useMemo(() => {
        const map = new Map();
        appointments.forEach(app => {
            if (!map.has(app.phone)) {
                map.set(app.phone, { name: app.patientName, phone: app.phone, visits: 1, lastVisit: app.date, lastDepartment: app.department });
            } else {
                const p = map.get(app.phone);
                p.visits += 1;
                if (new Date(app.date) > new Date(p.lastVisit)) {
                    p.lastVisit = app.date;
                    p.lastDepartment = app.department;
                }
            }
        });
        return Array.from(map.values());
    }, [appointments]);

    // Unified Filter & Sort Logic
    const filteredAppointments = useMemo(() => {
        const savedTimestamps = JSON.parse(localStorage.getItem('clinic_booking_timestamps') || '{}');

        const infoMap = new Map();
        appointments.forEach(app => {
            const key = app.trackingId || `id_${app.id}`;
            infoMap.set(key, extractBookingInfo(app, savedTimestamps));
        });

        let list = appointments.filter(app => {
            const key = app.trackingId || `id_${app.id}`;
            const info = infoMap.get(key) || extractBookingInfo(app, savedTimestamps);

            const term = searchTerm.toLowerCase().trim();
            const matchesSearch =
                !term ||
                (app.patientName && app.patientName.toLowerCase().includes(term)) ||
                (app.phone && app.phone.includes(term)) ||
                (app.trackingId && app.trackingId.toLowerCase().includes(term)) ||
                (app.department && app.department.toLowerCase().includes(term));

            const matchesStatus = statusFilter === 'All' || app.status === statusFilter;

            let matchesDate = true;
            if (appointmentViewMode === 'date_wise') {
                const targetNorm = normalizeDateStr(selectedDateFilter);
                if (targetNorm && targetNorm !== 'All') {
                    const appDateNorm = normalizeDateStr(app.date);
                    const bookingDateNorm = info.dateStr;
                    if (dateFilterField === 'visitDate' || dateFilterField === 'slot_date') {
                        matchesDate = (appDateNorm === targetNorm);
                    } else if (dateFilterField === 'bookingDate' || dateFilterField === 'booking_date') {
                        matchesDate = (bookingDateNorm === targetNorm);
                    } else {
                        matchesDate = (appDateNorm === targetNorm || bookingDateNorm === targetNorm);
                    }
                }
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

        return list.sort((a, b) => {
            const keyA = a.trackingId || `id_${a.id}`;
            const keyB = b.trackingId || `id_${b.id}`;
            const infoA = infoMap.get(keyA) || extractBookingInfo(a, savedTimestamps);
            const infoB = infoMap.get(keyB) || extractBookingInfo(b, savedTimestamps);
            const idA = Number(a.id) || 0;
            const idB = Number(b.id) || 0;

            switch(sortBy) {
                case 'booked_asc': {
                    if (appointmentViewMode === 'date_wise') {
                        if (infoA.timestamp !== infoB.timestamp) return infoA.timestamp - infoB.timestamp;
                        return idA - idB;
                    }
                    const dateCompare = infoB.dateStr.localeCompare(infoA.dateStr);
                    if (dateCompare !== 0) return dateCompare;
                    if (infoA.timestamp !== infoB.timestamp) return infoA.timestamp - infoB.timestamp;
                    return idA - idB;
                }
                case 'booked_asc_oldest_day': {
                    const dateCompare = infoA.dateStr.localeCompare(infoB.dateStr);
                    if (dateCompare !== 0) return dateCompare;
                    if (infoA.timestamp !== infoB.timestamp) return infoA.timestamp - infoB.timestamp;
                    return idA - idB;
                }
                case 'booked_desc': {
                    if (infoA.timestamp !== infoB.timestamp) return infoB.timestamp - infoA.timestamp;
                    return idB - idA;
                }
                case 'pure_oldest_first': {
                    if (infoA.timestamp !== infoB.timestamp) return infoA.timestamp - infoB.timestamp;
                    return idA - idB;
                }
                case 'name_asc': {
                    const cmp = (a.patientName || '').localeCompare(b.patientName || '');
                    if (cmp !== 0) return cmp;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
                case 'name_desc': {
                    const cmp = (b.patientName || '').localeCompare(a.patientName || '');
                    if (cmp !== 0) return cmp;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
                case 'time_slot_asc': {
                    const rank = { 'Morning': 1, 'Afternoon': 2, 'Evening': 3 };
                    const rankA = rank[a.time] || 99;
                    const rankB = rank[b.time] || 99;
                    if (rankA !== rankB) return rankA - rankB;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
                case 'time_slot_desc': {
                    const rank = { 'Evening': 1, 'Afternoon': 2, 'Morning': 3 };
                    const rankA = rank[a.time] || 99;
                    const rankB = rank[b.time] || 99;
                    if (rankA !== rankB) return rankA - rankB;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
                case 'status_flow': {
                    const rank = { 'Pending': 1, 'Confirmed': 2, 'Completed': 3, 'Cancelled': 4 };
                    const rankA = rank[a.status] || 99;
                    const rankB = rank[b.status] || 99;
                    if (rankA !== rankB) return rankA - rankB;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
                case 'track_asc': {
                    const trA = (a.trackingId || '').toLowerCase();
                    const trB = (b.trackingId || '').toLowerCase();
                    return trA.localeCompare(trB) || idA - idB;
                }
                case 'appt_date_asc': {
                    const apptDiff = new Date(a.date || 0) - new Date(b.date || 0);
                    if (apptDiff !== 0) return apptDiff;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
                case 'appt_date_desc': {
                    const apptDiff = new Date(b.date || 0) - new Date(a.date || 0);
                    if (apptDiff !== 0) return apptDiff;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
                default: {
                    if (appointmentViewMode === 'date_wise') {
                        if (infoA.timestamp !== infoB.timestamp) return infoA.timestamp - infoB.timestamp;
                        return idA - idB;
                    }
                    const dateCompare = infoB.dateStr.localeCompare(infoA.dateStr);
                    if (dateCompare !== 0) return dateCompare;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }
            }
        });
    }, [appointments, searchTerm, statusFilter, selectedDateFilter, dateFilterField, sortBy, appointmentViewMode]);

    const exportToCSV = () => {
        const headers = ['Tracking ID', 'Booking Date', 'Booking Time', 'Visit Date (visitDate)', 'Time Slot', 'Patient Name', 'Phone', 'Department', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredAppointments.map(a => {
                const b = getExactBookingDateTime(a);
                return `"${a.trackingId || ''}","${b.formattedDate}","${b.formattedTime}","${a.date}","${a.time}","${a.patientName}","${a.phone}","${a.department}","${a.status}"`;
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `clinic_appointments_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusBadgeStyle = (status) => {
        switch(status) {
            case 'Confirmed': return { background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' };
            case 'Completed': return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
            case 'Cancelled': return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' };
            default: return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
        }
    };

    const getStatusLeftBorderColor = (status) => {
        switch(status) {
            case 'Confirmed': return '#0284c7';
            case 'Completed': return '#16a34a';
            case 'Cancelled': return '#dc2626';
            default: return '#f59e0b';
        }
    };

    // Helper to format date nicely
    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    };

    // --- RENDER AUTH / LOGIN ---
    if (!token) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0f172a', padding: '16px' }}>
                <div style={{ 
                    background: '#ffffff', 
                    borderRadius: '24px', 
                    textAlign: 'center', 
                    width: '100%', 
                    maxWidth: '400px', 
                    padding: isMobile ? '32px 24px' : '44px 36px', 
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', 
                    border: '1px solid rgba(255,255,255,0.1)' 
                }}>
                    <div style={{ background: '#0284c7', color: '#ffffff', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 10px 20px -5px rgba(2, 132, 199, 0.4)' }}>
                        <Stethoscope size={28} />
                    </div>
                    <h2 style={{ margin: '0 0 6px', fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Dr. Dey Clinic</h2>
                    <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: '0.85rem' }}>Secure Management Portal</p>
                    
                    {loginError && (
                        <div style={{ color: '#b91c1c', marginBottom: '18px', fontSize: '0.82rem', backgroundColor: '#fee2e2', padding: '10px 14px', borderRadius: '10px', border: '1px solid #fecaca', fontWeight: 600 }}>
                            {loginError}
                        </div>
                    )}
                    
                    <form onSubmit={handleLogin}>
                        <div style={{ textAlign: 'left', marginBottom: '18px' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', marginBottom: '6px' }}>
                                Master Access Password
                            </label>
                            <input 
                                type="password" 
                                placeholder="••••••••••••" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    padding: '12px 14px', 
                                    borderRadius: '12px', 
                                    border: '1.5px solid #cbd5e1', 
                                    fontSize: '1rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                autoFocus
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            style={{ 
                                width: '100%', 
                                padding: '13px 0', 
                                fontSize: '0.92rem', 
                                fontWeight: 700, 
                                borderRadius: '12px',
                                background: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                                transition: 'all 0.2s'
                            }}
                        >
                            Unlock Dashboard
                        </button>
                    </form>
                    <Link to="/" style={{ display: 'inline-block', marginTop: '20px', color: '#64748b', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
                        ← Return to Public Website
                    </Link>
                </div>
            </div>
        );
    }

    // --- RENDER FULL SCREEN DASHBOARD ---
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f8fafc', width: '100%', overflowX: 'hidden' }}>
            
            {/* ==================== 1. TOP APP BAR ==================== */}
            <header style={{ 
                background: '#0f172a', 
                color: '#ffffff', 
                padding: isMobile ? '12px 14px' : '0 28px', 
                height: isMobile ? 'auto' : '64px', 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center', 
                justifyContent: 'space-between', 
                gap: isMobile ? '10px' : '0',
                borderBottom: '1px solid rgba(255,255,255,0.08)', 
                position: 'sticky', 
                top: 0, 
                zIndex: 100,
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                {/* Brand & Clinic Identity */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#0284c7', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Stethoscope size={19} color="white" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 800, fontSize: isMobile ? '0.98rem' : '1.1rem', color: '#ffffff', letterSpacing: '-0.01em' }}>Dr. Dey Clinic</span>
                                <span style={{ fontSize: '0.66rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>PORTAL</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Patient Appointment Management</span>
                        </div>
                    </div>

                    {isMobile && (
                        <button 
                            onClick={handleLogout} 
                            style={{ 
                                background: 'rgba(239,68,68,0.12)', 
                                color: '#f87171', 
                                border: '1px solid rgba(239,68,68,0.25)', 
                                padding: '6px 12px', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                fontSize: '0.76rem', 
                                fontWeight: 700, 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                            }}
                        >
                            <LogOut size={13} /> Exit
                        </button>
                    )}
                </div>

                {/* Right controls: Live Sync, Refresh, Live Site, Logout */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: isMobile ? '6px' : '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '5px 10px', borderRadius: '50px', fontSize: '0.74rem', fontWeight: 700, color: '#10b981' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                        <span>Live Sync</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button 
                            type="button"
                            onClick={handleManualRefresh} 
                            disabled={isSyncing}
                            title="Force Refresh Data from Server" 
                            style={{ 
                                background: isSyncing ? 'rgba(2, 132, 199, 0.3)' : refreshStatus === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.1)', 
                                border: '1px solid rgba(255,255,255,0.15)', 
                                color: '#ffffff', 
                                padding: isMobile ? '6px 11px' : '7px 14px', 
                                borderRadius: '8px', 
                                cursor: isSyncing ? 'not-allowed' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '5px', 
                                fontSize: '0.78rem', 
                                fontWeight: 700,
                                transition: 'all 0.15s'
                            }}
                        >
                            <RefreshCw size={13} className={isSyncing ? "spin" : ""} /> 
                            {isSyncing ? "Syncing..." : refreshStatus === 'success' ? "✓ Updated" : "Refresh"}
                        </button>

                        <Link 
                            to="/" 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ 
                                color: '#94a3b8', 
                                textDecoration: 'none', 
                                fontSize: '0.78rem', 
                                fontWeight: 600, 
                                padding: isMobile ? '6px 10px' : '7px 12px', 
                                borderRadius: '8px', 
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            Website ↗
                        </Link>

                        {!isMobile && (
                            <button 
                                onClick={handleLogout} 
                                style={{ 
                                    background: 'rgba(239,68,68,0.12)', 
                                    color: '#f87171', 
                                    border: '1px solid rgba(239,68,68,0.25)', 
                                    padding: '7px 14px', 
                                    borderRadius: '8px', 
                                    cursor: 'pointer', 
                                    fontSize: '0.78rem', 
                                    fontWeight: 700, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '5px',
                                    marginLeft: '4px'
                                }}
                            >
                                <LogOut size={13} /> Exit
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Sync Feedback Toast Banner */}
            {refreshFeedback && (
                <div style={{
                    background: refreshStatus === 'error' ? '#fee2e2' : '#dcfce7',
                    color: refreshStatus === 'error' ? '#b91c1c' : '#15803d',
                    borderBottom: `1px solid ${refreshStatus === 'error' ? '#fca5a5' : '#86efac'}`,
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}>
                    <span>{refreshFeedback}</span>
                </div>
            )}

            {/* ==================== 2. NAVIGATION BAR ==================== */}
            <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: isMobile ? '8px 12px' : '0 28px' }}>
                <div style={{ 
                    maxWidth: '1600px', 
                    margin: '0 auto', 
                    display: 'flex', 
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center', 
                    justifyContent: 'space-between', 
                    gap: isMobile ? '6px' : '16px' 
                }}>
                    
                    {/* Navigation Tabs (Smooth segmented pill bar) */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '6px', 
                        padding: isMobile ? '4px 0' : '10px 0',
                        overflowX: isMobile ? 'auto' : 'visible',
                        whiteSpace: isMobile ? 'nowrap' : 'normal',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {[
                            { id: 'overview', icon: <LayoutDashboard size={16}/>, label: 'Overview' },
                            { id: 'appointments', icon: <Calendar size={16}/>, label: `Appointments`, badge: appointments.length },
                            { id: 'patients', icon: <Users size={16}/>, label: `Patients`, badge: uniquePatientsList.length }
                        ].map(item => {
                            const isActive = activeTab === item.id;
                            return (
                                <button 
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    style={{
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: isMobile ? '8px 12px' : '9px 18px',
                                        borderRadius: '10px',
                                        background: isActive ? '#0284c7' : '#f1f5f9',
                                        color: isActive ? '#ffffff' : '#475569',
                                        border: 'none', 
                                        cursor: 'pointer', 
                                        fontSize: isMobile ? '0.8rem' : '0.88rem', 
                                        fontWeight: isActive ? 800 : 600,
                                        flexShrink: 0,
                                        boxShadow: isActive ? '0 2px 8px rgba(2, 132, 199, 0.25)' : 'none',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {item.icon} 
                                    <span>{item.label}</span>
                                    {item.badge !== undefined && (
                                        <span style={{ 
                                            background: isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0', 
                                            color: isActive ? '#ffffff' : '#475569', 
                                            padding: '1px 6px', 
                                            borderRadius: '50px', 
                                            fontSize: '0.72rem', 
                                            fontWeight: 800 
                                        }}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick Live Summary Stat Badges */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: isMobile ? 'space-between' : 'flex-end',
                        gap: isMobile ? '6px' : '14px', 
                        padding: isMobile ? '4px 0 2px' : '0', 
                        fontSize: '0.76rem', 
                        fontWeight: 700 
                    }}>
                        <span style={{ color: '#0369a1', background: '#e0f2fe', padding: '3px 9px', borderRadius: '50px', border: '1px solid #bae6fd' }}>
                            ● {stats.todayCount} Today's Visits
                        </span>
                        <span style={{ color: '#b45309', background: '#fef3c7', padding: '3px 9px', borderRadius: '50px', border: '1px solid #fde68a' }}>
                            ● {stats.pendingCount} Pending
                        </span>
                        <span style={{ color: '#15803d', background: '#dcfce7', padding: '3px 9px', borderRadius: '50px', border: '1px solid #bbf7d0' }}>
                            ● {stats.confirmedCount} Confirmed
                        </span>
                    </div>

                </div>
            </div>

            {/* ==================== 3. MAIN CONTENT CONTAINER ==================== */}
            <main style={{ 
                flex: 1, 
                padding: isMobile ? '12px 10px 40px' : '24px 28px', 
                width: '100%', 
                maxWidth: '1600px', 
                margin: '0 auto', 
                boxSizing: 'border-box' 
            }}>
                
                {loading && appointments.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: '0.95rem', fontWeight: 600 }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#0284c7' }} />
                        Loading appointment records from server...
                    </div>
                )}

                {(appointments.length > 0 || !loading) && (
                    <>
                        {/* ==================== TAB 1: OVERVIEW ==================== */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '24px' }}>
                                
                                {/* KPI Statistics Grid */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
                                    gap: isMobile ? '8px' : '16px' 
                                }}>
                                    <div style={{ background: '#ffffff', borderRadius: '16px', padding: isMobile ? '14px' : '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', borderLeft: '4px solid #0284c7' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                            Today's Scheduled
                                        </div>
                                        <div style={{ fontSize: isMobile ? '1.75rem' : '2.2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{stats.todayCount}</div>
                                        <div style={{ color: '#0284c7', fontSize: '0.72rem', marginTop: '6px', fontWeight: 600 }}>Patients visiting today</div>
                                    </div>

                                    <div style={{ background: '#ffffff', borderRadius: '16px', padding: isMobile ? '14px' : '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', borderLeft: '4px solid #f59e0b' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                            Pending Action
                                        </div>
                                        <div style={{ fontSize: isMobile ? '1.75rem' : '2.2rem', fontWeight: 800, color: '#d97706', lineHeight: 1.1 }}>{stats.pendingCount}</div>
                                        <div style={{ color: '#b45309', fontSize: '0.72rem', marginTop: '6px', fontWeight: 600 }}>Awaiting confirmation</div>
                                    </div>

                                    <div style={{ background: '#ffffff', borderRadius: '16px', padding: isMobile ? '14px' : '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', borderLeft: '4px solid #16a34a' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                            Confirmed
                                        </div>
                                        <div style={{ fontSize: isMobile ? '1.75rem' : '2.2rem', fontWeight: 800, color: '#15803d', lineHeight: 1.1 }}>{stats.confirmedCount}</div>
                                        <div style={{ color: '#16a34a', fontSize: '0.72rem', marginTop: '6px', fontWeight: 600 }}>Active patient appointments</div>
                                    </div>

                                    <div style={{ background: '#ffffff', borderRadius: '16px', padding: isMobile ? '14px' : '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', borderLeft: '4px solid #8b5cf6' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                            Total Bookings
                                        </div>
                                        <div style={{ fontSize: isMobile ? '1.75rem' : '2.2rem', fontWeight: 800, color: '#6d28d9', lineHeight: 1.1 }}>{stats.total}</div>
                                        <div style={{ color: '#7c3aed', fontSize: '0.72rem', marginTop: '6px', fontWeight: 600 }}>{stats.uniquePatients} unique patients</div>
                                    </div>
                                </div>

                                {/* Urgent Pending Appointments Action Queue */}
                                <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                                    <div style={{ padding: isMobile ? '14px 16px' : '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertCircle size={18} color="#d97706" />
                                            <h3 style={{ margin: 0, fontSize: isMobile ? '0.95rem' : '1.08rem', fontWeight: 800, color: '#92400e' }}>
                                                Pending Appointments Requiring Action ({stats.pendingCount})
                                            </h3>
                                        </div>
                                        {stats.pendingCount > 0 && (
                                            <button 
                                                onClick={() => {
                                                    setActiveTab('appointments');
                                                    setStatusFilter('Pending');
                                                }}
                                                style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                View All →
                                            </button>
                                        )}
                                    </div>

                                    {appointments.filter(a => a.status === 'Pending').length === 0 ? (
                                        <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                                            <CheckCircle size={32} color="#16a34a" style={{ margin: '0 auto 8px', display: 'block' }} />
                                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Zero Pending Requests</div>
                                            <div style={{ fontSize: '0.8rem', marginTop: '3px' }}>All patient booking requests have been reviewed.</div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: isMobile ? '12px' : '16px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                                            {appointments.filter(a => a.status === 'Pending')
                                                .sort((a, b) => getExactBookingDateTime(a).timestamp - getExactBookingDateTime(b).timestamp)
                                                .map(app => {
                                                    const bInfo = getExactBookingDateTime(app);
                                                    return (
                                                        <div key={app.id} style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
                                                                    Booked: {bInfo.formattedDate} • {bInfo.formattedTime}
                                                                </span>
                                                                <code style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#475569' }}>{app.trackingId}</code>
                                                            </div>

                                                            <div>
                                                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{app.patientName}</div>
                                                                <a href={`tel:${app.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0284c7', fontSize: '0.84rem', fontWeight: 600, textDecoration: 'none', marginTop: '2px' }}>
                                                                    <Phone size={12} /> {app.phone}
                                                                    <span style={{ fontSize: '0.66rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '50px' }}>Call</span>
                                                                </a>
                                                            </div>

                                                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', fontSize: '0.8rem', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                                                                <span>🏥 <strong>visitDate: {app.date}</strong> ({app.time})</span>
                                                                <span style={{ fontWeight: 600 }}>{app.department}</span>
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                                                                <button onClick={() => updateStatus(app.id, 'Confirmed')} style={{ background: '#16a34a', color: 'white', padding: '8px 0', fontSize: '0.82rem', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'center' }}>✓ Confirm</button>
                                                                <button onClick={() => updateStatus(app.id, 'Cancelled')} style={{ background: '#dc2626', color: 'white', padding: '8px 0', fontSize: '0.82rem', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'center' }}>✕ Cancel</button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}

                        {/* ==================== TAB 2: APPOINTMENTS VIEW ==================== */}
                        {activeTab === 'appointments' && (
                            <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', width: '100%' }}>
                                
                                {/* ── MASTER CONTROL TOOLBAR ── */}
                                <div style={{ 
                                    padding: isMobile ? '12px' : '18px 24px', 
                                    borderBottom: '1px solid #e2e8f0', 
                                    background: '#ffffff', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '12px' 
                                }}>
                                    
                                    {/* Toolbar Top Row: Title, Record Count & Quick Export/Refresh */}
                                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '10px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                                                    Patient Appointments
                                                </h2>
                                                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '50px', fontSize: '0.74rem', fontWeight: 800 }}>
                                                    {filteredAppointments.length} matching
                                                </span>
                                            </div>
                                            <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.78rem' }}>
                                                {appointmentViewMode === 'all'
                                                    ? 'Showing all appointments across all dates, ordered chronologically'
                                                    : dateFilterField === 'visitDate'
                                                    ? `Filtered by scheduled visitDate: ${selectedDateFilter ? formatDisplayDate(selectedDateFilter) : 'Select date'}`
                                                    : `Filtered by bookingDate: ${selectedDateFilter ? formatDisplayDate(selectedDateFilter) : 'Select date'}`}
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button 
                                                type="button"
                                                onClick={handleManualRefresh} 
                                                disabled={isSyncing}
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    gap: '6px', 
                                                    padding: '7px 14px', 
                                                    borderRadius: '8px', 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 700,
                                                    background: isSyncing ? '#f1f5f9' : '#ffffff',
                                                    color: '#334155',
                                                    border: '1px solid #cbd5e1',
                                                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                                                    flex: isMobile ? 1 : 'initial'
                                                }}
                                            >
                                                <RefreshCw size={13} className={isSyncing ? "spin" : ""} /> 
                                                <span>{isSyncing ? "Syncing" : "Refresh"}</span>
                                            </button>
                                            <button 
                                                onClick={exportToCSV} 
                                                style={{ 
                                                    display: 'flex', 
                                                    gap: '6px', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    padding: '7px 14px', 
                                                    borderRadius: '8px', 
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    background: '#ffffff',
                                                    color: '#334155',
                                                    border: '1px solid #cbd5e1',
                                                    cursor: 'pointer',
                                                    flex: isMobile ? 1 : 'initial'
                                                }}
                                            >
                                                <Download size={14} /> Export CSV
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Direct Primary Mode Switcher: All Appointments vs visitDate vs bookingDate ── */}
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'auto auto auto',
                                        justifyContent: isMobile ? 'stretch' : 'flex-start',
                                        gap: '6px', 
                                        background: '#f1f5f9', 
                                        padding: '4px', 
                                        borderRadius: '12px',
                                        width: isMobile ? '100%' : 'fit-content',
                                        position: 'relative',
                                        zIndex: 20
                                    }}>
                                        {/* Button 1: All Appointments */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAppointmentViewMode('all');
                                                setSortBy('booked_asc');
                                            }}
                                            style={{
                                                padding: isMobile ? '8px 6px' : '8px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: appointmentViewMode === 'all' ? 800 : 600,
                                                fontSize: isMobile ? '0.75rem' : '0.84rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                background: appointmentViewMode === 'all' ? '#0284c7' : 'transparent',
                                                color: appointmentViewMode === 'all' ? '#ffffff' : '#475569',
                                                boxShadow: appointmentViewMode === 'all' ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                                                transition: 'all 0.15s',
                                                position: 'relative',
                                                zIndex: 20
                                            }}
                                        >
                                            <Calendar size={14} /> 
                                            <span>All</span>
                                        </button>

                                        {/* Button 2: visitDate */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAppointmentViewMode('date_wise');
                                                setDateFilterField('visitDate');
                                                setSortBy('booked_asc');
                                            }}
                                            style={{
                                                padding: isMobile ? '8px 6px' : '8px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: (appointmentViewMode === 'date_wise' && dateFilterField === 'visitDate') ? 800 : 600,
                                                fontSize: isMobile ? '0.75rem' : '0.84rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                background: (appointmentViewMode === 'date_wise' && dateFilterField === 'visitDate') ? '#7c3aed' : 'transparent',
                                                color: (appointmentViewMode === 'date_wise' && dateFilterField === 'visitDate') ? '#ffffff' : '#475569',
                                                boxShadow: (appointmentViewMode === 'date_wise' && dateFilterField === 'visitDate') ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none',
                                                transition: 'all 0.15s',
                                                position: 'relative',
                                                zIndex: 20
                                            }}
                                        >
                                            <CalendarCheck size={14} /> 
                                            <span>visitDate</span>
                                        </button>

                                        {/* Button 3: bookingDate */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAppointmentViewMode('date_wise');
                                                setDateFilterField('bookingDate');
                                                setSortBy('booked_asc');
                                            }}
                                            style={{
                                                padding: isMobile ? '8px 6px' : '8px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: (appointmentViewMode === 'date_wise' && dateFilterField === 'bookingDate') ? 800 : 600,
                                                fontSize: isMobile ? '0.75rem' : '0.84rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                background: (appointmentViewMode === 'date_wise' && dateFilterField === 'bookingDate') ? '#7c3aed' : 'transparent',
                                                color: (appointmentViewMode === 'date_wise' && dateFilterField === 'bookingDate') ? '#ffffff' : '#475569',
                                                boxShadow: (appointmentViewMode === 'date_wise' && dateFilterField === 'bookingDate') ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none',
                                                transition: 'all 0.15s',
                                                position: 'relative',
                                                zIndex: 20
                                            }}
                                        >
                                            <Clock size={14} /> 
                                            <span>bookingDate</span>
                                        </button>
                                    </div>

                                    {/* ── THE PERFECTLY ALIGNED DATE SELECTION BOX (When visitDate or bookingDate is active) ── */}
                                    {appointmentViewMode === 'date_wise' && (
                                        <div style={{ 
                                            background: '#faf5ff', 
                                            border: '1.5px solid #ddd6fe', 
                                            borderRadius: '14px', 
                                            padding: isMobile ? '12px' : '14px 18px', 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '10px',
                                            boxShadow: '0 2px 10px rgba(124, 58, 237, 0.04)',
                                            position: 'relative',
                                            zIndex: 1
                                        }}>
                                            {/* Header strip: Active Filter label + Count + Clear */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '1rem' }}>{dateFilterField === 'visitDate' ? '🏥' : '📅'}</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#5b21b6' }}>
                                                        Filtering by {dateFilterField === 'visitDate' ? 'Clinic Visit Date (visitDate)' : 'Booking Submission Date (bookingDate)'}:
                                                    </span>
                                                    <span style={{ background: '#7c3aed', color: '#ffffff', padding: '2px 8px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 800 }}>
                                                        {filteredAppointments.length} Patient{filteredAppointments.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAppointmentViewMode('all');
                                                        setSelectedDateFilter(new Date().toISOString().split('T')[0]);
                                                        setSortBy('booked_asc');
                                                    }}
                                                    style={{
                                                        background: '#ffffff',
                                                        color: '#dc2626',
                                                        border: '1px solid #fecaca',
                                                        borderRadius: '6px',
                                                        padding: '4px 10px',
                                                        fontSize: '0.74rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    View All Dates ✕
                                                </button>
                                            </div>

                                            {/* Date Picker Input & Quick Shortcut Buttons (Flawlessly aligned) */}
                                            <div style={{ 
                                                display: 'flex', 
                                                flexDirection: isMobile ? 'column' : 'row', 
                                                alignItems: isMobile ? 'stretch' : 'center', 
                                                gap: '8px' 
                                            }}>
                                                {/* Clean Date Picker Input */}
                                                <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? 'none' : '0 0 280px' }}>
                                                    <input 
                                                        type="date"
                                                        className="admin-date-input"
                                                        value={selectedDateFilter || ''}
                                                        onChange={(e) => setSelectedDateFilter(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            borderRadius: '8px',
                                                            fontSize: '0.88rem',
                                                            fontWeight: 700,
                                                            border: '1.5px solid #7c3aed',
                                                            background: '#ffffff',
                                                            padding: '8px 12px',
                                                            color: '#0f172a',
                                                            outline: 'none',
                                                            boxSizing: 'border-box',
                                                            position: 'relative',
                                                            zIndex: 1
                                                        }}
                                                    />
                                                </div>

                                                {/* Shortcut buttons */}
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedDateFilter(new Date().toISOString().split('T')[0])}
                                                        style={{
                                                            background: selectedDateFilter === new Date().toISOString().split('T')[0] ? '#7c3aed' : '#ffffff',
                                                            color: selectedDateFilter === new Date().toISOString().split('T')[0] ? '#ffffff' : '#6d28d9',
                                                            border: '1px solid #ddd6fe',
                                                            borderRadius: '8px',
                                                            padding: '8px 12px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            flex: isMobile ? 1 : 'initial',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        Today
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const tmrw = new Date();
                                                            tmrw.setDate(tmrw.getDate() + 1);
                                                            setSelectedDateFilter(tmrw.toISOString().split('T')[0]);
                                                        }}
                                                        style={{
                                                            background: (() => {
                                                                const tmrw = new Date();
                                                                tmrw.setDate(tmrw.getDate() + 1);
                                                                return selectedDateFilter === tmrw.toISOString().split('T')[0] ? '#7c3aed' : '#ffffff';
                                                            })(),
                                                            color: (() => {
                                                                const tmrw = new Date();
                                                                tmrw.setDate(tmrw.getDate() + 1);
                                                                return selectedDateFilter === tmrw.toISOString().split('T')[0] ? '#ffffff' : '#6d28d9';
                                                            })(),
                                                            border: '1px solid #ddd6fe',
                                                            borderRadius: '8px',
                                                            padding: '8px 12px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            flex: isMobile ? 1 : 'initial',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        Tomorrow
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const yest = new Date();
                                                            yest.setDate(yest.getDate() - 1);
                                                            setSelectedDateFilter(yest.toISOString().split('T')[0]);
                                                        }}
                                                        style={{
                                                            background: (() => {
                                                                const yest = new Date();
                                                                yest.setDate(yest.getDate() - 1);
                                                                return selectedDateFilter === yest.toISOString().split('T')[0] ? '#7c3aed' : '#ffffff';
                                                            })(),
                                                            color: (() => {
                                                                const yest = new Date();
                                                                yest.setDate(yest.getDate() - 1);
                                                                return selectedDateFilter === yest.toISOString().split('T')[0] ? '#ffffff' : '#6d28d9';
                                                            })(),
                                                            border: '1px solid #ddd6fe',
                                                            borderRadius: '8px',
                                                            padding: '8px 12px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            flex: isMobile ? 1 : 'initial',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        Yesterday
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Subtitle status info */}
                                            <div style={{ fontSize: '0.78rem', color: '#6d28d9', fontWeight: 600 }}>
                                                {selectedDateFilter ? (
                                                    <span>Selected Date: <strong>{formatDisplayDate(selectedDateFilter)}</strong> ({filteredAppointments.length} record{filteredAppointments.length !== 1 ? 's' : ''} found)</span>
                                                ) : (
                                                    <span>Please pick a date from the calendar.</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Search, Status Filter & Sort Row ── */}
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', 
                                        gap: '8px',
                                        alignItems: 'center'
                                    }}>
                                        {/* Search Input */}
                                        <div style={{ position: 'relative', width: '100%' }}>
                                            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                            <input 
                                                type="text" 
                                                placeholder="Search name, phone, tracking ID..." 
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                style={{ 
                                                    paddingLeft: '36px', 
                                                    paddingRight: '12px',
                                                    paddingTop: '9px',
                                                    paddingBottom: '9px',
                                                    borderRadius: '8px', 
                                                    fontSize: '0.84rem', 
                                                    border: '1.5px solid #cbd5e1',
                                                    outline: 'none',
                                                    width: '100%',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        {/* Status Filter Dropdown */}
                                        <div style={{ width: '100%' }}>
                                            <select 
                                                value={statusFilter} 
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                                style={{ 
                                                    borderRadius: '8px', 
                                                    fontSize: '0.84rem', 
                                                    border: '1.5px solid #cbd5e1',
                                                    padding: '9px 12px',
                                                    width: '100%',
                                                    fontWeight: 600,
                                                    color: '#334155',
                                                    background: '#ffffff',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                <option value="All">All Statuses</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Confirmed">Confirmed</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>

                                        {/* Sort Order Dropdown */}
                                        <div style={{ width: '100%' }}>
                                            <select 
                                                value={sortBy} 
                                                onChange={(e) => setSortBy(e.target.value)}
                                                style={{ 
                                                    borderRadius: '8px', 
                                                    fontSize: '0.84rem', 
                                                    border: '1.5px solid #cbd5e1',
                                                    padding: '9px 12px',
                                                    width: '100%',
                                                    fontWeight: 600,
                                                    color: '#334155',
                                                    background: '#ffffff',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                <option value="booked_asc">⭐ Earliest Booked at Top</option>
                                                <option value="booked_desc">🔽 Latest Booked at Top</option>
                                                <option value="appt_date_asc">🏥 Visit Date (Earliest First)</option>
                                                <option value="appt_date_desc">🏥 Visit Date (Latest First)</option>
                                                <option value="name_asc">👤 Patient Name (A to Z)</option>
                                                <option value="status_flow">📋 Pending First → Confirmed</option>
                                            </select>
                                        </div>
                                    </div>

                                </div>

                                {/* ── CONTENT: ZERO RESULTS vs MOBILE CARDS vs DESKTOP TABLE ── */}
                                {filteredAppointments.length === 0 ? (
                                    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📭</div>
                                        <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                            No Appointments Match
                                        </h3>
                                        <p style={{ margin: '0 auto 16px', color: '#64748b', fontSize: '0.84rem', maxWidth: '420px', lineHeight: 1.5 }}>
                                            {appointmentViewMode === 'date_wise'
                                                ? `No patient records found for ${dateFilterField === 'visitDate' ? 'visitDate' : 'bookingDate'} on ${formatDisplayDate(selectedDateFilter)}.`
                                                : 'No appointments match your current search or filter criteria.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAppointmentViewMode('all');
                                                setSelectedDateFilter(new Date().toISOString().split('T')[0]);
                                                setStatusFilter('All');
                                                setSearchTerm('');
                                            }}
                                            style={{
                                                background: '#0284c7',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '9px 20px',
                                                fontSize: '0.84rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            View All Appointments ({appointments.length})
                                        </button>
                                    </div>
                                ) : isMobile ? (
                                    /* ==================== MOBILE CARDS (PEAK UI/UX FOR PHONE) ==================== */
                                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {filteredAppointments.map((app, index) => {
                                            const info = getExactBookingDateTime(app);
                                            const prevApp = index > 0 ? filteredAppointments[index - 1] : null;
                                            const prevInfo = prevApp ? getExactBookingDateTime(prevApp) : null;

                                            const isNewDateGroup = appointmentViewMode === 'all'
                                                ? ((sortBy === 'booked_asc' || sortBy === 'booked_asc_oldest_day') && (!prevInfo || prevInfo.dateStr !== info.dateStr))
                                                : (index === 0);

                                            return (
                                                <Fragment key={app.id || app.trackingId || index}>
                                                    {/* Section Divider Banner */}
                                                    {isNewDateGroup && (
                                                        <div style={{ 
                                                            background: appointmentViewMode === 'date_wise' ? '#f5f3ff' : '#f1f5f9',
                                                            border: appointmentViewMode === 'date_wise' ? '1px solid #ddd6fe' : '1px solid #e2e8f0',
                                                            borderRadius: '10px',
                                                            padding: '8px 12px',
                                                            marginTop: index > 0 ? '10px' : '2px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span>{appointmentViewMode === 'date_wise' ? (dateFilterField === 'visitDate' ? '🏥' : '📅') : '📅'}</span>
                                                                <span style={{ fontWeight: 800, fontSize: '0.84rem', color: appointmentViewMode === 'date_wise' ? '#5b21b6' : '#0f172a' }}>
                                                                    {appointmentViewMode === 'date_wise'
                                                                        ? (dateFilterField === 'visitDate'
                                                                            ? `visitDate: ${formatDisplayDate(selectedDateFilter || app.date)}`
                                                                            : `bookingDate: ${formatDisplayDate(selectedDateFilter || info.dateStr)}`)
                                                                        : info.formattedDate}
                                                                </span>
                                                            </div>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                                                {appointmentViewMode === 'all'
                                                                    ? `${filteredAppointments.filter(item => getExactBookingDateTime(item).dateStr === info.dateStr).length} patients`
                                                                    : `${filteredAppointments.length} patients`}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Mobile Card */}
                                                    <div style={{
                                                        background: '#ffffff',
                                                        borderRadius: '14px',
                                                        border: '1px solid #e2e8f0',
                                                        borderLeft: `5px solid ${getStatusLeftBorderColor(app.status)}`,
                                                        padding: '14px',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '10px'
                                                    }}>
                                                        {/* Top Row: Status badge + Tracking code + Delete */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ ...getStatusBadgeStyle(app.status), padding: '3px 9px', borderRadius: '50px', fontSize: '0.74rem', fontWeight: 800 }}>
                                                                ● {app.status}
                                                            </span>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <code style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', fontSize: '0.78rem' }}>
                                                                    {app.trackingId}
                                                                </code>
                                                                <button 
                                                                    onClick={() => copyTrackingId(app.trackingId)}
                                                                    type="button"
                                                                    style={{ background: copiedTrackingId === app.trackingId ? '#dcfce7' : '#f1f5f9', border: '1px solid #cbd5e1', color: copiedTrackingId === app.trackingId ? '#15803d' : '#475569', borderRadius: '6px', padding: '3px 7px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                                >
                                                                    {copiedTrackingId === app.trackingId ? <Check size={11} /> : <Copy size={11} />}
                                                                </button>
                                                                <button 
                                                                    onClick={() => deleteAppointment(app.id)} 
                                                                    title="Delete record" 
                                                                    style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', padding: '3px', borderRadius: '4px', marginLeft: '4px' }}
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Patient Name & Direct Tap-to-Call Button */}
                                                        <div>
                                                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{app.patientName}</div>
                                                            <div style={{ marginTop: '4px' }}>
                                                                <a 
                                                                    href={`tel:${app.phone}`} 
                                                                    style={{ 
                                                                        display: 'inline-flex', 
                                                                        alignItems: 'center', 
                                                                        gap: '6px', 
                                                                        color: '#0369a1', 
                                                                        background: '#e0f2fe',
                                                                        padding: '4px 10px',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.84rem', 
                                                                        fontWeight: 700, 
                                                                        textDecoration: 'none' 
                                                                    }}
                                                                >
                                                                    <Phone size={13} /> {app.phone}
                                                                    <span style={{ fontSize: '0.68rem', color: '#0284c7' }}>• Tap to Call</span>
                                                                </a>
                                                            </div>
                                                        </div>

                                                        {/* Scheduled Visit Slot Box */}
                                                        <div style={{ 
                                                            background: dateFilterField === 'visitDate' && appointmentViewMode === 'date_wise' ? '#f5f3ff' : '#f8fafc', 
                                                            borderRadius: '10px', 
                                                            padding: '10px 12px', 
                                                            border: dateFilterField === 'visitDate' && appointmentViewMode === 'date_wise' ? '1.5px solid #ddd6fe' : '1px solid #e2e8f0', 
                                                            display: 'flex', 
                                                            flexDirection: 'column', 
                                                            gap: '4px', 
                                                            fontSize: '0.82rem' 
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ color: dateFilterField === 'visitDate' && appointmentViewMode === 'date_wise' ? '#6d28d9' : '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                                                    🏥 Clinic visitDate:
                                                                </span>
                                                                <strong style={{ color: dateFilterField === 'visitDate' && appointmentViewMode === 'date_wise' ? '#5b21b6' : '#0f172a', fontSize: '0.88rem' }}>
                                                                    {app.date} ({app.time})
                                                                </strong>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Department:</span>
                                                                <span style={{ color: '#334155', fontWeight: 700 }}>{app.department}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '2px' }}>
                                                                <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Booking Submitted:</span>
                                                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{info.formattedDate} • {info.formattedTime}</span>
                                                            </div>
                                                        </div>

                                                        {/* Bottom Action Controls */}
                                                        <div>
                                                            {app.status === 'Pending' && (
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                                    <button 
                                                                        onClick={() => updateStatus(app.id, 'Confirmed')} 
                                                                        style={{ background: '#16a34a', color: 'white', padding: '9px 0', fontSize: '0.84rem', fontWeight: 800, borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                                                                    >
                                                                        ✓ Confirm
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => updateStatus(app.id, 'Cancelled')} 
                                                                        style={{ background: '#dc2626', color: 'white', padding: '9px 0', fontSize: '0.84rem', fontWeight: 800, borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                                                                    >
                                                                        ✕ Cancel
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {app.status === 'Confirmed' && (
                                                                <button 
                                                                    onClick={() => updateStatus(app.id, 'Completed')} 
                                                                    style={{ background: '#0284c7', color: 'white', padding: '9px 0', fontSize: '0.84rem', fontWeight: 800, borderRadius: '8px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'center' }}
                                                                >
                                                                    ✓ Mark Consultation Completed
                                                                </button>
                                                            )}
                                                            {app.status === 'Completed' && (
                                                                <div style={{ textAlign: 'center', padding: '7px', background: '#dcfce7', borderRadius: '8px', color: '#15803d', fontSize: '0.8rem', fontWeight: 800 }}>
                                                                    ✓ Consultation Completed
                                                                </div>
                                                            )}
                                                            {app.status === 'Cancelled' && (
                                                                <div style={{ textAlign: 'center', padding: '7px', background: '#fee2e2', borderRadius: '8px', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 800 }}>
                                                                    ✕ Appointment Cancelled
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Fragment>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* ==================== DESKTOP TABLE (ELEGANT & CLEAN) ==================== */
                                    <div style={{ overflowX: 'auto', width: '100%' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '880px' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #e2e8f0' }}>
                                                    {dateFilterField === 'visitDate' && appointmentViewMode === 'date_wise' ? (
                                                        <>
                                                            <th style={{ padding: '14px 20px', fontWeight: 800, color: '#7c3aed' }}>🏥 visitDate</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Patient Info</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Department</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>📅 Booking Submitted</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Tracking ID</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Status</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <th style={{ padding: '14px 20px', fontWeight: 800, color: dateFilterField === 'bookingDate' && appointmentViewMode === 'date_wise' ? '#7c3aed' : '#475569' }}>
                                                                📅 {dateFilterField === 'bookingDate' && appointmentViewMode === 'date_wise' ? 'bookingDate' : 'Booking Submitted'}
                                                            </th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Patient Info</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Department</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>🏥 Scheduled visitDate</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Tracking ID</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700 }}>Status</th>
                                                            <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAppointments.map((app, index) => {
                                                    const info = getExactBookingDateTime(app);
                                                    const prevApp = index > 0 ? filteredAppointments[index - 1] : null;
                                                    const prevInfo = prevApp ? getExactBookingDateTime(prevApp) : null;

                                                    const isNewDateGroup = appointmentViewMode === 'all'
                                                        ? ((sortBy === 'booked_asc' || sortBy === 'booked_asc_oldest_day') && (!prevInfo || prevInfo.dateStr !== info.dateStr))
                                                        : (index === 0);

                                                    const groupCount = appointmentViewMode === 'all'
                                                        ? filteredAppointments.filter(item => getExactBookingDateTime(item).dateStr === info.dateStr).length
                                                        : filteredAppointments.length;

                                                    return (
                                                        <Fragment key={app.id || app.trackingId || index}>
                                                            {/* Desktop Date Divider Row */}
                                                            {isNewDateGroup && (
                                                                <tr style={{ background: appointmentViewMode === 'date_wise' ? '#f5f3ff' : '#f8fafc', borderTop: index > 0 ? '2px solid #cbd5e1' : 'none', borderBottom: appointmentViewMode === 'date_wise' ? '1.5px solid #ddd6fe' : '1.5px solid #cbd5e1' }}>
                                                                    <td colSpan="7" style={{ padding: '10px 20px', background: appointmentViewMode === 'date_wise' ? '#f5f3ff' : '#f8fafc' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <span style={{ fontSize: '1rem' }}>{appointmentViewMode === 'date_wise' ? (dateFilterField === 'visitDate' ? '🏥' : '📅') : '📅'}</span>
                                                                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: appointmentViewMode === 'date_wise' ? '#5b21b6' : '#0f172a' }}>
                                                                                    {appointmentViewMode === 'date_wise'
                                                                                        ? (dateFilterField === 'visitDate'
                                                                                            ? `visitDate: ${formatDisplayDate(selectedDateFilter || app.date)}`
                                                                                            : `bookingDate: ${formatDisplayDate(selectedDateFilter || info.dateStr)}`)
                                                                                        : `Records for ${info.formattedDate}`}
                                                                                </span>
                                                                                {appointmentViewMode === 'date_wise' && (
                                                                                    <span style={{ background: '#7c3aed', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '50px' }}>
                                                                                        {dateFilterField === 'visitDate' ? 'visitDate' : 'bookingDate'}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                                                {groupCount} patient{groupCount !== 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}

                                                            <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                                                                {dateFilterField === 'visitDate' && appointmentViewMode === 'date_wise' ? (
                                                                    <>
                                                                        {/* COLUMN 1: visitDate */}
                                                                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                                                                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                                                                                🏥 {app.date}
                                                                            </div>
                                                                            <div style={{ color: '#7c3aed', fontSize: '0.8rem', fontWeight: 700, marginTop: '2px' }}>
                                                                                🕒 {app.time} Slot
                                                                            </div>
                                                                        </td>

                                                                        {/* COLUMN 2: PATIENT INFO */}
                                                                        <td style={{ padding: '14px 20px' }}>
                                                                            <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.95rem' }}>{app.patientName}</strong>
                                                                            <a href={`tel:${app.phone}`} style={{ color: '#0284c7', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>📞 {app.phone}</a>
                                                                        </td>

                                                                        {/* COLUMN 3: DEPARTMENT */}
                                                                        <td style={{ padding: '14px 20px', fontWeight: 600, color: '#334155', fontSize: '0.88rem' }}>
                                                                            {app.department}
                                                                        </td>

                                                                        {/* COLUMN 4: BOOKING SUBMISSION TIME */}
                                                                        <td style={{ padding: '14px 20px' }}>
                                                                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>📅 {info.formattedDate}</div>
                                                                            <div style={{ color: '#64748b', fontSize: '0.78rem' }}>🕒 {info.formattedTime}</div>
                                                                        </td>

                                                                        {/* COLUMN 5: TRACKING ID */}
                                                                        <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', fontSize: '0.88rem' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                <span>{app.trackingId}</span>
                                                                                <button 
                                                                                    onClick={() => copyTrackingId(app.trackingId)}
                                                                                    type="button"
                                                                                    title="Copy Tracking ID"
                                                                                    style={{ background: copiedTrackingId === app.trackingId ? '#dcfce7' : '#f1f5f9', border: '1px solid #cbd5e1', color: copiedTrackingId === app.trackingId ? '#15803d' : '#64748b', borderRadius: '6px', padding: '3px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
                                                                                >
                                                                                    {copiedTrackingId === app.trackingId ? <Check size={11} /> : <Copy size={11} />}
                                                                                </button>
                                                                            </div>
                                                                        </td>

                                                                        {/* COLUMN 6: STATUS BADGE */}
                                                                        <td style={{ padding: '14px 20px' }}>
                                                                            <span style={{ ...getStatusBadgeStyle(app.status), padding: '4px 10px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-block' }}>
                                                                                {app.status}
                                                                            </span>
                                                                        </td>

                                                                        {/* COLUMN 7: ACTIONS */}
                                                                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                                                {app.status === 'Pending' && (
                                                                                    <>
                                                                                        <button onClick={() => updateStatus(app.id, 'Confirmed')} style={{ background: '#16a34a', color: 'white', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '50px', border: 'none', cursor: 'pointer' }}>Confirm</button>
                                                                                        <button onClick={() => updateStatus(app.id, 'Cancelled')} style={{ background: '#dc2626', color: 'white', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '50px', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                                                                    </>
                                                                                )}
                                                                                {app.status === 'Confirmed' && (
                                                                                    <button onClick={() => updateStatus(app.id, 'Completed')} style={{ background: '#0284c7', color: 'white', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '50px', border: 'none', cursor: 'pointer' }}>Complete</button>
                                                                                )}
                                                                                {app.status === 'Completed' && (
                                                                                    <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>✓ Done</span>
                                                                                )}
                                                                                <button onClick={() => deleteAppointment(app.id)} title="Delete record" style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '6px' }}>
                                                                                    <Trash2 size={15} />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {/* COLUMN 1: BOOKING CREATED */}
                                                                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                                                                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                                                                                📅 {info.formattedDate}
                                                                            </div>
                                                                            <div style={{ color: '#0284c7', fontSize: '0.8rem', fontWeight: 600, marginTop: '2px' }}>
                                                                                🕒 {info.formattedTime}
                                                                            </div>
                                                                        </td>

                                                                        {/* COLUMN 2: PATIENT INFO */}
                                                                        <td style={{ padding: '14px 20px' }}>
                                                                            <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.95rem' }}>{app.patientName}</strong>
                                                                            <a href={`tel:${app.phone}`} style={{ color: '#0284c7', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 600 }}>📞 {app.phone}</a>
                                                                        </td>

                                                                        {/* COLUMN 3: DEPARTMENT */}
                                                                        <td style={{ padding: '14px 20px', fontWeight: 600, color: '#334155', fontSize: '0.88rem' }}>
                                                                            {app.department}
                                                                        </td>

                                                                        {/* COLUMN 4: VISIT DATE & SLOT */}
                                                                        <td style={{ padding: '14px 20px' }}>
                                                                            <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.88rem' }}>🏥 {app.date}</strong>
                                                                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>🕒 {app.time} Slot</span>
                                                                        </td>

                                                                        {/* COLUMN 5: TRACKING ID */}
                                                                        <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', fontSize: '0.88rem' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                <span>{app.trackingId}</span>
                                                                                <button 
                                                                                    onClick={() => copyTrackingId(app.trackingId)}
                                                                                    type="button"
                                                                                    title="Copy Tracking ID"
                                                                                    style={{ background: copiedTrackingId === app.trackingId ? '#dcfce7' : '#f1f5f9', border: '1px solid #cbd5e1', color: copiedTrackingId === app.trackingId ? '#15803d' : '#64748b', borderRadius: '6px', padding: '3px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
                                                                                >
                                                                                    {copiedTrackingId === app.trackingId ? <Check size={11} /> : <Copy size={11} />}
                                                                                </button>
                                                                            </div>
                                                                        </td>

                                                                        {/* COLUMN 6: STATUS BADGE */}
                                                                        <td style={{ padding: '14px 20px' }}>
                                                                            <span style={{ ...getStatusBadgeStyle(app.status), padding: '4px 10px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-block' }}>
                                                                                {app.status}
                                                                            </span>
                                                                        </td>

                                                                        {/* COLUMN 7: ACTIONS */}
                                                                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                                                {app.status === 'Pending' && (
                                                                                    <>
                                                                                        <button onClick={() => updateStatus(app.id, 'Confirmed')} style={{ background: '#16a34a', color: 'white', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '50px', border: 'none', cursor: 'pointer' }}>Confirm</button>
                                                                                        <button onClick={() => updateStatus(app.id, 'Cancelled')} style={{ background: '#dc2626', color: 'white', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '50px', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                                                                    </>
                                                                                )}
                                                                                {app.status === 'Confirmed' && (
                                                                                    <button onClick={() => updateStatus(app.id, 'Completed')} style={{ background: '#0284c7', color: 'white', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '50px', border: 'none', cursor: 'pointer' }}>Complete</button>
                                                                                )}
                                                                                {app.status === 'Completed' && (
                                                                                    <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>✓ Done</span>
                                                                                )}
                                                                                <button onClick={() => deleteAppointment(app.id)} title="Delete record" style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '6px' }}>
                                                                                    <Trash2 size={15} />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </>
                                                                )}
                                                            </tr>
                                                        </Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                            </div>
                        )}

                        {/* ==================== TAB 3: PATIENT DIRECTORY ==================== */}
                        {activeTab === 'patients' && (
                            <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', width: '100%' }}>
                                <div style={{ padding: isMobile ? '14px 16px' : '20px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                    <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#0f172a' }}>Patient Directory</h2>
                                    <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '0.78rem' }}>Unique registered patients compiled from consultation logs</p>
                                </div>

                                {isMobile ? (
                                    /* Mobile Patient Cards */
                                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {uniquePatientsList.length === 0 ? (
                                            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>No registered patient profiles found.</div>
                                        ) : (
                                            uniquePatientsList.map((patient, idx) => (
                                                <div key={idx} style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{patient.name}</span>
                                                        <span style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '50px', fontSize: '0.74rem', fontWeight: 800 }}>
                                                            {patient.visits} Visit{patient.visits > 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <a href={`tel:${patient.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0284c7', fontSize: '0.84rem', fontWeight: 700, textDecoration: 'none' }}>
                                                            <Phone size={12} /> {patient.phone}
                                                        </a>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', borderTop: '1px dashed #f1f5f9', paddingTop: '6px', marginTop: '4px' }}>
                                                        <span>🩺 {patient.lastDepartment}</span>
                                                        <span>📅 Last: {patient.lastVisit}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    /* Desktop Patient Table */
                                    <div style={{ overflowX: 'auto', width: '100%' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #e2e8f0' }}>
                                                    <th style={{ padding: '14px 24px', fontWeight: 700 }}>Patient Name</th>
                                                    <th style={{ padding: '14px 24px', fontWeight: 700 }}>Contact Phone</th>
                                                    <th style={{ padding: '14px 24px', fontWeight: 700 }}>Total Consultations</th>
                                                    <th style={{ padding: '14px 24px', fontWeight: 700 }}>Last Department</th>
                                                    <th style={{ padding: '14px 24px', fontWeight: 700 }}>Last Visit Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {uniquePatientsList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>No registered patient profiles found.</td>
                                                    </tr>
                                                ) : (
                                                    uniquePatientsList.map((patient, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '16px 24px', fontWeight: 800, color: '#0f172a', fontSize: '0.94rem' }}>{patient.name}</td>
                                                            <td style={{ padding: '16px 24px', color: '#475569', fontWeight: 600, fontSize: '0.88rem' }}>
                                                                <a href={`tel:${patient.phone}`} style={{ color: '#0284c7', textDecoration: 'none' }}>📞 {patient.phone}</a>
                                                            </td>
                                                            <td style={{ padding: '16px 24px' }}>
                                                                <span style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800 }}>
                                                                    {patient.visits} Visit{patient.visits > 1 ? 's' : ''}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '16px 24px', color: '#334155', fontWeight: 600, fontSize: '0.88rem' }}>{patient.lastDepartment}</td>
                                                            <td style={{ padding: '16px 24px', color: '#64748b', fontSize: '0.85rem' }}>📅 {patient.lastVisit}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, Search, Download, CheckCircle, Clock, Activity, Trash2, ArrowUpDown, Filter, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

// Universal robust helper to normalize any date string format into YYYY-MM-DD
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
        // Convert SQLite format "YYYY-MM-DD HH:MM:SS" to ISO
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(safeStr)) {
            safeStr = safeStr.replace(' ', 'T') + 'Z';
        }
        const d = new Date(safeStr);
        if (!isNaN(d.getTime())) {
            dateObj = d;
        }
    }

    // Fallback: If no createdAt, derive from app.date (slot date)
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

    // Final fallback: deterministic past epoch offset by ID
    if (!dateObj) {
        const idOffset = (Number(app.id) || 0) * 1000;
        dateObj = new Date(1788998400000 + idOffset);
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
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
    useEffect(() => {
        document.title = "Admin Portal | Dilip Dey Clinic";
    }, []);

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
    const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    
    // UI & Filter States
    const [activeTab, setActiveTab] = useState('overview');
    // appointmentViewMode: 'all' (All Appointments: auto-sorted date-wise, no date picker needed) vs 'date_wise' (Date-wise Appointments)
    const [appointmentViewMode, setAppointmentViewMode] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    
    // Unified Date filter state for Date-wise Appointments mode
    const [selectedDateFilter, setSelectedDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
    // Date filter target: 'slot_date' (Scheduled Visit Date - DEFAULT) or 'booking_date' (Booking Submission Date)
    const [dateFilterField, setDateFilterField] = useState('slot_date');
    const [sortBy, setSortBy] = useState('booked_asc'); // default: date-wise queue format

    const handleLogout = useCallback(() => {
        setToken(null);
        localStorage.removeItem('adminToken');
    }, []);

    // Safe comparison: matching trackingId or exact appointment details (never comparing arbitrary integer IDs)
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
        const activeToken = token || localStorage.getItem('adminToken');

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
                        onProgress(`Syncing with server database... (Connecting attempt ${attempt}/${maxAttempts})`);
                    }

                    const res = await axios.get(`https://doctor-s-backend-2.onrender.com/api/appointments?_t=${Date.now()}`, {
                        headers: { 
                            Authorization: `Bearer ${activeToken}`,
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        },
                        timeout: 25000 // Resilient 25s timeout to gracefully absorb Render free-tier cold starts
                    });
                    
                    if (res.data && Array.isArray(res.data.appointments)) {
                        const backendList = res.data.appointments;
                        const mergedList = [...backendList];

                        // Safely preserve any locally cached records that are not yet on backend
                        const missingOnBackend = [];
                        savedCache.forEach(cached => {
                            if (!cached) return;
                            const exists = mergedList.some(b => isSameAppointment(cached, b));
                            if (!exists) {
                                mergedList.push(cached);
                                missingOnBackend.push(cached);
                            }
                        });

                        // Preserve booking timestamps accurately
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

                        // If any records existed locally that were missing on backend (e.g. after a server restart/deploy),
                        // seamlessly sync them to the backend in the background so the server database is restored!
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
                    // For transient cold starts, rate limits, or network drops, back off and retry automatically
                    if (attempt < maxAttempts) {
                        await new Promise(r => setTimeout(r, attempt * 1200));
                    }
                }
            }

            if (lastError) {
                throw lastError;
            }
        } finally {
            // ALWAYS reset sync and loading state so buttons and UI are never stuck
            setIsSyncing(false);
            setLoading(false);
        }
    }, [token, handleLogout]);

    const handleManualRefresh = async () => {
        setIsSyncing(true);
        setRefreshStatus('syncing');
        setRefreshFeedback('Syncing with server database...');
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
                setRefreshFeedback('⚠ Network connection slow. Keeping current records safe.');
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

    // Load cached logs on mount instantly so user sees all logs anytime
    useEffect(() => {
        if (!token) return;
        const savedCache = JSON.parse(localStorage.getItem('admin_appointments_cache') || '[]');
        if (savedCache.length > 0) {
            setAppointments(savedCache);
            setLoading(false);
        }
    }, [token]);

    // Live Real-Time Auto-Sync Effect (Polls smoothly when tab is visible)
    useEffect(() => {
        if (!token) return;

        fetchAppointments(false); // Initial load

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchAppointments(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchAppointments(true); // Silent background sync
            }
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
            const jwtToken = res.data.token;
            setToken(jwtToken);
            localStorage.setItem('adminToken', jwtToken);
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

    // --- Helper: Format Accurate Booking Date & Time ---
    const getExactBookingDateTime = (app) => {
        const savedTimestamps = JSON.parse(localStorage.getItem('clinic_booking_timestamps') || '{}');
        return extractBookingInfo(app, savedTimestamps);
    };

    // --- Derived Statistics ---
    const todayStr = new Date().toISOString().split('T')[0];
    
    const stats = useMemo(() => {
        const todayCount = appointments.filter(a => a.date === todayStr).length;
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

    // --- Redesigned Filter & Sort Logic ---
    const filteredAppointments = useMemo(() => {
        const savedTimestamps = JSON.parse(localStorage.getItem('clinic_booking_timestamps') || '{}');

        // Pre-compute booking info for all appointments for speed and consistency
        const infoMap = new Map();
        appointments.forEach(app => {
            const key = app.trackingId || `id_${app.id}`;
            infoMap.set(key, extractBookingInfo(app, savedTimestamps));
        });

        let list = appointments.filter(app => {
            const key = app.trackingId || `id_${app.id}`;
            const info = infoMap.get(key) || extractBookingInfo(app, savedTimestamps);

            const term = searchTerm.toLowerCase();
            const matchesSearch =
                !term ||
                (app.patientName && app.patientName.toLowerCase().includes(term)) ||
                (app.phone && app.phone.includes(term)) ||
                (app.trackingId && app.trackingId.toLowerCase().includes(term)) ||
                (app.department && app.department.toLowerCase().includes(term));

            const matchesStatus = statusFilter === 'All' || app.status === statusFilter;

            // In 'all' mode, all dates across all days are included automatically
            // In 'date_wise' mode, strictly filter ONLY records matching the selected date!
            let matchesDate = true;
            if (appointmentViewMode === 'date_wise') {
                const targetNorm = normalizeDateStr(selectedDateFilter);
                if (targetNorm && targetNorm !== 'All') {
                    const appDateNorm = normalizeDateStr(app.date);
                    const bookingDateNorm = info.dateStr;
                    if (dateFilterField === 'slot_date') {
                        matchesDate = (appDateNorm === targetNorm);
                    } else if (dateFilterField === 'booking_date') {
                        matchesDate = (bookingDateNorm === targetNorm);
                    } else {
                        matchesDate = (appDateNorm === targetNorm || bookingDateNorm === targetNorm);
                    }
                }
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

        // Master Deterministic Sorting
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
                        if (infoA.timestamp !== infoB.timestamp) {
                            return infoA.timestamp - infoB.timestamp;
                        }
                        return idA - idB;
                    }

                    // USER REQUIRED DEFAULT LOGIC for 'all' mode:
                    // 1. Group date-wise: Newest booking date at top (10 Sep first, then 9 Sep, then 8 Sep)
                    const dateCompare = infoB.dateStr.localeCompare(infoA.dateStr);
                    if (dateCompare !== 0) return dateCompare;

                    // 2. Within each booking date: Earliest submission at top, newest at bottom of that day
                    // (e.g. 7:00 AM at top, 11:00 AM at bottom, newest booking booked just now at very bottom of today)
                    if (infoA.timestamp !== infoB.timestamp) {
                        return infoA.timestamp - infoB.timestamp;
                    }
                    return idA - idB;
                }

                case 'booked_asc_oldest_day': {
                    // 1. Group date-wise: Oldest booking date at top (8 Sep first, then 9 Sep, then 10 Sep)
                    const dateCompare = infoA.dateStr.localeCompare(infoB.dateStr);
                    if (dateCompare !== 0) return dateCompare;

                    // 2. Within each day: Earliest submission at top, newest at bottom
                    if (infoA.timestamp !== infoB.timestamp) {
                        return infoA.timestamp - infoB.timestamp;
                    }
                    return idA - idB;
                }

                case 'booked_desc': {
                    // Pure latest submission overall first (who booked just now at very top)
                    if (infoA.timestamp !== infoB.timestamp) {
                        return infoB.timestamp - infoA.timestamp;
                    }
                    return idB - idA;
                }

                case 'pure_oldest_first': {
                    // Pure oldest submission overall first (first patient ever at very top)
                    if (infoA.timestamp !== infoB.timestamp) {
                        return infoA.timestamp - infoB.timestamp;
                    }
                    return idA - idB;
                }

                case 'name_asc': {
                    const nameA = (a.patientName || '').toLowerCase();
                    const nameB = (b.patientName || '').toLowerCase();
                    const cmp = nameA.localeCompare(nameB);
                    if (cmp !== 0) return cmp;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }

                case 'name_desc': {
                    const nameA = (a.patientName || '').toLowerCase();
                    const nameB = (b.patientName || '').toLowerCase();
                    const cmp = nameB.localeCompare(nameA);
                    if (cmp !== 0) return cmp;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }

                case 'time_slot_asc': {
                    // Morning -> Afternoon -> Evening
                    const rank = { 'Morning': 1, 'Afternoon': 2, 'Evening': 3 };
                    const rankA = rank[a.time] || 99;
                    const rankB = rank[b.time] || 99;
                    if (rankA !== rankB) return rankA - rankB;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }

                case 'time_slot_desc': {
                    // Evening -> Afternoon -> Morning
                    const rank = { 'Evening': 1, 'Afternoon': 2, 'Morning': 3 };
                    const rankA = rank[a.time] || 99;
                    const rankB = rank[b.time] || 99;
                    if (rankA !== rankB) return rankA - rankB;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }

                case 'status_flow': {
                    // Pending -> Confirmed -> Completed -> Cancelled
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
                    // Slot Visit Date: Earliest slot date first
                    const apptDiff = new Date(a.date || 0) - new Date(b.date || 0);
                    if (apptDiff !== 0) return apptDiff;
                    return infoA.timestamp - infoB.timestamp || idA - idB;
                }

                case 'appt_date_desc': {
                    // Slot Visit Date: Latest slot date first
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

    // --- CSV Export ---
    const exportToCSV = () => {
        const headers = ['Tracking ID', 'Booking Time', 'Appt Date', 'Time Slot', 'Patient Name', 'Phone', 'Department', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredAppointments.map(a => `"${a.trackingId || ''}","${getExactBookingDateTime(a).formattedDate + ' ' + getExactBookingDateTime(a).formattedTime}","${a.date}","${a.time}","${a.patientName}","${a.phone}","${a.department}","${a.status}"`)
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
            case 'Confirmed': return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
            case 'Completed': return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
            case 'Cancelled': return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' };
            default: return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
        }
    };

    // --- RENDER AUTH / LOGIN ---
    if (!token) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '24px' }}>
                <div style={{ background: '#ffffff', borderRadius: '24px', textAlign: 'center', width: '100%', maxWidth: '420px', padding: '48px 36px', boxShadow: '0 20px 45px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                    <div style={{ background: '#e0f2fe', color: '#0284c7', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Activity size={32} />
                    </div>
                    <h2 style={{ marginBottom: '8px', fontSize: '1.6rem', fontWeight: 700, color: '#0f172a' }}>Clinical Portal</h2>
                    <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '0.92rem' }}>Secure Management Access</p>
                    
                    {loginError && <p style={{ color: '#b91c1c', marginBottom: '24px', fontSize: '0.88rem', backgroundColor: '#fee2e2', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fecaca' }}>{loginError}</p>}
                    
                    <form onSubmit={handleLogin}>
                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: '8px' }}>Master Password</label>
                            <input 
                                type="password" 
                                placeholder="Enter access code" 
                                className="form-control"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '1rem' }}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '15px 0', fontSize: '0.9rem', borderRadius: '50px' }}>Authenticate & Access</button>
                    </form>
                    <Link to="/" style={{ display: 'inline-block', marginTop: '32px', color: '#64748b', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500 }}>← Return to Public Website</Link>
                </div>
            </div>
        );
    }

    // --- RENDER FULL SCREEN DASHBOARD ---
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f8fafc', width: '100%' }}>
            
            {/* TOP HEADER BAR (PC & Mobile) */}
            <header style={{ background: '#0f172a', color: '#ffffff', padding: '0 32px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ background: '#0284c7', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Activity size={20} color="white" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em', color: '#ffffff' }}>Dr. Dey Clinic Admin</h2>
                        <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 500 }}>Live Medical Management</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 600, color: '#10b981' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span> Live Sync (Active)
                    </div>
                    <button 
                        onClick={handleManualRefresh} 
                        disabled={isSyncing}
                        title="Manual Refresh from Server" 
                        style={{ 
                            background: isSyncing ? 'rgba(2, 132, 199, 0.4)' : refreshStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.12)', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            color: '#ffffff', 
                            padding: '8px 16px', 
                            borderRadius: '50px', 
                            cursor: isSyncing ? 'not-allowed' : 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            fontSize: '0.82rem', 
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                    >
                        <RefreshCw size={14} className={isSyncing ? "spin" : ""} /> 
                        {isSyncing ? "Syncing..." : refreshStatus === 'success' ? "✓ Synced!" : "Refresh"}
                    </button>
                    <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500, padding: '6px 14px', borderRadius: '50px', background: 'rgba(255,255,255,0.05)' }}>Live Site ↗</Link>
                    <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 16px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LogOut size={14} /> Exit
                    </button>
                </div>
            </header>

            {/* Quick Feedback Toast Banner */}
            {refreshFeedback && (
                <div style={{
                    background: refreshStatus === 'error' ? '#fee2e2' : '#dcfce7',
                    color: refreshStatus === 'error' ? '#b91c1c' : '#15803d',
                    borderBottom: `1px solid ${refreshStatus === 'error' ? '#fca5a5' : '#86efac'}`,
                    padding: '10px 32px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    transition: 'all 0.3s'
                }}>
                    {refreshFeedback}
                </div>
            )}

            {/* DASHBOARD NAVIGATION & TOOLBAR */}
            <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 32px' }}>
                <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    
                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
                        {[
                            { id: 'overview', icon: <LayoutDashboard size={18}/>, label: 'Overview' },
                            { id: 'appointments', icon: <Calendar size={18}/>, label: `Appointments (${appointments.length})` },
                            { id: 'patients', icon: <Users size={18}/>, label: `Patient Directory (${uniquePatientsList.length})` }
                        ].map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                                    borderBottom: activeTab === item.id ? '3px solid #0284c7' : '3px solid transparent',
                                    color: activeTab === item.id ? '#0284c7' : '#64748b',
                                    backgroundColor: 'transparent',
                                    border: 'none', cursor: 'pointer', fontSize: '0.92rem', fontWeight: activeTab === item.id ? 700 : 500,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {item.icon} {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Quick Stats Summary */}
                    <div style={{ display: 'flex', gap: '20px', padding: '12px 0', fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                        <span style={{ color: '#0284c7' }}>● {stats.todayCount} Today</span>
                        <span style={{ color: '#d97706' }}>● {stats.pendingCount} Pending</span>
                        <span style={{ color: '#16a34a' }}>● {stats.confirmedCount} Confirmed</span>
                    </div>

                </div>
            </div>

            {/* MAIN FULL-SCREEN CONTENT AREA */}
            <main style={{ flex: 1, padding: '32px', width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
                
                {loading && appointments.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px', color: '#64748b', fontSize: '1.05rem', fontWeight: 500 }}>Syncing clinical records from server...</div>
                )}

                {(appointments.length > 0 || !loading) && (
                    <>
                        {/* ==================== TAB 1: OVERVIEW ==================== */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                
                                {/* KPI Cards Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                                    <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', borderLeft: '5px solid #0284c7' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Today's Bookings</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>{stats.todayCount}</div>
                                    </div>
                                    <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', borderLeft: '5px solid #f59e0b' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Pending Requests</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#d97706' }}>{stats.pendingCount}</div>
                                    </div>
                                    <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', borderLeft: '5px solid #16a34a' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Confirmed Patients</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#16a34a' }}>{stats.confirmedCount}</div>
                                    </div>
                                    <div style={{ background: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', borderLeft: '5px solid #6366f1' }}>
                                        <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Patient Base</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4338ca' }}>{stats.uniquePatients}</div>
                                    </div>
                                </div>

                                {/* Needs Immediate Attention Table */}
                                <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.03)' }}>
                                    <div style={{ padding: '20px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Pending Requests (Requires Action)</h3>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Newest patient submissions awaiting confirmation</p>
                                        </div>
                                        <button onClick={() => setActiveTab('appointments')} style={{ background: '#e0f2fe', border: 'none', color: '#0284c7', padding: '8px 16px', borderRadius: '50px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>View All ({appointments.length}) →</button>
                                    </div>

                                    {appointments.filter(a => a.status === 'Pending').length === 0 ? (
                                        <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                                            <CheckCircle size={36} color="#16a34a" style={{ marginBottom: '12px' }} />
                                            <p style={{ margin: 0, fontWeight: 600 }}>All pending requests have been processed!</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        <th style={{ padding: '14px 24px' }}>Booking Created</th>
                                                        <th style={{ padding: '14px 24px' }}>Patient Details</th>
                                                        <th style={{ padding: '14px 24px' }}>Department</th>
                                                        <th style={{ padding: '14px 24px' }}>Requested Slot</th>
                                                        <th style={{ padding: '14px 24px' }}>Tracking Code</th>
                                                        <th style={{ padding: '14px 24px', textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {appointments.filter(a => a.status === 'Pending')
                                                        .sort((a, b) => {
                                                            const infoA = getExactBookingDateTime(a);
                                                            const infoB = getExactBookingDateTime(b);
                                                            const dateCompare = infoB.dateStr.localeCompare(infoA.dateStr);
                                                            if (dateCompare !== 0) return dateCompare;
                                                            return infoA.timestamp - infoB.timestamp;
                                                        })
                                                        .map(app => (
                                                        <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '18px 24px', whiteSpace: 'nowrap' }}>
                                                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                                                                    📅 {getExactBookingDateTime(app).formattedDate}
                                                                </div>
                                                                <div style={{ color: '#0284c7', fontSize: '0.84rem', fontWeight: 600, marginTop: '2px' }}>
                                                                    🕒 {getExactBookingDateTime(app).formattedTime}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '18px 24px' }}>
                                                                <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.98rem' }}>{app.patientName}</strong>
                                                                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>📞 {app.phone}</span>
                                                            </td>
                                                            <td style={{ padding: '18px 24px', fontWeight: 600, color: '#334155' }}>{app.department}</td>
                                                            <td style={{ padding: '18px 24px' }}>
                                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{app.date}</div>
                                                                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{app.time}</div>
                                                            </td>
                                                            <td style={{ padding: '18px 24px', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>{app.trackingId}</td>
                                                            <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                    <button onClick={() => updateStatus(app.id, 'Confirmed')} className="btn" style={{ background: '#16a34a', color: 'white', padding: '8px 16px', fontSize: '0.82rem', borderRadius: '50px' }}>Confirm</button>
                                                                    <button onClick={() => updateStatus(app.id, 'Cancelled')} className="btn" style={{ background: '#dc2626', color: 'white', padding: '8px 16px', fontSize: '0.82rem', borderRadius: '50px' }}>Cancel</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}

                        {/* ==================== TAB 2: APPOINTMENTS FULL SCREEN ==================== */}
                        {activeTab === 'appointments' && (
                            <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', width: '100%' }}>
                                
                                {/* CONTROL TOOLBAR: Search, Filter, Sort, Export */}
                                <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                        <div>
                                            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Patient Appointments</h2>
                                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                                                {appointmentViewMode === 'all'
                                                    ? `Showing all ${filteredAppointments.length} appointments across all dates`
                                                    : `Showing ${filteredAppointments.length} matching appointment${filteredAppointments.length !== 1 ? 's' : ''} for selected date`}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <button 
                                                type="button"
                                                onClick={handleManualRefresh} 
                                                disabled={isSyncing}
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px', 
                                                    padding: '10px 20px', 
                                                    borderRadius: '50px', 
                                                    fontSize: '0.85rem', 
                                                    fontWeight: 700,
                                                    background: isSyncing ? '#f1f5f9' : refreshStatus === 'success' ? '#dcfce7' : '#0284c7',
                                                    color: isSyncing ? '#64748b' : refreshStatus === 'success' ? '#15803d' : '#ffffff',
                                                    border: refreshStatus === 'success' ? '1.5px solid #86efac' : isSyncing ? '1px solid #cbd5e1' : 'none',
                                                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                                                    boxShadow: isSyncing ? 'none' : '0 2px 8px rgba(2, 132, 199, 0.25)',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Fetch latest appointments directly from server database"
                                            >
                                                <RefreshCw size={15} className={isSyncing ? "spin" : ""} /> 
                                                {isSyncing ? "Syncing Server..." : refreshStatus === 'success' ? "✓ Updated Just Now" : "🔄 Refresh Records"}
                                            </button>
                                            <button onClick={exportToCSV} className="btn btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 20px', borderRadius: '50px', fontSize: '0.85rem' }}>
                                                <Download size={16} /> Export to CSV
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Segmented Control: All Appointments vs Date-wise Appointments ── */}
                                    <div style={{ display: 'flex', gap: '10px', background: '#e2e8f0', padding: '5px', borderRadius: '14px', width: 'fit-content' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAppointmentViewMode('all');
                                                setSortBy('booked_asc');
                                            }}
                                            style={{
                                                padding: '10px 22px',
                                                borderRadius: '10px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: appointmentViewMode === 'all' ? 800 : 600,
                                                fontSize: '0.88rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                background: appointmentViewMode === 'all' ? '#0284c7' : 'transparent',
                                                color: appointmentViewMode === 'all' ? '#ffffff' : '#475569',
                                                boxShadow: appointmentViewMode === 'all' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Calendar size={16} /> All Appointments
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAppointmentViewMode('date_wise')}
                                            style={{
                                                padding: '10px 22px',
                                                borderRadius: '10px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: appointmentViewMode === 'date_wise' ? 800 : 600,
                                                fontSize: '0.88rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                background: appointmentViewMode === 'date_wise' ? '#0284c7' : 'transparent',
                                                color: appointmentViewMode === 'date_wise' ? '#ffffff' : '#475569',
                                                boxShadow: appointmentViewMode === 'date_wise' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Filter size={16} /> Date-wise Appointments (Select Date)
                                        </button>
                                    </div>

                                    {/* ── View Mode Info Note ── */}
                                    {appointmentViewMode === 'all' ? (
                                        <div style={{ background: '#e0f2fe', border: '1.5px solid #bae6fd', borderRadius: '14px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0369a1', fontSize: '0.88rem', fontWeight: 600 }}>
                                                <span style={{ fontSize: '1.2rem' }}>✨</span>
                                                <span><strong>Automatic Date-wise Queue:</strong> All appointments across all days are grouped by date (Newest day at the top). Within each day, who booked first is at the top, and latest is at the bottom.</span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', background: '#0284c7', color: '#fff', padding: '5px 14px', borderRadius: '50px', fontWeight: 800 }}>
                                                {filteredAppointments.length} Total Appointments Auto-Sorted
                                            </span>
                                        </div>
                                    ) : (
                                        <div style={{ background: '#f5f3ff', border: '2px solid #ddd6fe', borderRadius: '16px', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.05)' }}>
                                            {/* Top info and reset */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6d28d9', fontSize: '0.92rem', fontWeight: 700 }}>
                                                    <span style={{ fontSize: '1.2rem' }}>🎯</span>
                                                    <span><strong>Specific Date Filter:</strong> Only records for your chosen date are displayed. All other dates are strictly hidden.</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 800, background: '#7c3aed', color: '#fff', padding: '5px 14px', borderRadius: '50px' }}>
                                                        {filteredAppointments.length} Matching Record{filteredAppointments.length !== 1 ? 's' : ''}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setAppointmentViewMode('all');
                                                            setSelectedDateFilter(new Date().toISOString().split('T')[0]);
                                                            setSortBy('booked_asc');
                                                        }}
                                                        style={{
                                                            background: '#fee2e2',
                                                            color: '#b91c1c',
                                                            border: '1.5px solid #fca5a5',
                                                            borderRadius: '8px',
                                                            padding: '6px 14px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        View All / Reset Date ✕
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Filter Field Mode Segmented Selector */}
                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4c1d95', marginRight: '4px' }}>Filter Mode:</span>
                                                <div style={{ display: 'flex', gap: '6px', background: '#ede9fe', padding: '4px', borderRadius: '10px', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateFilterField('slot_date')}
                                                        style={{
                                                            border: 'none',
                                                            background: dateFilterField === 'slot_date' ? '#7c3aed' : 'transparent',
                                                            color: dateFilterField === 'slot_date' ? '#ffffff' : '#5b21b6',
                                                            padding: '6px 14px',
                                                            borderRadius: '8px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: dateFilterField === 'slot_date' ? 800 : 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        🏥 Scheduled Clinic Visit Date (Default)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateFilterField('booking_date')}
                                                        style={{
                                                            border: 'none',
                                                            background: dateFilterField === 'booking_date' ? '#7c3aed' : 'transparent',
                                                            color: dateFilterField === 'booking_date' ? '#ffffff' : '#5b21b6',
                                                            padding: '6px 14px',
                                                            borderRadius: '8px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: dateFilterField === 'booking_date' ? 800 : 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        📅 Booking Submission Date (When Patient Booked)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateFilterField('both')}
                                                        style={{
                                                            border: 'none',
                                                            background: dateFilterField === 'both' ? '#7c3aed' : 'transparent',
                                                            color: dateFilterField === 'both' ? '#ffffff' : '#5b21b6',
                                                            padding: '6px 14px',
                                                            borderRadius: '8px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: dateFilterField === 'both' ? 800 : 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        🔄 Either Date
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Date Picker Bar & Quick Buttons */}
                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px' }}>
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4c1d95', whiteSpace: 'nowrap' }}>
                                                        {dateFilterField === 'booking_date' ? '📅 Select Booking Date:' : dateFilterField === 'slot_date' ? '🏥 Select Visit Slot Date:' : '📅 Select Date:'}
                                                    </label>
                                                    <input 
                                                        type="date"
                                                        className="form-control"
                                                        value={selectedDateFilter || ''}
                                                        onChange={(e) => setSelectedDateFilter(e.target.value)}
                                                        style={{
                                                            borderRadius: '10px',
                                                            fontSize: '0.92rem',
                                                            fontWeight: 700,
                                                            border: '2px solid #7c3aed',
                                                            background: '#ffffff',
                                                            padding: '8px 14px'
                                                        }}
                                                    />
                                                </div>

                                                {/* Shortcut buttons */}
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedDateFilter(new Date().toISOString().split('T')[0])}
                                                        style={{
                                                            background: selectedDateFilter === new Date().toISOString().split('T')[0] ? '#7c3aed' : '#ede9fe',
                                                            color: selectedDateFilter === new Date().toISOString().split('T')[0] ? '#ffffff' : '#6d28d9',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            padding: '7px 14px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        Today
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const yest = new Date();
                                                            yest.setDate(yest.getDate() - 1);
                                                            setSelectedDateFilter(yest.toISOString().split('T')[0]);
                                                        }}
                                                        style={{
                                                            background: '#ede9fe',
                                                            color: '#6d28d9',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            padding: '7px 14px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        Yesterday
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const tmrw = new Date();
                                                            tmrw.setDate(tmrw.getDate() + 1);
                                                            setSelectedDateFilter(tmrw.toISOString().split('T')[0]);
                                                        }}
                                                        style={{
                                                            background: '#ede9fe',
                                                            color: '#6d28d9',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            padding: '7px 14px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        Tomorrow
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Live Filter Summary */}
                                            {selectedDateFilter && (
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: filteredAppointments.length === 0 ? '#b91c1c' : '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {filteredAppointments.length === 0 ? (
                                                        <span>⚠ No appointments found for {new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}. (All other dates are hidden)</span>
                                                    ) : (
                                                        <span>✓ Showing strictly {filteredAppointments.length} appointment(s) for {new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}. (All other dates are hidden)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* In date_wise mode, if 0 records match, suppress search/sort inputs to prevent clutter */}
                                    {!(appointmentViewMode === 'date_wise' && filteredAppointments.length === 0) && (
                                        <>
                                            {/* ── Row 1: Search + Status Filter ── */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Search name, phone, tracking ID..." 
                                                        className="form-control" 
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        style={{ paddingLeft: '42px', borderRadius: '12px', fontSize: '0.9rem', width: '100%' }}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Filter size={16} color="#64748b" style={{ flexShrink: 0 }} />
                                                    <select 
                                                        value={statusFilter} 
                                                        onChange={(e) => setStatusFilter(e.target.value)}
                                                        className="form-control"
                                                        style={{ borderRadius: '12px', fontSize: '0.9rem', width: '100%' }}
                                                    >
                                                        <option value="All">All Statuses</option>
                                                        <option value="Pending">Pending</option>
                                                        <option value="Confirmed">Confirmed</option>
                                                        <option value="Completed">Completed</option>
                                                        <option value="Cancelled">Cancelled</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* ── Row 2: Sort Order ── */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#eef2ff', borderRadius: '12px', padding: '12px 18px', position: 'relative', zIndex: 10 }}>
                                                <ArrowUpDown size={18} color="#4338ca" style={{ flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Sort Order:</span>
                                                <select 
                                                    value={sortBy} 
                                                    onChange={(e) => setSortBy(e.target.value)}
                                                    style={{ borderRadius: '10px', fontSize: '0.9rem', flex: 1, fontWeight: 700, color: '#1e1b4b', border: '2px solid #818cf8', background: '#fff', cursor: 'pointer', padding: '8px 12px' }}
                                                >
                                                    <option value="booked_asc">⭐ Default Order: Earliest Booked at Top → Latest at Bottom</option>
                                                    <option value="booked_desc">🔽 Reverse Booking Order: Latest Booked at Top → Earliest at Bottom</option>
                                                    <option value="name_asc">👤 Patient Name: A to Z (Alphabetical)</option>
                                                    <option value="name_desc">👤 Patient Name: Z to A</option>
                                                    <option value="time_slot_asc">🕒 Clinic Slot: Morning → Afternoon → Evening</option>
                                                    <option value="time_slot_desc">🕒 Clinic Slot: Evening → Afternoon → Morning</option>
                                                    <option value="status_flow">📋 Status: Pending First → Confirmed → Completed</option>
                                                    <option value="track_asc">🔢 Tracking ID: Ascending (A to Z)</option>
                                                    <option value="booked_asc_oldest_day">📅 Oldest Booking Date Group First → Earliest to Latest</option>
                                                    <option value="pure_oldest_first">🔼 Pure First Booking Ever at Very Top</option>
                                                    <option value="appt_date_asc">🏥 Scheduled Visit Date: Earliest Date First</option>
                                                    <option value="appt_date_desc">🏥 Scheduled Visit Date: Latest Date First</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                </div>

                                {/* When in date_wise mode and 0 appointments match, show clean zero-results card (NO empty table, NO clutter) */}
                                {appointmentViewMode === 'date_wise' && filteredAppointments.length === 0 ? (
                                    <div style={{
                                        padding: '56px 24px',
                                        margin: '32px auto 44px',
                                        maxWidth: '620px',
                                        textAlign: 'center',
                                        background: '#ffffff',
                                        borderRadius: '24px',
                                        border: '2px dashed #fca5a5',
                                        boxShadow: '0 8px 30px rgba(239, 68, 68, 0.04)'
                                    }}>
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '50%',
                                            background: '#fee2e2',
                                            color: '#dc2626',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 16px',
                                            fontSize: '1.8rem'
                                        }}>
                                            🗓️
                                        </div>
                                        <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#991b1b' }}>
                                            No Appointments Found
                                        </h3>
                                        <p style={{ margin: '0 0 8px', color: '#b91c1c', fontSize: '0.98rem', fontWeight: 700 }}>
                                            {selectedDateFilter
                                                ? `Zero bookings found for ${new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`
                                                : 'No date selected'}
                                        </p>
                                        <p style={{ margin: '0 auto 28px', color: '#64748b', fontSize: '0.9rem', maxWidth: '440px', lineHeight: 1.5 }}>
                                            {dateFilterField === 'booking_date'
                                                ? 'No patient booked an appointment on this date. All records for other dates are strictly hidden.'
                                                : dateFilterField === 'slot_date'
                                                ? 'No patient is scheduled to visit the clinic on this date. All records for other dates are strictly hidden.'
                                                : 'No appointments match this date under either booking or scheduled visit dates. All other records are hidden.'}
                                        </p>
                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAppointmentViewMode('all');
                                                    setSortBy('booked_asc');
                                                }}
                                                style={{
                                                    background: '#0284c7',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '12px 24px',
                                                    borderRadius: '50px',
                                                    fontWeight: 700,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 10px rgba(2, 132, 199, 0.25)'
                                                }}
                                            >
                                                View All Appointments ({appointments.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDateFilter(new Date().toISOString().split('T')[0])}
                                                style={{
                                                    background: '#f8fafc',
                                                    color: '#334155',
                                                    border: '1.5px solid #cbd5e1',
                                                    padding: '12px 22px',
                                                    borderRadius: '50px',
                                                    fontWeight: 700,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Check Today's Records
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto', width: '100%' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '16px 24px', fontWeight: 700 }}>Booking Submitted</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 700 }}>Patient Info</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 700 }}>Department</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 700 }}>Scheduled Visit Slot</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 700 }}>Tracking ID</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 700 }}>Status</th>
                                                <th style={{ padding: '16px 24px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAppointments.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" style={{ padding: '80px 40px', textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ fontSize: '3rem', lineHeight: 1 }}>📭</div>
                                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>No Results Found</div>
                                                            <div style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '420px', lineHeight: 1.6 }}>
                                                                {appointmentViewMode === 'date_wise' && selectedDateFilter ? (
                                                                    `No appointments match the selected date (${new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}). All other dates are hidden.`
                                                                ) : (
                                                                    'No appointment records match your current search or filter.'
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setAppointmentViewMode('all');
                                                                    setSelectedDateFilter(new Date().toISOString().split('T')[0]);
                                                                    setStatusFilter('All');
                                                                    setSearchTerm('');
                                                                }}
                                                                style={{ marginTop: '8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '50px', padding: '10px 24px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}
                                                            >
                                                                View All Appointments
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredAppointments.map((app, index) => {
                                                    const info = getExactBookingDateTime(app);
                                                    const prevApp = index > 0 ? filteredAppointments[index - 1] : null;
                                                    const prevInfo = prevApp ? getExactBookingDateTime(prevApp) : null;

                                                    // Show date divider banner:
                                                    // In 'all' mode: show banner on each date group transition
                                                    // In 'date_wise' mode: show header banner once at index 0 for the selected date
                                                    const isNewDateGroup = appointmentViewMode === 'all'
                                                        ? ((sortBy === 'booked_asc' || sortBy === 'booked_asc_oldest_day') && (!prevInfo || prevInfo.dateStr !== info.dateStr))
                                                        : (index === 0);

                                                    const todayStrLocal = new Date().toISOString().split('T')[0];
                                                    const yestDate = new Date();
                                                    yestDate.setDate(yestDate.getDate() - 1);
                                                    const yesterdayStrLocal = yestDate.toISOString().split('T')[0];

                                                    const isToday = info.dateStr === todayStrLocal;
                                                    const isYesterday = info.dateStr === yesterdayStrLocal;

                                                    const groupCount = appointmentViewMode === 'all'
                                                        ? filteredAppointments.filter(item => getExactBookingDateTime(item).dateStr === info.dateStr).length
                                                        : filteredAppointments.length;

                                                    return (
                                                        <Fragment key={app.id || app.trackingId || index}>
                                                            {isNewDateGroup && (
                                                                <tr style={{ background: appointmentViewMode === 'date_wise' ? '#f5f3ff' : '#f8fafc', borderTop: index > 0 ? '3px solid #cbd5e1' : 'none', borderBottom: appointmentViewMode === 'date_wise' ? '2px solid #ddd6fe' : '2px solid #cbd5e1' }}>
                                                                    <td colSpan="7" style={{ padding: '14px 24px', background: appointmentViewMode === 'date_wise' ? '#f5f3ff' : '#f8fafc' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                                <span style={{ fontSize: '1.1rem' }}>{appointmentViewMode === 'date_wise' ? '🎯' : '📅'}</span>
                                                                                <span style={{ fontWeight: 800, fontSize: '0.96rem', color: appointmentViewMode === 'date_wise' ? '#4c1d95' : '#0f172a' }}>
                                                                                    {appointmentViewMode === 'date_wise'
                                                                                        ? `Filtered Date Records: ${selectedDateFilter ? new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : info.formattedDate}`
                                                                                        : `Records for ${info.formattedDate}`}
                                                                                </span>
                                                                                {appointmentViewMode === 'date_wise' ? (
                                                                                    <span style={{ background: '#7c3aed', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: '50px', letterSpacing: '0.04em' }}>
                                                                                        {dateFilterField === 'booking_date' ? 'BOOKED ON THIS DAY' : dateFilterField === 'slot_date' ? 'SCHEDULED VISIT DATE' : 'EITHER DATE'}
                                                                                    </span>
                                                                                ) : (
                                                                                    <>
                                                                                        {isToday && (
                                                                                            <span style={{ background: '#0284c7', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: '50px', letterSpacing: '0.05em' }}>
                                                                                                TODAY
                                                                                            </span>
                                                                                        )}
                                                                                        {isYesterday && (
                                                                                            <span style={{ background: '#64748b', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '50px' }}>
                                                                                                YESTERDAY
                                                                                            </span>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            <span style={{ fontSize: '0.8rem', color: appointmentViewMode === 'date_wise' ? '#6d28d9' : '#475569', fontWeight: 700 }}>
                                                                                {groupCount} appointment{groupCount !== 1 ? 's' : ''} • Earliest submission at top ↓ Latest at bottom {appointmentViewMode === 'date_wise' ? '(All other dates hidden)' : ''}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }} onMouseOver={e => e.currentTarget.style.background='#f8fafc'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                                                                
                                                                {/* COLUMN 1: BOOKING CREATED TIME (RELATIVE + FORMATTED) */}
                                                                <td style={{ padding: '18px 24px', whiteSpace: 'nowrap' }}>
                                                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                                                                        📅 {info.formattedDate}
                                                                    </div>
                                                                    <div style={{ color: '#0284c7', fontSize: '0.84rem', fontWeight: 600, marginTop: '2px' }}>
                                                                        🕒 {info.formattedTime}
                                                                    </div>
                                                                </td>

                                                                {/* COLUMN 2: PATIENT INFO */}
                                                                <td style={{ padding: '18px 24px' }}>
                                                                    <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.98rem', fontWeight: 700 }}>{app.patientName}</strong>
                                                                    <span style={{ color: '#64748b', fontSize: '0.86rem' }}>📞 {app.phone}</span>
                                                                </td>

                                                                {/* COLUMN 3: DEPARTMENT */}
                                                                <td style={{ padding: '18px 24px', fontWeight: 600, color: '#334155' }}>
                                                                    {app.department}
                                                                </td>

                                                                {/* COLUMN 4: APPT DATE & SLOT */}
                                                                <td style={{ padding: '18px 24px' }}>
                                                                    <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.9rem' }}>📅 {app.date}</strong>
                                                                    <span style={{ color: '#64748b', fontSize: '0.82rem' }}>🕒 {app.time}</span>
                                                                </td>

                                                                {/* COLUMN 5: TRACKING ID */}
                                                                <td style={{ padding: '18px 24px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', fontSize: '0.92rem' }}>
                                                                    {app.trackingId}
                                                                </td>

                                                                {/* COLUMN 6: STATUS BADGE */}
                                                                <td style={{ padding: '18px 24px' }}>
                                                                    <span style={{ ...getStatusBadgeStyle(app.status), padding: '6px 14px', borderRadius: '50px', fontSize: '0.82rem', fontWeight: 700, display: 'inline-block' }}>
                                                                        {app.status}
                                                                    </span>
                                                                </td>

                                                                {/* COLUMN 7: ACTIONS */}
                                                                <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                                        {app.status === 'Pending' && (
                                                                            <>
                                                                                <button onClick={() => updateStatus(app.id, 'Confirmed')} className="btn" style={{ background: '#16a34a', color: 'white', padding: '6px 14px', fontSize: '0.8rem', borderRadius: '50px' }}>Confirm</button>
                                                                                <button onClick={() => updateStatus(app.id, 'Cancelled')} className="btn" style={{ background: '#dc2626', color: 'white', padding: '6px 14px', fontSize: '0.8rem', borderRadius: '50px' }}>Cancel</button>
                                                                            </>
                                                                        )}
                                                                        {app.status === 'Confirmed' && (
                                                                            <button onClick={() => updateStatus(app.id, 'Completed')} className="btn" style={{ background: '#0284c7', color: 'white', padding: '6px 14px', fontSize: '0.8rem', borderRadius: '50px' }}>Mark Complete</button>
                                                                        )}
                                                                        {app.status === 'Completed' && (
                                                                            <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>✓ Done</span>
                                                                        )}
                                                                        <button onClick={() => deleteAppointment(app.id)} title="Delete record" style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px' }} onMouseOver={e=>e.currentTarget.style.color='#dc2626'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}>
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>

                                                            </tr>
                                                        </Fragment>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                )}

                            </div>
                        )}

                        {/* ==================== TAB 3: PATIENT DIRECTORY ==================== */}
                        {activeTab === 'patients' && (
                            <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', width: '100%' }}>
                                <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>Clinical Patient Directory</h2>
                                    <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.88rem' }}>Aggregated medical directory generated from consultation history</p>
                                </div>
                                <div style={{ overflowX: 'auto', width: '100%' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '16px 32px', fontWeight: 700 }}>Patient Name</th>
                                                <th style={{ padding: '16px 32px', fontWeight: 700 }}>Contact Phone</th>
                                                <th style={{ padding: '16px 32px', fontWeight: 700 }}>Total Consultation Visits</th>
                                                <th style={{ padding: '16px 32px', fontWeight: 700 }}>Last Department</th>
                                                <th style={{ padding: '16px 32px', fontWeight: 700 }}>Last Appt Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uniquePatientsList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>No registered patient profiles found.</td>
                                                </tr>
                                            ) : (
                                                uniquePatientsList.map((patient, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '20px 32px', fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{patient.name}</td>
                                                        <td style={{ padding: '20px 32px', color: '#475569', fontWeight: 600 }}>📞 {patient.phone}</td>
                                                        <td style={{ padding: '20px 32px' }}>
                                                            <span style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '6px 14px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 700 }}>
                                                                {patient.visits} Visit{patient.visits > 1 ? 's' : ''}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '20px 32px', color: '#334155', fontWeight: 500 }}>{patient.lastDepartment}</td>
                                                        <td style={{ padding: '20px 32px', color: '#64748b' }}>📅 {patient.lastVisit}</td>
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
            </main>
        </div>
    );
}

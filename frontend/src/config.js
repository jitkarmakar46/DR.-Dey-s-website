// Centralized API Configuration
// Automatically detects local development (localhost / 127.0.0.1) vs production cloud backend
export const API_BASE_URL = 
    import.meta.env.VITE_API_URL || 
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5005'
        : 'https://doctor-s-backend-2.onrender.com');

export default API_BASE_URL;

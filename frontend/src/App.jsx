import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import './index.css'; // Add our CSS here

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Secret, unguessable admin URL */}
        <Route path="/secure-portal-dey-77x9q" element={<AdminDashboard />} />
        {/* Redirect anyone guessing /admin or any other URL back to the home page */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './components/LanguageToggle';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import CropDetail from './components/CropDetail';
import FarmerDetail from './components/FarmerDetail';
import FarmerProfile from './components/FarmerProfile';
import PublicCropDetail from './components/public_page/PublicCropDetail';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, mustChangePassword, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  
  // If user must change password, redirect to password change page (except if already there)
  if (mustChangePassword && window.location.pathname !== '/account/change-password') {
    return <Navigate to="/account/change-password" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" />;
  return children;
};

const LoginRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  // If already logged in, redirect to dashboard
  if (user) return <Navigate to="/" />;
  
  return <Login />;
};

const AppContent = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/account/change-password" element={<ProtectedRoute><Profile forcedPasswordChange={true} /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/crop/:id" element={<CropDetail publicMode={false} />} />
        <Route path="/farmer/:id" element={<ProtectedRoute><FarmerDetail /></ProtectedRoute>} />
        <Route path="/public/crop/:token" element={<PublicCropDetail />} /> {/* Public page for QR code */}
        <Route path="/farmer-qr/:token" element={<FarmerProfile />} /> {/* Public Farmer Profile from QR token */}
        <Route path="/profile/:id" element={<FarmerProfile />} /> {/* Public Farmer Profile from QR */}
        <Route path="/profile" element={<FarmerProfile />} /> {/* Support query parameter ?qr=xxx */}
      </Routes>
    </Router>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;
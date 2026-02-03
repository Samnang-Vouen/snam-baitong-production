/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { login as loginApi, httpClient } from '../services/api';
import { farmerService } from '../services/farmerService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const didCheckAuthRef = useRef(false);

  useEffect(() => {
    // Verify session with backend on app load
    const checkAuth = async () => {
      try {
        // Avoid an unnecessary /auth/me 401 on first visit.
        // If the user has never logged in (or has explicitly logged out), skip the call.
        const token = localStorage.getItem('authToken');
        const hasSessionHint = localStorage.getItem('hasAuthSession') === 'true';
        if (!token && !hasSessionHint) {
          return;
        }

        // Call /auth/me to verify cookie/token-based session
        const response = await httpClient.get('/auth/me');
        if (response.data.success && response.data.user) {
          setUser(response.data.user.email);
          setRole(response.data.user.role);
          setMustChangePassword(response.data.user.mustChangePassword || false);
          localStorage.setItem('hasAuthSession', 'true');
        }
      } catch (error) {
        // Session invalid or expired, clear everything
        // This is expected when user is not logged in - suppress console error
        if (error.response?.status !== 401) {
          console.error('Auth check failed:', error);
        }
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('hasAuthSession');
        }
        setUser(null);
        setRole(null);
        setMustChangePassword(false);
      } finally {
        setLoading(false);
      }
    };

    // React 18 StrictMode runs effects twice in development.
    // Guard to prevent duplicate /auth/me calls.
    if (didCheckAuthRef.current) return;
    didCheckAuthRef.current = true;
    checkAuth();
  }, []);

  const login = async (email, password, rememberMe = false) => {
    const res = await loginApi(email, password);

    // Persist token locally as a backup for cookie-based auth
    if (res?.token) {
      localStorage.setItem('authToken', res.token);
    }
    localStorage.setItem('hasAuthSession', 'true');

    // Handle remember-me preference
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
      localStorage.setItem('savedUsername', email);
    } else {
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('savedUsername');
    }

    const resolvedUser = res?.user?.email || email;
    const resolvedRole = res?.user?.role || null;
    const resolvedMustChangePassword = res?.user?.mustChangePassword || false;
    setUser(resolvedUser);
    setRole(resolvedRole);
    setMustChangePassword(resolvedMustChangePassword);
    return { user: resolvedUser, role: resolvedRole, mustChangePassword: resolvedMustChangePassword };
  };

  const logout = async () => {
    // Mark logout immediately so hover-prefetches can bail out synchronously.
    localStorage.setItem('isLoggingOut', 'true');

    // Clear client-side auth state first to prevent any further authenticated calls.
    localStorage.removeItem('authToken');
    localStorage.removeItem('hasAuthSession');
    setUser(null);
    setRole(null);
    setMustChangePassword(false);
    farmerService.clearCache();

    try {
      // Call logout API to clear cookie
      await httpClient.post('/auth/logout');
    } catch (error) {
      // Continue with client-side logout even if API call fails
    } finally {
      localStorage.removeItem('isLoggingOut');
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, mustChangePassword, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
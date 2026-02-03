import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from './LanguageToggle';
import { getSavedCredentials, validateEmail } from '../services/auth.service';

export default function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const { login: loginWithContext } = useAuth();
  const navigate = useNavigate();
  const { t, lang, toggleLang } = useLanguage();

  // Load saved credentials on mount
  useEffect(() => {
    const { rememberMe: savedRememberMe, savedUsername } = getSavedCredentials();
    if (savedRememberMe && savedUsername) {
      setUsernameOrEmail(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // Validate form fields
  const validateForm = () => {
    const errors = {};
    
    // Username/Email validation
    if (!usernameOrEmail.trim()) {
      errors.usernameOrEmail = t('username_required');
    } else if (usernameOrEmail.includes('@') && !validateEmail(usernameOrEmail)) {
      errors.usernameOrEmail = t('invalid_email');
    }
    
    // Password validation
    if (!password) {
      errors.password = t('password_required');
    } else if (password.length < 4) {
      errors.password = t('password_min_length');
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setError('');
    setValidationErrors({});
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Login (single request) and update auth context
      await loginWithContext(usernameOrEmail, password, rememberMe);
      
      // Navigate to dashboard
      navigate('/');
    } catch (err) {
      // Prefer server-provided error details over Axios' generic message
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        t('login_failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    if (field === 'usernameOrEmail') {
      setUsernameOrEmail(value);
    } else if (field === 'password') {
      setPassword(value);
    }
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center px-2 px-sm-3" style={{ background: 'linear-gradient(135deg, #f8fffe 0%, #e8f5e9 100%)' }}>
      <div className="row w-100 justify-content-center">
        <div className="col-12 col-sm-11 col-md-8 col-lg-5 col-xl-4">
          {/* Login Card */}
          <div className="card shadow-lg border-0" style={{ borderRadius: '12px', maxWidth: '500px', margin: '0 auto' }}>
            {/* Card Header */}
            <div className="card-header text-white text-center py-3" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', borderRadius: '12px 12px 0 0' }}>
              <div className="mb-2">
                <i className="bi bi-shield-check" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h3 className="mb-1" style={{ color: 'white', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)' }}>{t('welcome')}</h3>
              <p className="mb-0" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', opacity: 0.9, color: 'white' }}>{t('smart_agriculture')}</p>
            </div>

            {/* Card Body */}
            <div className="card-body p-3 p-md-4">
              {/* Language Toggle */}
              <div className="text-end mb-3">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-success"
                  onClick={toggleLang}
                  style={{ 
                    fontSize: 'clamp(0.7rem, 2vw, 0.85rem)', 
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontWeight: '500'
                  }}
                >
                  <i className="bi bi-translate me-1"></i>
                  {lang === 'en' ? 'ភាសាខ្មែរ' : 'English'}
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Username/Email Input */}
                <div className="mb-3">
                  <label htmlFor="usernameOrEmail" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)' }}>
                    {t('username')} / {t('email')}
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0" style={{ fontSize: 'clamp(0.85rem, 2vw, 0.9rem)' }}>
                      <i className="bi bi-person-fill text-success"></i>
                    </span>
                    <input
                      type="text"
                      className={`form-control border-start-0 ${validationErrors.usernameOrEmail ? 'is-invalid' : ''}`}
                      id="usernameOrEmail"
                      placeholder={t('enter_username_email')}
                      value={usernameOrEmail}
                      onChange={(e) => handleInputChange('usernameOrEmail', e.target.value)}
                      disabled={loading}
                      autoComplete="username"
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 0.95rem)', padding: '0.6rem 0.75rem' }}
                    />
                    {validationErrors.usernameOrEmail && (
                      <div className="invalid-feedback" style={{ fontSize: '0.8rem' }}>
                        {validationErrors.usernameOrEmail}
                      </div>
                    )}
                  </div>
                </div>

                {/* Password Input */}
                <div className="mb-3">
                  <label htmlFor="password" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)' }}>
                    {t('password')}
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0" style={{ fontSize: 'clamp(0.85rem, 2vw, 0.9rem)' }}>
                      <i className="bi bi-lock-fill text-success"></i>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`form-control border-start-0 border-end-0 ${validationErrors.password ? 'is-invalid' : ''}`}
                      id="password"
                      placeholder={t('enter_password')}
                      value={password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      disabled={loading}
                      autoComplete="current-password"
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 0.95rem)', padding: '0.6rem 0.75rem' }}
                    />
                    <button
                      className="btn btn-outline-secondary border-start-0"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      title={showPassword ? t('hide_password') : t('show_password')}
                      style={{ fontSize: 'clamp(0.85rem, 2vw, 0.9rem)', padding: '0.6rem 0.75rem' }}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                    {validationErrors.password && (
                      <div className="invalid-feedback" style={{ fontSize: '0.8rem' }}>
                        {validationErrors.password}
                      </div>
                    )}
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={loading}
                      style={{ marginTop: '0.35rem' }}
                    />
                    <label className="form-check-label" htmlFor="rememberMe" style={{ fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                      {t('remember_me')}
                    </label>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="alert alert-danger py-2 mb-3" role="alert" style={{ fontSize: 'clamp(0.8rem, 2vw, 0.85rem)' }}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                  </div>
                )}

                {/* Login Button */}
                <div className="d-grid mb-2">
                  <button
                    type="submit"
                    className="btn btn-success py-2"
                    disabled={loading}
                    style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1rem)', fontWeight: '600' }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        {t('loading')}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        {t('login')}
                      </>
                    )}
                  </button>
                </div>

                {/* Footer Note */}
                <div className="text-center mt-3">
                  <p className="text-muted mb-0" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)' }}>
                    <i className="bi bi-shield-lock me-1"></i>
                    {t('secure_platform')}
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
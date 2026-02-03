import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from './LanguageToggle';
import { getUserProfile, updatePassword } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import '../styles/Profile.css';

const Profile = ({ forcedPasswordChange = false, onBack = null }) => {
  const { user: authUser, role, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getUserProfile();
      if (response.success && response.user) {
        setProfile(response.user);
      }
    } catch {
      showToast(t('failed_load_profile'), 'danger');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const validatePasswordForm = () => {
    const newErrors = {};
    
    if (!passwordForm.currentPassword) {
      newErrors.currentPassword = t('current_password_required');
    }
    
    if (!passwordForm.newPassword) {
      newErrors.newPassword = t('new_password_required');
    } else if (passwordForm.newPassword.length < 6) {
      newErrors.newPassword = t('password_min_6_chars');
    }
    
    if (!passwordForm.confirmPassword) {
      newErrors.confirmPassword = t('confirm_password_required');
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = t('passwords_not_match');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) {
      return;
    }
    
    try {
      setUpdating(true);
      const response = await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      
      if (response.success) {
        showToast(t('password_updated_success'), 'success');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        
        // Refresh profile to update mustChangePassword flag
        await fetchProfile();
        
        // If this was a forced password change, reload page to update auth context and redirect
        if (forcedPasswordChange) {
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || t('failed_update_password');
      showToast(errorMessage, 'danger');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    if (forcedPasswordChange) {
      // If password change is forced, log out
      logout();
      navigate('/login');
    } else if (onBack) {
      // If onBack callback is provided (inline mode), use it
      onBack();
    } else {
      // Otherwise navigate back to dashboard
      navigate('/');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mt-4">
      {toast.show && <Toast message={toast.message} type={toast.type} />}
      
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-8 col-xl-6">
          {onBack && (
            <button className="btn btn-outline-secondary mb-3" onClick={onBack}>
              <i className="bi bi-arrow-left me-2"></i>
              <span className="d-none d-sm-inline">{t('back_to_dashboard')}</span>
              <span className="d-sm-none">{t('back')}</span>
            </button>
          )}
          <div className="card shadow">
            <div className="card-header bg-success text-white">
              <h4 className="mb-0" style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)' }}>
                {forcedPasswordChange ? t('change_your_password') : t('profile_settings')}
              </h4>
            </div>
            
            <div className="card-body">
              {forcedPasswordChange && (
                <div className="alert alert-warning mb-4" role="alert">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {t('must_change_password_warning')}
                </div>
              )}
              
              {/* Profile Information (Read-only) */}
              {!forcedPasswordChange && (
                <div className="mb-4">
                  <h5 className="border-bottom pb-2 mb-3" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>{t('profile_information')}</h5>
                  <div className="row mb-3">
                    <label className="col-12 col-sm-4 col-form-label fw-bold">{t('email')}:</label>
                    <div className="col-12 col-sm-8">
                      <p className="form-control-plaintext">{profile?.email || authUser}</p>
                    </div>
                  </div>
                  <div className="row mb-3">
                    <label className="col-12 col-sm-4 col-form-label fw-bold">{t('role')}:</label>
                    <div className="col-12 col-sm-8">
                      <p className="form-control-plaintext">
                        <span className={`badge ${role === 'admin' ? 'bg-danger' : 'bg-primary'}`}>
                          {role?.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Password Update Form */}
              <div>
                <h5 className="border-bottom pb-2 mb-3">
                  {forcedPasswordChange ? t('set_new_password') : t('change_password')}
                </h5>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="mb-3">
                    <label htmlFor="currentPassword" className="form-label">
                      {t('current_password')} <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        type={showPasswords.currentPassword ? "text" : "password"}
                        className={`form-control ${errors.currentPassword ? 'is-invalid' : ''}`}
                        id="currentPassword"
                        name="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChange}
                        disabled={updating}
                        autoComplete="current-password"
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => togglePasswordVisibility('currentPassword')}
                        disabled={updating}
                      >
                        <i className={`bi ${showPasswords.currentPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                      {errors.currentPassword && (
                        <div className="invalid-feedback d-block">{errors.currentPassword}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="newPassword" className="form-label">
                      {t('new_password')} <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        type={showPasswords.newPassword ? "text" : "password"}
                        className={`form-control ${errors.newPassword ? 'is-invalid' : ''}`}
                        id="newPassword"
                        name="newPassword"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        disabled={updating}
                        autoComplete="new-password"
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => togglePasswordVisibility('newPassword')}
                        disabled={updating}
                      >
                        <i className={`bi ${showPasswords.newPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                      {errors.newPassword && (
                        <div className="invalid-feedback d-block">{errors.newPassword}</div>
                      )}
                    </div>
                    <small className="text-muted">{t('minimum_characters')}</small>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">
                      {t('confirm_new_password')} <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        type={showPasswords.confirmPassword ? "text" : "password"}
                        className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        disabled={updating}
                        autoComplete="new-password"
                      />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => togglePasswordVisibility('confirmPassword')}
                        disabled={updating}
                      >
                        <i className={`bi ${showPasswords.confirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                      {errors.confirmPassword && (
                        <div className="invalid-feedback d-block">{errors.confirmPassword}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="d-flex gap-2 justify-content-end mt-4">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancel}
                      disabled={updating}
                    >
                      {forcedPasswordChange ? t('logout') : t('cancel')}
                    </button>
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={updating}
                    >
                      {updating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          {t('updating')}
                        </>
                      ) : (
                        t('update_password')
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

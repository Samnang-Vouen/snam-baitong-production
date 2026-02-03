import { useEffect, useRef, useState } from 'react';
import { useLanguage } from './LanguageToggle';
import Toast from './Toast';

export default function TempPasswordModal({ user, temporaryPassword, onClose }) {
  const passwordRef = useRef(null);
  const [showToast, setShowToast] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Focus on password field when modal opens
    if (passwordRef.current) {
      passwordRef.current.select();
    }
  }, []);

  const handleCopy = () => {
    if (passwordRef.current) {
      passwordRef.current.select();
      navigator.clipboard.writeText(temporaryPassword).then(() => {
        setShowToast(true);
      }).catch(() => {
        // Fallback for older browsers
        document.execCommand('copy');
        setShowToast(true);
      });
    }
  };

  return (
    <div 
      className="modal show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
      onClick={onClose}
    >
      <div 
        className="modal-dialog modal-dialog-centered modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header bg-success text-white border-0">
            <h5 className="modal-title text-white">
              <i className="bi bi-check-circle-fill me-2"></i>
              {t('user_created_success')}
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body p-4">
            <div className="alert alert-warning border-warning mb-4">
              <div className="d-flex align-items-start">
                <i className="bi bi-exclamation-triangle-fill fs-4 me-3 mt-1"></i>
                <div>
                  <strong className="d-block mb-1">{t('important_save_password')}</strong>
                  <small>{t('temp_password_once')}</small>
                </div>
              </div>
            </div>
            
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-bold text-muted small">
                  <i className="bi bi-envelope me-1"></i>
                  {t('email_address').toUpperCase()}
                </label>
                <div className="form-control-plaintext bg-light rounded p-2 border">
                  {user.email}
                </div>
              </div>
              
              <div className="col-md-6">
                <label className="form-label fw-bold text-muted small">
                  <i className="bi bi-shield-check me-1"></i>
                  {t('role').toUpperCase()}
                </label>
                <div className="form-control-plaintext bg-light rounded p-2 border">
                  <span className={`badge ${user.role === 'admin' ? 'bg-danger' : 'bg-info'}`}>
                    {user.role.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label fw-bold text-muted small">
                <i className="bi bi-key me-1"></i>
                {t('temporary_password').toUpperCase()}
              </label>
              <div className="input-group input-group-lg">
                <input
                  ref={passwordRef}
                  type="text"
                  className="form-control font-monospace fs-4 text-center fw-bold bg-light border-success"
                  value={temporaryPassword}
                  readOnly
                  style={{ letterSpacing: '4px', color: '#198754' }}
                />
                <button 
                  className="btn btn-success px-4" 
                  type="button"
                  onClick={handleCopy}
                  title={t('copy')}
                >
                  <i className="bi bi-clipboard-check me-2"></i>
                  {t('copy')}
                </button>
              </div>
              <div className="form-text mt-2">
                <i className="bi bi-info-circle me-1"></i>
                {t('user_must_change')}
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 bg-light">
            <button 
              type="button" 
              className="btn btn-primary btn-lg px-5" 
              onClick={onClose}
            >
              <i className="bi bi-check-lg me-2"></i>
              {t('saved_password')}
            </button>
          </div>
        </div>
      </div>
      
      {showToast && (
        <Toast
          message={t('password_copied')}
          type="success"
          onClose={() => setShowToast(false)}
          duration={2000}
        />
      )}
    </div>
  );
}

import { useEffect } from 'react';

export default function ConfirmModal({ title, message, userEmail, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger' }) {
  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="modal show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
      onClick={onCancel}
    >
      <div 
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content shadow-lg border-0">
          <div className={`modal-header bg-${variant} text-white border-0`}>
            <h5 className="modal-title text-white">
              <i className={`bi bi-${variant === 'danger' ? 'exclamation-triangle' : variant === 'success' ? 'check-circle' : 'question-circle'}-fill me-2`}></i>
              {title}
            </h5>
            {cancelText !== null && (
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onCancel}
              ></button>
            )}
          </div>
          <div className="modal-body p-4">
            {userEmail ? (
              <p className="mb-0">
                {message.split(userEmail)[0]}
                <strong>{userEmail}</strong>
                {message.split(userEmail)[1]}
              </p>
            ) : (
              <p className="mb-0">{message}</p>
            )}
          </div>
          <div className="modal-footer border-0 bg-light">
            {cancelText !== null && (
              <button 
                type="button" 
                className="btn btn-secondary px-4" 
                onClick={onCancel}
              >
                <i className="bi bi-x-circle me-2"></i>
                {cancelText}
              </button>
            )}
            <button 
              type="button" 
              className={`btn btn-${variant} px-4`}
              onClick={onConfirm}
            >
              <i className={`bi bi-${variant === 'danger' ? 'trash' : 'check-circle'} me-2`}></i>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

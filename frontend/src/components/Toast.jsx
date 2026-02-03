import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: 'check-circle-fill',
    error: 'x-circle-fill',
    warning: 'exclamation-triangle-fill',
    info: 'info-circle-fill'
  };

  const bgColors = {
    success: 'bg-success',
    error: 'bg-danger',
    warning: 'bg-warning',
    info: 'bg-info'
  };

  return (
    <div 
      className="position-fixed top-0 start-50 translate-middle-x mt-3" 
      style={{ zIndex: 1070, minWidth: '300px' }}
    >
      <div 
        className={`alert ${bgColors[type]} text-white shadow-lg border-0 d-flex align-items-center mb-0`}
        role="alert"
        style={{ 
          animation: 'slideDown 0.3s ease-out',
        }}
      >
        <i className={`bi bi-${icons[type]} fs-4 me-3`}></i>
        <div className="flex-grow-1">{message}</div>
        <button 
          type="button" 
          className="btn-close btn-close-white ms-3" 
          onClick={onClose}
        ></button>
      </div>
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

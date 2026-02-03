import { useLanguage } from './LanguageToggle';

export default function QRCodeCard({ 
  qrDataUrl, 
  generatingQR, 
  onGenerateQR, 
  onDownloadQR,
  downloadSuccess 
}) {
  const { t } = useLanguage();

  return (
    <>
      <div className="card shadow-sm mb-3">
      <div className="card-header bg-info text-white">
        <h4 className="mb-0" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>
          <i className="bi bi-qr-code me-2"></i>
          {t('qr_code')}
        </h4>
      </div>
      <div className="card-body d-flex flex-column justify-content-center align-items-center">
        {!qrDataUrl ? (
          <button 
            className="btn btn-primary btn-large" 
            onClick={onGenerateQR}
            disabled={generatingQR}
          >
            {generatingQR ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                <span className="d-none d-sm-inline">{t('generating')}</span>
                <span className="d-sm-none">...</span>
              </>
            ) : (
              <>
                <i className="bi bi-qr-code-scan me-2"></i>
                {t('generate_qr')}
              </>
            )}
          </button>
        ) : (
          <div className="text-center">
            {generatingQR ? (
              <div className="d-flex flex-column align-items-center">
                <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">{t('generating')}</span>
                </div>
                <p className="text-muted">{t('generating')}</p>
              </div>
            ) : (
              <>
                <img src={qrDataUrl} alt="Farmer QR Code" className="img-fluid mb-3" style={{ maxWidth: 'clamp(200px, 50vw, 300px)' }} />
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  <button className="btn btn-success btn-large" onClick={onDownloadQR}>
                    <i className="bi bi-download me-1 d-none d-sm-inline"></i>
                    <span className="d-none d-sm-inline">{t('download_qr')}</span>
                    <span className="d-sm-none"><i className="bi bi-download"></i></span>
                  </button>
                  <button className="btn btn-outline-secondary btn-large" onClick={onGenerateQR} disabled={generatingQR}>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    <span className="d-none d-sm-inline">{t('regenerate')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
    
    {/* Success Toast Notification */}
    {downloadSuccess && (
      <div 
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#28a745',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        <i className="bi bi-check-circle-fill"></i>
        <span>QR Code downloaded successfully!</span>
      </div>
    )}
    
    <style>{`
      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
    `}</style>
  </>
  );
}

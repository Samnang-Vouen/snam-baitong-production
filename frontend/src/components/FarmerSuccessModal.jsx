import { useLanguage } from './LanguageToggle';
import { formatDate } from '../utils/date';

export default function FarmerSuccessModal({ show, farmer, onClose }) {
  const { t, lang } = useLanguage();

  if (!show || !farmer) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="bi bi-check-circle-fill me-2"></i>
              {t('farmer_added')}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                {/* Profile Picture */}
                {farmer.profileImageUrl && (
                  <div className="text-center mb-3">
                    <img 
                      src={farmer.profileImageUrl} 
                      alt={`${farmer.firstName} ${farmer.lastName}`}
                      className="rounded-circle img-thumbnail"
                      style={{ 
                        width: '120px', 
                        height: '120px', 
                        objectFit: 'cover',
                        border: '3px solid #28a745'
                      }}
                    />
                  </div>
                )}
                
                {/* Title: Full Name */}
                <h4 className="card-title text-success mb-2 text-center">
                  <i className="bi bi-person-circle me-2"></i>
                  {farmer.firstName} {farmer.lastName}
                </h4>

                {/* Subtitle: Phone Number */}
                <h6 className="card-subtitle mb-3 text-muted text-center">
                  <i className="bi bi-telephone-fill me-2"></i>
                  {farmer.phoneNumber}
                </h6>

                {/* Location */}
                <div className="mb-3 p-3 bg-light rounded">
                  <i className="bi bi-geo-alt-fill text-success me-2"></i>
                  <strong>{t('location')}:</strong> {farmer.villageName}, {farmer.districtName}, {farmer.provinceCity}
                </div>

                {/* Additional Details */}
                <div className="mt-3">
                  <div className="row">
                    <div className="col-6 mb-2">
                      <small className="text-muted">{t('crop_type')}</small>
                      <div className="fw-semibold">{farmer.cropType}</div>
                    </div>
                    <div className="col-6 mb-2">
                      <small className="text-muted">{t('planting_date')}</small>
                      <div className="fw-semibold">{formatDate(farmer.plantingDate, lang)}</div>
                    </div>
                    <div className="col-6 mb-2">
                      <small className="text-muted">{t('harvest_date')}</small>
                      <div className="fw-semibold">{formatDate(farmer.harvestDate, lang)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-success btn-large" onClick={onClose}>
              <i className="bi bi-check-lg me-2"></i>
              {t('ok')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

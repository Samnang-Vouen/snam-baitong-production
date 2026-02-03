import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useLanguage } from './LanguageToggle';
import { farmerService } from '../services/farmerService';
import { formatDate } from '../utils/date';

export default function CropCard({ crop, onDelete, onViewFarmer }) {
  const { t, lang } = useLanguage();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const prefetchedRef = useRef(false);

  const prefetchFarmerDetail = async () => {
    // If the user has logged out (or never logged in), skip prefetch.
    // This prevents expected 401s from hover/touch prefetch on the dashboard cards.
    if (localStorage.getItem('isLoggingOut') === 'true') return;
    const token = localStorage.getItem('authToken');
    const hasSessionHint = localStorage.getItem('hasAuthSession') === 'true';
    if (!token && !hasSessionHint) return;

    if (prefetchedRef.current) return;
    if (!crop || crop.type !== 'farmer' || !crop.id) return;
    prefetchedRef.current = true;

    try {
      const farmer = await farmerService.getFarmer(crop.id);
      const devices = farmer?.sensorDevices ? farmer.sensorDevices.split(',').map(d => d.trim()).filter(Boolean) : [];
      const device = devices[0] || null;
      if (device) {
        // Warm dashboard cache for the default view/range.
        farmerService.getFarmerSensorDashboard(
          crop.id,
          { view: 'slots', slotRange: 'latest', range: '24h', device },
          null
        ).catch(() => {});
      }
    } catch {
      // Prefetch is best-effort only.
    }
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(false);
    if (onDelete) {
      await onDelete(crop.id, crop.type);
    }
  };

  const handleCancelDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(false);
  };
  
  // Check if this is a farmer card
  if (crop.type === 'farmer') {
    return (
      <>
        <div
          className="text-decoration-none"
          onMouseEnter={() => { prefetchFarmerDetail(); }}
          onTouchStart={() => { prefetchFarmerDetail(); }}
          onClick={() => {
            prefetchFarmerDetail();
            onViewFarmer && onViewFarmer(crop.id);
          }}
        >
          <div className="card h-100 shadow-sm border-success position-relative" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} 
               onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
               onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <button 
              className="btn btn-danger position-absolute top-0 end-0"
              style={{ 
                zIndex: 10, 
                width: 'auto',
                padding: '0.4rem 0.75rem',
                fontSize: 'clamp(0.75rem, 2vw, 0.85rem)',
                margin: '0.5rem',
                borderRadius: '0.25rem'
              }}
              onClick={handleDeleteClick}
              title={t('delete')}
            >
              <i className="bi bi-trash me-1"></i>
              <span>{t('delete')}</span>
            </button>
            
            {/* Ministry Feedback Badge */}
            {crop.hasUnviewedFeedback && (
              <span 
                className="badge bg-warning text-dark position-absolute top-0 start-0 m-2"
                style={{ zIndex: 10, fontSize: 'clamp(0.65rem, 2vw, 0.85rem)' }}
                title={t('ministry_feedback') || 'Ministry Feedback'}
              >
                <i className="bi bi-chat-left-text-fill me-1"></i>
                <span className="d-none d-sm-inline">{t('ministry_feedback') || 'Feedback'}</span>
                <span className="d-sm-none">!</span>
              </span>
            )}
            
            <div className="card-body" style={{ paddingTop: '1.5rem' }}>
              {/* Profile Picture */}
              {crop.profileImageUrl && (
                <div className="text-center mb-3">
                  <img 
                    src={crop.profileImageUrl} 
                    alt={`${crop.firstName} ${crop.lastName}`}
                    className="rounded-circle img-thumbnail"
                    style={{ 
                      width: 'clamp(60px, 15vw, 80px)', 
                      height: 'clamp(60px, 15vw, 80px)', 
                      objectFit: 'cover',
                      border: '2px solid #28a745'
                    }}
                  />
                </div>
              )}
              
              <h5 className="card-title mb-3 text-success" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>
                <i className="bi bi-person-circle me-2"></i>
                {crop.firstName} {crop.lastName}
              </h5>
              <p className="mb-2" style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>
                <i className="bi bi-telephone-fill text-success me-2"></i>
                <strong>{t('phone_number')}:</strong> {crop.phoneNumber}
              </p>
              <p className="mb-2" style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>
                <i className="bi bi-geo-alt-fill text-success me-2"></i>
                <strong>{t('location')}:</strong> {crop.villageName}, {crop.districtName}, {crop.provinceCity}
              </p>
              <p className="mb-2" style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>
                <i className="bi bi-flower3 text-success me-2"></i>
                <strong>{t('crop_type')}:</strong> {crop.cropType}
              </p>
              <hr className="my-2" />
              <div className="row small">
                <div className="col-6">
                  <small className="text-muted">{t('planting_date')}</small>
                  <div className="fw-semibold">{formatDate(crop.plantingDate, lang)}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">{t('harvest_date')}</small>
                  <div className="fw-semibold">{formatDate(crop.harvestDate, lang)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={handleCancelDelete}>
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                    {t('confirm_delete')}
                  </h5>
                  <button type="button" className="btn-close" onClick={handleCancelDelete}></button>
                </div>
                <div className="modal-body">
                  <p>{t('delete_farmer_confirm')}: <strong>{crop.firstName} {crop.lastName}</strong>?</p>
                  <p className="text-muted small">{t('delete_warning')}</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCancelDelete}>
                    {t('cancel')}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleConfirmDelete}>
                    <i className="bi bi-trash me-2"></i>
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  
  // Original crop card
  const statusLabel = crop.status?.replace('_', ' ') || t('status_unknown');
  const latestTime = crop.latestSensors?.recordedAt || null;

  return (
    <>
      <div className="card h-100 shadow-sm position-relative">
        <button 
          className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
          style={{ zIndex: 10 }}
          onClick={handleDeleteClick}
          title={t('delete')}
        >
          <i className="bi bi-trash"></i>
        </button>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <h5 className="card-title mb-0">{crop.plantName}</h5>
            <span className={`badge bg-${crop.status === 'died' ? 'danger' : crop.status === 'not_planted' ? 'warning' : 'success'}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mb-2"><strong>{t('location')}:</strong> {crop.farmLocation}</p>
          <p className="mb-3"><strong>{t('planting_date')}:</strong> {formatDate(crop.plantedDate, lang)}</p>
          {latestTime && (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              {t('last_updated')}: {latestTime}
            </p>
          )}
          <Link to={`/crop/${crop.id}`} className="btn btn-success btn-large w-100">
            {t('view_details')}
          </Link>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={handleCancelDelete}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                  {t('confirm_delete')}
                </h5>
                <button type="button" className="btn-close" onClick={handleCancelDelete}></button>
              </div>
              <div className="modal-body">
                <p>{t('delete_crop_confirm')}: <strong>{crop.plantName}</strong>?</p>
                <p className="text-muted small">{t('delete_warning')}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCancelDelete}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn btn-danger" onClick={handleConfirmDelete}>
                  <i className="bi bi-trash me-2"></i>
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
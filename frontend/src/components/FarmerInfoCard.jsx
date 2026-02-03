import { useLanguage } from './LanguageToggle';
import { formatDate } from '../utils/date';

export default function FarmerInfoCard({ 
  farmer, 
  role, 
  isEditing, 
  editForm, 
  saving,
  onEditClick, 
  onCancelEdit, 
  onSaveEdit, 
  onInputChange 
}) {
  const { t, lang } = useLanguage();

  return (
    <div className="card shadow-sm h-100">
      <div className="card-header bg-success text-white d-flex flex-wrap justify-content-between align-items-center gap-2">
        <h4 className="mb-0" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>
          <i className="bi bi-info-circle me-2"></i>
          {t('farmer_information')}
        </h4>
        {role === 'admin' && !isEditing && (
          <button className="btn btn-light btn-sm" onClick={onEditClick}>
            <i className="bi bi-pencil me-1"></i>
            <span className="d-none d-sm-inline">{t('edit')}</span>
          </button>
        )}
        {role === 'admin' && isEditing && (
          <div className="d-flex gap-2">
            <button className="btn btn-light btn-sm" onClick={onSaveEdit} disabled={saving}>
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-1"></span><span className="d-none d-sm-inline">{t('saving')}</span><span className="d-sm-none">...</span></>
              ) : (
                <><i className="bi bi-check-lg me-1"></i><span className="d-none d-sm-inline">{t('save')}</span></>
              )}
            </button>
            <button className="btn btn-outline-light btn-sm" onClick={onCancelEdit} disabled={saving}>
              <i className="bi bi-x-lg me-1"></i>
              <span className="d-none d-sm-inline">{t('cancel')}</span>
            </button>
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="row">
          {/* Profile Picture */}
          {farmer.profileImageUrl && (
            <div className="col-12 mb-4 text-center">
              <img 
                src={farmer.profileImageUrl} 
                alt={`${farmer.firstName} ${farmer.lastName}`}
                className="rounded-circle img-thumbnail shadow"
                style={{ 
                  width: 'clamp(100px, 25vw, 150px)', 
                  height: 'clamp(100px, 25vw, 150px)', 
                  objectFit: 'cover',
                  border: '4px solid #28a745'
                }}
              />
              {!isEditing && <h5 className="mt-3 mb-0" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>{farmer.firstName} {farmer.lastName}</h5>}
            </div>
          )}
          
          {/* First Name */}
          <div className="col-12 col-md-6 mb-3">
            <strong><i className="bi bi-person text-success me-2"></i>{t('first_name')}:</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control mt-1"
                value={editForm.firstName}
                onChange={(e) => onInputChange('firstName', e.target.value)}
              />
            ) : (
              <p className="mb-0">{farmer.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div className="col-12 col-md-6 mb-3">
            <strong><i className="bi bi-person text-success me-2"></i>{t('last_name')}:</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control mt-1"
                value={editForm.lastName}
                onChange={(e) => onInputChange('lastName', e.target.value)}
              />
            ) : (
              <p className="mb-0">{farmer.lastName}</p>
            )}
          </div>

          {/* Gender */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-gender-ambiguous text-success me-2"></i>{t('gender')}:</strong>
            {isEditing ? (
              <select
                className="form-control mt-1"
                value={editForm.gender}
                onChange={(e) => onInputChange('gender', e.target.value)}
              >
                <option value="">{t('select_gender')}</option>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
                <option value="other">{t('other')}</option>
              </select>
            ) : (
              <p className="mb-0">{farmer.gender ? t(farmer.gender) : '-'}</p>
            )}
          </div>

          {/* Phone Number */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-telephone-fill text-success me-2"></i>{t('phone_number')}:</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control mt-1"
                value={editForm.phoneNumber}
                onChange={(e) => onInputChange('phoneNumber', e.target.value)}
              />
            ) : (
              <p className="mb-0">{farmer.phoneNumber}</p>
            )}
          </div>

          {/* Village Name */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-geo-alt-fill text-success me-2"></i>{t('village_name')}:</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control mt-1"
                value={editForm.villageName}
                onChange={(e) => onInputChange('villageName', e.target.value)}
              />
            ) : (
              <p className="mb-0">{farmer.villageName}</p>
            )}
          </div>

          {/* District Name */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-map text-success me-2"></i>{t('district_name')}:</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control mt-1"
                value={editForm.districtName}
                onChange={(e) => onInputChange('districtName', e.target.value)}
              />
            ) : (
              <p className="mb-0">{farmer.districtName}</p>
            )}
          </div>

          {/* Province/City */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-pin-map text-success me-2"></i>{t('province_city')}:</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control mt-1"
                value={editForm.provinceCity}
                onChange={(e) => onInputChange('provinceCity', e.target.value)}
              />
            ) : (
              <p className="mb-0">{farmer.provinceCity}</p>
            )}
          </div>

          {/* Crop Type */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-flower3 text-success me-2"></i>{t('crop_type')}:</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control mt-1"
                value={editForm.cropType}
                onChange={(e) => onInputChange('cropType', e.target.value)}
              />
            ) : (
              <p className="mb-0">{farmer.cropType}</p>
            )}
          </div>

          {/* Planting Date */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-calendar-check text-success me-2"></i>{t('planting_date')}:</strong>
            {isEditing ? (
              <input
                type="date"
                className="form-control mt-1"
                value={editForm.plantingDate}
                onChange={(e) => onInputChange('plantingDate', e.target.value)}
              />
            ) : (
                <p className="mb-0">{formatDate(farmer.plantingDate, lang)}</p>
            )}
          </div>

          {/* Harvest Date */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-calendar-event text-success me-2"></i>{t('harvest_date')}:</strong>
            {isEditing ? (
              <input
                type="date"
                className="form-control mt-1"
                value={editForm.harvestDate}
                onChange={(e) => onInputChange('harvestDate', e.target.value)}
              />
            ) : (
                <p className="mb-0">{formatDate(farmer.harvestDate, lang)}</p>
            )}
          </div>

          {/* QR Expiration Days */}
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-calendar-x text-success me-2"></i>{t('qr_expire_label')}:</strong>
            {isEditing ? (
              <input
                type="number"
                className="form-control mt-1"
                value={editForm.qrExpirationDays}
                onChange={(e) => onInputChange('qrExpirationDays', parseInt(e.target.value) || 1)}
                min="1"
                max="365"
              />
            ) : (
              <p className="mb-0">{t('qr_expire_in', { days: farmer.qrExpirationDays !== undefined && farmer.qrExpirationDays !== null ? farmer.qrExpirationDays : 365 })}</p>
            )}
          </div>

          {/* Sensor Devices - Admin only */}
          {role === 'admin' && (
            <div className="col-12 mb-3">
              <strong><i className="bi bi-cpu text-success me-2"></i>{t('sensor_devices')}:</strong>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    className="form-control mt-1"
                    value={editForm.sensorDevices || ''}
                    onChange={(e) => onInputChange('sensorDevices', e.target.value)}
                    placeholder={t('sensor_devices_placeholder') || 'e.g., device1, device2, device3'}
                  />
                  <small className="text-muted d-block mt-1">
                    <i className="bi bi-info-circle me-1"></i>
                    {t('sensor_devices_hint') || 'Enter comma-separated device IDs (e.g., device1, device2)'}
                  </small>
                </>
              ) : (
                <p className="mb-0">{farmer.sensorDevices || '-'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useLanguage } from './LanguageToggle';
import { httpClient } from '../services/api';

export default function FarmerFormModal({ show, onClose, onAdd }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    phoneNumber: '',
    profileImageUrl: '',
    cropType: '',
    villageName: '',
    districtName: '',
    provinceCity: '',
    plantingDate: '',
    harvestDate: '',
    qrExpirationDays: '',
    sensorDevices: ''
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(t('file_size_limit'));
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert(t('select_image'));
        return;
      }

      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to Cloudinary
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await httpClient.post('/upload/image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          setFormData(prev => ({ ...prev, profileImageUrl: response.data.url }));
        } else {
          alert(t('failed_upload'));
          setImagePreview(null);
        }
      } catch (error) {
        alert(t('failed_upload') + ': ' + (error.response?.data?.error || error.message));
        setImagePreview(null);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      gender: '',
      phoneNumber: '',
      profileImageUrl: '',
      cropType: '',
      villageName: '',
      districtName: '',
      provinceCity: '',
      plantingDate: '',
      harvestDate: '',
      qrExpirationDays: '',
      sensorDevices: ''
    });
    setImagePreview(null);
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', padding: '1rem 1.5rem' }}>
            <h3 className="modal-title fw-bold mb-0" style={{ color: 'white', fontSize: 'clamp(1.25rem, 5vw, 1.75rem)' }}>
              <i className="bi bi-person-plus-fill me-2"></i>
              {t('add_new_farmer')}
            </h3>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} style={{ fontSize: '1.2rem' }}></button>
          </div>

          <div className="modal-body p-3 p-md-4">
            <form onSubmit={handleSubmit} id="farmerForm">
              {/* Farmer Information Section */}
              <div className="mb-3 mb-md-4">
                <h6 className="text-success mb-3" style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}>
                  <i className="bi bi-person-badge me-2"></i>
                  {t('farmer_profile')}
                </h6>
                
                <div className="row g-2 g-md-3">
                  <div className="col-12 col-md-6 mb-2 mb-md-3">
                    <label htmlFor="firstName" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('first_name')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      placeholder={t('first_name')}
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>

                  <div className="col-12 col-md-6 mb-2 mb-md-3">
                    <label htmlFor="lastName" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('last_name')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      placeholder={t('last_name')}
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>

                  <div className="col-12 col-md-6 mb-2 mb-md-3">
                    <label htmlFor="gender" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('gender')}
                    </label>
                    <select
                      className="form-control"
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    >
                      <option value="">{t('select_gender')}</option>
                      <option value="male">{t('male')}</option>
                      <option value="female">{t('female')}</option>
                      <option value="other">{t('other')}</option>
                    </select>
                  </div>
                </div>

                <div className="mb-2 mb-md-3">
                  <label htmlFor="phoneNumber" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                    {t('phone_number')}
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    required
                    placeholder={t('phone_number')}
                    style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                  />
                </div>

                <div className="mb-2 mb-md-3">
                  <label htmlFor="profileImage" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                    <i className="bi bi-image me-2"></i>
                    {t('profile_picture')}
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    id="profileImage"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={uploadingImage}
                    style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}
                  />
                  <small className="text-muted">{t('max_file_size')}</small>
                  
                  {uploadingImage && (
                    <div className="mt-2 text-center">
                      <div className="spinner-border spinner-border-sm text-success me-2" role="status">
                        <span className="visually-hidden">{t('uploading')}</span>
                      </div>
                      <small className="text-success">{t('uploading_cloud')}</small>
                    </div>
                  )}
                  
                  {imagePreview && !uploadingImage && (
                    <div className="mt-3 text-center">
                      <img 
                        src={imagePreview} 
                        alt="Profile Preview" 
                        className="img-thumbnail"
                        style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                      />
                      <div className="mt-2">
                        <small className="text-success">
                          <i className="bi bi-check-circle-fill me-1"></i>
                          {t('image_uploaded')}
                        </small>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Crop Details Section */}
              <div className="mb-3">
                <h6 className="text-success mb-3" style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}>
                  <i className="bi bi-clipboard-data me-2"></i>
                  {t('crop_details')}
                </h6>

                <div className="row g-2 g-md-3">
                  <div className="col-12 col-md-6 mb-2 mb-md-3">
                    <label htmlFor="cropType" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('crop_type')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="cropType"
                      name="cropType"
                      value={formData.cropType}
                      onChange={handleChange}
                      required
                      placeholder={t('crop_type')}
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>
                </div>

                <div className="row g-2 g-md-3">
                  <div className="col-12 col-md-4 mb-2 mb-md-3">
                    <label htmlFor="villageName" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('village_name')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="villageName"
                      name="villageName"
                      value={formData.villageName}
                      onChange={handleChange}
                      required
                      placeholder={t('village_name')}
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>

                  <div className="col-12 col-md-4 mb-2 mb-md-3">
                    <label htmlFor="districtName" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('district_name')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="districtName"
                      name="districtName"
                      value={formData.districtName}
                      onChange={handleChange}
                      required
                      placeholder={t('district_name')}
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>

                  <div className="col-12 col-md-4 mb-2 mb-md-3">
                    <label htmlFor="provinceCity" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('province_city')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="provinceCity"
                      name="provinceCity"
                      value={formData.provinceCity}
                      onChange={handleChange}
                      required
                      placeholder={t('province_city')}
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>
                </div>

                <div className="row g-2 g-md-3">
                  <div className="col-12 col-md-6 mb-2 mb-md-3">
                    <label htmlFor="plantingDate" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('planting_date')}
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      id="plantingDate"
                      name="plantingDate"
                      value={formData.plantingDate}
                      onChange={handleChange}
                      required
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>

                  <div className="col-12 col-md-6 mb-2 mb-md-3">
                    <label htmlFor="harvestDate" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      {t('harvest_date')}
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      id="harvestDate"
                      name="harvestDate"
                      value={formData.harvestDate}
                      onChange={handleChange}
                      required
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                  </div>

                  <div className="col-12 col-md-6 mb-2 mb-md-3">
                    <label htmlFor="qrExpirationDays" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                      <i className="bi bi-calendar-x me-2"></i>
                      {t('qr_expiration_days')}
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="qrExpirationDays"
                      name="qrExpirationDays"
                      value={formData.qrExpirationDays}
                      onChange={handleChange}
                      min="1"
                      max="365"
                      required
                      placeholder="Enter days (1-365)"
                      style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                    />
                    <small className="text-muted">{t('qr_expiration_days_help')}</small>
                  </div>
                </div>

                <div className="mb-2 mb-md-3">
                  <label htmlFor="sensorDevices" className="form-label fw-semibold" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
                    <i className="bi bi-cpu me-2"></i>
                    {t('sensor_devices')}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="sensorDevices"
                    name="sensorDevices"
                    value={formData.sensorDevices}
                    onChange={handleChange}
                    placeholder="e.g., sensor1, sensor2, sensor3"
                    style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                  />
                  <small className="text-muted">{t('enter_devices')}</small>
                </div>
              </div>
            </form>
          </div>

          <div className="modal-footer p-2 p-md-3 flex-column flex-sm-row gap-2">
            <button type="button" className="btn btn-secondary w-100 w-sm-auto order-2 order-sm-1" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" form="farmerForm" className="btn btn-success w-100 w-sm-auto order-1 order-sm-2">
              <i className="bi bi-check-circle me-2"></i>
              {t('add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
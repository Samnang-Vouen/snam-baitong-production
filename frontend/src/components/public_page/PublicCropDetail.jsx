import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicPlantByToken } from '../../services/api';
import { translations } from '../../utils/translations';
import LoadingSpinner from '../LoadingSpinner';
import logoAgri from '../../img/logoAgri.jpg';

const PublicCropDetail = () => {
  const { token } = useParams();
  const [language, setLanguage] = useState('en');
  const [cropData, setCropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const t = translations[language];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPublicPlantByToken(token);
      setCropData(res?.data ? res.data : res);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load crop data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 1 hour
    const interval = setInterval(fetchData, 3600000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'km' : 'en');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US');
  };

  const isQRExpired = () => {
    const exp = cropData?.qr?.expiresAt;
    if (!exp) return false;
    return new Date(exp) < new Date();
  };

  if (loading) {
    return (
      <div className="public-container">
        <LoadingSpinner label={t.loading} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="public-container">
      <header className="public-header">
        <img src={logoAgri} alt="Logo" className="logo" />
        <h1 style={{ fontSize: 'clamp(18px, 4vw, 24px)' }}>{t.crop_details}</h1>
        <button onClick={toggleLanguage} className="lang-toggle">
          {language === 'en' ? 'ភាសាខ្មែរ' : 'English'}
        </button>
      </header>

      {isQRExpired() && (
        <div className="qr-expired-banner">
          ⚠️ {t.qr_expired}
        </div>
      )}

      <div className="public-content">
        {/* Farmer Profile */}
        <section className="farmer-profile">
          <h2 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)' }}>{t.farmer_profile}</h2>
          {cropData?.meta?.farmerImage && (
            <img
              src={cropData.meta.farmerImage}
              alt={cropData?.meta?.plantName}
              className="farmer-avatar"
              style={{ 
                width: 'clamp(80px, 20vw, 120px)', 
                height: 'clamp(80px, 20vw, 120px)' 
              }}
            />
          )}
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.farmer_name}:</strong> {cropData?.meta?.plantName || 'N/A'}</p>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.location}:</strong> {cropData?.meta?.farmLocation || 'N/A'}</p>
        </section>

        {/* Crop Information */}
        <section className="crop-info">
          <h2 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)' }}>{t.crop_details}</h2>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.crop_type}:</strong> {cropData?.meta?.plantName || 'N/A'}</p>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.planting_date}:</strong> {formatDate(cropData?.meta?.plantedDate)}</p>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.harvest_date}:</strong> {formatDate(cropData?.meta?.harvestDate)}</p>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.location}:</strong> {cropData?.location || cropData?.meta?.farmLocation || 'N/A'}</p>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.qr_expiration}:</strong> {formatDate(cropData?.qr?.expiresAt)}</p>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>Status:</strong> {cropData?.status || 'N/A'}</p>
          {cropData?.description && (
            <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{t.description}:</strong> {cropData.description}</p>
          )}
        </section>

        {/* Sensor Data */}
        <section className="sensor-data">
          <h2 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)' }}>{t.sensor_data}</h2>
          {cropData?.data && Object.keys(cropData.data).length > 0 ? (
            <div className="sensor-grid">
              {Object.entries(cropData.data).map(([key, value]) => (
                <div key={key} className="sensor-card">
                  <div className="sensor-value">
                    <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}><strong>{key}:</strong> {value.value}{value.unit ? ` ${value.unit}` : ''}</p>
                  </div>
                  <p className="sensor-timestamp" style={{ fontSize: 'clamp(12px, 2vw, 14px)' }}>
                    <em>{t.last_updated}: {value.time || 'N/A'}</em>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 'clamp(14px, 2.5vw, 16px)' }}>{t.no_sensor_data}</p>
          )}
        </section>

        <p className="public-note" style={{ fontSize: 'clamp(12px, 2vw, 14px)' }}>{t.public_note}</p>
      </div>
    </div>
  );
};

export default PublicCropDetail;
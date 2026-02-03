import React, { useState, useEffect } from 'react';
import { translations } from '../../utils/translations';
import LoadingSpinner from '../LoadingSpinner';
import logoAgri from '../../img/logoAgri.jpg';
import './PublicCropDetail.css';
import { samplePlants, sampleSensorSnapshot } from '../../utils/mockData';

const buildMockCropData = () => {
  const plant = samplePlants?.[0] || {};
  return {
    meta: {
      plantName: plant.plantName || 'Demo Crop',
      farmLocation: plant.farmLocation || 'Demo Location',
      plantedDate: plant.plantedDate || new Date().toISOString(),
      harvestDate: plant.harvestDate || new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      farmerImage: undefined,
    },
    location: plant.farmLocation || 'Demo Location',
    status: plant.status || 'well_planted',
    description: 'This is demo data for the public crop detail page.',
    qr: {
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    },
    data: sampleSensorSnapshot || {},
  };
};

const PublicCropDetailTest = () => {
  const [language, setLanguage] = useState('en');
  const [cropData, setCropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const t = translations[language];

  useEffect(() => {
    // Simulate async fetch
    const timer = setTimeout(() => {
      setCropData(buildMockCropData());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'km' : 'en'));
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

  return (
    <div className="public-container">
      <header className="public-header">
        <img src={logoAgri} alt="Logo" className="logo" />
        <h1>{t.crop_details}</h1>
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
          <h2>{t.farmer_profile}</h2>
          {cropData?.meta?.farmerImage && (
            <img
              src={cropData.meta.farmerImage}
              alt={cropData?.meta?.plantName}
              className="farmer-avatar"
            />
          )}
          <p><strong>{t.farmer_name}:</strong> {cropData?.meta?.plantName || 'N/A'}</p>
          <p><strong>{t.location}:</strong> {cropData?.meta?.farmLocation || 'N/A'}</p>
        </section>

        {/* Crop Information */}
        <section className="crop-info">
          <h2>{t.crop_details}</h2>
          <p><strong>{t.crop_type}:</strong> {cropData?.meta?.plantName || 'N/A'}</p>
          <p><strong>{t.planting_date}:</strong> {formatDate(cropData?.meta?.plantedDate)}</p>
          <p><strong>{t.harvest_date}:</strong> {formatDate(cropData?.meta?.harvestDate)}</p>
          <p><strong>{t.location}:</strong> {cropData?.location || cropData?.meta?.farmLocation || 'N/A'}</p>
          <p><strong>{t.qr_expiration}:</strong> {formatDate(cropData?.qr?.expiresAt)}</p>
          <p><strong>Status:</strong> {cropData?.status || 'N/A'}</p>
          {cropData?.description && (
            <p><strong>{t.description}:</strong> {cropData.description}</p>
          )}
        </section>

        {/* Sensor Data */}
        <section className="sensor-data">
          <h2>{t.sensor_data}</h2>
          {cropData?.data && Object.keys(cropData.data).length > 0 ? (
            <div className="sensor-grid">
              {Object.entries(cropData.data).map(([key, value]) => (
                <div key={key} className="sensor-card">
                  <div className="sensor-value">
                    <p><strong>{key}:</strong> {value.value}{value.unit ? ` ${value.unit}` : ''}</p>
                  </div>
                  <p className="sensor-timestamp">
                    <em>{t.last_updated}: {value.time || 'N/A'}</em>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>{t.no_sensor_data}</p>
          )}
        </section>

        <p className="public-note">{t.public_note}</p>
      </div>
    </div>
  );
};

export default PublicCropDetailTest;

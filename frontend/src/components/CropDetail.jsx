import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from './LanguageToggle';
import LoadingSpinner from './LoadingSpinner';
import { getPlant, updatePlant } from '../services/api';
import { formatDate } from '../utils/date';

export default function CropDetail({ publicMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t, lang } = useLanguage();
  const [crop, setCrop] = useState(null);
  const [status, setStatus] = useState('well_planted');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ministryFeedback, setMinistryFeedback] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const STATUS_OPTIONS = [
    { value: 'well_planted', label: t('well_planted') },
    { value: 'not_planted', label: t('not_planted') },
    { value: 'died', label: t('died') }
  ];

  useEffect(() => {
    const fetchCrop = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await getPlant(id, { includeSensors: true });
        setCrop(res?.data || null);
        setStatus(res?.data?.status || 'well_planted');
        setMinistryFeedback(res?.data?.ministry_feedback || '');
      } catch (err) {
        const message = err?.response?.data?.error || 'Failed to load crop';
        setError(message);
      }
      setLoading(false);
    };
    fetchCrop();
  }, [id]);

  const handleStatusSave = async () => {
    try {
      setSaving(true);
      setError('');
      const res = await updatePlant(id, { status });
      setCrop((prev) => ({ ...(prev || {}), ...(res?.data || {}) }));
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to update status';
      setError(message);
    }
    setSaving(false);
  };

  const handleFeedbackSave = async () => {
    try {
      setFeedbackSaving(true);
      setError('');
      const res = await updatePlant(id, { ministryFeedback });
      setCrop((prev) => ({ ...(prev || {}), ...(res?.data || {}) }));
      alert(t('feedback_submitted') || 'Feedback submitted successfully!');
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to submit feedback';
      setError(message);
    }
    setFeedbackSaving(false);
  };

  if (loading) {
    return <LoadingSpinner label={t('loading')} />;
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">{error}</div>
      </div>
    );
  }

  if (!crop) return null;

  const sensorReadings = crop.latestSensors?.readings || {};

  return (
    <div className="crop-detail-wrapper">
      {!publicMode && (
        <div className="crop-detail-header">
          <div className="crop-detail-header-inner">
            <button
              className="btn btn-secondary crop-detail-back-btn"
              onClick={() => navigate(-1)}
            >
              ← {t('back')}
            </button>
          </div>
        </div>
      )}

      <div className="crop-detail-container">
        <h1 className="crop-detail-title">🌾 {t('crop_details')}</h1>

        <div className="card mb-4 crop-info-card">
          <div className="card-body p-5">
            <div className="row">
              <div className="col-md-6 mb-3">
                <p className="crop-info-row">{t('farmer')}</p>
                <p className="crop-info-value">{crop.farmerImage ? '📷 Attached' : '-'}</p>
              </div>
              <div className="col-md-6 mb-3">
                <p className="crop-info-row">{t('crop_type')}</p>
                <p className="crop-info-value">{crop.plantName}</p>
              </div>
              <div className="col-md-6 mb-3">
                <p className="crop-info-row">{t('location')}</p>
                <p className="crop-info-value-normal">📍 {crop.farmLocation}</p>
              </div>
              <div className="col-md-6 mb-3">
                <p className="crop-info-row">{t('planting_date')}</p>
                <p className="crop-info-value-normal">🌱 {formatDate(crop.plantedDate, lang)}</p>
              </div>
              <div className="col-md-6 mb-0">
                <p className="crop-info-row">{t('harvest_date')}</p>
                <p className="crop-info-value-normal">🌾 {formatDate(crop.harvestDate, lang)}</p>
              </div>
              <div className="col-md-6 mb-0">
                <p className="crop-info-row">Status</p>
                <p className="crop-info-value-normal">{status.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        <h3 className="crop-comments-section">📡 {t('sensor_data')}</h3>
        <div className="card mb-4">
          <div className="card-body">
            {Object.keys(sensorReadings).length === 0 ? (
              <p className="text-muted mb-0">{t('no_sensor_data')}</p>
            ) : (
              <div className="row">
                {Object.entries(sensorReadings).map(([key, value]) => (
                  <div key={key} className="col-md-4 mb-3">
                    <div className="border rounded p-3 h-100">
                      <div className="fw-semibold text-capitalize">{key}</div>
                      <div style={{ fontSize: '1.1rem' }}>{value.value}{value.unit ? ` ${value.unit}` : ''}</div>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}>{value.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!publicMode && role === 'ministry' && (
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="mb-3">💬 {t('ministry_feedback') || 'Ministry Feedback'}</h5>
              <div className="mb-3">
                <textarea
                  className="form-control"
                  rows="4"
                  maxLength="600"
                  placeholder={t('feedback_placeholder') || 'Enter your feedback (optional, max 600 characters)...'}
                  value={ministryFeedback}
                  onChange={(e) => setMinistryFeedback(e.target.value)}
                />
                <div className="text-muted small mt-1">
                  {ministryFeedback.length}/600 characters
                </div>
              </div>
              <button
                className="btn btn-primary"
                disabled={feedbackSaving}
                onClick={handleFeedbackSave}
              >
                {feedbackSaving ? t('loading') : (t('submit_feedback') || 'Submit Feedback')}
              </button>
            </div>
          </div>
        )}

        {!publicMode && role === 'admin' && (
          <>
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="mb-3">{t('update_crop_status')}</h5>
                <div className="row g-3 align-items-center">
                  <div className="col-md-6">
                    <select
                      className="form-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <button
                      className="btn btn-success w-100"
                      disabled={saving}
                      onClick={handleStatusSave}
                    >
                      {saving ? t('loading') : t('save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {crop.ministry_feedback && (
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="mb-3">💬 {t('ministry_feedback') || 'Ministry Feedback'}</h5>
                  <div className="alert alert-info mb-0">
                    <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{crop.ministry_feedback}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

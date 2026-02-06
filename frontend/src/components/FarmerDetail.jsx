import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from './LanguageToggle';
import ConfirmModal from './ConfirmModal';
import FarmerInfoCard from './FarmerInfoCard';
import QRCodeCard from './QRCodeCard';
import FeedbackCard from './FeedbackCard';
import SensorDevicesSelector from './SensorDevicesSelector';
import FarmInfoCard from './FarmInfoCard';
import FarmerSensorDashboard from './sensorDashboard/FarmerSensorDashboard';
import { useFarmerData } from '../hooks/useFarmerData';
import { useFarmerEdit } from '../hooks/useFarmerEdit';
import { useQRCode } from '../hooks/useQRCode';
import { useFeedback } from '../hooks/useFeedback';
import { useTimeFilter } from '../hooks/useTimeFilter';

export default function FarmerDetail({ farmerId = null, initialFarmer = null, onBack = null, onFeedbackViewed = null }) {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();
  const id = farmerId || paramId;

  // Keep legacy time filter hook for now (used by other components).
  // Dashboard uses its own range filter.
  const { timeFilter } = useTimeFilter();

  // Custom hooks for data and logic
  const { 
    farmer, 
    sensors, 
    loading, 
    error: farmerError, 
    selectedDevice, 
    setSelectedDevice, 
  } = useFarmerData(id, role, onFeedbackViewed, timeFilter, initialFarmer);

  const {
    isEditing,
    editForm,
    saving,
    error: editError,
    handleEditClick,
    handleCancelEdit,
    handleSaveEdit,
    handleInputChange,
    showSuccessModal: editSuccessModal,
    setShowSuccessModal: setEditSuccessModal
  } = useFarmerEdit(farmer, id);

  const {
    qrDataUrl,
    generatingQR,
    error: qrError,
    downloadSuccess,
    handleGenerateQR,
    handleDownloadQR
  } = useQRCode(id, farmer);

  const {
    ministryFeedback,
    setMinistryFeedback,
    feedbackSaving,
    error: feedbackError,
    showSuccessModal: feedbackSuccessModal,
    setShowSuccessModal: setFeedbackSuccessModal,
    handleFeedbackSave,
    feedbacks,
    feedbacksLoading,
  } = useFeedback(farmer, id);

  // Combine all errors
  const error = farmerError || editError || qrError || feedbackError;

  if (loading) {
    return (
      <div className="mt-4">
        {/* Skeleton UI for better UX */}
        <div className="row">
          <div className="col-lg-6 mb-4">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <div className="placeholder-glow">
                  <span className="placeholder col-5"></span>
                </div>
              </div>
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="d-flex align-items-center mb-3">
                    <div className="rounded-circle bg-secondary me-3" style={{width: '64px', height: '64px'}}></div>
                    <div className="flex-grow-1">
                      <div className="placeholder col-7 mb-2"></div>
                      <div className="placeholder col-5"></div>
                    </div>
                  </div>
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-9 mb-2"></div>
                  <div className="placeholder col-8"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-6 mb-4">
            <div className="card">
              <div className="card-body">
                <div className="placeholder-glow">
                  <div className="placeholder col-6 mb-3"></div>
                  <div className="placeholder col-12 mb-2"></div>
                  <div className="placeholder col-10"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="placeholder-glow">
              <div className="placeholder col-4 mb-3"></div>
              <div className="placeholder col-12 mb-2"></div>
              <div className="placeholder col-8"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !farmer) {
    return (
      <div className="mt-4">
        <div className="alert alert-danger" role="alert">{error}</div>
        <button className="btn btn-secondary" onClick={onBack || (() => navigate('/'))}>
          {t('back')}
        </button>
      </div>
    );
  }

  if (!farmer) return null;

  // Get unique devices from farmer data
  const devices = farmer?.sensorDevices 
    ? farmer.sensorDevices.split(',').map(d => d.trim()).filter(Boolean)
    : [];

  return (
    <div className="mt-4">
      {/* Back Button */}
      {onBack && (
        <button className="btn btn-outline-secondary mb-3" onClick={onBack}>
          <i className="bi bi-arrow-left me-2"></i>
          {t('back_to_dashboard')}
        </button>
      )}
      
      {!onBack && (
        <button className="btn btn-secondary btn-large mb-3" onClick={() => navigate('/')}>
          <i className="bi bi-arrow-left me-2"></i>
          {t('back')}
        </button>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger mb-4" role="alert">{error}</div>
      )}

      <div className="row">
        {/* Farmer Information Card */}
        <div className="col-lg-6 mb-4">
          <FarmerInfoCard
            farmer={farmer}
            role={role}
            isEditing={isEditing}
            editForm={editForm}
            saving={saving}
            onEditClick={handleEditClick}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEdit}
            onInputChange={handleInputChange}
          />
        </div>

        {/* Right Column: QR Code + Feedback */}
        <div className="col-lg-6 mb-4">
          {/* QR Code Card - Admin Only */}
          {role === 'admin' && (
            <div className="mb-4">
              <QRCodeCard
                qrDataUrl={qrDataUrl}
                generatingQR={generatingQR}
                farmer={farmer}
                downloadSuccess={downloadSuccess}
                onGenerateQR={handleGenerateQR}
                onDownloadQR={handleDownloadQR}
              />
            </div>
          )}

          {/* Ministry Feedback Display - Admin View */}
          {role === 'admin' && (
            <FeedbackCard
              farmer={farmer}
              role={role}
              ministryFeedback={ministryFeedback}
              onFeedbackChange={setMinistryFeedback}
              feedbackSaving={feedbackSaving}
              onFeedbackSave={handleFeedbackSave}
              feedbacks={feedbacks}
              feedbacksLoading={feedbacksLoading}
            />
          )}

          {/* Ministry Feedback Form - Ministry Role */}
          {role === 'ministry' && (
            <FeedbackCard
              farmer={farmer}
              role={role}
              ministryFeedback={ministryFeedback}
              onFeedbackChange={setMinistryFeedback}
              feedbackSaving={feedbackSaving}
              onFeedbackSave={handleFeedbackSave}
              feedbacks={feedbacks}
              feedbacksLoading={feedbacksLoading}
            />
          )}
        </div>
      </div>

      {/* Sensor Device Selector */}
      {devices.length > 0 && (
        <SensorDevicesSelector
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
        />
      )}

      {/* Farm Information Card */}
      {selectedDevice && sensors.filter(s => s.device === selectedDevice).length > 0 && (
        <FarmInfoCard
          sensors={sensors}
          selectedDevice={selectedDevice}
        />
      )}

      {/* Sensor Dashboard (KPI + charts + optional table) */}
      <FarmerSensorDashboard
        farmerId={id}
        device={selectedDevice}
        onDeviceChange={setSelectedDevice}
      />

      {/* Success Modals */}
      {editSuccessModal && (
        <ConfirmModal
          title={t('farmer_updated')}
          message={t('farmer_updated')}
          onConfirm={() => setEditSuccessModal(false)}
          onCancel={() => setEditSuccessModal(false)}
          confirmText={t('ok')}
          cancelText={null}
          variant="success"
        />
      )}

      {feedbackSuccessModal && (
        <ConfirmModal
          title={t('feedback_submitted') || 'Success'}
          message={t('feedback_submitted') || 'Feedback submitted successfully!'}
          onConfirm={() => setFeedbackSuccessModal(false)}
          onCancel={() => setFeedbackSuccessModal(false)}
          confirmText={t('ok') || 'OK'}
          cancelText={null}
          variant="success"
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { farmerService } from '../services/farmerService';

export function useFeedback(farmer, id) {
  const [ministryFeedback, setMinistryFeedback] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Sync ministryFeedback when farmer data loads
  useEffect(() => {
    if (farmer?.ministryFeedback) {
      setMinistryFeedback(farmer.ministryFeedback);
    }
  }, [farmer]);

  const handleFeedbackSave = async () => {
    try {
      setFeedbackSaving(true);
      setError('');
      await farmerService.updateFarmer(id, { ministryFeedback });
      setShowSuccessModal(true);
      return true;
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to submit feedback');
      return false;
    } finally {
      setFeedbackSaving(false);
    }
  };

  return {
    ministryFeedback,
    setMinistryFeedback,
    feedbackSaving,
    error,
    showSuccessModal,
    setShowSuccessModal,
    handleFeedbackSave
  };
}

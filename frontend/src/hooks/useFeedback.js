import { useState, useEffect } from 'react';
import { farmerService } from '../services/farmerService';

export function useFeedback(farmer, id) {
  const [ministryFeedback, setMinistryFeedback] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);

  // Sync ministryFeedback when farmer data loads
  useEffect(() => {
    if (farmer?.ministryFeedback) {
      setMinistryFeedback(farmer.ministryFeedback);
    }
  }, [farmer]);

  // Load feedbacks list
  const refreshFeedbacks = async () => {
    try {
      setFeedbacksLoading(true);
      const list = await farmerService.getFarmerFeedbacks(id);
      setFeedbacks(Array.isArray(list) ? list : []);
    } catch (err) {
      // Keep silent; list is optional
    } finally {
      setFeedbacksLoading(false);
    }
  };

  useEffect(() => {
    if (id) refreshFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFeedbackSave = async () => {
    try {
      setFeedbackSaving(true);
      setError('');
      // Submit via dedicated endpoint and refresh list
      await farmerService.addFarmerFeedback(id, { text: ministryFeedback });
      await refreshFeedbacks();
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
    handleFeedbackSave,
    feedbacks,
    feedbacksLoading,
    refreshFeedbacks,
  };
}

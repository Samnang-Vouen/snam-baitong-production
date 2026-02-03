import { useState, useEffect } from 'react';
import { farmerService } from '../services/farmerService';

export function useFarmerEdit(farmer, id) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Initialize form when farmer data loads
  useEffect(() => {
    if (farmer) {
      setEditForm({
        firstName: farmer.firstName || '',
        lastName: farmer.lastName || '',
        gender: farmer.gender || '',
        phoneNumber: farmer.phoneNumber || '',
        villageName: farmer.villageName || '',
        districtName: farmer.districtName || '',
        provinceCity: farmer.provinceCity || '',
        cropType: farmer.cropType || '',
        plantingDate: farmer.plantingDate ? farmer.plantingDate.split('T')[0] : '',
        harvestDate: farmer.harvestDate ? farmer.harvestDate.split('T')[0] : '',
        qrExpirationDays: farmer.qrExpirationDays !== undefined && farmer.qrExpirationDays !== null ? farmer.qrExpirationDays : 365,
        sensorDevices: farmer.sensorDevices || ''
      });
    }
  }, [farmer]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to original values
    if (farmer) {
      setEditForm({
        firstName: farmer.firstName || '',
        lastName: farmer.lastName || '',
        gender: farmer.gender || '',
        phoneNumber: farmer.phoneNumber || '',
        villageName: farmer.villageName || '',
        districtName: farmer.districtName || '',
        provinceCity: farmer.provinceCity || '',
        cropType: farmer.cropType || '',
        plantingDate: farmer.plantingDate ? farmer.plantingDate.split('T')[0] : '',
        harvestDate: farmer.harvestDate ? farmer.harvestDate.split('T')[0] : '',
        qrExpirationDays: farmer.qrExpirationDays !== undefined && farmer.qrExpirationDays !== null ? farmer.qrExpirationDays : 365,
        sensorDevices: farmer.sensorDevices || ''
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      setError('');
      await farmerService.updateFarmer(id, editForm);
      setIsEditing(false);
      setShowSuccessModal(true);
      // Reload the page after a short delay to show the updated data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return true;
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update farmer');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  return {
    isEditing,
    editForm,
    saving,
    error,
    showSuccessModal,
    setShowSuccessModal,
    handleEditClick,
    handleCancelEdit,
    handleSaveEdit,
    handleInputChange
  };
}

import CropCard from './CropCard';
import { useLanguage } from './LanguageToggle';
import { httpClient } from '../services/api';

export default function CropGrid({ crops, onCropsUpdate, onViewFarmer, onFeedbackViewed }) {
  const { t } = useLanguage();

  const handleDelete = async (id, type) => {
    try {
      if (type === 'farmer') {
        // Delete farmer
        await httpClient.delete(`/farmers/${id}`);
      } else {
        // Delete crop/plant
        await httpClient.delete(`/plants/${id}`);
      }
      
      // Trigger refresh in parent component
      if (onCropsUpdate) {
        await onCropsUpdate();
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
  };

  if (!crops || !crops.length) {
    return (
      <div className="alert alert-secondary" role="alert">
        {t('no_crops_available')}
      </div>
    );
  }

  return (
    <div className="row">
      {crops.map((crop) => (
        <div key={crop.id} className="col-md-6 col-lg-4 mb-4">
          <CropCard crop={crop} onDelete={handleDelete} onViewFarmer={onViewFarmer} onFeedbackViewed={onFeedbackViewed} />
        </div>
      ))}
    </div>
  );
}
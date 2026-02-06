import { useLanguage } from './LanguageToggle';

export default function FarmInfoCard({ sensors, selectedDevice }) {
  const { t } = useLanguage();
  
  const deviceSensor = sensors.find(s => s.device === selectedDevice);
  
  if (!deviceSensor) return null;

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-info text-white">
        <h4 className="mb-0">
          <i className="bi bi-building me-2"></i>
          {t('farm_information') || 'Farm Information'}
          <span className="badge bg-light text-dark ms-2" style={{ fontSize: '0.75rem' }}>
            {selectedDevice}
          </span>
        </h4>
      </div>
      <div className="card-body d-flex justify-content-center">
        <div className="row" style={{ maxWidth: '800px' }}>
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-building text-info me-2"></i>{t('farm_name') || 'Farm Name'}:</strong>
            <p className="mb-0">{deviceSensor?.farm_name || deviceSensor?.farm || '-'}</p>
          </div>
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-geo-alt-fill text-info me-2"></i>{t('farm_location') || 'Farm Location'}:</strong>
            <p className="mb-0">{deviceSensor?.location || '-'}</p>
          </div>
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-cpu text-info me-2"></i>{t('device')}:</strong>
            <p className="mb-0">{deviceSensor?.device}</p>
          </div>
          <div className="col-md-6 mb-3">
            <strong><i className="bi bi-clock text-info me-2"></i>{t('last_updated') || 'Last Updated'}:</strong>
            <p className="mb-0">{deviceSensor?.timestamp}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

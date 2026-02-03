import { useLanguage } from './LanguageToggle';

export default function SensorDevicesSelector({ 
  devices, 
  selectedDevice, 
  onSelectDevice 
}) {
  const { t } = useLanguage();

  if (!devices || devices.length === 0) {
    return (
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-success text-white">
          <h4 className="mb-0">
            <i className="bi bi-cpu me-2"></i>{t('sensor_devices')}
          </h4>
        </div>
        <div className="card-body">
          <p className="mb-0 text-muted">{t('no_sensors_available')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-success text-white">
        <h4 className="mb-0" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>
          <i className="bi bi-cpu me-2"></i>{t('sensor_devices')}
        </h4>
      </div>
      <div className="card-body">
        <p className="text-muted small mb-2" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
          <i className="bi bi-hand-index me-1"></i>
          <span className="d-none d-sm-inline">{t('click_sensor_device_to_view_data')}</span>
          <span className="d-sm-none">Select a device</span>
        </p>
        <div className="mt-2 d-flex flex-wrap gap-2">
          {devices.map((device, idx) => (
            <span 
              key={idx} 
              className={`badge ${selectedDevice === device ? 'bg-success' : 'bg-primary'}`}
              onClick={() => onSelectDevice(device)}
              style={{ 
                cursor: 'pointer', 
                userSelect: 'none', 
                fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)', 
                padding: 'clamp(0.4rem, 1.5vw, 0.5rem) clamp(0.6rem, 2vw, 0.75rem)' 
              }}
              title={`Click to view data from ${device}`}
            >
              {device}
              {selectedDevice === device && <i className="bi bi-check-circle-fill ms-1"></i>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

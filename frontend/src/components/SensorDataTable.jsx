import { useLanguage } from './LanguageToggle';
import { useState } from 'react';
import { httpClient } from '../services/api';

export default function SensorDataTable({ 
  sensors, 
  selectedDevice, 
  timeFilter, 
  onTimeFilterChange,
  farmerId 
}) {
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);

  const filteredSensors = sensors.filter(
    sensor => !selectedDevice || sensor.device === selectedDevice
  );

  const handleDownloadCSV = async () => {
    if (!selectedDevice) return;

    try {
      setDownloading(true);
      
      // Call backend endpoint to download CSV with ALL historical data
      const response = await httpClient.get(
        `/farmers/${farmerId}/sensors/download?device=${selectedDevice}`,
        { responseType: 'blob' }
      );

      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sensor_data_${selectedDevice}_all_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      alert(error?.response?.data?.error || 'Failed to download data');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-primary text-white">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h4 className="mb-0">
            <i className="bi bi-cpu me-2"></i>
            {t('sensor_data')}
            {selectedDevice && (
              <span className="badge bg-success ms-2" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-check-circle me-1"></i>{selectedDevice}
              </span>
            )}
          </h4>
          <div className="d-flex align-items-center gap-2">
            <label className="text-white mb-0 d-flex align-items-center" style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
              <i className="bi bi-clock-history me-1"></i>
              <span className="d-none d-sm-inline">{t('time_filter')}</span>
            </label>
            <select 
              className="form-select form-select-sm"
              style={{ 
                width: 'auto', 
                minWidth: '145px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                fontWeight: '500'
              }}
              value={timeFilter}
              onChange={(e) => onTimeFilterChange(e.target.value)}
            >
              <option value="all">{t('latest_data')}</option>
              <option value="24h">{t('past_24h')}</option>
              <option value="2d">{t('past_2d')}</option>
              <option value="7d">{t('past_7d')}</option>
            </select>
            <button
              className="btn btn-success btn-sm"
              onClick={handleDownloadCSV}
              disabled={!selectedDevice || downloading}
              title={t('download_csv') || 'Download all data as CSV'}
            >
              {downloading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  <span className="d-none d-sm-inline">{t('loading') || 'Loading...'}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-download me-1"></i>
                  <span className="d-none d-sm-inline">{t('download') || 'Download'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="card-body">
        {sensors.length === 0 ? (
          <div className="alert alert-info" role="alert">
            <i className="bi bi-info-circle me-2"></i>
            {t('no_sensors_available')}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead className="table-success">
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('device')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('farm_name') || 'Farm'}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('temperature')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('moisture')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('ec')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>pH</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('nitrogen')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('phosphorus')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('potassium')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('timestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSensors.map((sensor, index) => (
                  <tr key={index}>
                    <td><strong>{sensor.device}</strong></td>
                    <td>{sensor.farm || '-'}</td>
                    <td>{sensor.temperature !== null ? `${sensor.temperature}°C` : '-'}</td>
                    <td>{sensor.moisture !== null ? `${sensor.moisture}%` : '-'}</td>
                    <td>{sensor.ec !== null ? `${sensor.ec} µS/cm` : '-'}</td>
                    <td>{sensor.pH !== null ? sensor.pH : '-'}</td>
                    <td>{sensor.nitrogen !== null ? sensor.nitrogen : '-'}</td>
                    <td>{sensor.phosphorus !== null ? sensor.phosphorus : '-'}</td>
                    <td>{sensor.potassium !== null ? sensor.potassium : '-'}</td>
                    <td><small>{sensor.timestamp}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedDevice && filteredSensors.length === 0 && (
              <div className="alert alert-warning mt-3" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                No sensor data available for device: <strong>{selectedDevice}</strong>
              </div>
            )}
            {sensors.length === 0 && timeFilter !== 'all' && (
              <div className="alert alert-info mt-3" role="alert">
                <i className="bi bi-info-circle me-2"></i>
                No sensor data found for the selected time period.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { formatValue, getMetricStatus } from '../../utils/sensorRanges';
import { useLanguage } from '../LanguageToggle';

export default function KpiCard({ title, metric, value, subtitle }) {
  const { t } = useLanguage();
  const status = getMetricStatus(metric, value);
  const borderClass = status.variant === 'danger' ? 'border-danger' : status.variant === 'warning' ? 'border-warning' : '';

  return (
    <div className={`card shadow-sm h-100 ${borderClass}`}>
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="fw-semibold text-muted" style={{ fontSize: '0.9rem' }}>
            {title}
          </div>
          <span
            className={`badge rounded-pill ${
              status.variant === 'danger' ? 'text-bg-danger' : status.variant === 'warning' ? 'text-bg-warning' : status.variant === 'secondary' ? 'text-bg-secondary' : 'text-bg-success'
            }`}
            style={{ fontSize: '0.75rem' }}
          >
            {t(status.labelKey)}
          </span>
        </div>

        <div className={`mt-2 fw-bold ${status.variant === 'danger' ? 'text-danger' : status.variant === 'warning' ? 'text-warning' : ''}`} style={{ fontSize: '1.75rem', lineHeight: 1.2 }}>
          {formatValue(metric, value)}
        </div>

        {subtitle ? (
          <div className="mt-1 small text-muted">
            <i className="bi bi-clock-history me-1"></i>
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

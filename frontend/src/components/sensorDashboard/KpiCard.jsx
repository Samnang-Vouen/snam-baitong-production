import { formatValue, isOutOfRange } from '../../utils/sensorRanges';
import { useLanguage } from '../LanguageToggle';

export default function KpiCard({ title, metric, value, subtitle }) {
  const { t } = useLanguage();
  const bad = isOutOfRange(metric, value);
  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div className={`card shadow-sm h-100 ${bad ? 'border-danger' : ''}`}>
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="fw-semibold text-muted" style={{ fontSize: '0.9rem' }}>
            {title}
          </div>
          {hasValue ? (
            <span
              className={`badge rounded-pill ${bad ? 'text-bg-danger' : 'text-bg-success'}`}
              style={{ fontSize: '0.75rem' }}
            >
              {bad ? t('status_out_of_range') : t('status_normal')}
            </span>
          ) : null}
        </div>

        <div className={`mt-2 fw-bold ${bad ? 'text-danger' : ''}`} style={{ fontSize: '1.75rem', lineHeight: 1.2 }}>
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

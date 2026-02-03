import { useId, useMemo } from 'react';
import { useLanguage } from '../LanguageToggle';

export default function TimeRangeFilter({ value, onChange }) {
  const selectId = useId();
  const { t } = useLanguage();

  const options = useMemo(
    () => [
      { value: 'latest', label: t('latest') },
      { value: '5m', label: t('range_last_5m') },
      { value: '15m', label: t('range_last_15m') },
      { value: '1h', label: t('range_last_1h') },
      { value: '24h', label: t('range_last_24h') },
      { value: '2d', label: t('range_last_2d') },
      { value: '7d', label: t('range_last_7d') },
      { value: '30d', label: t('range_last_30d') },
    ],
    [t]
  );

  return (
    <div className="d-flex flex-column gap-1 time-range-filter">
      <label
        htmlFor={selectId}
        className="form-label mb-0 fw-semibold"
        style={{ fontSize: '0.85rem' }}
      >
        {t('time_filter')}
      </label>
      <div className="input-group input-group-sm w-100">
        <span className="input-group-text bg-white">
          <i className="bi bi-clock-history text-info"></i>
        </span>
        <select
          id={selectId}
          className="form-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { formatValue, isOutOfRange } from '../../utils/sensorRanges';
import { useLanguage } from '../LanguageToggle';
import { formatDateTime } from '../../utils/date';

function cmp(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export default function SensorRawTable({ data }) {
  const { t, lang } = useLanguage();
  const [sortKey, setSortKey] = useState('time');
  const [sortDir, setSortDir] = useState('desc');

  const columns = useMemo(
    () => [
      { key: 'time', label: t('timestamp') },
      { key: 'temperature', label: t('temperature') },
      { key: 'moisture', label: t('moisture') },
      { key: 'ec', label: t('ec') },
      { key: 'ph', label: t('ph') },
      { key: 'n', label: 'N' },
      { key: 'p', label: 'P' },
      { key: 'k', label: 'K' },
    ],
    [t]
  );

  const rows = useMemo(() => {
    const items = Array.isArray(data) ? [...data] : [];

    items.sort((ra, rb) => {
      const a = ra?.[sortKey];
      const b = rb?.[sortKey];

      const base = sortKey === 'time' ? cmp(new Date(a).valueOf(), new Date(b).valueOf()) : cmp(a, b);
      return sortDir === 'asc' ? base : -base;
    });

    return items;
  }, [data, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'time' ? 'desc' : 'asc');
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light d-flex align-items-center justify-content-between">
        <div className="fw-semibold">
          <i className="bi bi-table me-2"></i>
          {t('raw_data')}
        </div>
        <div className="small text-muted">{t('click_column_to_sort')}</div>
      </div>

      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0 align-middle sensor-raw-table">
            <thead className="table-light">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="user-select-none"
                    style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r?.time
                      ? formatDateTime(r.time, lang)
                      : r?.timestampLocal
                        ? formatDateTime(r.timestampLocal, lang)
                        : '-'}
                  </td>
                  {['temperature', 'moisture', 'ec', 'ph', 'n', 'p', 'k'].map((metric) => {
                    const bad = isOutOfRange(metric, r?.[metric]);
                    return (
                      <td key={metric} className={bad ? 'fw-semibold text-danger' : ''}>
                        {formatValue(metric, r?.[metric])}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td className="text-muted py-3" colSpan={columns.length}>
                    {t('no_rows')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

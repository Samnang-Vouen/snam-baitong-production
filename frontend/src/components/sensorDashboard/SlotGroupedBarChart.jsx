import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatValue, getMetricStatus, normalizeMetricValue } from '../../utils/sensorRanges';
import { useLanguage } from '../LanguageToggle';

function defaultColorForMetric(metric) {
  switch (metric) {
    case 'temperature':
      return '#ef4444';
    case 'humidity':
    case 'moisture':
      return '#0ea5e9';
    case 'ec':
      return '#f59e0b';
    case 'ph':
      return '#16a34a';
    case 'n':
      return '#7c3aed';
    case 'p':
      return '#db2777';
    case 'k':
      return '#334155';
    default:
      return '#64748b';
  }
}

function labelForMetric(metric) {
  switch (metric) {
    case 'temperature':
      return 'Temp';
    case 'humidity':
      return 'Humidity';
    case 'moisture':
      return 'Moisture';
    case 'ec':
    case 'ec__ds_m':
      return 'EC';
    case 'ph':
      return 'pH';
    case 'n':
      return 'N';
    case 'p':
      return 'P';
    case 'k':
      return 'K';
    default:
      return metric;
  }
}

function normalizeMetricKey(metric) {
  switch (metric) {
    case 'temperature':
      return 'air_temp';
    case 'humidity':
      return 'air_humidity';
    case 'moisture':
      return 'moisture';
    case 'ec':
    case 'ec__ds_m':
      return 'ec';
    case 'ph':
      return 'ph';
    case 'n':
      return 'nitrogen';
    case 'p':
      return 'phosphorus';
    case 'k':
      return 'potassium';
    default:
      return metric;
  }
}

function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border rounded bg-white shadow-sm p-2" style={{ minWidth: '220px' }}>
      <div className="fw-semibold mb-2 small">{label}</div>
      <div className="d-flex flex-column gap-1">
        {payload.map((p) => {
          const metric = p.dataKey;
          const value = p.value;
          const mKey = normalizeMetricKey(metric);
          const raw = metric === 'ec__ds_m' ? p?.payload?.ec : value;
          const status = getMetricStatus(mKey, raw);
          return (
            <div key={metric} className="d-flex align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-2">
                <span
                  className="d-inline-block rounded"
                  style={{ width: '0.5rem', height: '0.5rem', background: p.color }}
                />
                <span className="small text-muted">{labelForMetric(metric)}</span>
              </div>
              <div className={status.outOfRange ? 'fw-semibold text-danger small' : 'fw-semibold small'}>
                {formatValue(mKey, raw)} {`(${t(status.labelKey)})`}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
        Tip: red values are outside normal range.
      </div>
    </div>
  );
}

export default function SlotGroupedBarChart({ title, description, data, metrics }) {
  const { t } = useLanguage();
  const safeData = (Array.isArray(data) ? data : []).map((r) => {
    if (!r) return r;
    if (r.ph == null && r.pH != null) return { ...r, ph: r.pH };
    if (r.ec != null) {
      const v = normalizeMetricValue('ec', r.ec);
      return { ...r, ec__ds_m: Number.isFinite(v) ? v : null };
    }
    return r;
  });

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light">
        <div className="fw-semibold">{title}</div>
        {description ? <div className="small text-muted mt-1">{description}</div> : null}
      </div>

      <div className="card-body">
        <div style={{ height: '18rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip t={t} />} />
              <Legend />
              {metrics.map((metric) => (
                <Bar
                  key={metric}
                  dataKey={metric === 'ec' ? 'ec__ds_m' : metric}
                  name={labelForMetric(metric)}
                  fill={defaultColorForMetric(metric)}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="small text-muted mt-2">
          Note: mixed units can share an axis; compare patterns more than absolute cross-metric heights.
        </div>
      </div>
    </div>
  );
}

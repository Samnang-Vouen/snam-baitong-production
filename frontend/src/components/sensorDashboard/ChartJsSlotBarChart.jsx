import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatValue, getMetricStatus, normalizeMetricValue } from '../../utils/sensorRanges';
import { useLanguage } from '../LanguageToggle';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(100, 116, 139, ${alpha})`;
  const clean = hex.replace('#', '').trim();
  const isShort = clean.length === 3;
  const r = parseInt(isShort ? clean[0] + clean[0] : clean.slice(0, 2), 16);
  const g = parseInt(isShort ? clean[1] + clean[1] : clean.slice(2, 4), 16);
  const b = parseInt(isShort ? clean[2] + clean[2] : clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function defaultColorForMetric(metric) {
  switch (metric) {
    case 'air_temp':
      return '#6366f1';
    case 'soil_temp':
      return '#f97316';
    case 'air_humidity':
    case 'moisture':
      return '#0ea5e9';
    case 'ec':
      return '#f59e0b';
    case 'ph':
      return '#16a34a';
    case 'nitrogen':
      return '#7c3aed';
    case 'phosphorus':
      return '#db2777';
    case 'potassium':
      return '#334155';
    case 'salinity':
      return '#14b8a6';
    default:
      return '#64748b';
  }
}

export default function ChartJsSlotBarChart({ title, description, data, metrics }) {
  const { t } = useLanguage();

  const labelForMetric = (metric) => {
    switch (metric) {
      case 'air_temp':
        return t('air_temp');
      case 'soil_temp':
        return t('soil_temp');
      case 'air_humidity':
        return t('air_humidity');
      case 'moisture':
        return t('moisture');
      case 'ec':
        return t('ec');
      case 'ph':
        return t('ph');
      case 'nitrogen':
        return t('nitrogen');
      case 'phosphorus':
        return t('phosphorus');
      case 'potassium':
        return t('potassium');
      case 'salinity':
        return t('salinity');
      default:
        return metric;
    }
  };

  const rows = (Array.isArray(data) ? data : []).map((r) => {
    if (!r) return r;
    // Be tolerant to backend schema/casing variations (e.g. pH vs ph).
    if (r.ph == null) {
      const candidate = r.pH ?? r.PH ?? r.Ph;
      if (candidate != null) return { ...r, ph: candidate };
    }
    return r;
  });

  // Only keep time slots that contain at least one real value for the charted metrics.
  // This removes empty buckets from the X-axis entirely.
  const filteredRows = rows.filter((r) =>
    metrics.some((metric) => {
      const v = normalizeMetricValue(metric, r?.[metric]);
      return Number.isFinite(v);
    })
  );

  const labels = filteredRows.map((r) => r?.label || '-');
  const hasAnyValue = filteredRows.length > 0;

  const datasets = metrics.map((metric) => {
    const base = defaultColorForMetric(metric);
    return {
      label: labelForMetric(metric),
      data: filteredRows.map((r) => {
        const v = normalizeMetricValue(metric, r?.[metric]);
        return Number.isFinite(v) ? v : null;
      }),
      borderColor: filteredRows.map((r) => {
        const status = getMetricStatus(metric, r?.[metric]);
        return status.outOfRange ? '#dc2626' : base;
      }),
      backgroundColor: filteredRows.map((r) => {
        const status = getMetricStatus(metric, r?.[metric]);
        return status.outOfRange ? hexToRgba('#dc2626', 0.18) : hexToRgba(base, 0.18);
      }),
      borderWidth: 2,
      borderRadius: 10,
      borderSkipped: false,
      barPercentage: 0.8,
      categoryPercentage: 0.75,
    };
  });

  const chartData = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 18,
          boxHeight: 10,
          usePointStyle: false,
          color: '#334155',
          font: { size: 12, weight: '600' },
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items?.[0]?.dataIndex;
            const row = filteredRows?.[idx];
            const label = row?.label || items?.[0]?.label || '';
            const time = row?.timestampLocal ? ` • ${row.timestampLocal}` : '';
            return `${label}${time}`;
          },
          label: (ctx) => {
            const metricLabel = ctx?.dataset?.label || ctx?.dataset?.dataKey || '';
            const metric = metrics?.[ctx?.datasetIndex] || null;
            if (!metric) return `${metricLabel}: ${ctx?.raw ?? '-'}`;
            const idx = ctx?.dataIndex;
            const raw = filteredRows?.[idx]?.[metric];
            const status = getMetricStatus(metric, raw);
            const val = formatValue(metric, raw);
            return `${metricLabel}: ${val} (${t(status.labelKey)})`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.25)' },
        ticks: { color: '#475569', font: { size: 12 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.25)' },
        ticks: { color: '#475569', font: { size: 12 } },
      },
    },
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light">
        <div className="d-flex align-items-center gap-2">
          <span className="badge text-bg-secondary" style={{ fontSize: '0.7rem' }}>
            {t('chart')}
          </span>
          <div className="fw-semibold">{title}</div>
        </div>
        {description ? <div className="small text-muted mt-1">{description}</div> : null}
      </div>

      <div className="card-body">
        <div className="sensor-chart-canvas" style={{ height: '18rem' }}>
          {filteredRows.length === 0 || !hasAnyValue ? (
            <div
              className="h-100 d-flex align-items-center justify-content-center text-muted"
              style={{ border: '2px dashed #e2e8f0', borderRadius: '0.5rem', background: '#f8fafc' }}
            >
              {t('no_data_in_selected_range')}
            </div>
          ) : (
            <Bar data={chartData} options={options} />
          )}
        </div>

        <div className="small text-muted mt-2">
          <span
            aria-hidden="true"
            className="me-2 align-middle"
            style={{
              display: 'inline-block',
              width: '1.25rem',
              height: '0.75rem',
              border: '2px solid #dc2626',
              borderRadius: '0.35rem',
              background: 'rgba(220, 38, 38, 0.14)',
              verticalAlign: 'middle',
            }}
          />
          {t('red_outline_means_out_of_range')}
        </div>
      </div>
    </div>
  );
}

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { formatValue, isOutOfRange } from '../../utils/sensorRanges';
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
    case 'temperature':
      // Use a non-red base color so red can be reserved for out-of-range highlighting.
      return '#6366f1';
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

export default function ChartJsSlotBarChart({ title, description, data, metrics }) {
  const { t } = useLanguage();

  const labelForMetric = (metric) => {
    switch (metric) {
      case 'temperature':
        return t('temperature');
      case 'humidity':
        return t('humidity');
      case 'moisture':
        return t('moisture');
      case 'ec':
        return t('ec');
      case 'ph':
        return t('ph');
      case 'n':
        return 'N';
      case 'p':
        return 'P';
      case 'k':
        return 'K';
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
      const v = r?.[metric];
      return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    })
  );

  const labels = filteredRows.map((r) => r?.label || '-');
  const hasAnyValue = filteredRows.length > 0;

  const datasets = metrics.map((metric) => {
    const base = defaultColorForMetric(metric);
    return {
      label: labelForMetric(metric),
      data: filteredRows.map((r) => {
        const v = r?.[metric];
        return v === '' || v === undefined ? null : v ?? null;
      }),
      borderColor: filteredRows.map((r) => (isOutOfRange(metric, r?.[metric]) ? '#dc2626' : base)),
      backgroundColor: filteredRows.map((r) =>
        isOutOfRange(metric, r?.[metric]) ? hexToRgba('#dc2626', 0.18) : hexToRgba(base, 0.18)
      ),
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
            const v = ctx?.raw;
            if (!metric) return `${metricLabel}: ${v ?? '-'}`;
            const out = isOutOfRange(metric, v);
            const val = formatValue(metric, v);
            return `${metricLabel}: ${val}${out ? ` (${t('status_out_of_range')})` : ''}`;
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

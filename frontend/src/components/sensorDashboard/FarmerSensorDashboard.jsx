import { useEffect, useMemo, useState } from 'react';
import { farmerService } from '../../services/farmerService';
import KpiCard from './KpiCard';
import ChartJsSlotBarChart from './ChartJsSlotBarChart';
import SensorRawTable from './SensorRawTable';
import TimeRangeFilter from './TimeRangeFilter';
import { useLanguage } from '../LanguageToggle';
import { formatDateTime } from '../../utils/date';
import '../../styles/SensorDashboard.css';

const EMPTY_ARR = [];

function toFiniteNumberOrNaN(raw) {
  if (raw === null || raw === undefined || raw === '') return Number.NaN;
  if (typeof raw === 'number') return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function hasAnyFiniteMetric(rows, keys) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const metrics = Array.isArray(keys) ? keys : [];
  for (const r of rows) {
    for (const k of metrics) {
      const v = toFiniteNumberOrNaN(r?.[k]);
      if (Number.isFinite(v)) return true;
    }
  }
  return false;
}

function filterRowsWithAnyMetric(rows, keys) {
  if (!Array.isArray(rows) || !rows.length) return EMPTY_ARR;
  const metrics = Array.isArray(keys) ? keys : [];
  return rows.filter((r) => metrics.some((k) => Number.isFinite(toFiniteNumberOrNaN(r?.[k]))));
}

function SummaryTile({ label, icon, stats, unit }) {
  const { t } = useLanguage();
  const hasStats = !!stats && Number.isFinite(stats.min) && Number.isFinite(stats.avg) && Number.isFinite(stats.max);
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');

  if (!hasStats) return null;

  return (
    <div className="h-100 border rounded-4 bg-white p-3 shadow-sm">
      <div className="d-flex align-items-start justify-content-between gap-3">
        <div className="d-flex align-items-center gap-2">
          {icon ? (
            <span className="badge rounded-pill bg-info-subtle text-info-emphasis border border-info-subtle">
              <i className={icon}></i>
            </span>
          ) : null}
          <div className="fw-semibold">{label}</div>
        </div>
        {unit ? <div className="text-muted small text-nowrap">{unit}</div> : null}
      </div>

      <div className="mt-2 d-flex gap-2">
        <div className="flex-fill rounded-3 bg-body-tertiary px-2 py-2">
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {t('min')}
          </div>
          <div className="fw-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {hasStats ? fmt(stats.min) : '-'}
          </div>
        </div>
        <div className="flex-fill rounded-3 bg-body-tertiary px-2 py-2">
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {t('avg')}
          </div>
          <div className="fw-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {hasStats ? fmt(stats.avg) : '-'}
          </div>
        </div>
        <div className="flex-fill rounded-3 bg-body-tertiary px-2 py-2">
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {t('max')}
          </div>
          <div className="fw-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {hasStats ? fmt(stats.max) : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLastUpdated({ timestampLocal, time } = {}, lang) {
  if (time) {
    return formatDateTime(time, lang, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  if (timestampLocal) {
    return formatDateTime(timestampLocal, lang, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  return '-';
}

export default function FarmerSensorDashboard({ farmerId, device: controlledDevice, onDeviceChange }) {
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [snapshotExpanded, setSnapshotExpanded] = useState(true);

  const [range, setRange] = useState('latest');

  const [deviceInternal, setDeviceInternal] = useState(null);
  const device = controlledDevice ?? deviceInternal;

  const [payload, setPayload] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Keep sticky Sensor snapshot aligned below the top navbar.
    const updateNavbarHeightVar = () => {
      const nav = document.querySelector('.navbar');
      const h = nav?.getBoundingClientRect?.().height;
      if (h && Number.isFinite(h)) {
        document.documentElement.style.setProperty('--app-navbar-height', `${Math.ceil(h)}px`);
      }
    };

    updateNavbarHeightVar();
    window.addEventListener('resize', updateNavbarHeightVar);
    return () => window.removeEventListener('resize', updateNavbarHeightVar);
  }, []);

  useEffect(() => {
    // On small screens, collapse the snapshot by default so it doesn't block the content below.
    const mq = window.matchMedia?.('(max-width: 576px)');
    if (!mq) return;

    const apply = () => setSnapshotExpanded(!mq.matches);
    apply();

    if (mq.addEventListener) {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }

    mq.addListener?.(apply);
    return () => mq.removeListener?.(apply);
  }, []);

  useEffect(() => {
    // When allowedDevices arrive, select a default device.
    if (!payload?.allowedDevices?.length) return;

    const preferred = controlledDevice || payload.allowedDevices[0];
    if (!preferred) return;

    if (controlledDevice) {
      onDeviceChange?.(preferred);
    } else {
      setDeviceInternal(preferred);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.allowedDevices?.join('|')]);

  useEffect(() => {
    if (!farmerId) return;

    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const params = { view: 'slots', slotRange: range, range: '24h' };

        // Only fetch raw rows when the table is open (keeps API fast by default).
        if (showTable) params.includeRaw = '1';

        if (device) params.device = device;

        const res = await farmerService.getFarmerSensorDashboard(farmerId, params, controller.signal);
        setPayload(res);

        // If device was not provided yet, pick first.
        if (!device && res?.allowedDevices?.length) {
          if (controlledDevice) {
            onDeviceChange?.(res.allowedDevices[0]);
          } else {
            setDeviceInternal(res.allowedDevices[0]);
          }
        }

        setLoading(false);
      } catch (e) {
        if (e?.name === 'CanceledError' || e?.name === 'AbortError') return;
        setError(e?.response?.data?.error || e?.message || 'Failed to load dashboard');
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [farmerId, device, range, showTable, controlledDevice, onDeviceChange]);

  const latest = payload?.latest || null;
  const slots = payload?.slots || EMPTY_ARR;
  const rawRowsFromApi = Array.isArray(payload?.raw) ? payload.raw : EMPTY_ARR;
  // KPI cards always show the latest overall reading (time filter does not affect KPI).
  const kpiPoint = latest;

  const isNoResultLatest = range === 'latest' && !loading && !error && !latest;
  const forceSnapshotExpanded = !!error || isNoResultLatest;
  const isSnapshotExpanded = forceSnapshotExpanded ? true : snapshotExpanded;

  const rangeLabel = useMemo(() => {
    if (range === 'latest') return t('latest');
    if (range === '5m') return t('range_last_5m');
    if (range === '15m') return t('range_last_15m');
    if (range === '1h') return t('range_last_1h');
    if (range === '24h') return t('range_last_24h');
    if (range === '2d') return t('range_last_2d');
    if (range === '7d') return t('range_last_7d');
    if (range === '30d') return t('range_last_30d');
    return String(range || '');
  }, [range, t]);

  const historyLabel = rangeLabel;
  const kpiSubtitle = useMemo(() => t('latest'), [t]);
  const showHistory = true;

  const groupingLabel = useMemo(() => {
    if (range === 'latest') return null;
    if (range === '5m' || range === '15m' || range === '1h') return t('group_5_minutes');
    if (range === '24h') return t('group_1_hour');
    if (range === '2d') return t('group_4_hours');
    if (range === '7d') return t('group_1_day');
    if (range === '30d') return t('group_7_days');
    return null;
  }, [range, t]);

  const stats = useMemo(() => {
    const calc = (key) => {
      const vals = [];
      for (const p of Array.isArray(slots) ? slots : []) {
        const v = toFiniteNumberOrNaN(p?.[key]);
        if (Number.isFinite(v)) vals.push(v);
      }
      if (!vals.length) return null;
      let min = vals[0];
      let max = vals[0];
      let sum = 0;
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
      }
      return { min, max, avg: sum / vals.length, n: vals.length };
    };
    return {
      temperature: calc('temperature'),
      moisture: calc('moisture'),
      ec: calc('ec'),
      ph: calc('ph'),
      n: calc('n'),
      p: calc('p'),
      k: calc('k'),
    };
  }, [slots]);

  const summaryItems = useMemo(
    () => [
      { key: 'temperature', label: t('temperature'), icon: 'bi bi-thermometer-half', unit: '°C' },
      { key: 'moisture', label: t('moisture'), icon: 'bi bi-droplet-half', unit: '%' },
      { key: 'ec', label: t('ec'), icon: 'bi bi-lightning-charge', unit: 'µS/cm' },
      { key: 'ph', label: t('ph'), icon: 'bi bi-speedometer2', unit: '' },
      { key: 'n', label: `${t('nitrogen')} (N)`, icon: 'bi bi-diagram-3', unit: 'mg/kg' },
      { key: 'p', label: `${t('phosphorus')} (P)`, icon: 'bi bi-diagram-3', unit: 'mg/kg' },
      { key: 'k', label: `${t('potassium')} (K)`, icon: 'bi bi-diagram-3', unit: 'mg/kg' },
    ].filter((i) => !!stats?.[i.key]),
    [stats, t]
  );

  const showSummary = summaryItems.length > 0;
  const showEnvChart = useMemo(() => hasAnyFiniteMetric(slots, ['temperature', 'moisture', 'ec', 'ph']), [slots]);
  const showNutrientChart = useMemo(() => hasAnyFiniteMetric(slots, ['n', 'p', 'k']), [slots]);
  const showCharts = showEnvChart || showNutrientChart;
  // Raw data should follow the selected time filter.
  // Prefer API-provided raw rows; fall back to slots if raw isn't requested.
  const tableRows = useMemo(() => {
    const source = rawRowsFromApi.length ? rawRowsFromApi : slots;
    return filterRowsWithAnyMetric(source, ['temperature', 'moisture', 'ec', 'ph', 'n', 'p', 'k']);
  }, [rawRowsFromApi, slots]);
  const hasRawData = tableRows.length > 0;

  const handleDownloadCSV = async () => {
    if (!device) return;
    try {
      setDownloading(true);
      const blob = await farmerService.downloadFarmerSensorCSV(farmerId, device);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sensor_data_${device}_all_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-4 d-flex flex-column gap-4">
      <div
        className={`card shadow-sm sensor-snapshot-sticky sensor-snapshot ${
          isSnapshotExpanded ? 'sensor-snapshot--open' : 'sensor-snapshot--collapsed'
        }`}
      >
        <div className="card-header bg-info text-white">
          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <h4 className="mb-0 d-flex align-items-center flex-wrap gap-2">
              <i className="bi bi-activity me-1"></i>
              {t('sensor_snapshot')}
              <span className="badge bg-light text-dark ms-1" style={{ fontSize: '0.75rem' }}>
                {rangeLabel}
              </span>
              {device ? (
                <span className="badge bg-dark bg-opacity-25 text-white" style={{ fontSize: '0.75rem' }}>
                  {device}
                </span>
              ) : null}
            </h4>

            <button
              type="button"
              className="btn btn-light btn-sm sensor-snapshot-toggle"
              onClick={() => setSnapshotExpanded((v) => !v)}
              aria-expanded={isSnapshotExpanded}
              aria-label={isSnapshotExpanded ? t('hide_filters') : t('show_filters')}
              disabled={forceSnapshotExpanded}
            >
              <i className={`bi ${isSnapshotExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
              {isSnapshotExpanded ? t('hide_filters') : t('show_filters')}
            </button>
          </div>
        </div>

        <div className="card-body">
          <div className="d-flex justify-content-between align-items-end flex-wrap gap-2 mb-2 sensor-dashboard-toolbar">
            <div className="sensor-dashboard-filter">
              <TimeRangeFilter value={range} onChange={setRange} />
            </div>

            <div className="d-flex align-items-center flex-wrap gap-2 sensor-dashboard-actions">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowTable((s) => !s)}
                disabled={!showHistory || !hasRawData}
              >
                <i className="bi bi-table me-1"></i>
                {showTable ? t('hide_table') : t('show_table')}
              </button>

              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handleDownloadCSV}
                disabled={!device || downloading}
              >
                {downloading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {t('downloading')}
                  </>
                ) : (
                  <>
                    <i className="bi bi-download me-1"></i>
                    {t('download_csv')}
                  </>
                )}
              </button>
            </div>
          </div>

          {isNoResultLatest ? null : (
            <div className="small text-muted mb-3">
              <i className="bi bi-clock me-1"></i>
              {t('last_updated_colon')}{' '}
              <span className="fw-semibold">{kpiPoint ? formatLastUpdated(kpiPoint, lang) : '-'}</span>
            </div>
          )}

          {isNoResultLatest ? (
            <div className="alert alert-info mb-0" role="status">
              {t('no_result')}
            </div>
          ) : null}

          {error ? (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="text-muted small">{t('loading')}</div>
          ) : null}

          {isNoResultLatest ? null : (
            <div className="border rounded-3 bg-light px-3 py-2 mb-0" role="note">
              <div className="d-flex flex-column flex-md-row gap-2 gap-md-4 align-items-start align-items-md-center small">
                <div className="d-flex align-items-start gap-2">
                  <span className="badge rounded-pill bg-danger-subtle text-danger-emphasis border border-danger-subtle mt-1">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                  </span>
                  <div>
                    <div className="text-muted">
                      {t('red_values_note')}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-start gap-2">
                  <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle mt-1">
                    <i className="bi bi-grid-3x3-gap-fill"></i>
                  </span>
                  <div>
                    <div className="text-muted">
                      {t('kpi_cards_note')}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-start gap-2">
                  <span className="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle mt-1">
                    <i className="bi bi-bar-chart-fill"></i>
                  </span>
                  <div>
                    <div className="text-muted">
                      {t('charts_note')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isNoResultLatest ? null : (
        <>
          {/* KPI Section */}
          <div className="card shadow-sm">
            <div className="card-header bg-light d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge text-bg-secondary" style={{ fontSize: '0.7rem' }}>
                  {t('kpi')}
                </span>
                <div className="fw-semibold">{t('key_metrics')}</div>
              </div>
              <span className="badge bg-secondary">{kpiSubtitle}</span>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12 col-sm-6 col-lg-3">
                  <KpiCard
                    title={t('temperature')}
                    metric="temperature"
                    value={kpiPoint?.temperature}
                    subtitle={showHistory ? null : kpiSubtitle}
                  />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                  <KpiCard title={t('moisture')} metric="moisture" value={kpiPoint?.moisture} subtitle={showHistory ? null : kpiSubtitle} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                  <KpiCard title={t('ec')} metric="ec" value={kpiPoint?.ec} subtitle={showHistory ? null : kpiSubtitle} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                  <KpiCard title={t('ph')} metric="ph" value={kpiPoint?.ph} subtitle={showHistory ? null : kpiSubtitle} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                  <KpiCard title={`${t('nitrogen')} (N)`} metric="n" value={kpiPoint?.n} subtitle={showHistory ? null : kpiSubtitle} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                  <KpiCard title={`${t('phosphorus')} (P)`} metric="p" value={kpiPoint?.p} subtitle={showHistory ? null : kpiSubtitle} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                  <KpiCard title={`${t('potassium')} (K)`} metric="k" value={kpiPoint?.k} subtitle={showHistory ? null : kpiSubtitle} />
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          {showSummary ? (
            <div className="card shadow-sm">
              <div className="card-header bg-light d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="fw-semibold">{t('summary')}</div>
                <span className="badge bg-secondary">{historyLabel}</span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {summaryItems.map((i) => (
                    <div key={i.key} className="col-12 col-md-6 col-xl-4">
                      <SummaryTile label={i.label} icon={i.icon} stats={stats?.[i.key]} unit={i.unit} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Charts */}
          {showCharts ? (
            <div className="row g-4">
              {showEnvChart ? (
                <div className="col-12 col-lg-6">
                  <ChartJsSlotBarChart
                    title={`${t('temperature')} / ${t('moisture')} / ${t('ec')} / ${t('ph')}`}
                    description={
                      range === 'latest'
                        ? t('chart_latest_snapshot')
                        : t('history_grouped_every', { range: historyLabel, group: groupingLabel || t('fixed_interval') })
                    }
                    data={slots}
                    metrics={['temperature', 'moisture', 'ec', 'ph']}
                  />
                </div>
              ) : null}
              {showNutrientChart ? (
                <div className="col-12 col-lg-6">
                  <ChartJsSlotBarChart
                    title={`${t('soil_nutrient_level')} (N / P / K)`}
                    description={
                      range === 'latest'
                        ? t('chart_latest_snapshot')
                        : t('history_grouped_every', { range: historyLabel, group: groupingLabel || t('fixed_interval') })
                    }
                    data={slots}
                    metrics={['n', 'p', 'k']}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Raw table */}
          {showTable && hasRawData ? <SensorRawTable data={tableRows} /> : null}
        </>
      )}
    </div>
  );
}

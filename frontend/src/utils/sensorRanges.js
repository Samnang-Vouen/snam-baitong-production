export const SENSOR_RANGES = {
  air_temp: { min: 15, max: 35, unit: '°C' },
  soil_temp: { min: 10, max: 35, unit: '°C' },
  air_humidity: { min: 20, max: 90, unit: '%' },
  moisture: { min: 20, max: 90, unit: '%' },
  ec: { min: 0.2, max: 3.0, unit: 'dS/m' },
  ph: { min: 5.5, max: 7.5, unit: '' },
  // Nutrients (commonly mg/kg; adjust as needed)
  nitrogen: { min: 0, max: 200, unit: 'mg/kg' },
  phosphorus: { min: 0, max: 200, unit: 'mg/kg' },
  potassium: { min: 0, max: 300, unit: 'mg/kg' },
  salinity: { min: 0, max: 40, unit: 'ppt' },
};

export function isOutOfRange(metric, value) {
  if (value === null || value === undefined) return false;
  const range = SENSOR_RANGES[metric];
  if (!range) return false;
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  if (range.min !== undefined && num < range.min) return true;
  if (range.max !== undefined && num > range.max) return true;
  return false;
}

export function formatValue(metric, value) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);

  const decimals =
    metric === 'air_temp' ||
    metric === 'soil_temp' ||
    metric === 'air_humidity' ||
    metric === 'moisture' ||
    metric === 'ec' ||
    metric === 'ph' ||
    metric === 'nitrogen' ||
    metric === 'phosphorus' ||
    metric === 'potassium' ||
    metric === 'salinity'
      ? 2
      : 0;
  const range = SENSOR_RANGES[metric];
  const unit = range?.unit || '';

  return `${num.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}

// Return a status category and label key suitable for UI badges.
// Guidelines:
// - Salinity: High/Excess, Normal/Appropriate, Low/Deficient
// - Other variables: Appropriate (in range), Needs Attention (slightly out-of-range), Critical (far out-of-range)
// - Pending when value is missing or invalid
export function getMetricStatus(metric, value) {
  const range = SENSOR_RANGES[metric];
  const num = Number(value);

  if (!range || value === null || value === undefined || !Number.isFinite(num)) {
    return { labelKey: 'status_pending', variant: 'secondary', outOfRange: false };
  }

  const below = range.min !== undefined && num < range.min;
  const above = range.max !== undefined && num > range.max;

  // Special handling for salinity
  if (metric === 'salinity') {
    if (below) return { labelKey: 'salinity_low_deficient', variant: 'warning', outOfRange: true };
    if (above) return { labelKey: 'salinity_high_excess', variant: 'danger', outOfRange: true };
    return { labelKey: 'appropriate', variant: 'success', outOfRange: false };
  }

  if (!below && !above) {
    return { labelKey: 'appropriate', variant: 'success', outOfRange: false };
  }

  // Heuristic to separate warning vs critical by deviation ratio
  let deviation = 0;
  if (below && range.min !== undefined) {
    deviation = (range.min - num) / (Math.abs(range.min) || 1);
  } else if (above && range.max !== undefined) {
    deviation = (num - range.max) / (Math.abs(range.max) || 1);
  }

  if (deviation >= 0.2) {
    return { labelKey: 'status_critical', variant: 'danger', outOfRange: true };
  }
  return { labelKey: 'status_needs_attention', variant: 'warning', outOfRange: true };
}

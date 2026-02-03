export const SENSOR_RANGES = {
  temperature: { min: 15, max: 35, unit: '°C' },
  moisture: { min: 20, max: 90, unit: '%' },
  ec: { min: 0.2, max: 3.0, unit: 'µS/cm' },
  ph: { min: 5.5, max: 7.5, unit: '' },
  // Nutrients (commonly ppm or mg/kg; adjust to match your sensor calibration)
  n: { min: 0, max: 200, unit: 'mg/kg' },
  p: { min: 0, max: 200, unit: 'mg/kg' },
  k: { min: 0, max: 300, unit: 'mg/kg' },
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
    metric === 'temperature' ||
    metric === 'moisture' ||
    metric === 'ec' ||
    metric === 'ph' ||
    metric === 'n' ||
    metric === 'p' ||
    metric === 'k'
      ? 2
      : 0;
  const range = SENSOR_RANGES[metric];
  const unit = range?.unit || '';

  return `${num.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}

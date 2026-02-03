import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Label,
} from 'recharts';

import { SENSOR_RANGES, formatValue, isOutOfRange } from '../../utils/sensorRanges';
import { useLanguage } from '../LanguageToggle';
import { formatDateTime, formatTime } from '../../utils/date';

function tooltipFormatter(metric) {
  return (value) => {
    const bad = isOutOfRange(metric, value);
    const base = formatValue(metric, value);
    return bad ? `${base} (out of range)` : base;
  };
}

export default function SensorLineChart({
  title,
  metric,
  data,
  color = '#16a34a',
  xLabel = 'Time',
  yLabel = null,
  description = null,
}) {
  const { t, lang } = useLanguage();
  const hasData = Array.isArray(data) && data.length > 0;
  const range = SENSOR_RANGES[metric];
  const resolvedYLabel = yLabel || (range?.unit ? `${title} (${range.unit})` : title);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 text-sm font-semibold text-slate-700">{title}</div>
      {description ? <div className="mb-3 text-xs text-slate-600">{description}</div> : null}

      {hasData ? (
        <div className="mb-3 text-xs text-slate-500">
          Normal: {range.min}–{range.max}{range.unit ? ` ${range.unit}` : ''}
        </div>
      ) : (
        <div className="mb-3 text-xs text-slate-500">&nbsp;</div>
      )}

      {hasData ? (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={(v) => {
                  return formatTime(v, lang);
                }}
                minTickGap={28}
              >
                <Label
                  value={xLabel}
                  position="insideBottom"
                  offset={-6}
                  style={{ fill: '#475569', fontSize: 12 }}
                />
              </XAxis>
              <YAxis tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(0) : v)}>
                <Label
                  value={resolvedYLabel}
                  angle={-90}
                  position="insideLeft"
                  style={{ fill: '#475569', fontSize: 12 }}
                />
              </YAxis>
              <Tooltip
                labelFormatter={(label) => (label ? formatDateTime(label, lang) : '')}
                formatter={tooltipFormatter(metric)}
              />
              {range?.min !== undefined ? (
                <ReferenceLine y={range.min} stroke="#94a3b8" strokeDasharray="4 4" />
              ) : null}
              {range?.max !== undefined ? (
                <ReferenceLine y={range.max} stroke="#94a3b8" strokeDasharray="4 4" />
              ) : null}
              <Line
                type="monotone"
                dataKey={metric}
                stroke={color}
                strokeWidth={2}
                dot={(props) => {
                  const v = props?.payload?.[metric];
                  const bad = isOutOfRange(metric, v);
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={2.5}
                      fill={bad ? '#dc2626' : color}
                      stroke="none"
                    />
                  );
                }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{t('no_data_in_selected_range')}</div>
      )}
    </div>
  );
}

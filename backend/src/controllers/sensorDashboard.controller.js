const db = require('../services/mysql');
const sqlService = require('../services/sql');
const sensorsService = require('../services/sensors.service');
const { formatTimestampLocal } = require('../utils/format');
const { ROLES } = require('../services/user.service');

const MEASUREMENT = process.env.INFLUXDB_MEASUREMENT || 'sensor_data';

function safeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function parseRangeQuery(req) {
  const range = String(req.query.range || req.query.timeFilter || '24h');

  if (range === 'all') return { kind: 'relative', label: 'latest', hours: null };
  if (range === 'latest') return { kind: 'latest', label: 'latest' };

  const map = {
    '24h': { kind: 'relative', label: '24h', hours: 24 },
    '7d': { kind: 'relative', label: '7d', hours: 24 * 7 },
    '30d': { kind: 'relative', label: '30d', hours: 24 * 30 },
    '2d': { kind: 'relative', label: '2d', hours: 48 },
  };

  if (map[range]) return map[range];

  if (range === 'custom') {
    const start = req.query.start;
    const end = req.query.end;

    if (!start || !end) {
      const err = new Error('Custom range requires start and end (ISO timestamps)');
      err.code = 'BAD_RANGE';
      throw err;
    }

    const startDate = new Date(String(start));
    const endDate = new Date(String(end));

    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
      const err = new Error('Invalid start or end timestamp');
      err.code = 'BAD_RANGE';
      throw err;
    }

    if (endDate <= startDate) {
      const err = new Error('end must be after start');
      err.code = 'BAD_RANGE';
      throw err;
    }

    // Hard cap custom range to 90 days to protect the DB
    const maxMs = 1000 * 60 * 60 * 24 * 90;
    if (endDate - startDate > maxMs) {
      const err = new Error('Custom range too large (max 90 days)');
      err.code = 'BAD_RANGE';
      throw err;
    }

    return { kind: 'custom', label: 'custom', start: startDate.toISOString(), end: endDate.toISOString() };
  }

  const err = new Error(`Unsupported range: ${range}`);
  err.code = 'BAD_RANGE';
  throw err;
}

function parseSlotFilter(req) {
  const slotRaw = String(req.query.slotRange || req.query.slot || req.query.range || '24h');
  // Sometimes URLs copied from browser devtools include a trailing ":1" (resource line number).
  // Be tolerant and strip ":<digits>" suffix.
  const slot = slotRaw.replace(/:\d+\s*$/, '').trim();
  // Back-compat: older UI used "now"; treat it as "latest".
  const normalized = slot === 'now' ? 'latest' : slot;

  const allowed = new Set(['latest', '5m', '15m', '1h', '24h', '2d', '7d', '30d', 'custom']);
  if (!allowed.has(normalized)) {
    const err = new Error(`Unsupported slot range: ${slotRaw}`);
    err.code = 'BAD_RANGE';
    throw err;
  }
  return normalized;
}

function getGroupingSpecForSlotRange(slotRange) {
  // Global rule:
  // - slotRange defines ONLY total range
  // - grouping uses a FIXED GAP depending on slotRange
  // - each gap is one aggregated group
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (slotRange === 'latest') return { kind: 'latest' };

  if (slotRange === '5m') return { kind: 'bucket', totalMs: 5 * min, gapMs: 5 * min };
  if (slotRange === '15m') return { kind: 'bucket', totalMs: 15 * min, gapMs: 5 * min };
  if (slotRange === '1h') return { kind: 'bucket', totalMs: 1 * hour, gapMs: 5 * min };
  if (slotRange === '24h') return { kind: 'bucket', totalMs: 24 * hour, gapMs: 1 * hour };
  if (slotRange === '2d') return { kind: 'bucket', totalMs: 2 * day, gapMs: 4 * hour };
  if (slotRange === '7d') return { kind: 'bucket', totalMs: 7 * day, gapMs: 1 * day };
  if (slotRange === '30d') return { kind: 'bucket', totalMs: 30 * day, gapMs: 7 * day };

  // custom is handled separately
  return null;
}

function labelForOffsetMinutes(mins) {
  if (mins === null || mins === 0) return 'Latest';
  if (mins < 0) return 'Latest';

  const weekMins = 7 * 24 * 60;
  const dayMins = 24 * 60;

  if (mins % weekMins === 0) return `${mins / weekMins}w ago`;
  if (mins % dayMins === 0) return `${mins / dayMins}d ago`;
  if (mins % 60 === 0) return `${mins / 60}h ago`;
  return `${mins}m ago`;
}

function buildFixedGapWindows({ startMs, endMs, gapMs }) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(gapMs) || gapMs <= 0) return [];
  if (endMs <= startMs) return [];

  const windows = [];
  let windowEnd = endMs;
  while (windowEnd > startMs) {
    const windowStart = Math.max(startMs, windowEnd - gapMs);
    windows.push({ startMs: windowStart, endMs: windowEnd });
    windowEnd = windowStart;
  }
  windows.reverse();
  return windows;
}

function pickWindowSizeMs(totalMs) {
  const min = 60 * 1000;
  if (totalMs <= 60 * min) return 5 * min;
  if (totalMs <= 24 * 60 * min) return 30 * min;
  if (totalMs <= 7 * 24 * 60 * min) return 60 * min;
  return 24 * 60 * min;
}

// (Window bucketing removed in favor of time-group comparisons)

async function getNearestPointAtOrBefore(deviceEsc, timeIso) {
  const sql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${deviceEsc}' AND time <= '${escapeSqlString(timeIso)}' ORDER BY time DESC LIMIT 1`;
  const rows = await sqlService.query(sql);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getPointsInWindow(deviceEsc, startIso, endIso, maxRows) {
  const safeLimit = Number.isFinite(Number(maxRows)) ? Math.max(1, Math.min(50000, Number(maxRows))) : 15000;

  const normalizePhKeys = (row) => {
    if (!row || typeof row !== 'object') return row;
    // InfluxDB 3 SQL client may normalize aliases/casing. Normalize so both `pH` and `ph` exist.
    const v = row.pH ?? row.ph ?? row.PH ?? row.Ph;
    if (v !== undefined) {
      if (row.pH === undefined) row.pH = v;
      if (row.ph === undefined) row.ph = v;
    }
    return row;
  };

  // Select only fields we use (faster + avoids schema errors for non-existent columns).
  // Note: some deployments store pH as "pH" (case-sensitive), others as ph.
  // We try "pH" first and fall back to ph, always aliasing to pH.
  const baseSql = ({ phExpr }) => `SELECT
      time,
      temperature,
      moisture,
      ec,
      ${phExpr} as pH,
      nitrogen,
      phosphorus,
      potassium,
      salinity
    FROM "${MEASUREMENT}"
    WHERE device = '${deviceEsc}'
      AND time >= '${escapeSqlString(startIso)}'
      AND time <= '${escapeSqlString(endIso)}'
    ORDER BY time DESC
    LIMIT ${safeLimit}`;

  const hasAnyPh = (rows) =>
    Array.isArray(rows) &&
    rows.some((r) => {
      const v = r?.pH ?? r?.ph ?? r?.PH ?? r?.Ph;
      if (v === null || v === undefined || v === '') return false;
      const n = Number(v);
      return Number.isFinite(n);
    });

  try {
    const rows = await sqlService.query(baseSql({ phExpr: '"pH"' }));
    const safeRows = (Array.isArray(rows) ? rows : []).map(normalizePhKeys);

    // Some Influx deployments may not error on missing columns and just return NULL.
    // If we have rows but no pH values, try again using `ph`.
    if (safeRows.length > 0 && !hasAnyPh(safeRows)) {
      try {
        const rows2 = await sqlService.query(baseSql({ phExpr: 'ph' }));
        const safeRows2 = (Array.isArray(rows2) ? rows2 : []).map(normalizePhKeys);
        if (safeRows2.length > 0 && hasAnyPh(safeRows2)) return safeRows2;
      } catch {
        // ignore and fall back to the original result
      }
    }

    return safeRows;
  } catch (e) {
    const msg = String(e?.message || '');
    // If the column doesn't exist, retry using ph.
    if (/\bpH\b/i.test(msg) && /(unknown\s+column|column\s+not\s+found|invalid\s+identifier|not\s+found)/i.test(msg)) {
      const rows = await sqlService.query(baseSql({ phExpr: 'ph' }));
      return (Array.isArray(rows) ? rows : []).map(normalizePhKeys);
    }
    throw e;
  }
}

async function getAverageInWindow(deviceEsc, startIso, endIso) {
  const baseSql = ({ phExpr }) => `SELECT
      AVG(temperature) as temperature,
      AVG(moisture) as moisture,
      AVG(ec) as ec,
      AVG(${phExpr}) as pH,
      AVG(nitrogen) as nitrogen,
      AVG(phosphorus) as phosphorus,
      AVG(potassium) as potassium,
      AVG(salinity) as salinity
    FROM "${MEASUREMENT}"
    WHERE device = '${deviceEsc}'
      AND time >= '${escapeSqlString(startIso)}'
      AND time <= '${escapeSqlString(endIso)}'`;

  const normalizePhKeys = (row) => {
    if (!row || typeof row !== 'object') return row;
    const v = row.pH ?? row.ph ?? row.PH ?? row.Ph;
    if (v !== undefined) {
      if (row.pH === undefined) row.pH = v;
      if (row.ph === undefined) row.ph = v;
    }
    return row;
  };

  try {
    const rows = await sqlService.query(baseSql({ phExpr: '"pH"' }));
    const first = Array.isArray(rows) && rows.length ? normalizePhKeys(rows[0]) : null;
    const v = first?.pH ?? first?.ph;
    const n = v === null || v === undefined || v === '' ? Number.NaN : Number(v);

    // If AVG("pH") produced no value but other fields exist, try AVG(ph).
    if (!Number.isFinite(n) && first) {
      try {
        const rows2 = await sqlService.query(baseSql({ phExpr: 'ph' }));
        return Array.isArray(rows2) && rows2.length ? normalizePhKeys(rows2[0]) : first;
      } catch {
        return first;
      }
    }

    return first;
  } catch (e) {
    const msg = String(e?.message || '');
    if (/\bpH\b/i.test(msg) && /(unknown\s+column|column\s+not\s+found|invalid\s+identifier|not\s+found)/i.test(msg)) {
      const rows = await sqlService.query(baseSql({ phExpr: 'ph' }));
      return Array.isArray(rows) && rows.length ? normalizePhKeys(rows[0]) : null;
    }
    throw e;
  }
}

function mapRowToPoint({ row, device, time }) {
  if (!row || !time) return null;
  return {
    time,
    timestampLocal: formatTimestampLocal(time, { includeTZName: true }),
    device,
    farm: row?.farm ?? null,
    temperature: safeValue(row?.temperature),
    // UI uses moisture; keep humidity as backward-compatible alias.
    moisture: safeValue(row?.moisture ?? row?.humidity),
    humidity: safeValue(row?.humidity ?? row?.moisture),
    ec: safeValue(row?.ec),
    ph: safeValue(row?.pH ?? row?.ph),
    n: safeValue(row?.nitrogen ?? row?.n),
    p: safeValue(row?.phosphorus ?? row?.p),
    k: safeValue(row?.potassium ?? row?.k),
  };
}

function mapAggRowToPoint({ aggRow, device, time, fallbackFarm }) {
  if (!aggRow || !time) return null;
  return {
    time,
    timestampLocal: formatTimestampLocal(time, { includeTZName: true }),
    device,
    farm: fallbackFarm ?? null,
    temperature: safeValue(aggRow?.temperature),
    moisture: safeValue(aggRow?.moisture ?? aggRow?.humidity),
    humidity: safeValue(aggRow?.humidity ?? aggRow?.moisture),
    ec: safeValue(aggRow?.ec),
    ph: safeValue(aggRow?.pH ?? aggRow?.ph),
    n: safeValue(aggRow?.nitrogen ?? aggRow?.n),
    p: safeValue(aggRow?.phosphorus ?? aggRow?.p),
    k: safeValue(aggRow?.potassium ?? aggRow?.k),
  };
}

function getMaxRowsAndPoints(rangeInfo) {
  // These are safety limits, independent from frontend.
  if (rangeInfo.kind === 'latest') return { maxRows: 200, maxPoints: 100 };
  if (rangeInfo.kind === 'relative') {
    if (rangeInfo.label === '24h') return { maxRows: 2000, maxPoints: 400 };
    if (rangeInfo.label === '2d') return { maxRows: 2500, maxPoints: 450 };
    if (rangeInfo.label === '7d') return { maxRows: 6000, maxPoints: 600 };
    if (rangeInfo.label === '30d') return { maxRows: 15000, maxPoints: 800 };
  }
  if (rangeInfo.kind === 'custom') return { maxRows: 15000, maxPoints: 800 };
  return { maxRows: 2000, maxPoints: 400 };
}

function downsampleEvenly(points, maxPoints) {
  if (!Array.isArray(points)) return [];
  if (points.length <= maxPoints) return points;

  const step = Math.ceil(points.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  // Ensure last point is included
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }
  return sampled;
}

function getSlotMaxRows(slotRange) {
  // Keep this conservative; slots should be fast and bounded.
  if (slotRange === '5m' || slotRange === '15m' || slotRange === '1h') return 2000;
  if (slotRange === '24h') return 2000;
  if (slotRange === '2d') return 2500;
  if (slotRange === '7d') return 6000;
  if (slotRange === '30d') return 15000;
  return 2000;
}

function getRawMaxRowsForSlotRange(slotRange) {
  // Raw table rows should be bounded for UI performance.
  // This is independent from bucketing accuracy.
  if (slotRange === 'latest') return 1;
  if (slotRange === '5m' || slotRange === '15m' || slotRange === '1h') return 2000;
  if (slotRange === '24h') return 3000;
  if (slotRange === '2d') return 5000;
  if (slotRange === '7d') return 8000;
  if (slotRange === '30d') return 12000;
  if (slotRange === 'custom') return 12000;
  return 3000;
}

function aggregateRowsIntoWindows({ rowsDesc, windows, endMs }) {
  // rowsDesc is DESC; reverse for stable iteration.
  const rows = Array.isArray(rowsDesc) ? [...rowsDesc].reverse() : [];

  const buckets = windows.map((w) => ({
    window: w,
    sums: {
      temperature: 0,
      moisture: 0,
      ec: 0,
      pH: 0,
      nitrogen: 0,
      phosphorus: 0,
      potassium: 0,
      salinity: 0,
    },
    counts: {
      temperature: 0,
      moisture: 0,
      ec: 0,
      pH: 0,
      nitrogen: 0,
      phosphorus: 0,
      potassium: 0,
      salinity: 0,
    },
  }));

  const metrics = ['temperature', 'moisture', 'ec', 'pH', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];

  const lastIdx = buckets.length - 1;

  for (const row of rows) {
    const tMs = row?.time ? new Date(row.time).getTime() : NaN;
    if (!Number.isFinite(tMs)) continue;

    // Find matching window (count is small; linear scan is fine)
    for (let i = 0; i < buckets.length; i++) {
      const w = buckets[i].window;
      const inWindow = i === lastIdx ? tMs >= w.startMs && tMs <= w.endMs : tMs >= w.startMs && tMs < w.endMs;
      if (inWindow) {
        for (const m of metrics) {
          const v = m === 'pH' ? safeValue(row?.pH ?? row?.ph) : safeValue(row?.[m]);
          if (v === null || v === undefined || !Number.isFinite(v)) continue;
          buckets[i].sums[m] += v;
          buckets[i].counts[m] += 1;
        }
        break;
      }
    }
  }

  return buckets.map((b) => {
    const avg = {};
    for (const key of Object.keys(b.sums)) {
      const c = b.counts[key];
      avg[key] = c > 0 ? b.sums[key] / c : null;
    }

    const offsetMins = Math.round((endMs - b.window.endMs) / (60 * 1000));
    return {
      label: labelForOffsetMinutes(offsetMins),
      time: new Date(b.window.endMs).toISOString(),
      avg,
    };
  });
}

async function getAllowedDevicesForFarmer(farmerId, farmerRow) {
  try {
    const sensors = await sensorsService.getFarmerSensors(farmerId);
    return sensors.map((s) => s.device_id).filter(Boolean);
  } catch (_) {
    if (farmerRow?.sensor_devices) {
      return farmerRow.sensor_devices.split(',').map((d) => d.trim()).filter(Boolean);
    }
    return [];
  }
}

function requireRoleForDashboard(req, res) {
  const role = req.user?.role;
  if (!role) return { ok: false, status: 401, error: 'Unauthorized' };
  if (![ROLES.ADMIN, ROLES.MINISTRY].includes(role)) {
    return { ok: false, status: 403, error: 'Forbidden for this role' };
  }
  return { ok: true };
}

/**
 * GET /api/farmers/:id/sensors/dashboard
 * Query: device, range=latest|24h|7d|30d|custom, start, end
 */
async function getFarmerSensorDashboard(req, res) {
  try {
    const roleCheck = requireRoleForDashboard(req, res);
    if (!roleCheck.ok) {
      return res.status(roleCheck.status).json({ success: false, error: roleCheck.error });
    }

    const { id } = req.params;
    const farmerId = Number(id);
    if (!Number.isFinite(farmerId)) {
      return res.status(400).json({ success: false, error: 'Invalid farmer id' });
    }

    const view = String(req.query.view || req.query.chart || 'series');

    const rangeInfo = parseRangeQuery(req);

    const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ?', [farmerId]);
    if (!farmerRows || farmerRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }

    const farmer = farmerRows[0];
    const allowedDevices = await getAllowedDevicesForFarmer(farmerId, farmer);
    if (allowedDevices.length === 0) {
      return res.status(400).json({ success: false, error: 'No sensor devices configured for this farmer' });
    }

    const requestedDevice = req.query.device ? String(req.query.device) : null;
    const device = requestedDevice || allowedDevices[0];

    if (!allowedDevices.includes(device)) {
      return res.status(403).json({ success: false, error: 'Device not assigned to this farmer' });
    }

    const deviceEsc = escapeSqlString(device);

    // Latest point (always latest overall; independent of slotRange/time filter)
    const latestSql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${deviceEsc}' ORDER BY time DESC LIMIT 1`;
    const latestRows = await sqlService.query(latestSql);
    const latestRow = Array.isArray(latestRows) && latestRows.length ? latestRows[0] : null;

    const latest = latestRow
      ? {
          time: latestRow?.time ? new Date(latestRow.time).toISOString() : null,
          timestampLocal: formatTimestampLocal(latestRow?.time ?? null, { includeTZName: true }),
          device,
          farm: latestRow?.farm ?? null,
          temperature: safeValue(latestRow?.temperature),
          moisture: safeValue(latestRow?.moisture ?? latestRow?.humidity),
          humidity: safeValue(latestRow?.humidity ?? latestRow?.moisture),
          ec: safeValue(latestRow?.ec),
          ph: safeValue(latestRow?.pH ?? latestRow?.ph),
          n: safeValue(latestRow?.nitrogen ?? latestRow?.n),
          p: safeValue(latestRow?.phosphorus ?? latestRow?.p),
          k: safeValue(latestRow?.potassium ?? latestRow?.k),
        }
      : null;

    // Grouped-bar time slot view
    if (view === 'bar' || view === 'slots') {
      // slotRange controls ONLY the slot/chart window
      const slotRange = parseSlotFilter(req);
      const includeRaw = String(req.query.includeRaw || req.query.raw || '').trim() === '1';
      const now = new Date();
      const slots = [];
      let raw = null;

      if (slotRange === 'custom') {
        const startIso = String(req.query.start || '');
        const endIso = String(req.query.end || '');
        if (!startIso || !endIso) {
          const err = new Error('Custom slot range requires start and end');
          err.code = 'BAD_RANGE';
          throw err;
        }
        const startDate = new Date(startIso);
        const endDate = new Date(endIso);
        if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
          const err = new Error('Invalid start or end timestamp');
          err.code = 'BAD_RANGE';
          throw err;
        }
        if (endDate <= startDate) {
          const err = new Error('end must be after start');
          err.code = 'BAD_RANGE';
          throw err;
        }

        const agg = await getAverageInWindow(deviceEsc, startDate.toISOString(), endDate.toISOString());
        const time = endDate.toISOString();
        const label = 'Custom';
        const point = mapAggRowToPoint({ aggRow: agg, device, time, fallbackFarm: latestRow?.farm ?? null });
        slots.push({ label, time, ...(point || {}), device, farm: latestRow?.farm ?? null });

        if (includeRaw) {
          const rowsDesc = await getPointsInWindow(
            deviceEsc,
            startDate.toISOString(),
            endDate.toISOString(),
            Math.min(getSlotMaxRows(slotRange), getRawMaxRowsForSlotRange(slotRange))
          );
          raw = [...rowsDesc]
            .reverse()
            .map((row) => {
              const t = row?.time ? new Date(row.time).toISOString() : null;
              return mapRowToPoint({ row, device, time: t });
            })
            .filter((p) => p && p.time);
        }
      } else {
        const spec = getGroupingSpecForSlotRange(slotRange);
        if (!spec) {
          const err = new Error(`Unsupported slot range: ${slotRange}`);
          err.code = 'BAD_RANGE';
          throw err;
        }

        if (spec.kind === 'latest') {
          // slotRange=latest: a single "Latest" slot (no time window).
          // If there is no data at all, return empty slots so the UI can show "No result".
          if (latestRow?.time) {
            const time = new Date(latestRow.time).toISOString();
            const point = mapRowToPoint({ row: latestRow, device, time });
            slots.push({ label: 'Latest', time, ...(point || {}), device, farm: latestRow?.farm ?? null });

            if (includeRaw) {
              raw = [point].filter(Boolean);
            }
          }
        } else {
          const endMs = now.getTime();
          const startMs = endMs - spec.totalMs;
          const windows = buildFixedGapWindows({ startMs, endMs, gapMs: spec.gapMs });

          // Single-query fetch, then bucket in JS for speed.
          const startIso = new Date(startMs).toISOString();
          const endIso = new Date(endMs).toISOString();
          const rowsDesc = await getPointsInWindow(deviceEsc, startIso, endIso, getSlotMaxRows(slotRange));
          const bucketed = aggregateRowsIntoWindows({ rowsDesc, windows, endMs });

          for (const b of bucketed) {
            const point = mapAggRowToPoint({ aggRow: b.avg, device, time: b.time, fallbackFarm: latestRow?.farm ?? null });
            slots.push({ label: b.label, time: b.time, ...(point || {}), device, farm: latestRow?.farm ?? null });
          }

          if (includeRaw) {
            const rawLimit = getRawMaxRowsForSlotRange(slotRange);
            raw = [...rowsDesc]
              .slice(0, rawLimit)
              .reverse()
              .map((row) => {
                const t = row?.time ? new Date(row.time).toISOString() : null;
                return mapRowToPoint({ row, device, time: t });
              })
              .filter((p) => p && p.time);
          }
        }
      }

      slots.sort((a, b) => new Date(a.time) - new Date(b.time));

      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          farmer: {
            id: farmer.id,
            name: `${farmer.first_name} ${farmer.last_name}`,
            location: `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`,
          },
          device,
          allowedDevices,
          view: 'groups',
          slotRange,
          latest,
          slots,
          raw: includeRaw ? raw || [] : null,
          window: slotRange === 'custom' ? { start: req.query.start, end: req.query.end } : null,
          units: {
            temperature: '°C',
            moisture: '%',
            ec: 'µS/cm',
            ph: '',
            n: 'mg/kg',
            p: 'mg/kg',
            k: 'mg/kg',
          },
        },
      });
    }

    // Time-series
    const { maxRows, maxPoints } = getMaxRowsAndPoints(rangeInfo);

    let whereTime = '';
    if (rangeInfo.kind === 'relative' && rangeInfo.hours) {
      whereTime = ` AND time >= now() - INTERVAL '${rangeInfo.hours} hours'`;
    } else if (rangeInfo.kind === 'custom') {
      // InfluxDB 3 SQL accepts ISO timestamps as string literals for time comparisons.
      whereTime = ` AND time >= '${escapeSqlString(rangeInfo.start)}' AND time <= '${escapeSqlString(rangeInfo.end)}'`;
    }

    // Pull rows in DESC order for fast LIMIT, then reverse.
    const seriesSql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${deviceEsc}'${whereTime} ORDER BY time DESC LIMIT ${maxRows}`;
    const seriesRowsDesc = await sqlService.query(seriesSql);
    const seriesRows = Array.isArray(seriesRowsDesc) ? [...seriesRowsDesc].reverse() : [];

    const points = seriesRows.map((row) => {
      const timeIso = row?.time ? new Date(row.time).toISOString() : null;
      return {
        time: timeIso,
        timestampLocal: formatTimestampLocal(row?.time ?? null, { includeTZName: true }),
        device,
        farm: row?.farm ?? null,
        temperature: safeValue(row?.temperature),
        moisture: safeValue(row?.moisture ?? row?.humidity),
        humidity: safeValue(row?.humidity ?? row?.moisture),
        ec: safeValue(row?.ec),
        ph: safeValue(row?.pH ?? row?.ph),
        n: safeValue(row?.nitrogen ?? row?.n),
        p: safeValue(row?.phosphorus ?? row?.p),
        k: safeValue(row?.potassium ?? row?.k),
      };
    }).filter((p) => p.time);

    const sampledPoints = downsampleEvenly(points, maxPoints);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        farmer: {
          id: farmer.id,
          name: `${farmer.first_name} ${farmer.last_name}`,
          location: `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`,
        },
        device,
        allowedDevices,
        view: 'series',
        range: rangeInfo.label,
        latest,
        series: sampledPoints,
        // Optional raw table reference: keep it aligned with series (already sampled)
        raw: sampledPoints,
        units: {
          temperature: '°C',
          moisture: '%',
          ec: 'µS/cm',
          ph: '',
          n: 'mg/kg',
          p: 'mg/kg',
          k: 'mg/kg',
        },
      },
    });
  } catch (error) {
    const status = error.code === 'BAD_RANGE' ? 400 : 500;
    console.error('[getFarmerSensorDashboard] Error:', error);
    res.status(status).json({ success: false, error: 'Failed to fetch sensor dashboard data', message: error.message });
  }
}

module.exports = { getFarmerSensorDashboard };

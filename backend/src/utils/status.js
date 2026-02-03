function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computePlantStatus(snapshot) {
  const t = toNumber(snapshot?.temperature?.value);
  const moisture = toNumber(snapshot?.moisture?.value);
  const ec = toNumber(snapshot?.ec?.value);
  const ph = toNumber(snapshot?.ph?.value ?? snapshot?.pH?.value);
  const salinity = toNumber(snapshot?.salinity?.value);

  let score = 0;
  if (t != null) {
    if (t >= 18 && t <= 32) score += 2; else if (t >= 12 && t <= 38) score += 1; else score -= 1;
  }
  if (moisture != null) {
    if (moisture >= 30 && moisture <= 70) score += 2; else if (moisture >= 20 && moisture <= 80) score += 1; else score -= 1;
  }
  if (ec != null) {
    if (ec >= 0.8 && ec <= 2.5) score += 2; else if (ec >= 0.4 && ec <= 3.0) score += 1; else score -= 1;
  }
  if (ph != null) {
    if (ph >= 5.5 && ph <= 7.5) score += 2; else if (ph >= 5.0 && ph <= 8.0) score += 1; else score -= 1;
  }
  if (salinity != null) {
    if (salinity <= 800) score += 2; else if (salinity <= 1200) score += 1; else score -= 1;
  }

  if (score >= 6) return 'Good';
  if (score >= 2) return 'Normal';
  return 'Bad';
}

module.exports = { computePlantStatus };

#!/usr/bin/env node
/**
 * Script de diagnóstico para series temporales (timeseries).
 * Uso: node scripts/dataDiagnostics.js [ruta-a-observations.json]
 *      Si no se pasa ruta, lee JSON desde stdin.
 * El JSON debe ser un array de observaciones con al menos { timestamp, temperature?, humidity?, windSpeed?, precipitation? }.
 */

function readInput(path) {
  const fs = require('fs');
  if (path) {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }
  const chunks = [];
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(JSON.parse(chunks.join(''))));
    process.stdin.on('error', reject);
  });
}

function parseTs(ts) {
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? null : t;
}

function diagnostics(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return { error: 'Se esperaba un array no vacío de observaciones.' };
  }

  const sorted = [...observations].sort((a, b) => {
    const ta = parseTs(a.timestamp);
    const tb = parseTs(b.timestamp);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });

  const timestamps = sorted.map((o) => parseTs(o.timestamp)).filter((t) => t != null);
  const steps = [];
  for (let i = 1; i < timestamps.length; i++) {
    steps.push(timestamps[i] - timestamps[i - 1]);
  }

  const stepMs = steps.length > 0 ? steps.reduce((a, b) => a + b, 0) / steps.length : 0;
  const stepHours = stepMs / (3600 * 1000);
  const stepDays = stepMs / (24 * 3600 * 1000);

  const uniqueTs = new Set(observations.map((o) => o.timestamp));
  const duplicates = observations.length - uniqueTs.size;

  const gaps = steps.filter((s) => Math.abs(s - stepMs) > stepMs * 0.5).length;

  const getValues = (key) =>
    sorted.map((o) => o[key]).filter((v) => v != null && !Number.isNaN(v));
  const minMax = (key) => {
    const vals = getValues(key);
    if (vals.length === 0) return { min: null, max: null };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  const firstTs = sorted[0]?.timestamp;
  const midTs = sorted[Math.floor(sorted.length / 2)]?.timestamp;
  const lastTs = sorted[sorted.length - 1]?.timestamp;

  return {
    nPoints: observations.length,
    firstTimestamp: firstTs,
    midTimestamp: midTs,
    lastTimestamp: lastTs,
    stepDetectedMs: Math.round(stepMs),
    stepDetectedHours: Math.round(stepHours * 100) / 100,
    stepDetectedDays: Math.round(stepDays * 100) / 100,
    duplicates,
    gapsIrregular: gaps,
    temperature: minMax('temperature'),
    humidity: minMax('humidity'),
    windSpeed: minMax('windSpeed'),
    precipitation: minMax('precipitation'),
  };
}

async function main() {
  const path = process.argv[2];
  const data = path ? JSON.parse(require('fs').readFileSync(path, 'utf8')) : await readInput();
  const obs = Array.isArray(data) ? data : data?.data ?? data?.observations ?? data;
  if (!Array.isArray(obs)) {
    console.error('El JSON debe ser un array de observaciones o un objeto con .data o .observations');
    process.exit(1);
  }
  const result = diagnostics(obs);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

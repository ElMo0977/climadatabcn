/**
 * Wind vector mean: meteorological convention (direction = FROM which the wind blows).
 * 0° = N, 90° = E, 180° = S, 270° = W.
 * u = -speed * sin(deg * π/180), v = -speed * cos(deg * π/180).
 */

const RAD = Math.PI / 180;

export function speedDirToUV(speedMs: number, dirDeg: number): { u: number; v: number } {
  const rad = dirDeg * RAD;
  return {
    u: -speedMs * Math.sin(rad),
    v: -speedMs * Math.cos(rad),
  };
}

export function uvToSpeedDir(u: number, v: number): { speed: number; dir: number } {
  const speed = Math.sqrt(u * u + v * v);
  // atan2(-u, -v) gives direction FROM; normalize 0..360
  let dir = (Math.atan2(-u, -v) / RAD + 360) % 360;
  if (dir === 360) dir = 0;
  return { speed, dir };
}

/**
 * Vectorial mean of (speed, direction) pairs. Ignores null/NaN.
 */
export function vectorialMeanWind(
  pairs: { speed: number; dir: number }[]
): { speed: number; dir: number } | null {
  if (pairs.length === 0) return null;
  let u = 0;
  let v = 0;
  let n = 0;
  for (const { speed, dir } of pairs) {
    if (typeof speed !== 'number' || Number.isNaN(speed)) continue;
    const d = typeof dir === 'number' && !Number.isNaN(dir) ? dir : 0;
    const { u: ui, v: vi } = speedDirToUV(speed, d);
    u += ui;
    v += vi;
    n += 1;
  }
  if (n === 0) return null;
  return uvToSpeedDir(u / n, v / n);
}

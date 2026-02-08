import { describe, it, expect } from 'vitest';
import { speedDirToUV, uvToSpeedDir, vectorialMeanWind } from './windVector';

describe('windVector', () => {
  it('converts speed/dir to u,v and back', () => {
    const { u, v } = speedDirToUV(10, 0); // from N
    expect(u).toBeCloseTo(0, 5);
    expect(v).toBeCloseTo(-10, 5);
    const back = uvToSpeedDir(u, v);
    expect(back.speed).toBeCloseTo(10, 5);
    expect(back.dir).toBeCloseTo(0, 0);
  });

  it('vectorial mean: two opposite directions gives low speed', () => {
    const pairs = [
      { speed: 5, dir: 0 },
      { speed: 5, dir: 180 },
    ];
    const result = vectorialMeanWind(pairs);
    expect(result).not.toBeNull();
    expect(result!.speed).toBeLessThan(1);
  });

  it('vectorial mean: same direction gives same speed', () => {
    const pairs = [
      { speed: 3, dir: 90 },
      { speed: 5, dir: 90 },
    ];
    const result = vectorialMeanWind(pairs);
    expect(result).not.toBeNull();
    expect(result!.speed).toBeCloseTo(4, 5);
    expect(result!.dir).toBeCloseTo(90, 0);
  });

  it('returns null for empty array', () => {
    expect(vectorialMeanWind([])).toBeNull();
  });
});

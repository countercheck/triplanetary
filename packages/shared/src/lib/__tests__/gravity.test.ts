import { describe, it, expect } from 'vitest';
import { computeGravity, hexRing } from '../gravity';
import type { BodyEntry } from '../../types/map';

describe('hexRing', () => {
  it('returns 6 hexes at radius 1 from origin', () => {
    const ring = hexRing(0, 0, 1);
    expect(ring).toHaveLength(6);
    // All must be at axial distance 1 from center
    for (const [q, r] of ring) {
      const dist = (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2;
      expect(dist).toBe(1);
    }
  });

  it('returns 12 hexes at radius 2 from origin', () => {
    expect(hexRing(0, 0, 2)).toHaveLength(12);
  });

  it('works from a non-origin center', () => {
    const ring = hexRing(3, -2, 1);
    expect(ring).toHaveLength(6);
  });
});

describe('computeGravity', () => {
  const terra: BodyEntry = { center: '0,4', radius: 1, gravityRings: 1 };

  it('generates gravity hexes around a body', () => {
    const result = computeGravity({ terra });
    // Ring at radius 1 around (0,4): 6 hexes
    expect(Object.keys(result)).toHaveLength(6);
    // All entries should be gravity type pointing at terra
    for (const hex of Object.values(result)) {
      expect(hex.type).toBe('gravity');
      expect(hex.body).toBe('terra');
      expect(hex.manual).toBe(false);
    }
  });

  it('hex north of body (0,3) pulls southward toward (0,4)', () => {
    // (0,3) is at r=3, terra center is r=4; pull = +r direction = [0,+1]
    const result = computeGravity({ terra });
    expect(result['0,3']).toMatchObject({ type: 'gravity', offset: [0, 1] });
  });

  it('preserves manual overrides across recompute', () => {
    const existingHexes = {
      '0,3': { type: 'gravity' as const, body: 'terra', offset: [-1, 0] as [number, number], manual: true },
    };
    const result = computeGravity({ terra }, existingHexes);
    // Manual override preserved
    expect(result['0,3']).toMatchObject({ offset: [-1, 0], manual: true });
    // Other ring hexes still computed
    expect(Object.keys(result).length).toBe(6);
  });

  it('does not generate gravity for a body with gravityRings=0', () => {
    const ceres: BodyEntry = { center: '9,1', gravityRings: 0, asteroidBase: true };
    const result = computeGravity({ ceres });
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('generates 18 gravity hexes for a body with gravityRings=2', () => {
    // Ring 1: 6, Ring 2: 12 → 18 total
    const sol: BodyEntry = { center: '0,0', radius: 3, gravityRings: 2 };
    const result = computeGravity({ sol });
    expect(Object.keys(result)).toHaveLength(18);
  });

  it('does not overwrite planet hexes with gravity', () => {
    // Sol at (0,0) with gravityRings=2 — but terra is at (0,1) which is in Sol's ring
    const sol: BodyEntry = { center: '0,0', radius: 3, gravityRings: 2 };
    const withPlanet = { '0,1': { type: 'planet' as const, body: 'terra' } };
    const result = computeGravity({ sol }, withPlanet);
    // The planet hex should NOT be overwritten by gravity
    expect(result['0,1']?.type).toBe('planet');
  });
});

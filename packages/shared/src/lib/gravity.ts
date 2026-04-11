import type { BodyEntry, HexEntry } from '../types/map';

// The 6 axial unit directions for pointy-top hexes.
// Index order matches the standard hex ring traversal (E, SE, SW, W, NW, NE).
const AXIAL_DIRS: readonly [number, number][] = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
] as const;

/**
 * Returns all hexes on the ring at `radius` distance from `(cq, cr)`.
 * Algorithm: start at (cq, cr-radius), walk 6 sides of `radius` steps each.
 */
export function hexRing(cq: number, cr: number, radius: number): [number, number][] {
  if (radius === 0) return [[cq, cr]];
  const results: [number, number][] = [];
  let hq = cq;
  let hr = cr - radius; // start: direction [0,-1] * radius from center
  for (let i = 0; i < 6; i++) {
    const [dq, dr] = AXIAL_DIRS[i]!;
    for (let j = 0; j < radius; j++) {
      results.push([hq, hr]);
      hq += dq;
      hr += dr;
    }
  }
  return results;
}

/**
 * Returns the axial unit direction closest to the vector (dq, dr).
 * Uses the cube-coordinate dot product to find the best match.
 */
function nearestAxialDir(dq: number, dr: number): [number, number] {
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < AXIAL_DIRS.length; i++) {
    const [aq, ar] = AXIAL_DIRS[i]!;
    // Cube dot product: accounts for all 3 cube axes (q, r, s=-q-r)
    const score = 2 * aq * dq + 2 * ar * dr + aq * dr + ar * dq;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return AXIAL_DIRS[bestIdx]!;
}

/**
 * Computes gravity hexes for all bodies. Existing manual overrides are preserved.
 * Non-manual gravity hexes are dropped and recomputed from scratch.
 *
 * @param bodies   Body definitions with center coordinates and gravityRings radius.
 * @param existing Existing hex entries (may include manual gravity overrides).
 * @returns        New hex record containing only gravity hexes (caller merges with non-gravity hexes).
 */
export function computeGravity(
  bodies: Record<string, BodyEntry>,
  existing: Record<string, HexEntry> = {},
): Record<string, HexEntry> {
  // Carry forward manual overrides only; drop non-manual gravity (will recompute)
  const result: Record<string, HexEntry> = Object.fromEntries(
    Object.entries(existing).filter(
      ([, h]) => !(h.type === 'gravity' && !h.manual),
    ),
  );

  for (const [bodyName, body] of Object.entries(bodies)) {
    const parts = body.center.split(',');
    const cq = Number(parts[0]);
    const cr = Number(parts[1]);

    for (let radius = 1; radius <= body.gravityRings; radius++) {
      for (const [hq, hr] of hexRing(cq, cr, radius)) {
        const key = `${hq},${hr}`;
        if (result[key]?.manual) continue; // preserve manual override
        // Do not overwrite planet, asteroid, or clandestine hexes with gravity
        const existingHex = result[key];
        if (existingHex && existingHex.type !== 'gravity') continue;
        const offset = nearestAxialDir(cq - hq, cr - hr);
        result[key] = { type: 'gravity', body: bodyName, offset, manual: false };
      }
    }
  }

  return result;
}

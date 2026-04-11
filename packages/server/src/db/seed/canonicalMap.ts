import path from 'node:path';
import { config } from 'dotenv';

// Must load env BEFORE importing db client (static imports are hoisted)
config({ path: path.resolve(__dirname, '../../../../../.env') });

import { eq } from 'drizzle-orm';
import { computeGravity } from '@triplanetary/shared';
import type { HexData, BodyEntry } from '@triplanetary/shared';

const BODIES: Record<string, BodyEntry> = {
  sol:   { center: '0,0',  radius: 3, gravityRings: 2 },
  terra: { center: '0,4',  radius: 1, gravityRings: 1 },
  luna:  { center: '1,5',  radius: 0, gravityRings: 1, weakGravity: true },
  venus: { center: '-4,2', radius: 1, gravityRings: 1 },
  mars:  { center: '5,-3', radius: 1, gravityRings: 1 },
  ceres: { center: '9,1',  gravityRings: 0, asteroidBase: true },
};

const PLANET_HEXES: Record<string, { body: string }> = {
  '0,0':  { body: 'sol' },
  '0,4':  { body: 'terra' },
  '1,5':  { body: 'luna' },
  '-4,2': { body: 'venus' },
  '5,-3': { body: 'mars' },
  '9,1':  { body: 'ceres' },
};

const ASTEROID_HEXES: string[] = ['7,2', '-2,-3', '3,6', '-5,5'];

const BASES: HexData['bases'] = {
  terra:  { hexSides: [0, 1, 2, 3, 4, 5] },
  venus:  { hexSides: [0, 1, 2, 3, 4, 5] },
  mars:   { hexSides: [0, 1, 2, 3] },
  luna:   { hexSides: [2] },
  ceres:  { hexSides: [0], asteroidBase: true, torpedo: true },
};

async function seed() {
  // Dynamic import ensures db client reads DATABASE_URL after dotenv runs
  const { db, pool } = await import('../client');
  const { maps } = await import('../schema');

  const planetHexes: HexData['hexes'] = Object.fromEntries(
    Object.entries(PLANET_HEXES).map(([key, { body }]) => [key, { type: 'planet' as const, body }]),
  );

  const withAsteroids: HexData['hexes'] = {
    ...planetHexes,
    ...Object.fromEntries(ASTEROID_HEXES.map((k) => [k, { type: 'asteroid' as const }])),
  };

  const gravityHexes = computeGravity(BODIES, withAsteroids);
  const nonGravity = Object.fromEntries(
    Object.entries(withAsteroids).filter(([, h]) => h.type !== 'gravity'),
  );
  const allHexes: HexData['hexes'] = { ...nonGravity, ...gravityHexes };

  const hexData: HexData = {
    meta: {
      name: 'Triplanetary — Inner Solar System',
      version: '1.0',
      hexSize: 48,
      orientation: 'pointy',
    },
    bodies: BODIES,
    hexes: allHexes,
    bases: BASES,
  };

  await db.delete(maps).where(eq(maps.isCanonical, true));
  await db.insert(maps).values({
    name: hexData.meta.name,
    version: hexData.meta.version,
    data: hexData,
    isCanonical: true,
  });

  const gravCount = Object.values(allHexes).filter(h => h.type === 'gravity').length;
  console.log(`Seeded canonical map with ${Object.keys(allHexes).length} hexes (${gravCount} gravity).`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

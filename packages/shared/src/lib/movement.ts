import type { Ship } from "../types/game";
import type { HexEntry, HexData } from "../types/map";

// The 6 axial unit directions for pointy-top hexes.
// Duplicated from gravity.ts to avoid a circular dependency refactor in Phase 1b.
const AXIAL_DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
] as const;

/**
 * Returns the set of valid destination hexes for a ship this turn.
 *
 * The ship can coast for free (predicted endpoint = position + effective vector)
 * or burn 1 fuel to reach any of the 6 neighbors of the predicted endpoint.
 * No hex-type filtering — all hexes are reachable in Bi-Planetary.
 *
 * @param ship   The ship being plotted.
 * @param hexes  Current hex entries (used to determine gravity; may be empty in tests).
 */
export function getValidDestinations(
  ship: Ship,
  _hexes: Record<string, HexEntry>,
): Set<string> {
  // Effective vector = current velocity + pending gravity (already queued from last turn)
  const grav = ship.pendingGravity ?? [0, 0];
  const vq = ship.vector[0] + grav[0];
  const vr = ship.vector[1] + grav[1];

  // Predicted coast destination
  const coastQ = ship.position[0] + vq;
  const coastR = ship.position[1] + vr;

  const valid = new Set<string>();
  valid.add(`${coastQ},${coastR}`);

  if (ship.fuel > 0) {
    for (const [dq, dr] of AXIAL_DIRS) {
      valid.add(`${coastQ + dq},${coastR + dr}`);
    }
  }

  return valid;
}

/**
 * Returns the target planet hex key for a given playerID in Bi-Planetary.
 * Player '0' (Mars) must reach Venus; Player '1' (Venus) must reach Mars.
 */
function targetBody(playerID: string): string {
  return playerID === "0" ? "venus" : "mars";
}

/**
 * Returns true if the given position matches the planet hex of the target body
 * for the specified player. Scans map.hexes dynamically so map edits propagate.
 */
export function checkLanding(
  position: [number, number],
  playerID: string,
  map: HexData,
): boolean {
  const target = targetBody(playerID);
  for (const [key, entry] of Object.entries(map.hexes)) {
    if (entry.type === "planet" && entry.body === target) {
      const [qStr, rStr] = key.split(",");
      if (
        position[0] === Number(qStr) &&
        position[1] === Number(rStr)
      ) {
        return true;
      }
    }
  }
  return false;
}

export interface PlotMap {
  [playerID: string]: { destination: [number, number]; locked: boolean };
}

export interface MovementState {
  ships: Ship[];
  plots: PlotMap;
  mapSnapshot: HexData | null;
  turnNumber: number;
  winner: string | null;
}

/**
 * Resolves one full movement turn for all players in order '0', '1'.
 * Mutates the state object in-place (compatible with Immer drafts).
 *
 * Resolution order per ship:
 *   1. Apply pendingGravity to velocity; clear pendingGravity.
 *   2. Compute fuel cost (0 if coasting, 1 if thrusting).
 *   3. Update velocity to the new vector (destination − position).
 *   4. Move ship to destination.
 *   5. Decrement fuel.
 *   6. Record new pendingGravity if ship is now in a gravity hex.
 *
 * After all ships move, check for landings and update winner/turnNumber.
 */
export function resolveMovement(state: MovementState): void {
  const winners: string[] = [];

  for (const playerID of ["0", "1"] as const) {
    const ship = state.ships[Number(playerID)];
    const plot = state.plots[playerID];
    if (!ship || !plot) continue;

    // Step 1 — apply pending gravity to velocity
    const grav = ship.pendingGravity ?? [0, 0];
    ship.vector[0] += grav[0];
    ship.vector[1] += grav[1];
    ship.pendingGravity = null;

    // Step 2 — cost: coast (no thrust) is free; any other destination costs 1 fuel
    const coastQ = ship.position[0] + ship.vector[0];
    const coastR = ship.position[1] + ship.vector[1];
    const [destQ, destR] = plot.destination;
    const isCoasting = destQ === coastQ && destR === coastR;
    const fuelCost = isCoasting ? 0 : 1;

    // Step 3 — new velocity = destination − current position
    ship.vector[0] = destQ - ship.position[0];
    ship.vector[1] = destR - ship.position[1];

    // Step 4 — move
    ship.position[0] = destQ;
    ship.position[1] = destR;

    // Step 5 — consume fuel
    ship.fuel = Math.max(0, ship.fuel - fuelCost);

    // Step 6 — record gravity in new hex (applied next turn)
    const newKey = `${destQ},${destR}`;
    const hexEntry = state.mapSnapshot?.hexes[newKey];
    if (hexEntry?.type === "gravity" && hexEntry.offset) {
      ship.pendingGravity = [hexEntry.offset[0], hexEntry.offset[1]];
    } else {
      ship.pendingGravity = null;
    }

    // Step 7 — check landing
    if (state.mapSnapshot && checkLanding([destQ, destR], playerID, state.mapSnapshot)) {
      winners.push(playerID);
    }
  }

  // Determine winner
  if (winners.length === 1) {
    state.winner = winners[0]!;
  } else if (winners.length === 2) {
    state.winner = "draw";
  }

  // Advance turn and clear plots
  state.plots = {};
  state.turnNumber += 1;
}

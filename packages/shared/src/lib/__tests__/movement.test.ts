import { describe, it, expect } from "vitest";
import {
  getValidDestinations,
  checkLanding,
  resolveMovement,
  type MovementState,
} from "../movement";
import type { Ship } from "../../types/game";
import type { HexData } from "../../types/map";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeShip(overrides: Partial<Ship> = {}): Ship {
  return {
    id: "ship-0",
    faction: "mars",
    position: [0, 0],
    vector: [0, 0],
    fuel: 6,
    maxFuel: 6,
    cs: 2,
    pendingGravity: null,
    ...overrides,
  };
}

const MARS_HEX: [number, number] = [5, -3];
const VENUS_HEX: [number, number] = [-4, 2];

/** Minimal map with just the two planet hexes for landing tests. */
const MINIMAL_MAP: HexData = {
  meta: { name: "test", version: "1.0", hexSize: 48, orientation: "pointy" },
  bodies: {
    mars: { center: "5,-3", gravityRings: 1 },
    venus: { center: "-4,2", gravityRings: 1 },
  },
  hexes: {
    "5,-3": { type: "planet", body: "mars" },
    "-4,2": { type: "planet", body: "venus" },
  },
  bases: {},
};

/** Map with a single gravity hex for testing gravity accumulation. */
function mapWithGravity(hexKey: string, offset: [number, number]): HexData {
  return {
    ...MINIMAL_MAP,
    hexes: {
      ...MINIMAL_MAP.hexes,
      [hexKey]: { type: "gravity", offset, manual: false },
    },
  };
}

function makeState(overrides: Partial<MovementState> = {}): MovementState {
  return {
    ships: [
      makeShip({ id: "ship-0", faction: "mars", position: [5, -3] }),
      makeShip({ id: "ship-1", faction: "venus", position: [-4, 2] }),
    ],
    plots: {},
    mapSnapshot: MINIMAL_MAP,
    turnNumber: 1,
    winner: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getValidDestinations
// ---------------------------------------------------------------------------

describe("getValidDestinations", () => {
  it("stationary ship with full fuel: coast = (0,0) + 6 neighbors", () => {
    const ship = makeShip({ position: [0, 0], vector: [0, 0] });
    const valid = getValidDestinations(ship, {});
    expect(valid.size).toBe(7); // coast + 6 neighbors
    expect(valid.has("0,0")).toBe(true);
    expect(valid.has("1,0")).toBe(true);
    expect(valid.has("0,1")).toBe(true);
    expect(valid.has("-1,1")).toBe(true);
    expect(valid.has("-1,0")).toBe(true);
    expect(valid.has("0,-1")).toBe(true);
    expect(valid.has("1,-1")).toBe(true);
  });

  it("ship with vector [1,0]: coast is (1,0), valid includes coast + neighbors", () => {
    const ship = makeShip({ position: [0, 0], vector: [1, 0] });
    const valid = getValidDestinations(ship, {});
    expect(valid.has("1,0")).toBe(true); // coast
    expect(valid.has("2,0")).toBe(true); // neighbor of coast
    expect(valid.has("1,1")).toBe(true);
    expect(valid.size).toBe(7);
  });

  it("ship with 0 fuel: only coast destination is valid", () => {
    const ship = makeShip({ position: [0, 0], vector: [2, -1], fuel: 0 });
    const valid = getValidDestinations(ship, {});
    expect(valid.size).toBe(1);
    expect(valid.has("2,-1")).toBe(true);
  });

  it("pendingGravity shifts the effective vector before computing coast", () => {
    const ship = makeShip({
      position: [0, 0],
      vector: [1, 0],
      pendingGravity: [0, 1],
    });
    const valid = getValidDestinations(ship, {});
    // effective vector = [1+0, 0+1] = [1,1], coast = [1,1]
    expect(valid.has("1,1")).toBe(true);
    // [1,-1] is a neighbor of old coast [1,0] but NOT of new coast [1,1]
    expect(valid.has("1,-1")).toBe(false);
  });

  it("null pendingGravity treated as [0,0]", () => {
    const ship = makeShip({ position: [0, 0], vector: [0, 0], pendingGravity: null });
    const valid = getValidDestinations(ship, {});
    expect(valid.has("0,0")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkLanding
// ---------------------------------------------------------------------------

describe("checkLanding", () => {
  it("player 0 at venus hex returns true", () => {
    expect(checkLanding(VENUS_HEX, "0", MINIMAL_MAP)).toBe(true);
  });

  it("player 0 at mars hex returns false (wrong target)", () => {
    expect(checkLanding(MARS_HEX, "0", MINIMAL_MAP)).toBe(false);
  });

  it("player 1 at mars hex returns true", () => {
    expect(checkLanding(MARS_HEX, "1", MINIMAL_MAP)).toBe(true);
  });

  it("player 1 at venus hex returns false (wrong target)", () => {
    expect(checkLanding(VENUS_HEX, "1", MINIMAL_MAP)).toBe(false);
  });

  it("neither player at a random hex returns false", () => {
    expect(checkLanding([0, 0], "0", MINIMAL_MAP)).toBe(false);
    expect(checkLanding([0, 0], "1", MINIMAL_MAP)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveMovement
// ---------------------------------------------------------------------------

describe("resolveMovement — coasting", () => {
  it("coasting ship moves by its vector, fuel unchanged", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [5, 5], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [1, 0], locked: true },  // coast
        "1": { destination: [5, 5], locked: true },  // coast (stationary)
      },
    });
    resolveMovement(state);
    expect(state.ships[0]!.position).toEqual([1, 0]);
    expect(state.ships[0]!.fuel).toBe(6);
    expect(state.ships[1]!.position).toEqual([5, 5]);
    expect(state.ships[1]!.fuel).toBe(6);
  });

  it("coasting ship: vector updated to new velocity", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [2, -1], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 3 }),
      ],
      plots: {
        "0": { destination: [2, -1], locked: true },
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    // new velocity = dest − old position = [2,-1] − [0,0] = [2,-1]
    expect(state.ships[0]!.vector).toEqual([2, -1]);
  });
});

describe("resolveMovement — thrusting", () => {
  it("thrusting to non-coast hex costs 1 fuel", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [0, 0], fuel: 4 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 4 }),
      ],
      plots: {
        "0": { destination: [1, 0], locked: true },  // thrust (coast was [0,0])
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(state.ships[0]!.position).toEqual([1, 0]);
    expect(state.ships[0]!.fuel).toBe(3);
  });

  it("new velocity = destination − previous position", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [2, 3], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [4, 3], locked: true },  // thrust to [4,3] (coast was [3,3])
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(state.ships[0]!.vector).toEqual([2, 0]); // [4,3] − [2,3]
  });
});

describe("resolveMovement — gravity", () => {
  it("pendingGravity is applied to vector before thrust, then cleared", () => {
    const state = makeState({
      ships: [
        makeShip({
          id: "ship-0",
          faction: "mars",
          position: [0, 0],
          vector: [1, 0],
          fuel: 6,
          pendingGravity: [0, 1],
        }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        // effective vector after gravity = [1,1]; coast = [1,1]; player coasts
        "0": { destination: [1, 1], locked: true },
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(state.ships[0]!.pendingGravity).toBeNull();
    expect(state.ships[0]!.position).toEqual([1, 1]);
    expect(state.ships[0]!.fuel).toBe(6); // coasting
  });

  it("ship arriving in gravity hex has pendingGravity set for next turn", () => {
    const gravMap = mapWithGravity("1,0", [0, 1]);
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [1, 0], locked: true },  // coast into gravity hex
        "1": { destination: [9, 9], locked: true },
      },
      mapSnapshot: gravMap,
    });
    resolveMovement(state);
    expect(state.ships[0]!.pendingGravity).toEqual([0, 1]);
  });

  it("ship leaving gravity hex clears pendingGravity", () => {
    const state = makeState({
      ships: [
        makeShip({
          id: "ship-0",
          faction: "mars",
          position: [0, 0],
          vector: [1, 0],
          fuel: 6,
          pendingGravity: [-1, 0],
        }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [0, 0], locked: true },  // lands on non-gravity hex
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(state.ships[0]!.pendingGravity).toBeNull();
  });
});

describe("resolveMovement — win condition", () => {
  it("player 0 landing on Venus wins", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [-5, 2], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [-4, 2], locked: true },  // Venus hex
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(state.winner).toBe("0");
  });

  it("player 1 landing on Mars wins", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [0, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [4, -3], vector: [1, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [0, 0], locked: true },
        "1": { destination: [5, -3], locked: true },  // Mars hex
      },
    });
    resolveMovement(state);
    expect(state.winner).toBe("1");
  });

  it("both players landing simultaneously results in draw", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [-5, 2], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [4, -3], vector: [1, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [-4, 2], locked: true },  // Venus
        "1": { destination: [5, -3], locked: true },  // Mars
      },
    });
    resolveMovement(state);
    expect(state.winner).toBe("draw");
  });

  it("no winner yet: winner remains null and turnNumber increments", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [1, 0], locked: true },
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(state.winner).toBeNull();
    expect(state.turnNumber).toBe(2);
  });

  it("plots are cleared after resolution", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [0, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [0, 0], locked: true },
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(Object.keys(state.plots)).toHaveLength(0);
  });
});

describe("resolveMovement — integration (multi-turn)", () => {
  it("ship coasts correctly over two turns with constant velocity", () => {
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [1, 0], locked: true },
        "1": { destination: [9, 9], locked: true },
      },
    });
    resolveMovement(state);
    expect(state.ships[0]!.position).toEqual([1, 0]);
    expect(state.ships[0]!.vector).toEqual([1, 0]);

    state.plots = {
      "0": { destination: [2, 0], locked: true },
      "1": { destination: [9, 9], locked: true },
    };
    resolveMovement(state);
    expect(state.ships[0]!.position).toEqual([2, 0]);
    expect(state.ships[0]!.fuel).toBe(6); // still no thrust
  });

  it("gravity applied on turn N+1 when ship entered gravity hex on turn N", () => {
    const gravMap = mapWithGravity("1,0", [0, 1]);
    const state = makeState({
      ships: [
        makeShip({ id: "ship-0", faction: "mars", position: [0, 0], vector: [1, 0], fuel: 6 }),
        makeShip({ id: "ship-1", faction: "venus", position: [9, 9], vector: [0, 0], fuel: 6 }),
      ],
      plots: {
        "0": { destination: [1, 0], locked: true },  // enter gravity hex
        "1": { destination: [9, 9], locked: true },
      },
      mapSnapshot: gravMap,
    });

    // Turn 1: ship moves to gravity hex [1,0], pendingGravity set to [0,1]
    resolveMovement(state);
    expect(state.ships[0]!.position).toEqual([1, 0]);
    expect(state.ships[0]!.pendingGravity).toEqual([0, 1]);

    // Turn 2: gravity [0,1] is applied to vector [1,0] → effective [1,1]; coast = [2,1]
    state.plots = {
      "0": { destination: [2, 1], locked: true },  // coasting with gravity
      "1": { destination: [9, 9], locked: true },
    };
    resolveMovement(state);
    expect(state.ships[0]!.position).toEqual([2, 1]);
    expect(state.ships[0]!.vector).toEqual([1, 1]); // [2,1] − [1,0]
    expect(state.ships[0]!.pendingGravity).toBeNull(); // [2,1] is not a gravity hex
    expect(state.ships[0]!.fuel).toBe(6);
  });
});

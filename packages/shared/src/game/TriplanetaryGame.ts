import { Stage, INVALID_MOVE } from 'boardgame.io/core';
import type { Game } from 'boardgame.io';
import type { TriplanetaryState } from '../types/game';
import { getValidDestinations, resolveMovement } from '../lib/movement';

export const TriplanetaryGame: Game<TriplanetaryState> = {
  name: 'triplanetary',

  setup: (_ctx, setupData): TriplanetaryState => ({
    ships: [
      {
        id: 'ship-0',
        faction: 'mars',
        position: [5, -3],
        vector: [0, 0],
        fuel: 6,
        maxFuel: 6,
        cs: 2,
        pendingGravity: null,
      },
      {
        id: 'ship-1',
        faction: 'venus',
        position: [-4, 2],
        vector: [0, 0],
        fuel: 6,
        maxFuel: 6,
        cs: 2,
        pendingGravity: null,
      },
    ],
    plots: {},
    phase: 'astrogation',
    turnNumber: 1,
    winner: null,
    mapSnapshot: (setupData as { mapData?: TriplanetaryState['mapSnapshot'] } | undefined)?.mapData ?? null,
    scenarioId: 'bi-planetary',
  }),

  phases: {
    astrogation: {
      start: true,
      turn: {
        activePlayers: { all: Stage.NULL },
      },
      moves: {
        plotCourse: ({ G, ctx }, destination: [number, number]) => {
          const ship = G.ships[Number(ctx.currentPlayer)];
          if (!ship) return INVALID_MOVE;
          const valid = getValidDestinations(ship, G.mapSnapshot?.hexes ?? {});
          if (!valid.has(`${destination[0]},${destination[1]}`)) return INVALID_MOVE;
          G.plots[ctx.currentPlayer] = { destination, locked: false };
        },

        lockIn: ({ G, ctx, events }) => {
          const plot = G.plots[ctx.currentPlayer];
          if (!plot) return INVALID_MOVE;
          plot.locked = true;
          const allLocked = Object.keys(ctx.activePlayers ?? {})
            .every(pid => G.plots[pid]?.locked === true);
          if (allLocked) events.endPhase();
        },
      },

      onEnd: ({ G }) => {
        resolveMovement(G);
      },

      next: 'astrogation',
    },
  },

  endIf: ({ G }) => {
    if (G.winner !== null) return { winner: G.winner };
  },
};

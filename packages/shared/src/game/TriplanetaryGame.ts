import type { Game } from 'boardgame.io';
import type { TriplanetaryState } from '../types/game';

export const TriplanetaryGame: Game<TriplanetaryState> = {
  name: 'triplanetary',

  setup: (): TriplanetaryState => ({
    ships: [],
    phase: 'lobby',
  }),

  moves: {
    // Phase 1 will add plotCourse, lockIn, etc.
  },

  turn: {
    minMoves: 0,
  },
};

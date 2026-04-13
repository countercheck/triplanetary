export type Phase = 'lobby' | 'astrogation' | 'movement' | 'combat' | 'resupply';

export type Faction = 'mars' | 'venus' | 'terra' | 'none';

export interface Ship {
  id: string;
  faction: Faction;
  position: [number, number];
  vector: [number, number];
  fuel: number;
  maxFuel: number;
  cs: number;
  pendingGravity: [number, number] | null;
}

export interface PlotEntry {
  destination: [number, number];
  locked: boolean;
}

export interface TriplanetaryState {
  ships: Ship[];
  plots: Record<string, PlotEntry>;
  phase: Phase;
  turnNumber: number;
  winner: string | null;
  mapSnapshot: import('./map').HexData | null;
  scenarioId: string;
}

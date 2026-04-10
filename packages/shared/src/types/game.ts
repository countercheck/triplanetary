export type Phase = 'lobby' | 'astrogation' | 'movement' | 'combat' | 'resupply';

export type Faction = 'mars' | 'venus' | 'terra' | 'none';

export interface Ship {
  id: string;
  faction: Faction;
  position: [number, number];
  vector: [number, number];
  fuel: number;
}

export interface TriplanetaryState {
  ships: Ship[];
  phase: Phase;
}

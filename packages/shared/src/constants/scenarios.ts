export interface Scenario {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  implemented: boolean;
}

export const SCENARIOS: Scenario[] = [
  { id: 'bi-planetary', name: 'Bi-Planetary', minPlayers: 2, maxPlayers: 2, implemented: true },
  { id: 'grand-tour', name: 'Grand Tour', minPlayers: 2, maxPlayers: 4, implemented: false },
  { id: 'escape', name: 'Escape', minPlayers: 2, maxPlayers: 3, implemented: false },
  { id: 'lateral-7', name: 'Lateral 7', minPlayers: 2, maxPlayers: 4, implemented: false },
  { id: 'nova', name: 'Nova', minPlayers: 2, maxPlayers: 4, implemented: false },
  { id: 'piracy', name: 'Piracy', minPlayers: 2, maxPlayers: 4, implemented: false },
  { id: 'retribution', name: 'Retribution', minPlayers: 2, maxPlayers: 4, implemented: false },
  { id: 'fleet-mutiny', name: 'Fleet Mutiny', minPlayers: 3, maxPlayers: 4, implemented: false },
  { id: 'interplanetary-war', name: 'Interplanetary War', minPlayers: 2, maxPlayers: 6, implemented: false },
  { id: 'prospecting', name: 'Prospecting', minPlayers: 2, maxPlayers: 4, implemented: false },
  { id: 'campaign', name: 'Campaign', minPlayers: 2, maxPlayers: 6, implemented: false },
];

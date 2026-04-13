import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SCENARIOS } from '@triplanetary/shared';
import { apiClient } from '../../lib/apiClient';
import type { HexData } from '@triplanetary/shared';

interface MapMeta {
  id: string;
  name: string;
  isCanonical: boolean;
}

interface MapRow {
  id: string;
  data: HexData;
}

interface Match {
  matchID: string;
  players: Record<string, { id: number; name?: string }>;
  setupData?: { scenarioId?: string };
  createdAt: string;
}

async function fetchMatches(): Promise<Match[]> {
  const res = await fetch('/games/triplanetary', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch matches');
  const data = (await res.json()) as { matches: Match[] };
  return data.matches ?? [];
}

async function fetchCanonicalMap(): Promise<HexData | null> {
  const maps = await apiClient.get<MapMeta[]>('/maps');
  const canonical = maps.find((m) => m.isCanonical);
  if (!canonical) return null;
  const row = await apiClient.get<MapRow>(`/maps/${canonical.id}`);
  return row.data;
}

async function createAndJoin(
  numPlayers: number,
  mapData: HexData | null,
  playerName: string,
): Promise<{ matchID: string }> {
  // 1. Create match with canonical map as setupData
  const createRes = await fetch('/games/triplanetary/create', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numPlayers, setupData: { mapData } }),
  });
  if (!createRes.ok) throw new Error('Failed to create match');
  const { matchID } = (await createRes.json()) as { matchID: string };

  // 2. Join as player 0
  const joinRes = await fetch(`/games/triplanetary/${matchID}/join`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerID: '0', playerName }),
  });
  if (!joinRes.ok) throw new Error('Failed to join match');
  const { playerCredentials } = (await joinRes.json()) as { playerCredentials: string };

  // 3. Store credentials in sessionStorage
  sessionStorage.setItem(
    `bgio-${matchID}`,
    JSON.stringify({ playerID: '0', credentials: playerCredentials }),
  );

  return { matchID };
}

async function joinExistingMatch(
  matchID: string,
  playerName: string,
): Promise<void> {
  // Determine free seat
  const matchRes = await fetch(`/games/triplanetary/${matchID}`, {
    credentials: 'include',
  });
  if (!matchRes.ok) throw new Error('Failed to fetch match');
  const matchData = (await matchRes.json()) as {
    players: Array<{ id: number; name?: string }>;
  };

  const freeSeat = matchData.players.find((p) => !p.name);
  if (!freeSeat) throw new Error('Match is full');
  const playerID = String(freeSeat.id);

  const joinRes = await fetch(`/games/triplanetary/${matchID}/join`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerID, playerName }),
  });
  if (!joinRes.ok) throw new Error('Failed to join match');
  const { playerCredentials } = (await joinRes.json()) as { playerCredentials: string };

  sessionStorage.setItem(
    `bgio-${matchID}`,
    JSON.stringify({ playerID, credentials: playerCredentials }),
  );
}

export default function LobbyPage() {
  const [selectedScenario] = useState('bi-planetary');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
    refetchInterval: 5000,
  });

  const scenario = SCENARIOS.find((s) => s.id === selectedScenario);

  const createMutation = useMutation({
    mutationFn: async () => {
      const mapData = await fetchCanonicalMap();
      return createAndJoin(scenario?.minPlayers ?? 2, mapData, 'Player 1');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] }).catch(() => undefined);
      navigate(`/game/${data.matchID}`);
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (matchID: string) => {
      await joinExistingMatch(matchID, 'Player 2');
      return matchID;
    },
    onSuccess: (matchID) => {
      navigate(`/game/${matchID}`);
    },
  });

  return (
    <main>
      <h1>Lobby</h1>
      <section>
        <h2>Create Game</h2>
        <p>Scenario: {scenario?.name ?? selectedScenario}</p>
        <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Game'}
        </button>
        {createMutation.isError && <p role="alert">Failed to create game</p>}
      </section>

      <section>
        <h2>Open Games</h2>
        {isLoading && <p>Loading games...</p>}
        {!isLoading && matches.length === 0 && <p>No open games. Create one above!</p>}
        <ul>
          {matches.map((match) => (
            <li key={match.matchID}>
              Match {match.matchID.slice(0, 8)}
              {' · '}
              <button
                onClick={() => joinMutation.mutate(match.matchID)}
                disabled={joinMutation.isPending}
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SCENARIOS } from '@triplanetary/shared';

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

async function createMatch(numPlayers: number): Promise<{ matchID: string }> {
  const res = await fetch('/games/triplanetary/create', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numPlayers }),
  });
  if (!res.ok) throw new Error('Failed to create match');
  return res.json() as Promise<{ matchID: string }>;
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
    mutationFn: () => createMatch(scenario?.minPlayers ?? 2),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] }).catch(() => undefined);
      navigate(`/game/${data.matchID}`);
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
              <button onClick={() => navigate(`/game/${match.matchID}`)}>Join</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

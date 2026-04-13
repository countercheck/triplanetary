import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { TriplanetaryGame } from '@triplanetary/shared';
import Board from '../game/Board';

// Module-level singleton — avoids re-creating the client class on every render.
const GameClient = Client({
  game: TriplanetaryGame,
  board: Board,
  multiplayer: SocketIO({ server: '' }), // same origin — Vite proxies /socket.io → :8000
  debug: false,
});

interface StoredSeat {
  playerID: string;
  credentials: string;
}

export default function GameRoom() {
  const { matchID } = useParams<{ matchID: string }>();

  const stored = useMemo<StoredSeat | null>(() => {
    if (!matchID) return null;
    const raw = sessionStorage.getItem(`bgio-${matchID}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSeat;
  }, [matchID]);

  if (!matchID) return <p>Missing match ID.</p>;

  if (!stored) {
    return (
      <p>
        No seat found for this match — <Link to="/lobby">return to lobby</Link>
      </p>
    );
  }

  return (
    <GameClient
      matchID={matchID}
      playerID={stored.playerID}
      credentials={stored.credentials}
    />
  );
}

import { useParams } from 'react-router-dom';

// Placeholder board component - Phase 1 will wire up boardgame.io Client
function Board() {
  return (
    <div>
      <p>Game board placeholder — Phase 1 will render the hex map here.</p>
    </div>
  );
}

export default function GameRoom() {
  const { matchID } = useParams<{ matchID: string }>();

  return (
    <main>
      <h1>Game {matchID}</h1>
      <Board />
    </main>
  );
}

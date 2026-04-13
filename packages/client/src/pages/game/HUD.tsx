import type { Ctx } from 'boardgame.io';
import type { TriplanetaryState } from '@triplanetary/shared';

interface Props {
  G: TriplanetaryState;
  ctx: Ctx;
  playerID: string;
  isActive: boolean;
  onLockIn: () => void;
}

export default function HUD({ G, ctx, playerID, isActive, onLockIn }: Props) {
  const shipIdx = Number(playerID);
  const ship = G.ships[shipIdx];
  const plot = G.plots[playerID];

  return (
    <div style={{ padding: '12px', background: '#111', color: '#eee', minWidth: 200 }}>
      <p>
        <strong>Turn {G.turnNumber}</strong> — {ctx.phase ?? 'astrogation'}
      </p>

      {ship && (
        <p>
          Fuel: {ship.fuel} / {ship.maxFuel}
        </p>
      )}

      {G.winner !== null ? (
        <p style={{ color: '#ffcc00', fontWeight: 'bold' }}>
          {G.winner === playerID
            ? 'You win!'
            : G.winner === 'draw'
              ? "It's a draw!"
              : 'You lose.'}
        </p>
      ) : isActive && !plot ? (
        <p>Select your ship, then click a destination to plot your course.</p>
      ) : isActive && plot && !plot.locked ? (
        <button onClick={onLockIn}>Lock In</button>
      ) : plot?.locked ? (
        <p>Waiting for opponent…</p>
      ) : null}
    </div>
  );
}

import { useState, useMemo, useCallback } from 'react';
import type { BoardProps as BgioBoardProps } from 'boardgame.io/react';
import { defineHex, Grid, rectangle, Orientation } from 'honeycomb-grid';
import {
  getValidDestinations,
  type TriplanetaryState,
  type HexData,
} from '@triplanetary/shared';
import { HexGrid } from '../../components/map/HexGrid';
import HUD from './HUD';

const Q_RANGE: [number, number] = [-12, 14];
const R_RANGE: [number, number] = [-10, 12];

const FACTION_COLORS: Record<string, string> = {
  mars: '#cc4444',
  venus: '#44aacc',
  terra: '#44cc44',
  none: '#888888',
};

// Fallback empty map used when G.mapSnapshot is null
const EMPTY_MAP: HexData = {
  meta: { name: '', version: '1.0', hexSize: 30, orientation: 'pointy' },
  bodies: {},
  hexes: {},
  bases: {},
};

type BoardProps = BgioBoardProps<TriplanetaryState>;

export default function Board({ G, ctx, moves, playerID, isActive }: BoardProps) {
  const typedMoves = moves as {
    plotCourse: (dest: [number, number]) => void;
    lockIn: () => void;
  };
  const [selectedShip, setSelectedShip] = useState<number | null>(null);
  const [validDests, setValidDests] = useState<Set<string>>(new Set());

  const mapData = G.mapSnapshot ?? EMPTY_MAP;
  const hexSize = mapData.meta.hexSize;

  // Build the same hex grid as HexGrid uses to look up pixel centers
  const hexLookup = useMemo(() => {
    const [qMin, qMax] = Q_RANGE;
    const [rMin, rMax] = R_RANGE;
    const ProtoHex = defineHex({
      dimensions: hexSize,
      orientation: Orientation.POINTY,
      origin: 'topLeft',
    });
    const grid = new Grid(
      ProtoHex,
      rectangle({ width: qMax - qMin + 1, height: rMax - rMin + 1, start: { q: qMin, r: rMin } }),
    );
    const map = new Map<string, { x: number; y: number }>();
    for (const hex of grid) {
      map.set(`${hex.q},${hex.r}`, { x: hex.x, y: hex.y });
    }
    return map;
  }, [hexSize]);

  const center = useCallback(
    (q: number, r: number) => hexLookup.get(`${q},${r}`) ?? { x: 0, y: 0 },
    [hexLookup],
  );

  const handleHexClick = useCallback(
    (q: number, r: number) => {
      if (!isActive || !playerID || ctx.phase !== 'astrogation') return;
      const key = `${q},${r}`;
      const ownShipIdx = Number(playerID);

      // If clicking own ship and haven't plotted yet, select it
      if (
        G.ships[ownShipIdx]?.position[0] === q &&
        G.ships[ownShipIdx]?.position[1] === r &&
        !G.plots[playerID ?? '']
      ) {
        setSelectedShip(ownShipIdx);
        const ship = G.ships[ownShipIdx];
        if (ship) {
          setValidDests(getValidDestinations(ship, mapData.hexes));
        }
        return;
      }

      // If a ship is selected and this is a valid destination, plot
      if (selectedShip !== null && validDests.has(key)) {
        typedMoves.plotCourse([q, r]);
        setSelectedShip(null);
        setValidDests(new Set());
      }
    },
    [isActive, ctx.phase, playerID, G.ships, G.plots, selectedShip, validDests, typedMoves, mapData.hexes],
  );

  const overlays = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const r = 10; // ship counter radius

    // Valid destination highlights
    for (const key of validDests) {
      const [qStr, rStr] = key.split(',');
      const q = Number(qStr);
      const rv = Number(rStr);
      const c = center(q, rv);
      // Hexagon highlight using 6 corners (same size as rendered hex)
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        pts.push(`${c.x + hexSize * Math.cos(angle)},${c.y + hexSize * Math.sin(angle)}`);
      }
      elements.push(
        <polygon
          key={`valid-${key}`}
          points={pts.join(' ')}
          fill="rgba(255,220,0,0.18)"
          stroke="#ffcc00"
          strokeWidth={1.5}
          style={{ pointerEvents: 'none' }}
        />,
      );
    }

    for (let i = 0; i < G.ships.length; i++) {
      const ship = G.ships[i];
      if (!ship) continue;
      const [sq, sr] = ship.position;
      const c = center(sq, sr);
      const color = FACTION_COLORS[ship.faction] ?? '#888';

      // Vector arrow (from current pos toward predicted coast)
      const [vq, vr] = ship.vector;
      const grav = ship.pendingGravity ?? [0, 0];
      const coastQ = sq + vq + grav[0];
      const coastR = sr + vr + grav[1];
      const tc = center(coastQ, coastR);
      if (vq !== 0 || vr !== 0 || grav[0] !== 0 || grav[1] !== 0) {
        elements.push(
          <line
            key={`vector-${ship.id}`}
            x1={c.x}
            y1={c.y}
            x2={tc.x}
            y2={tc.y}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="4 2"
            style={{ pointerEvents: 'none' }}
          />,
        );
      }

      // Plot line (if a destination is plotted but not yet locked in)
      const plot = G.plots[String(i)];
      if (plot) {
        const pc = center(plot.destination[0], plot.destination[1]);
        elements.push(
          <line
            key={`plot-${ship.id}`}
            x1={c.x}
            y1={c.y}
            x2={pc.x}
            y2={pc.y}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            opacity={0.7}
            style={{ pointerEvents: 'none' }}
          />,
        );
      }

      // Ship counter
      const isSelected = selectedShip === i;
      elements.push(
        <g key={`ship-${ship.id}`}>
          <circle
            cx={c.x}
            cy={c.y}
            r={r}
            fill={color}
            stroke={isSelected ? '#ffcc00' : '#fff'}
            strokeWidth={isSelected ? 2.5 : 1}
          />
          <text
            x={c.x}
            y={c.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fill="#fff"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {ship.faction.slice(0, 1).toUpperCase()}
          </text>
        </g>,
      );
    }

    return <g>{elements}</g>;
  }, [G.ships, G.plots, validDests, selectedShip, center, hexSize]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <HexGrid
          data={mapData}
          qRange={Q_RANGE}
          rRange={R_RANGE}
          onHexClick={handleHexClick}
          overlays={overlays}
        />
      </div>
      <HUD
        G={G}
        ctx={ctx}
        playerID={playerID ?? ''}
        isActive={isActive}
        onLockIn={() => typedMoves.lockIn()}
      />
    </div>
  );
}

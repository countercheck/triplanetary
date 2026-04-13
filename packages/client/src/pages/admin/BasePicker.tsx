import type { HexData } from '@triplanetary/shared';

const SIDE_LABELS = ['Side 0 (E)', 'Side 1 (SE)', 'Side 2 (SW)', 'Side 3 (W)', 'Side 4 (NW)', 'Side 5 (NE)'];

interface Props {
  selectedHex: string;
  hexData: HexData;
  onAssign: (bodyName: string, side: number) => void;
  onCancel: () => void;
}

export function BasePicker({ selectedHex, hexData, onAssign, onCancel }: Props) {
  const entry = hexData.hexes[selectedHex];
  const bodyName = entry?.body;

  if (!bodyName) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
        <div style={{ background: '#1a1a2e', padding: 24, borderRadius: 8 }}>
          <p>Select a planet hex first, then switch to Base mode.</p>
          <button onClick={onCancel}>Close</button>
        </div>
      </div>
    );
  }

  const existing = hexData.bases[bodyName]?.hexSides ?? [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1a1a2e', padding: 24, borderRadius: 8, minWidth: 240 }}>
        <h3 style={{ marginTop: 0 }}>Assign Base to {bodyName}</h3>
        <p style={{ fontSize: 12, color: '#888' }}>Currently assigned sides: {existing.length > 0 ? existing.join(', ') : 'none'}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SIDE_LABELS.map((label, side) => (
            <button
              key={side}
              onClick={() => onAssign(bodyName, side)}
              style={{
                padding: '6px 12px',
                background: existing.includes(side) ? '#4488ff' : '#333',
                border: '1px solid #555',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {label} {existing.includes(side) ? '✓' : ''}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{ marginTop: 12, width: '100%' }}>Done</button>
      </div>
    </div>
  );
}

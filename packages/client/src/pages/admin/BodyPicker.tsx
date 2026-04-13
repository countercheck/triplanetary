import type { BodyEntry } from '@triplanetary/shared';

const BODIES: Array<{ name: string; entry: BodyEntry }> = [
  { name: 'sol',     entry: { center: '', radius: 3, gravityRings: 2 } },
  { name: 'terra',   entry: { center: '', radius: 1, gravityRings: 1 } },
  { name: 'luna',    entry: { center: '', radius: 0, gravityRings: 1, weakGravity: true } },
  { name: 'venus',   entry: { center: '', radius: 1, gravityRings: 1 } },
  { name: 'mars',    entry: { center: '', radius: 1, gravityRings: 1 } },
  { name: 'ceres',   entry: { center: '', gravityRings: 0, asteroidBase: true } },
  { name: 'jupiter', entry: { center: '', radius: 2, gravityRings: 2 } },
];

interface Props {
  onPick: (bodyName: string, bodyDef: BodyEntry) => void;
  onCancel: () => void;
}

export function BodyPicker({ onPick, onCancel }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#1a1a2e', padding: 24, borderRadius: 8, minWidth: 200 }}>
        <h3 style={{ marginTop: 0 }}>Choose Body</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BODIES.map(({ name, entry }) => (
            <li key={name}>
              <button
                onClick={() => onPick(name, entry)}
                style={{ width: '100%', padding: '6px 12px', cursor: 'pointer' }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
        <button onClick={onCancel} style={{ marginTop: 12, width: '100%' }}>Cancel</button>
      </div>
    </div>
  );
}

import type { EditorMode } from '../../hooks/useMapEditor';

const MODES: { value: EditorMode; label: string }[] = [
  { value: 'select',      label: 'Select' },
  { value: 'space',       label: 'Space' },
  { value: 'asteroid',    label: 'Asteroid' },
  { value: 'planet',      label: 'Planet ▾' },
  { value: 'base',        label: 'Base' },
  { value: 'gravity',     label: 'Gravity' },
  { value: 'weakGravity', label: 'Weak Gravity' },
  { value: 'clandestine', label: 'Clandestine' },
  { value: 'erase',       label: 'Erase' },
];

interface Props {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onRecomputeGravity: () => void;
}

export function EditorToolbar({ mode, onModeChange, onRecomputeGravity }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, minWidth: 160 }}>
      {MODES.map(({ value, label }) => (
        <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="radio"
            name="editor-mode"
            value={value}
            checked={mode === value}
            onChange={() => onModeChange(value)}
          />
          {label}
        </label>
      ))}
      <hr />
      <button onClick={onRecomputeGravity} style={{ marginTop: 4 }}>
        Recompute All Gravity
      </button>
    </div>
  );
}

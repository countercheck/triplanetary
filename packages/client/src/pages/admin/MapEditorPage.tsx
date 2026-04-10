import { useState, useCallback } from 'react';
import { HexGrid } from '../../components/map/HexGrid';
import { EditorToolbar } from './EditorToolbar';
import { HexInspector } from './HexInspector';
import { BodyPicker } from './BodyPicker';
import { BasePicker } from './BasePicker';
import { useMapEditor } from '../../hooks/useMapEditor';
import { computeGravity } from '@triplanetary/shared';
import type { HexData, BodyEntry } from '@triplanetary/shared';

const BLANK_MAP: HexData = {
  meta: { name: 'New Map', version: '1.0', hexSize: 48, orientation: 'pointy' },
  bodies: {},
  hexes: {},
  bases: {},
};

const Q_RANGE: [number, number] = [-12, 14];
const R_RANGE: [number, number] = [-10, 12];

export default function MapEditorPage() {
  const editor = useMapEditor(BLANK_MAP);
  const [showBodyPicker, setShowBodyPicker] = useState(false);
  const [showBasePicker, setShowBasePicker] = useState(false);

  const handleHexClickWithPickers = useCallback(
    (q: number, r: number) => {
      editor.handleHexClick(q, r);
      if (editor.mode === 'planet') {
        setShowBodyPicker(true);
      }
      if (editor.mode === 'base') {
        setShowBasePicker(true);
      }
    },
    [editor],
  );

  const handleBodyPick = useCallback(
    (bodyName: string, bodyDef: BodyEntry) => {
      if (!editor.selectedHex) return;
      editor.placeBody(bodyName, editor.selectedHex, {
        ...bodyDef,
        center: editor.selectedHex,
      });
      setShowBodyPicker(false);
    },
    [editor],
  );

  const handleBaseAssign = useCallback(
    (bodyName: string, side: number) => {
      editor.assignBase(bodyName, side);
    },
    [editor],
  );

  const handleRecomputeGravity = useCallback(() => {
    const gravityHexes = computeGravity(editor.hexData.bodies, editor.hexData.hexes);
    const nonGravity = Object.fromEntries(
      Object.entries(editor.hexData.hexes).filter(([, h]) => h.type !== 'gravity'),
    );
    editor.loadHexData({
      ...editor.hexData,
      hexes: { ...nonGravity, ...gravityHexes },
    });
  }, [editor]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a1a', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', background: '#111', borderBottom: '1px solid #333' }}>
        <h2 style={{ margin: 0 }}>Map Editor</h2>
        <span style={{ fontFamily: 'monospace' }}>{editor.hexData.meta.name}</span>
        {editor.dirty && <span style={{ color: '#ffaa44' }}>● unsaved</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button>Save</button>
          <button>Export</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: toolbar */}
        <div style={{ borderRight: '1px solid #333', overflowY: 'auto' }}>
          <EditorToolbar
            mode={editor.mode}
            onModeChange={editor.setMode}
            onRecomputeGravity={handleRecomputeGravity}
          />
        </div>

        {/* Center: hex grid */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <HexGrid
            data={editor.hexData}
            qRange={Q_RANGE}
            rRange={R_RANGE}
            onHexClick={handleHexClickWithPickers}
            selectedHex={editor.selectedHex}
          />
        </div>

        {/* Right: inspector */}
        <div style={{ borderLeft: '1px solid #333', overflowY: 'auto' }}>
          <HexInspector
            selectedHex={editor.selectedHex}
            hexData={editor.hexData}
            setGravityOverride={editor.setGravityOverride}
            handleHexClick={editor.handleHexClick}
          />
        </div>
      </div>

      {/* Body picker modal */}
      {showBodyPicker && (
        <BodyPicker
          onPick={handleBodyPick}
          onCancel={() => setShowBodyPicker(false)}
        />
      )}

      {/* Base picker modal */}
      {showBasePicker && editor.selectedHex && (
        <BasePicker
          selectedHex={editor.selectedHex}
          hexData={editor.hexData}
          onAssign={handleBaseAssign}
          onCancel={() => setShowBasePicker(false)}
        />
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { computeGravity } from '@triplanetary/shared';
import type { HexData, HexEntry, BodyEntry } from '@triplanetary/shared';

export type EditorMode =
  | 'select'
  | 'space'
  | 'asteroid'
  | 'planet'
  | 'base'
  | 'gravity'
  | 'weakGravity'
  | 'clandestine'
  | 'erase';

export interface UseMapEditorResult {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  hexData: HexData;
  selectedHex: string | null;
  dirty: boolean;
  handleHexClick: (q: number, r: number) => void;
  placeBody: (bodyName: string, centerKey: string, body: BodyEntry) => void;
  setGravityOverride: (hexKey: string, offset: [number, number]) => void;
  assignBase: (bodyName: string, side: number) => void;
  resetDirty: () => void;
  loadHexData: (data: HexData) => void;
}

export function useMapEditor(initial: HexData): UseMapEditorResult {
  const [mode, setMode] = useState<EditorMode>('select');
  const [hexData, setHexData] = useState<HexData>(initial);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const applyHexChange = useCallback((key: string, entry: HexEntry) => {
    setHexData((prev) => ({
      ...prev,
      hexes: { ...prev.hexes, [key]: entry },
    }));
    setDirty(true);
  }, []);

  const handleHexClick = useCallback(
    (q: number, r: number) => {
      const key = `${q},${r}`;
      switch (mode) {
        case 'select':
          setSelectedHex(key);
          break;
        case 'space':
          applyHexChange(key, { type: 'space' });
          break;
        case 'asteroid':
          applyHexChange(key, { type: 'asteroid' });
          break;
        case 'erase':
          applyHexChange(key, { type: 'space' });
          break;
        case 'gravity':
          applyHexChange(key, { type: 'gravity', offset: [0, 1], manual: false });
          break;
        case 'weakGravity':
          setHexData((prev) => ({
            ...prev,
            hexes: {
              ...prev.hexes,
              [key]: { ...prev.hexes[key], type: 'gravity', weak: true } as HexEntry,
            },
          }));
          setDirty(true);
          break;
        case 'clandestine':
          applyHexChange(key, { type: 'clandestine' });
          break;
        // planet and base modes require additional UI interaction (body/base picker)
        case 'planet':
        case 'base':
          setSelectedHex(key);
          break;
      }
    },
    [mode, applyHexChange],
  );

  const placeBody = useCallback((bodyName: string, centerKey: string, body: BodyEntry) => {
    setHexData((prev) => {
      const newBodies = { ...prev.bodies, [bodyName]: body };
      const hexesWithPlanet = {
        ...prev.hexes,
        [centerKey]: { type: 'planet' as const, body: bodyName },
      };
      const gravityHexes = computeGravity(newBodies, hexesWithPlanet);
      const nonGravity = Object.fromEntries(
        Object.entries(hexesWithPlanet).filter(([, h]) => h.type !== 'gravity'),
      );
      return { ...prev, bodies: newBodies, hexes: { ...nonGravity, ...gravityHexes } };
    });
    setDirty(true);
  }, []);

  const setGravityOverride = useCallback((hexKey: string, offset: [number, number]) => {
    setHexData((prev) => ({
      ...prev,
      hexes: {
        ...prev.hexes,
        [hexKey]: { ...prev.hexes[hexKey], offset, manual: true } as HexEntry,
      },
    }));
    setDirty(true);
  }, []);

  const assignBase = useCallback((bodyName: string, side: number) => {
    setHexData((prev) => {
      const existing = prev.bases[bodyName] ?? { hexSides: [] };
      const sides = existing.hexSides.includes(side)
        ? existing.hexSides.filter((s) => s !== side) // toggle off
        : [...existing.hexSides, side];               // toggle on
      return {
        ...prev,
        bases: { ...prev.bases, [bodyName]: { ...existing, hexSides: sides } },
      };
    });
    setDirty(true);
  }, []);

  const resetDirty = useCallback(() => setDirty(false), []);

  const loadHexData = useCallback((data: HexData) => {
    setHexData(data);
    setDirty(false);
    setSelectedHex(null);
  }, []);

  return {
    mode,
    setMode,
    hexData,
    selectedHex,
    dirty,
    handleHexClick,
    placeBody,
    setGravityOverride,
    assignBase,
    resetDirty,
    loadHexData,
  };
}

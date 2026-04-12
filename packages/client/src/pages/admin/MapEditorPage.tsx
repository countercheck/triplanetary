import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { HexGrid } from "../../components/map/HexGrid";
import { EditorToolbar } from "./EditorToolbar";
import { HexInspector } from "./HexInspector";
import { BodyPicker } from "./BodyPicker";
import { BasePicker } from "./BasePicker";
import { useMapEditor } from "../../hooks/useMapEditor";
import { useMap, useCreateMap, useUpdateMap } from "../../hooks/useMaps";
import { computeGravity } from "@triplanetary/shared";
import type { HexData, BodyEntry } from "@triplanetary/shared";

const BLANK_MAP: HexData = {
  meta: { name: "New Map", version: "1.0", hexSize: 48, orientation: "pointy" },
  bodies: {},
  hexes: {},
  bases: {},
};

const Q_RANGE: [number, number] = [-12, 14];
const R_RANGE: [number, number] = [-10, 12];

export default function MapEditorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mapId = searchParams.get("id");

  const editor = useMapEditor(BLANK_MAP);
  const [showBodyPicker, setShowBodyPicker] = useState(false);
  const [showBasePicker, setShowBasePicker] = useState(false);

  const { data: existingMap } = useMap(mapId);
  const createMap = useCreateMap();
  const updateMap = useUpdateMap(mapId ?? "");

  // Load existing map when data arrives
  useEffect(() => {
    if (existingMap) editor.loadHexData(existingMap.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingMap?.id]);

  const handleHexClickWithPickers = useCallback(
    (q: number, r: number) => {
      editor.handleHexClick(q, r);
      if (editor.mode === "planet") {
        setShowBodyPicker(true);
      }
      if (editor.mode === "base") {
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
    const gravityHexes = computeGravity(
      editor.hexData.bodies,
      editor.hexData.hexes,
    );
    const nonGravity = Object.fromEntries(
      Object.entries(editor.hexData.hexes).filter(
        ([, h]) => h.type !== "gravity",
      ),
    );
    editor.loadHexData({
      ...editor.hexData,
      hexes: { ...nonGravity, ...gravityHexes },
    });
  }, [editor]);

  const handleSave = useCallback(async () => {
    if (mapId) {
      await updateMap.mutateAsync({
        data: editor.hexData,
        name: editor.hexData.meta.name,
      });
    } else {
      const created = await createMap.mutateAsync({
        name: editor.hexData.meta.name,
        version: editor.hexData.meta.version,
        data: editor.hexData,
      });
      setSearchParams({ id: created.id }, { replace: true });
    }
    editor.resetDirty();
  }, [mapId, editor, createMap, updateMap]);

  const handleExport = useCallback(() => {
    const json = JSON.stringify(editor.hexData, null, 2);
    const a = document.createElement("a");
    a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    a.download = `${editor.hexData.meta.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
  }, [editor]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0a0a1a",
        color: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 16px",
          background: "#111",
          borderBottom: "1px solid #333",
        }}
      >
        <h2 style={{ margin: 0 }}>Map Editor</h2>
        <span style={{ fontFamily: "monospace" }}>
          {editor.hexData.meta.name}
        </span>
        {editor.dirty && <span style={{ color: "#ffaa44" }}>● unsaved</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={!editor.dirty}>
            Save
          </button>
          <button onClick={handleExport}>Export</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: toolbar */}
        <div style={{ borderRight: "1px solid #333", overflowY: "auto" }}>
          <EditorToolbar
            mode={editor.mode}
            onModeChange={editor.setMode}
            onRecomputeGravity={handleRecomputeGravity}
          />
        </div>

        {/* Center: hex grid */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <HexGrid
            data={editor.hexData}
            qRange={Q_RANGE}
            rRange={R_RANGE}
            onHexClick={handleHexClickWithPickers}
            selectedHex={editor.selectedHex}
          />
        </div>

        {/* Right: inspector */}
        <div style={{ borderLeft: "1px solid #333", overflowY: "auto" }}>
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

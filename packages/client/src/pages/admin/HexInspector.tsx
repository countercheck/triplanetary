import type { HexData } from "@triplanetary/shared";
import type { UseMapEditorResult } from "../../hooks/useMapEditor";

const GRAVITY_DIRS: Array<{ label: string; offset: [number, number] }> = [
  { label: "→", offset: [1, 0] },
  { label: "↘", offset: [0, 1] },
  { label: "↙", offset: [-1, 1] },
  { label: "←", offset: [-1, 0] },
  { label: "↖", offset: [0, -1] },
  { label: "↗", offset: [1, -1] },
];

interface Props {
  selectedHex: string | null;
  hexData: HexData;
  setGravityOverride: UseMapEditorResult["setGravityOverride"];
  eraseHex: UseMapEditorResult["eraseHex"];
}

export function HexInspector({
  selectedHex,
  hexData,
  setGravityOverride,
  eraseHex,
}: Props) {
  if (!selectedHex) {
    return (
      <div style={{ padding: 8, color: "#888" }}>Click a hex to inspect</div>
    );
  }
  const [qStr, rStr] = selectedHex.split(",");
  const q = Number(qStr);
  const r = Number(rStr);
  const entry = hexData.hexes[selectedHex];

  return (
    <div style={{ padding: 8, minWidth: 200 }}>
      <div style={{ fontFamily: "monospace", marginBottom: 8 }}>
        <strong>q:</strong> {q} <strong>r:</strong> {r}
      </div>
      {entry ? (
        <>
          <div>
            <strong>type:</strong> {entry.type}
          </div>
          {entry.body && (
            <div>
              <strong>body:</strong> {entry.body}
            </div>
          )}
          {entry.type === "gravity" && entry.offset && (
            <div style={{ marginTop: 8 }}>
              <div>
                <strong>offset:</strong> [{entry.offset[0]}, {entry.offset[1]}]
              </div>
              <div>
                <strong>manual:</strong> {entry.manual ? "yes" : "no"}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Override:</strong>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    marginTop: 4,
                  }}
                >
                  {GRAVITY_DIRS.map(({ label, offset }) => (
                    <button
                      key={label}
                      onClick={() => setGravityOverride(selectedHex, offset)}
                      style={{
                        padding: "2px 8px",
                        background:
                          entry.offset![0] === offset[0] &&
                          entry.offset![1] === offset[1]
                            ? "#4488ff"
                            : "#333",
                        border: "1px solid #555",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {entry.weak && (
                <div style={{ color: "#ffaa44", marginTop: 4 }}>
                  ⚠ Weak gravity
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => eraseHex(selectedHex)}
            style={{ marginTop: 8, width: "100%" }}
          >
            Erase
          </button>
        </>
      ) : (
        <div style={{ color: "#888" }}>Empty space</div>
      )}
    </div>
  );
}

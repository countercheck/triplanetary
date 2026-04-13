import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapEditor } from "../hooks/useMapEditor";
import type { HexData } from "@triplanetary/shared";

const BLANK: HexData = {
  meta: { name: "New Map", version: "1.0", hexSize: 48, orientation: "pointy" },
  bodies: {},
  hexes: {},
  bases: {},
};

describe("useMapEditor", () => {
  it("initializes with select mode and no selection", () => {
    const { result } = renderHook(() => useMapEditor(BLANK));
    expect(result.current.mode).toBe("select");
    expect(result.current.selectedHex).toBeNull();
    expect(result.current.dirty).toBe(false);
  });

  it("setMode changes the current mode", () => {
    const { result } = renderHook(() => useMapEditor(BLANK));
    act(() => result.current.setMode("asteroid"));
    expect(result.current.mode).toBe("asteroid");
  });

  it("clicking a hex in select mode sets selectedHex", () => {
    const { result } = renderHook(() => useMapEditor(BLANK));
    act(() => result.current.handleHexClick(3, -2));
    expect(result.current.selectedHex).toBe("3,-2");
  });

  it("clicking a hex in erase mode resets it to space", () => {
    const initial: HexData = {
      ...BLANK,
      hexes: { "0,0": { type: "planet", body: "terra" } },
    };
    const { result } = renderHook(() => useMapEditor(initial));
    act(() => result.current.setMode("erase"));
    act(() => result.current.handleHexClick(0, 0));
    expect(result.current.hexData.hexes["0,0"]).toBeUndefined();
    expect(result.current.dirty).toBe(true);
  });

  it("erase mode does not mutate original HexData", () => {
    const initial: HexData = {
      ...BLANK,
      hexes: { "0,0": { type: "planet", body: "terra" } },
    };
    const { result } = renderHook(() => useMapEditor(initial));
    act(() => result.current.setMode("erase"));
    act(() => result.current.handleHexClick(0, 0));
    expect(initial.hexes["0,0"]?.type).toBe("planet");
  });

  it("asteroid mode marks hex as asteroid", () => {
    const { result } = renderHook(() => useMapEditor(BLANK));
    act(() => result.current.setMode("asteroid"));
    act(() => result.current.handleHexClick(5, -3));
    expect(result.current.hexData.hexes["5,-3"]).toMatchObject({
      type: "asteroid",
    });
    expect(result.current.dirty).toBe(true);
  });

  it("placeBody places a planet and auto-computes gravity", () => {
    const { result } = renderHook(() => useMapEditor(BLANK));
    act(() =>
      result.current.placeBody("terra", "0,4", {
        center: "0,4",
        radius: 1,
        gravityRings: 1,
      }),
    );
    expect(result.current.hexData.hexes["0,4"]).toMatchObject({
      type: "planet",
      body: "terra",
    });
    const gravHexes = Object.values(result.current.hexData.hexes).filter(
      (h) => h.type === "gravity",
    );
    expect(gravHexes.length).toBeGreaterThan(0);
    expect(result.current.dirty).toBe(true);
  });

  it("setGravityOverride marks a hex with manual:true", () => {
    const initial: HexData = {
      ...BLANK,
      hexes: {
        "0,3": {
          type: "gravity",
          body: "terra",
          offset: [0, 1],
          manual: false,
        },
      },
    };
    const { result } = renderHook(() => useMapEditor(initial));
    act(() => result.current.setGravityOverride("0,3", [-1, 0]));
    expect(result.current.hexData.hexes["0,3"]).toMatchObject({
      offset: [-1, 0],
      manual: true,
    });
  });

  it("resetDirty clears the dirty flag", () => {
    const { result } = renderHook(() => useMapEditor(BLANK));
    act(() => result.current.setMode("asteroid"));
    act(() => result.current.handleHexClick(0, 0));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.resetDirty());
    expect(result.current.dirty).toBe(false);
  });
});

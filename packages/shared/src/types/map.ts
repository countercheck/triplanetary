export type HexType = 'space' | 'gravity' | 'planet' | 'asteroid' | 'clandestine';

export interface HexEntry {
  type: HexType;
  body?: string;
  offset?: [number, number];
  manual?: boolean;
  weak?: boolean;
  coloredAsteroids?: string[];
}

export interface BodyEntry {
  center: string;
  radius?: number;
  gravityRings: number;
  weakGravity?: boolean;
  asteroidBase?: boolean;
}

export interface BaseEntry {
  hexSides: number[];
  asteroidBase?: boolean;
  torpedo?: boolean;
  secret?: boolean;
}

export interface HexData {
  meta: {
    name: string;
    version: string;
    hexSize: number;
    orientation: 'pointy' | 'flat';
  };
  bodies: Record<string, BodyEntry>;
  hexes: Record<string, HexEntry>;
  bases: Record<string, BaseEntry>;
}

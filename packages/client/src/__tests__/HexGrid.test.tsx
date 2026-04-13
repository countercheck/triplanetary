import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HexGrid } from '../components/map/HexGrid';
import type { HexData } from '@triplanetary/shared';

const emptyData: HexData = {
  meta: { name: 'Test', version: '1.0', hexSize: 48, orientation: 'pointy' },
  bodies: {},
  hexes: {},
  bases: {},
};

const dataWithPlanet: HexData = {
  ...emptyData,
  hexes: { '0,0': { type: 'planet', body: 'terra' } },
};

describe('HexGrid', () => {
  it('renders an SVG element', () => {
    const { container } = render(
      <HexGrid data={emptyData} qRange={[-1, 1]} rRange={[-1, 1]} onHexClick={() => {}} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders a polygon for each hex in the range', () => {
    // q: -1..1 (3), r: -1..1 (3) → 3*3 = 9 polygons
    const { container } = render(
      <HexGrid data={emptyData} qRange={[-1, 1]} rRange={[-1, 1]} onHexClick={() => {}} />,
    );
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(9);
  });

  it('calls onHexClick with the axial coordinate when a hex is clicked', async () => {
    const handler = vi.fn();
    const { container } = render(
      <HexGrid data={emptyData} qRange={[0, 0]} rRange={[0, 0]} onHexClick={handler} />,
    );
    const polygon = container.querySelector('polygon')!;
    await userEvent.click(polygon);
    expect(handler).toHaveBeenCalledWith(0, 0);
  });

  it('applies planet data-type to planet hexes', () => {
    const { container } = render(
      <HexGrid data={dataWithPlanet} qRange={[0, 0]} rRange={[0, 0]} onHexClick={() => {}} />,
    );
    const polygon = container.querySelector('polygon')!;
    expect(polygon.getAttribute('data-type')).toBe('planet');
  });
});

'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { MAP_CELLS, MAP_COLS, MAP_ROWS, MAP_TILE, fitViewBox, mapShade } from '@/lib/targeting/geo';
import type { Sel } from '@/lib/targeting/types';

/** Static SVG map (DS Q19): a tile map of the Indian states shaded by selection. Decorative; the list holds the logic. */
export function GeoMap({ regions }: { regions: Sel[] }) {
  const full: [number, number, number, number] = [0, 0, MAP_COLS * MAP_TILE, MAP_ROWS * MAP_TILE];
  const [box, setBox] = useState(full);
  const [satellite, setSatellite] = useState(false);
  const zoom = (f: number) =>
    setBox(([x, y, w, h]) => [x + (w - w * f) / 2, y + (h - h * f) / 2, w * f, h * f]);
  const fill = (shade: ReturnType<typeof mapShade>) =>
    shade === 'INCLUDE'
      ? '#188038'
      : shade === 'EXCLUDE'
        ? '#c5221f'
        : satellite
          ? '#5f6b5a'
          : '#e8eaed';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={() => setSatellite((s) => !s)}>
          {satellite ? 'Map' : 'Satellite'}
        </Button>
        <Button size="small" variant="outlined" aria-label="Zoom in" onClick={() => zoom(0.7)}>
          +
        </Button>
        <Button size="small" variant="outlined" aria-label="Zoom out" onClick={() => zoom(1.4)}>
          −
        </Button>
        <Button size="small" variant="outlined" onClick={() => setBox(fitViewBox(regions))}>
          Fit targeted locations
        </Button>
      </Box>
      <svg
        role="img"
        aria-label="Map of targeted locations"
        viewBox={box.join(' ')}
        style={{ width: '100%', maxHeight: 380, background: satellite ? '#2f3b2f' : '#f8f9fa' }}
      >
        {MAP_CELLS.map((c) => {
          const shade = mapShade(c.code, regions);
          return (
            <g key={c.code} data-testid={`map-${c.code}`} data-shade={shade}>
              <title>{c.label}</title>
              <rect
                x={c.x + 1}
                y={c.y + 1}
                width={MAP_TILE - 2}
                height={MAP_TILE - 2}
                rx={4}
                fill={fill(shade)}
                stroke="#9aa0a6"
                strokeWidth={0.5}
              />
              <text
                x={c.x + MAP_TILE / 2}
                y={c.y + MAP_TILE / 2 + 3}
                textAnchor="middle"
                fontSize={8}
                fill={shade === 'NONE' && !satellite ? '#3c4043' : '#fff'}
              >
                {c.code.slice(3)}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

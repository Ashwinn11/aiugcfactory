// Ready-made "format packs" — each seeds a layer set for a reusable content
// format. Pure data so the same editor serves different apps.

import { createTextLayer } from './textLayers.js';

export const LAYER_PACKS = [
  {
    id: 'symptom-checklist',
    name: 'Symptom checklist',
    build: () => [
      createTextLayer({
        text: '5 signs your\ngut is inflamed',
        xPct: 8, yPct: 9, widthPct: 84,
        fontSize: 108, style: 'normal', align: 'center',
      }),
      createTextLayer({
        text: 'bloating after\nevery meal',
        xPct: 12, yPct: 42, widthPct: 76,
        fontSize: 72, style: 'overlay', color: '#FE2C55', align: 'center',
      }),
    ],
  },
  {
    id: 'dish-name',
    name: 'Dish name',
    build: () => [
      createTextLayer({
        text: 'Miso Butter\nSalmon',
        xPct: 10, yPct: 64, widthPct: 80,
        fontSize: 120, style: 'normal', align: 'center',
      }),
    ],
  },
  {
    id: 'bold-headline',
    name: 'Bold headline',
    build: () => [
      createTextLayer({
        text: 'watch till\nthe end',
        xPct: 8, yPct: 10, widthPct: 84,
        fontSize: 128, style: 'overlay', color: '#ffffff', align: 'center',
      }),
    ],
  },
];

export function getPack(id) {
  return LAYER_PACKS.find((p) => p.id === id);
}

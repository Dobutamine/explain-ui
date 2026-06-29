<script setup lang="ts">
import { computed } from "vue";

// Tiny dependency-free trend line. Draws `points` (oldest → newest) as an SVG
// polyline auto-scaled to its own min/max. Stroke inherits `currentColor`, so
// the parent tints it. Renders nothing meaningful until there are ≥2 points.
const props = withDefaults(
  defineProps<{
    points: number[];
    width?: number;
    height?: number;
  }>(),
  { width: 96, height: 22 },
);

const PAD = 1; // keep the stroke off the edges

const path = computed(() => {
  const pts = props.points.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return "";
  let min = Math.min(...pts);
  let max = Math.max(...pts);
  if (max === min) {
    // flat series — draw a centred horizontal line
    min -= 1;
    max += 1;
  }
  const w = props.width;
  const h = props.height;
  const dx = (w - 2 * PAD) / (pts.length - 1);
  const sy = (h - 2 * PAD) / (max - min);
  return pts
    .map((v, i) => {
      const x = PAD + i * dx;
      const y = h - PAD - (v - min) * sy; // invert: higher value = higher up
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="block w-full"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      v-if="path"
      :d="path"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

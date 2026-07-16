// Categorical order and sequential ramp from the validated reference palette
// (dataviz skill, references/palette.md) — CSS custom properties defined in
// src/index.css for both themes, referenced here by role rather than by hex
// so light/dark swap automatically.

export const CHART_CATEGORICAL = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

export const CHART_CATEGORICAL_CAP = CHART_CATEGORICAL.length

export function categoricalColor(index: number): string {
  return CHART_CATEGORICAL[index % CHART_CATEGORICAL.length]
}

/** Sequential blue ramp, light -> dark, for magnitude encoding (the heatmap). */
export const CHART_SEQUENTIAL = ['var(--chart-seq-1)', 'var(--chart-seq-2)', 'var(--chart-seq-3)', 'var(--chart-seq-4)']

export function sequentialColor(percentage: number | null): string {
  if (percentage === null) return 'var(--muted)'
  if (percentage < 50) return CHART_SEQUENTIAL[0]
  if (percentage < 75) return CHART_SEQUENTIAL[1]
  if (percentage < 90) return CHART_SEQUENTIAL[2]
  return CHART_SEQUENTIAL[3]
}

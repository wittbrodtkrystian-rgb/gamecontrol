/** Lekki wykres obszarowy w SVG (bez zależności). */
export function AreaChart({ data, max, color = "#4da3ff", height = 90, unit = "" }: { data: number[]; max?: number; color?: string; height?: number; unit?: string }) {
  const w = 300, m = max ?? Math.max(1, ...data), pts = data.length > 1 ? data : [data[0] ?? 0, data[0] ?? 0];
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, height - (Math.min(v, m) / m) * (height - 6) - 3] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = `g${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label={`Wykres, ostatnia wartość ${data.at(-1) ?? 0}${unit}`}>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
export const Meter = ({ value, max, label }: { value: number; max: number; label: string }) => (
  <div><div className="mb-1 flex justify-between text-xs text-slate-400"><span>{label}</span><span>{Math.round((value / max) * 100)}%</span></div>
    <div className="h-2 rounded-full bg-panel"><div className="h-2 rounded-full bg-gradient-to-r from-neon to-violet" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>
);

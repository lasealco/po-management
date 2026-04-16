"use client";

type Leg = {
  legNo: number;
  originCode: string | null;
  destinationCode: string | null;
  plannedEtd: string | null;
  plannedEta: string | null;
  actualAtd: string | null;
  actualAta: string | null;
};

const KNOWN_LOCATIONS: Record<string, { lat: number; lon: number }> = {
  CNSZX: { lat: 22.55, lon: 114.1 },
  CNNGB: { lat: 29.87, lon: 121.55 },
  CNSHA: { lat: 31.23, lon: 121.47 },
  HKHKG: { lat: 22.31, lon: 113.92 },
  SGSIN: { lat: 1.26, lon: 103.84 },
  USLAX: { lat: 33.74, lon: -118.26 },
  USLGB: { lat: 33.76, lon: -118.19 },
  USNYC: { lat: 40.71, lon: -74.01 },
  USMKE: { lat: 43.04, lon: -87.91 },
  NLRTM: { lat: 51.95, lon: 4.14 },
  DEHAM: { lat: 53.55, lon: 9.99 },
};

function hashLocation(code: string): { lat: number; lon: number } {
  let h = 0;
  for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) | 0;
  const lon = ((h % 360) + 360) % 360 - 180;
  const lat = ((((h >> 8) % 120) + 120) % 120) - 60;
  return { lat, lon };
}

function loc(code: string | null | undefined) {
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  return KNOWN_LOCATIONS[c] ?? hashLocation(c);
}

function project(lat: number, lon: number, width: number, height: number) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

export function ControlTowerRouteMap({ legs }: { legs: Leg[] }) {
  if (!legs.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
        Add legs or booking origin/destination to render the route map.
      </div>
    );
  }

  const width = 880;
  const height = 320;
  const segments = legs
    .map((leg) => {
      const from = loc(leg.originCode);
      const to = loc(leg.destinationCode);
      if (!from || !to) return null;
      const a = project(from.lat, from.lon, width, height);
      const b = project(to.lat, to.lon, width, height);
      const completed = Boolean(leg.actualAta);
      const inProgress = !completed && Boolean(leg.actualAtd);
      return { leg, a, b, completed, inProgress };
    })
    .filter(Boolean) as Array<{
    leg: Leg;
    a: { x: number; y: number };
    b: { x: number; y: number };
    completed: boolean;
    inProgress: boolean;
  }>;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Route map (demo projection)</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full rounded border border-zinc-100 bg-sky-50/40">
        <rect x={0} y={0} width={width} height={height} fill="#f8fafc" />
        <g stroke="#d4d4d8" strokeWidth="1" opacity="0.6">
          <line x1={0} y1={height / 2} x2={width} y2={height / 2} />
          <line x1={width / 3} y1={0} x2={width / 3} y2={height} />
          <line x1={(2 * width) / 3} y1={0} x2={(2 * width) / 3} y2={height} />
        </g>
        {segments.map((s) => {
          const midX = (s.a.x + s.b.x) / 2;
          const arc = Math.max(24, Math.abs(s.a.x - s.b.x) * 0.12);
          const path = `M ${s.a.x} ${s.a.y} Q ${midX} ${Math.min(s.a.y, s.b.y) - arc} ${s.b.x} ${s.b.y}`;
          const color = s.completed ? "#15803d" : s.inProgress ? "#0369a1" : "#334155";
          return <path key={`leg-${s.leg.legNo}`} d={path} fill="none" stroke={color} strokeWidth="2.5" opacity="0.85" />;
        })}
        {segments.flatMap((s) => [
          <circle key={`o-${s.leg.legNo}`} cx={s.a.x} cy={s.a.y} r="4" fill="#0f172a" />,
          <circle key={`d-${s.leg.legNo}`} cx={s.b.x} cy={s.b.y} r="4" fill="#334155" />,
          <text key={`t-${s.leg.legNo}`} x={(s.a.x + s.b.x) / 2 + 4} y={(s.a.y + s.b.y) / 2 - 5} fontSize="10" fill="#334155">
            L{s.leg.legNo}
          </text>,
        ])}
      </svg>
      <p className="mt-2 text-[11px] text-zinc-500">
        Uses known UN/LOCODE coordinates where available; otherwise deterministic fallback coordinates for visual sequencing.
      </p>
    </div>
  );
}


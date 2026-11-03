import { useState } from 'react';

// Single-series column chart of fantasy points per week. Bye and missed weeks
// are labelled on the axis rather than drawn as zero-height bars.

const WIDTH = 340;
const HEIGHT = 150;
const PAD = { top: 18, right: 6, bottom: 22, left: 28 };
const BAR_MAX = 18;

// Round up to a multiple of 10 so the midpoint tick is a whole number.
function niceMax(v) {
  return Math.max(10, Math.ceil(v / 10) * 10);
}

export default function WeeklyChart({ weeks, lastWeek, bye, scoring }) {
  const [active, setActive] = useState(null);
  const byWeek = new Map(weeks.map((w) => [w.week, w.stats[`pts_${scoring}`] ?? 0]));
  const maxWeek = Math.max(lastWeek ?? 0, ...weeks.map((w) => w.week), 1);
  const slots = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const yMax = niceMax(Math.max(0, ...byWeek.values()));

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / slots.length;
  const barW = Math.min(BAR_MAX, band - 2);
  const x = (week) => PAD.left + band * (week - 1) + (band - barW) / 2;
  const y = (v) => PAD.top + plotH - (v / yMax) * plotH;
  const ticks = [0, yMax / 2, yMax];

  const activePts = active != null ? byWeek.get(active) : null;

  return (
    <figure className="weekly-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Fantasy points by week">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        {slots.map((week) => {
          const pts = byWeek.get(week);
          const label = week === bye ? 'BYE' : week;
          const h = pts != null ? Math.max(0, y(0) - y(pts)) : 0;
          const r = Math.min(4, h, barW / 2);
          const bx = x(week);
          const top = y(0) - h;
          return (
            <g
              key={week}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(week)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
              onClick={() => setActive(week)}
            >
              {/* Hit target spans the full band so thin bars are easy to tap. */}
              <rect x={PAD.left + band * (week - 1)} y={PAD.top} width={band} height={plotH} fill="transparent" />
              {pts != null && h > 0 && (
                <path
                  className={`bar ${active === week ? 'active' : ''}`}
                  d={`M${bx},${y(0)} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + barW - r} Q${bx + barW},${top} ${bx + barW},${top + r} V${y(0)} Z`}
                />
              )}
              <text
                x={bx + barW / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                className={`axis ${week === bye ? 'bye' : ''}`}
              >
                {label}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="baseline" />
      </svg>
      <figcaption className="chart-readout">
        {active == null
          ? 'Tap a week for details'
          : active === bye
            ? `Week ${active}: bye`
            : activePts == null
              ? `Week ${active}: did not play`
              : `Week ${active}: ${activePts.toFixed(1)} pts`}
      </figcaption>
    </figure>
  );
}

import React, { useState, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnalyticsCard } from './layout/EnterpriseLibrary';

export const Sparkline = memo(({ data, color = '#D4A017', width = 100, height = 36 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────
// SVG Bar Chart — Dynamic borrow trend (7D, 30D, 90D)
// ─────────────────────────────────────────────────────────────
export const BorrowTrendChart = memo(({ labels, issues, returns }) => {
  const W = 560, H = 160, PADDING = { top: 10, bottom: 28, left: 24, right: 10 };
  const innerW = W - PADDING.left - PADDING.right;
  const innerH = H - PADDING.top - PADDING.bottom;
  const n = labels.length;
  if (n === 0) return <p style={{ color: 'var(--ink-soft)', textAlign: 'center' }}>No data yet.</p>;

  const totalActivity = issues.reduce((a, b) => a + b, 0) + returns.reduce((a, b) => a + b, 0);

  // Set Y-axis scale ceiling. If there is no activity, Y-axis max is 5.
  const rawMax = Math.max(...issues, ...returns, 0);
  const maxVal = totalActivity === 0 ? 5 : rawMax === 0 ? 5 : Math.ceil(rawMax * 1.1);

  const barGroupW = innerW / n;
  const barW = Math.max(1.5, barGroupW * 0.4);

  // Dynamic axis label step sizing:
  // 7D: show every daily label (step = 1)
  // 30D: show weekly ticks (step = 5)
  // 90D: show bi-weekly/monthly ticks (step = 15)
  const labelStep = n <= 7 ? 1 : n <= 30 ? 5 : 15;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible', transition: 'all 0.3s ease' }}>
        <defs>
          <linearGradient id="issueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4A017" />
            <stop offset="100%" stopColor="#b3861b" />
          </linearGradient>
          <linearGradient id="returnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        {/* Grid Lines (Horizontal & Vertical forming squares) */}
        {/* Vertical grid lines */}
        {labels.map((_, i) => {
          const x = PADDING.left + i * barGroupW + barGroupW / 2;
          return (
            <line
              key={`vgrid-${i}`}
              x1={x}
              y1={PADDING.top}
              x2={x}
              y2={PADDING.top + innerH}
              stroke="#F2F2F2"
              strokeWidth="1"
              opacity="0.8"
            />
          );
        })}

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = PADDING.top + innerH * (1 - ratio);
          return (
            <line
              key={`hgrid-${i}`}
              x1={PADDING.left}
              x2={W - PADDING.right}
              y1={y}
              y2={y}
              stroke="#F2F2F2"
              strokeWidth="1"
              opacity="0.8"
            />
          );
        })}

        {/* Y-Axis Label Ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = PADDING.top + innerH * (1 - ratio);
          const tickValue = Math.round(maxVal * ratio);
          return (
            <text
              key={`ytick-${i}`}
              x={PADDING.left - 6}
              y={y + 3}
              fontSize="8"
              fill="#9ca3af"
              textAnchor="end"
              fontWeight="bold"
            >
              {tickValue}
            </text>
          );
        })}

        {/* Axis Baselines */}
        {/* Left Y Axis */}
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={PADDING.top + innerH} stroke="#E2D3B3" strokeWidth="1.5" opacity="0.6" />
        {/* Bottom X Axis */}
        <line x1={PADDING.left} y1={PADDING.top + innerH} x2={W - PADDING.right} y2={PADDING.top + innerH} stroke="#E2D3B3" strokeWidth="1.5" opacity="0.6" />

        {/* Bars (Rendered only when totalActivity > 0) */}
        {totalActivity > 0 && labels.map((label, i) => {
          const issueH = (issues[i] / maxVal) * innerH;
          const returnH = (returns[i] / maxVal) * innerH;
          const centerX = PADDING.left + i * barGroupW + barGroupW / 2;

          return (
            <g key={`bars-${label}`} style={{ transition: 'all 0.3s ease' }}>
              {/* Issue bar */}
              {issues[i] > 0 && (
                <rect
                  x={centerX - barW - 0.5}
                  y={PADDING.top + innerH - issueH}
                  width={barW} height={issueH}
                  fill="url(#issueGrad)" rx="1.5"
                  style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
                />
              )}
              {/* Return bar */}
              {returns[i] > 0 && (
                <rect
                  x={centerX + 0.5}
                  y={PADDING.top + innerH - returnH}
                  width={barW} height={returnH}
                  fill="url(#returnGrad)" rx="1.5"
                  style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
                />
              )}
            </g>
          );
        })}

        {/* X-Axis labels */}
        {labels.map((label, i) => {
          const centerX = PADDING.left + i * barGroupW + barGroupW / 2;
          const showLabel = i === 0 || i === n - 1 || (i % labelStep === 0);
          return showLabel ? (
            <text
              key={`xlabel-${label}`}
              x={centerX}
              y={H - 4}
              textAnchor="middle"
              fontSize="8"
              fill="#9ca3af"
              fontWeight="bold"
            >
              {label.slice(5)} {/* MM-DD */}
            </text>
          ) : null;
        })}
      </svg>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// BorrowActivityHeatmap — 90-day GitHub-style contribution grid
// ─────────────────────────────────────────────────────────────
export const BorrowActivityHeatmap = memo(({ trend }) => {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Map backend trend to resolve issues/returns by date YYYY-MM-DD
  const dataMap = useMemo(() => {
    const mapping = {};
    if (trend && trend.labels) {
      trend.labels.forEach((lbl, idx) => {
        mapping[lbl] = {
          issues: trend.issues[idx] || 0,
          returns: trend.returns[idx] || 0
        };
      });
    }
    return mapping;
  }, [trend]);

  // Construct a grid containing exactly 91 days (7 rows by 13 columns)
  // aligned to day-of-week rows to match GitHub Contributions exactly.
  const { grid, monthsHeader, totalActivity } = useMemo(() => {
    const today = new Date();
    const gridDays = 91; // 13 weeks * 7 days

    // Find the starting date (90 days before today, adjusted to align with week day bounds)
    const startDate = new Date(today.getTime() - (gridDays - 1) * 86400000);

    let sumVal = 0;
    const cellsList = [];
    const monthsSeen = [];

    for (let i = 0; i < gridDays; i++) {
      const d = new Date(startDate.getTime() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dbVal = dataMap[dateStr] || { issues: 0, returns: 0 };

      sumVal += dbVal.issues + dbVal.returns;

      cellsList.push({
        date: dateStr,
        issues: dbVal.issues,
        returns: dbVal.returns,
        dayOfWeek: d.getDay(),
        monthLabel: d.toLocaleDateString('en-US', { month: 'short' }),
        colIndex: Math.floor(i / 7)
      });

      // Keep track of which column index starts a month for headers alignment
      if (d.getDate() === 1 || i === 0) {
        monthsSeen.push({
          label: d.toLocaleDateString('en-US', { month: 'short' }),
          colIndex: Math.floor(i / 7)
        });
      }
    }

    // Organize cells list into 7 rows (rows 0-6 for Sun-Sat)
    const rows = Array.from({ length: 7 }, () => []);
    cellsList.forEach((cell) => {
      rows[cell.dayOfWeek].push(cell);
    });

    return { grid: rows, monthsHeader: monthsSeen, totalActivity: sumVal };
  }, [dataMap]);

  const handleMouseMove = (e, cell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.offsetParent.getBoundingClientRect();
    setHoveredCell(cell);
    setTooltipPos({
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top - 54
    });
  };

  return (
    <div className="info-card" style={{ width: 'fit-content', minHeight: 'auto', position: 'relative', padding: '1.5rem', margin: '0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      
      {/* ── Header ── */}
      <div className="card-header-clean" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', width: '100%', gap: '2rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Borrow Activity Heatmap</h4>
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', fontWeight: '600' }}>Last 90 Days • LIVE Data</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', fontWeight: '700', color: 'var(--ink-soft)' }}>
          <span>Less Activity</span>
          <span style={{ width: '20px', height: '20px', background: '#f8fafc', border: '1.5px solid rgba(226,211,179,0.3)', borderRadius: '3px' }} />
          <span style={{ width: '20px', height: '20px', background: '#fef3c7', borderRadius: '3px' }} />
          <span style={{ width: '20px', height: '20px', background: '#fcd34d', borderRadius: '3px' }} />
          <span style={{ width: '20px', height: '20px', background: '#d97706', borderRadius: '3px' }} />
          <span>More Activity</span>
        </div>
      </div>

      {/* ── Heatmap Grid Container ── */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'start', justifyContent: 'flex-start' }}>
        
        {/* Day labels (Mon, Wed, Fri aligned vertically) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.76rem', color: '#9ca3af', paddingTop: '25px', fontWeight: '700' }}>
          <div style={{ height: '20px', lineHeight: '20px', visibility: 'hidden' }}>Sun</div>
          <div style={{ height: '20px', lineHeight: '20px' }}>Mon</div>
          <div style={{ height: '20px', lineHeight: '20px', visibility: 'hidden' }}>Tue</div>
          <div style={{ height: '20px', lineHeight: '20px' }}>Wed</div>
          <div style={{ height: '20px', lineHeight: '20px', visibility: 'hidden' }}>Thu</div>
          <div style={{ height: '20px', lineHeight: '20px' }}>Fri</div>
          <div style={{ height: '20px', lineHeight: '20px', visibility: 'hidden' }}>Sat</div>
        </div>

        {/* Months headers + grid rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          
          {/* Months Headers Row */}
          <div style={{ display: 'flex', height: '20px', position: 'relative', fontSize: '0.76rem', color: '#9ca3af', fontWeight: '700', marginBottom: '2px' }}>
            {monthsHeader.map((m, idx) => (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${m.colIndex * 25}px`,
                  whiteSpace: 'nowrap'
                }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid Layout Rows (7 rows, 13 weeks) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {grid.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', gap: '5px' }}>
                {row.map((cell, colIdx) => {
                  let bg = '#f8fafc';
                  const val = cell.issues;
                  if (val > 0) {
                    if (val === 1) bg = '#fef3c7';
                    else if (val <= 3) bg = '#fcd34d';
                    else bg = '#d97706';
                  }
                  return (
                    <div
                      key={colIdx}
                      onMouseEnter={(e) => handleMouseMove(e, cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        width: '20px',
                        height: '20px',
                        background: bg,
                        borderRadius: '3px',
                        border: '1.5px solid rgba(226,211,179,0.2)',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, background-color 0.2s ease'
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* ── Tooltip popup overlay ── */}
      {hoveredCell && (
        <div style={{
          position: 'absolute',
          left: `${tooltipPos.x}px`,
          top: `${tooltipPos.y}px`,
          transform: 'translateX(-50%)',
          background: '#1e1b15',
          color: '#fff',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: '700',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          animation: 'fadeIn 0.1s ease-out',
          border: '1px solid rgba(212,160,23,0.3)'
        }}>
          <div style={{ color: '#D4A017', marginBottom: '2px' }}>{hoveredCell.date}</div>
          <div>Issued: {hoveredCell.issues} · Returned: {hoveredCell.returns}</div>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// SVG Donut chart
// ─────────────────────────────────────────────────────────────
export const COLORS = ['#D4A017', '#3b82f6', '#16a34a', '#ea580c', '#8b5cf6', '#ec4899', '#0ea5e9', '#f59e0b'];

export const DonutChart = memo(({ slices }) => {
  if (!slices || slices.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '128px', width: '100%', color: 'var(--ink-soft)', fontSize: '0.82rem', fontWeight: '600' }}>
        No category data available.
      </div>
    );
  }
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '128px', width: '100%', color: 'var(--ink-soft)', fontSize: '0.82rem', fontWeight: '600' }}>
        No category data available.
      </div>
    );
  }

  const R = 54, cx = 64, cy = 64, stroke = 20;
  let offset = 0;
  const circumference = 2 * Math.PI * R;

  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f5f5f5" strokeWidth={stroke} />
      {slices.map((slice, i) => {
        const pct = slice.value / total;
        const dashLen = pct * circumference;
        const dashOff = circumference - dashLen;
        const rotateAngle = offset * 360 - 90;
        offset += pct;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={stroke}
            strokeDasharray={`${dashLen} ${dashOff}`}
            strokeLinecap="butt"
            style={{ transform: `rotate(${rotateAngle}deg)`, transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="bold" fill="#1e1b15">
        {slices.length}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#9ca3af">
        genres
      </text>
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────
// Horizontal bar — popular books
// ─────────────────────────────────────────────────────────────
export const HBar = memo(({ label, value, max, color = '#D4A017', rank }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.7rem' }}>
      <span style={{
        width: '20px', height: '20px', borderRadius: '50%',
        background: rank <= 3 ? '#D4A017' : '#f1f5f9',
        color: rank <= 3 ? '#fff' : '#5c5549',
        fontSize: '0.7rem', fontWeight: '800',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#1e1b15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{label}</span>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#5c5549' }}>{value}×</span>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// KPI stat card using AnalyticsCard component
// ─────────────────────────────────────────────────────────────
export const KpiCard = memo(({ label, value, sub, theme, sparkData, trendUp, to }) => {
  const navigate = useNavigate();
  const themeMap = {
    gold: '#D4A017',
    green: '#16a34a',
    blue: '#3b82f6',
    red: '#dc2626',
    purple: '#8b5cf6',
  };
  const color = themeMap[theme] || themeMap.gold;

  const sparklineEl = sparkData && sparkData.length > 1 && (
    <div style={{ marginTop: '0.5rem' }}>
      <Sparkline data={sparkData} color={color} width={120} height={30} />
    </div>
  );

  return (
    <AnalyticsCard
      title={label}
      value={value}
      subtitle={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span>{sub}</span>
          {sparklineEl}
        </div>
      }
      trend={trendUp !== undefined ? (trendUp ? 'Positive' : 'Warning') : undefined}
      trendUp={trendUp}
      onClick={to ? () => navigate(to) : undefined}
    />
  );
});

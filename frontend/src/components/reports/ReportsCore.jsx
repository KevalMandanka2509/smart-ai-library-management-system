import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie } from 'recharts';

export const COLORS = ['#D4A017', '#1e293b', '#16a34a', '#ea580c', '#dc2626', '#3b82f6', '#64748b', '#fcd34d'];

// Reusable Empty State
export const EmptyState = ({ message = "No data available in this period", icon = "✓" }) => (
  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '120px' }}>
    <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: '#94a3b8' }}>{icon}</div>
    <div style={{ fontSize: '0.85rem' }}>{message}</div>
  </div>
);

// Reusable Card
export const SectionCard = ({ title, children, style = {}, action }) => (
  <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', ...style }}>
    {(title || action) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem', fontWeight: 600 }}>{title}</h3>
        {action && <div>{action}</div>}
      </div>
    )}
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

export const KpiCard = ({ title, data, color = '#1e293b', prefix = '', suffix = '' }) => {
  const val = data?.value ?? 0;
  const trend = data?.trend ?? 0;
  return (
    <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '105px' }}>
      <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>{title}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, color: color, fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>{prefix}{val.toLocaleString()}{suffix}</h2>
        {trend !== 0 && (
          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: trend > 0 ? '#dcfce7' : '#fee2e2', color: trend > 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
};

// Main KPI Section
export const ExecutiveKPIs = ({ data }) => {
  if (!data) return <EmptyState message="Loading KPIs..." />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
      <KpiCard title="Total Books" data={data.total_books} />
      <KpiCard title="Total Members" data={data.total_members} />
      <KpiCard title="Total Issues" data={data.total_issues} />
      <KpiCard title="Total Returns" data={data.total_returns} />
      <KpiCard title="Overdue Books" data={data.overdue_books} color="#ea580c" />
      <KpiCard title="Fines Generated" data={data.fines_generated} prefix="₹" color="#dc2626" />
      <KpiCard title="Fines Collected" data={data.fines_collected} prefix="₹" color="#16a34a" />
      <KpiCard title="Collection Rate" data={data.collection_rate} suffix="%" />
      <KpiCard title="Available Books" data={data.available_books} color="#3b82f6" />
      <KpiCard title="Reserved Books" data={data.reserved_books} color="#3b82f6" />
    </div>
  );
};

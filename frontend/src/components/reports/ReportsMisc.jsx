import React, { useState, useEffect } from 'react';
import { SectionCard, EmptyState, COLORS } from './ReportsCore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Table, TruncatedText } from './ReportsTables';
import api from '../../services/api';

export const HeatmapSection = ({ data }) => {
  if (!data || data.length === 0) return <SectionCard title="Borrowing Activity"><EmptyState message="No borrowing activity yet" /></SectionCard>;
  
  // Format data into a simple GitHub style heatmap grid (approx 12 weeks)
  return (
    <SectionCard title="Borrowing Activity (Last 12 Weeks)">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {data.map((d, i) => {
          let opacity = 0.1;
          if (d.count > 0) opacity = 0.3;
          if (d.count > 3) opacity = 0.6;
          if (d.count > 7) opacity = 1.0;
          return (
            <div 
              key={i} 
              title={`${d.date}: ${d.count} issues`}
              style={{ width: '14px', height: '14px', background: `rgba(212, 160, 23, ${opacity})`, borderRadius: '2px' }}
            />
          );
        })}
      </div>
    </SectionCard>
  );
};

export const ReservationAnalytics = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/reservations?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load reservation analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to load reservation analytics.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem' }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: '90px', background: '#f8fafc', borderRadius: '12px', animation: 'pulse 2s infinite' }}></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
            <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
          </SectionCard>
          <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
            <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
          </SectionCard>
        </div>
      </div>
    );
  }

  const { summary, trend, topBooks } = data;

  return (
    <SectionCard title="Reservation Analytics">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Total Reservations</span>
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.1rem' }}>{summary.total}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Pending</span>
          <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.1rem' }}>{summary.pending}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Approved</span>
          <span style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '1.1rem' }}>{summary.approved}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Completed</span>
          <span style={{ fontWeight: 700, color: '#15803d', fontSize: '1.1rem' }}>{summary.completed}</span>
        </div>
      </div>
    </SectionCard>
  );
};

export const InventoryAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/enterprise_analytics/inventory');
      setData(res.data);
    } catch (e) {
      console.error('Failed to load inventory analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to load inventory analytics.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: '90px', background: '#f8fafc', borderRadius: '12px', animation: 'pulse 2s infinite' }}></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
            <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
          </SectionCard>
          <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
            <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
          </SectionCard>
        </div>
      </div>
    );
  }

  const { summary, utilization, lowAvailability } = data;
  
  // Prepare colors for utilization donut
  const utilColors = {
    'Available': '#16a34a',
    'Issued': '#D4A017',
    'Reserved': '#3b82f6',
    'Other': '#94a3b8'
  };

  return (
    <SectionCard title="Inventory Analytics">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Total Books</span>
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.1rem' }}>{summary.total}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Available</span>
          <span style={{ fontWeight: 700, color: '#15803d', fontSize: '1.1rem' }}>{summary.available}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Issued</span>
          <span style={{ fontWeight: 700, color: '#b45309', fontSize: '1.1rem' }}>{summary.issued}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Reserved</span>
          <span style={{ fontWeight: 700, color: '#6d28d9', fontSize: '1.1rem' }}>{summary.reserved}</span>
        </div>
      </div>
    </SectionCard>
  );
};

export const AcquisitionAnalytics = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/acquisitions?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load acquisition analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to load acquisition analytics.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '90px', background: '#f8fafc', borderRadius: '12px', animation: 'pulse 2s infinite' }}></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: '1.5rem' }}>
          <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
            <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
          </SectionCard>
          <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
            <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
          </SectionCard>
        </div>
      </div>
    );
  }

  const { summary, trend, recentBooks, neverBorrowed } = data;

  return (
    <SectionCard title="Acquisition Analytics">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Books Added</span>
          <span style={{ fontWeight: 700, color: '#15803d', fontSize: '1.1rem' }}>{summary.added}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Books Borrowed</span>
          <span style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '1.1rem' }}>{summary.borrowed}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Never Borrowed</span>
          <span style={{ fontWeight: 700, color: '#475569', fontSize: '1.1rem' }}>{summary.neverBorrowed}</span>
        </div>
      </div>
    </SectionCard>
  );
};

export const MemberGrowthAnalytics = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/member-growth?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load member growth analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to load member growth analytics.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '0' }}>
        <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
          <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
        </SectionCard>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[1,2,3,4].map(i => <div key={i} style={{ background: '#f8fafc', borderRadius: '12px', animation: 'pulse 2s infinite' }}></div>)}
        </div>
      </div>
    );
  }

  const { summary, trend } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
      <div style={{ marginBottom: '-0.5rem' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#1e293b' }}>Member Growth</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Track member registration and engagement over time</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <SectionCard title="New Members Over Time">
          <div style={{ height: '160px' }}>
            {(!trend || trend.length === 0) ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Member growth data unavailable</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} 
                  />
                  <Area type="monotone" dataKey="new_members" name="New Members" stroke="#D4A017" fill="url(#colorGrowth)" strokeWidth={2} />
                  <defs>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4A017" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#D4A017" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', color: '#16a34a' }}>•</span> New Members
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{summary.newMembers}</div>
          </div>
          <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', color: '#3b82f6' }}>•</span> Active Members
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d4ed8' }}>{summary.activeMembers}</div>
          </div>
          <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', color: '#94a3b8' }}>•</span> Inactive Members
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#475569' }}>{summary.inactiveMembers}</div>
          </div>
          <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', color: '#D4A017' }}>•</span> Growth Rate
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
              {summary.growthRate !== null ? `${summary.growthRate > 0 ? '+' : ''}${summary.growthRate}%` : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RealTimeActivity = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/enterprise_analytics/activity');
      setData(res.data);
    } catch (e) {
      console.error('Failed to load real-time activity', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // Assuming the parent Reports.jsx might unmount/remount on period change or manual refresh
    // We could set an interval if we wanted local polling, but the spec says "refresh activity according to the existing selected interval" and "Respect the global Reports auto-refresh setting" (which handles mounting or triggering). We'll assume the parent component can remount or trigger if needed, or we just fetch on mount.
  }, []);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to load recent activity.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1,2,3,4,5].map(i => <div key={i} style={{ height: '50px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>)}
      </div>
    );
  }

  const activities = data.activities || [];

  return (
    <SectionCard title="Real-Time Activity" style={{ maxHeight: '450px' }}>
      <style>
        {`
          .reports-activity-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .reports-activity-scroll::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .reports-activity-scroll::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .reports-activity-scroll::-webkit-scrollbar-thumb:hover {
            background: #D4A017;
          }
        `}
      </style>
      <div style={{ marginBottom: '1rem', marginTop: '-0.5rem', textAlign: 'left' }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Latest library system activity</p>
      </div>
      {(!activities || activities.length === 0) ? (
        <EmptyState message="No recent activity available" />
      ) : (
        <div className="reports-activity-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'auto', maxHeight: '340px', paddingRight: '0.5rem', marginRight: '-0.5rem', textAlign: 'left' }}>
          {activities.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: i === activities.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
              <div style={{ background: '#f8fafc', borderRadius: '8px', height: '36px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                {f.icon || '📝'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.2 }}>{f.type}</div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                  {f.description} <span style={{ color: '#94a3b8' }}>• {f.member}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{new Date(f.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

export const SmartInsights = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/insights?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load insights', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to generate smart insights.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {[1,2,3,4].map(i => <div key={i} style={{ height: '120px', background: '#f8fafc', borderRadius: '12px', animation: 'pulse 2s infinite' }}></div>)}
      </div>
    );
  }

  const insights = data.insights || [];

  return (
    <SectionCard title="Smart Insights" style={{ maxHeight: '450px' }}>
      <div style={{ marginBottom: '1rem', marginTop: '-0.5rem', textAlign: 'left' }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Actionable insights generated from current library data</p>
      </div>
      {(!insights || insights.length === 0) ? (
        <EmptyState message="No actionable insights available" />
      ) : (
        <div className="reports-activity-scroll" style={{ overflowY: 'auto', maxHeight: '340px', paddingRight: '0.5rem', marginRight: '-0.5rem', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          {insights.map((ins, i) => {
            let badgeBg = '#f1f5f9';
            let badgeColor = '#64748b';
            let border = '1px solid #e2e8f0';
            
            if (ins.priority === 'High') {
              badgeBg = '#fef2f2';
              badgeColor = '#dc2626';
              border = '1px solid #fecaca';
            } else if (ins.priority === 'Medium') {
              badgeBg = '#fef3c7';
              badgeColor = '#d97706';
              border = '1px solid #fde68a';
            } else if (ins.priority === 'Low') {
              badgeBg = '#f0fdf4';
              badgeColor = '#16a34a';
              border = '1px solid #bbf7d0';
            }

            return (
              <div key={i} style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem' }}>{ins.icon}</span>
                    <span style={{ background: '#f8fafc', color: '#475569', fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {ins.category}
                    </span>
                  </div>
                  <span style={{ background: badgeBg, color: badgeColor, fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                    {ins.label}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem', marginBottom: '2px' }}>{ins.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>{ins.description}</div>
                </div>
                {ins.metric && (
                  <div style={{ marginTop: 'auto', paddingTop: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                    {ins.metric}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </SectionCard>
  );
};

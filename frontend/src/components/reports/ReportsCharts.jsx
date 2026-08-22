import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { SectionCard, EmptyState, COLORS } from './ReportsCore';
import api from '../../services/api';
import { Activity } from 'lucide-react';

// Circulation Section
export const CirculationSection = ({ data: initialData, globalPeriod }) => {
  const [granularity, setGranularity] = useState(''); // empty string means default for the global period
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleGranularity = async (newGran) => {
    setGranularity(newGran);
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/circulation?period=${globalPeriod}&granularity=${newGran}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
      setError(true);
    }
    setLoading(false);
  };

  const renderContent = () => {
    if (error) {
      return (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#64748b' }}>
          <p>Unable to load circulation analytics.</p>
          <button onClick={() => handleGranularity(granularity)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>Retry</button>
        </div>
      );
    }

    if (loading) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '16px', height: '300px' }}>
          <div style={{ background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
          <div style={{ background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
        </div>
      );
    }

    if (!data?.trend || data.trend.length === 0) {
      return (
        <div style={{ height: '120px' }}>
          <EmptyState message="No circulation activity in the selected period" icon={<Activity size={24} />} />
        </div>
      );
    }

    const { summary } = data;
    const returnRate = summary.total_issues > 0 ? Math.round((summary.total_returns / summary.total_issues) * 100) : 0;

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
      if (!active || !payload || payload.length === 0) return null;
      return (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '6px', fontSize: '0.8rem' }}>{label}</div>
          {payload.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, flexShrink: 0 }}></div>
              <span style={{ color: '#64748b', minWidth: '55px' }}>{entry.name}</span>
              <span style={{ fontWeight: 600, color: '#1e293b', marginLeft: 'auto' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    };

    // Summary row helper
    const SummaryRow = ({ label, value, color = '#1e293b', isLast = false }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{label}</span>
        <span style={{ fontWeight: 600, color, fontSize: '0.9rem' }}>{value}</span>
      </div>
    );

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '16px', alignItems: 'stretch' }}>
        {/* Chart */}
        <div style={{ height: '320px', padding: '0.75rem 0.75rem 0.5rem', border: '1px solid #f1f5f9', borderRadius: '8px', background: 'white' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend} margin={{ top: 8, right: 12, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="period" 
                stroke="#94a3b8" 
                fontSize={10} 
                tickLine={false} 
                axisLine={{ stroke: '#e2e8f0' }} 
                tickMargin={8} 
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                domain={[0, 'auto']} 
                allowDecimals={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={32} 
                iconType="circle" 
                iconSize={8}
                wrapperStyle={{ fontSize: '0.8rem', paddingBottom: '4px' }} 
              />
              <Line type="monotone" dataKey="issues" name="Issues" stroke="#D4A017" strokeWidth={2.5} dot={{ r: 3, fill: '#D4A017', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#D4A017', fill: 'white' }} />
              <Line type="monotone" dataKey="returns" name="Returns" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#16a34a', fill: 'white' }} />
              <Line type="monotone" dataKey="overdue" name="Overdue" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3, fill: '#dc2626', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#dc2626', fill: 'white' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Circulation Summary</div>
          <SummaryRow label="Total Issues" value={summary.total_issues} color="#D4A017" />
          <SummaryRow label="Total Returns" value={summary.total_returns} color="#16a34a" />
          <SummaryRow label="Total Overdue" value={summary.total_overdue} color="#dc2626" />
          <SummaryRow label="Return Rate" value={`${returnRate}%`} color="#16a34a" />
          <SummaryRow label="Issue Growth" value={summary.issue_growth !== null ? `${summary.issue_growth > 0 ? '+' : ''}${summary.issue_growth}%` : '—'} color={summary.issue_growth > 0 ? '#16a34a' : summary.issue_growth < 0 ? '#dc2626' : '#475569'} />
          <SummaryRow label="Return Growth" value={summary.return_growth !== null ? `${summary.return_growth > 0 ? '+' : ''}${summary.return_growth}%` : '—'} color={summary.return_growth > 0 ? '#16a34a' : summary.return_growth < 0 ? '#dc2626' : '#475569'} />
          <SummaryRow label="Peak Day" value={summary.peak_day || '—'} color="#475569" />
          <SummaryRow label="Peak Hour" value={summary.peak_hour || '—'} color="#475569" isLast />
        </div>
      </div>
    );
  };

  return (
    <SectionCard style={{ marginBottom: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', color: '#1e293b', fontWeight: 600 }}>Circulation Analytics</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>Issues, returns and overdue tracking</p>
        </div>
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map(g => (
            <button 
              key={g}
              onClick={() => handleGranularity(g)}
              style={{
                padding: '4px 10px',
                border: 'none',
                background: granularity === g ? '#D4A017' : 'transparent',
                color: granularity === g ? 'white' : '#64748b',
                fontWeight: granularity === g ? 600 : 500,
                fontSize: '0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s'
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      {renderContent()}
    </SectionCard>
  );
};

export const CategorySection = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/categories?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load category analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  if (error) {
    return (
      <>
        <SectionCard title="Category Distribution">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#64748b' }}>
            <p style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>Unable to load category analytics.</p>
            <button onClick={loadData} style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}>Retry</button>
          </div>
        </SectionCard>
        <SectionCard title="Category Borrowing">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#64748b', fontSize: '0.85rem' }}>
            Unable to load data.
          </div>
        </SectionCard>
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        {[1, 2].map(i => (
          <SectionCard key={i} title={<div style={{ background: '#e2e8f0', height: '16px', width: '130px', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>}>
            <div style={{ height: '200px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
          </SectionCard>
        ))}
      </>
    );
  }

  // Custom donut tooltip
  const DonutTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '0.8rem' }}>
        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{d.category}</div>
        <div style={{ color: '#64748b' }}>{d.count} books ({d.percentage || 0}%)</div>
      </div>
    );
  };

  // Custom bar tooltip
  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '0.8rem' }}>
        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#D4A017' }}></div>
          <span style={{ color: '#64748b' }}>Issues:</span>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{payload[0].value}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. Category Distribution (Donut + Side Legend) */}
      <SectionCard title="Category Distribution">
        {(!data.distribution || data.distribution.length === 0) ? (
          <EmptyState message="No category data available" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '200px' }}>
            {/* Donut Chart */}
            <div style={{ position: 'relative', width: '55%', height: '200px', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 1 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{data.total_books}</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={data.distribution} 
                    dataKey="count" 
                    nameKey="category" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={50} 
                    outerRadius={75} 
                    stroke="none" 
                    paddingAngle={2}
                  >
                    {data.distribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Side Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflow: 'hidden' }}>
              {data.distribution.slice(0, 6).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: COLORS[i % COLORS.length], flexShrink: 0 }}></div>
                  <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.category}</span>
                  <span style={{ color: '#1e293b', fontWeight: 600, flexShrink: 0 }}>{item.count}</span>
                  <span style={{ color: '#94a3b8', flexShrink: 0, fontSize: '0.7rem' }}>{item.percentage || 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* 2. Category Borrowing (Bar) */}
      <SectionCard title="Category Borrowing">
        {(!data.borrowing || data.borrowing.length === 0) ? (
          <EmptyState message="No borrowing in this period" />
        ) : (
          <div style={{ height: '210px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.borrowing} margin={{ top: 8, right: 8, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="category" 
                  stroke="#94a3b8" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={{ stroke: '#e2e8f0' }} 
                  tickMargin={6}
                  interval={0}
                  angle={data.borrowing.length > 4 ? -20 : 0}
                  textAnchor={data.borrowing.length > 4 ? 'end' : 'middle'}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  allowDecimals={false}
                  domain={[0, 'auto']}
                  width={30}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(212, 160, 23, 0.05)' }} />
                <Bar dataKey="issues" name="Issues" fill="#D4A017" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </>
  );
};

export const FineAnalytics = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/fines?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load fine analytics', e);
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
        <p style={{ marginBottom: '1rem' }}>Unable to load fine analytics.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '0' }}>
        <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
          <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '1.5rem', height: '250px' }}>
            <div style={{ background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
            <div style={{ background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
          </div>
        </SectionCard>
        <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
          <div style={{ height: '200px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
        </SectionCard>
      </div>
    );
  }

  const { summary, trend, records } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '0' }}>
      
      {/* Chart and Summary */}
      <SectionCard title="Fine & Revenue Analytics" subtitle="Track generated, collected and outstanding fines">
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '1.5rem', alignItems: 'stretch' }}>
          
          {/* Trend Chart */}
          <div style={{ height: '160px', padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '8px', background: 'white' }}>
            {(!trend || trend.length === 0) ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No fine activity in the selected period</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} 
                    itemStyle={{ padding: '0.2rem 0' }}
                    formatter={(value) => [`₹${value}`, undefined]}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.85rem' }} />
                  <Bar dataKey="generated" name="Generated" fill="#D4A017" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="collected" name="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {/* Summary Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'space-between', padding: '1.25rem', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Generated</span>
              <span style={{ fontWeight: 700, color: '#D4A017', fontSize: '1.1rem' }}>₹{summary.generated}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Collected</span>
              <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '1.1rem' }}>₹{summary.collected}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Pending</span>
              <span style={{ fontWeight: 700, color: '#ea580c', fontSize: '1.1rem' }}>₹{summary.pending}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Waived</span>
              <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: '1.1rem' }}>₹{summary.waived}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Collection Rate</span>
              <span style={{ fontWeight: 700, color: '#334155', fontSize: '1.1rem' }}>{summary.collectionRate}%</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Fine Details Table */}
      <SectionCard title="Fine Details" action={<button style={{ background: 'transparent', border: 'none', color: '#0ea5e9', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>View All</button>}>
        {(!records || records.length === 0) ? (
          <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No fine records found</span>
          </div>
        ) : (
          <Table 
            data={records}
            emptyMessage="No fine records"
            columns={[
              { header: 'Member', render: (r) => <TruncatedText text={r.member} /> },
              { header: 'Book', render: (r) => <TruncatedText text={r.book} /> },
              { header: 'Fine', render: (r) => <span style={{ fontWeight: 600, color: '#1e293b' }}>₹{r.fine}</span> },
              { header: 'Pending', render: (r) => <span style={{ color: r.pending > 0 ? '#ea580c' : '#94a3b8', fontWeight: r.pending > 0 ? 600 : 400 }}>{r.pending > 0 ? `₹${r.pending}` : '—'}</span> },
              { header: 'Status', render: (r) => (
                <span style={{ 
                  background: r.status === 'Paid' ? '#f0fdf4' : (r.status === 'Pending' ? '#fff7ed' : '#f8fafc'), 
                  color: r.status === 'Paid' ? '#16a34a' : (r.status === 'Pending' ? '#ea580c' : '#64748b'), 
                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                  border: `1px solid ${r.status === 'Paid' ? '#bbf7d0' : (r.status === 'Pending' ? '#fed7aa' : '#e2e8f0')}`
                }}>
                  {r.status}
                </span>
              )}
            ]}
          />
        )}
      </SectionCard>

    </div>
  );
};

export const BorrowingBehaviourHeatmap = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/behaviour?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load behaviour analytics', e);
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
        <p style={{ marginBottom: '1rem' }}>Unable to load borrowing behaviour.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '0' }}>
        <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
          <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
        </SectionCard>
        <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
          <div style={{ height: '160px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
        </SectionCard>
      </div>
    );
  }

  const { peakDays, peakHours, returnBehaviour, averageDuration, heatmap } = data;

  // Heatmap rendering logic
  const renderHeatmap = () => {
    if (!heatmap || heatmap.length === 0) {
      return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><EmptyState message="No borrowing activity in the last 12 weeks" /></div>;
    }

    const today = new Date();
    // Default to a 12-week grid (84 days max)
    const totalDays = 84; 
    
    // Determine the max issue count for intensity scaling
    const maxIssues = Math.max(1, ...heatmap.map(d => d.count));

    // Fill an array with the last 84 days
    const dateMap = {};
    heatmap.forEach(h => { dateMap[h.date] = h.count; });
    
    const daysArr = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      daysArr.push({
        dateStr,
        count: dateMap[dateStr] || 0,
        dayOfWeek: (d.getDay() + 6) % 7 // Monday = 0
      });
    }

    // Sort into 7 rows (Mon-Sun)
    const rows = Array(7).fill(null).map(() => []);
    
    // Fill empty cells at the start if the first day isn't Monday
    const firstDay = daysArr[0].dayOfWeek;
    for (let i = 0; i < firstDay; i++) {
      rows[i].push(null);
    }
    
    // Fill the actual days
    daysArr.forEach(day => {
      rows[day.dayOfWeek].push(day);
    });

    const getIntensityColor = (count) => {
      if (count === 0) return '#f1f5f9';
      // Scale from 1 to maxIssues across 4 color steps
      const ratio = count / maxIssues;
      if (ratio <= 0.25) return '#fde047'; // light gold
      if (ratio <= 0.5) return '#eab308'; // medium gold
      if (ratio <= 0.75) return '#ca8a04'; // stronger gold
      return '#a16207'; // strongest gold
    };

    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

    return (
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px' }}>
          {dayLabels.map((lbl, idx) => (
            <div key={idx} style={{ height: '14px', fontSize: '0.7rem', color: '#94a3b8', lineHeight: '14px' }}>{lbl}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {rows.map((row, rIdx) => (
            <div key={rIdx} style={{ display: 'flex', gap: '4px', height: '14px' }}>
              {row.map((cell, cIdx) => {
                if (!cell) return <div key={cIdx} style={{ width: '14px', height: '14px' }}></div>;
                return (
                  <div 
                    key={cIdx} 
                    title={`${new Date(cell.dateStr).toLocaleDateString()}: ${cell.count} Issues`}
                    style={{ 
                      width: '14px', 
                      height: '14px', 
                      borderRadius: '2px', 
                      background: getIntensityColor(cell.count) 
                    }}
                  ></div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Borrowing Activity Heatmap */}
      <SectionCard title="Borrowing Activity" subtitle="Last 12 Weeks • Live Data">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
          {renderHeatmap()}
          {/* Legend */}
          {(heatmap && heatmap.length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '1rem', fontSize: '0.7rem', color: '#64748b' }}>
              <span>Less</span>
              <div style={{ width: '10px', height: '10px', background: '#f1f5f9', borderRadius: '2px' }}></div>
              <div style={{ width: '10px', height: '10px', background: '#fde047', borderRadius: '2px' }}></div>
              <div style={{ width: '10px', height: '10px', background: '#eab308', borderRadius: '2px' }}></div>
              <div style={{ width: '10px', height: '10px', background: '#ca8a04', borderRadius: '2px' }}></div>
              <div style={{ width: '10px', height: '10px', background: '#a16207', borderRadius: '2px' }}></div>
              <span>More</span>
            </div>
          )}
        </div>
      </SectionCard>
    </>
  );
};

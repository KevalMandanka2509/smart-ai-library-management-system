import React, { useState, useEffect } from 'react';
import { SectionCard, EmptyState } from './ReportsCore';
import api from '../../services/api';

export const TruncatedText = ({ text, maxWidth = '120px', title }) => (
  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: maxWidth }} title={title || text}>
    {text}
  </div>
);

export const Table = ({ columns, data, emptyMessage }) => {
  if (!data || data.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
            {columns.map((col, i) => (
              <th key={i} style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {columns.map((col, j) => (
                <td key={j} style={{ padding: '0.75rem 0.5rem', color: '#334155' }}>
                  {col.render ? col.render(row, i) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const BooksTables = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/books-analytics?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load books analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  const ActionLink = () => (
    <span style={{ color: '#D4A017', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>View All</span>
  );

  const TruncatedText = ({ text, maxWidth = '120px' }) => (
    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: maxWidth }} title={text}>
      {text}
    </div>
  );

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to load book analytics.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  const SkeletonRow = () => (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '20px', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '80%', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '50%', borderRadius: '4px' }}></div></td>
    </tr>
  );

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '0' }}>
        {[1, 2, 3].map(i => (
          <SectionCard key={i} title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#e2e8f0', height: '14px', width: '20px', borderRadius: '4px' }}></div></th>
                  <th style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#e2e8f0', height: '14px', width: '60%', borderRadius: '4px' }}></div></th>
                  <th style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#e2e8f0', height: '14px', width: '40%', borderRadius: '4px' }}></div></th>
                </tr>
              </thead>
              <tbody style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </tbody>
            </table>
          </SectionCard>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '0' }}>
      <SectionCard title="Most Borrowed Books" action={<ActionLink />}>
        <Table 
          data={data?.most_borrowed} 
          emptyMessage="No borrowing data available"
          columns={[
            { header: '#', render: (_, i) => <span style={{ color: '#94a3b8' }}>{i + 1}</span> },
            { header: 'Book', render: (r) => <TruncatedText text={r.title} /> },
            { header: 'Author', render: (r) => <TruncatedText text={r.author} maxWidth="100px" /> },
            { header: 'Issues', render: (r) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.issues}</span> }
          ]} 
        />
      </SectionCard>
      
      <SectionCard title="Most Overdue Books" action={<ActionLink />}>
        <Table 
          data={data?.most_overdue} 
          emptyMessage="✓ No overdue books"
          columns={[
            { header: '#', render: (_, i) => <span style={{ color: '#94a3b8' }}>{i + 1}</span> },
            { header: 'Book', render: (r) => <TruncatedText text={r.title} maxWidth="140px" /> },
            { header: 'Overdue', render: (r) => <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.daysOverdue} days</span> },
            { header: 'Fine', render: (r) => <span style={{ color: '#475569', fontWeight: 500 }}>{r.fine > 0 ? `₹${r.fine}` : '₹0'}</span> }
          ]} 
        />
      </SectionCard>
      
      <SectionCard title="Most Reserved Books" action={<ActionLink />}>
        <Table 
          data={data?.most_reserved} 
          emptyMessage="No reservations available"
          columns={[
            { header: '#', render: (_, i) => <span style={{ color: '#94a3b8' }}>{i + 1}</span> },
            { header: 'Book', render: (r) => <TruncatedText text={r.title} maxWidth="160px" /> },
            { header: 'Reservations', render: (r) => <span style={{ fontWeight: 600, color: '#D4A017' }}>{r.reservations}</span> }
          ]} 
        />
      </SectionCard>
    </div>
  );
};

export const AuthorTable = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/authors?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load author analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  const ActionLink = () => (
    <span style={{ color: '#D4A017', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>View All</span>
  );

  if (error) {
    return (
      <SectionCard title="Top Authors by Borrowing">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#64748b' }}>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>Unable to load author analytics.</p>
          <button onClick={loadData} style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}>Retry</button>
        </div>
      </SectionCard>
    );
  }

  if (loading || !data) {
    return (
      <SectionCard title={<div style={{ background: '#e2e8f0', height: '16px', width: '150px', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingBottom: '10px', borderBottom: i < 5 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ background: '#f1f5f9', height: '12px', width: '16px', borderRadius: '3px' }}></div>
              <div style={{ background: '#f1f5f9', height: '12px', flex: 1, borderRadius: '3px' }}></div>
              <div style={{ background: '#e2e8f0', height: '12px', width: '30px', borderRadius: '3px' }}></div>
              <div style={{ background: '#e2e8f0', height: '12px', width: '30px', borderRadius: '3px' }}></div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  const { top_authors } = data;
  const displayAuthors = (top_authors || []).slice(0, 5);

  return (
    <SectionCard title="Top Authors by Borrowing" action={<ActionLink />}>
      {(!displayAuthors || displayAuthors.length === 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#94a3b8' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>✓</div>
          <div style={{ fontSize: '0.85rem' }}>No author data available</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600, width: '24px' }}>#</th>
                <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600 }}>Author</th>
                <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600, textAlign: 'right' }}>Books</th>
                <th style={{ padding: '0.5rem 0.4rem', fontWeight: 600, textAlign: 'right' }}>Issues</th>
              </tr>
            </thead>
            <tbody>
              {displayAuthors.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem 0.4rem', color: '#94a3b8', fontSize: '0.75rem' }}>{i + 1}</td>
                  <td style={{ padding: '0.5rem 0.4rem', color: '#334155' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={r.author}>{r.author}</div>
                  </td>
                  <td style={{ padding: '0.5rem 0.4rem', color: '#64748b', textAlign: 'right' }}>{r.books}</td>
                  <td style={{ padding: '0.5rem 0.4rem', color: '#D4A017', fontWeight: 600, textAlign: 'right' }}>{r.issues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
};

export const MemberTable = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/members?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load member analytics', e);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [globalPeriod]);

  const ActionLink = () => (
    <span style={{ color: '#D4A017', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>View All</span>
  );

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '0', color: '#64748b' }}>
        <p style={{ marginBottom: '1rem' }}>Unable to load member analytics.</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  const SkeletonRow = () => (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '80%', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '30%', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '30%', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '30%', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '30%', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '30%', borderRadius: '4px' }}></div></td>
      <td style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#f1f5f9', height: '14px', width: '50%', borderRadius: '4px' }}></div></td>
    </tr>
  );

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', height: '100px', animation: 'pulse 2s infinite' }}>
              <div style={{ background: '#f1f5f9', height: '12px', width: '80px', borderRadius: '4px', marginBottom: '12px' }}></div>
              <div style={{ background: '#e2e8f0', height: '24px', width: '60px', borderRadius: '4px' }}></div>
            </div>
          ))}
        </div>
        <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '200px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                {Array(7).fill(0).map((_, i) => (
                  <th key={i} style={{ padding: '0.75rem 0.5rem' }}><div style={{ background: '#e2e8f0', height: '14px', width: '60%', borderRadius: '4px' }}></div></th>
                ))}
              </tr>
            </thead>
            <tbody style={{ animation: 'pulse 2s infinite' }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </tbody>
          </table>
        </SectionCard>
      </div>
    );
  }

  const { summary, top_members } = data;

  const TruncatedText = ({ text, maxWidth = '160px' }) => (
    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: maxWidth }} title={text}>
      {text}
    </div>
  );

  return (
    <>
      {/* Most Active Members Table */}
      <SectionCard title="Most Active Members" action={<ActionLink />}>
        {(!top_members || top_members.length === 0) ? (
          <EmptyState message="No member activity available" />
        ) : (
          <Table 
            data={top_members}
            emptyMessage="No member activity available"
            columns={[
              { header: 'Member', render: (r) => <TruncatedText text={r.member} /> },
              { header: 'Issues', render: (r) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.issues}</span> },
              { header: 'Returns', render: (r) => <span style={{ color: '#16a34a', fontWeight: 500 }}>{r.returns}</span> },
              { header: 'Overdue', render: (r) => <span style={{ color: r.overdue > 0 ? '#ef4444' : '#94a3b8', fontWeight: r.overdue > 0 ? 600 : 400 }}>{r.overdue > 0 ? r.overdue : '—'}</span> },
              { header: 'Fine', render: (r) => <span style={{ color: r.fine > 0 ? '#b91c1c' : '#94a3b8', fontWeight: r.fine > 0 ? 500 : 400 }}>{r.fine > 0 ? `₹${r.fine}` : '—'}</span> },
              { header: 'Reservations', render: (r) => <span style={{ color: r.reservations > 0 ? '#D4A017' : '#94a3b8' }}>{r.reservations > 0 ? r.reservations : '—'}</span> },
              { header: 'Last Activity', render: (r) => <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{r.last_activity}</span> }
            ]}
          />
        )}
      </SectionCard>
    </>
  );
};

export const OverdueIntelligence = ({ globalPeriod }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/overdue?period=${globalPeriod}`);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load overdue analytics', e);
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
        <p style={{ marginBottom: '1rem' }}>Unable to load overdue intelligence.</p>
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
        <SectionCard title={<div style={{ background: '#e2e8f0', height: '20px', width: '150px', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>}>
          <div style={{ height: '200px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
        </SectionCard>
      </div>
    );
  }

  const { summary, records } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '0' }}>
      
      {/* 5 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#D4A017' }}>•</span> Total Overdue
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{summary.totalOverdue}</div>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#f59e0b' }}>•</span> 1–7 Days
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{summary.oneToSeven}</div>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ea580c' }}>•</span> 8–30 Days
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c2410c' }}>{summary.eightToThirty}</div>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ef4444' }}>•</span> 30+ Days
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b91c1c' }}>{summary.thirtyPlus}</div>
        </div>
        <div style={{ gridColumn: '1 / -1', background: '#fef2f2', padding: '1rem', borderRadius: '12px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ color: '#dc2626' }}>•</span> Critical Overdue
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b' }}>{summary.critical}</div>
        </div>
      </div>

      {/* Additional Stats Row */}
      {summary.totalOverdue > 0 && (
        <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Average Days Overdue</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{summary.averageDaysOverdue} days</div>
          </div>
          <div style={{ width: '1px', background: '#e2e8f0' }}></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Maximum Days Overdue</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{summary.maximumDaysOverdue} days</div>
          </div>
          <div style={{ width: '1px', background: '#e2e8f0' }}></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Members With Overdue Books</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{summary.membersWithOverdue}</div>
          </div>
          <div style={{ width: '1px', background: '#e2e8f0' }}></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Outstanding Fine</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#b91c1c', marginTop: '2px' }}>₹{summary.outstandingFine}</div>
          </div>
        </div>
      )}

      {/* Overdue Table */}
      <SectionCard title="Overdue Records" action={<button style={{ background: 'transparent', border: 'none', color: '#0ea5e9', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>View All</button>}>
        {(!records || records.length === 0) ? (
          <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ No overdue books. All currently issued books are within their due dates.</span>
          </div>
        ) : (
          <Table 
            data={records}
            emptyMessage="No overdue records"
            columns={[
              { header: 'Member', render: (r) => <TruncatedText text={r.member} /> },
              { header: 'Book', render: (r) => <TruncatedText text={r.book} /> },
              { header: 'Issue Date', render: (r) => <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{r.issue_date ? new Date(r.issue_date).toLocaleDateString() : '—'}</span> },
              { header: 'Due Date', render: (r) => <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'}</span> },
              { header: 'Days Overdue', render: (r) => <span style={{ color: r.days_overdue > 30 ? '#dc2626' : '#ea580c', fontWeight: 600 }}>{r.days_overdue}</span> },
              { header: 'Fine', render: (r) => <span style={{ color: r.fine > 0 ? '#b91c1c' : '#94a3b8', fontWeight: r.fine > 0 ? 500 : 400 }}>{r.fine > 0 ? `₹${r.fine}` : '—'}</span> },
              { header: 'Status', render: (r) => (
                <span style={{ 
                  background: r.status === 'Critical' ? '#fef2f2' : '#fff7ed', 
                  color: r.status === 'Critical' ? '#dc2626' : '#ea580c', 
                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                  border: `1px solid ${r.status === 'Critical' ? '#fecaca' : '#fed7aa'}`
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

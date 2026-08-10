import { formatIST } from '../utils/dateUtils';
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboardAnalytics } from '../services/api';
import UserDashboard from '../components/UserDashboard';
import { Trophy, Users } from 'lucide-react';
import { AnalyticsCard, PageHeader, ChartCard, DataTable } from '../components/layout/EnterpriseLibrary';
import '../styles/design-tokens.css';
import './Dashboard.css';

import { Sparkline, BorrowTrendChart, BorrowActivityHeatmap, DonutChart, HBar, KpiCard, COLORS } from '../components/DashboardCharts';
// ─────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendRange, setTrendRange] = useState('30D'); // '7D' | '30D' | '90D'

  const [userName, setUserName] = useState('Admin');
  const [userRole, setUserRole] = useState('admin');
  const [txSearch, setTxSearch] = useState('');
  const [txPage, setTxPage] = useState(1);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setUserName(p.full_name || 'Member');
        setUserRole(p.role || 'member');
      } catch (_) { }
    }
    load();

    // Auto-sync dashboard metrics: fetch backend state updates every 60 seconds
    const interval = setInterval(() => {
      loadSilent();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getDashboardAnalytics();
      setData(result);
    } catch (e) {
      setError('Could not load dashboard analytics. Make sure backend is running.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSilent = useCallback(async () => {
    try {
      const result = await getDashboardAnalytics();
      setData(result);
    } catch (e) {
      console.error('Silent auto-sync failed:', e);
    }
  }, []);

  const { books, borrows, students, fines, popular_books, top_students, trend, recent_transactions } = data || {};

  // Rebuild trend data dynamically according to selected trendRange (7D, 30D, 90D)
  const filteredTrend = useMemo(() => {
    const limit = trendRange === '7D' ? 7 : trendRange === '90D' ? 90 : 30;

    // Map existing backend data so we can resolve values by date key
    const dataMap = {};
    if (trend && trend.labels) {
      trend.labels.forEach((lbl, idx) => {
        dataMap[lbl] = {
          issue: trend.issues[idx] || 0,
          ret: trend.returns[idx] || 0
        };
      });
    }

    const labels = [];
    const issues = [];
    const returns = [];
    const today = new Date();

    for (let i = limit - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
      labels.push(dateStr);

      const dayData = dataMap[dateStr];
      if (dayData) {
        issues.push(dayData.issue);
        returns.push(dayData.ret);
      } else {
        issues.push(0);
        returns.push(0);
      }
    }

    return { labels, issues, returns };
  }, [trendRange, trend]);

  // Sparkline data: last 14 days issues & returns
  const last14Issues = useMemo(() => trend?.issues ? trend.issues.slice(-14) : [], [trend]);
  const last14Returns = useMemo(() => trend?.returns ? trend.returns.slice(-14) : [], [trend]);

  // Donut slices from genre data
  const donutSlices = useMemo(() => (books?.by_genre || []).slice(0, 8).map((g) => ({ label: g.genre, value: g.count })), [books]);

  // Popular books max
  const maxBorrow = useMemo(() => popular_books?.length > 0 ? popular_books[0].borrow_count : 1, [popular_books]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <span>Loading analytics dashboard…</span>
      </div>
    );
  }

  const isAdmin = userRole === 'admin';
  const isLibrarian = userRole === 'librarian';

  if (!isAdmin && !isLibrarian) {
    return (
      <div className="dashboard-wrapper" style={{ width: '100%', maxWidth: 'none', margin: '0', padding: '2rem 3rem' }}>
        {/* ── User PageHeader Component Migration ── */}
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--eu-color-border-main)', paddingBottom: '1.25rem' }}>
          <PageHeader
            title="User Workspace Dashboard"
            subtitle="Member Workspace Portal"
            actions={
              <div className="header-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="profile-details" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                  <span className="profile-name" style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--eu-color-text-main)' }}>{userName}</span>
                  <span className="profile-role" style={{ fontSize: '0.72rem', color: 'var(--eu-color-text-soft)' }}>Library Member</span>
                </div>
                <div className="profile-avatar" style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--eu-color-primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '0.9rem'
                }}>
                  {userName.charAt(0).toUpperCase()}
                </div>
              </div>
            }
          />
        </div>
        <UserDashboard userName={userName} />
      </div>
    );
  }



  const formatDate = (iso) => {
    if (!iso) return '—';
    return formatIST(iso);
  };

  return (
    <div className="dashboard-wrapper">
      {/* ── PageHeader Component Migration ── */}
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--eu-color-border-main)', paddingBottom: '1.25rem' }}>
        <PageHeader
          title="Analytics Dashboard"
          subtitle={`${isAdmin ? 'System Administrator' : 'Librarian'} · Live Data`}
        />
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '1rem', borderRadius: '12px', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <div className="dashboard-container">
        {/* ── KPI Cards Row ── */}
        <section className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <KpiCard
            label="Total Books"
            value={(books?.total ?? 0).toLocaleString()}
            sub={`${books?.available ?? 0} available · ${books?.issued ?? 0} issued`}
            theme="gold"
            sparkData={last14Issues}
            to="/books"
          />
          <KpiCard
            label="Active Borrows"
            value={(borrows?.total_active ?? 0).toLocaleString()}
            sub={`${borrows?.new_issues_7d ?? 0} new this week`}
            theme="blue"
            sparkData={last14Issues}
            trendUp={(borrows?.new_issues_7d ?? 0) > 0}
            to="/transactions"
          />
          <KpiCard
            label="Overdue Returns"
            value={(borrows?.overdue_count ?? 0).toLocaleString()}
            sub={`${borrows?.clearance_rate ?? 0}% clearance rate`}
            theme={(borrows?.overdue_count ?? 0) > 0 ? 'red' : 'green'}
            sparkData={last14Returns}
            trendUp={(borrows?.overdue_count ?? 0) === 0}
            to="/issue-return"
          />
          <KpiCard
            label="Total Members"
            value={(students?.total ?? 0).toLocaleString()}
            sub={`${students?.active_borrowers_30d ?? 0} borrowed in last 30 days`}
            theme="green"
            to="/students"
          />
          <KpiCard
            label="Unpaid Fines"
            value={`₹${(fines?.total_unpaid ?? 0).toLocaleString()}`}
            sub={`${fines?.count_unpaid ?? 0} pending · ₹${(fines?.total_collected ?? 0).toLocaleString()} collected`}
            theme={(fines?.total_unpaid ?? 0) > 0 ? 'red' : 'green'}
            to="/fines"
          />
        </section>

        {/* ── Borrow Trend + Donut ── */}
        <section className="analytics-row" style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
          <div className="flex-2">
            <ChartCard
              title={`${trendRange} Borrow Trend`}
              headerActions={
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', background: 'rgba(226,211,179,0.15)', borderRadius: '8px', padding: '4px', gap: '8px', alignItems: 'center' }}>
                    {['7D', '30D', '90D'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setTrendRange(range)}
                        style={{
                          width: '42px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          border: 'none',
                          borderRadius: '6px',
                          background: trendRange === range ? '#D4A017' : '#f8fafc',
                          color: trendRange === range ? '#fff' : '#1e1b15',
                          cursor: 'pointer',
                          boxShadow: trendRange === range ? '0 2px 6px rgba(212,160,23,0.3)' : 'none',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', fontWeight: '700' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: '10px', height: '10px', background: '#D4A017', borderRadius: '2px', display: 'inline-block' }} />
                      Issues
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px', display: 'inline-block' }} />
                      Returns
                    </span>
                  </div>
                </div>
              }
            >
              <BorrowTrendChart labels={filteredTrend.labels} issues={filteredTrend.issues} returns={filteredTrend.returns} />
            </ChartCard>
          </div>

          <div className="flex-1">
            <ChartCard title="Books by Category">
              <div className="donut-chart-container">
                <DonutChart slices={donutSlices} />
                <div className="donut-legend" style={{ maxWidth: '120px' }}>
                  {donutSlices.slice(0, 6).map((s, i) => (
                    <div key={s.label} className="legend-item">
                      <span className="legend-color" style={{ background: COLORS[i % COLORS.length] }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label} ({s.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>
        </section>

        {/* ── Borrow Activity Heatmap ── */}
        <section className="recent-transactions-section" style={{ display: 'block', width: '100%', margin: '24px 0' }}>
          <BorrowActivityHeatmap trend={trend} />
        </section>

        {/* ── Popular Books + Top Students ── */}
        <section className="analytics-row" style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
          <div className="flex-1">
            <ChartCard title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={18} color="#D4A017" /> Most Popular Books
              </div>
            }>
              {popular_books.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>No borrow history yet.</p>
              ) : (
                popular_books.slice(0, 5).map((b, i) => (
                  <HBar
                    key={b.book_id}
                    label={b.title}
                    value={b.borrow_count}
                    max={maxBorrow}
                    rank={i + 1}
                  />
                ))
              )}
            </ChartCard>
          </div>

          <div className="flex-1">
            <ChartCard title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="#3b82f6" /> Top Active Students
              </div>
            }>
              {top_students.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>No student activity yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student</th>
                        <th>ID</th>
                        <th style={{ textAlign: 'right' }}>Borrows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top_students.slice(0, 5).map((s, i) => (
                        <tr key={s.student_id}>
                          <td>
                            <span style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: i < 3 ? '#D4A017' : '#f1f5f9',
                              color: i < 3 ? '#fff' : '#5c5549',
                              fontSize: '0.7rem', fontWeight: '800',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>{i + 1}</span>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                background: '#f5ecd5', color: '#b3861b',
                                fontSize: '0.72rem', fontWeight: '800',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                              </div>
                              {s.name}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{s.student_id}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: '#D4A017' }}>{s.borrow_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>
        </section>

        {/* ── Metric Cards Row ── */}
        <section className="stats-row">
          <AnalyticsCard
            title="Total Transactions"
            value={(borrows?.total_transactions ?? 0).toLocaleString()}
            subtitle={`${borrows?.total_returned ?? 0} returned`}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
            onClick={() => navigate('/transactions')}
          />
          <AnalyticsCard
            title="Return Clearance"
            value={`${borrows?.clearance_rate ?? 0}%`}
            subtitle="Successful returns"
            trend="Clearance"
            trendUp={true}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
            onClick={() => navigate('/transactions')}
          />
          <AnalyticsCard
            title="Fines Collected"
            value={`₹${(fines?.total_collected ?? 0).toLocaleString()}`}
            subtitle={`${fines?.count_unpaid ?? 0} pending`}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>}
            onClick={() => navigate('/fines')}
          />
          <AnalyticsCard
            title="Active Members"
            value={(students?.active ?? 0).toLocaleString()}
            subtitle={`${students?.active_borrowers_30d ?? 0} borrowed recently`}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
            onClick={() => navigate('/students')}
          />
        </section>

        {/* ── Recent Transactions ── */}
        <section className="recent-transactions-section">
          <ChartCard
            title="Recent Transactions"
            headerActions={
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={txSearch}
                  onChange={(e) => {
                    setTxSearch(e.target.value);
                    setTxPage(1);
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    border: '1.5px solid rgba(226,211,179,0.4)',
                    background: '#fdfcf9',
                    color: '#1e1b15',
                    outline: 'none',
                    width: '180px'
                  }}
                />
                <Link to="/transactions" style={{ fontSize: '0.8rem', fontWeight: '700', color: '#D4A017', textDecoration: 'none' }}>View All →</Link>
              </div>
            }
          >
            {(() => {
              const query = txSearch.toLowerCase().trim();
              const filteredList = (recent_transactions || []).filter((tx) => {
                return (
                  (tx.student_name || '').toLowerCase().includes(query) ||
                  (tx.book_title || '').toLowerCase().includes(query) ||
                  (tx.status || '').toLowerCase().includes(query)
                );
              });

              const pageSize = 5;
              const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
              const pageIdx = Math.min(txPage, totalPages);
              const paginatedList = filteredList.slice((pageIdx - 1) * pageSize, pageIdx * pageSize);

              const columns = [
                { header: 'Student', cell: (row) => <span style={{ fontWeight: 700 }}>{row.student_name}</span> },
                { header: 'Book', cell: (row) => <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.book_title}</div> },
                { header: 'Issued', cell: (row) => formatDate(row.issue_date) },
                { header: 'Due', cell: (row) => formatDate(row.due_date) },
                { header: 'Returned', cell: (row) => row.return_date ? formatDate(row.return_date) : '—' },
                {
                  header: 'Status',
                  cell: (row) => (
                    <span className={`table-badge ${row.status === 'returned' ? 'active' : row.overdue ? 'inactive' : 'active'}`} style={row.overdue ? { background: '#fef2f2', color: '#b91c1c' } : {}}>
                      {row.status === 'returned' ? 'Returned' : row.overdue ? 'Overdue' : 'Issued'}
                    </span>
                  )
                }
              ];

              return (
                <>
                  <DataTable
                    columns={columns}
                    data={paginatedList}
                    onRowClick={() => navigate('/transactions')}
                    emptyMessage="No transactions found."
                  />

                  {filteredList.length > pageSize && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', fontWeight: '600' }}>
                        Showing {((pageIdx - 1) * pageSize) + 1} - {Math.min(pageIdx * pageSize, filteredList.length)} of {filteredList.length}
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          disabled={pageIdx === 1}
                          onClick={() => setTxPage(pageIdx - 1)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            borderRadius: '6px',
                            border: '1px solid rgba(226,211,179,0.3)',
                            background: pageIdx === 1 ? '#f1f5f9' : '#fff',
                            color: pageIdx === 1 ? '#9ca3af' : '#1e1b15',
                            cursor: pageIdx === 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Prev
                        </button>
                        <button
                          disabled={pageIdx === totalPages}
                          onClick={() => setTxPage(pageIdx + 1)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            borderRadius: '6px',
                            border: '1px solid rgba(226,211,179,0.3)',
                            background: pageIdx === totalPages ? '#f1f5f9' : '#fff',
                            color: pageIdx === totalPages ? '#9ca3af' : '#1e1b15',
                            cursor: pageIdx === totalPages ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </ChartCard>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { getFines, payFine } from '../services/api';
import { formatIST } from '../utils/dateUtils';
import { PageHeader, DataTable } from '../components/layout/EnterpriseLibrary';

import './Dashboard.css';

const Fines = () => {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('unpaid'); // 'unpaid' or 'paid'
  const [payingId, setPayingId] = useState(null);

  const [currentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  });
  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    loadFinesList();
  }, [activeTab]);

  const loadFinesList = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getFines(activeTab === 'paid');
      // Handle paginated envelope or raw array
      if (data && data.fines) {
        setFines(data.fines);
      } else if (Array.isArray(data)) {
        setFines(data);
      } else {
        setFines([]);
      }
    } catch (err) {
      setError('Failed to load fines list.');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (id) => {
    if (!window.confirm('Confirm fine payment?')) return;
    try {
      setPayingId(id);
      setError('');
      setSuccess('');
      const res = await payFine(id);
      setSuccess(res.message || 'Fine successfully paid.');
      loadFinesList();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to pay fine.');
    } finally {
      setPayingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return formatIST(dateStr);
  };

  return (
    <div className="premium-page-wrapper" style={{ padding: '2rem' }}>
      {/* ── PageHeader Component Migration ── */}
      <PageHeader
        title="Fine Management"
        subtitle="Late return fee logs"
      />

      {error && (
        <div className="error-alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fee2e2', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="success-alert" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="premium-tab-container">
        <button
          onClick={() => setActiveTab('unpaid')}
          className={`premium-tab ${activeTab === 'unpaid' ? 'active' : ''}`}
        >
          Outstanding Fines
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={`premium-tab ${activeTab === 'paid' ? 'active' : ''}`}
        >
          Payment History
        </button>
      </div>

      <div className="table-container" style={{ background: '#ffffff', borderRadius: '16px', padding: '2rem', border: '1px solid rgba(226,211,179,0.55)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
        {(() => {
          const columns = [];
          if (isAdmin) {
            columns.push({
              header: 'Student',
              cell: (row) => (
                <div>
                  <div style={{ fontWeight: 'bold' }}>{row.student_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-light)' }}>{row.student_id}</div>
                </div>
              )
            });
          }
          columns.push(
            { header: 'Book Title', cell: (row) => <span style={{ fontWeight: 'bold' }}>{row.book_title}</span> },
            { header: 'Reason', accessor: 'reason' },
            { header: 'Date Generated', cell: (row) => formatDate(row.created_at) },
            {
              header: 'Amount',
              cell: (row) => (
                <span style={{ fontWeight: 'bold', color: activeTab === 'unpaid' ? '#b91c1c' : '#166534' }}>
                  ₹{row.amount.toFixed(2)}
                </span>
              )
            }
          );
          if (activeTab === 'paid') {
            columns.push({ header: 'Paid Date', cell: (row) => formatDate(row.paid_at) });
          } else {
            columns.push({
              header: 'Action',
              cell: (row) => {
                const isDynamic = String(row.id).startsWith('dyn_');
                return (
                  <button
                    onClick={() => handlePay(row.id)}
                    disabled={payingId === row.id || isDynamic}
                    style={{
                      background: isDynamic ? '#f8fafc' : '#fffdf9',
                      color: isDynamic ? '#94a3b8' : '#16a34a',
                      border: `1px solid ${isDynamic ? '#cbd5e1' : 'rgba(22, 163, 74, 0.3)'}`,
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: isDynamic ? 'not-allowed' : 'pointer',
                      opacity: payingId === row.id ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if(!isDynamic) { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#16a34a'; } }}
                    onMouseLeave={(e) => { if(!isDynamic) { e.currentTarget.style.background = '#fffdf9'; e.currentTarget.style.borderColor = 'rgba(22, 163, 74, 0.3)'; } }}
                    title={isDynamic ? 'Please return the book first to pay the fine' : ''}
                  >
                    {payingId === row.id ? 'Processing...' : (isDynamic ? 'Return Book First' : 'Pay Fine')}
                  </button>
                );
              }
            });
          }

          return (
            <DataTable
              columns={columns}
              data={fines}
              emptyMessage="No fines found in this category."
              loading={loading}
            />
          );
        })()}
      </div>
    </div>
  );
};

export default Fines;



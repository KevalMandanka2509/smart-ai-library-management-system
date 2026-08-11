import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getActiveReservations, reserveBook, cancelReservation } from '../services/api';
import { formatIST } from '../utils/dateUtils';
import { PageHeader, DataTable, StatusBadge } from '../components/layout/EnterpriseLibrary';
import { BookOpen, User } from 'lucide-react';

import './Students.css'; // Use unified form styles

const Reservations = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [searchParams] = useSearchParams();
  // Create reservation state
  const [bookIdInput, setBookIdInput] = useState(searchParams.get('book_id') || '');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [currentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  });
  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    loadReservationsList();
  }, []);

  useEffect(() => {
    const passedBookId = searchParams.get('book_id');
    if (passedBookId) {
      setBookIdInput(passedBookId);
    }
  }, [searchParams]);

  const loadReservationsList = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getActiveReservations();
      setReservations(data);
    } catch (err) {
      setError('Failed to load reservations queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!bookIdInput) {
      setError('Please fill in Book ID/ISBN/Title.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      const res = await reserveBook(bookIdInput, isAdmin ? studentIdInput : null);
      setSuccess(res.message || 'Book successfully reserved.');
      setBookIdInput('');
      setStudentIdInput('');
      loadReservationsList();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to place reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      setError('');
      setSuccess('');
      const res = await cancelReservation(id);
      setSuccess(res.message || 'Reservation cancelled.');
      loadReservationsList();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to cancel reservation.');
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
        title="Reservations Queue"
        subtitle="Track and place holds on out-of-stock books"
      />

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fee2e2', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {success}
        </div>
      )}

      {/* Place Hold / Reservation Form Card */}
      <div className="add-student-card" style={{ background: '#ffffff', borderRadius: '16px', padding: '2rem', border: '1px solid rgba(226,211,179,0.55)', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', color: '#1e1b15', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
          <BookOpen size={20} color="var(--eu-color-primary)" /> Place a New Hold / Reservation
        </h3>
        <form onSubmit={handleCreateReservation} className="student-form">
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr', gap: '1.5rem', alignItems: 'end' }}>
            <div className="premium-form-group" style={{ marginBottom: 0 }}>
              <label>Book ID / ISBN / Exact Title *</label>
              <div className="premium-input-wrapper">
                <BookOpen className="premium-input-icon" size={16} />
                <input
                  type="text"
                  placeholder="e.g., 978-0132350884 or Clean Code"
                  value={bookIdInput}
                  onChange={(e) => setBookIdInput(e.target.value)}
                  required
                />
              </div>
            </div>
            {isAdmin && (
              <div className="premium-form-group" style={{ marginBottom: 0 }}>
                <label>Student ID *</label>
                <div className="premium-input-wrapper">
                  <User className="premium-input-icon" size={16} />
                  <input
                    type="text"
                    placeholder="e.g., STU001"
                    value={studentIdInput}
                    onChange={(e) => setStudentIdInput(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="submit"
                className="add-btn"
                disabled={submitting}
                style={{ height: '46px', width: 'auto', minWidth: '180px', padding: '0 2rem' }}
              >
                {submitting ? 'Placing hold...' : 'Reserve Book'}
              </button>
            </div>
          </div>
        </form>
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
            { header: 'Date Reserved', cell: (row) => formatDate(row.reserved_at) },
            {
              header: 'Status',
              cell: (row) => (
                <StatusBadge 
                  label={row.status} 
                  variant={row.status === 'ready' ? 'success' : 'warning'} 
                />
              )
            },
            {
              header: 'Action',
              cell: (row) => (
                <button
                  onClick={() => handleCancel(row.id)}
                  style={{
                    background: '#fffdf9',
                    color: '#dc2626',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '0.85rem'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fffdf9'; e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)'; }}
                >
                  Cancel Hold
                </button>
              )
            }
          );

          return (
            <DataTable
              columns={columns}
              data={reservations}
              emptyMessage="No active holds or reservations in queue."
              loading={loading}
            />
          );
        })()}
      </div>
    </div>
  );
};

export default Reservations;



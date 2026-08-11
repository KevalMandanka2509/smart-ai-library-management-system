import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/EnterpriseLibrary';
import { issueBook, returnBook, scanIssueBook, scanReturnBook } from '../services/api';
import { Camera, User, BookOpen } from 'lucide-react';
import './Students.css'; // Reuse form styles

const IssueReturn = () => {
  const [searchParams] = useSearchParams();
  const [actionType, setActionType] = useState('issue'); // 'issue' or 'return'
  const [studentId, setStudentId] = useState('');
  const [bookId, setBookId] = useState(searchParams.get('book_id') || '');
  const [scannedCode, setScannedCode] = useState('');
  const [useScanMode, setUseScanMode] = useState(!searchParams.get('book_id')); // Default to manual mode if book_id is passed
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const passedBookId = searchParams.get('book_id');
    if (passedBookId) {
      setBookId(passedBookId);
      setUseScanMode(false);
      setActionType('issue');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setIsLoading(true);
    try {
      let res;
      if (useScanMode) {
        if (!scannedCode.trim()) {
          setError('Please scan or enter a barcode/QR code.');
          setIsLoading(false);
          return;
        }
        if (actionType === 'issue') {
          if (!studentId.trim()) {
            setError('Please enter Student ID for issuing book via scan.');
            setIsLoading(false);
            return;
          }
          res = await scanIssueBook(scannedCode.trim(), studentId.trim());
        } else {
          res = await scanReturnBook(scannedCode.trim());
        }
      } else {
        if (!studentId || !bookId) {
          setError('Please fill in all fields.');
          setIsLoading(false);
          return;
        }
        if (actionType === 'issue') {
          res = await issueBook(studentId, bookId);
        } else {
          res = await returnBook(studentId, bookId);
        }
      }
      setSuccess(res.message || 'Operation successful!');
      setStudentId('');
      setBookId('');
      setScannedCode('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Operation failed. Please verify code or IDs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="students-wrapper" style={{ width: '100%', maxWidth: 'none', margin: '0', padding: '2rem 3rem' }}>
      <header className="students-header" style={{ marginBottom: '2rem' }}>
        <h2>Book Issue & Return Panel</h2>
        <span className="subtitle-text">Librarian terminal for barcode/QR scanning borrowing transactions</span>
      </header>

      <div className="add-student-card" style={{ background: '#ffffff', borderRadius: '16px', padding: '2.5rem', border: '1px solid rgba(226,211,179,0.55)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
        
        {/* Action Toggle Tab */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
          <div className="premium-tab-container">
            <button 
              type="button" 
              onClick={() => { setActionType('issue'); setError(''); setSuccess(''); }}
              className={`premium-tab ${actionType === 'issue' ? 'active' : ''}`}
            >
              Issue Book
            </button>
            <button 
              type="button" 
              onClick={() => { setActionType('return'); setError(''); setSuccess(''); }}
              className={`premium-tab ${actionType === 'return' ? 'active' : ''}`}
            >
              Return Book
            </button>
          </div>
        </div>

        {error && (
          <div className="error-alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontWeight: '600' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="success-alert" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontWeight: '600' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="student-form" style={{ maxWidth: '600px', margin: '0 auto' }}>
          {useScanMode ? (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ background: '#fdfcf9', border: '1.5px solid rgba(212,160,23,0.25)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(212,160,23,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '800', margin: 0, fontSize: '1.05rem', color: '#1e293b' }}>
                    Scanned Barcode / QR Code *
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseScanMode(false)}
                    style={{ background: 'transparent', border: 'none', color: '#d4a017', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Enter Manually Instead
                  </button>
                </div>
                <div className="premium-input-wrapper" style={{ border: '2px solid #d4a017' }}>
                  <Camera className="premium-input-icon" size={16} />
                  <input
                    type="text"
                    value={scannedCode}
                    onChange={(e) => setScannedCode(e.target.value)}
                    placeholder="Scan book barcode or type code..."
                    style={{ padding: '0.8rem', paddingLeft: '2.5rem', fontSize: '1.1rem' }}
                    autoFocus
                  />
                </div>
              </div>

              {actionType === 'issue' && (
                <div className="premium-form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ color: '#1e293b' }}>Student ID / Email *</label>
                  <div className="premium-input-wrapper">
                    <User className="premium-input-icon" size={16} />
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. STU-001 or student@univ.edu"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setUseScanMode(true)}
                  style={{ background: 'transparent', border: 'none', color: '#d4a017', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Use Scanner Mode
                </button>
              </div>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                <div className="premium-form-group">
                  <label style={{ color: '#1e293b' }}>Student ID *</label>
                  <div className="premium-input-wrapper">
                    <User className="premium-input-icon" size={16} />
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. STU-001"
                      required
                    />
                  </div>
                </div>

                <div className="premium-form-group">
                  <label style={{ color: '#1e293b' }}>Book ID / ISBN *</label>
                  <div className="premium-input-wrapper">
                    <BookOpen className="premium-input-icon" size={16} />
                    <input
                      type="text"
                      value={bookId}
                      onChange={(e) => setBookId(e.target.value)}
                      placeholder="e.g. Book ID or ISBN number"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <button 
              type="submit" 
              className="save-btn" 
              disabled={isLoading}
              style={{ 
                width: '100%',
                background: 'linear-gradient(135deg, #e4a81e, #b88610)', 
                color: '#ffffff', 
                border: 'none', 
                padding: '1rem', 
                borderRadius: '8px', 
                fontWeight: '800', 
                fontSize: '1.1rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 20px rgba(212,160,23,0.25)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { if(!isLoading) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { if(!isLoading) e.currentTarget.style.transform = 'none' }}
            >
              {isLoading ? 'Processing...' : actionType === 'issue' ? 'Confirm Issue Transaction' : 'Confirm Return Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueReturn;



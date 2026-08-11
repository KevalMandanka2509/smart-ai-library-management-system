import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/EnterpriseLibrary';
import { issueBook, returnBook, scanIssueBook, scanReturnBook } from '../services/api';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, User, BookOpen, Scan, ArrowRightLeft, CreditCard, Barcode } from 'lucide-react';
import useHardwareScanner from '../hooks/useHardwareScanner';
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

  const processTransaction = async (codeToScan) => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      let res;
      if (useScanMode) {
        const code = codeToScan || scannedCode;
        if (!code.trim()) {
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
          res = await scanIssueBook(code.trim(), studentId.trim());
        } else {
          res = await scanReturnBook(code.trim());
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
      if (actionType === 'issue') setStudentId(''); // Only clear student ID on issue, for faster subsequent returns
      setBookId('');
      setScannedCode('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Operation failed. Please verify code or IDs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    processTransaction();
  };

  const handleImageScan = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const imageFile = e.target.files[0];
    setIsLoading(true);
    setError('');
    
    try {
      const html5QrCode = new Html5Qrcode("qr-reader-hidden");
      const decodedText = await html5QrCode.scanFile(imageFile, false);
      setScannedCode(decodedText);
      processTransaction(decodedText);
    } catch (err) {
      setError("Could not find a valid QR or Barcode in the uploaded image.");
    } finally {
      setIsLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  // ─── Hardware Barcode Scanner Integration ───
  useHardwareScanner((code) => {
    setScannedCode(code);
    processTransaction(code);
  }, useScanMode);

  return (
    <div className="premium-page-wrapper">
      <PageHeader 
        title="Book Issue & Return Panel" 
        subtitle="Librarian terminal for barcode/QR scanning borrowing transactions" 
      />

      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid rgba(226,211,179,0.55)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        
        {/* Terminal Header */}
        <div style={{ background: 'var(--eu-color-bg-alt)', padding: '1.5rem 2.5rem', borderBottom: '1px solid rgba(226,211,179,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              type="button" 
              onClick={() => { setActionType('issue'); setError(''); setSuccess(''); }}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', border: 'none', transition: 'all 0.2s', background: actionType === 'issue' ? 'var(--eu-color-primary)' : 'transparent', color: actionType === 'issue' ? '#ffffff' : 'var(--eu-color-text-main)' }}
            >
              Issue Book
            </button>
            <button 
              type="button" 
              onClick={() => { setActionType('return'); setError(''); setSuccess(''); }}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', border: 'none', transition: 'all 0.2s', background: actionType === 'return' ? 'var(--eu-color-primary)' : 'transparent', color: actionType === 'return' ? '#ffffff' : 'var(--eu-color-text-main)' }}
            >
              Return Book
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => setUseScanMode(!useScanMode)}
            style={{ background: 'transparent', border: '1.5px solid var(--eu-color-primary)', borderRadius: '6px', padding: '0.5rem 1rem', color: 'var(--eu-color-primary)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--eu-color-primary)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--eu-color-primary)'; }}
          >
            {useScanMode ? 'Switch to Manual Entry' : 'Switch to Scanner Mode'}
          </button>
        </div>

        <div style={{ padding: '2.5rem' }}>
          {error && (
            <div className="error-alert" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#b91c1c', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>!</div>
              {error}
            </div>
          )}

          {success && (
            <div className="success-alert" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#166534', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✓</div>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              
              {/* Left Side: Input Area */}
              <div style={{ flex: '1 1 500px' }}>
                {useScanMode ? (
                  <div style={{ background: '#fffdf9', borderRadius: '16px', padding: '3rem 2rem', position: 'relative', overflow: 'hidden', border: '2px dashed rgba(212, 160, 23, 0.4)', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(212, 160, 23, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212, 160, 23, 0.2)', boxShadow: '0 0 30px rgba(212, 160, 23, 0.1)' }}>
                        <Scan size={40} color="var(--eu-color-primary)" />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <h3 style={{ color: '#1e1b15', margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontWeight: '700', letterSpacing: '0.5px' }}>READY TO SCAN</h3>
                        <p style={{ color: '#8c8273', margin: 0, fontSize: '0.95rem' }}>Please point your scanner at the book's barcode</p>
                        <div style={{ marginTop: '1rem' }}>
                          <label className="add-btn" style={{ background: '#f5ecd5', color: 'var(--gold-dark)', border: '1px solid var(--gold)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                            <Camera size={16} /> Upload Photo of QR/Barcode
                            <input type="file" accept="image/*" onChange={handleImageScan} style={{ display: 'none' }} />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                      <div className="premium-input-wrapper">
                        <Barcode className="premium-input-icon" size={18} />
                        <input
                          type="text"
                          value={scannedCode}
                          onChange={(e) => setScannedCode(e.target.value)}
                          placeholder="Or click here to type barcode manually..."
                          autoFocus
                          style={{ textAlign: 'center', paddingLeft: '2.5rem', fontWeight: '600', letterSpacing: '1px' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#fdfcf9', borderRadius: '16px', padding: '2.5rem', border: '1px solid rgba(226,211,179,0.4)' }}>
                    <h3 style={{ margin: '0 0 2rem 0', color: '#1e293b', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CreditCard size={20} color="var(--eu-color-primary)" /> Manual Entry Mode
                    </h3>
                    
                    <div className="premium-form-group" style={{ marginBottom: '1.5rem' }}>
                      <label style={{ fontWeight: '600' }}>Book ID / ISBN *</label>
                      <div className="premium-input-wrapper">
                        <BookOpen className="premium-input-icon" size={18} />
                        <input
                          type="text"
                          value={bookId}
                          onChange={(e) => setBookId(e.target.value)}
                          placeholder="e.g. BOK-1029 or 978-3-16-148410-0"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: Additional Info & Action */}
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                
                <div style={{ background: '#fdfcf9', borderRadius: '16px', padding: '2.5rem', border: '1px solid rgba(226,211,179,0.4)', flexGrow: 1 }}>
                  <h3 style={{ margin: '0 0 2rem 0', color: '#1e293b', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={20} color="var(--eu-color-primary)" /> Patron Information
                  </h3>
                  
                  {actionType === 'issue' ? (
                    <div className="premium-form-group">
                      <label style={{ fontWeight: '600' }}>Student ID / Email *</label>
                      <div className="premium-input-wrapper">
                        <User className="premium-input-icon" size={18} />
                        <input
                          type="text"
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="e.g. STU-001 or email@univ.edu"
                          required
                        />
                      </div>
                      <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', color: 'var(--eu-color-text-soft)' }}>
                        Ensure the patron's account is active and has no pending overdue fines before issuing new materials.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', color: 'var(--eu-color-text-soft)' }}>
                      <ArrowRightLeft size={48} color="rgba(212,160,23,0.3)" style={{ marginBottom: '1rem' }} />
                      <p style={{ textAlign: 'center', margin: 0, fontSize: '0.95rem' }}>Patron identification is not required for returns. Simply scan the book to log it back into the system inventory.</p>
                    </div>
                  )}
                </div>
                
                <div style={{ marginTop: '1.5rem' }}>
                  <button 
                    type="submit" 
                    className="add-btn" 
                    disabled={isLoading}
                    style={{ width: '100%', padding: '1.25rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer', borderRadius: '12px', boxShadow: '0 10px 25px rgba(212,160,23,0.2)' }}
                  >
                    {isLoading ? 'Processing Transaction...' : actionType === 'issue' ? 'Authorize Issue' : 'Process Return'}
                    {!isLoading && <ArrowRightLeft size={20} />}
                  </button>
                </div>
              </div>

            </div>
          </form>
        </div>
      </div>
      
      {/* Hidden container required by html5-qrcode for image processing */}
      <div id="qr-reader-hidden" style={{ width: 0, height: 0, overflow: 'hidden' }}></div>
    </div>
  );
};

export default IssueReturn;



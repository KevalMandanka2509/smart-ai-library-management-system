import React, { useState, useEffect } from 'react';
import { 
  createBook, 
  updateBook, 
  getBarcodeImageUrl, 
  getQrImageUrl, 
  validateCode 
} from '../../services/api';
import { 
  BookOpen, 
  User, 
  Hash, 
  Bookmark, 
  Calendar, 
  Compass, 
  FileText, 
  MapPin, 
  DollarSign, 
  UploadCloud, 
  X 
} from 'lucide-react';

const BookForm = ({ book, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    publication_year: '',
    genre: '',
    description: '',
    total_copies: 1,
    available_copies: 1,
    location: '',
    price: 0,
    cover_image: '',
    barcode_value: '',
    qr_value: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codeWarning, setCodeWarning] = useState('');

  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || '',
        publisher: book.publisher || '',
        publication_year: book.publication_year || '',
        genre: book.genre || '',
        description: book.description || '',
        total_copies: book.total_copies || 1,
        available_copies: book.available_copies || 1,
        location: book.location || '',
        price: book.price || 0,
        cover_image: book.cover_image || '',
        barcode_value: book.barcode_value || (book.isbn ? `LIB-${book.isbn.replace(/\D/g, '')}` : ''),
        qr_value: book.qr_value || (book.isbn ? `QR-LIB-${book.isbn.replace(/\D/g, '')}` : '')
      });
    }
  }, [book]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const nextVal = type === 'number' ? parseFloat(value) || 0 : value;
    
    setFormData((prev) => {
      const updated = { ...prev, [name]: nextVal };
      if (name === 'isbn' && value) {
        const cleanIsbn = value.replace(/\D/g, '') || value;
        if (!prev.barcode_value || prev.barcode_value.startsWith('LIB-')) {
          updated.barcode_value = `LIB-${cleanIsbn}`;
        }
        if (!prev.qr_value || prev.qr_value.startsWith('QR-LIB-')) {
          updated.qr_value = `QR-LIB-${cleanIsbn}`;
        }
      }
      return updated;
    });
  };

  const handleValidateBarcode = async () => {
    if (!formData.barcode_value) return;
    try {
      const res = await validateCode('barcode', formData.barcode_value, book?.id || book?._id);
      if (!res.valid) {
        setCodeWarning(res.message);
      } else {
        setCodeWarning('');
      }
    } catch (_) {}
  };

  const handleValidateQr = async () => {
    if (!formData.qr_value) return;
    try {
      const res = await validateCode('qr', formData.qr_value, book?.id || book?._id);
      if (!res.valid) {
        setCodeWarning(res.message);
      } else {
        setCodeWarning('');
      }
    } catch (_) {}
  };

  const handleFileChange = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, cover_image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    if (!formData.title.trim()) { setError('Title required'); return false; }
    if (!formData.author.trim()) { setError('Author required'); return false; }
    if (!formData.isbn.trim()) { setError('ISBN required'); return false; }
    if (formData.total_copies < 1) { setError('Total copies must be at least 1'); return false; }
    if (formData.available_copies > formData.total_copies) {
      setError('Available copies cannot exceed total copies');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      if (book?.id || book?._id) {
        await updateBook(book.id || book._id, formData);
        setSuccess('Book updated!');
      } else {
        await createBook(formData);
        setSuccess('Book added!');
        if (!book) {
          setFormData({
            title: '', author: '', isbn: '', publisher: '',
            publication_year: '', genre: '', description: '',
            total_copies: 1, available_copies: 1, location: '',
            price: 0, cover_image: '', barcode_value: '', qr_value: ''
          });
        }
      }
      if (onSave) setTimeout(onSave, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const currentBarcode = formData.barcode_value || (formData.isbn ? `LIB-${formData.isbn.replace(/\D/g, '')}` : '');
  const currentQr = formData.qr_value || (currentBarcode ? `QR-${currentBarcode}` : '');

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
      {/* Modal Header */}
      <div className="modal-header">
        <div className="modal-title-area">
          <div className="modal-icon-wrapper">
            <BookOpen size={24} />
          </div>
          <div>
            <h2>{book?.id || book?._id ? 'Edit Book Details' : 'Add New Book'}</h2>
            <div className="modal-subtitle">
              {book?.id || book?._id ? 'Modify the catalog entry information' : 'Register a new library catalog asset'}
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={onCancel}>
          <X size={20} />
        </button>
      </div>

      {/* Modal Body */}
      <div className="modal-body">
        {error && <div className="error" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem' }}>{error}</div>}
        {success && <div className="success" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem' }}>✅ {success}</div>}
        {codeWarning && <div className="error" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', background: '#fffbe5', color: '#b45309', border: '1px solid #fde68a' }}>⚠️ {codeWarning}</div>}
        
        <div className="premium-form-grid">
          {/* Column 1: Core Identification */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="premium-form-group">
              <label>Title *</label>
              <div className="premium-input-wrapper">
                <BookOpen className="premium-input-icon" size={16} />
                <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. The Great Gatsby" />
              </div>
            </div>
            
            <div className="premium-form-group">
              <label>Author *</label>
              <div className="premium-input-wrapper">
                <User className="premium-input-icon" size={16} />
                <input type="text" name="author" value={formData.author} onChange={handleChange} required placeholder="e.g. F. Scott Fitzgerald" />
              </div>
            </div>
            
            <div className="premium-form-group">
              <label>ISBN *</label>
              <div className="premium-input-wrapper">
                <Hash className="premium-input-icon" size={16} />
                <input type="text" name="isbn" value={formData.isbn} onChange={handleChange} required placeholder="e.g. 9780743273565" />
              </div>
            </div>
            
            <div className="premium-form-group">
              <label>Publisher</label>
              <div className="premium-input-wrapper">
                <Bookmark className="premium-input-icon" size={16} />
                <input type="text" name="publisher" value={formData.publisher} onChange={handleChange} placeholder="e.g. Scribner" />
              </div>
            </div>
          </div>
          
          {/* Column 2: Meta & Stock */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="premium-form-group">
              <label>Publication Year</label>
              <div className="premium-input-wrapper">
                <Calendar className="premium-input-icon" size={16} />
                <input type="number" name="publication_year" value={formData.publication_year} onChange={handleChange} placeholder="e.g. 1925" />
              </div>
            </div>

            <div className="premium-form-group">
              <label>Genre</label>
              <div className="premium-input-wrapper">
                <Compass className="premium-input-icon" size={16} />
                <input type="text" name="genre" value={formData.genre} onChange={handleChange} placeholder="e.g. Classic Fiction" />
              </div>
            </div>
            
            <div className="premium-form-group">
              <label>Total Copies *</label>
              <div className="premium-input-wrapper">
                <FileText className="premium-input-icon" size={16} />
                <input type="number" name="total_copies" value={formData.total_copies} onChange={handleChange} min="1" required />
              </div>
            </div>
            
            <div className="premium-form-group">
              <label>Available Copies *</label>
              <div className="premium-input-wrapper">
                <FileText className="premium-input-icon" size={16} />
                <input type="number" name="available_copies" value={formData.available_copies} onChange={handleChange} min="0" required />
              </div>
            </div>
          </div>

          {/* Column 3: Logistics & Identifiers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="premium-form-group">
              <label>Location</label>
              <div className="premium-input-wrapper">
                <MapPin className="premium-input-icon" size={16} />
                <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Shelf A-3" />
              </div>
            </div>
            
            <div className="premium-form-group">
              <label>Price (₹)</label>
              <div className="premium-input-wrapper">
                <DollarSign className="premium-input-icon" size={16} />
                <input type="number" name="price" value={formData.price} onChange={handleChange} step="0.01" />
              </div>
            </div>

            <div className="premium-form-group">
              <label>Barcode Value (Auto-Gen)</label>
              <div className="premium-input-wrapper">
                <Hash className="premium-input-icon" size={16} />
                <input type="text" name="barcode_value" value={formData.barcode_value} onChange={handleChange} onBlur={handleValidateBarcode} placeholder="e.g. LIB-9780123456" />
              </div>
            </div>

            <div className="premium-form-group">
              <label>QR Code Value (Auto-Gen)</label>
              <div className="premium-input-wrapper">
                <Hash className="premium-input-icon" size={16} />
                <input type="text" name="qr_value" value={formData.qr_value} onChange={handleChange} onBlur={handleValidateQr} placeholder="e.g. QR-LIB-9780123456" />
              </div>
            </div>
          </div>
        </div>

        {/* Lower Row: Cover Image Upload & Barcode/QR Previews side-by-side to save space */}
        <div className="modal-lower-row">
          {/* Cover Image Upload Area */}
          <div className="premium-form-group">
            <label>Book Cover Image</label>
            {!formData.cover_image ? (
              <label className="drag-drop-zone" style={{ padding: '1rem', minHeight: '100px' }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files?.[0]); }}>
                <UploadCloud size={24} color="var(--gold)" />
                <div style={{ fontSize: '0.85rem' }}><strong>Drag & drop</strong> or click to upload cover</div>
                <input type="file" accept="image/*" onChange={e => handleFileChange(e.target.files?.[0])} style={{ display: 'none' }} />
              </label>
            ) : (
              <div className="drag-drop-preview-container" style={{ padding: '0.5rem 1rem', marginTop: 0 }}>
                <img src={formData.cover_image} alt="Book cover preview" className="drag-drop-preview-img" style={{ width: '45px', height: '60px' }} />
                <div className="drag-drop-preview-info">
                  <div className="drag-drop-preview-title" style={{ fontSize: '0.8rem' }}>{formData.title || 'Untitled Book'} Cover</div>
                  <button type="button" className="drag-drop-preview-remove" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setFormData(prev => ({ ...prev, cover_image: '' }))}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Barcode & QR Previews */}
          {currentBarcode && (
            <div style={{ padding: '0.75rem 1rem', background: '#fffdf9', borderRadius: '16px', border: '1px dashed rgba(212,160,23,0.3)', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-around', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <img src={getBarcodeImageUrl(currentBarcode)} alt="Barcode" style={{ maxHeight: '36px', background: '#fff', padding: '2px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'monospace', color: '#334155', marginTop: '2px' }}>{currentBarcode}</span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <img src={getQrImageUrl(currentQr)} alt="QR" style={{ maxHeight: '42px', background: '#fff', padding: '2px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                <span style={{ display: 'block', fontSize: '0.65rem', fontFamily: 'monospace', color: '#334155', marginTop: '2px' }}>{currentQr}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="modal-footer">
        <button type="button" className="modal-btn modal-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="modal-btn modal-btn-save" disabled={loading}>
          {loading ? 'Saving...' : 'Save Book'}
        </button>
      </div>
    </form>
  );
};

export default BookForm;
import React, { useState, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api, browseBooks, getGenres, bulkDeleteBooks, exportBooksCsv, importBooksCsv } from '../services/api';
import BookForm from '../components/Books/BookForm';
import { PageHeader, StatusBadge, EmptyState, LoadingSkeleton } from '../components/layout/EnterpriseLibrary';
import { BookOpen, Star, Heart } from 'lucide-react';
import '../styles/design-tokens.css';
import './books.css';

// Memoized SVG Icons for render optimization
const IconSearch = memo(() => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
));

const IconFilter = memo(() => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
));

const IconChevronLeft = memo(() => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
));

const IconChevronRight = memo(() => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
));

const IconTrash = memo(() => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
));

const Books = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLibrarian, setIsLibrarian] = useState(false);
  const [isStudent, setIsStudent] = useState(false);

  // Advanced Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState(''); // '', 'available', 'unavailable'
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [genres, setGenres] = useState([]);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalBooks, setTotalBooks] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Bulk Action States
  const [selectedBookIds, setSelectedBookIds] = useState([]);

  // CSV Import/Export States
  const [importStatus, setImportStatus] = useState('');
  const [importErrors, setImportErrors] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
            setIsAdmin(user.role === 'admin');
            setIsLibrarian(user.role === 'librarian');
            setIsStudent(user.role === 'member');
      } catch (e) {
        console.error(e);
      }
    }
    loadGenresList();
  }, []);

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showForm]);

  useEffect(() => {
    loadBooksData();
  }, [searchTerm, selectedGenre, availabilityFilter, sortBy, sortOrder, currentPage]);

  const loadGenresList = async () => {
    try {
      const distinctGenres = await getGenres();
      setGenres(distinctGenres);
    } catch (err) {
      console.error('Failed to load genres', err);
    }
  };

  const loadBooksData = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        query: searchTerm || undefined,
        genre: selectedGenre || undefined,
        is_available: availabilityFilter === 'available' ? true : availabilityFilter === 'unavailable' ? false : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        page_size: pageSize
      };
      const response = await browseBooks(params);
      setBooks(response.books || []);
      setTotalBooks(response.total || 0);
      setTotalPages(response.total_pages || 1);
    } catch (err) {
      setError('Failed to load books from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await bulkDeleteBooks([id]);
      setSelectedBookIds(prev => prev.filter(item => item !== id));
      loadBooksData();
      loadGenresList();
    } catch (err) {
      setError('Failed to delete book');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBookIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete all ${selectedBookIds.length} selected books?`)) return;
    try {
      await bulkDeleteBooks(selectedBookIds);
      setSelectedBookIds([]);
      loadBooksData();
      loadGenresList();
    } catch (err) {
      setError('Bulk delete failed');
    }
  };

  const handleCsvExport = async () => {
    try {
      const blob = await exportBooksCsv();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'library_books_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export books", err);
      alert("Failed to export books");
    }
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Importing books...');
    setImportErrors([]);
    try {
      const response = await importImportFile(file);
      setImportStatus(`Import successful! Added ${response.imported} books. Skipped ${response.skipped} rows.`);
      if (response.errors && response.errors.length > 0) {
        setImportErrors(response.errors);
      }
      loadBooksData();
      loadGenresList();
    } catch (err) {
      setImportStatus('CSV Import failed. Check file format.');
      setImportErrors([err.response?.data?.detail || 'Unexpected error occurred.']);
    }
  };

  const importImportFile = async (file) => {
    return await importBooksCsv(file);
  };

  const toggleSelectBook = (id) => {
    setSelectedBookIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedBookIds.length === books.length) {
      setSelectedBookIds([]);
    } else {
      setSelectedBookIds(books.map(b => b.id));
    }
  };

  const handleEdit = (book) => {
    setEditingBook(book);
    setShowForm(true);
  };

  const handleReserve = async (bookId) => {
    try {
      await api.post('/reservations/reserve', { book_id: bookId });
      setSuccess('Book reserved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reserve book');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleBorrow = async (bookId) => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.username) throw new Error("Could not find user details");

      await api.post('/borrows/issue', { student_id: user.username, book_id: bookId });
      setSuccess('Book issued successfully!');
      loadBooksData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to issue book');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleAdd = () => {
    setEditingBook(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingBook(null);
    loadBooksData();
    loadGenresList();
  };



  return (
    <div className="premium-page-wrapper">
      {/* ── PageHeader Component Migration ── */}
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--eu-color-border-main)', paddingBottom: '1.25rem' }}>
        <PageHeader
          title="Book Catalogue"
          actions={
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {isAdmin && (
                <>
                  <button className="add-btn" onClick={handleCsvExport} style={{ background: '#f5ecd5', color: 'var(--gold-dark)', border: '1px solid var(--gold)' }}>Export CSV</button>
                  <label className="add-btn" style={{ background: '#f5ecd5', color: 'var(--gold-dark)', border: '1px solid var(--gold)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    Import CSV
                    <input type="file" accept=".csv" onChange={handleCsvImport} style={{ display: 'none' }} />
                  </label>
                  <button className="add-btn" onClick={handleAdd}>Add New Book</button>
                </>
              )}
            </div>
          }
        />
      </div>

      {importStatus && (
        <div style={{ padding: '1rem', background: '#fbf7ed', border: '1.5px solid var(--gold)', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 'bold', color: 'var(--ink)' }}>{importStatus}</p>
          {importErrors.length > 0 && (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#b91c1c', maxHeight: '150px', overflowY: 'auto' }}>
              {importErrors.map((err, idx) => <li key={idx}>{err}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Advanced Search & Filtering Controls */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(226,211,179,0.5)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          <div className="search-bar" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fffdf9', borderRadius: '12px', border: '1.5px solid rgba(212,160,23,0.25)' }}>
            <IconSearch />
            <input
              type="text"
              placeholder="Search title, author, isbn..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <select
              value={selectedGenre}
              onChange={(e) => { setSelectedGenre(e.target.value); setCurrentPage(1); }}
              style={{ padding: '0.75rem', borderRadius: '12px', border: '1.5px solid rgba(212,160,23,0.25)', background: '#fffdf9', color: 'var(--ink)', fontSize: '0.9rem', outline: 'none' }}
            >
              <option value="">All Categories / Genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <select
              value={availabilityFilter}
              onChange={(e) => { setAvailabilityFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '0.75rem', borderRadius: '12px', border: '1.5px solid rgba(212,160,23,0.25)', background: '#fffdf9', color: 'var(--ink)', fontSize: '0.9rem', outline: 'none' }}
            >
              <option value="">All Availability Statuses</option>
              <option value="available">Available Only</option>
              <option value="unavailable">Unavailable Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1.5px solid rgba(212,160,23,0.25)', background: '#fffdf9', color: 'var(--ink)', fontSize: '0.9rem', outline: 'none' }}
            >
              <option value="created_at">Date Added</option>
              <option value="title">Book Title</option>
              <option value="author">Author Name</option>
              <option value="publication_year">Publish Year</option>
              <option value="price">Price</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '12px', border: '1.5px solid rgba(212,160,23,0.25)', background: '#fffdf9', color: 'var(--ink)', fontSize: '0.9rem', outline: 'none' }}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </div>

      {isAdmin && books.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdfcf9', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(226,211,179,0.5)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="checkbox"
              checked={selectedBookIds.length === books.length && books.length > 0}
              onChange={handleSelectAll}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
              Selected {selectedBookIds.length} of {books.length} items
            </span>
          </div>
          {selectedBookIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <IconTrash /> Delete Selected
            </button>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {success && (
        <div style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontWeight: '600' }}>
          {success}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem 0' }}>
          <LoadingSkeleton count={4} height="80px" />
        </div>
      ) : books.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', border: '1px solid var(--eu-color-border-main)' }}>
          <EmptyState
            message="No books matching filters found."
            description="Clear search queries or filters to browse all catalog items."
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <button className="add-btn" onClick={() => { setSearchTerm(''); setSelectedGenre(''); setAvailabilityFilter(''); setCurrentPage(1); }}>Clear Filters</button>
          </div>
        </div>
      ) : (
        <>
          <div className="books-grid">
            {books.map((book) => (
              <div key={book.id} className="book-card premium-book-card">
                <div className="card-cover-container">
                  {isAdmin && (
                    <div className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedBookIds.includes(book.id)}
                        onChange={() => toggleSelectBook(book.id)}
                      />
                    </div>
                  )}
                  {book.cover_image ? (
                    <img src={book.cover_image} alt={book.title} className="card-cover-img" />
                  ) : (
                    <div className="card-cover-placeholder">
                      <BookOpen size={48} color="var(--gold)" opacity={0.6} />
                    </div>
                  )}
                  <div className="card-status-badge">
                    <StatusBadge
                      label={book.is_available ? 'Available' : 'Unavailable'}
                      variant={book.is_available ? 'success' : 'danger'}
                    />
                  </div>
                  <div className="card-rating-badge">
                    <Star size={14} fill="var(--gold)" color="var(--gold)" />
                    <span className="rating-value">4.5</span>
                    <Heart size={14} fill="#f43f5e" color="#f43f5e" className="heart-icon" style={{ marginLeft: '6px' }} />
                  </div>
                </div>

                <div className="card-details-container">
                  <h3 className="card-title" title={book.title}>{book.title}</h3>
                  <p className="card-author">{book.author}</p>
                  <p className="card-isbn">ISBN: {book.isbn}</p>

                  <div className="card-divider"></div>

                  <div className="card-stats-grid">
                    <div className="book-stat-col">
                      <span className="book-stat-label">COPIES</span>
                      <span className="book-stat-value">{book.available_copies} / {book.total_copies}</span>
                    </div>
                    <div className="book-stat-col">
                      <span className="book-stat-label">GENRE</span>
                      <span className="book-stat-value">{book.genre || '—'}</span>
                    </div>
                    <div className="book-stat-col">
                      <span className="book-stat-label">PRICE</span>
                      <span className="book-stat-value">₹{book.price?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>

                <div className="card-actions-row">
                  <button className="btn-outline btn-view" onClick={() => navigate(`/books/${book.id}`)}>View</button>
                  
                  {(isAdmin || isLibrarian) ? (
                    <>
                      <button className="btn-outline btn-edit" onClick={() => handleEdit(book)}>Edit</button>
                      <button className="btn-outline" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }} onClick={() => navigate(`/issue-return?book_id=${book.id}`)}>Issue</button>
                    </>
                  ) : (
                    <>
                      {(book.is_available && book.available_copies > 0) ? (
                        <button className="btn-outline" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }} onClick={() => handleBorrow(book.id)}>Borrow</button>
                      ) : (
                        <button className="btn-outline" style={{ borderColor: '#3b82f6', color: '#3b82f6' }} onClick={() => handleReserve(book.id)}>Reserve</button>
                      )}
                    </>
                  )}
                  
                  {isAdmin && (
                    <button className="btn-outline btn-delete" onClick={() => handleDelete(book.id, book.title)}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '3rem' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '0.6rem 1rem', border: '1px solid rgba(212,160,23,0.3)', borderRadius: '10px', background: '#ffffff', color: 'var(--gold-dark)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <IconChevronLeft /> Prev
              </button>
              <span style={{ fontWeight: 'bold', color: 'var(--ink)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{ padding: '0.6rem 1rem', border: '1px solid rgba(212,160,23,0.3)', borderRadius: '10px', background: '#ffffff', color: 'var(--gold-dark)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                Next <IconChevronRight />
              </button>
            </div>
          )}
        </>
      )}
      {showForm && createPortal(
        <div className="modal-overlay">
          <div className="modal-container">
            <BookForm book={editingBook} onSave={handleFormClose} onCancel={handleFormClose} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Books;

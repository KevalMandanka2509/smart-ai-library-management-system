import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchBooksAdvanced, searchStudentsAdvanced, getGenres } from '../services/api';
import './books.css';
import './Dashboard.css';
import { Search, SlidersHorizontal, X, Book, GraduationCap } from 'lucide-react';
import { PageHeader } from '../components/layout/EnterpriseLibrary';


// ─────────────────────────────────────────────────────────────
// Highlight helper: wraps matched substring in <mark>
// ─────────────────────────────────────────────────────────────
const Highlight = ({ text, query }) => {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: 'rgba(212,160,23,0.25)', color: '#7a4f00', borderRadius: '3px', padding: '0 2px' }}>{part}</mark>
          : part
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Filter chip (active filter tag)
// ─────────────────────────────────────────────────────────────
const FilterChip = ({ label, value, onRemove }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)',
    color: '#b3861b', borderRadius: '999px', padding: '0.2rem 0.65rem',
    fontSize: '0.78rem', fontWeight: '700'
  }}>
    {label}: {value}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b3861b', lineHeight: 1, padding: 0 }}>×</button>
  </span>
);

// ─────────────────────────────────────────────────────────────
// Numbered pagination bar
// ─────────────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  const delta = 2;
  let prev = null;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      if (prev !== null && i - prev > 1) pages.push('…');
      pages.push(i);
      prev = i;
    }
  }
  return (
    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center', marginTop: '2.5rem', flexWrap: 'wrap' }}>
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        style={pgBtnStyle(false, page === 1)}
      >‹ Prev</button>
      {pages.map((p, i) =>
        typeof p === 'number'
          ? <button key={p} onClick={() => onChange(p)} style={pgBtnStyle(p === page, false)}>{p}</button>
          : <span key={i} style={{ padding: '0 0.25rem', color: '#9ca3af' }}>…</span>
      )}
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        style={pgBtnStyle(false, page === totalPages)}
      >Next ›</button>
    </div>
  );
};

const pgBtnStyle = (active, disabled) => ({
  padding: '0.4rem 0.75rem',
  border: active ? '1.5px solid #D4A017' : '1.5px solid rgba(226,211,179,0.5)',
  borderRadius: '8px',
  background: active ? 'rgba(212,160,23,0.1)' : '#fff',
  color: active ? '#b3861b' : '#1e1b15',
  fontWeight: active ? '800' : '600',
  fontSize: '0.875rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  transition: 'all 0.15s ease'
});

// ─────────────────────────────────────────────────────────────
// Sort control
// ─────────────────────────────────────────────────────────────
const SortControl = ({ sortBy, sortOrder, onSortChange, options }) => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    <select value={sortBy} onChange={e => onSortChange('sortBy', e.target.value)}
      style={{ padding: '0.5rem 0.75rem', border: '1.5px solid rgba(212,160,23,0.3)', borderRadius: '8px', background: '#fdfcf9', fontSize: '0.85rem', outline: 'none', color: '#1e1b15' }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
    <button onClick={() => onSortChange('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')}
      title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
      style={{ padding: '0.5rem 0.6rem', border: '1.5px solid rgba(212,160,23,0.3)', borderRadius: '8px', background: '#fdfcf9', cursor: 'pointer', fontSize: '1rem' }}>
      {sortOrder === 'asc' ? '↑' : '↓'}
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Book result card
// ─────────────────────────────────────────────────────────────
const BookCard = ({ book, query, navigate }) => (
  <div className="book-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/books/${book.id}`)}>
    <div className="book-card-header">
      <h3 style={{ fontSize: '1.05rem' }}><Highlight text={book.title} query={query} /></h3>
      <span className={`status ${book.is_available ? 'available' : 'unavailable'}`}>
        {book.is_available ? `${book.available_copies} left` : 'Unavailable'}
      </span>
    </div>
    <div className="book-card-body">
      <p><strong>Author:</strong> <Highlight text={book.author} query={query} /></p>
      <p><strong>ISBN:</strong> <Highlight text={book.isbn} query={query} /></p>
      {book.publisher && <p><strong>Publisher:</strong> <Highlight text={book.publisher} query={query} /></p>}
      {book.genre && <p><strong>Category:</strong> <Highlight text={book.genre} query={query} /></p>}
      {book.publication_year && <p><strong>Year:</strong> {book.publication_year}</p>}
      <p><strong>Copies:</strong> {book.available_copies}/{book.total_copies}</p>
    </div>
    <div className="book-card-actions">
      <button className="view-btn" onClick={e => { e.stopPropagation(); navigate(`/books/${book.id}`); }}>View Details</button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Student result row
// ─────────────────────────────────────────────────────────────
const StudentRow = ({ student, query }) => (
  <tr>
    <td style={{ fontWeight: '700' }}><Highlight text={student.full_name} query={query} /></td>
    <td><Highlight text={student.student_id} query={query} /></td>
    <td style={{ color: '#5c5549', fontSize: '0.88rem' }}><Highlight text={student.email} query={query} /></td>
    <td><Highlight text={student.course || '—'} query={query} /></td>
    <td><Highlight text={student.department || '—'} query={query} /></td>
    <td>
      <span className="table-badge" style={{ background: student.is_active ? '#dcfce7' : '#fee2e2', color: student.is_active ? '#166534' : '#b91c1c' }}>
        {student.is_active ? 'Active' : 'Inactive'}
      </span>
    </td>
  </tr>
);

// ─────────────────────────────────────────────────────────────
// Main AdvancedSearch page
// ─────────────────────────────────────────────────────────────
const BOOK_SORT_OPTIONS = [
  ['created_at', 'Date Added'],
  ['title', 'Title'],
  ['author', 'Author'],
  ['publication_year', 'Year'],
  ['price', 'Price'],
  ['isbn', 'ISBN'],
];

const STUDENT_SORT_OPTIONS = [
  ['full_name', 'Name'],
  ['student_id', 'Student ID'],
  ['email', 'Email'],
  ['course', 'Course'],
  ['department', 'Department'],
];

const AdvancedSearch = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine user role
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setIsAdmin(JSON.parse(stored).role === 'admin'); } catch (_) {}
    }
  }, []);

  // Tab: 'books' | 'students'
  const [activeTab, setActiveTab] = useState('books');

  // ── Search state ──────────────────────────────────────────
  const [query, setQuery]         = useState(searchParams.get('q') || '');
  const [debouncedQ, setDebouncedQ] = useState(query);

  // Book filters
  const [title, setTitle]         = useState('');
  const [isbn, setIsbn]           = useState('');
  const [author, setAuthor]       = useState('');
  const [genre, setGenre]         = useState('');
  const [publisher, setPublisher] = useState('');
  const [availability, setAvailability] = useState(''); // '' | 'true' | 'false'
  const [yearFrom, setYearFrom]   = useState('');
  const [yearTo, setYearTo]       = useState('');
  const [bookSortBy, setBookSortBy]     = useState('created_at');
  const [bookSortOrder, setBookSortOrder] = useState('desc');
  const [bookPage, setBookPage]   = useState(1);

  // Student filters
  const [studentId, setStudentId] = useState('');
  const [course, setCourse]       = useState('');
  const [department, setDepartment] = useState('');
  const [studentActive, setStudentActive] = useState('');
  const [stuSortBy, setStuSortBy]   = useState('full_name');
  const [stuSortOrder, setStuSortOrder] = useState('asc');
  const [stuPage, setStuPage]     = useState(1);

  // Genre list for dropdown
  const [genres, setGenres]       = useState([]);

  // Results
  const [bookResult, setBookResult]   = useState(null);
  const [stuResult, setStuResult]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Load genres once
  useEffect(() => {
    getGenres().then(setGenres).catch(() => {});
  }, []);

  // Sync query param to URL
  useEffect(() => {
    const params = {};
    if (query) params.q = query;
    setSearchParams(params, { replace: true });
  }, [query]);

  // ── Execute search ──────────────────────────────────────────
  const doSearch = useCallback(async () => {
    const hasAnyFilter = debouncedQ || title || isbn || author || genre || publisher || availability || yearFrom || yearTo;
    const stuHasFilter = debouncedQ || studentId || course || department || studentActive;
    if (!hasAnyFilter && !stuHasFilter) { setBookResult(null); setStuResult(null); return; }

    setLoading(true);
    setError('');
    try {
      const bookParams = {
        q: debouncedQ || undefined,
        title: title || undefined,
        isbn: isbn || undefined,
        author: author || undefined,
        genre: genre || undefined,
        publisher: publisher || undefined,
        is_available: availability === '' ? undefined : availability === 'true',
        year_from: yearFrom || undefined,
        year_to: yearTo || undefined,
        sort_by: bookSortBy,
        sort_order: bookSortOrder,
        page: bookPage,
        page_size: 12,
      };
      const bRes = await searchBooksAdvanced(bookParams);
      setBookResult(bRes);

      if (isAdmin && stuHasFilter) {
        const stuParams = {
          q: debouncedQ || undefined,
          student_id: studentId || undefined,
          course: course || undefined,
          department: department || undefined,
          is_active: studentActive === '' ? undefined : studentActive === 'true',
          sort_by: stuSortBy,
          sort_order: stuSortOrder,
          page: stuPage,
          page_size: 15,
        };
        const sRes = await searchStudentsAdvanced(stuParams);
        setStuResult(sRes);
      } else {
        setStuResult(null);
      }
    } catch (e) {
      setError('Search failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, title, isbn, author, genre, publisher, availability, yearFrom, yearTo,
      bookSortBy, bookSortOrder, bookPage, studentId, course, department,
      studentActive, stuSortBy, stuSortOrder, stuPage, isAdmin]);

  useEffect(() => { doSearch(); }, [doSearch]);

  // Reset page when filters change (but not when page itself changes)
  const resetBookPage = () => setBookPage(1);
  const resetStuPage  = () => setStuPage(1);

  const clearAllFilters = () => {
    setQuery(''); setTitle(''); setIsbn(''); setAuthor('');
    setGenre(''); setPublisher(''); setAvailability('');
    setYearFrom(''); setYearTo(''); setStudentId('');
    setCourse(''); setDepartment(''); setStudentActive('');
    setBookPage(1); setStuPage(1);
  };

  // Active filter chips
  const activeBookFilters = [
    title      && { label: 'Title',     value: title,      clear: () => { setTitle(''); resetBookPage(); } },
    isbn       && { label: 'ISBN',      value: isbn,       clear: () => { setIsbn(''); resetBookPage(); } },
    author     && { label: 'Author',    value: author,     clear: () => { setAuthor(''); resetBookPage(); } },
    genre      && { label: 'Category',  value: genre,      clear: () => { setGenre(''); resetBookPage(); } },
    publisher  && { label: 'Publisher', value: publisher,  clear: () => { setPublisher(''); resetBookPage(); } },
    availability && { label: 'Status', value: availability === 'true' ? 'Available' : 'Unavailable', clear: () => { setAvailability(''); resetBookPage(); } },
    yearFrom   && { label: 'From',      value: yearFrom,   clear: () => { setYearFrom(''); resetBookPage(); } },
    yearTo     && { label: 'To',        value: yearTo,     clear: () => { setYearTo(''); resetBookPage(); } },
  ].filter(Boolean);

  const highlightTerm = query || title || isbn || author || publisher || genre;

  

  return (
    <div className="premium-page-wrapper">
      {/* ── PageHeader Component Migration ── */}
      <PageHeader
        title="Advanced Search"
        subtitle={isAdmin ? 'Search across books, authors, ISBN, categories, publishers, and students' : 'Search across books, authors, ISBN, categories, publishers'}
        actions={<div />} 
      />

      {/* ── Main search bar ── */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(226,211,179,0.5)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="premium-input-wrapper" style={{ flex: 1, margin: 0 }}>
            <Search className="premium-input-icon" size={20} />
            <input
              id="adv-search-input"
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); resetBookPage(); resetStuPage(); }}
              placeholder="Search by title, author, ISBN, publisher, category…"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} style={{
                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex'
              }}>
                <X size={18} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              padding: '0.7rem 1.1rem', borderRadius: '10px', border: '1.5px solid rgba(212,160,23,0.3)',
              background: showFilters ? 'rgba(212,160,23,0.1)' : '#fff',
              color: showFilters ? '#b3861b' : '#5c5549',
              fontWeight: '700', fontSize: '0.875rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap'
            }}
          >
            <SlidersHorizontal size={16} />
            Filters {activeBookFilters.length > 0 && `(${activeBookFilters.length})`}
          </button>
          {(query || activeBookFilters.length > 0) && (
            <button onClick={clearAllFilters} style={{
              padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1.5px solid rgba(220,38,38,0.2)',
              background: 'rgba(220,38,38,0.05)', color: '#dc2626',
              fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap'
            }}>Clear All</button>
          )}
        </div>

        {/* ── Expanded Filter Panel ── */}
        {showFilters && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(226,211,179,0.4)' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#5c5549', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Book Filters
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <label className="premium-label">Title</label>
                <div className="premium-input-wrapper no-icon">
                  <input value={title} onChange={e => { setTitle(e.target.value); resetBookPage(); }} placeholder="Exact title…" />
                </div>
              </div>
              <div>
                <label className="premium-label">ISBN</label>
                <div className="premium-input-wrapper no-icon">
                  <input value={isbn} onChange={e => { setIsbn(e.target.value); resetBookPage(); }} placeholder="ISBN…" />
                </div>
              </div>
              <div>
                <label className="premium-label">Author</label>
                <div className="premium-input-wrapper no-icon">
                  <input value={author} onChange={e => { setAuthor(e.target.value); resetBookPage(); }} placeholder="Author name…" />
                </div>
              </div>
              <div>
                <label className="premium-label">Publisher</label>
                <div className="premium-input-wrapper no-icon">
                  <input value={publisher} onChange={e => { setPublisher(e.target.value); resetBookPage(); }} placeholder="Publisher…" />
                </div>
              </div>
              <div>
                <label className="premium-label">Category</label>
                <div className="premium-input-wrapper no-icon">
                  <select value={genre} onChange={e => { setGenre(e.target.value); resetBookPage(); }}>
                    <option value="">All Categories</option>
                    {genres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="premium-label">Availability</label>
                <div className="premium-input-wrapper no-icon">
                  <select value={availability} onChange={e => { setAvailability(e.target.value); resetBookPage(); }}>
                    <option value="">All</option>
                    <option value="true">Available</option>
                    <option value="false">Unavailable</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="premium-label">Year From</label>
                <div className="premium-input-wrapper no-icon">
                  <input type="number" value={yearFrom} onChange={e => { setYearFrom(e.target.value); resetBookPage(); }} placeholder="e.g. 2000" min="1000" max="2100" />
                </div>
              </div>
              <div>
                <label className="premium-label">Year To</label>
                <div className="premium-input-wrapper no-icon">
                  <input type="number" value={yearTo} onChange={e => { setYearTo(e.target.value); resetBookPage(); }} placeholder="e.g. 2024" min="1000" max="2100" />
                </div>
              </div>
            </div>

            {isAdmin && (
              <>
                <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#5c5549', margin: '1rem 0 1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Student Filters
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label className="premium-label">Student ID</label>
                    <div className="premium-input-wrapper no-icon">
                      <input value={studentId} onChange={e => { setStudentId(e.target.value); resetStuPage(); }} placeholder="STU-…" />
                    </div>
                  </div>
                  <div>
                    <label className="premium-label">Course</label>
                    <div className="premium-input-wrapper no-icon">
                      <input value={course} onChange={e => { setCourse(e.target.value); resetStuPage(); }} placeholder="Course…" />
                    </div>
                  </div>
                  <div>
                    <label className="premium-label">Department</label>
                    <div className="premium-input-wrapper no-icon">
                      <input value={department} onChange={e => { setDepartment(e.target.value); resetStuPage(); }} placeholder="Department…" />
                    </div>
                  </div>
                  <div>
                    <label className="premium-label">Status</label>
                    <div className="premium-input-wrapper no-icon">
                      <select value={studentActive} onChange={e => { setStudentActive(e.target.value); resetStuPage(); }}>
                        <option value="">All</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Active filter chips ── */}
        {activeBookFilters.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {activeBookFilters.map((f, i) => (
              <FilterChip key={i} label={f.label} value={f.value} onRemove={f.clear} />
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid rgba(226,211,179,0.3)' }}>
          {[
            ['books', 'Books', bookResult?.total, Book],
            ['students', 'Students', stuResult?.total, GraduationCap]
          ].map(([tab, label, count, Icon]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '0.75rem 1.5rem', border: 'none', background: 'transparent',
              color: activeTab === tab ? 'var(--gold-dark)' : '#9ca3af',
              fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              borderBottom: activeTab === tab ? '3px solid var(--gold)' : '3px solid transparent',
              marginBottom: '-2px', transition: 'all 0.2s ease'
            }}>
              <Icon size={18} />
              {label}
              {count !== undefined && (
                <span style={{ background: activeTab === tab ? 'rgba(212,160,23,0.15)' : '#f1f5f9', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', color: activeTab === tab ? 'var(--gold-dark)' : '#6b7280' }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {/* ── No query state ── */}
      {!query && activeBookFilters.length === 0 && !studentId && !course && !department && (
        <div className="empty-state" style={{ padding: '5rem 2rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
          <p>Type anything to start searching the library catalogue</p>
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Try: a book title, author name, ISBN, publisher, or category
          </p>
        </div>
      )}

      {loading && (
        <div className="loading" style={{ minHeight: '250px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(212,160,23,0.15)', borderTopColor: '#D4A017', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ marginTop: '0.75rem' }}>Searching…</span>
        </div>
      )}

      {/* ═══════════════════════════
          BOOKS TAB
      ═══════════════════════════ */}
      {!loading && (activeTab === 'books' || !isAdmin) && bookResult && (
        <div>
          {/* Results header + sort */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#1e1b15' }}>
                {bookResult.total.toLocaleString()} book{bookResult.total !== 1 ? 's' : ''} found
              </span>
              {highlightTerm && (
                <span style={{ color: '#5c5549', fontSize: '0.88rem', marginLeft: '0.5rem' }}>
                  for "<strong>{highlightTerm}</strong>"
                </span>
              )}
            </div>
            <SortControl
              sortBy={bookSortBy}
              sortOrder={bookSortOrder}
              onSortChange={(key, val) => {
                if (key === 'sortBy') { setBookSortBy(val); resetBookPage(); }
                else { setBookSortOrder(val); resetBookPage(); }
              }}
              options={BOOK_SORT_OPTIONS}
            />
          </div>

          {bookResult.results.length === 0 ? (
            <div className="empty-state" style={{ padding: '4rem 2rem' }}>
              <p>No books found matching your search criteria.</p>
              <button onClick={clearAllFilters}>Clear Filters</button>
            </div>
          ) : (
            <>
              <div className="books-grid">
                {bookResult.results.map(book => (
                  <BookCard key={book.id} book={book} query={highlightTerm} navigate={navigate} />
                ))}
              </div>
              <Pagination page={bookPage} totalPages={bookResult.total_pages} onChange={p => { setBookPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.82rem', color: '#9ca3af' }}>
                Page {bookResult.page} of {bookResult.total_pages} · {bookResult.total} total results
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════
          STUDENTS TAB  (admin only)
      ═══════════════════════════ */}
      {!loading && activeTab === 'students' && isAdmin && (
        <div>
          {!stuResult ? (
            <div className="empty-state" style={{ padding: '4rem 2rem' }}>
              <p>Enter a search term or apply student filters to search members.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#1e1b15' }}>
                  {stuResult.total.toLocaleString()} student{stuResult.total !== 1 ? 's' : ''} found
                </span>
                <SortControl
                  sortBy={stuSortBy}
                  sortOrder={stuSortOrder}
                  onSortChange={(key, val) => {
                    if (key === 'sortBy') { setStuSortBy(val); resetStuPage(); }
                    else { setStuSortOrder(val); resetStuPage(); }
                  }}
                  options={STUDENT_SORT_OPTIONS}
                />
              </div>

              {stuResult.results.length === 0 ? (
                <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                  <p>No students match your search criteria.</p>
                </div>
              ) : (
                <>
                  <div style={{ background: '#fff', border: '1px solid rgba(226,211,179,0.5)', borderRadius: '16px', padding: '1.5rem', overflowX: 'auto' }}>
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Name</th><th>Student ID</th><th>Email</th><th>Course</th><th>Department</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stuResult.results.map(s => (
                          <StudentRow key={s.id} student={s} query={highlightTerm} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={stuPage} totalPages={stuResult.total_pages} onChange={p => { setStuPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;




import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader } from '../components/layout/EnterpriseLibrary';
import { getAuthors, createAuthor, updateAuthor, deleteAuthor } from '../services/api';
import { User, MapPin, Calendar, FileText, X, AlertTriangle } from 'lucide-react';
import './Authors.css';

const Authors = () => {
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState(null);
  const [formData, setFormData] = useState({ name: '', biography: '', birth_date: '', nationality: '', status: 'active' });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadAuthors = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAuthors(0, 1000, searchTerm, statusFilter);

      setTotalCount(data.length);

      // Client-side pagination
      const startIndex = (currentPage - 1) * pageSize;
      const paginated = data.slice(startIndex, startIndex + pageSize);
      setAuthors(paginated);
    } catch (err) {
      console.error(err);
      setError('Failed to load authors list.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    loadAuthors();
  }, [loadAuthors]);

  // Form handlers
  const handleAdd = () => {
    setEditingAuthor(null);
    setFormData({ name: '', biography: '', birth_date: '', nationality: '', status: 'active' });
    setFormError('');
    setShowForm(true);
  };

  const handleEdit = (author) => {
    setEditingAuthor(author);
    setFormData({
      name: author.name || '',
      biography: author.biography || '',
      birth_date: author.birth_date || '',
      nationality: author.nationality || '',
      status: author.status || 'active'
    });
    setFormError('');
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAuthor(null);
    setFormData({ name: '', biography: '', birth_date: '', nationality: '', status: 'active' });
    setFormError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Author name is required.');
      return;
    }

    setFormSaving(true);
    try {
      if (editingAuthor) {
        await updateAuthor(editingAuthor.id, formData);
      } else {
        await createAuthor(formData);
      }
      handleFormClose();
      loadAuthors();
    } catch (err) {
      const detail = err.response?.data?.detail || 'An error occurred. Please try again.';
      setFormError(detail);
    } finally {
      setFormSaving(false);
    }
  };

  // Delete handlers
  const handleDeleteClick = (author) => {
    setDeleteTarget(author);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAuthor(deleteTarget.id);
      setDeleteTarget(null);
      loadAuthors();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to delete author.';
      setDeleteError(detail);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
    setDeleteError('');
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="premium-page-wrapper">
      <PageHeader 
        title="Author Management" 
        actions={<button className="add-btn" onClick={handleAdd}>Add New Author</button>} 
      />

      {/* Advanced Filters Panel */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(226,211,179,0.5)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          <div>
            <div className="premium-input-wrapper no-icon">
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
          <div>
            <div className="premium-input-wrapper no-icon">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(212,160,23,0.15)', borderTopColor: '#D4A017', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <span>Loading Authors...</span>
        </div>
      ) : authors.length === 0 ? (
        <div className="empty-state" style={{ padding: '4rem 2rem' }}>
          <p>No authors found matching your search criteria.</p>
          <button onClick={() => { setSearchTerm(''); setStatusFilter(''); setCurrentPage(1); }}>Clear Filters</button>
        </div>
      ) : (
        <>
          <div className="authors-grid">
            {authors.map((author) => (
              <div key={author.id} className="author-card">
                <div className="author-card-header">
                  <div className="author-avatar">✍️</div>
                  <div className="author-info">
                    <h3>{author.name}</h3>
                    {author.nationality && <span className="author-meta">{author.nationality}</span>}
                  </div>
                  <span className={`status ${author.status === 'active' ? 'active' : 'inactive'}`}>
                    {author.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="author-card-body">
                  {author.birth_date && <p className="truncate"><strong>Born:</strong> {author.birth_date}</p>}
                  {author.biography && <p className="bio-text"><strong>Bio:</strong> {author.biography}</p>}
                  {!author.biography && !author.birth_date && (
                    <p style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>No additional details provided.</p>
                  )}
                </div>

                <div className="author-card-actions">
                  <button className="edit-btn" onClick={() => handleEdit(author)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDeleteClick(author)}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '3rem' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '0.6rem 1rem', border: '1px solid rgba(212,160,23,0.3)', borderRadius: '10px', background: '#ffffff', color: 'var(--gold-dark)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Prev
              </button>
              <span style={{ fontWeight: 'bold', color: 'var(--ink)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{ padding: '0.6rem 1rem', border: '1px solid rgba(212,160,23,0.3)', borderRadius: '10px', background: '#ffffff', color: 'var(--gold-dark)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Author Modal */}
      {showForm && createPortal(
        <div className="modal-overlay">
          <div className="modal-container modal-container-sm">
            <div className="modal-header">
              <div className="modal-title-area">
                <div className="modal-icon-wrapper">
                  <User size={24} />
                </div>
                <div>
                  <h2>{editingAuthor ? 'Edit Author' : 'Add New Author'}</h2>
                  <div className="modal-subtitle">
                    {editingAuthor ? 'Modify author profile details' : 'Register a new library author'}
                  </div>
                </div>
              </div>
              <button className="modal-close-btn" onClick={handleFormClose} title="Close">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {formError && (
                <div style={{ marginBottom: '1.25rem', padding: '0.8rem 1rem', background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                  {formError}
                  <button type="button" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => setFormError('')}>✕</button>
                </div>
              )}
              <form id="author-form" onSubmit={handleFormSubmit}>
                <div className="premium-form-group" style={{ marginBottom: '1rem' }}>
                  <label>Author Name *</label>
                  <div className="premium-input-wrapper">
                    <User className="premium-input-icon" size={16} />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. J.K. Rowling"
                      required
                    />
                  </div>
                </div>

                <div className="premium-form-grid two-cols" style={{ marginBottom: '1rem' }}>
                  <div className="premium-form-group">
                    <label>Nationality</label>
                    <div className="premium-input-wrapper">
                      <MapPin className="premium-input-icon" size={16} />
                      <input
                        type="text"
                        value={formData.nationality}
                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                        placeholder="e.g. British"
                      />
                    </div>
                  </div>

                  <div className="premium-form-group">
                    <label>Birth Date</label>
                    <div className="premium-input-wrapper">
                      <Calendar className="premium-input-icon" size={16} />
                      <input
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="premium-form-group" style={{ marginBottom: '1rem' }}>
                  <label>Biography</label>
                  <div className="premium-input-wrapper" style={{ alignItems: 'flex-start' }}>
                    <FileText className="premium-input-icon" size={16} style={{ top: '0.75rem' }} />
                    <textarea
                      value={formData.biography}
                      onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                      placeholder="Brief biography of the author..."
                      rows={3}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </div>

                <div className="premium-form-group">
                  <label>Status</label>
                  <div className="premium-input-wrapper no-icon">
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button type="button" className="modal-btn modal-btn-cancel" onClick={handleFormClose}>Cancel</button>
              <button type="submit" form="author-form" className="modal-btn modal-btn-save" disabled={formSaving}>
                {formSaving ? 'Saving...' : (editingAuthor ? 'Update Author' : 'Add Author')}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && createPortal(
        <div className="modal-overlay">
          <div className="modal-container modal-container-sm">
            <div className="modal-header">
              <div className="modal-title-area">
                <div className="modal-icon-wrapper" style={{ background: '#fef2f2', color: '#ef4444' }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h2 style={{ color: '#b91c1c' }}>Delete Author</h2>
                </div>
              </div>
            </div>
            
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <p style={{ fontSize: '1.05rem', color: 'var(--ink)' }}>Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>?</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '0.5rem' }}>This action will soft-delete the author. Books referencing this author must be reassigned first.</p>
              
              {deleteError && (
                <div style={{ marginTop: '1rem', padding: '0.8rem', background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.85rem' }}>
                  {deleteError}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="modal-btn modal-btn-cancel" onClick={handleDeleteCancel}>Cancel</button>
              <button className="modal-btn modal-btn-save" style={{ background: '#ef4444', boxShadow: '0 4px 12px rgba(239,68,68,0.2)' }} onClick={handleDeleteConfirm} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default Authors;



import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/api';
import { Layers, FileText, Settings, X, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/layout/EnterpriseLibrary';
import './Categories.css';

const Categories = () => {
  const [categories, setCategories] = useState([]);
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
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', status: 'active' });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getCategories(0, 1000, searchTerm, statusFilter);

      setTotalCount(data.length);

      // Client-side pagination
      const startIndex = (currentPage - 1) * pageSize;
      const paginated = data.slice(startIndex, startIndex + pageSize);
      setCategories(paginated);
    } catch (err) {
      setError('Failed to load categories list.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Form handlers
  const handleAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', status: 'active' });
    setFormError('');
    setShowForm(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      status: category.status || 'active'
    });
    setFormError('');
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '', status: 'active' });
    setFormError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    setFormSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
      } else {
        await createCategory(formData);
      }
      handleFormClose();
      loadCategories();
    } catch (err) {
      const detail = err.response?.data?.detail || 'An error occurred. Please try again.';
      setFormError(detail);
    } finally {
      setFormSaving(false);
    }
  };

  // Delete handlers
  const handleDeleteClick = (category) => {
    setDeleteTarget(category);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      loadCategories();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to delete category.';
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
          title="Category Management"
          actions={
            <button className="add-btn" onClick={handleAdd}>Add New Category</button>
          }
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
          <span>Loading Categories...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="empty-state" style={{ padding: '4rem 2rem' }}>
          <p>No categories found matching your search criteria.</p>
          <button onClick={() => { setSearchTerm(''); setStatusFilter(''); setCurrentPage(1); }}>Clear Filters</button>
        </div>
      ) : (
        <>
          <div className="categories-grid">
            {categories.map((category) => (
              <div key={category.id} className="category-card">
                <div className="category-card-header">
                  <div className="category-avatar">📂</div>
                  <div className="category-info">
                    <h3>{category.name}</h3>
                  </div>
                  <span className={`status ${category.status === 'active' ? 'active' : 'inactive'}`}>
                    {category.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="category-card-body">
                  {category.description ? (
                    <p className="desc-text">{category.description}</p>
                  ) : (
                    <p style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>No description provided.</p>
                  )}
                </div>

                <div className="category-card-actions">
                  <button className="edit-btn" onClick={() => handleEdit(category)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDeleteClick(category)}>Delete</button>
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

      {/* Add/Edit Category Modal */}
      {showForm && createPortal(
        <div className="modal-overlay">
          <div className="modal-container modal-container-sm">
            <div className="modal-header">
              <div className="modal-title-area">
                <div className="modal-icon-wrapper">
                  <Layers size={24} />
                </div>
                <div>
                  <h2>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
                  <div className="modal-subtitle">
                    {editingCategory ? 'Modify category details' : 'Create a new book category'}
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
              <form id="category-form" onSubmit={handleFormSubmit}>
                <div className="premium-form-group" style={{ marginBottom: '1rem' }}>
                  <label>Category Name *</label>
                  <div className="premium-input-wrapper">
                    <Layers className="premium-input-icon" size={16} />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Science Fiction"
                      required
                    />
                  </div>
                </div>

                <div className="premium-form-group" style={{ marginBottom: '1rem' }}>
                  <label>Description</label>
                  <div className="premium-input-wrapper" style={{ alignItems: 'flex-start' }}>
                    <FileText className="premium-input-icon" size={16} style={{ top: '0.75rem' }} />
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of the category..."
                      rows={4}
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
              <button type="submit" form="category-form" className="modal-btn modal-btn-save" disabled={formSaving}>
                {formSaving ? 'Saving...' : (editingCategory ? 'Update Category' : 'Add Category')}
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
                  <h2 style={{ color: '#b91c1c' }}>Delete Category</h2>
                </div>
              </div>
            </div>
            
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <p style={{ fontSize: '1.05rem', color: 'var(--ink)' }}>Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>?</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '0.5rem' }}>This action will soft-delete the category. Books referencing this category must be reassigned first.</p>
              
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

export default Categories;




import React, { useState, useEffect } from 'react';
import { createAdminUser, updateAdminUser, updateUserRolePermissions } from '../../services/api';
import { User, Mail, Shield, Key, Check, ShieldCheck, X } from 'lucide-react';
import './UserForm.css';

const SYSTEM_PERMISSIONS = [
  { code: "books:read", name: "View Books", category: "Books" },
  { code: "books:write", name: "Create & Edit Books", category: "Books" },
  { code: "books:delete", name: "Delete Books", category: "Books" },
  { code: "borrows:manage", name: "Issue & Return Books", category: "Circulation" },
  { code: "fines:manage", name: "Manage & Collect Fines", category: "Circulation" },
  { code: "reservations:manage", name: "Manage Reservations", category: "Circulation" },
  { code: "students:manage", name: "Manage Student Accounts", category: "Users" },
  { code: "reports:view", name: "View Analytics & Reports", category: "Analytics" },
  { code: "admin:manage", name: "Full System Administration", category: "Admin" }
];

const ROLE_DEFAULT_PERMISSIONS = {
  "admin": SYSTEM_PERMISSIONS.map(p => p.code),
  "librarian": ["books:read", "books:write", "students:read", "borrows:manage", "reservations:manage"],
  "member": ["books:read"]
};

const UserForm = ({ user, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'librarian',
    permissions: ROLE_DEFAULT_PERMISSIONS['librarian']
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        full_name: user.full_name || '',
        password: '',
        role: user.role || 'member',
        permissions: user.permissions || []
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'role') {
      // Auto-update permissions when role changes (for both new and existing users)
      setFormData({
        ...formData,
        [name]: value,
        permissions: ROLE_DEFAULT_PERMISSIONS[value] || []
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handlePermissionToggle = (code) => {
    setFormData((prev) => {
      const perms = prev.permissions.includes(code)
        ? prev.permissions.filter(p => p !== code)
        : [...prev.permissions, code];
      return { ...prev, permissions: perms };
    });
  };

  const validate = () => {
    if (!user && !formData.username.trim()) { setError('Username is required'); return false; }
    if (!formData.full_name.trim()) { setError('Full name is required'); return false; }
    if (!formData.email.trim()) { setError('Email is required'); return false; }
    if (!formData.email.includes('@')) { setError('Please enter a valid email'); return false; }
    if (!user && !formData.password) { setError('Password is required for new users'); return false; }
    if (formData.password && formData.password.length < 8) { setError('Password must be at least 8 characters long'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      if (user?.id) {
        // Update basic details
        await updateAdminUser(user.id, {
          full_name: formData.full_name,
          email: formData.email,
          ...(formData.password ? { password: formData.password } : {})
        });
        
        // Update role and permissions separately (as per backend design)
        if (formData.role !== user.role || JSON.stringify(formData.permissions) !== JSON.stringify(user.permissions)) {
          await updateUserRolePermissions(user.id, {
            role: formData.role,
            permissions: formData.permissions
          });
        }
        
        setSuccess('User updated successfully!');
      } else {
        await createAdminUser(formData);
        setSuccess('User added successfully!');
      }
      setTimeout(() => {
        if (onSave) onSave();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by category for the UI
  const groupedPermissions = SYSTEM_PERMISSIONS.reduce((acc, perm) => {
    acc[perm.category] = acc[perm.category] || [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
      {/* Modal Header */}
      <div className="modal-header">
        <div className="modal-title-area">
          <div className="modal-icon-wrapper">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2>{user?.id ? 'Edit User Details' : 'Add New System User'}</h2>
            <div className="modal-subtitle">
              {user?.id ? 'Modify user account and access roles' : 'Create a new staff or admin account'}
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={onCancel} title="Close">
          <X size={20} />
        </button>
      </div>

      {/* Modal Body */}
      <div className="modal-body">
        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.8rem 1rem', background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
            {error}
            <button type="button" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => setError('')}>✕</button>
          </div>
        )}
        
        {success && (
          <div style={{ marginBottom: '1.25rem', padding: '0.8rem 1rem', background: '#ecfdf5', border: '1px solid #d1fae5', color: '#047857', borderRadius: '12px', fontSize: '0.9rem' }}>
            {success}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="premium-form-grid two-cols">
            <div className="premium-form-group">
              <label>Username *</label>
              <div className="premium-input-wrapper">
                <User className="premium-input-icon" size={16} />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="e.g. johndoe"
                  disabled={!!user}
                  required
                />
              </div>
            </div>

            <div className="premium-form-group">
              <label>Full Name *</label>
              <div className="premium-input-wrapper">
                <User className="premium-input-icon" size={16} />
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
            </div>

            <div className="premium-form-group">
              <label>Email *</label>
              <div className="premium-input-wrapper">
                <Mail className="premium-input-icon" size={16} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. john@example.com"
                  required
                />
              </div>
            </div>

            <div className="premium-form-group">
              <label>{user ? 'Reset Password' : 'Password *'}</label>
              <div className="premium-input-wrapper">
                <Key className="premium-input-icon" size={16} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={user ? 'Leave blank to keep current' : 'Enter strong password'}
                  required={!user}
                />
              </div>
            </div>

            <div className="premium-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>System Role *</label>
              <div className="premium-input-wrapper">
                <Shield className="premium-input-icon" size={16} />
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  disabled={user?.username === 'admin'}
                >
                  <option value="member">Member (Student)</option>
                  <option value="librarian">Librarian</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed rgba(212,160,23,0.3)', paddingTop: '1.25rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--ink)' }}>Access Permissions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div key={category} style={{ background: '#fffdf9', border: '1px solid rgba(212,160,23,0.15)', borderRadius: '12px', padding: '1rem' }}>
                  <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{category}</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {perms.map(p => (
                      <label key={p.code} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: (formData.role === 'admin' || user?.username === 'admin') ? 'not-allowed' : 'pointer', opacity: (formData.role === 'admin' || user?.username === 'admin') ? 0.6 : 1 }}>
                        <div style={{ 
                          width: '18px', height: '18px', borderRadius: '4px', border: '1.5px solid var(--gold)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: formData.permissions.includes(p.code) ? 'var(--gold)' : 'transparent'
                        }}>
                          {formData.permissions.includes(p.code) && <Check size={12} color="#fff" strokeWidth={3} />}
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(p.code)}
                          onChange={() => handlePermissionToggle(p.code)}
                          disabled={formData.role === 'admin' || user?.username === 'admin'}
                          style={{ display: 'none' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* Modal Footer */}
      <div className="modal-footer">
        <button type="button" className="modal-btn modal-btn-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="modal-btn modal-btn-save" disabled={loading}>
          {loading ? 'Saving...' : 'Save User'}
        </button>
      </div>
    </form>
  );
};

export default UserForm;

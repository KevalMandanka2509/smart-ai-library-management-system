import React, { useState, useEffect } from 'react';
import { createAdminUser, updateAdminUser, updateUserRolePermissions } from '../../services/api';
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
  "librarian": ["books:read", "books:write", "borrows:manage", "fines:manage", "reservations:manage", "students:manage", "reports:view"],
  "staff": ["books:read", "borrows:manage", "reservations:manage"],
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
    <div className="user-form-container">
      <h2>{user?.id ? 'Edit User' : 'Add New System User'}</h2>
      
      <form onSubmit={handleSubmit} className="user-form">
        {error && (
          <div className="error-message">
            {error}
            <button type="button" onClick={() => setError('')}>✕</button>
          </div>
        )}
        
        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        <div className="form-grid">
          {/* Left Column: Basic Details */}
          <div className="form-column">
            <h4 className="section-title">Account Details</h4>
            
            <div className="form-group">
              <label>Username *</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="johndoe"
                disabled={!!user} // Cannot change username after creation
                required
              />
              {user && <small>Username cannot be changed</small>}
            </div>

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label>{user ? 'Reset Password' : 'Password *'}</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={user ? 'Leave blank to keep current' : 'Enter strong password'}
                required={!user}
              />
              <small>Must contain uppercase, lowercase, number, and special char.</small>
            </div>
            
            <div className="form-group">
              <label>System Role *</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                disabled={user?.username === 'admin'} // Protect root admin
              >
                <option value="member">Member (Student)</option>
                <option value="librarian">Librarian</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          {/* Right Column: Permissions */}
          <div className="form-column permissions-column">
            <h4 className="section-title">Access Permissions</h4>
            <p className="permissions-hint">Toggle specific access rights for this user.</p>
            
            <div className="permissions-container">
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div key={category} className="permission-group">
                  <h5 className="permission-category">{category}</h5>
                  {perms.map(p => (
                    <label key={p.code} className="permission-label">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(p.code)}
                        onChange={() => handlePermissionToggle(p.code)}
                        disabled={formData.role === 'admin' || user?.username === 'admin'} // Admin has all rights
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-save">
            {loading ? 'Saving...' : 'Save User'}
          </button>
          <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;

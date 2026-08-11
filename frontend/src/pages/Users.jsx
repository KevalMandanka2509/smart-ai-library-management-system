import React, { useState, useEffect } from 'react';
import { formatIST } from '../utils/dateUtils';
import { getAdminUsers, deleteAdminUser } from '../services/api';
import { createPortal } from 'react-dom';
import UserForm from '../components/Users/UserForm';
import { PageHeader, DataTable, StatusBadge } from '../components/layout/EnterpriseLibrary';

import './Dashboard.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  // Pagination (Client-side since backend returns all)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminUsers();
      setUsers(data);
      setTotalUsers(data.length);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load system users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`Are you sure you want to delete user ${username}? This action will move them to the Recycle Bin.`)) {
      try {
        await deleteAdminUser(userId);
        loadUsers(); // Refresh list
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to delete user');
      }
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleSaveSuccess = () => {
    handleCloseModal();
    loadUsers();
  };

  // Client-side filtering
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  // Client-side pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    // Reset page when filters change
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  const getRoleVariant = (role) => {
    switch (role) {
      case 'admin': return 'danger';
      case 'librarian': return 'gold';
      case 'member': return 'info';
      default: return 'info';
    }
  };

  const columns = [
    {
      header: 'User Details',
      accessor: 'full_name',
      cell: (user) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--eu-color-primary, #D4A017)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '1.1rem'
          }}>
            {user.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--eu-color-text-main, #1e1b15)' }}>{user.full_name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--eu-color-text-soft, #9ca3af)' }}>{user.email}</div>
          </div>
        </div>
      )
    },
    { header: 'Username', accessor: 'username', cell: (user) => <span style={{ fontWeight: '600' }}>{user.username}</span> },
    { header: 'Role', accessor: 'role', cell: (user) => <StatusBadge label={user.role} variant={getRoleVariant(user.role)} /> },
    { header: 'Status', accessor: 'is_active', cell: (user) => <StatusBadge label={user.is_active ? 'Active' : 'Locked'} variant={user.is_active ? 'success' : 'danger'} /> },
    { header: 'Last Login', accessor: 'last_login', cell: (user) => (user.last_login ? formatIST(user.last_login) : 'Never') },
    {
      header: 'Actions',
      accessor: 'actions',
      align: 'right',
      cell: (user) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button 
            className="add-btn" 
            onClick={(e) => { e.stopPropagation(); handleEditUser(user); }}
            title="Edit User"
            style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.4rem', minWidth: 'auto', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button 
            className="add-btn" 
            onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id, user.username); }}
            title="Delete User"
            disabled={user.username === 'admin'}
            style={{ background: user.username === 'admin' ? '#f3f4f6' : '#fee2e2', color: user.username === 'admin' ? '#9ca3af' : '#b91c1c', border: `1px solid ${user.username === 'admin' ? '#e5e7eb' : '#fecaca'}`, padding: '0.4rem', minWidth: 'auto', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: user.username === 'admin' ? 'not-allowed' : 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      )
    }
  ];



  return (
    <div className="premium-page-wrapper">
      {/* Page Header */}
        <PageHeader 
          title="System Users" 
          subtitle="Manage library administrators, staff, and their roles."
          badgeText={`${users.length} Users`}
          actions={
            <button className="add-btn" onClick={handleCreateUser}>
              Add System User
            </button>
          }
        />

      {error && <div className="error-alert" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', border: '1px solid #fee2e2', fontWeight: 'bold' }}>{error}</div>}

      {/* Advanced Filters Panel */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(226,211,179,0.5)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          <div>
            <div className="premium-input-wrapper no-icon">
              <input
                type="text"
                placeholder="Search users by name, username, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <div className="premium-input-wrapper no-icon">
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="librarian">Librarian</option>
                <option value="member">Member</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ background: '#ffffff', borderRadius: '16px', padding: '2rem', border: '1px solid rgba(226,211,179,0.55)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={paginatedUsers} 
          loading={loading}
          emptyMessage="No users found matching your criteria."
        />

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid #e2d3b3' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '0.25rem 0.75rem', border: '1px solid #e2d3b3', background: currentPage === 1 ? '#f3f4f6' : '#fff', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    border: '1px solid #e2d3b3',
                    background: currentPage === page ? 'var(--eu-color-primary, #D4A017)' : '#fff',
                    color: currentPage === page ? '#fff' : 'inherit',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {page}
                </button>
              ))}
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '0.25rem 0.75rem', border: '1px solid #e2d3b3', background: currentPage === totalPages ? '#f3f4f6' : '#fff', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-container modal-container-sm">
            <UserForm 
              user={selectedUser} 
              onSave={handleSaveSuccess} 
              onCancel={handleCloseModal} 
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Users;



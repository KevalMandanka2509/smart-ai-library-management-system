import React, { useState, useEffect } from 'react';
import { formatIST } from '../utils/dateUtils';
import { getAdminUsers, deleteAdminUser } from '../services/api';
import UserForm from '../components/Users/UserForm';
import { PageHeader, DataTable, StatusBadge } from '../components/layout/EnterpriseLibrary';
import '../styles/design-tokens.css';
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
      case 'staff': return 'warning';
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
            className="btn-icon edit" 
            onClick={(e) => { e.stopPropagation(); handleEditUser(user); }}
            title="Edit User"
            style={{ padding: '0.4rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--eu-color-info)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button 
            className="btn-icon delete" 
            onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id, user.username); }}
            title="Delete User"
            disabled={user.username === 'admin'}
            style={{ padding: '0.4rem', border: 'none', background: 'transparent', cursor: user.username === 'admin' ? 'not-allowed' : 'pointer', color: user.username === 'admin' ? '#ccc' : 'var(--eu-color-danger)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      )
    }
  ];

  if (isModalOpen) {
    return (
      <UserForm 
        user={selectedUser} 
        onSave={handleSaveSuccess} 
        onCancel={handleCloseModal} 
      />
    );
  }

  return (
    <div className="eu-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <PageHeader 
        title="System Users" 
        subtitle="Manage library administrators, staff, and their roles."
        badgeText={`${users.length} Users`}
        actions={
          <button 
            className="eu-btn eu-btn-primary" 
            onClick={handleCreateUser}
            style={{
              background: 'var(--eu-color-primary, #D4A017)', color: '#fff', border: 'none', 
              padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            + Add System User
          </button>
        }
      />

      {error && <div className="eu-alert eu-alert-danger" style={{ marginBottom: '1rem', padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2d3b3', borderRadius: '4px', padding: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search users by name, username, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', width: '100%' }}
          />
        </div>
        
        <select 
          value={roleFilter} 
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2d3b3', background: '#fff' }}
        >
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="librarian">Librarian</option>
          <option value="staff">Staff</option>
          <option value="member">Member</option>
        </select>
      </div>

      <div className="eu-card" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2d3b3', overflow: 'hidden' }}>
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

    </div>
  );
};

export default Users;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getRecycleBinRecords, 
  restoreRecord, permanentDeleteRecord, emptyRecycleBin
} from '../services/api';
import { RefreshCw, Trash2, Search, History, AlertTriangle, Book, Users, Tags, GraduationCap, DollarSign, Database, Calendar } from 'lucide-react';
import { PageHeader, DataTable, StatusBadge } from '../components/layout/EnterpriseLibrary';
import { formatIST } from '../utils/dateUtils';
import '../styles/design-tokens.css';
import './RecycleBin.css';

const TABS = [
  { id: 'books', label: 'Books', icon: <Book size={16} /> },
  { id: 'authors', label: 'Authors', icon: <Users size={16} /> },
  { id: 'categories', label: 'Categories', icon: <Tags size={16} /> },
  { id: 'students', label: 'Students', icon: <GraduationCap size={16} /> },
  { id: 'fines', label: 'Fines', icon: <DollarSign size={16} /> }
];

const RecycleBin = () => {
  const [activeTab, setActiveTab] = useState('books');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  const [isEmptying, setIsEmptying] = useState(false);
  const [error, setError] = useState('');

  const showConfirm = ({ title, message, onConfirm }) => {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  };

  const showToast = useCallback((message, type) => {
    if (type === 'error') {
      alert(`Error: ${message}`);
    } else {
      alert(`Success: ${message}`);
    }
  }, []);

  const fetchRecords = useCallback(async (tab, page, search, limit) => {
    try {
      setLoading(true);
      setError('');
      const data = await getRecycleBinRecords(tab, page, limit, search);
      setRecords(data.records || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error('Error fetching recycle bin records:', err);
      setError('Failed to load recycle bin records. Make sure backend is running and you have admin access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords(activeTab, currentPage, searchTerm, pageSize);
  }, [activeTab, currentPage, pageSize, fetchRecords]);

  // Using a separate search state for typing vs actual search query
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  const handleRestore = async (id, name) => {
    showConfirm({
      title: 'Restore Record',
      message: `Are you sure you want to restore "${name}"?`,
      onConfirm: async () => {
        try {
          await restoreRecord(activeTab, id);
          showToast(`${name} restored successfully`, 'success');
          fetchRecords(activeTab, currentPage, searchTerm, pageSize);
        } catch (error) {
          console.error('Error restoring record:', error);
          showToast(error?.response?.data?.detail || 'Failed to restore record', 'error');
        }
      }
    });
  };

  const handlePermanentDelete = async (id, name) => {
    showConfirm({
      title: 'Delete Forever',
      message: `WARNING: This action cannot be undone. Are you sure you want to permanently delete "${name}"?`,
      onConfirm: async () => {
        try {
          await permanentDeleteRecord(activeTab, id);
          showToast(`${name} permanently deleted`, 'success');
          fetchRecords(activeTab, currentPage, searchTerm, pageSize);
        } catch (error) {
          console.error('Error deleting record permanently:', error);
          showToast(error?.response?.data?.detail || 'Failed to delete record permanently', 'error');
        }
      }
    });
  };

  const handleEmptyBin = async () => {
    if (records.length === 0) return;
    showConfirm({
      title: 'Empty Recycle Bin',
      message: `Are you sure you want to permanently delete ALL ${activeTab} from the recycle bin? This action cannot be undone.`,
      onConfirm: async () => {
        setIsEmptying(true);
        try {
          const res = await emptyRecycleBin(activeTab);
          showToast(`Permanently deleted ${res.deleted_count} records.`, 'success');
          fetchRecords(activeTab, 1, searchTerm, pageSize);
        } catch (e) {
          console.error(e);
          showToast(e?.response?.data?.detail || 'Failed to empty recycle bin', 'error');
        } finally {
          setIsEmptying(false);
        }
      }
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
        <Calendar size={14} style={{ color: 'var(--eu-color-primary)' }} />
        <span>{formatIST(dateStr)}</span>
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const columns = useMemo(() => [
    {
      header: 'Record Details',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '4px',
            background: 'var(--eu-color-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {TABS.find(t => t.id === activeTab)?.icon}
          </div>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--eu-color-text-main)' }}>{row.display_name}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>ID: {row.id.substring(0,8)}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Deleted At',
      cell: (row) => formatDate(row.deleted_at)
    },
    {
      header: 'Deleted By',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
            {row.deleted_by ? row.deleted_by.charAt(0).toUpperCase() : 'S'}
          </div>
          <span style={{ fontSize: '0.85rem' }}>{row.deleted_by || 'System'}</span>
        </div>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); handleRestore(row.id, row.display_name); }}
            title="Restore Record"
            style={{ padding: '0.4rem 0.8rem', border: '1px solid #10b981', background: '#ecfdf5', color: '#059669', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            <History size={14} /> Restore
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handlePermanentDelete(row.id, row.display_name); }}
            title="Delete Forever"
            style={{ padding: '0.4rem 0.8rem', border: '1px solid #ef4444', background: '#fef2f2', color: '#dc2626', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )
    }
  ], [activeTab, handleRestore, handlePermanentDelete]);

  return (
    <div className="eu-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <PageHeader 
        title="Recycle Bin" 
        subtitle="Manage soft-deleted records, restore them, or delete them permanently."
        badgeText={`${totalCount} Pending Records`}
        icon={<Trash2 size={24} color="var(--eu-color-primary)" />}
        actions={
          <button 
            onClick={handleEmptyBin} 
            disabled={isEmptying || records.length === 0}
            style={{
              background: records.length === 0 ? '#e5e7eb' : '#dc2626', 
              color: records.length === 0 ? '#9ca3af' : '#fff', 
              border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', 
              cursor: records.length === 0 ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <AlertTriangle size={16} /> 
            {isEmptying ? 'Emptying...' : 'Empty Current Tab'}
          </button>
        }
      />

      {error && <div className="eu-alert eu-alert-danger" style={{ marginBottom: '1rem', padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchInput('');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem',
                background: activeTab === tab.id ? 'var(--eu-color-primary)' : '#fff',
                color: activeTab === tab.id ? '#fff' : 'var(--eu-color-text-main)',
                border: activeTab === tab.id ? '1px solid var(--eu-color-primary)' : '1px solid #e2d3b3',
                borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} style={{ flex: '0 1 350px', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2d3b3', borderRadius: '8px', padding: '0.5rem' }}>
          <Search size={18} style={{ color: '#9ca3af' }} />
          <input
            type="text"
            placeholder={`Search ${TABS.find(t => t.id === activeTab)?.label.toLowerCase()}...`}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ border: 'none', outline: 'none', width: '100%', marginLeft: '0.5rem' }}
          />
        </form>
      </div>

      <div className="eu-card" style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2d3b3', overflow: 'hidden' }}>
        <DataTable 
          columns={columns} 
          data={records} 
          loading={loading}
          emptyMessage="Recycle Bin is Clean"
          emptyDescription={`There are no deleted ${TABS.find(t => t.id === activeTab)?.label.toLowerCase()} waiting for restoration.`}
        />

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid #e2d3b3' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Showing Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '0.25rem 0.75rem', border: '1px solid #e2d3b3', background: currentPage === 1 ? '#f3f4f6' : '#fff', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Prev
              </button>
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

export default RecycleBin;

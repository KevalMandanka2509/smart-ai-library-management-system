import React, { useState, useEffect } from 'react';
import { Star, FileText, Trash2, Copy, Play, Edit2, Check, X } from 'lucide-react';

const SavedReports = ({ onLoadReport, currentConfig }) => {
  const [reports, setReports] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('library_saved_reports');
    if (saved) {
      try {
        setReports(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing saved reports', e);
      }
    } else {
      // Default initial states
      const defaults = [
        { id: 1, name: 'Monthly Circulation Overview', type: 'monthly', period: 12, isFavorite: true },
        { id: 2, name: 'Weekly Overdue Targets', type: 'weekly', period: 4, isFavorite: false },
        { id: 3, name: 'Quarterly Financials', type: 'monthly', period: 3, isFavorite: true }
      ];
      setReports(defaults);
      localStorage.setItem('library_saved_reports', JSON.stringify(defaults));
    }
  }, []);

  const saveToStorage = (newReports) => {
    setReports(newReports);
    localStorage.setItem('library_saved_reports', JSON.stringify(newReports));
  };

  const toggleFavorite = (id) => {
    saveToStorage(reports.map(r => r.id === id ? { ...r, isFavorite: !r.isFavorite } : r));
  };

  const deleteReport = (id) => {
    saveToStorage(reports.filter(r => r.id !== id));
  };

  const duplicateReport = (report) => {
    saveToStorage([...reports, { ...report, id: Date.now(), name: `${report.name} (Copy)` }]);
  };

  const startRename = (report) => {
    setEditingId(report.id);
    setEditName(report.name);
  };

  const saveRename = (id) => {
    if (editName.trim()) {
      saveToStorage(reports.map(r => r.id === id ? { ...r, name: editName.trim() } : r));
    }
    setEditingId(null);
  };

  const saveCurrentView = () => {
    if (!currentConfig) return;
    const newReport = {
      id: Date.now(),
      name: `Custom ${currentConfig.type} Report`,
      type: currentConfig.type,
      period: currentConfig.period,
      isFavorite: false
    };
    saveToStorage([...reports, newReport]);
  };

  // Sort favorites first
  const sortedReports = [...reports].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(226,211,179,0.55)',
      borderRadius: '16px', padding: '1.5rem', boxShadow: '0 6px 20px rgba(20,18,15,0.04)',
      marginBottom: '1.5rem', height: '100%'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, fontWeight: '800', color: '#1e1b15' }}>Enterprise Saved Reports</h4>
        <button onClick={saveCurrentView} style={{
          padding: '0.4rem 0.75rem', background: 'rgba(212,160,23,0.1)', color: '#b3861b',
          border: '1.5px solid rgba(212,160,23,0.3)', borderRadius: '8px',
          fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer'
        }}>
          + Save Current View
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
        {sortedReports.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No saved reports found.</p>
        ) : (
          sortedReports.map(r => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 1rem', background: '#fdfcf9', border: '1px solid #f0e8d0',
              borderRadius: '8px', transition: 'all 0.2s ease'
            }} onMouseOver={(e) => e.currentTarget.style.borderColor = '#e2d3b3'} onMouseOut={(e) => e.currentTarget.style.borderColor = '#f0e8d0'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                <button onClick={() => toggleFavorite(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.isFavorite ? '#D4A017' : '#d1d5db', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <Star fill={r.isFavorite ? '#D4A017' : 'none'} size={18} />
                </button>
                
                {editingId === r.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <input 
                      autoFocus
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRename(r.id)}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', border: '1.5px solid #D4A017', borderRadius: '4px', outline: 'none', width: '100%' }} 
                    />
                    <button onClick={() => saveRename(r.id)} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', padding: 0 }}><Check size={16}/></button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}><X size={16}/></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e1b15' }}>{r.name}</span>
                      <button onClick={() => startRename(r)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, opacity: 0.7 }}><Edit2 size={12}/></button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{r.type.charAt(0).toUpperCase() + r.type.slice(1)} • Last {r.period} periods</span>
                  </div>
                )}
              </div>
              
              {editingId !== r.id && (
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  <button onClick={() => onLoadReport(r.type, r.period)} title="Load Report" style={{ padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: '700', background: '#D4A017', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    <Play size={14} /> Load
                  </button>
                  <button onClick={() => duplicateReport(r)} title="Duplicate" style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', background: '#f3f4f6', color: '#4b5563', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    <Copy size={14} />
                  </button>
                  <button onClick={() => deleteReport(r.id)} title="Delete" style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SavedReports;

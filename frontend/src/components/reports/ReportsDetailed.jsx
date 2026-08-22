import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { SectionCard } from './ReportsCore';
import { Download, X, Search, FileText, FileSpreadsheet, File } from 'lucide-react';

export const ReportsDetailedModal = ({ reportType, period, onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isExporting, setIsExporting] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/enterprise_analytics/detailed-report?type=${reportType}&period=${period}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, period]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const exportPDF = () => {
    if (!data.length) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF('landscape');
      
      // Header
      doc.setFontSize(16);
      doc.setTextColor(212, 160, 23); // Primary Gold
      doc.text('SMART LIBRARY', 14, 22);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 27, 21); // Text
      doc.text(`Reports & Analytics: ${reportType}`, 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);
      doc.text(`Period: ${period.replace(/_/g, ' ').toUpperCase()}`, 14, 44);

      const headers = Object.keys(data[0]);
      const rows = data.map(row => headers.map(h => row[h]));

      autoTable(doc, {
        startY: 50,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [212, 160, 23], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3, textColor: [30, 27, 21] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save(`SmartLibrary_${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error('PDF Export failed', e);
      alert('Export failed. Please try again.');
    }
    setIsExporting(false);
  };

  const exportCSV = () => {
    if (!data.length) return;
    setIsExporting(true);
    try {
      const headers = Object.keys(data[0]);
      const csvRows = [];
      csvRows.push(headers.join(','));

      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header] === null ? '' : String(row[header]);
          const escaped = val.replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SmartLibrary_${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('CSV Export failed', e);
      alert('Export failed. Please try again.');
    }
    setIsExporting(false);
  };

  const exportExcel = () => {
    if (!data.length) return;
    setIsExporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, reportType.substring(0, 31)); // Excel sheet names limited to 31 chars
      XLSX.writeFile(wb, `SmartLibrary_${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error('Excel Export failed', e);
      alert('Export failed. Please try again.');
    }
    setIsExporting(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#D4A017" />
              {reportType}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Period: {period.replace(/_/g, ' ')} • {data.length} records</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search in report..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button disabled={isExporting || loading || !data.length} onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
              <FileText size={16} color="#dc2626" /> {isExporting ? 'Preparing...' : 'PDF'}
            </button>
            <button disabled={isExporting || loading || !data.length} onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
              <File size={16} color="#64748b" /> {isExporting ? 'Preparing...' : 'CSV'}
            </button>
            <button disabled={isExporting || loading || !data.length} onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #16a34a', background: '#f0fdf4', color: '#15803d', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
              <FileSpreadsheet size={16} /> {isExporting ? 'Preparing...' : 'Excel'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>Loading report data...</div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>
              <p>Failed to load report data.</p>
              <button onClick={fetchReport} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>Retry</button>
            </div>
          ) : data.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>No data available for this period.</div>
          ) : filteredData.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>No results match your search.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                <tr>
                  {Object.keys(data[0]).map((h, i) => (
                    <th key={i} style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }} className="report-table-row">
                    {Object.keys(data[0]).map((h, j) => (
                      <td key={j} style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem', color: '#1e293b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[h] !== null ? row[h] : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Pagination */}
        {data.length > 0 && !loading && !error && (
          <div style={{ padding: '1rem 2rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
              <span>Rows per page:</span>
              <select 
                value={rowsPerPage} 
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, filteredData.length)} of {filteredData.length} records
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: page === 1 ? '#f8fafc' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
              <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: page === totalPages || totalPages === 0 ? '#f8fafc' : 'white', cursor: page === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer' }}>Next</button>
            </div>
          </div>
        )}
        <style>{`
          .report-table-row:hover { background: #f8fafc; }
        `}</style>
      </div>
    </div>
  );
};

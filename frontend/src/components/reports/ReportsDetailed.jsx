import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import { SectionCard } from './ReportsCore';
import { Download, X, Search, FileText, FileSpreadsheet, File } from 'lucide-react';

export const ReportsDetailedModal = ({ reportType, period, filters = {}, onClose }) => {
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
      let q = `?type=${encodeURIComponent(reportType)}&period=${period}`;
      if (filters.category) q += `&category=${encodeURIComponent(filters.category)}`;
      if (filters.author) q += `&author=${encodeURIComponent(filters.author)}`;
      if (filters.book) q += `&book_id=${encodeURIComponent(filters.book)}`;
      if (filters.member) q += `&member_id=${encodeURIComponent(filters.member)}`;
      if (filters.status) q += `&status=${encodeURIComponent(filters.status)}`;

      const res = await api.get(`/enterprise_analytics/detailed-report${q}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, period, filters.category, filters.author, filters.book, filters.member, filters.status]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

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
      generatePDF(reportType, data, period, filters);
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
      generateCSV(reportType, data, period, filters);
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
      generateExcel(reportType, data, period, filters);
    } catch (e) {
      console.error('Excel Export failed', e);
      alert('Export failed. Please try again.');
    }
    setIsExporting(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div className="modal-container" style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
        
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ background: '#fefcfa', padding: '0.75rem', borderRadius: '12px', color: '#D4A017', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '1.15rem', fontWeight: 600 }}>
                {reportType}
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Period: {period.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} • {data.length} records</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
            <X size={20} />
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
              style={{ width: '100%', padding: '0.55rem 0.55rem 0.55rem 2.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.85rem', color: '#1e293b' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button disabled={isExporting || loading || !data.length} onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#334155', fontWeight: 500, cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = '#ffffff'}>
              <FileText size={16} color="#dc2626" /> PDF
            </button>
            <button disabled={isExporting || loading || !data.length} onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#334155', fontWeight: 500, cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = '#ffffff'}>
              <File size={16} color="#64748b" /> CSV
            </button>
            <button disabled={isExporting || loading || !data.length} onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#334155', fontWeight: 500, cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = '#ffffff'}>
              <FileSpreadsheet size={16} color="#16a34a" /> Excel
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0', background: '#ffffff' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8', fontSize: '0.9rem' }}>Loading report data...</div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>
              <p style={{ margin: '0 0 1rem 0' }}>Unable to load report data.</p>
              <button onClick={fetchReport} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#D4A017', color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}>Retry</button>
            </div>
          ) : data.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b', padding: '2rem' }}>
              <div style={{ background: '#fefcfa', padding: '1rem', borderRadius: '16px', color: '#D4A017', marginBottom: '1rem' }}>
                <FileText size={32} />
              </div>
              <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>No data available for the selected period.</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Try changing the date range or filters.</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b', padding: '2rem' }}>
              <Search size={32} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No results match your search.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', boxShadow: '0 1px 0 0 #e2e8f0', zIndex: 10 }}>
                <tr>
                  {Object.keys(data[0]).map((h, i) => (
                    <th key={i} style={{ padding: '0.65rem 1.25rem', color: '#475569', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }} className="report-table-row">
                    {Object.keys(data[0]).map((h, j) => {
                      let cellVal = row[h];
                      let cellStyle = { padding: '0.65rem 1.25rem', fontSize: '0.85rem', color: '#1e293b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
                      
                      // Semantic badge for status columns
                      if (h.toLowerCase().includes('status')) {
                        let bg = '#f1f5f9'; let col = '#475569';
                        const valLower = String(cellVal).toLowerCase();
                        if (['issued', 'pending'].includes(valLower)) { bg = '#fff7ed'; col = '#c2410c'; } // orange
                        else if (['returned', 'completed', 'paid'].includes(valLower)) { bg = '#f0fdf4'; col = '#15803d'; } // green
                        else if (['overdue', 'cancelled', 'lost'].includes(valLower)) { bg = '#fef2f2'; col = '#b91c1c'; } // red
                        
                        return (
                          <td key={j} style={cellStyle}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', background: bg, color: col, fontWeight: 500, fontSize: '0.75rem', display: 'inline-block' }}>
                              {cellVal}
                            </span>
                          </td>
                        );
                      }
                      
                      return (
                        <td key={j} style={cellStyle}>
                          {cellVal !== null ? cellVal : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Pagination */}
        {data.length > 0 && !loading && !error && (
          <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
              <span>Rows per page:</span>
              <select 
                value={rowsPerPage} 
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#ffffff', color: '#334155' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, filteredData.length)} of {filteredData.length} records
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '0.25rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: page === 1 ? '#f1f5f9' : '#ffffff', color: page === 1 ? '#94a3b8' : '#334155', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>Prev</button>
              <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.25rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: page === totalPages || totalPages === 0 ? '#f1f5f9' : '#ffffff', color: page === totalPages || totalPages === 0 ? '#94a3b8' : '#334155', cursor: page === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>Next</button>
            </div>
          </div>
        )}
        <style>{`
          .report-table-row:hover { background: #f8fafc; }
        `}</style>
      </div>
    </div>,
    document.body
  );
};

// ==============================================
// Pure Generator Functions for Direct Exports
// ==============================================

export const generatePDF = (reportType, data, period, filters) => {
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

  let filterText = `Filters: Category: ${filters.category || 'All'} | Author: ${filters.author || 'All'} | Book: ${filters.book || 'All'} | Member: ${filters.member || 'All'} | Status: ${filters.status || 'All'}`;
  doc.text(filterText, 14, 50);

  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => row[h]));

  let yPos = 60;
  const numericColumns = headers.filter(h => typeof data[0][h] === 'number');
  
  doc.setFontSize(12);
  doc.setTextColor(30, 27, 21);
  doc.text('KPI Summary', 14, yPos);
  yPos += 6;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Records: ${data.length}`, 14, yPos);
  let xPos = 60;
  
  if (numericColumns.length > 0) {
    numericColumns.forEach((col, idx) => {
      const sum = data.reduce((acc, row) => acc + (Number(row[col]) || 0), 0);
      doc.text(`Total ${col}: ${sum.toLocaleString()}`, xPos, yPos);
      xPos += 50;
      if ((idx + 2) % 4 === 0) {
        yPos += 6;
        xPos = 14;
      }
    });
  }
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [212, 160, 23], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 27, 21] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: function (data) {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${data.pageNumber}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
      doc.text('Smart Library Management System', doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 10, { align: 'right' });
    }
  });

  doc.save(`SmartLibrary_${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateCSV = (reportType, data, period, filters) => {
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Metadata
  csvRows.push(`Report Name,"${reportType}"`);
  csvRows.push(`Period,"${period.replace(/_/g, ' ').toUpperCase()}"`);
  csvRows.push(`Generated,"${new Date().toLocaleString()}"`);
  csvRows.push(`Filters,"Category: ${filters.category || 'All'}, Author: ${filters.author || 'All'}, Book: ${filters.book || 'All'}, Member: ${filters.member || 'All'}, Status: ${filters.status || 'All'}"`);
  csvRows.push("");
  
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? row[header] : '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `SmartLibrary_${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateExcel = (reportType, data, period, filters) => {
  const wsData = [
    [`Report Name`, reportType],
    [`Period`, period.replace(/_/g, ' ').toUpperCase()],
    [`Generated`, new Date().toLocaleString()],
    [`Filters`, `Category: ${filters.category || 'All'}, Author: ${filters.author || 'All'}, Book: ${filters.book || 'All'}, Member: ${filters.member || 'All'}, Status: ${filters.status || 'All'}`],
    [],
    Object.keys(data[0])
  ];
  
  data.forEach(row => wsData.push(Object.values(row)));
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reportType.substring(0, 31));
  XLSX.writeFile(wb, `SmartLibrary_${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

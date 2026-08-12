import React from 'react';
import { Download, FileText, ArrowUpRight } from 'lucide-react';

const ExecutiveReport = ({ summary, trend }) => {
  const triggerPrint = () => {
    window.print();
  };

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  return (
    <div className="chart-print-wrapper" style={{
      background: 'linear-gradient(145deg, #1e1b15, #2a251d)', border: '1px solid rgba(212,160,23,0.3)',
      borderRadius: '16px', padding: '1.75rem', boxShadow: '0 8px 30px rgba(20,18,15,0.2)',
      marginBottom: '1.5rem', color: '#fff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(212,160,23,0.15)', padding: '0.5rem', borderRadius: '10px' }}>
            <FileText color="#D4A017" size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontWeight: '800', color: '#fff', fontSize: '1.25rem' }}>Executive Summary</h3>
            <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Export-ready automated insights</span>
          </div>
        </div>
        <button onClick={triggerPrint} style={{
          background: '#D4A017', color: '#1e1b15', border: 'none', borderRadius: '8px',
          padding: '0.6rem 1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s'
        }} onMouseOver={(e) => e.currentTarget.style.background = '#e2b535'} onMouseOut={(e) => e.currentTarget.style.background = '#D4A017'}>
          <Download size={16} /> Export PDF
        </button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', marginBottom: '0.5rem' }}>Total Issues</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: '#fff' }}>{summary?.total_issues || 0}</span>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: '700' }}><ArrowUpRight size={12} /> +12%</span>
          </div>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', marginBottom: '0.5rem' }}>Overdue Count</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: '#f87171' }}>{summary?.overdue || 0}</span>
          </div>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: '600', marginBottom: '0.5rem' }}>Fines Collected</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: '#D4A017' }}>{currencyFormatter.format(summary?.fines_collected || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveReport;

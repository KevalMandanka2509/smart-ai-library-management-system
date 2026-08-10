import React from 'react';
import { DollarSign, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';

const FinancialAnalytics = ({ summary }) => {
  const totalGenerated = summary?.total_fines_generated ?? 0;
  const collected = summary?.fines_collected ?? 0;
  const pending = totalGenerated - collected;
  const collectionRate = totalGenerated > 0 ? Math.round((collected / totalGenerated) * 100) : 0;

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(226,211,179,0.55)',
      borderRadius: '16px', padding: '1.5rem', boxShadow: '0 6px 20px rgba(20,18,15,0.04)',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <DollarSign color="#16a34a" size={20} />
        <h4 style={{ margin: 0, fontWeight: '800', color: '#1e1b15' }}>Financial Analytics</h4>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#fdfcf9', border: '1px solid #f0e8d0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#5c5549', fontSize: '0.85rem', fontWeight: '600' }}>
            <TrendingUp size={16} color="#3b82f6" /> Total Expected Revenue
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e1b15' }}>₹{totalGenerated.toLocaleString()}</div>
        </div>
        
        <div style={{ background: '#fdfcf9', border: '1px solid #f0e8d0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#5c5549', fontSize: '0.85rem', fontWeight: '600' }}>
            <CreditCard size={16} color="#16a34a" /> Collected Fines
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#16a34a' }}>₹{collected.toLocaleString()}</div>
        </div>
        
        <div style={{ background: '#fdfcf9', border: '1px solid #f0e8d0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#5c5549', fontSize: '0.85rem', fontWeight: '600' }}>
            <AlertCircle size={16} color="#ea580c" /> Pending Fines
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ea580c' }}>₹{pending.toLocaleString()}</div>
        </div>
      </div>
      
      <div style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          <span style={{ color: '#5c5549' }}>Collection Rate</span>
          <span style={{ color: collectionRate >= 75 ? '#16a34a' : collectionRate >= 50 ? '#D4A017' : '#dc2626' }}>{collectionRate}%</span>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: '8px', height: '12px', overflow: 'hidden' }}>
          <div style={{ width: `${collectionRate}%`, height: '100%', background: collectionRate >= 75 ? '#16a34a' : collectionRate >= 50 ? '#D4A017' : '#dc2626', transition: 'width 0.5s ease-in-out' }} />
        </div>
      </div>
    </div>
  );
};

export default FinancialAnalytics;

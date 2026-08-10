import React, { useState } from 'react';
import { Calendar, Clock, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { scheduleReport } from '../../services/api';

const ReportScheduler = () => {
  const [scheduled, setScheduled] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!email) return;
    try {
      setIsLoading(true);
      await scheduleReport({ frequency, email });
      setScheduled(true);
      setTimeout(() => setScheduled(false), 3000);
      setEmail('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(226,211,179,0.55)',
      borderRadius: '16px', padding: '1.5rem', boxShadow: '0 6px 20px rgba(20,18,15,0.04)',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Calendar color="#D4A017" size={20} />
        <h4 style={{ margin: 0, fontWeight: '800', color: '#1e1b15' }}>Report Scheduler</h4>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: '1.25rem' }}>
        Automate your library analytics by scheduling recurring reports sent directly to your inbox.
      </p>
      
      <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', color: '#5c5549' }}>Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid rgba(226,211,179,0.7)',
                borderRadius: '8px', background: '#fdfcf9', fontSize: '0.85rem', outline: 'none'
              }}
            >
              <option value="daily">Daily Summary</option>
              <option value="weekly">Weekly Digest</option>
              <option value="monthly">Monthly Full Report</option>
            </select>
          </div>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem', color: '#5c5549' }}>Recipient Email</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid rgba(226,211,179,0.7)', borderRadius: '8px', background: '#fdfcf9', padding: '0 0.75rem' }}>
              <Mail size={16} color="#9ca3af" />
              <input
                type="email"
                required
                placeholder="admin@library.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem', border: 'none', background: 'transparent',
                  fontSize: '0.85rem', outline: 'none', color: '#1e1b15'
                }}
              />
            </div>
          </div>
        </div>
        <button type="submit" disabled={isLoading} style={{
          alignSelf: 'flex-start', padding: '0.5rem 1.25rem', background: '#1e1b15',
          color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700',
          fontSize: '0.85rem', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
          transition: 'background 0.2s', opacity: isLoading ? 0.7 : 1
        }}>
          {isLoading ? <Loader2 size={16} className="spin" /> : scheduled ? <><CheckCircle size={16} color="#4ade80" /> Scheduled!</> : <><Clock size={16} /> Schedule Report</>}
        </button>
      </form>
    </div>
  );
};

export default ReportScheduler;

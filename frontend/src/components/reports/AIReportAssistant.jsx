import React, { useState } from 'react';
import { Bot, Sparkles, Search, ChevronRight, Loader2 } from 'lucide-react';
import { askAIReport } from '../../services/api';

const AIReportAssistant = ({ onLoadReport }) => {
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  const suggestedQuestions = [
    "What is the return clearance rate this month?",
    "Show me the top 5 overdue books.",
    "Generate a financial summary for last week."
  ];

  const handleGenerate = async (q) => {
    setQuery(q);
    setIsGenerating(true);
    setResponseMsg('');
    try {
      const res = await askAIReport(q);
      if (res.action === 'load_report' && onLoadReport) {
        onLoadReport(res.type, res.period);
      }
      setResponseMsg(res.message);
    } catch (err) {
      console.error(err);
      setResponseMsg("Failed to connect to AI service.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, #fff, #fdfcf9)', border: '1px solid rgba(212,160,23,0.3)',
      borderRadius: '16px', padding: '1.5rem', boxShadow: '0 8px 24px rgba(212,160,23,0.06)',
      marginBottom: '1.5rem', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px',
        background: 'radial-gradient(circle, rgba(212,160,23,0.1) 0%, transparent 70%)', borderRadius: '50%'
      }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ background: '#fef9c3', padding: '0.4rem', borderRadius: '8px' }}>
          <Bot color="#D4A017" size={20} />
        </div>
        <h4 style={{ margin: 0, fontWeight: '800', color: '#1e1b15' }}>AI Report Assistant</h4>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1.5px solid rgba(226,211,179,0.8)', borderRadius: '10px', padding: '0.2rem 0.2rem 0.2rem 1rem', marginBottom: '1rem', transition: 'border-color 0.2s' }}>
        <Search size={18} color="#9ca3af" />
        <input
          type="text"
          placeholder="Ask AI to generate a custom report..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate(query)}
          style={{
            flex: 1, padding: '0.75rem', border: 'none', background: 'transparent',
            outline: 'none', fontSize: '0.85rem', color: '#1e1b15'
          }}
        />
        <button 
          onClick={() => handleGenerate(query)}
          disabled={!query.trim() || isGenerating}
          style={{
            background: isGenerating ? '#e5e7eb' : '#1e1b15', color: '#fff',
            border: 'none', borderRadius: '8px', padding: '0.6rem 1rem',
            fontWeight: '700', fontSize: '0.85rem', cursor: isGenerating || !query.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'background 0.2s'
          }}
        >
          {isGenerating ? <Loader2 size={16} className="spin" /> : <><Sparkles size={16} /> Generate</>}
        </button>
      </div>

      {responseMsg && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(74,222,128,0.1)', color: '#16a34a', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
          {responseMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#5c5549' }}>Suggestions:</span>
        {suggestedQuestions.map((sq, i) => (
          <button key={i} onClick={() => handleGenerate(sq)} style={{
            background: '#fdfcf9', border: '1px solid #f0e8d0', borderRadius: '20px',
            padding: '0.35rem 0.8rem', fontSize: '0.75rem', color: '#5c5549',
            cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.25rem'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#fef9c3'; e.currentTarget.style.borderColor = '#D4A017'; e.currentTarget.style.color = '#b3861b'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#fdfcf9'; e.currentTarget.style.borderColor = '#f0e8d0'; e.currentTarget.style.color = '#5c5549'; }}
          >
            {sq} <ChevronRight size={12} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default AIReportAssistant;

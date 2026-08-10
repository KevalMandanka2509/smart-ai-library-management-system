import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';

const ActivityHeatmap = ({ trend = [] }) => {
  // trend array expected from backend: [{ date: '2025-01-01', count: 5 }, ...]
  const days = useMemo(() => {
    const today = new Date();
    // Build 365 day map
    const dateMap = new Map();
    (trend || []).forEach(item => {
      if(item.date) {
        dateMap.set(item.date, item.count);
      }
    });

    const arr = [];
    for(let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = dateMap.get(dateStr) || 0;
      
      // Determine intensity 0-4 based on count
      let intensity = 0;
      if (count > 0 && count <= 5) intensity = 1;
      else if (count > 5 && count <= 15) intensity = 2;
      else if (count > 15 && count <= 30) intensity = 3;
      else if (count > 30) intensity = 4;
      
      arr.push({ date: dateStr, count, intensity });
    }
    return arr;
  }, [trend]);

  const getColor = (intensity) => {
    if (intensity === 0) return '#ebedf0'; // Empty
    if (intensity === 1) return '#fde047'; // Light Gold
    if (intensity === 2) return '#facc15'; // Medium Gold
    if (intensity === 3) return '#ca8a04'; // Dark Gold
    return '#854d0e'; // Very Dark Gold
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(226,211,179,0.55)',
      borderRadius: '16px', padding: '1.5rem', boxShadow: '0 6px 20px rgba(20,18,15,0.04)',
      marginBottom: '1.5rem', overflowX: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Activity color="#D4A017" size={20} />
        <h4 style={{ margin: 0, fontWeight: '800', color: '#1e1b15' }}>Library Activity Heatmap</h4>
      </div>
      
      <div style={{ display: 'flex', gap: '4px', paddingBottom: '1rem', minWidth: '800px' }}>
        {Array.from({ length: 52 }).map((_, weekIdx) => (
          <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Array.from({ length: 7 }).map((_, dayIdx) => {
              const dayObj = days[weekIdx * 7 + dayIdx];
              if (!dayObj) return null;
              return (
                <div 
                  key={dayIdx} 
                  title={`${dayObj.date}: ${dayObj.count} activities`}
                  style={{ 
                    width: '12px', height: '12px', borderRadius: '3px', 
                    background: getColor(dayObj.intensity), transition: 'transform 0.1s' 
                  }} 
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                />
              );
            })}
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', fontSize: '0.75rem', color: '#5c5549' }}>
        <span>Less</span>
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ebedf0' }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#fde047' }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#facc15' }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ca8a04' }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#854d0e' }} />
        <span>More</span>
      </div>
    </div>
  );
};

export default ActivityHeatmap;

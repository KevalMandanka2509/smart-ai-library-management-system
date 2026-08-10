import React, { useState, useEffect } from 'react';
import './CommandPalette.css';

const CommandPalette = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-modal" onClick={e => e.stopPropagation()}>
        <input 
          type="text" 
          placeholder="Type a command or search..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="command-results">
          {/* Quick Actions would render here */}
          <div className="command-item">Search Books</div>
          <div className="command-item">View Borrowed Books</div>
          <div className="command-item">Go to Profile</div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

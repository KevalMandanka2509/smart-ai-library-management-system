import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, streamChatMessage, getChatSessions, getAiStatus } from '../services/api';
import './Chatbot.css';

// Helper to check if text contains a markdown table
const containsMarkdownTable = (text) => {
  if (!text) return false;
  return text.includes('|') && text.includes('---');
};

const renderMessageContent = (text) => {
  if (!containsMarkdownTable(text)) {
    return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;
  }

  // Very basic markdown table parser
  const lines = text.split('\n');
  const tableLines = lines.filter(l => l.trim().startsWith('|'));
  const otherLines = lines.filter(l => !l.trim().startsWith('|') && l.trim() !== '');

  if (tableLines.length < 3) return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;

  const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
  const rows = tableLines.slice(2).map(row => row.split('|').map(c => c.trim()).filter(c => c));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {otherLines.map((line, i) => <div key={i}>{line}</div>)}
      <div className="ai-data-card">
        <div className="ai-data-card-header">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>
          Structured Data
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ai-data-table">
            <thead>
              <tr>
                {headers.map((h, i) => <th key={i}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => {
                    // Inject badges for statuses
                    if (cell.toLowerCase() === 'overdue' || cell.toLowerCase() === 'unpaid') {
                      return <td key={j}><span className="ai-badge danger">{cell}</span></td>;
                    }
                    if (cell.toLowerCase() === 'available' || cell.toLowerCase() === 'returned') {
                      return <td key={j}><span className="ai-badge success">{cell}</span></td>;
                    }
                    return <td key={j}>{cell}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ai-data-actions">
          <button className="ai-action-btn">View All</button>
          <button className="ai-action-btn">Generate Report</button>
        </div>
      </div>
    </div>
  );
};

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [userName, setUserName] = useState('Admin');
  const [showHistory, setShowHistory] = useState(false);
  const [savedSessions, setSavedSessions] = useState([]);
  const [aiStatus, setAiStatus] = useState('online');

  useEffect(() => {
    if (isOpen && showHistory) {
      getChatSessions().then(data => setSavedSessions(data)).catch(console.error);
    }
  }, [isOpen, showHistory]);

  const loadSession = (session) => {
    setHistory(session.messages || []);
    setSessionId(session.session_id);
    setShowHistory(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setUserName(p.full_name || 'Member');
      } catch (_) { }
    }
    
    getAiStatus().then(data => {
      if (data && data.status) {
        setAiStatus(data.status);
      }
    }).catch(err => {
      setAiStatus('offline');
    });
  }, []);

  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isLoading, isListening, speechError, isOpen]);

  useEffect(() => {
    if (!isLoading && !isListening && isOpen) {
      setTimeout(() => {
        const inputEl = document.getElementById('eu-chatbot-input');
        if (inputEl) {
          inputEl.focus();
        }
      }, 100);
    }
  }, [isLoading, isListening, isOpen]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError('');
      };
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setMessage(transcript);
      };
      
      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied.');
        } else {
          setSpeechError('Failed to recognize speech. Please try again.');
        }
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error(e);
        }
      } else {
        setSpeechError('Voice search is not supported in your browser.');
      }
    }
  };

  const toggleChat = () => setIsOpen(!isOpen);
  const minimizeChat = (e) => {
    e.stopPropagation();
    setIsOpen(false);
  }

  const clearChat = () => {
    setHistory([]);
    setSessionId(null);
    setSelectedFile(null);
  };

  const executePrompt = (promptText) => {
    setMessage(promptText);
    setTimeout(() => {
      handleSend(promptText);
    }, 100);
  };

  const handleSend = async (overrideMessage = null) => {
    const textToSend = typeof overrideMessage === 'string' ? overrideMessage : message;
    if (!textToSend.trim() && !selectedFile) return;

    const userMessage = { 
      role: 'user', 
      text: textToSend.trim(),
      attachment: selectedFile ? selectedFile.name : null
    };
    
    setHistory(prev => [...prev, userMessage, { role: 'model', text: '' }]);
    
    const currentMessage = textToSend;
    const currentHistory = [...history];
    const currentFile = selectedFile;
    
    if (typeof overrideMessage !== 'string') {
      const inputEl = document.getElementById('eu-chatbot-input');
      if (inputEl) inputEl.style.height = 'inherit';
    }
    setMessage('');
    
    setSelectedFile(null);
    setIsLoading(true);

    await streamChatMessage(
      currentMessage,
      currentHistory,
      sessionId,
      currentFile,
      (chunk) => {
        setIsLoading(false);
        setHistory(prev => {
          const newHistory = [...prev];
          const lastIndex = newHistory.length - 1;
          newHistory[lastIndex] = { 
            ...newHistory[lastIndex], 
            text: newHistory[lastIndex].text + chunk 
          };
          return newHistory;
        });
      },
      (returnedSessionId, fullText) => {
        if (returnedSessionId) setSessionId(returnedSessionId);
        setIsLoading(false);
      },
      (error) => {
        console.error('Chat error:', error);
        setHistory(prev => {
          const newHistory = [...prev];
          const lastIndex = newHistory.length - 1;
          newHistory[lastIndex] = { 
            ...newHistory[lastIndex], 
            text: newHistory[lastIndex].text || 'Sorry, I am having trouble connecting right now.',
            error: true
          };
          return newHistory;
        });
        setIsLoading(false);
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setSpeechError("File is too large (max 10MB)");
        return;
      }
      setSelectedFile(file);
      setSpeechError('');
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="eu-chatbot-wrapper">
      <div className={`eu-chatbot-window ${isOpen ? 'open' : ''}`}>
        {/* HEADER */}
        <div className="eu-chatbot-header">
          <div className="eu-chatbot-header-top">
            <div className="eu-chatbot-brand">
              <div className="eu-chatbot-logo">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 3l-1.5 3.5L14 8l3.5 1.5L19 13l1.5-3.5L24 8l-3.5-1.5zM8 5L5.5 11 0 13.5 5.5 16 8 22l2.5-6L16 13.5 10.5 11z"/>
                </svg>
              </div>
              <div className="eu-chatbot-title">
                Library AI
                <span>Smart Assistant</span>
              </div>
            </div>
            <div className="eu-chatbot-controls">
              <button onClick={() => setShowHistory(!showHistory)} className="eu-chatbot-new-chat" title="History" style={{marginRight: '8px'}}>
                History
              </button>
              <button onClick={clearChat} className="eu-chatbot-new-chat" title="New Chat">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                New
              </button>
              <button className="eu-chatbot-close" onClick={minimizeChat} title="Minimize">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
              </button>
              <button className="eu-chatbot-close" onClick={toggleChat} title="Close">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* BODY */}
        {showHistory ? (
          <div className="eu-chatbot-history-panel" style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8fafc' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Recent Conversations</h4>
            {savedSessions.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No past conversations found.</p>
            ) : (
              savedSessions.map(session => (
                <div key={session.session_id} onClick={() => loadSession(session)} style={{ padding: '0.75rem', background: 'white', borderRadius: '8px', marginBottom: '0.5rem', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#334155' }}>
                    {session.messages?.[0]?.text?.substring(0, 40) || 'Empty Session'}...
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    {new Date(session.updated_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
        <>
          <div className="eu-chatbot-status-bar">
            {aiStatus === 'online' ? (
              <><span className="status-dot"></span> Online <span style={{ opacity: 0.5 }}>• Ready to help</span></>
            ) : aiStatus === 'db_mode' ? (
              <><span className="status-dot" style={{ backgroundColor: '#ff9800' }}></span> Library Assistant <span style={{ opacity: 0.5 }}>• DB mode</span></>
            ) : (
              <><span className="status-dot" style={{ backgroundColor: '#f44336' }}></span> Offline <span style={{ opacity: 0.5 }}>• Backend unreachable</span></>
            )}
          </div>

        {/* MESSAGES */}
        <div className="eu-chatbot-messages">
          {history.length === 0 ? (
            <div className="eu-chatbot-empty-state">
              <div className="welcome-msg">
                <strong>👋 Hello, {userName}!</strong>
                I'm your Smart Library Assistant. How can I help you today?
              </div>
              <div className="quick-actions-title">Quick Actions</div>
              <div className="quick-actions-grid">
                {[
                  { title: "Find Books", desc: "Search catalog", intent: "Show me available books", icon: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" },
                  { title: "Overdue Books", desc: "View overdue", intent: "Show me overdue books", icon: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" },
                  { title: "Library Summary", desc: "Stats dashboard", intent: "Give me library analytics", icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" },
                  { title: "Member Activity", desc: "Check members", intent: "Show active members", icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" },
                  { title: "Most Borrowed", desc: "Popular items", intent: "What are the most popular books?", icon: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" },
                  { title: "Generate Report", desc: "Create reports", intent: "Generate a summary report", icon: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" }
                ].map((act, i) => (
                  <button key={i} className="quick-action-btn" onClick={() => executePrompt(act.intent)}>
                    <div className="quick-action-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d={act.icon}/>
                      </svg>
                    </div>
                    <div>
                      <div className="qa-title">{act.title}</div>
                      <div className="qa-desc">{act.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {history.map((msg, idx) => (
                <div key={idx} className={`eu-chatbot-message-wrapper ${msg.role}`}>
                  <div className="eu-chatbot-message-content">
                    {msg.role === 'model' && (
                      <div className="eu-chatbot-avatar">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM9 9H8a5 5 0 0 0-5 5v1h18v-1a5 5 0 0 0-5-5h-1v2H9V9zm-2 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm10 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                        </svg>
                      </div>
                    )}
                    <div className={`eu-chatbot-message ${msg.role}`}>
                      {msg.role === 'model' ? renderMessageContent(msg.text) : msg.text}
                      {msg.attachment && (
                        <div className="eu-chatbot-attachment-badge">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.87 3.13 7 7 7s7-3.13 7-7V6h-1.5z"/></svg>
                          {msg.attachment}
                        </div>
                      )}
                    </div>
                  </div>
                  {msg.role === 'model' && (
                    <div className="eu-chatbot-message-actions">
                      <button className="message-action-btn" onClick={() => navigator.clipboard.writeText(msg.text)} title="Copy">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                      </button>
                      <button className="message-action-btn" onClick={() => handleSend(history[history.length - 2]?.text)} title="Regenerate">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                      </button>
                      <button className="message-action-btn" title="Helpful">👍</button>
                      <button className="message-action-btn" title="Not Helpful">👎</button>
                      {msg.error && (
                        <button className="message-action-btn" style={{ color: '#d97706', borderColor: '#fcd34d', marginLeft: '0.25rem' }} onClick={() => handleSend(history[history.length - 2]?.text)}>
                          Try Again
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          
          {isLoading && (
            <div className="eu-chatbot-typing">
              AI is thinking
              <div className="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="eu-chatbot-input-container">
          <div className="suggested-prompts">
            {["Today's summary", "Overdue books", "Low stock books", "Active borrowers"].map((prompt, i) => (
              <div key={i} className="prompt-chip" onClick={() => executePrompt(prompt)}>{prompt}</div>
            ))}
          </div>

          <div className="eu-chatbot-input-area">
            {speechError && <div className="eu-chatbot-speech-error">{speechError}</div>}
            
            {selectedFile && (
              <div className="eu-chatbot-file-preview">
                <span className="file-name">{selectedFile.name}</span>
                <button onClick={clearFile} className="clear-file-btn">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                  </svg>
                </button>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'flex-end' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }}
                accept="image/png, image/jpeg, image/webp, application/pdf"
              />
              <button 
                className="eu-chatbot-attach"
                onClick={() => fileInputRef.current?.click()}
                title="Attach File"
                type="button"
                disabled={isLoading || isListening}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.87 3.13 7 7 7s7-3.13 7-7V6h-1.5z"/>
                </svg>
              </button>
              <button 
                className={`eu-chatbot-mic ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                title="Voice Search"
                type="button"
              >
                {isListening ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
              </button>
              <textarea
                id="eu-chatbot-input"
                className="eu-chatbot-input"
                placeholder={isListening ? "Listening..." : "Ask anything..."}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  e.target.style.height = 'inherit';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isListening}
                rows={1}
              />
              <button 
                className="eu-chatbot-send" 
                onClick={() => handleSend(null)}
                disabled={(!message.trim() && !selectedFile) || isLoading || isListening}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* FLOATING BUTTON */}
      {!isOpen && (
        <button className="eu-chatbot-fab" onClick={toggleChat} aria-label="Library AI Assistant" title="Library AI Assistant">
          <svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12zM7 9h10v2H7zm0 3h7v2H7z"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default Chatbot;

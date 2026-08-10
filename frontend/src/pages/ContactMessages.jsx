import React, { useState, useEffect } from 'react';
import { PageHeader, DataTable, StatusBadge, EmptyState } from '../components/layout/EnterpriseLibrary';
import { Mail, Trash2, CheckCircle, MailOpen } from 'lucide-react';
import api from '../services/api';
import { formatIST } from '../utils/dateUtils';
import './ContactMessages.css';

const ContactMessages = () => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const response = await api.get('/contact/');
            setMessages(response.data || response);
            setError(null);
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to fetch contact messages.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            await api.put('/contact/' + id + '/read');
            setMessages(messages.map(m => m.id === id ? { ...m, is_read: true } : m));
            if (selectedMessage?.id === id) {
                setSelectedMessage({ ...selectedMessage, is_read: true });
            }
        } catch (err) {
            console.error('Error marking as read', err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this message?')) return;
        try {
            await api.delete('/contact/' + id);
            setMessages(messages.filter(m => m.id !== id));
            if (selectedMessage?.id === id) setSelectedMessage(null);
        } catch (err) {
            console.error('Error deleting message', err);
        }
    };

    const columns = [
        { key: 'status', label: 'Status', render: (val, row) => row.is_read ? <StatusBadge type="success" text="Read" /> : <StatusBadge type="warning" text="New" /> },
        { key: 'name', label: 'Sender', render: (val, row) => <div><div style={{fontWeight: 600}}>{row.name}</div><div style={{fontSize: '0.8rem', color: '#64748b'}}>{row.email}</div></div> },
        { key: 'subject', label: 'Subject', render: (val) => <span style={{fontWeight: 500}}>{val}</span> },
        { key: 'created_at', label: 'Date', render: (val) => formatIST(val) },
        { key: 'actions', label: 'Actions', render: (val, row) => (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="eu-btn eu-btn-secondary" style={{padding: '0.4rem', minWidth: 'auto'}} onClick={(e) => { e.stopPropagation(); setSelectedMessage(row); }}>
                    <MailOpen size={16} />
                </button>
                <button className="eu-btn eu-btn-danger" style={{padding: '0.4rem', minWidth: 'auto'}} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                    <Trash2 size={16} />
                </button>
            </div>
        ) }
    ];

    if (selectedMessage) {
        return (
            <div className="contact-messages-wrapper" style={{ padding: '2rem 3rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                <PageHeader title="Message Details" subtitle="View and manage sender inquiries" actions={<button className="eu-btn eu-btn-secondary" onClick={() => setSelectedMessage(null)}>Back to Messages</button>} />
                <div className="eu-card" style={{ padding: '2rem', marginTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--ink)', marginBottom: '0.5rem' }}>{selectedMessage.subject}</h2>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                <span><strong>From:</strong> {selectedMessage.name} &lt;{selectedMessage.email}&gt;</span>
                                <span>&bull;</span>
                                <span>{formatIST(selectedMessage.created_at)}</span>
                                <span>&bull;</span>
                                {selectedMessage.is_read ? <StatusBadge type="success" text="Read" /> : <StatusBadge type="warning" text="New" />}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {!selectedMessage.is_read && (
                                <button className="eu-btn eu-btn-primary" onClick={() => handleMarkAsRead(selectedMessage.id)}>
                                    <CheckCircle size={18} style={{marginRight: '0.5rem'}} /> Mark as Read
                                </button>
                            )}
                            <button className="eu-btn eu-btn-danger" onClick={() => handleDelete(selectedMessage.id)}>
                                <Trash2 size={18} style={{marginRight: '0.5rem'}} /> Delete
                            </button>
                        </div>
                    </div>
                    <div style={{ fontSize: '1.05rem', lineHeight: '1.7', color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {selectedMessage.message}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="contact-messages-wrapper" style={{ padding: '2rem 3rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <PageHeader 
                title="Contact Messages" 
                subtitle="Manage inquiries from the landing page" 
                actions={<button className="eu-btn eu-btn-secondary" onClick={loadMessages}>Refresh Data</button>} 
            />
            {error && <div className="eu-error-alert" style={{marginBottom: '2rem'}}>{error}</div>}
            
            <div className="eu-card" style={{ marginTop: '2rem' }}>
                <DataTable 
                    columns={columns} 
                    data={messages} 
                    isLoading={loading} 
                    emptyState={<EmptyState icon={Mail} title="No Messages" message="You have no contact messages at this time." />} 
                    onRowClick={(row) => setSelectedMessage(row)}
                />
            </div>
        </div>
    );
};

export default ContactMessages;


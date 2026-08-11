import React, { useState, useEffect } from 'react';
import { createStudent, updateStudent } from '../../services/api';
import { User, Mail, Phone, Calendar, Hash, MapPin, BookOpen, Clock, Building, Bookmark, X } from 'lucide-react';

const StudentForm = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    student_id: '',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    gender: '',
    course: '',
    semester: 1,
    year: 1,
    department: '',
    library_card_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (student) {
      setFormData({
        student_id: student.student_id || '',
        full_name: student.full_name || '',
        email: student.email || '',
        phone: student.phone || '',
        address: student.address || '',
        date_of_birth: student.date_of_birth ? student.date_of_birth.split('T')[0] : '',
        gender: student.gender || '',
        course: student.course || '',
        semester: student.semester || 1,
        year: student.year || 1,
        department: student.department || '',
        library_card_id: student.library_card_id || ''
      });
    }
  }, [student]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    });
  };

  const validate = () => {
    if (!formData.student_id.trim()) { setError('Student ID is required'); return false; }
    if (!formData.full_name.trim()) { setError('Full name is required'); return false; }
    if (!formData.email.trim()) { setError('Email is required'); return false; }
    if (!formData.email.includes('@')) { setError('Please enter a valid email'); return false; }
    if (formData.semester < 1 || formData.semester > 12) { setError('Semester must be between 1 and 12'); return false; }
    if (formData.year < 1 || formData.year > 6) { setError('Year must be between 1 and 6'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      if (student?.id) {
        await updateStudent(student.id, formData);
        setSuccess('Student updated successfully!');
      } else {
        await createStudent(formData);
        setSuccess('Student added successfully!');
        if (!student) {
          setFormData({
            student_id: '',
            full_name: '',
            email: '',
            phone: '',
            address: '',
            date_of_birth: '',
            gender: '',
            course: '',
            semester: 1,
            year: 1,
            department: '',
            library_card_id: ''
          });
        }
      }
      setTimeout(() => {
        if (onSave) onSave();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
      {/* Modal Header */}
      <div className="modal-header">
        <div className="modal-title-area">
          <div className="modal-icon-wrapper">
            <User size={24} />
          </div>
          <div>
            <h2>{student?.id ? 'Edit Student Details' : 'Add New Student'}</h2>
            <div className="modal-subtitle">
              {student?.id ? 'Modify student profile information' : 'Register a new student member'}
            </div>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={onCancel} title="Close">
          <X size={20} />
        </button>
      </div>

      {/* Modal Body */}
      <div className="modal-body">
        {error && (
          <div style={{ marginBottom: '1.25rem', padding: '0.8rem 1rem', background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
            {error}
            <button type="button" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => setError('')}>✕</button>
          </div>
        )}
        
        {success && (
          <div style={{ marginBottom: '1.25rem', padding: '0.8rem 1rem', background: '#ecfdf5', border: '1px solid #d1fae5', color: '#047857', borderRadius: '12px', fontSize: '0.9rem' }}>
            {success}
          </div>
        )}

        <div className="premium-form-grid">
          {/* Row 1 */}
          <div className="premium-form-group">
            <label>Student ID *</label>
            <div className="premium-input-wrapper">
              <Hash className="premium-input-icon" size={16} />
              <input type="text" name="student_id" value={formData.student_id} onChange={handleChange} placeholder="e.g. STU-001" required />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Full Name *</label>
            <div className="premium-input-wrapper">
              <User className="premium-input-icon" size={16} />
              <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="e.g. John Doe" required />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Email *</label>
            <div className="premium-input-wrapper">
              <Mail className="premium-input-icon" size={16} />
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="e.g. john@example.com" required />
            </div>
          </div>

          {/* Row 2 */}
          <div className="premium-form-group">
            <label>Phone</label>
            <div className="premium-input-wrapper">
              <Phone className="premium-input-icon" size={16} />
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. +1 234 567 890" />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Date of Birth</label>
            <div className="premium-input-wrapper">
              <Calendar className="premium-input-icon" size={16} />
              <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Gender</label>
            <div className="premium-input-wrapper no-icon">
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Row 3 */}
          <div className="premium-form-group">
            <label>Course</label>
            <div className="premium-input-wrapper">
              <BookOpen className="premium-input-icon" size={16} />
              <input type="text" name="course" value={formData.course} onChange={handleChange} placeholder="e.g. B.Sc. Computer Science" />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Semester *</label>
            <div className="premium-input-wrapper">
              <Clock className="premium-input-icon" size={16} />
              <input type="number" name="semester" value={formData.semester} onChange={handleChange} min="1" max="12" required />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Year *</label>
            <div className="premium-input-wrapper">
              <Calendar className="premium-input-icon" size={16} />
              <input type="number" name="year" value={formData.year} onChange={handleChange} min="1" max="6" required />
            </div>
          </div>

          {/* Row 4 */}
          <div className="premium-form-group">
            <label>Department</label>
            <div className="premium-input-wrapper">
              <Building className="premium-input-icon" size={16} />
              <input type="text" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Computer Science" />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Library Card ID</label>
            <div className="premium-input-wrapper">
              <Bookmark className="premium-input-icon" size={16} />
              <input type="text" name="library_card_id" value={formData.library_card_id} onChange={handleChange} placeholder="e.g. LIB-001" />
            </div>
          </div>
        </div>

        {/* Address taking full width */}
        <div className="premium-form-group" style={{ marginTop: '0.75rem' }}>
          <label>Address</label>
          <div className="premium-input-wrapper" style={{ alignItems: 'flex-start' }}>
            <MapPin className="premium-input-icon" size={16} style={{ top: '0.75rem' }} />
            <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Enter full address..." rows="2" style={{ resize: 'none' }} />
          </div>
        </div>
      </div>

      {/* Modal Footer */}
      <div className="modal-footer">
        <button type="button" className="modal-btn modal-btn-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="modal-btn modal-btn-save" disabled={loading}>
          {loading ? 'Saving...' : 'Save Student'}
        </button>
      </div>
    </form>
  );
};

export default StudentForm;
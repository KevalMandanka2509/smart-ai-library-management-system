import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgotPassword, verifyOTP, resetPassword } from '../services/api';
import logo from '../assets/logo.webp';
import './LoginPage.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [demoOtp, setDemoOtp] = useState('');

  const extractErrorMessage = (err, defaultMessage) => {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail[0]?.msg || defaultMessage;
    }
    return typeof detail === 'string' ? detail : defaultMessage;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await forgotPassword(email);
      setSuccess(res.message || 'OTP verification code has been sent.');
      if (res.otp) {
        setDemoOtp(res.otp); // Save for quick demo testing
      }
      setStep(2);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send OTP. Verify your email.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otp) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyOTP(email, otp);
      console.log('Verify OTP response:', res);
      
      // Robustly extract token in case of unexpected nesting
      const extractedToken = res?.reset_token || res?.data?.reset_token;
      
      if (extractedToken) {
        console.log('Token captured:', extractedToken.substring(0, 5) + '...');
        setResetToken(extractedToken);
      } else {
        console.error('Warning: reset_token not found in response', res);
      }
      
      setSuccess('Verification code accepted. Please set your new password.');
      setStep(3);
    } catch (err) {
      setError(extractErrorMessage(err, 'Invalid or expired verification code.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password) {
      setError('Password is required.');
      return;
    } else {
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!strongPasswordRegex.test(password)) {
        setError('Password must be at least 8 characters, include an uppercase, lowercase, number, and special character.');
        return;
      }
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Sending reset token:', resetToken ? resetToken.substring(0, 5) + '...' : 'EMPTY!');
      if (!resetToken) {
        throw new Error("Missing reset token. Please verify OTP again.");
      }
      await resetPassword(email, resetToken, password);
      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to reset password. Try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <svg className="auth-wave auth-wave-top" viewBox="0 0 500 200" fill="none">
        <path d="M0 60 C 120 -10, 220 130, 500 10" stroke="#d8a33f" strokeWidth="2" />
        <path d="M0 100 C 140 20, 240 160, 500 50" stroke="#d8a33f" strokeWidth="1.5" opacity="0.5" />
      </svg>
      <svg className="auth-wave auth-wave-bottom" viewBox="0 0 500 200" fill="none">
        <path d="M0 150 C 150 220, 300 60, 500 140" stroke="#d8a33f" strokeWidth="2" />
        <path d="M0 110 C 160 180, 280 40, 500 100" stroke="#d8a33f" strokeWidth="1.5" opacity="0.5" />
      </svg>

      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="Smart Library Logo" className="auth-logo-img" />
        </div>

        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Recover access to your digital library account</p>

        {error && <div className="auth-alert auth-alert-error">{error}</div>}
        {success && <div className="auth-alert auth-alert-success">{success}</div>}

        {step === 1 && (
          <form className="auth-form" onSubmit={handleSendOtp} noValidate>
            <div className="auth-field">
              <span className="auth-field-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? <span className="auth-spinner" /> : 'Send Verification Code'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="auth-form" onSubmit={handleVerifyOtp} noValidate>
            <div className="auth-field">
              <span className="auth-field-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP code"
                maxLength={6}
              />
            </div>
            
            {demoOtp && (
              <span className="auth-field-hint" style={{ color: 'var(--gold-dark)', fontWeight: 'bold' }}>
                Demo Verification Code: {demoOtp}
              </span>
            )}

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? <span className="auth-spinner" /> : 'Verify Code'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form className="auth-form" onSubmit={handleResetPassword} noValidate>
            <div className="auth-field">
              <span className="auth-field-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="auth-field">
              <span className="auth-field-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? <span className="auth-spinner" /> : 'Update Password'}
            </button>
          </form>
        )}

        <div className="auth-divider"><span>OR</span></div>

        <p className="auth-footer-text">
          Remember your password? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;

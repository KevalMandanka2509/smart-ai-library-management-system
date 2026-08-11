import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import libraryShelf from '../assets/library-shelf.webp';
import './LandingPage.css';

const featureItems = [
  {
    icon: '🤖',
    title: 'AI Chatbot',
    description: 'Instant answers and smart recommendations for every library query.',
  },
  {
    icon: '📚',
    title: 'Book Management',
    description: 'Track inventory, categories, and availability with elegant precision.',
  },
  {
    icon: '📈',
    title: 'Analytics Dashboard',
    description: 'See library activity, trends, and performance at a glance.',
  },
  {
    icon: '🔒',
    title: 'Secure Access',
    description: 'Role-based controls keep student and librarian data protected.',
  },
];

const stats = [
  { icon: '📚', value: '10,000+', label: 'Books Managed' },
  { icon: '👥', value: '2,500+', label: 'Active Users' },
  { icon: '🧾', value: '15,000+', label: 'Transactions' },
  { icon: '⭐', value: '99.9%', label: 'System Uptime' },
];

const LandingPage = () => {
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleScrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Fixed navbar offset
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => handleScrollTo(id), 100);
    }
  }, [location]);

  return (
    <div className={`landing-page${mounted ? ' loaded' : ''}`} id="home">
      {/* ===== decorative gold line accents ===== */}
      <svg className="deco-line deco-line-top" viewBox="0 0 500 200" fill="none">
        <path d="M0 60 C 120 -10, 220 130, 500 10" stroke="#d4af37" strokeWidth="2" />
        <path d="M0 100 C 140 20, 240 160, 500 50" stroke="#d4af37" strokeWidth="1.5" opacity="0.5" />
      </svg>
      <div className="deco-dots deco-dots-top" />
      <div className="deco-dots deco-dots-bottom" />
      <svg className="deco-line deco-line-bottom" viewBox="0 0 500 200" fill="none">
        <path d="M0 150 C 150 220, 300 60, 500 140" stroke="#d4af37" strokeWidth="2" />
      </svg>

      <section className="hero-section">
        <div className="hero-shape hero-shape-left" />
        <div className="hero-shape hero-shape-right" />

        <div className="hero-container hero-container-split">
          <div className="hero-copy fade-up">
            <span className="hero-eyebrow">
              <span className="hero-eyebrow-line" />
              Welcome to Smart Library
            </span>
            <h1 className="hero-title">
              Smart AI-Based<br />
              <span>Digital Library</span>
            </h1>
            <p className="hero-description">
              Streamline your library management with AI
            </p>
            <div className="hero-buttons">
              <Link to="/login" className="btn btn-primary">
                <span className="btn-icon">🚀</span>
                Get Started Free
              </Link>
              <button onClick={() => handleScrollTo('features')} className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                <span className="btn-icon btn-play-icon">▶</span>
                Learn More
              </button>
            </div>
          </div>

          <div className="hero-visual fade-up">
            <img src={libraryShelf} alt="Library bookshelf with reading chair" className="hero-visual-img" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-container">
          <div className="section-header fade-up">
            <span className="section-eyebrow">Built for librarians and learning communities</span>
            <h2>Everything your library needs in one elegant platform.</h2>
          </div>

          <div className="features-grid">
            {featureItems.map((feature) => (
              <article key={feature.title} className="feature-card fade-up">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <span className="feature-card-underline" />
              </article>
            ))}
          </div>
        </div>
      </section>

      
      <section className="about-section" id="about" style={{ padding: '5rem 2rem', background: '#ffffff' }}>
        <div className="landing-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--ink)', marginBottom: '1rem' }}>Our Mission & Vision</h2>
            <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              We aim to modernize libraries with AI-driven insights, ensuring a seamless borrowing experience for students and seamless administration for librarians.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div style={{ padding: '2.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ color: 'var(--gold-dark)', fontSize: '1.4rem', marginBottom: '1rem' }}>Innovation First</h3>
              <p style={{ color: '#475569', lineHeight: '1.7' }}>
                Leveraging the latest in web technologies, our system provides unparalleled speed and reliability, keeping libraries ahead of the curve.
              </p>
            </div>
            <div style={{ padding: '2.5rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ color: 'var(--gold-dark)', fontSize: '1.4rem', marginBottom: '1rem' }}>User Centric</h3>
              <p style={{ color: '#475569', lineHeight: '1.7' }}>
                Every feature is designed with the user in mind. From quick barcode scanning to real-time analytics, we prioritize ease of use.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="section-container">
          <div className="stats-bar fade-up">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-item">
                <div className="stat-icon">{stat.icon}</div>
                <div>
                  <p className="stat-value">{stat.value}</p>
                  <p className="stat-label">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      
      <section className="contact-section" id="contact" style={{ padding: '5rem 2rem', background: '#f8fafc' }}>
        <div className="landing-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--ink)', marginBottom: '1rem' }}>Get in Touch</h2>
            <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              Connect with us directly for product demonstrations, technical support, or general inquiries.
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '3rem', alignItems: 'start' }}>
            {/* Left Panel: 2x2 Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={(e)=>e.currentTarget.style.transform='translateY(-4px)'} onMouseLeave={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.5rem' }}>Email</h4>
                <div style={{ fontWeight: '600', color: 'var(--ink)' }}>support@smartlibrary.in</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={(e)=>e.currentTarget.style.transform='translateY(-4px)'} onMouseLeave={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.5rem' }}>Phone</h4>
                <div style={{ fontWeight: '600', color: 'var(--ink)' }}>+91 261 247 1234</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'transform 0.2s', cursor: 'pointer', gridColumn: '1 / -1' }} onMouseEnter={(e)=>e.currentTarget.style.transform='translateY(-4px)'} onMouseLeave={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.5rem' }}>Headquarters</h4>
                <div style={{ fontWeight: '600', color: 'var(--ink)', lineHeight: '1.5' }}>
                  4th Floor, Vesu Point, VIP Road,<br/>
                  Surat, Gujarat 395007
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'transform 0.2s', cursor: 'pointer', gridColumn: '1 / -1' }} onMouseEnter={(e)=>e.currentTarget.style.transform='translateY(-4px)'} onMouseLeave={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.5rem' }}>Working Hours</h4>
                <div style={{ fontWeight: '600', color: 'var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mon - Sat:</span>
                  <span>9:00 AM - 6:00 PM IST</span>
                </div>
                <div style={{ fontWeight: '600', color: '#ef4444', display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span>Sunday:</span>
                  <span>Closed</span>
                </div>
              </div>
            </div>

            {/* Right Panel: Form Container */}
            <div style={{ background: '#fdfcf9', padding: '2.5rem', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                if (btn.disabled) return;
                btn.disabled = true;
                btn.textContent = 'Sending...';
                const formData = new FormData(e.target);
                try {
                    await api.post('/contact/', Object.fromEntries(formData));
                    alert('Message sent successfully!');
                    e.target.reset();
                } catch(err) {
                    alert('Error sending message.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Send Message';
                }
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem', fontWeight: '500' }}>First Name</label>
                    <input name="name" type="text" placeholder="Rahul" required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem', fontWeight: '500' }}>Last Name</label>
                    <input type="text" placeholder="Desai" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem', fontWeight: '500' }}>Email Address</label>
                  <input name="email" type="email" placeholder="rahul.desai@vnsgu.ac.in" required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem', fontWeight: '500' }}>Subject</label>
                  <input name="subject" type="text" placeholder="Inquiry about Smart Library" required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem', fontWeight: '500' }}>Message</label>
                  <textarea name="message" rows="4" placeholder="How can we help you?" required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', outline: 'none', resize: 'vertical' }}></textarea>
                </div>
                <button type="submit" style={{ width: '100%', background: 'var(--gold)', color: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s', minWidth: '150px' }}>
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-container">
          <div className="cta-container fade-up">
            <div className="cta-content">
              <h2>Ready to Transform Your Library Experience?</h2>
              <p>Join thousands of libraries already using Smart Library to manage their collections with AI.</p>
            </div>
            <Link to="/login" className="btn btn-primary btn-large">
              <span className="btn-icon">🚀</span>
              Get Started Free Today
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
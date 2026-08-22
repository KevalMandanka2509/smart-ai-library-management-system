import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import libraryShelf from '../assets/library-shelf.webp';
import './LandingPage.css';

const featureItems = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold-dark)' }}>
        <path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2a2 2 0 0 1-2-2c0-1.1.9-2 2-2Z"/>
        <path d="M19 8H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Z"/>
        <path d="M9 12h.01M15 12h.01M10 16v4h4v-4"/>
      </svg>
    ),
    title: 'AI Chatbot',
    description: 'Instant answers and smart recommendations for every library query.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
    title: 'Book Management',
    description: 'Track inventory, categories, and availability with elegant precision.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
        <path d="m13 17 3-3 3 3"/>
      </svg>
    ),
    title: 'Analytics Dashboard',
    description: 'See library activity, trends, and performance at a glance.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: 'Secure Access',
    description: 'Role-based controls keep student and librarian data protected.',
  },
];

const stats = [
  { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, value: '10,000+', label: 'Books Managed' },
  { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, value: '2,500+', label: 'Active Users' },
  { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, value: '15,000+', label: 'Transactions' },
  { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, value: '99.9%', label: 'System Uptime' },
];
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

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

  const isInitialMount = React.useRef(true);

  React.useLayoutEffect(() => {
    // Force scroll to top synchronously on mount before paint
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    document.body.classList.add('landing-page-active');
    const frame = window.requestAnimationFrame(() => setMounted(true));
    
    if (window.location.hash === '#contact') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    return () => {
      document.body.classList.remove('landing-page-active');
      window.cancelAnimationFrame(frame);
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (location.hash) {
      const id = location.hash.replace('#', '');
      handleScrollTo(id);
    }
  }, [location.hash]);

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

      
      <section className="landing-mission-section" id="about">
        <div className="landing-container">
          <div className="landing-mission-header">
            <h2 className="landing-mission-title">Our Mission & Vision</h2>
            <p className="landing-mission-description">
              We aim to modernize libraries with AI-driven insights, ensuring a seamless borrowing experience for students and seamless administration for librarians.
            </p>
          </div>
          <div className="landing-mission-grid">
            <div className="landing-mission-card">
              <div className="landing-mission-accent"></div>
              <h3 className="landing-mission-card-title">Innovation First</h3>
              <p className="landing-mission-card-desc">
                Leveraging the latest in web technologies, our system provides unparalleled speed and reliability, keeping libraries ahead of the curve.
              </p>
            </div>
            <div className="landing-mission-card">
              <div className="landing-mission-accent"></div>
              <h3 className="landing-mission-card-title">User Centric</h3>
              <p className="landing-mission-card-desc">
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

      
      <section className="landing-contact-section" id={mounted ? "contact" : "contact-hidden"}>
        <div className="landing-container">
          <div className="landing-contact-header">
            <h2 className="landing-contact-title">Get in Touch</h2>
            <p className="landing-contact-description">
              Connect with us directly for product demonstrations, technical support, or general inquiries.
            </p>
          </div>
          
          <div className="landing-contact-panel">
            {/* Left Panel: Information */}
            <div className="landing-contact-info">
              
              <div className="landing-contact-info-card">
                <div className="landing-contact-info-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Email
                </div>
                <div className="landing-contact-info-value">kevalmandanka46666@gmail.com</div>
              </div>
              
              <div className="landing-contact-info-card">
                <div className="landing-contact-info-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Phone
                </div>
                <div className="landing-contact-info-value">+91 9879238331</div>
              </div>

              <div className="landing-contact-info-card">
                <div className="landing-contact-info-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Headquarters
                </div>
                <div className="landing-contact-info-value">
                  4th Floor, Vesu Point, VIP Road,<br/>
                  Surat, Gujarat 395007
                </div>
              </div>

              <div className="landing-contact-info-card">
                <div className="landing-contact-info-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Working Hours
                </div>
                <div className="landing-contact-info-value">
                  Mon - Sat: 9:00 AM - 6:00 PM IST
                </div>
                <div className="landing-contact-info-value closed">
                  Sunday: Closed
                </div>
              </div>
            </div>

            {/* Right Panel: Form Container */}
            <div className="landing-contact-form">
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
                <div className="landing-contact-form-row">
                  <div className="landing-contact-field" style={{ marginBottom: 0 }}>
                    <label>First Name</label>
                    <input name="name" type="text" placeholder="Rahul" required className="landing-contact-input" />
                  </div>
                  <div className="landing-contact-field" style={{ marginBottom: 0 }}>
                    <label>Last Name</label>
                    <input type="text" placeholder="Desai" className="landing-contact-input" />
                  </div>
                </div>
                <div className="landing-contact-field">
                  <label>Email Address</label>
                  <input name="email" type="email" placeholder="rahul.desai@ppsu.ac.in" required className="landing-contact-input" />
                </div>
                <div className="landing-contact-field">
                  <label>Subject</label>
                  <input name="subject" type="text" placeholder="Inquiry about Smart Library" required className="landing-contact-input" />
                </div>
                <div className="landing-contact-field">
                  <label>Message</label>
                  <textarea name="message" placeholder="How can we help you?" required className="landing-contact-textarea"></textarea>
                </div>
                <button type="submit" style={{ width: '100%', background: 'var(--gold)', color: '#ffffff', height: '42px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s, transform 0.2s', boxShadow: '0 4px 12px rgba(216,163,63,0.2)' }} onMouseEnter={(e)=>{e.target.style.background='var(--gold-dark)'; e.target.style.transform='translateY(-2px)'}} onMouseLeave={(e)=>{e.target.style.background='var(--gold)'; e.target.style.transform='translateY(0)'}}>
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
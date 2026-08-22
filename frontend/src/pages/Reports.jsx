import React, { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import { Download, RefreshCw, Filter, Calendar, FileText, FileSpreadsheet, File, BarChart2, BookOpen, Users, Clock, AlertCircle, Bookmark, Archive, TrendingUp, Activity } from 'lucide-react';
import api from '../services/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Components
import { ExecutiveKPIs, SectionCard, EmptyState } from '../components/reports/ReportsCore';
import { CirculationSection, CategorySection, BorrowingBehaviourHeatmap, FineAnalytics } from '../components/reports/ReportsCharts';
import { BooksTables, AuthorTable, MemberTable, OverdueIntelligence } from '../components/reports/ReportsTables';
import { HeatmapSection, MemberGrowthAnalytics, RealTimeActivity, SmartInsights, ReservationAnalytics, InventoryAnalytics, AcquisitionAnalytics } from '../components/reports/ReportsMisc';
import { ReportsDetailedModal } from '../components/reports/ReportsDetailed';

const BASE_URL = '/enterprise_analytics';

const Reports = () => {
  const [period, setPeriod] = useState('last_30_days');
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [detailedReportModal, setDetailedReportModal] = useState(null);
  
  // Data States
  const [overview, setOverview] = useState(null);
  const [circulation, setCirculation] = useState(null);
  const [books, setBooks] = useState(null);
  const [categories, setCategories] = useState(null);
  const [authors, setAuthors] = useState(null);
  const [members, setMembers] = useState(null);
  const [behaviour, setBehaviour] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [activity, setActivity] = useState(null);
  const [insights, setInsights] = useState(null);

  const fetchSection = async (endpoint, setter) => {
    try {
      const { data } = await api.get(`${BASE_URL}/${endpoint}?period=${period}`);
      setter(data);
    } catch (err) {
      console.error(`Failed to fetch ${endpoint}`, err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    // 1. Above the fold (blocking for smoothness)
    await Promise.all([
      fetchSection('overview', setOverview),
      fetchSection('circulation', setCirculation)
    ]);
    setIsLoading(false);
    setLastRefreshed(new Date());

    // 2. Below the fold (non-blocking lazy load)
    fetchSection('growth', setGrowth);
    fetchSection('activity', setActivity);
    fetchSection('insights', setInsights);
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const { data } = await api.get(`${BASE_URL}/export-all?period=${period}`);
      const wb = XLSX.utils.book_new();
      
      for (const [reportName, reportData] of Object.entries(data)) {
        if (reportData && reportData.length > 0) {
          const ws = XLSX.utils.json_to_sheet(reportData);
          XLSX.utils.book_append_sheet(wb, ws, reportName.substring(0, 31));
        }
      }
      
      XLSX.writeFile(wb, `SmartLibrary_Reports_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel', err);
      alert('Export failed. Please try again.');
    }
    setIsExporting(false);
  };

  return (
    <div style={{ padding: '20px 24px', width: '100%', background: '#f5f4ef', minHeight: '100vh', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b', fontWeight: 700 }}>Reports & Analytics</h1>
          <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Real-time library intelligence and insights • Last updated {lastRefreshed.toLocaleTimeString()}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', fontWeight: 500, fontSize: '0.85rem', height: '34px' }}
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="this_year">This Year</option>
            <option value="all_time">All Time</option>
          </select>
          <button onClick={loadData} style={{ padding: '0 0.5rem', height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Refresh">
            <RefreshCw size={16} color="#64748b" className={isLoading ? "animate-spin" : ""} />
          </button>
          <button style={{ padding: '0 0.75rem', height: '34px', borderRadius: '6px', border: '1px solid #D4A017', background: '#D4A017', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }} onClick={() => setDetailedReportModal('Circulation Report')}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

    {/* GLOBAL FILTERS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
        {['Category', 'Author', 'Book', 'Member', 'Status'].map(filter => (
          <select key={filter} style={{ padding: '0.35rem 1.75rem 0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', outline: 'none', background: 'white', fontSize: '0.8rem', color: '#475569', minWidth: '120px', height: '32px', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem top 50%', backgroundSize: '0.55rem auto' }}>
            <option value="">All {filter}s</option>
          </select>
        ))}
        <button style={{ padding: '0 0.5rem', height: '32px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Filter size={12} /> Clear Filters
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto', overflowX: 'hidden' }}>
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Executive Summary</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Core library operational metrics</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '16px' }}>
              {[...Array(10)].map((_, i) => (
                <div key={i} style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '105px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '50%', height: '12px', background: '#f1f5f9', borderRadius: '4px' }}></div>
                  <div style={{ width: '40%', height: '20px', background: '#e2e8f0', borderRadius: '4px' }}></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto', overflowX: 'hidden' }}>
          
          {/* Executive Summary */}
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Executive Summary</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Core library operational metrics</p>
            </div>
            <ExecutiveKPIs data={overview} />
          </section>

          {/* Circulation Analytics */}
          <section>
            <CirculationSection data={circulation} globalPeriod={period} />
          </section>

          {/* Book Analytics */}
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Book Analytics</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Most borrowed, overdue and reserved books</p>
            </div>
            <BooksTables data={books} />
          </section>

          {/* Category & Author Analytics */}
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Category & Author Analytics</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Demand by subject and author performance</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              <CategorySection globalPeriod={period} />
              <AuthorTable globalPeriod={period} />
            </div>
          </section>

          {/* Member Analytics */}
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Member Analytics & Borrowing Behaviour</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Top borrowers and return patterns</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '16px' }}>
              <MemberTable globalPeriod={period} />
              <BorrowingBehaviourHeatmap globalPeriod={period} />
            </div>
          </section>
          
          {/* Fines & Overdue Analytics */}
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Fine & Overdue Analytics</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Fine collection metrics and overdue books</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '16px' }}>
              <FineAnalytics globalPeriod={period} />
              <OverdueIntelligence globalPeriod={period} />
            </div>
          </section>

          {/* Inventory, Reservations & Acquisitions */}
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Inventory, Reservations & Acquisitions</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Library stock utilization and new additions</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              <ReservationAnalytics globalPeriod={period} />
              <InventoryAnalytics />
              <AcquisitionAnalytics globalPeriod={period} />
            </div>
          </section>
          
          {/* Growth & Activity */}
          <section>
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#1e293b' }}>Growth & Activity</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Member growth trends and real-time operations</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <MemberGrowthAnalytics globalPeriod={period} />
              <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '16px', alignItems: 'start' }}>
                <RealTimeActivity />
                <SmartInsights globalPeriod={period} />
              </div>
            </div>
          </section>

          {/* DETAILED REPORTS */}
          <section>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#1e293b' }}>Detailed Reports</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Explore and export granular library data</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {[
                { name: 'Circulation Report', desc: 'Issues, returns and circulation performance', icon: <BarChart2 size={20} /> },
                { name: 'Book Report', desc: 'Book inventory, availability and demand', icon: <BookOpen size={20} /> },
                { name: 'Member Report', desc: 'Member borrowing and engagement activity', icon: <Users size={20} /> },
                { name: 'Overdue Report', desc: 'Critical overdue books and members', icon: <Clock size={20} /> },
                { name: 'Fine Report', desc: 'Generated fines and collection tracking', icon: <AlertCircle size={20} /> },
                { name: 'Reservation Report', desc: 'Reservation demand and waiting times', icon: <Bookmark size={20} /> },
                { name: 'Inventory Report', desc: 'Total library inventory breakdown', icon: <Archive size={20} /> },
                { name: 'Acquisition Report', desc: 'Newly added books and their performance', icon: <TrendingUp size={20} /> },
                { name: 'Activity Report', desc: 'Raw system activity and audit logs', icon: <Activity size={20} /> }
              ].map(report => (
                <div key={report.name} style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '8px', fontSize: '1.1rem', border: '1px solid #f1f5f9' }}>
                      {report.icon}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '1rem' }}>{report.name}</h4>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', lineHeight: 1.4 }}>{report.desc}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                    <button onClick={() => setDetailedReportModal(report.name)} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #D4A017', background: 'white', color: '#D4A017', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.background = '#D4A017'; e.currentTarget.style.color = 'white'; }} onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#D4A017'; }}>
                      View Report
                    </button>
                    <button onClick={() => setDetailedReportModal(report.name)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
                      Export
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* EXPORT CENTER */}
          <section style={{ marginTop: '3rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#1e293b' }}>Export Center</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Download filtered reports and analytics</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ background: '#fef2f2', padding: '0.5rem', borderRadius: '8px', color: '#dc2626' }}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', color: '#1e293b' }}>PDF</h4>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Professional report</p>
                  </div>
                </div>
                <button onClick={() => setDetailedReportModal('Circulation Report')} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: 'none', background: '#D4A017', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                  Export PDF
                </button>
              </div>

              <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '8px', color: '#64748b' }}>
                    <File size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', color: '#1e293b' }}>CSV</h4>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Raw report data</p>
                  </div>
                </div>
                <button onClick={() => setDetailedReportModal('Circulation Report')} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e293b', fontWeight: 600, cursor: 'pointer' }}>
                  Export CSV
                </button>
              </div>

              <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ background: '#f0fdf4', padding: '0.5rem', borderRadius: '8px', color: '#16a34a' }}>
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', color: '#1e293b' }}>Excel</h4>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Multi-sheet workbook</p>
                  </div>
                </div>
                <button onClick={() => handleExportExcel(period)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: 'none', background: '#16a34a', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                  Export Excel
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      
      {detailedReportModal && (
        <ReportsDetailedModal 
          reportType={detailedReportModal} 
          period={period} 
          onClose={() => setDetailedReportModal(null)} 
        />
      )}
    </div>
  );
};

export default Reports;

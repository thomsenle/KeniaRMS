import React, { useState, useEffect } from 'react';
import { apiRequest, formatKES } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  FileSpreadsheet, 
  Calendar, 
  Printer, 
  CheckCircle2, 
  Banknote, 
  CreditCard, 
  Smartphone, 
  Download,
  Clock
} from 'lucide-react';

export const ClosingPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'history'>('daily');

  // Daily Preview
  const [todayData, setTodayData] = useState<any>(null);
  const [closingNotes, setClosingNotes] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [closingSuccess, setClosingSuccess] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Monthly Report
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [monthlyData, setMonthlyData] = useState<any>(null);

  // History
  const [history, setHistory] = useState<any[]>([]);

  // Selected item for PDF / print view
  const [printReportData, setPrintReportData] = useState<any>(null);

  useEffect(() => {
    loadTodayPreview();
    loadHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'monthly') {
      loadMonthlyReport();
    }
  }, [activeTab, selectedYear, selectedMonth]);

  const loadTodayPreview = async () => {
    try {
      const res = await apiRequest<{ success: boolean } & any>('/closing/today-preview');
      setTodayData(res);
    } catch (err: any) {
      console.error('Failed to load today preview:', err);
    }
  };

  const loadMonthlyReport = async () => {
    try {
      const res = await apiRequest<{ success: boolean; totals: any; days: any[] }>(`/closing/monthly-report?year=${selectedYear}&month=${selectedMonth}`);
      setMonthlyData(res);
    } catch (err: any) {
      console.error('Failed to load monthly report:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await apiRequest<{ success: boolean; closings: any[] }>('/closing/history');
      setHistory(res.closings);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    }
  };

  const executeDailyClosing = async () => {
    if (!confirm(t('closing.confirm_prompt'))) return;
    setIsExecuting(true);
    setStatusMessage(null);

    try {
      const res = await apiRequest<{ success: boolean; summary: any; message: string }>('/closing/execute-daily', {
        method: 'POST',
        body: JSON.stringify({ notes: closingNotes })
      });

      setClosingSuccess(res);
      await loadTodayPreview();
      await loadHistory();
    } catch (err: any) {
      alert(err.message || 'Error executing closing');
    } finally {
      setIsExecuting(false);
    }
  };

  // Direct print of Z-Bon to network ESC/POS cashier printer
  const handlePrintZBon = async (closingId?: string) => {
    setStatusMessage(null);
    try {
      if (closingId) {
        await apiRequest(`/closing/reprint/${closingId}`, { method: 'POST' });
      } else {
        await apiRequest('/closing/reprint-today', { method: 'POST' });
      }
      setStatusMessage(t('closing.print_success'));
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Print error');
    }
  };

  // Generate / open PDF view for browser printing or saving as PDF
  const handleGeneratePDF = (dataToPrint: any) => {
    setPrintReportData(dataToPrint);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const exportMonthlyCSV = () => {
    if (!monthlyData || !monthlyData.days) return;
    let csv = "Datum,Rechnungen,Netto KES,MwSt 16% KES,Levy 2% KES,Brutto KES,Bar KES,Karte KES,M-Pesa KES,Trinkgeld KES\n";
    for (const d of monthlyData.days) {
      csv += `${d.day},${d.bills_count},${d.net},${d.vat16},${d.levy2},${d.gross},${d.cash},${d.card},${d.mpesa},${d.tips}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `KeniaRMS_Report_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = todayData?.summary || {};

  return (
    <div>
      {/* Page Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={28} color="var(--primary)" /> {t('closing.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('closing.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('daily')}
          >
            {t('closing.daily_tab')}
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('monthly')}
          >
            {t('closing.monthly_tab')}
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            {t('closing.history_tab')} ({history.length})
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="no-print glass-panel" style={{ padding: '12px 18px', marginBottom: '16px', border: '1px solid #10b981', color: '#34d399', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* TAB 1: TAGESABSCHLUSS (DAILY Z-REPORT) */}
      {activeTab === 'daily' && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {closingSuccess && (
            <div className="glass-panel" style={{ padding: '20px', border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <CheckCircle2 size={32} color="#10b981" />
              <div>
                <h3 style={{ color: '#34d399' }}>{t('closing.success_title')}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {t('closing.success_desc')}
                </p>
              </div>
            </div>
          )}

          {/* Action Header: Quick Print and PDF Buttons */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={20} color="var(--primary)" />
              <div>
                <strong style={{ fontSize: '1.05rem' }}>{new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>East Africa Time (EAT) • KeniaRMS Real-time Audit</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handlePrintZBon()}
                style={{ fontSize: '0.9rem', padding: '10px 16px' }}
              >
                <Printer size={16} /> {t('closing.print_zbon')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleGeneratePDF({
                  date: new Date().toISOString().split('T')[0],
                  summary,
                  waiters: todayData?.waiters || []
                })}
                style={{ fontSize: '0.9rem', padding: '10px 16px' }}
              >
                <Download size={16} /> {t('closing.save_pdf')}
              </button>
            </div>
          </div>

          {/* Today KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('closing.gross_sales')}</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                {formatKES(summary.total_gross || 0)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{summary.total_bills || 0} {t('closing.bills_today')}</span>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('closing.net_sales')}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                {formatKES(summary.total_net || 0)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('closing.vat_16')}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                {formatKES(summary.total_vat16 || 0)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('closing.levy_2')}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>
                {formatKES(summary.total_levy2 || 0)}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('closing.total_tips')}</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                {formatKES(summary.total_tips || 0)}
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}>{t('closing.payments_overview')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Banknote size={16} /> {t('common.cash')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px' }}>
                  {formatKES(summary.total_cash || 0)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <CreditCard size={16} /> {t('common.card')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px' }}>
                  {formatKES(summary.total_card || 0)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Smartphone size={16} /> {t('common.mpesa')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px', color: '#34d399' }}>
                  {formatKES(summary.total_mpesa || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Waiters Breakdown Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>{t('closing.waiters_overview')}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_waiter')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_bills')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_cash')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_card_mpesa')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_gross')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('closing.col_tips')}</th>
                  </tr>
                </thead>
                <tbody>
                  {todayData?.waiters?.map((w: any) => (
                    <tr key={w.waiter_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>{w.waiter_name}</td>
                      <td style={{ padding: '12px 14px' }}>{w.orders_served}</td>
                      <td style={{ padding: '12px 14px' }}>{formatKES(w.cash_sales)}</td>
                      <td style={{ padding: '12px 14px' }}>{formatKES(w.card_sales + w.mpesa_sales)}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--primary)' }}>
                        {formatKES(w.gross_sales)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                        {formatKES(w.tips)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Card: Execute Closing */}
          <div className="glass-panel-elevated" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{t('closing.execute_title')}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px' }}>
              {t('closing.execute_desc')}
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('closing.notes_label')}
              </label>
              <input
                type="text"
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={executeDailyClosing}
                disabled={isExecuting}
                style={{ padding: '14px 24px', fontSize: '1rem' }}
              >
                <Printer size={18} />
                {isExecuting ? t('closing.processing') : t('closing.execute_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONATSABSCHLUSS (MONTHLY AUDIT) */}
      {activeTab === 'monthly' && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={20} color="var(--primary)" />
              <span style={{ fontWeight: 600 }}>{t('closing.select_month')}</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ width: '140px' }}
              >
                {[
                  { m: '01', name: '01' }, { m: '02', name: '02' }, { m: '03', name: '03' },
                  { m: '04', name: '04' }, { m: '05', name: '05' }, { m: '06', name: '06' },
                  { m: '07', name: '07' }, { m: '08', name: '08' }, { m: '09', name: '09' },
                  { m: '10', name: '10' }, { m: '11', name: '11' }, { m: '12', name: '12' }
                ].map(item => (
                  <option key={item.m} value={item.m}>{item.name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{ width: '100px' }}
              >
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportMonthlyCSV}
            >
              <Download size={16} /> {t('closing.export_csv')}
            </button>
          </div>

          {monthlyData?.totals && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('closing.gross_sales')}:</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                  {formatKES(monthlyData.totals.gross)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('closing.net_sales')}:</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {formatKES(monthlyData.totals.net)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('closing.vat_16')}:</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>
                  {formatKES(monthlyData.totals.vat16)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('closing.levy_2')}:</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#c084fc' }}>
                  {formatKES(monthlyData.totals.levy2)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('closing.total_tips')}:</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399' }}>
                  {formatKES(monthlyData.totals.tips)}
                </div>
              </div>
            </div>
          )}

          {/* Day by Day Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}>{t('closing.day_overview')} ({selectedMonth}/{selectedYear})</h3>
            {monthlyData?.days?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                {t('closing.no_data')}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('closing.col_date')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('closing.col_bills')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('common.net')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('common.vat')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('common.levy')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('common.total')} KES</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('common.cash')}</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>{t('common.card')} / M-Pesa</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('common.tip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData?.days?.map((d: any) => (
                      <tr key={d.day} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{d.day}</td>
                        <td style={{ padding: '10px 12px' }}>{d.bills_count}</td>
                        <td style={{ padding: '10px 12px' }}>{formatKES(d.net)}</td>
                        <td style={{ padding: '10px 12px' }}>{formatKES(d.vat16)}</td>
                        <td style={{ padding: '10px 12px' }}>{formatKES(d.levy2)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--primary)' }}>
                          {formatKES(d.gross)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{formatKES(d.cash)}</td>
                        <td style={{ padding: '10px 12px' }}>{formatKES(d.card + d.mpesa)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#34d399', fontWeight: 700 }}>
                          {formatKES(d.tips)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ARCHIV HISTORIE */}
      {activeTab === 'history' && (
        <div className="no-print glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '14px' }}>{t('closing.history_title')}</h3>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
              {t('closing.no_history')}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_date')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_time')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_closed_by')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.col_bills')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('closing.gross_sales')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('common.cash')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>M-Pesa / Karte</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('common.tip')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>{item.closing_date}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-dim)' }}>
                        {new Date(item.closed_at).toLocaleTimeString('en-GB')}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{item.closed_by_name || 'System / Manager'}</td>
                      <td style={{ padding: '12px 14px' }}>{item.total_orders_count}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--primary)' }}>
                        {formatKES(item.total_gross_sales)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{formatKES(item.total_cash)}</td>
                      <td style={{ padding: '12px 14px' }}>{formatKES(item.total_mpesa + item.total_card)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#34d399', fontWeight: 700 }}>
                        {formatKES(item.total_tips)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handlePrintZBon(item.id)}
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            title={t('closing.reprint_btn')}
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleGeneratePDF({
                              date: item.closing_date,
                              summary: {
                                total_gross: item.total_gross_sales,
                                total_net: item.total_net_sales,
                                total_vat16: item.total_tax_16,
                                total_levy2: item.total_levy_2,
                                total_cash: item.total_cash,
                                total_card: item.total_card,
                                total_mpesa: item.total_mpesa,
                                total_tips: item.total_tips,
                                total_bills: item.total_orders_count
                              },
                              waiters: []
                            })}
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            title={t('closing.save_pdf')}
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DEDICATED PRINTABLE AUDIT REPORT (Visible only during window.print()) */}
      {printReportData && (
        <div className="printable-report" style={{ display: 'none' }}>
          <div style={{ padding: '24px', fontFamily: 'monospace, sans-serif', color: '#000', background: '#fff' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.4rem', margin: '0 0 4px 0' }}>KENIARMS RESTAURANT</h2>
              <div style={{ fontSize: '0.85rem' }}>NAIROBI, KENYA • TAX REGISTER AUDIT</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '8px' }}>
                {t('closing.pdf_title')} - {printReportData.date}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>{t('closing.pdf_disclaimer')}</div>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{t('closing.bills_today')}:</span>
                <strong>{printReportData.summary?.total_bills || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{t('closing.net_sales')}:</span>
                <strong>{formatKES(printReportData.summary?.total_net || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{t('closing.vat_16')}:</span>
                <strong>{formatKES(printReportData.summary?.total_vat16 || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{t('closing.levy_2')}:</span>
                <strong>{formatKES(printReportData.summary?.total_levy2 || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', fontSize: '1.1rem', fontWeight: 800 }}>
                <span>{t('closing.gross_sales')}:</span>
                <span>{formatKES(printReportData.summary?.total_gross || 0)}</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.88rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>{t('closing.payments_overview')}:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>- {t('common.cash')}:</span>
                <span>{formatKES(printReportData.summary?.total_cash || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>- {t('common.mpesa')}:</span>
                <span>{formatKES(printReportData.summary?.total_mpesa || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>- {t('common.card')}:</span>
                <span>{formatKES(printReportData.summary?.total_card || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>- {t('closing.total_tips')}:</span>
                <span>{formatKES(printReportData.summary?.total_tips || 0)}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '12px', fontSize: '0.75rem' }}>
              <div>KeniaRMS Automated Hospitality System</div>
              <div>Generated: {new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

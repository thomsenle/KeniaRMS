import React, { useState, useEffect } from 'react';
import { Waiter, WaiterShift } from '../types';
import { apiRequest, formatKES } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  Wallet, 
  Banknote, 
  CreditCard, 
  Coins, 
  CheckCircle2, 
  Clock, 
  Receipt,
  UserCheck
} from 'lucide-react';

interface ShiftPageProps {
  activeWaiter: Waiter | null;
  activeShift: WaiterShift | null;
  onShiftStarted: (shift: WaiterShift) => void;
  onShiftEnded: () => void;
  onOpenLogin: () => void;
}

export const ShiftPage: React.FC<ShiftPageProps> = ({
  activeWaiter,
  activeShift,
  onShiftStarted,
  onShiftEnded,
  onOpenLogin
}) => {
  const { t } = useTranslation();
  const [startingFloatInput, setStartingFloatInput] = useState<string>('2000');
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [closedResult, setClosedResult] = useState<any>(null);

  useEffect(() => {
    if (activeWaiter) {
      loadShiftSummary();
    }
  }, [activeWaiter, activeShift]);

  const loadShiftSummary = async () => {
    if (!activeWaiter) return;
    try {
      const res = await apiRequest<{ success: boolean; hasActiveShift: boolean; shift: any }>(`/waiters/shift/current/${activeWaiter.id}`);
      setShiftSummary(res.shift);
    } catch (err: any) {
      console.error('Failed to load shift:', err);
    }
  };

  const handleStartShift = async () => {
    if (!activeWaiter) {
      onOpenLogin();
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; shift: WaiterShift }>('/waiters/shift/start', {
        method: 'POST',
        body: JSON.stringify({
          waiter_id: activeWaiter.id,
          starting_float: Number(startingFloatInput) || 0
        })
      });

      onShiftStarted(res.shift);
      await loadShiftSummary();
    } catch (err: any) {
      alert(err.message || 'Error starting shift');
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;
    const counted = Number(countedCashInput);

    if (isNaN(counted) || countedCashInput.trim() === '') {
      alert(t('shift.counted_cash_label'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; summary: any }>('/waiters/shift/end', {
        method: 'POST',
        body: JSON.stringify({
          shift_id: activeShift.id,
          counted_cash: counted,
          notes
        })
      });

      setClosedResult(res.summary);
      onShiftEnded();
    } catch (err: any) {
      alert(err.message || 'Error ending shift');
    } finally {
      setLoading(false);
    }
  };

  if (!activeWaiter) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '500px', margin: '40px auto' }}>
        <Wallet size={56} style={{ color: 'var(--primary)', margin: '0 auto 16px auto', opacity: 0.8 }} />
        <h2>{t('shift.not_logged_in_title')}</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>
          {t('shift.not_logged_in_desc')}
        </p>
        <button className="btn btn-primary" onClick={onOpenLogin} style={{ padding: '12px 24px', fontSize: '1rem' }}>
          <UserCheck size={20} /> {t('shift.login_btn')}
        </button>
      </div>
    );
  }

  const startingFloat = shiftSummary?.starting_float || activeShift?.starting_float || 0;
  const cashSales = shiftSummary?.current_cash_sales || 0;
  const cardSales = shiftSummary?.current_card_sales || 0;
  const mpesaSales = shiftSummary?.current_mpesa_sales || 0;
  const expectedCashInWallet = startingFloat + cashSales;

  const countedCash = countedCashInput ? Number(countedCashInput) : null;
  const difference = countedCash !== null ? countedCash - expectedCashInWallet : null;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Wallet size={28} color="var(--primary)" /> {t('shift.title')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {t('shift.subtitle', { name: activeWaiter.name })}
        </p>
      </div>

      {/* CLOSED SHIFT RECEIPT VIEW */}
      {closedResult && (
        <div className="glass-panel-elevated" style={{ padding: '30px', marginBottom: '30px', border: '1px solid #10b981', textAlign: 'center' }}>
          <CheckCircle2 size={54} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
          <h2 style={{ fontSize: '1.5rem', color: '#34d399' }}>{t('shift.success_title')}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            {t('shift.success_desc')}
          </p>

          <div style={{ maxWidth: '440px', margin: '0 auto 24px auto', background: 'var(--bg-surface)', padding: '18px', borderRadius: 'var(--radius-sm)', textAlign: 'left', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('shift.float_card')}:</span>
              <strong>{formatKES(closedResult.starting_float)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('shift.cash_sales_card')}:</span>
              <strong>{formatKES(closedResult.cash_sales)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('common.card')}:</span>
              <strong>{formatKES(closedResult.card_sales)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('common.mpesa')}:</span>
              <strong>{formatKES(closedResult.mpesa_sales)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('shift.expected_cash_card')}:</span>
              <strong>{formatKES(closedResult.expected_cash)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('shift.counted_cash_label')}:</span>
              <strong>{formatKES(closedResult.counted_cash)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
              <span>{t('shift.tip_earned')}</span>
              <span>{formatKES(closedResult.calculated_tips)}</span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => setClosedResult(null)}>
            {t('shift.new_shift_btn')}
          </button>
        </div>
      )}

      {/* STATE 1: NO ACTIVE SHIFT -> START SHIFT */}
      {!activeShift && !closedResult && (
        <div className="glass-panel-elevated" style={{ padding: '36px', maxWidth: '540px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto'
            }}>
              <Coins size={32} />
            </div>
            <h2>{t('shift.start_title')}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
              {t('shift.start_desc')}
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              {t('shift.starting_float_label')}
            </label>
            <input
              type="number"
              value={startingFloatInput}
              onChange={e => setStartingFloatInput(e.target.value)}
              placeholder="e.g. 2000"
              style={{ fontSize: '1.4rem', fontWeight: 800, padding: '14px', textAlign: 'center' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '24px' }}>
            {['1000', '2000', '3000', '5000'].map(val => (
              <button
                key={val}
                type="button"
                className="btn btn-secondary"
                onClick={() => setStartingFloatInput(val)}
                style={{ fontSize: '0.85rem' }}
              >
                {val} KSh
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartShift}
            disabled={loading || !startingFloatInput}
            style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
          >
            {t('shift.start_btn', { amount: formatKES(Number(startingFloatInput) || 0) })}
          </button>
        </div>
      )}

      {/* STATE 2: ACTIVE SHIFT RUNNING & KASSENSTURZ */}
      {activeShift && !closedResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Shift Dashboard */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent-emerald)" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {t('shift.active_since')} <strong>{new Date(activeShift.start_time).toLocaleTimeString('en-GB')}</strong>
                </span>
              </div>
              <span className="badge badge-success">{t('shift.shift_running')}</span>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <Coins size={15} /> {t('shift.float_card')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {formatKES(startingFloat)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <Banknote size={15} /> {t('shift.cash_sales_card')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatKES(cashSales)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <CreditCard size={15} /> {t('shift.card_sales_card')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                  {formatKES(cardSales + mpesaSales)}
                </div>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 700 }}>
                  <Wallet size={15} /> {t('shift.expected_cash_card')}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatKES(expectedCashInWallet)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {t('shift.expected_cash_sub')}
                </div>
              </div>
            </div>
          </div>

          {/* KASSENSTURZ FORM */}
          <div className="glass-panel-elevated" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={22} color="var(--primary)" /> {t('shift.close_title')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
              {t('shift.close_desc')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  {t('shift.counted_cash_label')}
                </label>
                <input
                  type="number"
                  placeholder={`e.g. ${expectedCashInWallet + 500}`}
                  value={countedCashInput}
                  onChange={e => setCountedCashInput(e.target.value)}
                  style={{ fontSize: '1.3rem', fontWeight: 800, padding: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {t('shift.notes_label')}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ padding: '12px' }}
                />
              </div>
            </div>

            {/* LIVE TALLY & TIP CALCULATION RESULT */}
            {difference !== null && (
              <div style={{
                background: difference >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${difference >= 0 ? '#10b981' : '#ef4444'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: difference >= 0 ? '#34d399' : '#f87171' }}>
                    {difference >= 0 ? t('shift.tip_earned') : t('shift.cash_deficit')}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('shift.counted_sub', { counted: formatKES(countedCash || 0), expected: formatKES(expectedCashInWallet) })}
                  </div>
                </div>

                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: difference >= 0 ? '#34d399' : '#f87171' }}>
                  {difference >= 0 ? `+ ${formatKES(difference)}` : formatKES(difference)}
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEndShift}
              disabled={loading || !countedCashInput}
              style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
            >
              {t('shift.close_btn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

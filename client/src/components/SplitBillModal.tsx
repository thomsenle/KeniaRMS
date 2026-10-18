import React, { useState, useEffect } from 'react';
import { Order, OrderItem, Waiter, WaiterShift, MpesaSetting } from '../types';
import { apiRequest, formatKES, socket } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  X, 
  Check, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Receipt,
  Send,
  Loader2,
  CheckCircle2,
  SmartphoneNfc
} from 'lucide-react';

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  items: OrderItem[];
  activeWaiter: Waiter | null;
  activeShift: WaiterShift | null;
  onSuccess: () => void;
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  isOpen,
  onClose,
  order,
  items,
  activeWaiter,
  activeShift,
  onSuccess
}) => {
  const { t } = useTranslation();
  const billableItems = items.filter(it => it.status !== 'paid' && it.status !== 'cancelled');

  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const it of billableItems) {
      initial[it.id] = it.quantity;
    }
    return initial;
  });

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // M-Pesa specific states
  const [mpesaTab, setMpesaTab] = useState<'stk' | 'manual'>('stk');
  const [mpesaPhone, setMpesaPhone] = useState<string>('0712345678');
  const [mpesaCode, setMpesaCode] = useState<string>('');
  const [activeCheckoutId, setActiveCheckoutId] = useState<string | null>(null);
  const [mpesaWaiting, setMpesaWaiting] = useState<boolean>(false);
  const [mpesaSuccess, setMpesaSuccess] = useState<string | null>(null);
  const [configuredMpesa, setConfiguredMpesa] = useState<MpesaSetting | null>(null);

  useEffect(() => {
    apiRequest<{ success: boolean; settings: MpesaSetting }>('/mpesa/settings')
      .then(res => {
        if (res.settings) setConfiguredMpesa(res.settings);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Listen for M-Pesa payment received webhook
    const handleMpesaSuccess = (data: any) => {
      if (data.orderId === order.id || (activeCheckoutId && data.checkoutRequestId === activeCheckoutId)) {
        setMpesaWaiting(false);
        setMpesaSuccess(data.mpesaReceiptNumber);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    };

    socket.on('mpesa:payment_success', handleMpesaSuccess);
    return () => {
      socket.off('mpesa:payment_success', handleMpesaSuccess);
    };
  }, [order.id, activeCheckoutId]);

  if (!isOpen) return null;

  const toggleItem = (itemId: string, maxQty: number) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[itemId]) {
        delete copy[itemId];
      } else {
        copy[itemId] = maxQty;
      }
      return copy;
    });
  };

  const updateQty = (itemId: string, delta: number, maxQty: number) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(1, Math.min(maxQty, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const selectAll = () => {
    const all: Record<string, number> = {};
    for (const it of billableItems) {
      all[it.id] = it.quantity;
    }
    setSelectedItems(all);
  };

  const selectNone = () => {
    setSelectedItems({});
  };

  let totalGross = 0;
  for (const it of billableItems) {
    const qty = selectedItems[it.id];
    if (qty) {
      totalGross += it.unit_price * qty;
    }
  }

  const vat16 = Math.round((totalGross * (16 / 118)) * 100) / 100;
  const levy2 = Math.round((totalGross * (2 / 118)) * 100) / 100;
  const netSubtotal = totalGross - vat16 - levy2;

  const tipVal = Number(tipAmount) || 0;
  const givenCash = Number(paidAmount) || totalGross;
  const changeVal = paymentMethod === 'cash' ? Math.max(0, givenCash - (totalGross + tipVal)) : 0;

  // Standard Cash / Card settlement
  const handleSettle = async () => {
    const payloadItems = Object.entries(selectedItems).map(([itemId, qty]) => ({
      order_item_id: itemId,
      quantity: qty
    }));

    if (payloadItems.length === 0) {
      setError(t('split.select_items_desc'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/pos/orders/${order.id}/split-bill`, {
        method: 'POST',
        body: JSON.stringify({
          items: payloadItems,
          payment_method: paymentMethod,
          paid_amount: givenCash,
          tip_amount: tipVal,
          waiter_id: activeWaiter?.id || order.waiter_id,
          shift_id: activeShift?.id || order.shift_id
        })
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error settling payment');
    } finally {
      setLoading(false);
    }
  };

  // M-Pesa STK Push
  const handleSendStkPush = async () => {
    if (!mpesaPhone) return;
    setLoading(true);
    setError(null);
    setMpesaWaiting(true);

    try {
      const payloadItems = Object.entries(selectedItems).map(([itemId, qty]) => ({
        order_item_id: itemId,
        quantity: qty
      }));

      const res = await apiRequest<{
        success: boolean;
        checkoutRequestId: string;
        phoneFormatted: string;
        message: string;
      }>('/mpesa/stk-push', {
        method: 'POST',
        body: JSON.stringify({
          order_id: order.id,
          phone_number: mpesaPhone,
          amount: totalGross,
          waiter_id: activeWaiter?.id || order.waiter_id,
          shift_id: activeShift?.id || order.shift_id,
          items: payloadItems
        })
      });

      setActiveCheckoutId(res.checkoutRequestId);
    } catch (err: any) {
      setError(err.message || 'Error sending STK Push');
      setMpesaWaiting(false);
    } finally {
      setLoading(false);
    }
  };

  // Simulate customer PIN for test / demo
  const handleSimulatePin = async () => {
    if (!activeCheckoutId) return;
    try {
      await apiRequest('/mpesa/simulate-approval', {
        method: 'POST',
        body: JSON.stringify({ checkout_request_id: activeCheckoutId })
      });
    } catch (err: any) {
      alert(err.message || 'Simulation error');
    }
  };

  // Manual M-Pesa Code Verification
  const handleVerifyManualCode = async () => {
    if (!mpesaCode) return;
    setLoading(true);
    setError(null);

    try {
      const payloadItems = Object.entries(selectedItems).map(([itemId, qty]) => ({
        order_item_id: itemId,
        quantity: qty
      }));

      await apiRequest<{ success: boolean; message: string }>('/mpesa/verify-manual', {
        method: 'POST',
        body: JSON.stringify({
          order_id: order.id,
          receipt_code: mpesaCode,
          amount: totalGross,
          waiter_id: activeWaiter?.id || order.waiter_id,
          shift_id: activeShift?.id || order.shift_id,
          items: payloadItems
        })
      });

      setMpesaSuccess(mpesaCode.toUpperCase());
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Error verifying M-Pesa code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel-elevated" style={{ maxWidth: '640px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={22} color="var(--primary)" />
              {t('split.title')}
            </h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {t('printer_ticket.table')} <strong>{order.table_name}</strong> • {t('printer_ticket.waiter')} <strong>{order.waiter_name}</strong>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Item Selection Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {t('split.select_items_desc')}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={selectAll} style={{ fontSize: '0.78rem', padding: '4px 8px' }}>
              {t('split.select_all')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={selectNone} style={{ fontSize: '0.78rem', padding: '4px 8px' }}>
              {t('split.select_none')}
            </button>
          </div>
        </div>

        {/* Item List */}
        <div style={{
          maxHeight: '160px',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          padding: '8px',
          marginBottom: '16px'
        }}>
          {billableItems.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('split.no_open_items')}
            </div>
          ) : (
            billableItems.map(it => {
              const isSelected = !!selectedItems[it.id];
              const qty = selectedItems[it.id] || 0;

              return (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                    border: isSelected ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                    marginBottom: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(it.id, it.quantity)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{it.recipe_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatKES(it.unit_price)}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {it.quantity > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => updateQty(it.id, -1, it.quantity)}
                            style={{ padding: '2px 8px', minHeight: '28px', fontSize: '0.85rem' }}
                          >
                            -
                          </button>
                          <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => updateQty(it.id, 1, it.quantity)}
                            style={{ padding: '2px 8px', minHeight: '28px', fontSize: '0.85rem' }}
                          >
                            +
                          </button>
                        </div>
                      )}
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: '85px', textAlign: 'right' }}>
                        {formatKES(it.unit_price * qty)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Totals & Taxes Breakdown */}
        <div style={{
          background: 'var(--bg-surface-elevated)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          marginBottom: '16px',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
            <span>{t('split.net_subtotal')}</span>
            <span>{formatKES(netSubtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
            <span>{t('split.vat_16')}</span>
            <span>{formatKES(vat16)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>{t('split.levy_2')}</span>
            <span>{formatKES(levy2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', color: 'var(--primary)' }}>
            <span>{t('split.bill_total')}</span>
            <span>{formatKES(totalGross)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            {t('split.payment_method')}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button
              type="button"
              className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPaymentMethod('cash'); setMpesaWaiting(false); }}
            >
              <Banknote size={18} />
              {t('common.cash')}
            </button>
            <button
              type="button"
              className={`btn ${paymentMethod === 'card' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setPaymentMethod('card'); setMpesaWaiting(false); }}
            >
              <CreditCard size={18} />
              {t('common.card')}
            </button>
            <button
              type="button"
              className={`btn ${paymentMethod === 'mpesa' ? 'btn-success' : 'btn-secondary'}`}
              onClick={() => setPaymentMethod('mpesa')}
              style={{ background: paymentMethod === 'mpesa' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined }}
            >
              <SmartphoneNfc size={18} />
              {t('common.mpesa')}
            </button>
          </div>
        </div>

        {/* M-PESA INTERACTIVE INTEGRATION PANEL */}
        {paymentMethod === 'mpesa' && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={20} color="#34d399" />
                <strong style={{ fontSize: '1rem', color: '#34d399' }}>{t('mpesa.title')}</strong>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn ${mpesaTab === 'stk' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMpesaTab('stk')}
                  style={{ fontSize: '0.78rem', padding: '4px 10px', minHeight: '30px' }}
                >
                  STK Push
                </button>
                <button
                  type="button"
                  className={`btn ${mpesaTab === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMpesaTab('manual')}
                  style={{ fontSize: '0.78rem', padding: '4px 10px', minHeight: '30px' }}
                >
                  Till / Code
                </button>
              </div>
            </div>

            {mpesaSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '10px'
              }}>
                <CheckCircle2 size={20} />
                {t('mpesa.payment_success')} ({mpesaSuccess})
              </div>
            )}

            {/* SUBTAB 1: STK PUSH */}
            {mpesaTab === 'stk' && !mpesaSuccess && (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('mpesa.phone_label')}
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder={t('mpesa.phone_placeholder')}
                    value={mpesaPhone}
                    onChange={e => setMpesaPhone(e.target.value)}
                    style={{ fontSize: '1.05rem', fontWeight: 600, flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleSendStkPush}
                    disabled={loading || !mpesaPhone || totalGross === 0}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Send size={16} /> {t('mpesa.send_stk_btn')}
                  </button>
                </div>

                {/* Waiting indicator */}
                {mpesaWaiting && (
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'center'
                  }}>
                    <Loader2 size={24} color="#34d399" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: '0.9rem', color: '#f3f4f6', fontWeight: 600 }}>
                      {t('mpesa.waiting_pin', { phone: mpesaPhone })}
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSimulatePin}
                        style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                      >
                        ⚡ {t('mpesa.simulate_pin_btn')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 2: MANUAL TILL / PAYBILL CODE */}
            {mpesaTab === 'manual' && !mpesaSuccess && (
              <div>
                <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {configuredMpesa?.business_type === 'paybill' ? t('mpesa.paybill_label') : t('mpesa.till_label')}
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: '#34d399' }}>
                      {configuredMpesa?.business_type === 'paybill' ? configuredMpesa.shortcode : (configuredMpesa?.till_number || '543210')}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t('mpesa.account_label')}</span>
                    <strong>{order.table_name}</strong>
                  </div>
                </div>

                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('mpesa.receipt_code_label')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder={t('mpesa.receipt_code_placeholder')}
                    value={mpesaCode}
                    onChange={e => setMpesaCode(e.target.value)}
                    style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '1rem', flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleVerifyManualCode}
                    disabled={loading || !mpesaCode}
                  >
                    <Check size={16} /> {t('mpesa.verify_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Standard Cash Tender & Tip Calculator (when Cash selected) */}
        {paymentMethod === 'cash' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('split.cash_tendered')}
                </label>
                <input
                  type="number"
                  placeholder={totalGross.toString()}
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('split.tip_label')}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={tipAmount}
                  onChange={e => setTipAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Cash Buttons for Rapid Table Checkout */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPaidAmount(totalGross.toString())}
                style={{ padding: '4px 8px', fontSize: '0.76rem', minHeight: '30px', whiteSpace: 'nowrap' }}
              >
                Genau: {formatKES(totalGross)}
              </button>
              {[500, 1000, 2000, 5000].filter(amt => amt >= totalGross).map(amt => (
                <button
                  key={amt}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPaidAmount(amt.toString())}
                  style={{ padding: '4px 8px', fontSize: '0.76rem', minHeight: '30px', whiteSpace: 'nowrap' }}
                >
                  {formatKES(amt)}
                </button>
              ))}
            </div>
          </div>
        )}

        {paymentMethod === 'cash' && givenCash > (totalGross + tipVal) && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            color: '#34d399',
            fontSize: '0.95rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <span>{t('split.change_label')}</span>
            <strong style={{ fontSize: '1.2rem' }}>{formatKES(changeVal)}</strong>
          </div>
        )}

        {error && (
          <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            {t('common.cancel')}
          </button>
          {paymentMethod !== 'mpesa' && (
            <button
              type="button"
              className="btn btn-success"
              onClick={handleSettle}
              disabled={loading || totalGross === 0}
              style={{ flex: 2, fontSize: '1.05rem' }}
            >
              <Check size={20} />
              {loading ? t('split.processing') : `${t('split.settle_button')} (${formatKES(totalGross)})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

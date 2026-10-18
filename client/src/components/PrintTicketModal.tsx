import React from 'react';
import { PrintTicketPayload } from '../types';
import { useTranslation } from '../i18n';
import { Printer, X, UtensilsCrossed, Wine, ReceiptText } from 'lucide-react';
import { formatKES } from '../api/client';

interface PrintTicketModalProps {
  ticket: PrintTicketPayload | null;
  onClose: () => void;
}

export const PrintTicketModal: React.FC<PrintTicketModalProps> = ({ ticket, onClose }) => {
  const { t } = useTranslation();
  if (!ticket) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  const getStationIcon = () => {
    if (ticket.station === 'kitchen') return <UtensilsCrossed size={20} color="#f59e0b" />;
    if (ticket.station === 'bar') return <Wine size={20} color="#10b981" />;
    return <ReceiptText size={20} color="#6366f1" />;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel-elevated" style={{ maxWidth: '440px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getStationIcon()}
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>{t('printer_ticket.preview_title')}</h3>
              <span className="badge badge-neutral" style={{ marginTop: '2px' }}>
                {t('printer_ticket.station')} {ticket.station.toUpperCase()}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Realistic Receipt Paper Visual */}
        <div 
          id="printable-receipt"
          style={{
            background: '#ffffff',
            color: '#111827',
            padding: '20px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            marginBottom: '20px',
            fontSize: '0.9rem',
            lineHeight: 1.4
          }}
        >
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #6b7280', paddingBottom: '10px', marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '1px' }}>KENIA RMS</div>
            <div style={{ fontWeight: 'bold' }}>*** {ticket.title} ***</div>
            <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>Nairobi, Kenya • Powered by KeniaRMS</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span><strong>{t('printer_ticket.table')}</strong> {ticket.tableName}</span>
            <span><strong>{t('printer_ticket.waiter')}</strong> {ticket.waiterName}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '8px' }}>
            {new Date(ticket.timestamp).toLocaleString('en-GB')}
          </div>

          <div style={{ borderBottom: '1px solid #111827', margin: '8px 0' }} />

          <div style={{ minHeight: '60px' }}>
            {ticket.items.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>{item.quantity}x {item.name}</span>
                  {item.price !== undefined && (
                    <span>{formatKES(item.quantity * item.price)}</span>
                  )}
                </div>
                {item.notes && (
                  <div style={{ fontSize: '0.8rem', color: '#b91c1c', fontStyle: 'italic', paddingLeft: '14px' }}>
                    ↳ {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1px dashed #6b7280', margin: '12px 0 8px 0' }} />

          {ticket.total !== undefined && (
            <div>
              {ticket.subtotal !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{t('printer_ticket.net')}</span>
                  <span>{formatKES(ticket.subtotal)}</span>
                </div>
              )}
              {ticket.tax16 !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{t('printer_ticket.vat_16')}</span>
                  <span>{formatKES(ticket.tax16)}</span>
                </div>
              )}
              {ticket.levy2 !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{t('printer_ticket.levy_2')}</span>
                  <span>{formatKES(ticket.levy2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '6px', borderTop: '1px solid #111827', paddingTop: '4px' }}>
                <span>{t('printer_ticket.total')}</span>
                <span>{formatKES(ticket.total)}</span>
              </div>
              {ticket.paymentMethod && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '4px' }}>
                  <span>{t('printer_ticket.payment_method')}</span>
                  <span>{ticket.paymentMethod.toUpperCase()}</span>
                </div>
              )}
              {ticket.tipAmount !== undefined && ticket.tipAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
                  <span>{t('printer_ticket.tip')}</span>
                  <span>{formatKES(ticket.tipAmount)}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem', borderTop: '1px dashed #6b7280', paddingTop: '8px' }}>
            {t('printer_ticket.thank_you')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            {t('printer_ticket.close')}
          </button>
          <button className="btn btn-primary" onClick={handleBrowserPrint} style={{ flex: 1 }}>
            <Printer size={18} />
            {t('printer_ticket.print')}
          </button>
        </div>
      </div>
    </div>
  );
};

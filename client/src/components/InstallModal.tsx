import React from 'react';
import { useTranslation } from '../i18n';
import { Smartphone, Share, PlusSquare, X } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-card glass-panel-elevated" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '420px', padding: '24px', textAlign: 'center', position: 'relative' }}
      >
        <button 
          className="btn btn-ghost" 
          onClick={onClose}
          style={{ position: 'absolute', top: '12px', right: '12px', padding: '6px' }}
        >
          <X size={18} />
        </button>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto'
        }}>
          <Smartphone size={28} />
        </div>

        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
          {t('waiter_app.install_title')}
        </h3>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px', lineHeight: 1.4 }}>
          {t('waiter_app.install_desc')}
        </p>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px',
          textAlign: 'left',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '6px', borderRadius: '6px' }}>
              <Share size={18} color="var(--primary)" />
            </div>
            <span style={{ fontSize: '0.85rem' }}>
              1. {t('waiter_app.ios_instructions')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '6px', borderRadius: '6px' }}>
              <PlusSquare size={18} color="#10b981" />
            </div>
            <span style={{ fontSize: '0.85rem' }}>
              2. "Zum Home-Bildschirm" / "Add to Home Screen"
            </span>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={onClose}
          style={{ width: '100%', padding: '10px' }}
        >
          {t('common.ok')}
        </button>
      </div>
    </div>
  );
};

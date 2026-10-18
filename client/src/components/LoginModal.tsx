import React, { useState } from 'react';
import { Waiter } from '../types';
import { apiRequest } from '../api/client';
import { useTranslation } from '../i18n';
import { Lock, Delete, UserCheck, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (waiter: Waiter, activeShift: any) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!pin) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<{ success: boolean; waiter: Waiter; activeShift: any }>('/waiters/login', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });

      onLoginSuccess(res.waiter, res.activeShift);
      setPin('');
      onClose();
    } catch (err: any) {
      setError(err.message || t('login.invalid_pin'));
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card glass-panel-elevated" style={{ maxWidth: '380px', padding: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '50%', 
            background: 'rgba(245, 158, 11, 0.15)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            color: 'var(--primary)'
          }}>
            <Lock size={28} />
          </div>
          <h2>{t('login.title')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {t('login.subtitle')}
          </p>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {t('login.demo_hint')}
          </div>
        </div>

        {/* PIN Display */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: pin.length > idx ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.15s ease'
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            color: '#f87171',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              className="btn btn-secondary"
              onClick={() => handleDigit(digit)}
              style={{ fontSize: '1.4rem', height: '56px', borderRadius: '12px' }}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBackspace}
            style={{ height: '56px', borderRadius: '12px', color: 'var(--text-muted)' }}
          >
            <Delete size={20} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleDigit('0')}
            style={{ fontSize: '1.4rem', height: '56px', borderRadius: '12px' }}
          >
            0
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || pin.length === 0}
            style={{ height: '56px', borderRadius: '12px' }}
          >
            <UserCheck size={22} />
          </button>
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          style={{ width: '100%' }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
};

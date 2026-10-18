import React, { useState, useEffect } from 'react';
import { PrinterSetting, MpesaSetting, Waiter } from '../types';
import { apiRequest } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  Sliders, 
  Printer, 
  Check, 
  AlertCircle, 
  UtensilsCrossed, 
  Wine, 
  Receipt,
  Server,
  Smartphone,
  ShieldCheck,
  Lock,
  Users,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Send,
  Loader2,
  Power
} from 'lucide-react';

interface SettingsPageProps {
  activeWaiter?: Waiter | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ activeWaiter }) => {
  const { t } = useTranslation();

  // RBAC State: unlocked if logged in as admin or manager, or via admin PIN
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    return activeWaiter?.role === 'admin' || activeWaiter?.role === 'manager';
  });
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Active Admin Tab
  const [adminTab, setAdminTab] = useState<'printers' | 'mpesa' | 'staff' | 'system'>('printers');

  // Printers State
  const [printers, setPrinters] = useState<PrinterSetting[]>([]);
  const [printerTestResult, setPrinterTestResult] = useState<{ id: string; message: string; success: boolean } | null>(null);
  const [savingPrinterId, setSavingPrinterId] = useState<string | null>(null);

  // M-Pesa State
  const [mpesaSettings, setMpesaSettings] = useState<MpesaSetting>({
    id: '',
    business_type: 'till',
    shortcode: '174379',
    till_number: '543210',
    passkey: '',
    consumer_key: '',
    consumer_secret: '',
    environment: 'sandbox'
  });
  const [showPasskey, setShowPasskey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [mpesaSaving, setMpesaSaving] = useState(false);
  const [mpesaSaveSuccess, setMpesaSaveSuccess] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // M-Pesa Test STK Push
  const [testPhone, setTestPhone] = useState('0712345678');
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushResult, setTestPushResult] = useState<{ success: boolean; message: string } | null>(null);

  // Staff (RBAC) State
  const [staffList, setStaffList] = useState<Waiter[]>([]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'manager' | 'admin'>('waiter');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [staffActionLoading, setStaffActionLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (activeWaiter?.role === 'admin' || activeWaiter?.role === 'manager') {
      setIsAdminUnlocked(true);
    }
  }, [activeWaiter]);

  useEffect(() => {
    if (isAdminUnlocked) {
      loadPrinters();
      loadMpesaSettings();
      loadStaff();
    }
  }, [isAdminUnlocked]);

  // Authenticate Admin via PIN
  const handleVerifyAdminPin = async (pinToVerify?: string) => {
    const pin = pinToVerify !== undefined ? pinToVerify : adminPinInput;
    if (!pin) return;
    setAuthLoading(true);
    setAdminAuthError(null);

    try {
      const res = await apiRequest<{ success: boolean; admin: Waiter }>('/waiters/verify-admin', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });

      if (res.success) {
        setIsAdminUnlocked(true);
        setAdminPinInput('');
      }
    } catch (err: any) {
      setAdminAuthError(t('settings.invalid_admin_pin'));
      setAdminPinInput('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (adminPinInput.length < 4) {
      const next = adminPinInput + digit;
      setAdminPinInput(next);
      if (next.length === 4) {
        handleVerifyAdminPin(next);
      }
    }
  };

  // Load Printers
  const loadPrinters = async () => {
    try {
      const res = await apiRequest<{ success: boolean; printers: PrinterSetting[] }>('/printers');
      setPrinters(res.printers);
    } catch (err: any) {
      console.error('Failed to load printers:', err);
    }
  };

  const handleUpdatePrinter = async (printer: PrinterSetting) => {
    setSavingPrinterId(printer.id);
    try {
      await apiRequest(`/printers/${printer.id}`, {
        method: 'PUT',
        body: JSON.stringify(printer)
      });
      await loadPrinters();
    } catch (err: any) {
      alert(err.message || 'Error saving printer');
    } finally {
      setSavingPrinterId(null);
    }
  };

  const handleTestPrint = async (printerId: string) => {
    setPrinterTestResult(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/printers/${printerId}/test`, {
        method: 'POST'
      });
      setPrinterTestResult({ id: printerId, message: res.message, success: res.success });
    } catch (err: any) {
      setPrinterTestResult({ id: printerId, message: err.message, success: false });
    }
  };

  // Load M-Pesa Settings
  const loadMpesaSettings = async () => {
    try {
      const res = await apiRequest<{ success: boolean; settings: MpesaSetting }>('/mpesa/settings');
      if (res.settings) {
        setMpesaSettings(res.settings);
      }
    } catch (err: any) {
      console.error('Failed to load mpesa settings:', err);
    }
  };

  const handleSaveMpesa = async () => {
    setMpesaSaving(true);
    setMpesaSaveSuccess(false);
    try {
      const res = await apiRequest<{ success: boolean; settings: MpesaSetting }>('/mpesa/settings', {
        method: 'PUT',
        body: JSON.stringify(mpesaSettings)
      });
      if (res.settings) {
        setMpesaSettings(res.settings);
      }
      setMpesaSaveSuccess(true);
      setTimeout(() => setMpesaSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Error saving M-Pesa settings');
    } finally {
      setMpesaSaving(false);
    }
  };

  const handleTestPush = async () => {
    if (!testPhone) return;
    setTestPushLoading(true);
    setTestPushResult(null);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/mpesa/test-stk', {
        method: 'POST',
        body: JSON.stringify({ phone_number: testPhone })
      });
      setTestPushResult(res);
    } catch (err: any) {
      setTestPushResult({ success: false, message: err.message || 'Error executing test push' });
    } finally {
      setTestPushLoading(false);
    }
  };

  const copyCallbackUrl = () => {
    const origin = window.location.origin;
    const url = `${origin}/api/mpesa/callback`;
    navigator.clipboard.writeText(url);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  // Load Staff
  const loadStaff = async () => {
    try {
      const res = await apiRequest<{ success: boolean; staff: Waiter[] }>('/waiters/all-staff');
      setStaffList(res.staff);
    } catch (err: any) {
      console.error('Failed to load staff list:', err);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffPin) return;
    setStaffActionLoading(true);
    setStaffError(null);
    setStaffSuccess(null);

    try {
      await apiRequest('/waiters/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: newStaffName,
          pin: newStaffPin,
          role: newStaffRole
        })
      });

      setStaffSuccess(t('settings.staff_saved_success'));
      setNewStaffName('');
      setNewStaffPin('');
      setIsAddStaffOpen(false);
      await loadStaff();
    } catch (err: any) {
      setStaffError(err.message || 'Error adding staff member');
    } finally {
      setStaffActionLoading(false);
    }
  };

  const handleToggleStaffActive = async (member: Waiter) => {
    const nextStatus = member.is_active === 1 ? 0 : 1;
    try {
      await apiRequest(`/waiters/staff/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: nextStatus })
      });
      await loadStaff();
    } catch (err: any) {
      alert(err.message || 'Error updating staff status');
    }
  };

  const getStationIcon = (station: string) => {
    if (station === 'kitchen') return <UtensilsCrossed size={22} color="#f59e0b" />;
    if (station === 'bar') return <Wine size={22} color="#10b981" />;
    return <Receipt size={22} color="#6366f1" />;
  };

  // -------------------------------------------------------------
  // RBAC GATE: IF NOT ADMIN UNLOCKED, DISPLAY ADMIN PIN DIALOG
  // -------------------------------------------------------------
  if (!isAdminUnlocked) {
    return (
      <div style={{ maxWidth: '440px', margin: '40px auto', textAlign: 'center' }}>
        <div className="glass-panel-elevated" style={{ padding: '32px 24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            color: '#f87171'
          }}>
            <Lock size={28} />
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>
            {t('settings.admin_required_title')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>
            {t('settings.admin_required_desc')}
          </p>

          {/* PIN Indicators */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '24px' }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '2px solid var(--primary)',
                  background: adminPinInput.length > i ? 'var(--primary)' : 'transparent',
                  transition: 'all 0.15s ease'
                }}
              />
            ))}
          </div>

          {adminAuthError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#f87171',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.82rem',
              marginBottom: '18px'
            }}>
              {adminAuthError}
            </div>
          )}

          {authLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <Loader2 size={24} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {/* Touch-Friendly Numeric Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '280px', margin: '0 auto 20px auto' }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                className="btn btn-secondary"
                disabled={authLoading}
                onClick={() => handlePinDigit(num)}
                style={{ fontSize: '1.3rem', height: '54px', fontWeight: 700 }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={authLoading}
              onClick={() => setAdminPinInput('')}
              style={{ fontSize: '0.85rem' }}
            >
              C
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={authLoading}
              onClick={() => handlePinDigit('0')}
              style={{ fontSize: '1.3rem', height: '54px', fontWeight: 700 }}
            >
              0
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={authLoading}
              onClick={() => setAdminPinInput(prev => prev.slice(0, -1))}
              style={{ fontSize: '1.1rem' }}
            >
              ⌫
            </button>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Demo Administrator PIN: <strong>9999</strong>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // UNLOCKED ADMINISTRATOR CONFIGURATION SUITE
  // -------------------------------------------------------------
  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={28} color="var(--primary)" /> {t('settings.title')}
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              <ShieldCheck size={14} /> {t('settings.admin_badge')}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            {t('settings.subtitle')}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setIsAdminUnlocked(false)}
          style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Lock size={15} /> {t('settings.lock_btn')}
        </button>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          type="button"
          className={`btn ${adminTab === 'printers' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAdminTab('printers')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Printer size={17} /> {t('settings.tab_printers')}
        </button>
        <button
          type="button"
          className={`btn ${adminTab === 'mpesa' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAdminTab('mpesa')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Smartphone size={17} /> {t('settings.tab_mpesa')}
        </button>
        <button
          type="button"
          className={`btn ${adminTab === 'staff' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAdminTab('staff')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Users size={17} /> {t('settings.tab_staff')}
        </button>
        <button
          type="button"
          className={`btn ${adminTab === 'system' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAdminTab('system')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Server size={17} /> {t('settings.tab_system')}
        </button>
      </div>

      {/* TAB 1: PRINTERS */}
      {adminTab === 'printers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Printer size={20} color="var(--primary)" /> {t('settings.printers_title')}
          </h2>

          {printers.map(printer => (
            <div key={printer.id} className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {getStationIcon(printer.station)}
                  </div>
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>{printer.name}</strong>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                      Station: <span style={{ textTransform: 'capitalize', color: 'var(--primary)' }}>{printer.station}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTestPrint(printer.id)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Printer size={15} /> {t('settings.test_print_btn')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleUpdatePrinter(printer)}
                    disabled={savingPrinterId === printer.id}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Check size={15} /> {savingPrinterId === printer.id ? t('common.loading') : t('settings.save_settings_btn')}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('settings.printer_name')}
                  </label>
                  <input
                    type="text"
                    value={printer.name}
                    onChange={e => {
                      const val = e.target.value;
                      setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, name: val } : p));
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('settings.print_mode')}
                  </label>
                  <select
                    value={printer.printer_type}
                    onChange={e => {
                      const val = e.target.value as any;
                      setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, printer_type: val } : p));
                    }}
                  >
                    <option value="browser_preview">{t('settings.mode_preview')}</option>
                    <option value="network_escpos">{t('settings.mode_network')}</option>
                  </select>
                </div>

                {printer.printer_type === 'network_escpos' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {t('settings.ip_address')}
                      </label>
                      <input
                        type="text"
                        placeholder="192.168.1.200"
                        value={printer.ip_address || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, ip_address: val } : p));
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {t('settings.port')}
                      </label>
                      <input
                        type="number"
                        placeholder="9100"
                        value={printer.port || 9100}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, port: val } : p));
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              {printerTestResult && printerTestResult.id === printer.id && (
                <div style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: printerTestResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${printerTestResult.success ? '#10b981' : '#ef4444'}`,
                  color: printerTestResult.success ? '#34d399' : '#f87171',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {printerTestResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{printerTestResult.message}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: M-PESA DARAJA CONFIGURATION */}
      {adminTab === 'mpesa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={22} color="#10b981" /> {t('settings.mpesa_title')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  {t('settings.mpesa_subtitle')}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-success"
                onClick={handleSaveMpesa}
                disabled={mpesaSaving}
                style={{ fontSize: '0.9rem', padding: '10px 18px' }}
              >
                <Check size={16} /> {mpesaSaving ? t('common.loading') : t('settings.mpesa_save_btn')}
              </button>
            </div>

            {mpesaSaveSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#34d399',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '18px',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Check size={16} /> {t('settings.mpesa_saved_success')}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('settings.mpesa_business_type')}
                </label>
                <select
                  value={mpesaSettings.business_type}
                  onChange={e => setMpesaSettings(prev => ({ ...prev, business_type: e.target.value as any }))}
                >
                  <option value="till">{t('settings.mpesa_till')}</option>
                  <option value="paybill">{t('settings.mpesa_paybill')}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('settings.mpesa_env')}
                </label>
                <select
                  value={mpesaSettings.environment}
                  onChange={e => setMpesaSettings(prev => ({ ...prev, environment: e.target.value as any }))}
                >
                  <option value="sandbox">{t('settings.mpesa_env_sandbox')}</option>
                  <option value="production">{t('settings.mpesa_env_production')}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('settings.mpesa_shortcode')}
                </label>
                <input
                  type="text"
                  placeholder="174379"
                  value={mpesaSettings.shortcode}
                  onChange={e => setMpesaSettings(prev => ({ ...prev, shortcode: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('settings.mpesa_till_number')}
                </label>
                <input
                  type="text"
                  placeholder="543210"
                  value={mpesaSettings.till_number}
                  onChange={e => setMpesaSettings(prev => ({ ...prev, till_number: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('settings.mpesa_consumer_key')}
                </label>
                <input
                  type="text"
                  placeholder="Daraja Portal Consumer Key"
                  value={mpesaSettings.consumer_key || ''}
                  onChange={e => setMpesaSettings(prev => ({ ...prev, consumer_key: e.target.value }))}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {t('settings.mpesa_consumer_secret')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Daraja Consumer Secret"
                  value={mpesaSettings.consumer_secret || ''}
                  onChange={e => setMpesaSettings(prev => ({ ...prev, consumer_secret: e.target.value }))}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {t('settings.mpesa_passkey')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPasskey(!showPasskey)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {showPasskey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <input
                  type={showPasskey ? 'text' : 'password'}
                  placeholder="Online STK Passkey (bfb279...)"
                  value={mpesaSettings.passkey || ''}
                  onChange={e => setMpesaSettings(prev => ({ ...prev, passkey: e.target.value }))}
                />
              </div>
            </div>

            {/* Callback URL Card */}
            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {t('settings.mpesa_callback_url')}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <code style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', color: '#38bdf8' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/mpesa/callback` : '/api/mpesa/callback'}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={copyCallbackUrl}
                  style={{ fontSize: '0.82rem' }}
                >
                  <Copy size={15} /> {copiedCallback ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                {t('settings.mpesa_callback_hint')}
              </div>
            </div>
          </div>

          {/* Test STK Push Section */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={18} color="var(--primary)" /> {t('settings.mpesa_test_title')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>
              Sends a 1 KES test STK Push prompt to verify connectivity between your server and the Safaricom Daraja gateway.
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '240px', flex: 1 }}>
                <input
                  type="text"
                  placeholder="0712345678"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTestPush}
                disabled={testPushLoading || !testPhone}
                style={{ fontSize: '0.9rem' }}
              >
                {testPushLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                {t('settings.mpesa_test_btn')}
              </button>
            </div>

            {testPushResult && (
              <div style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: testPushResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${testPushResult.success ? '#10b981' : '#ef4444'}`,
                color: testPushResult.success ? '#34d399' : '#f87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {testPushResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                <span>{testPushResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STAFF & ROLE MANAGEMENT (RBAC) */}
      {adminTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={22} color="var(--primary)" /> {t('settings.staff_title')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  {t('settings.staff_subtitle')}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsAddStaffOpen(!isAddStaffOpen)}
                style={{ fontSize: '0.9rem' }}
              >
                <UserPlus size={16} /> {t('settings.add_staff_btn')}
              </button>
            </div>

            {staffSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#34d399',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '18px',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Check size={16} /> {staffSuccess}
              </div>
            )}

            {/* Add Staff Form Drawer */}
            {isAddStaffOpen && (
              <form onSubmit={handleCreateStaff} style={{ background: 'var(--bg-surface)', padding: '18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{t('settings.add_staff_btn')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {t('settings.staff_name')}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Samuel Mutua"
                      value={newStaffName}
                      onChange={e => setNewStaffName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {t('settings.staff_role')}
                    </label>
                    <select
                      value={newStaffRole}
                      onChange={e => setNewStaffRole(e.target.value as any)}
                    >
                      <option value="waiter">{t('settings.role_waiter')}</option>
                      <option value="manager">{t('settings.role_manager')}</option>
                      <option value="admin">{t('settings.role_admin')}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {t('settings.staff_pin')}
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="4 Digits"
                      value={newStaffPin}
                      onChange={e => setNewStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
                      required
                    />
                  </div>
                </div>

                {staffError && (
                  <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>
                    {staffError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={staffActionLoading}>
                    {staffActionLoading ? t('common.loading') : t('settings.save_staff_btn')}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setIsAddStaffOpen(false)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            )}

            {/* Staff Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('settings.staff_name')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('settings.staff_role')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('settings.staff_pin')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('settings.staff_status')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map(member => (
                    <tr key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>{member.name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: member.role === 'admin' ? 'rgba(239, 68, 68, 0.15)' : member.role === 'manager' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: member.role === 'admin' ? '#f87171' : member.role === 'manager' ? '#fbbf24' : '#a5b4fc'
                        }}>
                          {member.role === 'admin' ? t('settings.role_admin') : member.role === 'manager' ? t('settings.role_manager') : t('settings.role_waiter')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>••••</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          color: member.is_active === 1 ? '#34d399' : 'var(--text-dim)',
                          fontSize: '0.85rem'
                        }}>
                          {member.is_active === 1 ? t('settings.staff_active') : t('settings.staff_inactive')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleToggleStaffActive(member)}
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        >
                          <Power size={14} />
                          {member.is_active === 1 ? t('settings.delete_staff_btn') : t('settings.staff_active')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM & TAXES */}
      {adminTab === 'system' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} color="var(--primary)" /> {t('settings.system_title')}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('settings.country_currency')}</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px' }}>Kenya (KES / KSh)</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>East Africa Time (EAT)</span>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('settings.taxes_info')}</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px', color: 'var(--primary)' }}>
                16% VAT + 2% Catering Levy
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('settings.db_info')}</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px' }}>SQLite WAL-Mode</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Zero-maintenance local file</span>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('settings.container_info')}</span>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px', color: '#34d399' }}>Docker Cloud & Local Ready</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>docker-compose.yml</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Waiter, WaiterShift } from '../types';
import { formatKES } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  LayoutGrid, 
  Boxes, 
  Utensils, 
  Wallet, 
  FileSpreadsheet, 
  Tv, 
  Sliders, 
  User, 
  LogOut, 
  AlertTriangle,
  Globe,
  Lock,
  Smartphone,
  Layers,
  Users
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeWaiter: Waiter | null;
  activeShift: WaiterShift | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  lowStockCount: number;
  onNavigateToShoppingList: () => void;
  isWaiterMode: boolean;
  onToggleWaiterMode?: () => void;
  onTriggerInstall: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeWaiter,
  activeShift,
  onOpenLogin,
  onLogout,
  lowStockCount,
  onNavigateToShoppingList,
  isWaiterMode,
  onToggleWaiterMode,
  onTriggerInstall
}) => {
  const { t, language, setLanguage, languages } = useTranslation();

  // Role enforcement: Standard waiters only see POS (Bestellen & Abrechnen) and Shift (Ein-/Ausstempeln & Kassensturz)
  const isStandardWaiter = !activeWaiter || activeWaiter.role === 'waiter';

  // Definition of all possible navigation tabs with allowed roles
  const allNavItems = [
    { 
      id: 'pos', 
      label: t('nav.pos'), 
      icon: <LayoutGrid size={18} />, 
      allowedRoles: ['waiter', 'manager', 'admin'] 
    },
    { 
      id: 'shift', 
      label: t('nav.shift'), 
      icon: <Wallet size={18} />, 
      allowedRoles: ['waiter', 'manager', 'admin'] 
    },
    { 
      id: 'inventory', 
      label: t('nav.inventory'), 
      icon: <Boxes size={18} />, 
      badge: lowStockCount > 0 ? lowStockCount : undefined, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'recipes', 
      label: t('nav.recipes'), 
      icon: <Utensils size={18} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'closing', 
      label: t('nav.closing'), 
      icon: <FileSpreadsheet size={18} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'staff', 
      label: t('nav.staff'), 
      icon: <Users size={18} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'display', 
      label: t('nav.display'), 
      icon: <Tv size={18} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'settings', 
      label: t('nav.settings'), 
      icon: (activeWaiter?.role === 'admin') ? <Sliders size={18} /> : <Lock size={16} color="var(--primary)" />, 
      allowedRoles: ['admin'] 
    }
  ];

  // If in waiter mode or user is a waiter, filter strictly to POS & Shift
  const currentRole = activeWaiter?.role || 'waiter';
  const navItems = (isWaiterMode || isStandardWaiter)
    ? allNavItems.filter(item => item.id === 'pos' || item.id === 'shift')
    : allNavItems.filter(item => item.allowedRoles.includes(currentRole));

  return (
    <header className="navbar">
      {/* Brand & Mode Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          color: '#0d1117',
          fontSize: '1.2rem',
          boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
          flexShrink: 0
        }}>
          K
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>KeniaRMS</span>
            <span style={{ 
              fontSize: '0.62rem', 
              background: isStandardWaiter || isWaiterMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
              color: isStandardWaiter || isWaiterMode ? '#34d399' : 'var(--primary)', 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}>
              {isStandardWaiter || isWaiterMode ? t('waiter_app.badge').toUpperCase() : 'KENYA • KES'}
            </span>
            <span style={{ 
              fontSize: '0.62rem', 
              background: 'rgba(255, 255, 255, 0.08)', 
              color: 'var(--text-muted)', 
              padding: '2px 5px', 
              borderRadius: '4px',
              fontWeight: 600
            }}>
              v1.1.0
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Strictly Filtered by Role */}
      <nav className="nav-links">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '999px',
                fontWeight: 700
              }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Right Controls: Install App Button, Language Switcher, Low Stock & Waiter Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* PWA Install Button */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onTriggerInstall}
          title={t('waiter_app.install_btn')}
          style={{
            padding: '5px 10px',
            minHeight: '32px',
            fontSize: '0.78rem',
            background: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            color: 'var(--primary)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <Smartphone size={14} />
          <span className="pwa-install-text">{t('waiter_app.install_btn')}</span>
        </button>

        {/* Manager/Admin toggle between Full View and Waiter Mode */}
        {activeWaiter && (activeWaiter.role === 'manager' || activeWaiter.role === 'admin') && onToggleWaiterMode && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onToggleWaiterMode}
            title={isWaiterMode ? t('waiter_app.switch_to_full') : t('waiter_app.switch_to_waiter')}
            style={{ padding: '5px 8px', minHeight: '32px', fontSize: '0.78rem' }}
          >
            <Layers size={14} />
            <span>{isWaiterMode ? t('waiter_app.switch_to_full') : t('waiter_app.switch_to_waiter')}</span>
          </button>
        )}

        {/* Language Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-surface)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <Globe size={13} color="var(--text-dim)" style={{ marginLeft: '4px' }} />
          {languages.map(lang => (
            <button
              key={lang.code}
              type="button"
              className="btn btn-ghost"
              onClick={() => setLanguage(lang.code)}
              style={{
                padding: '2px 6px',
                minHeight: '26px',
                fontSize: '0.75rem',
                fontWeight: language === lang.code ? 800 : 500,
                color: language === lang.code ? 'var(--primary)' : 'var(--text-muted)',
                background: language === lang.code ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                borderRadius: '4px'
              }}
              title={lang.label}
            >
              {lang.flag} {lang.code.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Low Stock Warning (Manager/Admin Only) */}
        {!isStandardWaiter && !isWaiterMode && lowStockCount > 0 && (
          <button 
            className="btn btn-ghost" 
            onClick={onNavigateToShoppingList}
            title={t('nav.low_stock_warning')}
            style={{ 
              color: '#f87171', 
              background: 'rgba(239, 68, 68, 0.12)', 
              padding: '5px 8px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              minHeight: '32px'
            }}
          >
            <AlertTriangle size={14} />
            <span>{lowStockCount}</span>
          </button>
        )}

        {/* Active Waiter Badge / Login Button */}
        {activeWaiter ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 8px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{activeWaiter.name}</span>
              <span style={{ fontSize: '0.68rem', color: activeShift ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
                {activeShift ? `${t('waiter_app.shift_status')}: ${formatKES(activeShift.starting_float)}` : t('nav.no_shift')}
              </span>
            </div>
            <button 
              className="btn btn-ghost" 
              onClick={onLogout}
              style={{ padding: '4px', color: 'var(--text-muted)' }}
              title={t('nav.logout')}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={onOpenLogin} style={{ padding: '6px 12px', fontSize: '0.82rem', minHeight: '32px' }}>
            <User size={15} />
            {t('nav.login')}
          </button>
        )}
      </div>
    </header>
  );
};

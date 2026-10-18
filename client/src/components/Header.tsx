import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
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
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Standard waiters only see POS and Shift
  const isStandardWaiter = !activeWaiter || activeWaiter.role === 'waiter';
  const currentRole = activeWaiter?.role || 'waiter';

  // Helper for 2-letter avatar initials (stripping parenthesis like (Manager))
  const getInitials = (name: string) => {
    const clean = name.replace(/\(.*?\)/g, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Definition of all navigation tabs with allowed roles
  const allNavItems = [
    { 
      id: 'pos', 
      label: t('nav.pos'), 
      icon: <LayoutGrid size={16} />, 
      allowedRoles: ['waiter', 'manager', 'admin'] 
    },
    { 
      id: 'shift', 
      label: t('nav.shift'), 
      icon: <Wallet size={16} />, 
      allowedRoles: ['waiter', 'manager', 'admin'] 
    },
    { 
      id: 'inventory', 
      label: t('nav.inventory'), 
      icon: <Boxes size={16} />, 
      badge: lowStockCount > 0 ? lowStockCount : undefined, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'recipes', 
      label: t('nav.recipes'), 
      icon: <Utensils size={16} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'closing', 
      label: t('nav.closing'), 
      icon: <FileSpreadsheet size={16} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'staff', 
      label: t('nav.staff'), 
      icon: <Users size={16} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'display', 
      label: t('nav.display'), 
      icon: <Tv size={16} />, 
      allowedRoles: ['manager', 'admin'] 
    },
    { 
      id: 'settings', 
      label: t('nav.settings'), 
      icon: (activeWaiter?.role === 'admin') ? <Sliders size={16} /> : <Lock size={15} color="var(--primary)" />, 
      allowedRoles: ['admin'] 
    }
  ];

  // If in waiter mode or user is a waiter, filter strictly to POS & Shift
  const navItems = (isWaiterMode || isStandardWaiter)
    ? allNavItems.filter(item => item.id === 'pos' || item.id === 'shift')
    : allNavItems.filter(item => item.allowedRoles.includes(currentRole));

  return (
    <header className="navbar">
      {/* Brand & Role Status */}
      <div className="navbar-brand-group">
        <div className="navbar-logo-badge" title="KeniaRMS">
          K
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="navbar-brand-name">KeniaRMS</span>
            <span className={`navbar-role-pill ${isStandardWaiter || isWaiterMode ? 'waiter' : currentRole}`}>
              <span className={`role-dot ${isStandardWaiter || isWaiterMode ? 'waiter' : currentRole}`} />
              {isStandardWaiter || isWaiterMode 
                ? t('waiter_app.badge') 
                : t(`nav.role_${currentRole}`) || currentRole}
            </span>
            <span className="navbar-version-tag">
              v1.1.2
            </span>
          </div>
        </div>
      </div>

      {/* Center Navigation - Segmented Modern Pill */}
      <nav className="navbar-nav">
        <div className="nav-segmented-pill">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-tab-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span>{item.icon}</span>
              <span className="nav-tab-text">{item.label}</span>
              {item.badge !== undefined && (
                <span className="nav-tab-badge">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Right-Side Utility Controls */}
      <div className="navbar-utils">
        {/* Low Stock Alert Button (Manager/Admin Only) */}
        {!isStandardWaiter && !isWaiterMode && lowStockCount > 0 && (
          <button 
            type="button"
            className="header-alert-btn" 
            onClick={onNavigateToShoppingList}
            title={`${lowStockCount} ${t('nav.low_stock_warning')}`}
          >
            <AlertTriangle size={15} />
            <span>{lowStockCount}</span>
          </button>
        )}

        {/* Manager/Admin toggle between Full View and Waiter Terminal */}
        {activeWaiter && (activeWaiter.role === 'manager' || activeWaiter.role === 'admin') && onToggleWaiterMode && (
          <button
            type="button"
            className={`header-util-btn ${isWaiterMode ? 'active' : ''}`}
            onClick={onToggleWaiterMode}
            title={isWaiterMode ? t('waiter_app.switch_to_full') : t('waiter_app.switch_to_waiter')}
          >
            <Layers size={14} />
            <span className="header-util-label">
              {isWaiterMode ? t('waiter_app.switch_to_full') : t('waiter_app.switch_to_waiter')}
            </span>
          </button>
        )}

        {/* PWA Install Button */}
        <button
          type="button"
          className="header-util-btn"
          onClick={onTriggerInstall}
          title={t('waiter_app.install_btn')}
        >
          <Smartphone size={14} color="var(--primary)" />
          <span className="header-util-label">{t('nav.install_app')}</span>
        </button>

        {/* Language Switcher Dropdown */}
        <div style={{ position: 'relative' }} ref={langRef}>
          <button
            type="button"
            className="header-util-btn"
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            title="Language / Sprache / Lugha"
            style={{ minWidth: '68px', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Globe size={14} color="var(--primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>{language.toUpperCase()}</span>
            </div>
            <ChevronDown 
              size={11} 
              color="var(--text-muted)" 
              style={{ 
                transform: langDropdownOpen ? 'rotate(180deg)' : 'none', 
                transition: 'transform 0.15s ease' 
              }} 
            />
          </button>

          {langDropdownOpen && (
            <div className="header-dropdown-menu">
              {languages.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  className={`header-dropdown-item ${language === lang.code ? 'active' : ''}`}
                  onClick={() => {
                    setLanguage(lang.code);
                    setLangDropdownOpen(false);
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '0.95rem' }}>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                  {language === lang.code && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Waiter Profile / Login Capsule */}
        {activeWaiter ? (
          <div className="header-user-pill">
            <div 
              className={`user-avatar-circle user-avatar-${activeWaiter.role}`}
              title={`${activeWaiter.name} (${t(`nav.role_${activeWaiter.role}`) || activeWaiter.role})`}
            >
              {getInitials(activeWaiter.name)}
            </div>
            <div className="user-info-text">
              <span className="user-name">{activeWaiter.name.replace(/\(.*?\)/g, '').trim()}</span>
              {activeShift ? (
                <span className="user-shift-status">
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  {formatKES(activeShift.starting_float)}
                </span>
              ) : (
                <span className="user-no-shift">
                  {t(`nav.role_${activeWaiter.role}`) || activeWaiter.role}
                </span>
              )}
            </div>
            <button 
              type="button"
              className="user-logout-btn" 
              onClick={onLogout}
              title={t('nav.logout')}
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button 
            type="button"
            className="btn btn-primary" 
            onClick={onOpenLogin} 
            style={{ padding: '6px 14px', fontSize: '0.82rem', minHeight: '34px', gap: '6px' }}
          >
            <User size={15} />
            <span>{t('nav.login')}</span>
          </button>
        )}
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { Waiter, WaiterShift, PrintTicketPayload, InventoryItem } from './types';
import { apiRequest, socket } from './api/client';
import { useTranslation } from './i18n';

import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { PrintTicketModal } from './components/PrintTicketModal';
import { InstallModal } from './components/InstallModal';

import { POSPage } from './pages/POSPage';
import { InventoryPage } from './pages/InventoryPage';
import { RecipesPage } from './pages/RecipesPage';
import { ShiftPage } from './pages/ShiftPage';
import { ClosingPage } from './pages/ClosingPage';
import { DisplayPage } from './pages/DisplayPage';
import { SettingsPage } from './pages/SettingsPage';
import { StaffPage } from './pages/StaffPage';
import { LayoutGrid, Wallet } from 'lucide-react';

export const App: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'display' || window.location.pathname.startsWith('/display')) {
      return 'display';
    }
    return 'pos';
  });
  const [activeWaiter, setActiveWaiter] = useState<Waiter | null>(null);
  const [activeShift, setActiveShift] = useState<WaiterShift | null>(null);

  // Waiter-Mode detection: URL query ?mode=waiter, path /waiter, standalone PWA, or stored mode
  const [isWaiterMode, setIsWaiterMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'waiter' || window.location.pathname.startsWith('/waiter')) {
      return true;
    }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return true;
    const saved = localStorage.getItem('kenia_rms_mode');
    return saved === 'waiter';
  });

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activePrintTicket, setActivePrintTicket] = useState<PrintTicketPayload | null>(null);

  // Stock alert
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  useEffect(() => {
    checkLowStock();
    initDefaultWaiter();

    // PWA Install Event Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Socket events
    socket.on('printer:job', (ticket: PrintTicketPayload) => {
      console.log('Received print ticket job:', ticket);
      setActivePrintTicket(ticket);
    });

    socket.on('inventory:low_stock_warning', () => {
      checkLowStock();
    });
    socket.on('inventory:updated_all', () => {
      checkLowStock();
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      socket.off('printer:job');
      socket.off('inventory:low_stock_warning');
      socket.off('inventory:updated_all');
    };
  }, []);

  // Strict Role-Based Access Control:
  // Waiters (role === 'waiter') are strictly confined to POS and Shift, while Display can be viewed on TVs
  useEffect(() => {
    if (activeWaiter && activeWaiter.role === 'waiter') {
      if (activeTab !== 'pos' && activeTab !== 'shift' && activeTab !== 'display') {
        setActiveTab('pos');
      }
    }
  }, [activeWaiter, activeTab]);

  const initDefaultWaiter = async () => {
    try {
      const res = await apiRequest<{ success: boolean; waiters: Waiter[] }>('/waiters');
      if (res.waiters && res.waiters.length > 0) {
        const defaultWaiter = res.waiters[0]; // Amina Odhiambo
        setActiveWaiter(defaultWaiter);

        const shiftRes = await apiRequest<{ success: boolean; shift: WaiterShift | null }>(`/waiters/shift/current/${defaultWaiter.id}`);
        if (shiftRes.shift) {
          setActiveShift(shiftRes.shift);
        }
      }
    } catch (err) {
      console.error('Failed to init default waiter:', err);
    }
  };

  const checkLowStock = async () => {
    try {
      const res = await apiRequest<{ success: boolean; items: InventoryItem[] }>('/inventory');
      const lowCount = res.items.filter(it => it.current_stock <= it.min_stock).length;
      setLowStockCount(lowCount);
    } catch (err) {
      console.error('Failed to check low stock:', err);
    }
  };

  const handleLoginSuccess = (waiter: Waiter, shift: WaiterShift | null) => {
    setActiveWaiter(waiter);
    setActiveShift(shift);
    // If the logging in user is a waiter, automatically switch to Waiter Mode; otherwise exit Waiter Mode
    if (waiter.role === 'waiter') {
      setIsWaiterMode(true);
      if (activeTab !== 'pos' && activeTab !== 'shift') {
        setActiveTab('pos');
      }
    } else {
      setIsWaiterMode(false);
    }
  };

  const handleLogout = () => {
    setActiveWaiter(null);
    setActiveShift(null);
    setIsLoginModalOpen(true);
  };

  const handleToggleWaiterMode = () => {
    setIsWaiterMode(prev => {
      const next = !prev;
      localStorage.setItem('kenia_rms_mode', next ? 'waiter' : 'full');
      if (next && activeTab !== 'pos' && activeTab !== 'shift') {
        setActiveTab('pos');
      }
      return next;
    });
  };

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User installed the PWA');
      }
      setDeferredPrompt(null);
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const isStandardWaiter = !activeWaiter || activeWaiter.role === 'waiter';

  return (
    <div className="app-container">
      {/* Hide standard navbar when in TV Display mode for full immersive view */}
      {activeTab !== 'display' ? (
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeWaiter={activeWaiter}
          activeShift={activeShift}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          lowStockCount={lowStockCount}
          onNavigateToShoppingList={() => {
            if (!isStandardWaiter && !isWaiterMode) {
              setActiveTab('inventory');
            }
          }}
          isWaiterMode={isWaiterMode}
          onToggleWaiterMode={handleToggleWaiterMode}
          onTriggerInstall={handleTriggerInstall}
        />
      ) : (
        <div style={{ position: 'fixed', top: '12px', left: '16px', zIndex: 100 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setActiveTab('pos')}
            style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          >
            {t('nav.back_to_pos')}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main 
        className={`main-content ${isWaiterMode || isStandardWaiter ? 'waiter-mode-active' : ''}`}
        style={activeTab === 'display' ? { padding: 0, maxWidth: '100%' } : {}}
      >
        {activeTab === 'pos' && (
          <POSPage
            activeWaiter={activeWaiter}
            activeShift={activeShift}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}
        {activeTab === 'shift' && (
          <ShiftPage
            activeWaiter={activeWaiter}
            activeShift={activeShift}
            onShiftStarted={(s) => setActiveShift(s)}
            onShiftEnded={() => setActiveShift(null)}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}
        
        {/* TV Digital Signage Display Mode (Accessible on TV displays & Manager mode) */}
        {activeTab === 'display' && <DisplayPage activeWaiter={activeWaiter} />}

        {/* Modules restricted to Manager / Admin ONLY */}
        {!isStandardWaiter && !isWaiterMode && (
          <>
            {activeTab === 'inventory' && <InventoryPage />}
            {activeTab === 'recipes' && <RecipesPage />}
            {activeTab === 'closing' && <ClosingPage />}
            {activeTab === 'staff' && <StaffPage activeWaiter={activeWaiter} />}
            {activeTab === 'settings' && <SettingsPage activeWaiter={activeWaiter} />}
          </>
        )}
      </main>

      {/* Mobile Waiter Bottom Navigation Bar (Thumb ergonomic for handheld phones) */}
      {(isWaiterMode || isStandardWaiter) && activeTab !== 'display' && (
        <nav className="waiter-bottom-nav">
          <button
            type="button"
            className={`waiter-bottom-nav-item ${activeTab === 'pos' ? 'active' : ''}`}
            onClick={() => setActiveTab('pos')}
          >
            <LayoutGrid size={20} />
            <span>{t('waiter_app.tables_tab')}</span>
          </button>
          <button
            type="button"
            className={`waiter-bottom-nav-item ${activeTab === 'shift' ? 'active' : ''}`}
            onClick={() => setActiveTab('shift')}
          >
            <Wallet size={20} />
            <span>{t('waiter_app.shift_tab')}</span>
          </button>
        </nav>
      )}

      {/* LOGIN MODAL */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* LIVE PRINT TICKET MODAL */}
      <PrintTicketModal
        ticket={activePrintTicket}
        onClose={() => setActivePrintTicket(null)}
      />

      {/* PWA INSTALLATION HELPER MODAL */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
};

export default App;

import React, { useState, useEffect } from 'react';
import { apiRequest, socket } from '../api/client';
import { useTranslation } from '../i18n';
import { DisplayScreen, Recipe, Waiter } from '../types';
import { DisplayScreenView } from '../components/DisplayScreenView';
import { DisplayWYSIWYGEditor } from '../components/DisplayWYSIWYGEditor';
import { Tv, Sliders, Maximize, Minimize, AlertCircle } from 'lucide-react';

interface DisplayPageProps {
  activeWaiter?: Waiter | null;
}

export const DisplayPage: React.FC<DisplayPageProps> = ({ activeWaiter }) => {
  const { t } = useTranslation();

  // Query parameter detection: ?screen=screen_id & ?editor=true
  const urlParams = new URLSearchParams(window.location.search);
  const initialScreenId = urlParams.get('screen') || 'screen_bar_1';
  const initialEditorMode = urlParams.get('editor') === 'true';

  const [screens, setScreens] = useState<DisplayScreen[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string>(initialScreenId);
  const [currentScreen, setCurrentScreen] = useState<DisplayScreen | null>(null);
  const [allItems, setAllItems] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditorMode, setIsEditorMode] = useState<boolean>(initialEditorMode);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Manager/Admin permission to edit
  const canEdit = !activeWaiter || activeWaiter.role === 'manager' || activeWaiter.role === 'admin';

  useEffect(() => {
    loadAllScreensAndBoard();

    // Sockets for live digital signage sync across physical TVs & devices
    const handleDisplayUpdate = () => {
      loadAllScreensAndBoard();
    };

    socket.on('display:updated', handleDisplayUpdate);
    socket.on('recipes:updated', loadAllScreensAndBoard);
    socket.on('inventory:updated_all', loadAllScreensAndBoard);

    return () => {
      socket.off('display:updated', handleDisplayUpdate);
      socket.off('recipes:updated', loadAllScreensAndBoard);
      socket.off('inventory:updated_all', loadAllScreensAndBoard);
    };
  }, [activeScreenId]);

  const loadAllScreensAndBoard = async () => {
    try {
      // 1. Fetch all configured screens
      const screensRes = await apiRequest<{ success: boolean; screens: DisplayScreen[] }>('/display/screens');
      const loadedScreens = screensRes.screens || [];
      setScreens(loadedScreens);

      // Determine target screen ID
      const targetId = activeScreenId && loadedScreens.some(s => s.id === activeScreenId)
        ? activeScreenId
        : (loadedScreens[0]?.id || 'screen_bar_1');

      if (targetId !== activeScreenId) {
        setActiveScreenId(targetId);
      }

      // 2. Fetch specific screen with resolved zone items
      const boardRes = await apiRequest<{
        success: boolean;
        screen: DisplayScreen;
        allItems?: Recipe[];
      }>(`/display/screens/${targetId}`);

      if (boardRes.screen) {
        setCurrentScreen(boardRes.screen);
      }
      if (boardRes.allItems) {
        setAllItems(boardRes.allItems);
      }
    } catch (err) {
      console.error('Failed to load display screens:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectScreen = (screenId: string) => {
    setActiveScreenId(screenId);
    // Update URL query param without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set('screen', screenId);
    window.history.replaceState({}, '', url.toString());
  };

  const handleSaveScreen = async (updatedScreen: DisplayScreen) => {
    try {
      const res = await apiRequest<{ success: boolean; screen: DisplayScreen }>(
        `/display/screens/${updatedScreen.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updatedScreen)
        }
      );

      if (res.success && res.screen) {
        setCurrentScreen(res.screen);
        setScreens(prev => prev.map(s => s.id === res.screen.id ? res.screen : s));
      }
    } catch (err) {
      console.error('Failed to save screen layout:', err);
      alert('Error saving screen: ' + (err as any).message);
    }
  };

  const handleCreateScreen = async () => {
    try {
      const newScreenName = `Bar Screen ${screens.length + 1}`;
      const res = await apiRequest<{ success: boolean; screen: DisplayScreen }>(
        '/display/screens',
        {
          method: 'POST',
          body: JSON.stringify({
            name: newScreenName,
            title: 'SAVANNAH BAR & LOUNGE',
            subtitle: 'Craft Cocktails & Ice-Cold Brews • Nairobi',
            theme: 'midnight',
            font_size: 'large',
            layout_type: '3_columns',
            ticker_enabled: 1,
            ticker_text: 'Karibu Savannah Lounge • 16% VAT & 2% Catering Levy Included',
            zones: [
              {
                id: 'z_cocktails',
                title: 'Signature Cocktails',
                icon: 'cocktail',
                categories: ['cocktails'],
                station: 'bar',
                style: 'classic_list',
                show_images: true,
                show_descriptions: true,
                show_prices: true,
                show_badges: true,
                max_items: 8,
                sort_by: 'highlight_first'
              },
              {
                id: 'z_beers',
                title: 'Beers & Ciders',
                icon: 'beer',
                categories: ['drinks'],
                station: 'bar',
                style: 'classic_list',
                show_images: true,
                show_descriptions: false,
                show_prices: true,
                show_badges: true,
                max_items: 8,
                sort_by: 'highlight_first'
              },
              {
                id: 'z_food',
                title: 'Bar Food & Bites',
                icon: 'food',
                categories: ['food'],
                station: 'kitchen',
                style: 'classic_list',
                show_images: true,
                show_descriptions: true,
                show_prices: true,
                show_badges: true,
                max_items: 8,
                sort_by: 'highlight_first'
              }
            ]
          })
        }
      );

      if (res.success && res.screen) {
        setScreens(prev => [...prev, res.screen]);
        handleSelectScreen(res.screen.id);
      }
    } catch (err) {
      console.error('Failed to create new display screen:', err);
    }
  };

  const handleDeleteScreen = async (screenId: string) => {
    if (screens.length <= 1) return;
    if (confirm(t('display.delete_screen_confirm'))) {
      try {
        await apiRequest(`/display/screens/${screenId}`, { method: 'DELETE' });
        const remaining = screens.filter(s => s.id !== screenId);
        setScreens(remaining);
        if (remaining.length > 0) {
          handleSelectScreen(remaining[0].id);
        }
      } catch (err) {
        console.error('Failed to delete screen:', err);
      }
    }
  };

  const handleResetDefaults = async () => {
    if (confirm(t('display.reset_confirm'))) {
      try {
        await apiRequest('/display/screens/reset', { method: 'POST' });
        await loadAllScreensAndBoard();
        alert(t('display.reset_success'));
      } catch (err) {
        console.error('Failed to reset screens:', err);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '80vh',
        color: 'var(--text-muted)',
        gap: '16px'
      }}>
        <Tv size={56} style={{ animation: 'pulse 1.5s infinite', color: 'var(--primary)' }} />
        <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{t('common.loading')}</div>
      </div>
    );
  }

  // RENDER WYSIWYG EDITOR MODE
  if (isEditorMode) {
    return (
      <DisplayWYSIWYGEditor
        screens={screens}
        activeScreenId={activeScreenId}
        allItems={allItems}
        onSelectScreen={handleSelectScreen}
        onSaveScreen={handleSaveScreen}
        onCreateScreen={handleCreateScreen}
        onDeleteScreen={handleDeleteScreen}
        onResetDefaults={handleResetDefaults}
        onExitEditor={() => {
          setIsEditorMode(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('editor');
          window.history.replaceState({}, '', url.toString());
        }}
      />
    );
  }

  // RENDER PURE DIGITAL SIGNAGE / TV VIEW MODE
  if (!currentScreen) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-muted)'
      }}>
        <AlertCircle size={48} style={{ marginBottom: '16px', color: 'var(--primary)' }} />
        <h2>{t('display.no_items_in_zone')}</h2>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', margin: '-20px' }}>
      {/* Subtle Floating TV Bar for Switching Screen & Fullscreen */}
      <div style={{
        position: 'fixed',
        top: '12px',
        right: '16px',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(10, 12, 16, 0.85)',
        backdropFilter: 'blur(12px)',
        padding: '6px 10px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
      }}>
        {/* Quick Screen Switcher Dropdown */}
        {screens.length > 1 && (
          <select
            className="input"
            value={activeScreenId}
            onChange={(e) => handleSelectScreen(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              fontWeight: 800,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {screens.map(s => (
              <option key={s.id} value={s.id}>
                {s.name || s.title}
              </option>
            ))}
          </select>
        )}

        {/* Enter WYSIWYG Editor Button */}
        {canEdit && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsEditorMode(true)}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: 'rgba(245, 158, 11, 0.15)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              color: 'var(--primary)'
            }}
          >
            <Sliders size={15} />
            <span>{t('display.edit_wysiwyg')}</span>
          </button>
        )}

        {/* Fullscreen Toggle */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={toggleFullscreen}
          title={isFullscreen ? t('display.view_tv') : t('display.view_tv')}
          style={{ padding: '6px 10px' }}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      {/* Main Full-Size TV Digital Signage View */}
      <DisplayScreenView
        screen={currentScreen}
        allItems={allItems}
        isInteractive={false}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenEditor={() => setIsEditorMode(true)}
        canEdit={canEdit}
      />
    </div>
  );
};

export default DisplayPage;

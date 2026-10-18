import React, { useState, useEffect } from 'react';
import { DisplayScreen, DisplayZone, Recipe, DisplayTheme, DisplayFontSize, DisplayLayoutType, DisplayZoneStyle } from '../types';
import { useTranslation } from '../i18n';
import { DisplayScreenView } from './DisplayScreenView';
import { 
  Tv, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Share2, 
  Check, 
  Sliders, 
  Columns, 
  Palette, 
  Type, 
  Layers, 
  Volume2, 
  ExternalLink,
  Wine,
  Beer,
  UtensilsCrossed,
  Coffee,
  Star,
  Flame,
  Sparkles
} from 'lucide-react';

interface DisplayWYSIWYGEditorProps {
  screens: DisplayScreen[];
  activeScreenId: string;
  allItems: Recipe[];
  onSelectScreen: (screenId: string) => void;
  onSaveScreen: (screen: DisplayScreen) => Promise<void>;
  onCreateScreen: () => void;
  onDeleteScreen: (screenId: string) => void;
  onResetDefaults: () => Promise<void>;
  onExitEditor: () => void;
}

export const DisplayWYSIWYGEditor: React.FC<DisplayWYSIWYGEditorProps> = ({
  screens,
  activeScreenId,
  allItems,
  onSelectScreen,
  onSaveScreen,
  onCreateScreen,
  onDeleteScreen,
  onResetDefaults,
  onExitEditor
}) => {
  const { t } = useTranslation();
  
  // Find currently active screen or fallback
  const currentScreenData = screens.find(s => s.id === activeScreenId) || screens[0];

  // Local mutable state for editing
  const [editingScreen, setEditingScreen] = useState<DisplayScreen>(() => {
    return JSON.parse(JSON.stringify(currentScreenData || {}));
  });

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'screen' | 'zone'>('screen');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Sync editing screen when activeScreenId changes
  useEffect(() => {
    if (currentScreenData) {
      setEditingScreen(JSON.parse(JSON.stringify(currentScreenData)));
      if (currentScreenData.zones && currentScreenData.zones.length > 0) {
        setSelectedZoneId(currentScreenData.zones[0].id);
      }
    }
  }, [activeScreenId, screens]);

  const selectedZone = editingScreen.zones?.find(z => z.id === selectedZoneId) || editingScreen.zones?.[0];

  // Handle Save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveScreen(editingScreen);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Display URL
  const handleCopyUrl = () => {
    const url = `${window.location.origin}/?mode=display&screen=${editingScreen.id}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  // Screen field updates
  const updateScreenField = <K extends keyof DisplayScreen>(field: K, val: DisplayScreen[K]) => {
    setEditingScreen(prev => ({
      ...prev,
      [field]: val
    }));
  };

  // Zone field updates
  const updateZoneField = <K extends keyof DisplayZone>(zoneId: string, field: K, val: DisplayZone[K]) => {
    setEditingScreen(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId ? { ...z, [field]: val } : z)
    }));
  };

  // Add Zone
  const handleAddZone = () => {
    const newId = 'zone_' + Math.random().toString(36).substr(2, 6);
    const newZone: DisplayZone = {
      id: newId,
      title: 'New Drink Category',
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
    };

    setEditingScreen(prev => ({
      ...prev,
      zones: [...prev.zones, newZone]
    }));
    setSelectedZoneId(newId);
    setActiveTab('zone');
  };

  // Delete Zone
  const handleDeleteZone = (zoneId: string) => {
    if (editingScreen.zones.length <= 1) return;
    if (confirm(t('display.delete_zone_confirm'))) {
      setEditingScreen(prev => {
        const nextZones = prev.zones.filter(z => z.id !== zoneId);
        if (selectedZoneId === zoneId && nextZones.length > 0) {
          setSelectedZoneId(nextZones[0].id);
        }
        return {
          ...prev,
          zones: nextZones
        };
      });
    }
  };

  // Move Zone Left / Right
  const handleMoveZone = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= editingScreen.zones.length) return;

    setEditingScreen(prev => {
      const nextZones = [...prev.zones];
      const temp = nextZones[index];
      nextZones[index] = nextZones[targetIdx];
      nextZones[targetIdx] = temp;
      return {
        ...prev,
        zones: nextZones
      };
    });
  };

  // Available categories
  const categoryOptions = [
    { key: 'cocktails', label: t('display.cat_cocktails') },
    { key: 'drinks', label: t('display.cat_drinks') },
    { key: 'food', label: t('display.cat_food') },
    { key: 'coffee', label: t('display.cat_coffee') },
    { key: 'dessert', label: t('display.cat_dessert') },
    { key: 'special', label: t('display.cat_special') }
  ];

  // Theme palettes
  const themes: Array<{ id: DisplayTheme; label: string; previewColor: string }> = [
    { id: 'midnight', label: t('display.theme_midnight'), previewColor: '#f59e0b' },
    { id: 'slate', label: t('display.theme_slate'), previewColor: '#38bdf8' },
    { id: 'emerald', label: t('display.theme_emerald'), previewColor: '#34d399' },
    { id: 'amber', label: t('display.theme_amber'), previewColor: '#fb923c' },
    { id: 'neon', label: t('display.theme_neon'), previewColor: '#06b6d4' }
  ];

  // Layout Presets
  const layoutPresets: Array<{ id: DisplayLayoutType; label: string; cols: string }> = [
    { id: '1_column', label: t('display.layout_1_col'), cols: '100%' },
    { id: '2_columns', label: t('display.layout_2_col'), cols: '50% 50%' },
    { id: '3_columns', label: t('display.layout_3_col'), cols: '33% 33% 33%' },
    { id: '4_columns', label: t('display.layout_4_col'), cols: '25% 25% 25% 25%' },
    { id: 'hero_split', label: t('display.layout_hero_split'), cols: '38% | 31% 31%' }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 40px)',
      background: '#0a0d14',
      margin: '-20px',
      overflow: 'hidden'
    }}>
      {/* TOP STUDIO TOOLBAR */}
      <div style={{
        height: '64px',
        background: '#121620',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexShrink: 0
      }}>
        {/* Screen Selector & Creation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            padding: '6px 12px',
            borderRadius: '8px',
            color: 'var(--primary)',
            fontWeight: 800,
            fontSize: '0.9rem'
          }}>
            <Tv size={18} />
            <span>{t('display.editor_title')}</span>
          </div>

          {/* Screen Dropdown */}
          <select
            className="input"
            value={editingScreen.id}
            onChange={(e) => onSelectScreen(e.target.value)}
            style={{ width: '220px', fontWeight: 700 }}
          >
            {screens.map(s => (
              <option key={s.id} value={s.id}>
                {s.name || s.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCreateScreen}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            <span>{t('display.add_screen_btn')}</span>
          </button>

          {screens.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onDeleteScreen(editingScreen.id)}
              title={t('display.delete_screen_btn')}
              style={{ padding: '8px 10px', color: 'var(--accent-ruby)' }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Right Studio Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopyUrl}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            {copiedUrl ? <Check size={16} color="var(--accent-emerald)" /> : <Share2 size={16} />}
            <span>{copiedUrl ? t('common.copied') : t('display.open_display_url')}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onResetDefaults}
            title={t('display.reset_defaults')}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <RotateCcw size={16} />
            <span>{t('display.reset_defaults')}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: '8px 18px', fontWeight: 800 }}
          >
            {saveSuccess ? <Check size={18} /> : <Save size={18} />}
            <span>{saveSuccess ? t('display.saved_success') : t('display.save_changes')}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onExitEditor}
            style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)' }}
          >
            <ExternalLink size={16} />
            <span>{t('display.view_tv')}</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE: CANVAS (LEFT) & INSPECTOR (RIGHT) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* LEFT CANVAS: 16:9 LIVE WYSIWYG PREVIEW */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, #131722 0%, #080a0f 100%)'
        }}>
          {/* Canvas Wrapper with Aspect Ratio */}
          <div style={{
            width: '100%',
            maxWidth: '1240px',
            aspectRatio: '16 / 9',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 3px rgba(255,255,255,0.08)',
            position: 'relative',
            display: 'flex'
          }}>
            <DisplayScreenView
              screen={editingScreen}
              allItems={allItems}
              isInteractive={true}
              selectedZoneId={selectedZoneId}
              onSelectZone={(zid) => {
                setSelectedZoneId(zid);
                setActiveTab('zone');
              }}
              onMoveZone={handleMoveZone}
              onDeleteZone={handleDeleteZone}
            />
          </div>

          <div style={{
            marginTop: '12px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sliders size={14} color="var(--primary)" />
            <span>{t('display.click_zone_to_edit')}</span>
          </div>
        </div>

        {/* RIGHT PANEL: INSPECTOR TABS & CONFIGURATION */}
        <div style={{
          background: '#121622',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Tab Selector */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('screen')}
              style={{
                padding: '14px',
                background: activeTab === 'screen' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'screen' ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === 'screen' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Tv size={16} />
              <span>{t('display.tab_screen_settings')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('zone')}
              style={{
                padding: '14px',
                background: activeTab === 'zone' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'zone' ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === 'zone' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Layers size={16} />
              <span>{t('display.tab_zone_settings')}</span>
            </button>
          </div>

          {/* TAB 1: SCREEN SETTINGS */}
          {activeTab === 'screen' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Screen Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                  {t('display.screen_name_label')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingScreen.name || ''}
                  onChange={(e) => updateScreenField('name', e.target.value)}
                  placeholder="e.g. Bar Screen Left"
                />
              </div>

              {/* Title & Subtitle */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                  {t('display.screen_title_label')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingScreen.title || ''}
                  onChange={(e) => updateScreenField('title', e.target.value)}
                  placeholder="e.g. SAVANNAH BAR & CRAFT COCKTAILS"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                  {t('display.screen_subtitle_label')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingScreen.subtitle || ''}
                  onChange={(e) => updateScreenField('subtitle', e.target.value)}
                  placeholder="e.g. Handcrafted Cocktails • Ice-Cold Brews"
                />
              </div>

              {/* Layout Preset */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>
                  <Columns size={15} />
                  <span>{t('display.layout_preset_label')}</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {layoutPresets.map(lp => (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => updateScreenField('layout_type', lp.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: editingScreen.layout_type === lp.id ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${editingScreen.layout_type === lp.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: editingScreen.layout_type === lp.id ? 'var(--primary)' : '#fff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{lp.label}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lp.cols}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>
                  <Palette size={15} />
                  <span>{t('display.theme_label')}</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {themes.map(th => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => updateScreenField('theme', th.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: editingScreen.theme === th.id ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${editingScreen.theme === th.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: th.previewColor,
                        display: 'inline-block',
                        flexShrink: 0
                      }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {th.label.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Scale */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>
                  <Type size={15} />
                  <span>{t('display.font_size_label')}</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {(['normal', 'large', 'xlarge'] as DisplayFontSize[]).map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => updateScreenField('font_size', sz)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: editingScreen.font_size === sz ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${editingScreen.font_size === sz ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: editingScreen.font_size === sz ? 'var(--primary)' : '#fff',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {sz === 'normal' ? t('display.font_normal') : sz === 'large' ? t('display.font_large').split(' ')[0] : t('display.font_xlarge').split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticker Settings */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.07)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                    <Volume2 size={16} color="var(--primary)" />
                    <span>{t('display.ticker_section_title')}</span>
                  </label>
                  <input
                    type="checkbox"
                    checked={Boolean(editingScreen.ticker_enabled)}
                    onChange={(e) => updateScreenField('ticker_enabled', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>

                {Boolean(editingScreen.ticker_enabled) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      className="input"
                      rows={2}
                      value={editingScreen.ticker_text || ''}
                      onChange={(e) => updateScreenField('ticker_text', e.target.value)}
                      placeholder="e.g. 🍹 Happy Hour 17:00-19:00: 20% on Cocktails!"
                      style={{ fontSize: '0.82rem', resize: 'vertical' }}
                    />

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        {t('display.ticker_speed_label')}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {(['slow', 'normal', 'fast'] as Array<'slow' | 'normal' | 'fast'>).map(sp => (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => updateScreenField('ticker_speed', sp)}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              background: editingScreen.ticker_speed === sp ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                              border: `1px solid ${editingScreen.ticker_speed === sp ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                              color: editingScreen.ticker_speed === sp ? 'var(--primary)' : '#fff',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {sp === 'slow' ? t('display.speed_slow') : sp === 'normal' ? t('display.speed_normal') : t('display.speed_fast')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ZONE SETTINGS */}
          {activeTab === 'zone' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Zones selector pill list */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {t('display.zones_list_title')} ({editingScreen.zones.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddZone}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <Plus size={14} />
                    <span>{t('display.add_zone_btn')}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {editingScreen.zones.map((z, idx) => (
                    <div
                      key={z.id}
                      onClick={() => setSelectedZoneId(z.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: selectedZone?.id === z.id ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${selectedZone?.id === z.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)' }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: selectedZone?.id === z.id ? 'var(--primary)' : '#fff' }}>
                          {z.title || `Zone ${idx + 1}`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {editingScreen.zones.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteZone(z.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent-ruby)',
                              cursor: 'pointer',
                              padding: '2px 4px'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Config fields for the selected zone */}
              {selectedZone ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {/* Zone Title */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                      {t('display.zone_title_label')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={selectedZone.title || ''}
                      onChange={(e) => updateZoneField(selectedZone.id, 'title', e.target.value)}
                    />
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                      {t('display.zone_icon_label')}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[
                        { id: 'cocktail', icon: <Wine size={16} /> },
                        { id: 'beer', icon: <Beer size={16} /> },
                        { id: 'food', icon: <UtensilsCrossed size={16} /> },
                        { id: 'coffee', icon: <Coffee size={16} /> },
                        { id: 'star', icon: <Star size={16} /> },
                        { id: 'flame', icon: <Flame size={16} /> },
                        { id: 'sparkles', icon: <Sparkles size={16} /> }
                      ].map(ic => (
                        <button
                          key={ic.id}
                          type="button"
                          onClick={() => updateZoneField(selectedZone.id, 'icon', ic.id)}
                          style={{
                            padding: '8px',
                            borderRadius: '6px',
                            background: selectedZone.icon === ic.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            color: selectedZone.icon === ic.id ? '#090b10' : '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          {ic.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                      {t('display.zone_category_label')}
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {categoryOptions.map(cat => {
                        const isCatSelected = selectedZone.categories?.includes(cat.key);
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => {
                              const current = selectedZone.categories || [];
                              const next = isCatSelected
                                ? current.filter(c => c !== cat.key)
                                : [...current, cat.key];
                              updateZoneField(selectedZone.id, 'categories', next);
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: isCatSelected ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                              border: `1px solid ${isCatSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                              color: isCatSelected ? 'var(--primary)' : '#fff',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Display Style */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                      {t('display.style_label')}
                    </label>
                    <select
                      className="input"
                      value={selectedZone.style || 'classic_list'}
                      onChange={(e) => updateZoneField(selectedZone.id, 'style', e.target.value as DisplayZoneStyle)}
                    >
                      <option value="classic_list">{t('display.style_classic_list')}</option>
                      <option value="cards">{t('display.style_cards')}</option>
                      <option value="hero_slider">{t('display.style_hero_slider')}</option>
                      <option value="compact_split">{t('display.style_compact_split')}</option>
                    </select>
                  </div>

                  {/* Max Items */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {t('display.max_items_label')}
                      </label>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {selectedZone.max_items || 8}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="20"
                      value={selectedZone.max_items || 8}
                      onChange={(e) => updateZoneField(selectedZone.id, 'max_items', parseInt(e.target.value, 10))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                      {t('display.sort_by_label')}
                    </label>
                    <select
                      className="input"
                      value={selectedZone.sort_by || 'highlight_first'}
                      onChange={(e) => updateZoneField(selectedZone.id, 'sort_by', e.target.value as any)}
                    >
                      <option value="highlight_first">{t('display.sort_highlight')}</option>
                      <option value="price_asc">{t('display.sort_price_asc')}</option>
                      <option value="price_desc">{t('display.sort_price_desc')}</option>
                      <option value="name_asc">{t('display.sort_name')}</option>
                    </select>
                  </div>

                  {/* Toggles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedZone.show_images}
                        onChange={(e) => updateZoneField(selectedZone.id, 'show_images', e.target.checked)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>{t('display.toggle_show_images')}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedZone.show_descriptions}
                        onChange={(e) => updateZoneField(selectedZone.id, 'show_descriptions', e.target.checked)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>{t('display.toggle_show_descriptions')}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedZone.show_prices}
                        onChange={(e) => updateZoneField(selectedZone.id, 'show_prices', e.target.checked)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>{t('display.toggle_show_prices')}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedZone.show_badges}
                        onChange={(e) => updateZoneField(selectedZone.id, 'show_badges', e.target.checked)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>{t('display.toggle_show_badges')}</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 10px' }}>
                  {t('display.click_zone_to_edit')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

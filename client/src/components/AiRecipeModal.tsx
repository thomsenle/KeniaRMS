import React, { useState, useEffect } from 'react';
import { InventoryItem, AiGeneratedDish, AppSettings } from '../types';
import { apiRequest } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  Sparkles, 
  MapPin, 
  Check, 
  Loader2, 
  X, 
  TrendingUp, 
  UtensilsCrossed, 
  Wine, 
  Star, 
  Tv, 
  PackagePlus,
  Link as LinkIcon,
  Store,
  Navigation
} from 'lucide-react';

interface AiRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onRecipeImported: (result: { name: string; newlyCreatedCount: number }) => void;
}

export const AiRecipeModal: React.FC<AiRecipeModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onRecipeImported
}) => {
  const { t } = useTranslation();

  // Settings & Location
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  
  // Generation Input State
  const [prompt, setPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('food');
  const [selectedStation, setSelectedStation] = useState<'kitchen' | 'bar'>('kitchen');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Generated Dish & Editable Overrides
  const [generatedDish, setGeneratedDish] = useState<AiGeneratedDish | null>(null);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customDishName, setCustomDishName] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [displayOnBoard, setDisplayOnBoard] = useState<number>(1);
  const [displayHighlight, setDisplayHighlight] = useState<number>(0);

  // Import State
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Load current location & settings when opening
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await apiRequest<{ success: boolean; settings: AppSettings }>('/settings');
      if (res.success && res.settings) {
        setAppSettings(res.settings);
      }
    } catch (err) {
      console.warn('Could not load app settings for AI modal:', err);
    }
  };

  if (!isOpen) return null;

  const quickPresets = [
    { label: '🐟 Swahili Coconut Fish Curry', prompt: 'Diani Swahili Coconut Fish Curry with Red Snapper, coconut cream, tamarind and basmati rice', cat: 'food', station: 'kitchen' as const },
    { label: '🦐 Grilled Jumbo Tiger Prawns', prompt: 'Grilled Jumbo Tiger Prawns with garlic-lime herb butter and chapati', cat: 'food', station: 'kitchen' as const },
    { label: '🦞 Fresh Ocean Lobster (500g)', prompt: 'Whole Fresh Lobster grilled over charcoal with peri-peri butter and fries', cat: 'food', station: 'kitchen' as const },
    { label: '🥩 Nyama Choma Goat Ribs', prompt: 'Kenia Prime Nyama Choma goat ribs slow roasted with ugali and kachumbari', cat: 'food', station: 'kitchen' as const },
    { label: '🍗 Swahili Chicken Biryani', prompt: 'Traditional Swahili Chicken Biryani with spiced saffron rice and cucumber raita', cat: 'food', station: 'kitchen' as const },
    { label: '🍹 Diani Passion Dawa Cocktail', prompt: 'Diani Beach Sunset Passion Dawa Cocktail with Kenyan cane spirit, raw honey, lime and fresh passion fruit', cat: 'cocktails', station: 'bar' as const }
  ];

  const handleSelectPreset = (p: typeof quickPresets[0]) => {
    setPrompt(p.prompt);
    setSelectedCategory(p.cat);
    setSelectedStation(p.station);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setGenerateError(null);
    setGeneratedDish(null);

    try {
      const res = await apiRequest<{ success: boolean; dish: AiGeneratedDish }>('/recipes/ai-generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.trim(),
          category: selectedCategory,
          station: selectedStation,
          location: appSettings?.pricing_location || 'Diani Beach',
          target_margin: appSettings?.pricing_target_margin || 70
        })
      });

      if (res.success && res.dish) {
        setGeneratedDish(res.dish);
        setCustomPrice(res.dish.suggested_price);
        setCustomDishName(res.dish.name);
        setCustomDescription(res.dish.description);
        setDisplayOnBoard(res.dish.display_on_board);
        setDisplayHighlight(res.dish.display_highlight);
      } else {
        setGenerateError('Error generating recipe data');
      }
    } catch (err: any) {
      setGenerateError(err.message || 'AI Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async () => {
    if (!generatedDish) return;
    setImporting(true);
    setImportError(null);

    try {
      const payload = {
        name: customDishName || generatedDish.name,
        category: generatedDish.category,
        price: customPrice || generatedDish.suggested_price,
        tax_rate: generatedDish.tax_rate,
        catering_levy: generatedDish.catering_levy,
        description: customDescription || generatedDish.description,
        station: generatedDish.station,
        display_on_board: displayOnBoard,
        display_highlight: displayHighlight,
        ingredients: generatedDish.ingredients.map(ing => ({
          name: ing.name,
          category: ing.category,
          quantity: ing.quantity,
          unit: ing.unit,
          cost_per_unit: ing.cost_per_unit,
          initial_stock: ing.initial_stock,
          min_stock: ing.min_stock,
          optimal_stock: ing.optimal_stock,
          supplier: ing.supplier
        }))
      };

      const res = await apiRequest<{
        success: boolean;
        id: string;
        recipe_name: string;
        newly_created_ingredients: string[];
      }>('/recipes/ai-import', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        onRecipeImported({
          name: res.recipe_name,
          newlyCreatedCount: res.newly_created_ingredients?.length || 0
        });
        onClose();
      }
    } catch (err: any) {
      setImportError(err.message || 'Error importing recipe');
    } finally {
      setImporting(false);
    }
  };

  // Helper to check if ingredient already exists in inventory
  const isIngredientInInventory = (ingName: string) => {
    const clean = ingName.trim().toLowerCase();
    return inventory.some(item => item.name.trim().toLowerCase() === clean);
  };

  const currentFoodCost = generatedDish?.market_benchmark?.food_cost_kes || 0;
  const currentMargin = customPrice > 0 
    ? Math.round(((customPrice - currentFoodCost) / customPrice) * 1000) / 10 
    : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '860px',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(168, 85, 247, 0.15)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={20} />
              </div>
              <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 800 }}>
                {t('recipes.ai_modal_title')}
              </h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
              {t('recipes.ai_modal_subtitle')}
            </p>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Benchmark Location Badge */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} color="var(--primary)" />
              <span style={{ fontSize: '0.88rem' }}>
                {t('recipes.ai_benchmark_location_badge')} <strong>{appSettings?.pricing_location || 'Diani Beach, Kenya'}</strong>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginLeft: '6px' }}>
                  ({appSettings?.pricing_radius_km || 15} km Umkreis • Zielmarge: {appSettings?.pricing_target_margin || 70}%)
                </span>
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              {t('recipes.ai_change_location_hint')}
            </span>
          </div>

          {/* Quick Presets */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
              {t('recipes.ai_presets_title')}
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {quickPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: prompt === preset.prompt ? 'var(--primary)' : undefined,
                    color: prompt === preset.prompt ? '#fff' : undefined
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form onSubmit={handleGenerate}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('recipes.ai_prompt_label')}
              </label>
              <textarea
                rows={2}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={t('recipes.ai_prompt_placeholder')}
                required
                style={{ width: '100%', resize: 'vertical', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {t('recipes.ai_category_label')}
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="food">{t('recipes.cat_food')}</option>
                  <option value="drinks">{t('recipes.cat_drinks')}</option>
                  <option value="cocktails">{t('recipes.cat_cocktails')}</option>
                  <option value="dessert">{t('recipes.cat_dessert')}</option>
                  <option value="special">{t('recipes.cat_special')}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {t('recipes.ai_station_label')}
                </label>
                <select
                  value={selectedStation}
                  onChange={e => setSelectedStation(e.target.value as any)}
                >
                  <option value="kitchen">{t('recipes.kitchen')}</option>
                  <option value="bar">{t('recipes.bar')}</option>
                </select>
              </div>
            </div>

            {generateError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                fontSize: '0.85rem'
              }}>
                {generateError}
              </div>
            )}

            <button
              type="submit"
              disabled={generating || !prompt.trim()}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.35)',
                width: '100%',
                padding: '12px 20px',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {generating ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
              {generating ? t('recipes.ai_generating') : t('recipes.ai_generate_btn')}
            </button>
          </form>

          {/* GENERATED RECIPE & MARKET BENCHMARK SECTION */}
          {generatedDish && (
            <div style={{
              marginTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              {/* Dish Header & Editable Fields */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {t('recipes.name_label')}
                    </label>
                    <input
                      type="text"
                      value={customDishName}
                      onChange={e => setCustomDishName(e.target.value)}
                      style={{ fontWeight: 800, fontSize: '1.15rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className="badge badge-info" style={{ textTransform: 'uppercase' }}>
                      {generatedDish.category}
                    </span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      {generatedDish.station === 'bar' ? <Wine size={12} /> : <UtensilsCrossed size={12} />} {generatedDish.station}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('recipes.desc_label')}
                  </label>
                  <textarea
                    rows={2}
                    value={customDescription}
                    onChange={e => setCustomDescription(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                {/* TV & Highlight Toggles */}
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={displayOnBoard === 1}
                      onChange={e => setDisplayOnBoard(e.target.checked ? 1 : 0)}
                    />
                    <Tv size={15} color="var(--primary)" /> {t('recipes.show_on_tv')}
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={displayHighlight === 1}
                      onChange={e => setDisplayHighlight(e.target.checked ? 1 : 0)}
                    />
                    <Star size={15} color="#fbbf24" /> {t('recipes.day_highlight')}
                  </label>
                </div>
              </div>

              {/* MARKET BENCHMARK CARD */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <TrendingUp size={20} color="#34d399" />
                  <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>
                    {t('recipes.ai_market_benchmark_title')} ({generatedDish.market_benchmark.location})
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('recipes.ai_competitor_min')}</span>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#93c5fd' }}>
                      KES {generatedDish.market_benchmark.min_price.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('recipes.ai_competitor_avg')}</span>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#34d399' }}>
                      KES {generatedDish.market_benchmark.avg_price.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('recipes.ai_competitor_max')}</span>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fbbf24' }}>
                      KES {generatedDish.market_benchmark.max_price.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('recipes.ai_food_cost_kes')}</span>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary)' }}>
                      KES {currentFoodCost.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('recipes.ai_gross_margin')}</span>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#a7f3d0' }}>
                      {currentMargin}%
                    </div>
                  </div>
                </div>

                {/* Price Setting Box */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-surface-elevated)',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                      {t('recipes.ai_suggested_price')}
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>KES</span>
                    <input
                      type="number"
                      step="50"
                      value={customPrice}
                      onChange={e => setCustomPrice(Number(e.target.value) || 0)}
                      style={{ width: '130px', fontWeight: 800, fontSize: '1.1rem', textAlign: 'right' }}
                    />
                  </div>
                </div>

                {/* 5 RESEARCHED COMPETITORS TABLE */}
                {generatedDish.market_benchmark.competitors && generatedDish.market_benchmark.competitors.length > 0 && (
                  <div style={{
                    marginTop: '16px',
                    background: 'var(--bg-surface)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Store size={18} color="#38bdf8" />
                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>
                          {t('recipes.ai_competitors_title')}
                        </h4>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {t('recipes.ai_competitors_subtitle')}
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{
                            color: 'var(--text-muted)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                            textAlign: 'left',
                            fontSize: '0.74rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}>
                            <th style={{ padding: '10px 14px' }}>{t('recipes.col_competitor_venue')}</th>
                            <th style={{ padding: '10px 14px' }}>{t('recipes.col_competitor_distance')}</th>
                            <th style={{ padding: '10px 14px' }}>{t('recipes.col_competitor_dish')}</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('recipes.col_competitor_price')}</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>{t('recipes.col_competitor_diff')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedDish.market_benchmark.competitors.slice(0, 5).map((comp, cIdx) => {
                            const diff = comp.price_kes - (customPrice || generatedDish.suggested_price);
                            const pct = (customPrice || generatedDish.suggested_price) > 0 
                              ? Math.round((Math.abs(diff) / (customPrice || generatedDish.suggested_price)) * 100) 
                              : 0;

                            return (
                              <tr 
                                key={cIdx} 
                                style={{
                                  borderBottom: cIdx < 4 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                                  transition: 'background 0.15s ease'
                                }}
                              >
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                                    {comp.name}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <span>{comp.venue_type}</span>
                                    <span>•</span>
                                    <span>{comp.location}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-muted)',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                  }}>
                                    <Navigation size={12} color="#38bdf8" />
                                    {comp.distance_km ? `${comp.distance_km} km` : '~ 1.5 km'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                                    "{comp.dish_name}"
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '0.92rem', color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                                  KES {comp.price_kes.toLocaleString()}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {diff > 0 ? (
                                    <span style={{
                                      display: 'inline-block',
                                      background: 'rgba(245, 158, 11, 0.15)',
                                      color: '#fbbf24',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      borderRadius: '4px',
                                      padding: '2px 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700
                                    }}>
                                      +KES {diff.toLocaleString()} (+{pct}% {t('recipes.price_diff_higher')})
                                    </span>
                                  ) : diff < 0 ? (
                                    <span style={{
                                      display: 'inline-block',
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.3)',
                                      borderRadius: '4px',
                                      padding: '2px 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700
                                    }}>
                                      -KES {Math.abs(diff).toLocaleString()} (-{pct}% {t('recipes.price_diff_lower')})
                                    </span>
                                  ) : (
                                    <span style={{
                                      display: 'inline-block',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#34d399',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      borderRadius: '4px',
                                      padding: '2px 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700
                                    }}>
                                      ±0 ({t('recipes.price_diff_same')})
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
                  <strong>{t('recipes.ai_rationale_title')}</strong> {generatedDish.market_benchmark.rationale}
                </div>
              </div>

              {/* INGREDIENTS LIST & INVENTORY STATUS */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PackagePlus size={18} color="var(--primary)" /> {t('recipes.ai_ingredients_to_create')}
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>
                    {t('recipes.ai_missing_ingredients_auto_create')}
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: '0.78rem' }}>
                        <th style={{ padding: '8px' }}>{t('recipes.col_ingredient')}</th>
                        <th style={{ padding: '8px' }}>{t('recipes.col_portion_quantity')}</th>
                        <th style={{ padding: '8px' }}>{t('recipes.col_portion_cost')} (KES)</th>
                        <th style={{ padding: '8px' }}>{t('recipes.col_inventory_status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedDish.ingredients.map((ing, idx) => {
                        const exists = isIngredientInInventory(ing.name);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{ing.name}</td>
                            <td style={{ padding: '8px' }}>{ing.quantity} {ing.unit}</td>
                            <td style={{ padding: '8px' }}>KES {ing.portion_cost_kes.toLocaleString()}</td>
                            <td style={{ padding: '8px' }}>
                              {exists ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: '#93c5fd',
                                  fontWeight: 600
                                }}>
                                  <LinkIcon size={12} /> {t('recipes.ai_existing_in_inventory')}
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#34d399',
                                  fontWeight: 600
                                }}>
                                  <PackagePlus size={12} /> {t('recipes.ai_new_in_inventory')}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {importError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem'
                }}>
                  {importError}
                </div>
              )}

              {/* Final Import Action Button */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  disabled={importing}
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="btn btn-success"
                  style={{
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {importing ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
                  {importing ? t('recipes.ai_importing') : t('recipes.ai_import_btn')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

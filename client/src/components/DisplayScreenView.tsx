import React, { useState, useEffect } from 'react';
import { DisplayScreen, DisplayZone, Recipe } from '../types';
import { formatKES } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  Wine, 
  UtensilsCrossed, 
  Beer, 
  Coffee, 
  Star, 
  Sparkles, 
  ArrowLeft, 
  ArrowRight, 
  Trash2, 
  Sliders, 
  Flame,
  AlertCircle
} from 'lucide-react';

interface DisplayScreenViewProps {
  screen: DisplayScreen;
  allItems?: Recipe[];
  isInteractive?: boolean;
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  onMoveZone?: (zoneIndex: number, direction: 'left' | 'right') => void;
  onDeleteZone?: (zoneId: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenEditor?: () => void;
  canEdit?: boolean;
}

export const DisplayScreenView: React.FC<DisplayScreenViewProps> = ({
  screen,
  allItems = [],
  isInteractive = false,
  selectedZoneId,
  onSelectZone,
  onMoveZone,
  onDeleteZone,
  isFullscreen,
  onToggleFullscreen,
  onOpenEditor,
  canEdit
}) => {
  const { t } = useTranslation();
  const [heroSlideIndices, setHeroSlideIndices] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotating slide interval for hero sliders
  useEffect(() => {
    const heroZones = (screen.zones || []).filter(z => z.style === 'hero_slider');
    if (heroZones.length === 0) return;

    const interval = setInterval(() => {
      setHeroSlideIndices(prev => {
        const next = { ...prev };
        heroZones.forEach(z => {
          const itemsCount = resolveItemsForZone(z, allItems).length;
          if (itemsCount > 1) {
            const current = next[z.id] || 0;
            next[z.id] = (current + 1) % itemsCount;
          }
        });
        return next;
      });
    }, 5500);

    return () => clearInterval(interval);
  }, [screen.zones, allItems]);

  // Helper to filter and sort items for a zone
  const resolveItemsForZone = (zone: DisplayZone, list: Recipe[]): Recipe[] => {
    // If zone already has resolved items from server
    if (zone.items && zone.items.length > 0) {
      return zone.items;
    }

    let filtered = [...list];

    // Availability / in stock filter
    filtered = filtered.filter(it => it.is_available !== false);

    // Category filter
    if (zone.categories && zone.categories.length > 0) {
      filtered = filtered.filter(it => zone.categories.includes(it.category));
    }

    // Station filter
    if (zone.station && zone.station !== 'all') {
      filtered = filtered.filter(it => it.station === zone.station);
    }

    // Sort
    if (zone.sort_by === 'price_asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (zone.sort_by === 'price_desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (zone.sort_by === 'name_asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // highlight_first
      filtered.sort((a, b) => (b.display_highlight || 0) - (a.display_highlight || 0));
    }

    const limit = zone.max_items > 0 ? zone.max_items : 12;
    return filtered.slice(0, limit);
  };

  const getZoneIcon = (iconName?: string) => {
    switch (iconName) {
      case 'cocktail':
        return <Wine size={22} color="var(--display-accent)" />;
      case 'beer':
        return <Beer size={22} color="var(--display-accent)" />;
      case 'food':
        return <UtensilsCrossed size={22} color="var(--display-accent)" />;
      case 'coffee':
        return <Coffee size={22} color="var(--display-accent)" />;
      case 'star':
        return <Star size={22} fill="var(--display-accent)" color="var(--display-accent)" />;
      case 'flame':
        return <Flame size={22} color="var(--display-accent)" />;
      default:
        return <Sparkles size={22} color="var(--display-accent)" />;
    }
  };

  // Layout Grid Configuration
  const getLayoutGridStyle = () => {
    switch (screen.layout_type) {
      case '1_column':
        return { display: 'grid', gridTemplateColumns: '1fr', gap: '24px' };
      case '2_columns':
        return { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' };
      case '4_columns':
        return { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' };
      case 'hero_split':
        return { display: 'grid', gridTemplateColumns: '38% 1fr', gap: '24px' };
      case '3_columns':
      default:
        return { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '22px' };
    }
  };

  const themeClass = `display-theme-${screen.theme || 'midnight'}`;
  const fontClass = `display-font-${screen.font_size || 'large'}`;

  return (
    <div 
      className={`${themeClass} ${fontClass}`}
      style={{
        width: '100%',
        minHeight: isInteractive ? '100%' : '100vh',
        background: 'var(--display-bg)',
        color: 'var(--display-text)',
        padding: isInteractive ? '16px 20px' : '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}
    >
      {/* SCREEN TOP HEADER */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '14px',
        flexShrink: 0
      }}>
        {/* Brand & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: isInteractive ? '38px' : '48px',
            height: isInteractive ? '38px' : '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--display-accent) 0%, rgba(217, 119, 6, 0.8) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#090b10',
            fontWeight: 900,
            fontSize: isInteractive ? '1.3rem' : '1.7rem',
            boxShadow: '0 4px 14px var(--display-accent-glow)'
          }}>
            K
          </div>
          <div>
            <h1 style={{ 
              fontSize: 'var(--display-header-size)', 
              fontWeight: 900, 
              letterSpacing: '-0.02em', 
              lineHeight: 1.1,
              textTransform: 'uppercase',
              color: 'var(--display-text)',
              margin: 0
            }}>
              {screen.title || 'SAVANNAH BAR & RESTAURANT'}
            </h1>
            <div style={{ 
              fontSize: '0.85rem', 
              color: 'var(--display-accent)', 
              letterSpacing: '0.08em', 
              textTransform: 'uppercase', 
              fontWeight: 700,
              marginTop: '2px'
            }}>
              {screen.subtitle || t('display.header_sub')}
            </div>
          </div>
        </div>

        {/* Right Header: Clock & TV Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              fontSize: isInteractive ? '1.1rem' : '1.45rem', 
              fontWeight: 800, 
              fontFamily: 'monospace', 
              color: 'var(--display-text)' 
            }}>
              {currentTime.toLocaleTimeString('en-GB')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--display-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} • KES (16% VAT Incl.)
            </div>
          </div>

          {!isInteractive && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {canEdit && onOpenEditor && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onOpenEditor}
                  title={t('display.edit_wysiwyg')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderColor: 'rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <Sliders size={16} />
                  <span>{t('display.edit_wysiwyg')}</span>
                </button>
              )}

              {onToggleFullscreen && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onToggleFullscreen}
                  title={t('display.view_tv')}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderColor: 'rgba(255, 255, 255, 0.15)'
                  }}
                >
                  {isFullscreen ? <Star size={16} /> : <Star size={16} />}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ZONES CONTAINER */}
      <div style={{ 
        ...getLayoutGridStyle(), 
        flex: 1, 
        alignItems: 'start',
        marginBottom: screen.ticker_enabled ? '48px' : '16px' 
      }}>
        {screen.layout_type === 'hero_split' ? (
          // HERO SPLIT LAYOUT: Zone 0 is Hero Banner, Zones 1+ are right columns
          <>
            {/* Left Hero Column */}
            {screen.zones.length > 0 && renderZoneCard(screen.zones[0], 0, true)}

            {/* Right Sub-Columns */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: screen.zones.length > 2 ? 'repeat(2, 1fr)' : '1fr', 
              gap: '20px' 
            }}>
              {screen.zones.slice(1).map((z, idx) => renderZoneCard(z, idx + 1, false))}
            </div>
          </>
        ) : (
          // STANDARD MULTI-COLUMN LAYOUT
          screen.zones.map((zone, idx) => renderZoneCard(zone, idx, false))
        )}
      </div>

      {/* TICKER MARQUEE BANNER AT BOTTOM */}
      {Boolean(screen.ticker_enabled) && (
        <div style={{
          position: isInteractive ? 'absolute' : 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '42px',
          background: 'rgba(9, 11, 16, 0.94)',
          borderTop: '2px solid var(--display-card-border)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          zIndex: 30,
          padding: '0 16px'
        }}>
          {/* Ticker Badge */}
          <div style={{
            background: 'var(--display-accent)',
            color: '#090b10',
            fontWeight: 900,
            fontSize: '0.75rem',
            padding: '3px 10px',
            borderRadius: '4px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginRight: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            flexShrink: 0,
            boxShadow: '0 2px 8px var(--display-accent-glow)'
          }}>
            <Sparkles size={12} />
            INFO
          </div>

          {/* Marquee Track */}
          <div style={{ overflow: 'hidden', width: '100%', position: 'relative' }}>
            <div className={`ticker-marquee-track ticker-speed-${screen.ticker_speed || 'normal'}`}>
              <span style={{ 
                fontSize: '0.92rem', 
                fontWeight: 600, 
                color: 'var(--display-text)', 
                letterSpacing: '0.03em' 
              }}>
                {screen.ticker_text || 'Karibu Savannah Lounge • Authentic Kenyan Hospitality • All prices include 16% VAT & 2% Catering Levy'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper to render individual Zone
  function renderZoneCard(zone: DisplayZone, zoneIndex: number, isHeroSlot: boolean) {
    const isSelected = isInteractive && selectedZoneId === zone.id;
    const items = resolveItemsForZone(zone, allItems);
    const heroIndex = heroSlideIndices[zone.id] || 0;
    const currentHeroItem = items[heroIndex] || items[0];

    return (
      <div
        key={zone.id || zoneIndex}
        className={`wysiwyg-zone-box ${isInteractive ? 'interactive-mode' : ''} ${isSelected ? 'selected-zone' : ''}`}
        onClick={() => {
          if (isInteractive && onSelectZone) {
            onSelectZone(zone.id);
          }
        }}
        style={{
          background: 'var(--display-card-bg)',
          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--display-card-border)'}`,
          borderRadius: '16px',
          padding: isHeroSlot || zone.style === 'hero_slider' ? '0' : '18px 20px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* INTERACTIVE CONTROLS BAR (ONLY IN WYSIWYG MODE) */}
        {isInteractive && (
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              gap: '4px',
              zIndex: 20,
              background: 'rgba(10, 12, 16, 0.85)',
              padding: '4px 6px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)'
            }}
          >
            {zoneIndex > 0 && onMoveZone && (
              <button
                type="button"
                onClick={() => onMoveZone(zoneIndex, 'left')}
                title={t('display.move_left')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex'
                }}
              >
                <ArrowLeft size={14} />
              </button>
            )}

            {zoneIndex < screen.zones.length - 1 && onMoveZone && (
              <button
                type="button"
                onClick={() => onMoveZone(zoneIndex, 'right')}
                title={t('display.move_right')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex'
                }}
              >
                <ArrowRight size={14} />
              </button>
            )}

            {onDeleteZone && (
              <button
                type="button"
                onClick={() => onDeleteZone(zone.id)}
                title={t('display.delete_zone_btn')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-ruby)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex'
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {/* ZONE CONTENT RENDERING ACCORDING TO STYLE */}
        {zone.style === 'hero_slider' ? (
          // STYLE: HERO SLIDER
          renderHeroSlider(zone, currentHeroItem, items, heroIndex)
        ) : (
          // STYLES: CLASSIC BAR LIST, CARDS, COMPACT SPLIT
          <>
            {/* Zone Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getZoneIcon(zone.icon)}
                <h2 style={{
                  fontSize: 'var(--display-zone-title-size)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--display-text)',
                  margin: 0
                }}>
                  {zone.title}
                </h2>
              </div>

              {isInteractive && isSelected && (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'var(--primary)',
                  color: '#090b10'
                }}>
                  {t('display.active_zone_badge')}
                </span>
              )}
            </div>

            {/* Zone Body Items */}
            {items.length === 0 ? (
              <div style={{ 
                padding: '30px 10px', 
                textAlign: 'center', 
                color: 'var(--display-muted)',
                fontSize: '0.9rem' 
              }}>
                <AlertCircle size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
                <div>{t('display.no_items_in_zone')}</div>
              </div>
            ) : zone.style === 'cards' ? (
              // CARDS GRID STYLE
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      background: 'rgba(0, 0, 0, 0.35)',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    {zone.show_images && (
                      <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: '#161b22',
                        flexShrink: 0
                      }}>
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.station === 'bar' ? <Wine size={20} color="var(--display-accent)" /> : <UtensilsCrossed size={20} color="var(--display-accent)" />}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: 700, 
                        fontSize: 'var(--display-item-name-size)', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                      }}>
                        {item.name}
                      </div>

                      {zone.show_descriptions && item.description && (
                        <div style={{ 
                          fontSize: 'var(--display-item-desc-size)', 
                          color: 'var(--display-muted)',
                          lineClamp: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {item.description}
                        </div>
                      )}
                    </div>

                    {zone.show_prices && (
                      <div style={{
                        fontSize: 'var(--display-price-size)',
                        fontWeight: 900,
                        color: 'var(--display-accent)',
                        whiteSpace: 'nowrap'
                      }}>
                        {formatKES(item.price)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : zone.style === 'compact_split' ? (
              // COMPACT DUAL COLUMN
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                {items.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div className="bar-price-line">
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: '0.98rem', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                      }}>
                        {item.name}
                      </span>
                      <div className="bar-price-dots" />
                      <span style={{ 
                        fontWeight: 900, 
                        fontSize: '1.05rem', 
                        color: 'var(--display-accent)' 
                      }}>
                        {formatKES(item.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // CLASSIC BAR BOARD PRICE LIST (MAX READABILITY)
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {items.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div className="bar-price-line">
                      {/* Name & Badges */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        minWidth: 0, 
                        maxWidth: '70%' 
                      }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 'var(--display-item-name-size)',
                          color: 'var(--display-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.name}
                        </span>

                        {zone.show_badges && item.display_highlight === 1 && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: 'var(--display-accent)',
                            flexShrink: 0
                          }}>
                            TOP
                          </span>
                        )}
                      </div>

                      {/* Dotted Leader Line */}
                      <div className="bar-price-dots" />

                      {/* Prominent Price */}
                      {zone.show_prices && (
                        <div style={{
                          fontWeight: 900,
                          fontSize: 'var(--display-price-size)',
                          color: 'var(--display-accent)',
                          letterSpacing: '-0.02em',
                          flexShrink: 0
                        }}>
                          {formatKES(item.price)}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {zone.show_descriptions && item.description && (
                      <div style={{
                        fontSize: 'var(--display-item-desc-size)',
                        color: 'var(--display-muted)',
                        paddingLeft: '2px',
                        lineClamp: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Helper to render Rotating Hero Slider Card
  function renderHeroSlider(
    zone: DisplayZone, 
    item: Recipe | undefined, 
    items: Recipe[], 
    slideIndex: number
  ) {
    if (!item) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--display-muted)' }}>
          {t('display.no_items_in_zone')}
        </div>
      );
    }

    return (
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '280px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '24px',
        overflow: 'hidden'
      }}>
        {/* Background Image with Ambient Glow */}
        {item.image_url && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${item.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.45,
            filter: 'blur(1px)',
            transform: 'scale(1.04)',
            transition: 'all 0.8s ease'
          }} />
        )}

        {/* Gradient Overlay for Legibility */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(8, 10, 15, 0.95) 20%, rgba(8, 10, 15, 0.5) 70%, rgba(8, 10, 15, 0.2) 100%)'
        }} />

        {/* Hero Content */}
        <div style={{ position: 'relative', zIndex: 5 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(245, 158, 11, 0.25)',
            border: '1px solid rgba(245, 158, 11, 0.6)',
            padding: '4px 12px',
            borderRadius: '20px',
            color: 'var(--display-accent)',
            fontSize: '0.8rem',
            fontWeight: 800,
            marginBottom: '10px'
          }}>
            <Star size={13} fill="var(--display-accent)" />
            {zone.title || t('display.chefs_highlight')}
          </div>

          <h3 style={{
            fontSize: '1.9rem',
            fontWeight: 900,
            lineHeight: 1.15,
            marginBottom: '8px',
            color: '#ffffff'
          }}>
            {item.name}
          </h3>

          {item.description && (
            <p style={{
              fontSize: '0.95rem',
              color: 'var(--display-muted)',
              marginBottom: '16px',
              lineClamp: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {item.description}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{
              fontSize: '2.2rem',
              fontWeight: 900,
              color: 'var(--display-accent)',
              lineHeight: 1
            }}>
              {formatKES(item.price)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--display-muted)' }}>
              {t('display.vat_levy_included')}
            </span>
          </div>

          {/* Dots Indicator */}
          {items.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
              {items.map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  style={{
                    width: dotIdx === slideIndex ? '24px' : '7px',
                    height: '6px',
                    borderRadius: '4px',
                    background: dotIdx === slideIndex ? 'var(--display-accent)' : 'rgba(255, 255, 255, 0.25)',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
};

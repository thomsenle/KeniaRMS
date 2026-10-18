import React, { useState, useEffect } from 'react';
import { apiRequest, formatKES, socket } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  Tv, 
  Maximize, 
  Minimize, 
  Wine, 
  UtensilsCrossed, 
  Star
} from 'lucide-react';

export const DisplayPage: React.FC = () => {
  const { t } = useTranslation();
  const [boardData, setBoardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    loadBoardData();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    socket.on('recipes:updated', loadBoardData);
    socket.on('inventory:updated_all', loadBoardData);

    return () => {
      clearInterval(timer);
      socket.off('recipes:updated');
      socket.off('inventory:updated_all');
    };
  }, []);

  useEffect(() => {
    if (!boardData?.specials || boardData.specials.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % boardData.specials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [boardData]);

  const loadBoardData = async () => {
    try {
      const res = await apiRequest<{ success: boolean } & any>('/display/menu-board');
      setBoardData(res);
    } catch (err: any) {
      console.error('Failed to load menu board:', err);
    } finally {
      setLoading(false);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-muted)' }}>
        <Tv size={48} style={{ animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  const specials = boardData?.specials || [];
  const currentSpecial = specials[currentSlideIndex] || specials[0];
  const categories = boardData?.categories || {};

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'radial-gradient(ellipse at top, #1a1e28 0%, #0a0c10 100%)', 
      color: '#fff', 
      padding: '24px',
      margin: '-20px',
      overflowX: 'hidden'
    }}>
      {/* Top Banner / TV Screen Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0d1117',
            fontWeight: 900,
            fontSize: '1.6rem'
          }}>
            K
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {boardData?.restaurantName || 'The Savannah Bistro & Lounge'}
            </h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              {t('display.header_sub')} • {boardData?.location || 'Nairobi, Kenya'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace', color: '#f3f4f6' }}>
              {currentTime.toLocaleTimeString('en-GB')}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleFullscreen}
            style={{ padding: '8px 12px' }}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      {/* HERO SECTION: ROTATING CHEF'S SPECIAL */}
      {currentSpecial && (
        <div 
          className="glass-panel-elevated"
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: '32px',
            minHeight: '280px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${currentSpecial.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.35,
            filter: 'blur(2px)'
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(10, 12, 16, 0.95) 40%, rgba(10, 12, 16, 0.6) 100%)'
          }} />

          {/* Slide Content */}
          <div style={{ position: 'relative', zIndex: 2, padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '30px' }}>
            <div style={{ maxWidth: '650px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.5)', padding: '4px 12px', borderRadius: 'var(--radius-full)', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
                <Star size={14} fill="#fbbf24" /> {t('display.chefs_highlight')}
              </div>

              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '10px', color: '#fff' }}>
                {currentSpecial.name}
              </h2>

              <p style={{ fontSize: '1.05rem', color: '#d1d5db', lineHeight: 1.5, marginBottom: '20px' }}>
                {currentSpecial.description || t('display.fresh_served')}
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--primary)' }}>
                  {formatKES(currentSpecial.price)}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {t('display.vat_levy_included')}
                </span>
              </div>
            </div>

            {/* Dish Photo Card */}
            {currentSpecial.image_url && (
              <div style={{
                width: '320px',
                height: '210px',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                border: '2px solid rgba(255,255,255,0.15)',
                flexShrink: 0
              }}>
                <img
                  src={currentSpecial.image_url}
                  alt={currentSpecial.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
          </div>

          {/* Dots Indicator */}
          {specials.length > 1 && (
            <div style={{ position: 'absolute', bottom: '12px', left: '40px', display: 'flex', gap: '8px', zIndex: 3 }}>
              {specials.map((_: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  style={{
                    width: idx === currentSlideIndex ? '28px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background: idx === currentSlideIndex ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORY GRIDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {Object.entries(categories).map(([categoryName, catItems]: [string, any]) => (
          <div key={categoryName}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
              {categoryName === 'drinks' || categoryName === 'cocktails' ? (
                <Wine size={24} color="var(--primary)" />
              ) : (
                <UtensilsCrossed size={24} color="var(--primary)" />
              )}
              <h2 style={{ fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {categoryName}
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '18px'
            }}>
              {catItems.map((item: any) => (
                <div
                  key={item.id}
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'center',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(22, 27, 34, 0.6)'
                  }}
                >
                  <div style={{
                    width: '76px',
                    height: '76px',
                    borderRadius: '12px',
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
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                        {item.station === 'bar' ? <Wine size={28} /> : <UtensilsCrossed size={28} />}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', lineClamp: 1, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.description || t('display.fresh_served')}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--primary)' }}>
                      {formatKES(item.price)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Table, Order, OrderItem, Recipe, Waiter, WaiterShift, RestaurantArea } from '../types';
import { apiRequest, formatKES, socket } from '../api/client';
import { useTranslation } from '../i18n';
import { SplitBillModal } from '../components/SplitBillModal';
import { TableManagerModal } from '../components/TableManagerModal';
import { 
  Users, 
  Send, 
  Receipt, 
  ArrowRightLeft, 
  Plus, 
  Minus,
  Trash2, 
  Search, 
  CheckCircle2, 
  Clock, 
  UtensilsCrossed, 
  Wine,
  ChevronLeft,
  ShoppingBag,
  SlidersHorizontal
} from 'lucide-react';

interface POSPageProps {
  activeWaiter: Waiter | null;
  activeShift: WaiterShift | null;
  onOpenLogin: () => void;
}

export const POSPage: React.FC<POSPageProps> = ({ activeWaiter, activeShift, onOpenLogin }) => {
  const { t } = useTranslation();
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Mobile subview toggle when a table is open: 'menu' vs 'cart'
  const [mobileView, setMobileView] = useState<'menu' | 'cart'>('menu');

  // Modals
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTableManagerOpen, setIsTableManagerOpen] = useState(false);
  const [areaList, setAreaList] = useState<string[]>(['All']);
  const [targetTransferTableId, setTargetTransferTableId] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  useEffect(() => {
    loadTables();
    loadAreas();
    loadRecipes();

    // Socket events
    socket.on('tables:updated', () => {
      loadTables();
      loadAreas();
    });
    socket.on('areas:updated', loadAreas);
    socket.on('order:cart_updated', (data: { orderId: string }) => {
      if (activeOrder && activeOrder.id === data.orderId) {
        loadOrderForTable(selectedTable!.id);
      }
    });
    socket.on('order:sent', () => {
      loadTables();
      if (selectedTable) {
        loadOrderForTable(selectedTable.id);
      }
    });

    return () => {
      socket.off('tables:updated');
      socket.off('areas:updated');
      socket.off('order:cart_updated');
      socket.off('order:sent');
    };
  }, [selectedTable, activeOrder]);

  const loadAreas = async () => {
    try {
      const res = await apiRequest<{ success: boolean; areas: RestaurantArea[] }>('/pos/areas');
      if (res.success && res.areas) {
        setAreaList(['All', ...res.areas.map(a => a.name)]);
      }
    } catch (err: any) {
      console.error('Failed to load areas:', err);
    }
  };

  const loadTables = async () => {
    try {
      const res = await apiRequest<{ success: boolean; tables: Table[] }>('/pos/tables');
      setTables(res.tables);
    } catch (err: any) {
      console.error('Failed to load tables:', err);
    }
  };

  const loadRecipes = async () => {
    try {
      const res = await apiRequest<{ success: boolean; recipes: Recipe[] }>('/recipes');
      setRecipes(res.recipes);
    } catch (err: any) {
      console.error('Failed to load recipes:', err);
    }
  };

  const loadOrderForTable = async (tableId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; order: Order | null; items: OrderItem[] }>(`/pos/orders/table/${tableId}`);
      setActiveOrder(res.order);
      setOrderItems(res.items);
    } catch (err: any) {
      console.error('Failed to load order:', err);
    }
  };

  const handleSelectTable = (table: Table) => {
    setSelectedTable(table);
    setMobileView('menu');
    loadOrderForTable(table.id);
  };

  const handleOpenTable = async (guestCount: number = 2) => {
    if (!activeWaiter) {
      onOpenLogin();
      return;
    }
    if (!selectedTable) return;

    setActionLoading(true);
    try {
      await apiRequest(`/pos/tables/${selectedTable.id}/open`, {
        method: 'POST',
        body: JSON.stringify({
          waiter_id: activeWaiter.id,
          shift_id: activeShift?.id,
          guests_count: guestCount
        })
      });
      await loadTables();
      await loadOrderForTable(selectedTable.id);
    } catch (err: any) {
      alert(err.message || 'Error opening table');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddToCart = async (recipe: Recipe) => {
    if (!activeOrder) {
      alert(t('pos.table_is_free'));
      return;
    }

    try {
      await apiRequest(`/pos/orders/${activeOrder.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          recipe_id: recipe.id,
          quantity: 1
        })
      });
      await loadOrderForTable(selectedTable!.id);
    } catch (err: any) {
      alert(err.message || 'Error adding item');
    }
  };

  const handleUpdateItemQty = async (itemId: string, newQty: number) => {
    try {
      await apiRequest(`/pos/orders/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: newQty })
      });
      await loadOrderForTable(selectedTable!.id);
    } catch (err: any) {
      alert(err.message || 'Error updating quantity');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await apiRequest(`/pos/orders/items/${itemId}`, {
        method: 'DELETE'
      });
      await loadOrderForTable(selectedTable!.id);
    } catch (err: any) {
      alert(err.message || 'Error removing item');
    }
  };

  const handleSendToStations = async () => {
    if (!activeOrder) return;
    setActionLoading(true);

    try {
      const res = await apiRequest<{ 
        success: boolean; 
        message: string; 
        sentItemsCount: number;
        kitchenItemsCount: number;
        barItemsCount: number;
        lowStockAlerts: string[];
      }>(`/pos/orders/${activeOrder.id}/send-to-stations`, {
        method: 'POST'
      });

      setNotification({
        message: t('pos.order_sent_success'),
        type: 'success'
      });

      if (res.lowStockAlerts && res.lowStockAlerts.length > 0) {
        setTimeout(() => {
          alert(res.lowStockAlerts.join('\n'));
        }, 500);
      }

      await loadOrderForTable(selectedTable!.id);
      await loadTables();
    } catch (err: any) {
      alert(err.message || 'Error dispatching order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferTable = async () => {
    if (!activeOrder || !targetTransferTableId) return;

    try {
      await apiRequest(`/pos/orders/${activeOrder.id}/transfer-table`, {
        method: 'POST',
        body: JSON.stringify({ targetTableId: targetTransferTableId })
      });
      setIsTransferModalOpen(false);
      setTargetTransferTableId('');
      setSelectedTable(null);
      setActiveOrder(null);
      await loadTables();
    } catch (err: any) {
      alert(err.message || 'Error transferring table');
    }
  };

  // Filter tables
  const areas = areaList.length > 1 ? areaList : ['All', ...Array.from(new Set(tables.map(t => t.area).filter(Boolean)))];
  const filteredTables = tables.filter(t => selectedArea === 'All' || t.area === selectedArea);

  // Filter recipes
  const categories = ['All', 'food', 'drinks', 'cocktails', 'coffee'];
  const filteredRecipes = recipes.filter(r => {
    const matchesCat = selectedCategory === 'All' || r.category === selectedCategory;
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const cartItemsInCart = orderItems.filter(it => it.status === 'in_cart');
  const cartItemsSent = orderItems.filter(it => it.status === 'sent_to_station');
  const cartItemsPaid = orderItems.filter(it => it.status === 'paid');

  // Render Cart Contents (Used both in desktop side panel and in mobile cart subview)
  const renderCartContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table Header in Cart */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {selectedTable?.area} • {t('pos.order_title')}
          </span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selectedTable?.name}</h3>
        </div>
        {activeOrder && (
          <span className={`badge ${cartItemsInCart.length > 0 ? 'badge-warning' : 'badge-success'}`}>
            {cartItemsInCart.length > 0 ? `${cartItemsInCart.length} in cart` : t('common.occupied')}
          </span>
        )}
      </div>

      {!activeOrder ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', padding: '30px 10px' }}>
          <UtensilsCrossed size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '0.95rem' }}>{t('pos.table_is_free')}</p>
          <button className="btn btn-primary" onClick={() => handleOpenTable(2)} style={{ marginTop: '14px', width: '100%', maxWidth: '240px' }}>
            <Plus size={18} /> {t('pos.open_now')}
          </button>
        </div>
      ) : (
        <>
          {/* Scrollable Cart Items */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', paddingRight: '2px' }}>
            {/* SECTION 1: IN CART (NEW) */}
            {cartItemsInCart.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  color: '#fbbf24', 
                  textTransform: 'uppercase', 
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Clock size={13} /> {t('pos.new_in_cart')}
                </div>

                {cartItemsInCart.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px',
                      marginBottom: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{item.recipe_name}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--primary)' }}>
                        {formatKES(item.total_price)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => handleUpdateItemQty(item.id, item.quantity - 1)}
                        >
                          <Minus size={16} />
                        </button>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', minWidth: '24px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => handleUpdateItemQty(item.id, item.quantity + 1)}
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleRemoveItem(item.id)}
                        style={{ padding: '6px', color: '#f87171' }}
                        title={t('common.delete')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SECTION 2: SENT TO KITCHEN / BAR */}
            {cartItemsSent.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  color: '#34d399', 
                  textTransform: 'uppercase', 
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle2 size={13} /> {t('pos.sent_to_station')}
                </div>

                {cartItemsSent.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      marginBottom: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {item.quantity}x {item.recipe_name}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {item.station.toUpperCase()} • {item.sent_to_station_at ? new Date(item.sent_to_station_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatKES(item.total_price)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* SECTION 3: ALREADY PAID */}
            {cartItemsPaid.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {t('pos.already_paid')}
                </div>
                {cartItemsPaid.map(item => (
                  <div
                    key={item.id}
                    style={{
                      opacity: 0.5,
                      padding: '6px 8px',
                      fontSize: '0.82rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      textDecoration: 'line-through'
                    }}
                  >
                    <span>{item.quantity}x {item.recipe_name}</span>
                    <span>{formatKES(item.total_price)}</span>
                  </div>
                ))}
              </div>
            )}

            {orderItems.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 10px' }}>
                <ShoppingBag size={36} style={{ opacity: 0.3, margin: '0 auto 8px auto' }} />
                <p style={{ fontSize: '0.9rem' }}>{t('pos.empty_cart')}</p>
              </div>
            )}
          </div>

          {/* TOTALS & ACTIONS */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
              <span>{t('common.net')}:</span>
              <span>{formatKES(activeOrder.total_net)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
              <span>{t('common.vat')} (16%) + {t('common.levy')} (2%):</span>
              <span>{formatKES(activeOrder.total_tax + activeOrder.total_levy)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '12px' }}>
              <span>{t('common.total')}:</span>
              <span>{formatKES(activeOrder.total_gross)}</span>
            </div>

            {/* SEND TO KITCHEN BUTTON */}
            {cartItemsInCart.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendToStations}
                disabled={actionLoading}
                style={{ width: '100%', marginBottom: '8px', padding: '12px', fontSize: '0.95rem' }}
              >
                <Send size={18} />
                {t('pos.send_to_kitchen_btn')}
              </button>
            )}

            {/* SETTLE BILL BUTTON */}
            <button
              type="button"
              className="btn btn-success"
              onClick={() => setIsSplitModalOpen(true)}
              disabled={orderItems.filter(it => it.status !== 'paid').length === 0}
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
            >
              <Receipt size={18} />
              {t('pos.settle_bill_btn')}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="pos-main-grid" style={{ display: 'grid', gridTemplateColumns: selectedTable ? '1fr 420px' : '1fr', gap: '16px', minHeight: 'calc(100vh - 100px)' }}>
      {/* LEFT COLUMN: Tables Map OR Menu Browser */}
      <div style={{ display: selectedTable && mobileView === 'cart' ? 'none' : 'block' }}>
        {/* Top Area Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div className="category-pill-container" style={{ flex: 1 }}>
            {areas.map(area => (
              <button
                key={area}
                type="button"
                className={`btn ${selectedArea === area ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedArea(area)}
                style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}
              >
                {area === 'All' ? t('pos.all_tables') : area}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!selectedTable && (activeWaiter?.role === 'manager' || activeWaiter?.role === 'admin') && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsTableManagerOpen(true)}
                style={{
                  fontSize: '0.82rem',
                  padding: '6px 12px',
                  borderColor: 'rgba(245, 158, 11, 0.45)',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
                title={t('table_manager.manage_tables_areas')}
              >
                <SlidersHorizontal size={14} />
                <span>{t('table_manager.manage_btn')}</span>
                <span style={{
                  fontSize: '0.62rem',
                  background: 'rgba(245, 158, 11, 0.2)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  fontWeight: 800
                }}>
                  {t('table_manager.manager_badge')}
                </span>
              </button>
            )}

            {selectedTable && (
              <button 
                className="btn btn-secondary" 
                onClick={() => { setSelectedTable(null); setActiveOrder(null); }}
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                <ChevronLeft size={16} /> {t('pos.back_to_tables')}
              </button>
            )}
          </div>
        </div>

        {/* NOTIFICATION BANNER */}
        {notification && (
          <div style={{
            background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${notification.type === 'success' ? '#10b981' : '#f59e0b'}`,
            color: notification.type === 'success' ? '#34d399' : '#fbbf24',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.88rem'
          }}>
            <span>{notification.message}</span>
            <button className="btn btn-ghost" onClick={() => setNotification(null)} style={{ padding: '2px 8px' }}>✕</button>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: TABLE MAP                                       */}
        {/* ======================================================== */}
        {!selectedTable ? (
          <div>
            <div className="table-cards-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px'
            }}>
              {filteredTables.map(table => {
                const isOccupied = table.status === 'occupied';

                return (
                  <div
                    key={table.id}
                    onClick={() => handleSelectTable(table)}
                    className="glass-panel"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      border: isOccupied ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--border-subtle)',
                      background: isOccupied ? 'rgba(245, 158, 11, 0.06)' : 'rgba(18, 21, 28, 0.85)',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{table.area}</span>
                      <span className={`badge ${isOccupied ? 'badge-warning' : 'badge-success'}`}>
                        {isOccupied ? t('common.occupied') : t('common.free')}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '4px' }}>
                      {table.name}
                    </div>

                    {isOccupied ? (
                      <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={13} /> {table.guests_count} {t('pos.guests')} • {table.active_waiter_name || t('pos.waiter')}
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                          {formatKES(table.order_total_gross || 0)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '16px', fontSize: '0.82rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Plus size={14} /> {t('pos.open_table')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: MENU BROWSER (NO FOOD IMAGES, ULTRA-FAST POS)   */
          /* ======================================================== */
          <div>
            {/* Table Header Bar */}
            <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{selectedTable.area}</span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedTable.name}</h2>
              </div>

              {!activeOrder ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="btn btn-primary" onClick={() => handleOpenTable(2)} disabled={actionLoading} style={{ padding: '8px 14px', fontSize: '0.88rem' }}>
                    <Plus size={16} /> {t('pos.open_now')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setIsTransferModalOpen(true)}
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                    title={t('pos.transfer')}
                  >
                    <ArrowRightLeft size={14} /> {t('pos.transfer')}
                  </button>

                  {/* Mobile toggle to switch to Cart */}
                  <button
                    type="button"
                    className="btn btn-primary pos-cart-toggle-mobile"
                    onClick={() => setMobileView('cart')}
                    style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                  >
                    <ShoppingBag size={14} /> {orderItems.length} ({formatKES(activeOrder.total_gross)})
                  </button>
                </div>
              )}
            </div>

            {/* Menu Filters & Search Bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div className="category-pill-container" style={{ flex: 1 }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedCategory(cat)}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}
                  >
                    {cat === 'All' ? t('pos.all_dishes') : cat.toUpperCase()}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: '160px', flex: '0 1 200px' }}>
                <input
                  type="text"
                  placeholder={t('pos.search_dish')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '0.82rem', padding: '7px 12px 7px 32px' }}
                />
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              </div>
            </div>

            {/* Recipe Cards Grid - NO FOOD IMAGES for speed & ergonomics */}
            <div className="dish-cards-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '10px'
            }}>
              {filteredRecipes.map(recipe => {
                const isBar = recipe.station === 'bar';
                const isAvailable = recipe.is_available !== false;

                return (
                  <div
                    key={recipe.id}
                    onClick={() => {
                      if (activeOrder && isAvailable) {
                        handleAddToCart(recipe);
                      }
                    }}
                    className={`pos-dish-card ${!isAvailable ? 'disabled' : ''}`}
                    style={{
                      opacity: isAvailable ? 1 : 0.45,
                      cursor: activeOrder && isAvailable ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px', marginBottom: '4px' }}>
                      <span className={`pos-dish-station-badge ${isBar ? 'pos-dish-station-bar' : 'pos-dish-station-kitchen'}`}>
                        {isBar ? <Wine size={11} /> : <UtensilsCrossed size={11} />}
                        {isBar ? 'BAR' : 'KITCHEN'}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        {formatKES(recipe.price)}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.25, color: 'var(--text-main)', marginBottom: '2px' }}>
                        {recipe.name}
                      </div>
                      {recipe.description && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {recipe.description}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {recipe.category}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: activeOrder ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
                        color: activeOrder ? 'var(--primary)' : 'var(--text-dim)',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <Plus size={13} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: ORDER CART & BILLING PANEL (DESKTOP) */}
      {selectedTable && (
        <div className="pos-cart-desktop glass-panel-elevated" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', position: 'sticky', top: '75px' }}>
          {renderCartContent()}
        </div>
      )}

      {/* MOBILE SUBVIEW FOR CART (WHEN TOGGLED) */}
      {selectedTable && mobileView === 'cart' && (
        <div className="pos-cart-mobile-full glass-panel-elevated" style={{ padding: '16px', minHeight: 'calc(100vh - 100px)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setMobileView('menu')}
            style={{ marginBottom: '14px', width: '100%', justifyContent: 'flex-start' }}
          >
            <ChevronLeft size={16} /> {t('pos.back_to_menu')}
          </button>
          {renderCartContent()}
        </div>
      )}

      {/* FLOATING BOTTOM BAR FOR MOBILE ORDERING */}
      {selectedTable && activeOrder && mobileView === 'menu' && (
        <div className="mobile-bottom-cart-bar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setMobileView('cart')}
              style={{ flex: 1, padding: '6px 10px', justifyContent: 'flex-start', minHeight: '44px' }}
            >
              <span style={{
                background: 'var(--primary)',
                color: '#0d1117',
                fontWeight: 800,
                borderRadius: 'var(--radius-full)',
                padding: '2px 8px',
                fontSize: '0.8rem',
                marginRight: '6px'
              }}>
                {orderItems.length}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{selectedTable.name}</span>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--primary)' }}>
                  {formatKES(activeOrder.total_gross)}
                </span>
              </div>
            </button>

            {cartItemsInCart.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendToStations}
                disabled={actionLoading}
                style={{ padding: '8px 12px', minHeight: '44px', fontSize: '0.85rem', flexShrink: 0 }}
              >
                <Send size={15} />
                {t('pos.send_now')} ({cartItemsInCart.length})
              </button>
            )}

            <button
              type="button"
              className="btn btn-success"
              onClick={() => {
                setMobileView('cart');
                setIsSplitModalOpen(true);
              }}
              disabled={orderItems.filter(it => it.status !== 'paid').length === 0}
              style={{ padding: '8px 12px', minHeight: '44px', fontSize: '0.85rem', flexShrink: 0 }}
            >
              <Receipt size={15} />
              {t('pos.direct_pay')}
            </button>
          </div>
        </div>
      )}

      {/* SPLIT BILL MODAL */}
      {isSplitModalOpen && activeOrder && (
        <SplitBillModal
          isOpen={isSplitModalOpen}
          onClose={() => setIsSplitModalOpen(false)}
          order={activeOrder}
          items={orderItems}
          activeWaiter={activeWaiter}
          activeShift={activeShift}
          onSuccess={() => {
            loadTables();
            loadOrderForTable(selectedTable!.id);
            setNotification({ message: t('pos.table_opened'), type: 'success' });
          }}
        />
      )}

      {/* TRANSFER TABLE MODAL */}
      {isTransferModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '400px', padding: '20px' }}>
            <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={18} color="var(--primary)" /> {t('pos.transfer_title')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '14px' }}>
              {t('pos.transfer_desc')}
            </p>

            <select
              value={targetTransferTableId}
              onChange={e => setTargetTransferTableId(e.target.value)}
              style={{ marginBottom: '18px' }}
            >
              <option value="">{t('pos.select_free_table')}</option>
              {tables.filter(t => t.status === 'free').map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.area})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setIsTransferModalOpen(false)} style={{ flex: 1 }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleTransferTable} disabled={!targetTransferTableId} style={{ flex: 1 }}>
                {t('pos.transfer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE & AREA MANAGER MODAL (MANAGER-MODUS) */}
      <TableManagerModal
        isOpen={isTableManagerOpen}
        onClose={() => setIsTableManagerOpen(false)}
        activeWaiter={activeWaiter}
        onTablesChanged={() => {
          loadTables();
          loadAreas();
        }}
      />
    </div>
  );
};

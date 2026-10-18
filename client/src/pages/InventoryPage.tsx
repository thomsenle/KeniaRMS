import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { apiRequest, formatKES, socket } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  Boxes, 
  Plus, 
  ShoppingCart, 
  Search, 
  Printer, 
  Copy, 
  Check, 
  Edit2, 
  ArrowUpDown, 
  PackageCheck,
  Building2
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeView, setActiveView] = useState<'inventory' | 'shopping_list'>('inventory');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  // Modals & Forms
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>(t('inventory.reason_delivery'));

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    loadInventory();

    socket.on('inventory:updated', loadInventory);
    socket.on('inventory:updated_all', loadInventory);

    return () => {
      socket.off('inventory:updated');
      socket.off('inventory:updated_all');
    };
  }, []);

  const loadInventory = async () => {
    try {
      const res = await apiRequest<{ success: boolean; items: InventoryItem[] }>('/inventory');
      setItems(res.items);
    } catch (err: any) {
      console.error('Failed to load inventory:', err);
    }
  };

  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustAmount('');
    setAdjustReason(t('inventory.reason_delivery'));
    setIsAdjustModalOpen(true);
  };

  const submitAdjust = async () => {
    if (!adjustItem || !adjustAmount) return;

    try {
      await apiRequest(`/inventory/${adjustItem.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          change_amount: Number(adjustAmount),
          reason: adjustReason
        })
      });

      setIsAdjustModalOpen(false);
      setAdjustItem(null);
      await loadInventory();
    } catch (err: any) {
      alert(err.message || 'Error adjusting stock');
    }
  };

  const handleOpenEdit = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
    } else {
      setEditingItem({
        name: '',
        category: 'ingredient',
        unit: 'kg',
        current_stock: 0,
        min_stock: 5,
        optimal_stock: 20,
        cost_per_unit: 100,
        supplier: ''
      });
    }
    setIsEditModalOpen(true);
  };

  const submitEdit = async () => {
    if (!editingItem || !editingItem.name) return;

    try {
      if (editingItem.id) {
        await apiRequest(`/inventory/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingItem)
        });
      } else {
        await apiRequest('/inventory', {
          method: 'POST',
          body: JSON.stringify(editingItem)
        });
      }

      setIsEditModalOpen(false);
      setEditingItem(null);
      await loadInventory();
    } catch (err: any) {
      alert(err.message || 'Error saving item');
    }
  };

  // Compute Shopping List items (current_stock <= min_stock)
  const lowStockItems = items.filter(it => it.current_stock <= it.min_stock).map(it => {
    const needed = Math.max(0, it.optimal_stock - it.current_stock);
    const estCost = needed * it.cost_per_unit;
    return {
      ...it,
      needed_quantity: Math.round(needed * 100) / 100,
      estimated_cost: Math.round(estCost * 100) / 100
    };
  });

  const totalShoppingBudgetKES = lowStockItems.reduce((acc, it) => acc + (it.estimated_cost || 0), 0);

  // Group by supplier
  const groupedSuppliers: Record<string, typeof lowStockItems> = {};
  for (const it of lowStockItems) {
    const sup = it.supplier?.trim() || 'General / Local Market';
    if (!groupedSuppliers[sup]) groupedSuppliers[sup] = [];
    groupedSuppliers[sup].push(it);
  }

  const copyShoppingListText = () => {
    let text = `🛒 ${t('shopping_list.title')}\n`;
    text += `${t('closing.col_date')}: ${new Date().toLocaleDateString('de-DE')}\n`;
    text += `${t('shopping_list.estimated_budget')} ${formatKES(totalShoppingBudgetKES)}\n\n`;

    for (const [supplier, supItems] of Object.entries(groupedSuppliers)) {
      text += `📍 ${supplier.toUpperCase()}\n`;
      for (const item of supItems) {
        text += `- ${item.name}: ${item.needed_quantity} ${item.unit} ~ ${formatKES(item.estimated_cost)}\n`;
      }
      text += `\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  // Filter items for table view
  const categories = ['all', 'beverage', 'produce', 'meat', 'dairy', 'dry_goods', 'ingredient'];
  const filteredItems = items.filter(it => {
    const matchesCat = selectedCategory === 'all' || it.category === selectedCategory;
    const matchesSearch = it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (it.supplier && it.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLowStock = showOnlyLowStock ? it.current_stock <= it.min_stock : true;
    return matchesCat && matchesSearch && matchesLowStock;
  });

  return (
    <div>
      {/* Top Header & View Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Boxes size={28} color="var(--primary)" /> {t('inventory.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('inventory.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className={`btn ${activeView === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('inventory')}
          >
            <Boxes size={18} /> {t('inventory.stock_tab')} ({items.length})
          </button>
          <button
            type="button"
            className={`btn ${activeView === 'shopping_list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('shopping_list')}
            style={{ position: 'relative' }}
          >
            <ShoppingCart size={18} />
            {t('inventory.shopping_list_tab')}
            {lowStockItems.length > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.72rem',
                padding: '2px 7px',
                borderRadius: '999px',
                fontWeight: 700,
                marginLeft: '4px'
              }}>
                {lowStockItems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => handleOpenEdit()}
          >
            <Plus size={18} /> {t('inventory.new_item_btn')}
          </button>
        </div>
      </div>

      {/* VIEW 1: LAGERBESTAND TABLE */}
      {activeView === 'inventory' && (
        <div>
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: 'var(--radius-full)' }}
                >
                  {cat === 'all' ? t('inventory.all_categories') : cat.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={showOnlyLowStock}
                  onChange={e => setShowOnlyLowStock(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ color: showOnlyLowStock ? '#f87171' : 'var(--text-muted)' }}>{t('inventory.only_low_stock')}</span>
              </label>

              <div style={{ position: 'relative', width: '220px' }}>
                <input
                  type="text"
                  placeholder={t('inventory.search_placeholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 16px' }}>{t('inventory.col_item')}</th>
                  <th style={{ padding: '14px 16px' }}>{t('inventory.col_category')}</th>
                  <th style={{ padding: '14px 16px' }}>{t('inventory.col_current')}</th>
                  <th style={{ padding: '14px 16px' }}>{t('inventory.col_min')}</th>
                  <th style={{ padding: '14px 16px' }}>{t('inventory.col_optimal')}</th>
                  <th style={{ padding: '14px 16px' }}>{t('inventory.col_cost')}</th>
                  <th style={{ padding: '14px 16px' }}>{t('inventory.col_supplier')}</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>{t('inventory.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const isLow = item.current_stock <= item.min_stock;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: isLow ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {item.unit}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span className="badge badge-neutral">{item.category}</span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            color: isLow ? '#f87171' : 'var(--text-main)'
                          }}>
                            {item.current_stock} {item.unit}
                          </span>
                          {isLow && (
                            <span className="badge badge-low-stock">
                              {t('inventory.reorder_badge')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                        {item.min_stock} {item.unit}
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                        {item.optimal_stock} {item.unit}
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {formatKES(item.cost_per_unit)}
                      </td>

                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {item.supplier || '-'}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleOpenAdjust(item)}
                            style={{ padding: '4px 10px', fontSize: '0.8rem', minHeight: '32px' }}
                            title={t('inventory.adjust_btn')}
                          >
                            <ArrowUpDown size={14} /> {t('inventory.adjust_btn')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => handleOpenEdit(item)}
                            style={{ padding: '6px', minHeight: '32px' }}
                            title={t('common.edit')}
                          >
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SHOPPING LIST GENERATOR */}
      {activeView === 'shopping_list' && (
        <div>
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span className="badge badge-warning" style={{ marginBottom: '6px' }}>{t('shopping_list.auto_generated')}</span>
              <h2 style={{ fontSize: '1.4rem' }}>{t('shopping_list.title')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {t('shopping_list.subtitle')}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('shopping_list.estimated_budget')}</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatKES(totalShoppingBudgetKES)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={copyShoppingListText}
                >
                  {copiedToast ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
                  {copiedToast ? t('common.copied') : t('common.copy')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                >
                  <Printer size={18} /> {t('common.print')}
                </button>
              </div>
            </div>
          </div>

          {/* Grouped by Supplier List */}
          {lowStockItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-emerald)' }}>
              <PackageCheck size={48} style={{ margin: '0 auto 12px auto' }} />
              <h3>{t('shopping_list.all_stocks_optimal')}</h3>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {Object.entries(groupedSuppliers).map(([supplier, supItems]) => {
                const subtotal = supItems.reduce((acc, it) => acc + (it.estimated_cost || 0), 0);

                return (
                  <div key={supplier} className="glass-panel" style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={20} color="var(--primary)" />
                        <h3 style={{ fontSize: '1.15rem' }}>{supplier}</h3>
                        <span className="badge badge-neutral">{supItems.length}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
                        {t('shopping_list.subtotal_supplier')} {formatKES(subtotal)}
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('shopping_list.col_item')}</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('shopping_list.col_current')}</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('shopping_list.col_min')}</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('shopping_list.col_needed')}</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('shopping_list.col_cost')}</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('shopping_list.col_total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supItems.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.name}</td>
                              <td style={{ padding: '10px 12px', color: '#f87171', fontWeight: 700 }}>
                                {item.current_stock} {item.unit}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                {item.min_stock} {item.unit}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: '#34d399' }}>
                                + {item.needed_quantity} {item.unit}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                {formatKES(item.cost_per_unit)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                                {formatKES(item.estimated_cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: BESTAND ANPASSEN */}
      {isAdjustModalOpen && adjustItem && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '440px', padding: '24px' }}>
            <h3 style={{ marginBottom: '6px' }}>{t('inventory.adjust_title')}</h3>
            <div style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '14px', fontSize: '1.1rem' }}>
              {adjustItem.name}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('inventory.current_stock_label')}</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {adjustItem.current_stock} {adjustItem.unit}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {t('inventory.change_amount_label')}
              </label>
              <input
                type="number"
                step="any"
                placeholder="+10 / -2"
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {t('inventory.reason_label')}
              </label>
              <select
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
              >
                <option value="Lieferung erhalten">{t('inventory.reason_delivery')}</option>
                <option value="Inventurkorrektur">{t('inventory.reason_correction')}</option>
                <option value="Bruch / Verderb">{t('inventory.reason_spoilage')}</option>
                <option value="Eigenverbrauch">{t('inventory.reason_tasting')}</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)} style={{ flex: 1 }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={submitAdjust} disabled={!adjustAmount} style={{ flex: 1 }}>
                {t('inventory.adjust_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEUER ARTIKEL / BEARBEITEN */}
      {isEditModalOpen && editingItem && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '520px', padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>
              {editingItem.id ? t('inventory.edit_item_title') : t('inventory.new_item_title')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('inventory.item_name')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tusker 500ml, Limes..."
                  value={editingItem.name || ''}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('inventory.category_label')}
                  </label>
                  <select
                    value={editingItem.category || 'ingredient'}
                    onChange={e => setEditingItem({ ...editingItem, category: e.target.value as any })}
                  >
                    <option value="beverage">Beverage</option>
                    <option value="ingredient">Ingredient</option>
                    <option value="meat">Meat / Fish</option>
                    <option value="produce">Produce</option>
                    <option value="dairy">Dairy</option>
                    <option value="dry_goods">Dry Goods</option>
                    <option value="consumables">Consumables</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('inventory.unit_label')}
                  </label>
                  <select
                    value={editingItem.unit || 'kg'}
                    onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="cl">cl</option>
                    <option value="ml">ml</option>
                    <option value="bottle">bottle</option>
                    <option value="can">can</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('inventory.col_current')}:
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.current_stock ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, current_stock: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#f87171', marginBottom: '4px' }}>
                    {t('inventory.col_min')}:
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.min_stock ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, min_stock: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#34d399', marginBottom: '4px' }}>
                    {t('inventory.col_optimal')}:
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.optimal_stock ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, optimal_stock: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('inventory.cost_label')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.cost_per_unit ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, cost_per_unit: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('inventory.supplier_label')}
                  </label>
                  <input
                    type="text"
                    value={editingItem.supplier || ''}
                    onChange={e => setEditingItem({ ...editingItem, supplier: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)} style={{ flex: 1 }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={submitEdit} style={{ flex: 1 }}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

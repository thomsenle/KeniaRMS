import React, { useState, useEffect } from 'react';
import { Table, RestaurantArea, Waiter } from '../types';
import { apiRequest, socket } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  Layers, 
  Search, 
  Check, 
  Users, 
  SlidersHorizontal,
  Table as TableIcon,
  Loader2
} from 'lucide-react';

interface TableManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWaiter: Waiter | null;
  onTablesChanged: () => void;
}

export const TableManagerModal: React.FC<TableManagerModalProps> = ({
  isOpen,
  onClose,
  activeWaiter,
  onTablesChanged
}) => {
  const { t } = useTranslation();

  const [tables, setTables] = useState<Table[]>([]);
  const [areas, setAreas] = useState<RestaurantArea[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'areas'>('tables');

  // Filters for tables list
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Add / Edit Form State
  const [isEditingTable, setIsEditingTable] = useState<boolean>(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [formTableNumber, setFormTableNumber] = useState<string>('');
  const [formTableName, setFormTableName] = useState<string>('');
  const [formTableArea, setFormTableArea] = useState<string>('');
  const [formCustomArea, setFormCustomArea] = useState<string>('');
  const [formGuestsCount, setFormGuestsCount] = useState<string>('2');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // Area Add / Edit Form State
  const [isEditingArea, setIsEditingArea] = useState<boolean>(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [formAreaName, setFormAreaName] = useState<string>('');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaActionLoading, setAreaActionLoading] = useState<boolean>(false);

  // Success / Error Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      loadData();
    };

    socket.on('tables:updated', handleUpdate);
    socket.on('areas:updated', handleUpdate);

    return () => {
      socket.off('tables:updated', handleUpdate);
      socket.off('areas:updated', handleUpdate);
    };
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tablesRes, areasRes] = await Promise.all([
        apiRequest<{ success: boolean; tables: Table[] }>('/pos/tables'),
        apiRequest<{ success: boolean; areas: RestaurantArea[] }>('/pos/areas')
      ]);

      if (tablesRes.success) {
        setTables(tablesRes.tables);
      }
      if (areasRes.success) {
        setAreas(areasRes.areas);
      }
    } catch (err: any) {
      console.error('Error loading tables/areas data:', err);
      setNotification({ message: err.message || 'Error loading data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Helper: Find next recommended table number
  const getNextAvailableNumber = (): number => {
    if (!tables || tables.length === 0) return 1;
    const maxNum = Math.max(...tables.map(t => t.table_number || 0));
    return maxNum > 0 ? maxNum + 1 : 1;
  };

  // Open Form to Add New Table
  const handleOpenAddTable = () => {
    const nextNum = getNextAvailableNumber();
    setEditingTableId(null);
    setFormTableNumber(String(nextNum));
    setFormTableName(`Table ${nextNum}`);
    const defaultArea = areas.length > 0 ? areas[0].name : 'Restaurant';
    setFormTableArea(defaultArea);
    setFormCustomArea('');
    setFormGuestsCount('2');
    setFormError(null);
    setIsEditingTable(true);
  };

  // Open Form to Edit Existing Table
  const handleOpenEditTable = (table: Table) => {
    setEditingTableId(table.id);
    setFormTableNumber(String(table.table_number));
    setFormTableName(table.name);
    setFormTableArea(table.area);
    setFormCustomArea('');
    setFormGuestsCount(String(table.guests_count || 2));
    setFormError(null);
    setIsEditingTable(true);
  };

  // Cancel Table Edit
  const handleCancelTableEdit = () => {
    setIsEditingTable(false);
    setEditingTableId(null);
    setFormError(null);
  };

  // Save Table (Create or Update)
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const num = parseInt(formTableNumber, 10);
    if (!num || isNaN(num) || num <= 0) {
      setFormError(t('table_manager.table_number'));
      return;
    }

    if (!formTableName.trim()) {
      setFormError(t('table_manager.table_name'));
      return;
    }

    const finalArea = formTableArea === '__CUSTOM__' ? formCustomArea.trim() : formTableArea.trim();
    if (!finalArea) {
      setFormError(t('table_manager.area'));
      return;
    }

    const guests = parseInt(formGuestsCount, 10) || 2;

    setFormLoading(true);
    try {
      if (editingTableId) {
        // Update table
        await apiRequest(`/pos/tables/${editingTableId}`, {
          method: 'PUT',
          body: JSON.stringify({
            table_number: num,
            name: formTableName.trim(),
            area: finalArea,
            guests_count: guests
          })
        });
        setNotification({ message: t('table_manager.success_table_saved'), type: 'success' });
      } else {
        // Create table
        await apiRequest('/pos/tables', {
          method: 'POST',
          body: JSON.stringify({
            table_number: num,
            name: formTableName.trim(),
            area: finalArea,
            guests_count: guests
          })
        });
        setNotification({ message: t('table_manager.success_table_saved'), type: 'success' });
      }

      setIsEditingTable(false);
      setEditingTableId(null);
      await loadData();
      onTablesChanged();
    } catch (err: any) {
      setFormError(err.message || 'Error saving table');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete Table
  const handleDeleteTable = async (table: Table) => {
    if (table.status !== 'free') {
      alert(t('table_manager.cannot_delete_occupied'));
      return;
    }

    const confirmMsg = t('table_manager.delete_confirm').replace('{{name}}', table.name);
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiRequest(`/pos/tables/${table.id}`, {
        method: 'DELETE'
      });
      setNotification({ message: t('table_manager.success_table_deleted'), type: 'success' });
      await loadData();
      onTablesChanged();
    } catch (err: any) {
      alert(err.message || 'Error deleting table');
    }
  };

  // Area Management: Open Add
  const handleOpenAddArea = () => {
    setEditingAreaId(null);
    setFormAreaName('');
    setAreaError(null);
    setIsEditingArea(true);
  };

  // Area Management: Open Edit
  const handleOpenEditArea = (area: RestaurantArea) => {
    setEditingAreaId(area.id);
    setFormAreaName(area.name);
    setAreaError(null);
    setIsEditingArea(true);
  };

  // Cancel Area Edit
  const handleCancelAreaEdit = () => {
    setIsEditingArea(false);
    setEditingAreaId(null);
    setAreaError(null);
  };

  // Save Area (Create or Rename)
  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setAreaError(null);

    const clean = formAreaName.trim();
    if (!clean) {
      setAreaError(t('table_manager.area_name'));
      return;
    }

    setAreaActionLoading(true);
    try {
      if (editingAreaId) {
        // Update / Rename
        await apiRequest(`/pos/areas/${editingAreaId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: clean })
        });
        setNotification({ message: t('table_manager.success_area_saved'), type: 'success' });
      } else {
        // Create
        await apiRequest('/pos/areas', {
          method: 'POST',
          body: JSON.stringify({ name: clean })
        });
        setNotification({ message: t('table_manager.success_area_saved'), type: 'success' });
      }

      setIsEditingArea(false);
      setEditingAreaId(null);
      await loadData();
      onTablesChanged();
    } catch (err: any) {
      setAreaError(err.message || 'Error saving area');
    } finally {
      setAreaActionLoading(false);
    }
  };

  // Delete Area
  const handleDeleteArea = async (area: RestaurantArea) => {
    const assignedCount = area.tables_count ?? tables.filter(t => t.area === area.name).length;
    if (assignedCount > 0) {
      alert(t('table_manager.cannot_delete_area_with_tables').replace('{{count}}', String(assignedCount)));
      return;
    }

    const confirmMsg = t('table_manager.delete_area_confirm').replace('{{name}}', area.name);
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiRequest(`/pos/areas/${area.id}`, {
        method: 'DELETE'
      });
      setNotification({ message: t('table_manager.success_area_deleted'), type: 'success' });
      await loadData();
      onTablesChanged();
    } catch (err: any) {
      alert(err.message || 'Error deleting area');
    }
  };

  if (!isOpen) return null;

  // Filtered tables for the tabular list
  const filteredTables = tables.filter(t => {
    const matchesArea = selectedAreaFilter === 'All' || t.area === selectedAreaFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      String(t.table_number).includes(q) || 
      t.name.toLowerCase().includes(q) ||
      t.area.toLowerCase().includes(q);
    return matchesArea && matchesSearch;
  });

  const totalCount = tables.length;
  const freeCount = tables.filter(t => t.status === 'free').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div 
        className="modal-card glass-panel-elevated" 
        style={{ 
          maxWidth: '960px', 
          width: '95vw', 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '24px' 
        }}
      >
        {/* HEADER BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <SlidersHorizontal size={22} color="var(--primary)" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{t('table_manager.title')}</h2>
              <span style={{
                fontSize: '0.68rem',
                background: 'rgba(245, 158, 11, 0.2)',
                color: 'var(--primary)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 800,
                letterSpacing: '0.05em'
              }}>
                {t('table_manager.manager_badge')} {activeWaiter ? `• ${activeWaiter.name}` : ''}
              </span>
              {loading && <Loader2 size={16} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              {t('table_manager.subtitle')}
            </p>
          </div>

          <button 
            type="button"
            className="btn btn-ghost" 
            onClick={onClose} 
            style={{ padding: '6px' }}
            title={t('common.close')}
          >
            <X size={22} />
          </button>
        </div>

        {/* METRICS SUMMARY STRIP */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
          gap: '10px', 
          marginBottom: '18px' 
        }}>
          <div className="glass-panel" style={{ padding: '10px 14px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('table_manager.total_tables')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalCount}</div>
          </div>
          <div className="glass-panel" style={{ padding: '10px 14px', textAlign: 'center', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <span style={{ fontSize: '0.72rem', color: '#34d399', textTransform: 'uppercase' }}>
              {t('table_manager.free_tables')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{freeCount}</div>
          </div>
          <div className="glass-panel" style={{ padding: '10px 14px', textAlign: 'center', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', textTransform: 'uppercase' }}>
              {t('table_manager.occupied_tables')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{occupiedCount}</div>
          </div>
          <div className="glass-panel" style={{ padding: '10px 14px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('table_manager.active_areas')}
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{areas.length}</div>
          </div>
        </div>

        {/* NOTIFICATION MESSAGE */}
        {notification && (
          <div style={{
            background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: notification.type === 'success' ? '#34d399' : '#f87171',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.88rem'
          }}>
            <span>{notification.message}</span>
            <button 
              type="button"
              className="btn btn-ghost" 
              onClick={() => setNotification(null)} 
              style={{ padding: '2px 8px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB NAVIGATION */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'tables' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('tables'); handleCancelTableEdit(); }}
            style={{ fontSize: '0.88rem', padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
          >
            <TableIcon size={16} />
            {t('table_manager.tabs.tables')} ({tables.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'areas' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('areas'); handleCancelAreaEdit(); }}
            style={{ fontSize: '0.88rem', padding: '8px 16px', borderRadius: 'var(--radius-full)' }}
          >
            <Layers size={16} />
            {t('table_manager.tabs.areas')} ({areas.length})
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: TABULAR TABLES OVERVIEW                           */}
        {/* ======================================================== */}
        {activeTab === 'tables' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Action & Filter Toolbar */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: '10px', 
              marginBottom: '14px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder={t('table_manager.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '36px', height: '38px', fontSize: '0.88rem' }}
                  />
                </div>

                <select
                  value={selectedAreaFilter}
                  onChange={(e) => setSelectedAreaFilter(e.target.value)}
                  style={{ width: '180px', height: '38px', fontSize: '0.88rem' }}
                >
                  <option value="All">{t('table_manager.all_areas')}</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              {!isEditingTable && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenAddTable}
                  style={{ fontSize: '0.88rem', padding: '8px 16px', whiteSpace: 'nowrap' }}
                >
                  <Plus size={16} />
                  {t('table_manager.add_table')}
                </button>
              )}
            </div>

            {/* ADD / EDIT TABLE FORM CARD (INLINE PANEL) */}
            {isEditingTable && (
              <form 
                onSubmit={handleSaveTable}
                className="glass-panel" 
                style={{ 
                  padding: '16px', 
                  marginBottom: '16px', 
                  border: '1px solid var(--primary)', 
                  background: 'rgba(245, 158, 11, 0.05)' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {editingTableId ? t('table_manager.edit_table_modal_title') : t('table_manager.add_table_modal_title')}
                  </h4>
                  <button type="button" className="btn btn-ghost" onClick={handleCancelTableEdit} style={{ padding: '2px 8px' }}>
                    ✕
                  </button>
                </div>

                {formError && (
                  <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '10px' }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  {/* Table Number */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      {t('table_manager.table_number')} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder={t('table_manager.table_number_placeholder')}
                      value={formTableNumber}
                      onChange={(e) => setFormTableNumber(e.target.value)}
                    />
                  </div>

                  {/* Table Name */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      {t('table_manager.table_name')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t('table_manager.table_name_placeholder')}
                      value={formTableName}
                      onChange={(e) => setFormTableName(e.target.value)}
                    />
                  </div>

                  {/* Dining Area */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      {t('table_manager.area')} *
                    </label>
                    <select
                      value={formTableArea}
                      onChange={(e) => setFormTableArea(e.target.value)}
                    >
                      {areas.map(a => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                      ))}
                      <option value="__CUSTOM__">+ {t('table_manager.or_new_area')}</option>
                    </select>

                    {formTableArea === '__CUSTOM__' && (
                      <input
                        type="text"
                        placeholder={t('table_manager.new_area_placeholder')}
                        value={formCustomArea}
                        onChange={(e) => setFormCustomArea(e.target.value)}
                        style={{ marginTop: '6px' }}
                        required
                      />
                    )}
                  </div>

                  {/* Guest Seats */}
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      {t('table_manager.guests')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formGuestsCount}
                      onChange={(e) => setFormGuestsCount(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleCancelTableEdit}
                    disabled={formLoading}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={formLoading}
                  >
                    <Check size={16} />
                    {t('table_manager.save_table')}
                  </button>
                </div>
              </form>
            )}

            {/* TABULAR OVERVIEW TABLE */}
            <div className="data-table-container" style={{ flex: 1, minHeight: '260px', maxHeight: '480px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px', textAlign: 'center' }}>#</th>
                    <th>{t('table_manager.table_name')}</th>
                    <th>{t('table_manager.area')}</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>{t('table_manager.guests')}</th>
                    <th style={{ width: '140px' }}>{t('table_manager.status')}</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>{t('table_manager.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTables.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        {t('table_manager.no_tables_found')}
                      </td>
                    </tr>
                  ) : (
                    filteredTables.map(tItem => {
                      const isOccupied = tItem.status === 'occupied';

                      return (
                        <tr 
                          key={tItem.id}
                          style={{
                            background: isOccupied ? 'rgba(245, 158, 11, 0.04)' : undefined
                          }}
                        >
                          {/* Number Badge */}
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              minWidth: '28px',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              color: 'var(--primary)'
                            }}>
                              {tItem.table_number}
                            </span>
                          </td>

                          {/* Name */}
                          <td>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                              {tItem.name}
                            </div>
                          </td>

                          {/* Area Badge */}
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                              {tItem.area}
                            </span>
                          </td>

                          {/* Capacity / Guests */}
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                              <Users size={13} /> {tItem.guests_count || 2}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            <span className={`badge ${isOccupied ? 'badge-warning' : 'badge-success'}`}>
                              {isOccupied ? t('common.occupied') : t('common.free')}
                            </span>
                            {isOccupied && tItem.active_waiter_name && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {tItem.active_waiter_name}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleOpenEditTable(tItem)}
                                style={{ padding: '6px 10px', minHeight: '32px' }}
                                title={t('table_manager.edit_table')}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => handleDeleteTable(tItem)}
                                disabled={isOccupied}
                                style={{ 
                                  padding: '6px 10px', 
                                  minHeight: '32px',
                                  color: isOccupied ? 'var(--text-dim)' : '#f87171',
                                  cursor: isOccupied ? 'not-allowed' : 'pointer'
                                }}
                                title={isOccupied ? t('table_manager.cannot_delete_occupied') : t('table_manager.delete_table')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: AREAS MANAGEMENT                                 */}
        {/* ======================================================== */}
        {activeTab === 'areas' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {t('table_manager.areas_title')}
              </span>

              {!isEditingArea && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenAddArea}
                  style={{ fontSize: '0.88rem', padding: '8px 16px' }}
                >
                  <Plus size={16} />
                  {t('table_manager.add_area')}
                </button>
              )}
            </div>

            {/* ADD / EDIT AREA FORM (INLINE PANEL) */}
            {isEditingArea && (
              <form 
                onSubmit={handleSaveArea}
                className="glass-panel" 
                style={{ 
                  padding: '16px', 
                  marginBottom: '16px', 
                  border: '1px solid var(--primary)', 
                  background: 'rgba(245, 158, 11, 0.05)' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {editingAreaId ? t('table_manager.edit_area') : t('table_manager.add_area')}
                  </h4>
                  <button type="button" className="btn btn-ghost" onClick={handleCancelAreaEdit} style={{ padding: '2px 8px' }}>
                    ✕
                  </button>
                </div>

                {areaError && (
                  <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '10px' }}>
                    {areaError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      {t('table_manager.area_name')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t('table_manager.area_name_placeholder')}
                      value={formAreaName}
                      onChange={(e) => setFormAreaName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleCancelAreaEdit}
                      disabled={areaActionLoading}
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={areaActionLoading}
                    >
                      <Check size={16} />
                      {t('table_manager.save_area')}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* AREAS LIST TABLE */}
            <div className="data-table-container" style={{ flex: 1, maxHeight: '480px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('table_manager.area_name')}</th>
                    <th style={{ width: '160px', textAlign: 'center' }}>{t('table_manager.assigned_tables_count')}</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>{t('table_manager.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        {t('table_manager.empty_areas_hint')}
                      </td>
                    </tr>
                  ) : (
                    areas.map(areaItem => {
                      const count = areaItem.tables_count ?? tables.filter(t => t.area === areaItem.name).length;

                      return (
                        <tr key={areaItem.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Layers size={16} color="var(--primary)" />
                              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{areaItem.name}</span>
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-neutral">
                              {count} {t('table_manager.tabs.tables')}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleOpenEditArea(areaItem)}
                                style={{ padding: '6px 10px', minHeight: '32px' }}
                                title={t('table_manager.edit_area')}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => handleDeleteArea(areaItem)}
                                disabled={count > 0}
                                style={{ 
                                  padding: '6px 10px', 
                                  minHeight: '32px',
                                  color: count > 0 ? 'var(--text-dim)' : '#f87171',
                                  cursor: count > 0 ? 'not-allowed' : 'pointer'
                                }}
                                title={count > 0 ? t('table_manager.cannot_delete_area_with_tables').replace('{{count}}', String(count)) : t('table_manager.delete_area')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

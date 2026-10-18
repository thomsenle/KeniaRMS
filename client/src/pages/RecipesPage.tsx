import React, { useState, useEffect } from 'react';
import { Recipe, RecipeIngredient, InventoryItem } from '../types';
import { apiRequest, formatKES, socket } from '../api/client';
import { useTranslation } from '../i18n';
import { 
  Utensils, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  Wine, 
  UtensilsCrossed, 
  Image as ImageIcon, 
  Tv, 
  Star
} from 'lucide-react';

export const RecipesPage: React.FC = () => {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe> & { ingredients: RecipeIngredient[] }>({
    name: '',
    category: 'food',
    price: 500,
    tax_rate: 16.0,
    catering_levy: 2.0,
    station: 'kitchen',
    description: '',
    image_url: '',
    display_on_board: 1,
    display_highlight: 0,
    ingredients: []
  });

  useEffect(() => {
    loadData();

    socket.on('recipes:updated', loadData);
    socket.on('inventory:updated', loadData);
    socket.on('inventory:updated_all', loadData);

    return () => {
      socket.off('recipes:updated');
      socket.off('inventory:updated');
      socket.off('inventory:updated_all');
    };
  }, []);

  const loadData = async () => {
    try {
      const [resRecipes, resInv] = await Promise.all([
        apiRequest<{ success: boolean; recipes: Recipe[] }>('/recipes'),
        apiRequest<{ success: boolean; items: InventoryItem[] }>('/inventory')
      ]);
      setRecipes(resRecipes.recipes);
      setInventory(resInv.items);
    } catch (err: any) {
      console.error('Failed to load recipes/inventory:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingRecipe({
      name: '',
      category: 'food',
      price: 500,
      tax_rate: 16.0,
      catering_levy: 2.0,
      station: 'kitchen',
      description: '',
      image_url: '',
      display_on_board: 1,
      display_highlight: 0,
      ingredients: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (recipe: Recipe) => {
    try {
      const detail = await apiRequest<{ success: boolean; recipe: Recipe }>(`/recipes/${recipe.id}`);
      setEditingRecipe({
        ...detail.recipe,
        ingredients: detail.recipe.ingredients || []
      });
      setIsModalOpen(true);
    } catch (err: any) {
      alert('Error loading recipe details');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('recipes.delete_confirm'))) return;
    try {
      await apiRequest(`/recipes/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting recipe');
    }
  };

  const addIngredientRow = () => {
    if (inventory.length === 0) return;
    const defaultItem = inventory[0];
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          inventory_item_id: defaultItem.id,
          quantity: 1,
          unit: defaultItem.unit,
          cost_per_unit: defaultItem.cost_per_unit
        }
      ]
    }));
  };

  const removeIngredientRow = (index: number) => {
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, idx) => idx !== index)
    }));
  };

  const updateIngredientRow = (index: number, field: string, value: any) => {
    setEditingRecipe(prev => {
      const updated = [...prev.ingredients];
      if (field === 'inventory_item_id') {
        const item = inventory.find(i => i.id === value);
        updated[index] = {
          ...updated[index],
          inventory_item_id: value,
          unit: item?.unit || 'kg',
          cost_per_unit: item?.cost_per_unit || 0
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, ingredients: updated };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiRequest<{ success: boolean; url: string }>('/recipes/upload-image', {
        method: 'POST',
        body: formData
      });
      setEditingRecipe(prev => ({ ...prev, image_url: res.url }));
    } catch (err: any) {
      alert(err.message || 'Upload error');
    }
  };

  const submitRecipe = async () => {
    if (!editingRecipe.name || !editingRecipe.price) {
      alert('Name & price required');
      return;
    }

    try {
      if (editingRecipe.id) {
        await apiRequest(`/recipes/${editingRecipe.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingRecipe)
        });
      } else {
        await apiRequest('/recipes', {
          method: 'POST',
          body: JSON.stringify(editingRecipe)
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error saving recipe');
    }
  };

  const modalCost = editingRecipe.ingredients.reduce((acc, ing) => {
    const item = inventory.find(i => i.id === ing.inventory_item_id);
    return acc + (Number(ing.quantity) || 0) * (item?.cost_per_unit || 0);
  }, 0);
  const modalMargin = editingRecipe.price && editingRecipe.price > 0 
    ? Math.round(((editingRecipe.price - modalCost) / editingRecipe.price) * 100) 
    : 0;

  const categories = ['all', 'food', 'drinks', 'cocktails', 'coffee', 'dessert'];
  const filteredRecipes = recipes.filter(r => {
    const matchesCat = selectedCategory === 'all' || r.category === selectedCategory;
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Utensils size={28} color="var(--primary)" /> {t('recipes.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('recipes.subtitle')}
          </p>
        </div>

        <button className="btn btn-success" onClick={handleOpenCreate}>
          <Plus size={18} /> {t('recipes.new_recipe_btn')}
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory(cat)}
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 'var(--radius-full)' }}
            >
              {cat === 'all' ? t('recipes.all_recipes') : cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <input
            type="text"
            placeholder={t('recipes.search_placeholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        </div>
      </div>

      {/* RECIPES GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '18px'
      }}>
        {filteredRecipes.map(recipe => (
          <div key={recipe.id} className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header Image */}
            <div style={{ height: '170px', position: 'relative', background: '#1a1e28' }}>
              {recipe.image_url ? (
                <img
                  src={recipe.image_url}
                  alt={recipe.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                  {recipe.station === 'bar' ? <Wine size={48} /> : <UtensilsCrossed size={48} />}
                </div>
              )}

              <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                <span className="badge" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>
                  {recipe.category.toUpperCase()}
                </span>
                {recipe.display_highlight === 1 && (
                  <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.9)', color: '#000' }}>
                    <Star size={12} fill="#000" /> {t('recipes.highlight_badge')}
                  </span>
                )}
                {recipe.display_on_board === 1 && (
                  <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.85)', color: '#fff' }} title={t('recipes.show_on_tv')}>
                    <Tv size={12} /> {t('recipes.tv_badge')}
                  </span>
                )}
              </div>

              <span style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(4px)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 800,
                fontSize: '1.2rem',
                color: 'var(--primary)'
              }}>
                {formatKES(recipe.price)}
              </span>
            </div>

            {/* Content */}
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', lineHeight: 1.3 }}>{recipe.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                  {recipe.description || ''}
                </p>

                {/* Ingredients List */}
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px', marginBottom: '14px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    {t('recipes.ingredients_link_title')}
                  </div>
                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {recipe.ingredients.map((ing, idx) => {
                        const hasStock = (ing.current_stock || 0) >= ing.quantity;

                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: hasStock ? 'var(--text-main)' : '#f87171' }}>
                              • {ing.inventory_name || 'Ingredient'}: {ing.quantity} {ing.unit}
                            </span>
                            <span style={{ color: hasStock ? 'var(--text-dim)' : '#f87171', fontWeight: hasStock ? 400 : 700 }}>
                              {hasStock ? `${ing.current_stock} ${t('recipes.in_stock')}` : t('recipes.out_of_stock')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {t('recipes.no_ingredients')}
                    </span>
                  )}
                </div>

                {/* Margin & Cost Calculation */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>{t('recipes.food_cost')}</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {formatKES(recipe.calculated_cost_kes || 0)}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>{t('recipes.gross_margin')}</span>
                    <strong style={{ fontSize: '0.95rem', color: (recipe.gross_margin_percent || 0) > 60 ? '#34d399' : '#fbbf24' }}>
                      {recipe.gross_margin_percent}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <span className="badge badge-neutral">
                  {t('recipes.station_label')} {recipe.station.toUpperCase()}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-secondary" onClick={() => handleOpenEdit(recipe)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    <Edit2 size={14} /> {t('common.edit')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => handleDelete(recipe.id)} style={{ padding: '6px', color: '#f87171' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* RECIPE EDIT / CREATE MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card glass-panel-elevated" style={{ maxWidth: '640px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>
              {editingRecipe.id ? t('recipes.edit_title') : t('recipes.new_title')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('recipes.name_label')}
                  </label>
                  <input
                    type="text"
                    value={editingRecipe.name || ''}
                    onChange={e => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('recipes.price_label')}
                  </label>
                  <input
                    type="number"
                    value={editingRecipe.price ?? ''}
                    onChange={e => setEditingRecipe({ ...editingRecipe, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('recipes.category_label')}
                  </label>
                  <select
                    value={editingRecipe.category || 'food'}
                    onChange={e => setEditingRecipe({ ...editingRecipe, category: e.target.value as any })}
                  >
                    <option value="food">Food</option>
                    <option value="drinks">Drinks</option>
                    <option value="cocktails">Cocktails</option>
                    <option value="coffee">Coffee / Tea</option>
                    <option value="dessert">Dessert</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('recipes.station_prep_label')}
                  </label>
                  <select
                    value={editingRecipe.station || 'kitchen'}
                    onChange={e => setEditingRecipe({ ...editingRecipe, station: e.target.value as any })}
                  >
                    <option value="kitchen">{t('recipes.kitchen')}</option>
                    <option value="bar">{t('recipes.bar')}</option>
                    <option value="counter">{t('recipes.counter')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('recipes.desc_label')}
                </label>
                <textarea
                  rows={2}
                  value={editingRecipe.description || ''}
                  onChange={e => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                />
              </div>

              {/* Image URL or Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {t('recipes.image_label')}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={editingRecipe.image_url || ''}
                    onChange={e => setEditingRecipe({ ...editingRecipe, image_url: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <ImageIcon size={16} /> {t('recipes.choose_photo')}
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* Display & Highlight Toggles */}
              <div style={{ display: 'flex', gap: '20px', padding: '10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={editingRecipe.display_on_board === 1}
                    onChange={e => setEditingRecipe({ ...editingRecipe, display_on_board: e.target.checked ? 1 : 0 })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>{t('recipes.show_on_tv')}</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={editingRecipe.display_highlight === 1}
                    onChange={e => setEditingRecipe({ ...editingRecipe, display_highlight: e.target.checked ? 1 : 0 })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>{t('recipes.day_highlight')}</span>
                </label>
              </div>

              {/* INGREDIENTS LINKER */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('recipes.ingredients_link_title')}</span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {t('recipes.ingredients_sub')}
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={addIngredientRow} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                    <Plus size={14} /> {t('recipes.add_ingredient')}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {editingRecipe.ingredients.map((ing, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px 36px', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={ing.inventory_item_id}
                        onChange={e => updateIngredientRow(idx, 'inventory_item_id', e.target.value)}
                      >
                        {inventory.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.unit})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        placeholder="Qty"
                        value={ing.quantity}
                        onChange={e => updateIngredientRow(idx, 'quantity', Number(e.target.value))}
                      />

                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {ing.unit}
                      </span>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removeIngredientRow(idx)}
                        style={{ padding: '4px', color: '#f87171' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {editingRecipe.ingredients.length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                      {t('recipes.no_ingredients_added')}
                    </div>
                  )}
                </div>

                {/* Live Food Cost Calculation in Modal */}
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span>{t('recipes.calc_food_cost')} <strong>{formatKES(modalCost)}</strong></span>
                  <span style={{ color: modalMargin > 60 ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                    {t('recipes.calc_margin')} {modalMargin}%
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={submitRecipe} style={{ flex: 1 }}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

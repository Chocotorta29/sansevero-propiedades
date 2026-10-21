'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('products');

  // Estado del Local (Cierre Manual)
  const [isForcedClosed, setIsForcedClosed] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Estados de Productos
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  
  // Formulario Producto
  const [productEditingId, setProductEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  
  // Gustos / Ingredientes
  const [allowsFlavorSelection, setAllowsFlavorSelection] = useState(false);
  const [maxFlavors, setMaxFlavors] = useState('1');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [allowFlavorRepetition, setAllowFlavorRepetition] = useState(true);

  // Estados de Adicionales
  const [addons, setAddons] = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(true);
  const [savingAddon, setSavingAddon] = useState(false);
  const [addonEditingId, setAddonEditingId] = useState(null);
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonCategory, setAddonCategory] = useState('General');
  const [addonAvailable, setAddonAvailable] = useState(true);
  const [selectedAddonGroupIds, setSelectedAddonGroupIds] = useState([]);

  useEffect(() => {
    fetchStoreConfig();
    fetchProductsData();
    fetchAddonsData();
  }, []);

  async function fetchStoreConfig() {
    setLoadingConfig(true);
    const { data, error } = await supabase.from('store_config').select('*').eq('id', 1).single();
    if (data && !error) {
      setIsForcedClosed(data.is_forced_closed || false);
    }
    setLoadingConfig(false);
  }

  const toggleForcedClosed = async () => {
    const newStatus = !isForcedClosed;
    setIsForcedClosed(newStatus);

    const { error } = await supabase
      .from('store_config')
      .upsert({ id: 1, is_forced_closed: newStatus, updated_at: new Date().toISOString() });

    if (error) {
      alert('Error al actualizar estado del local: ' + error.message);
      setIsForcedClosed(!newStatus);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `products/${cleanFileName}`;

      const bucketName = 'menu-imagenes';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      setImageUrl(publicUrlData.publicUrl);
      alert('¡Imagen subida e ingresada con éxito!');
    } catch (err) {
      alert('Error al subir la imagen: ' + (err.message || 'Verificá los permisos del bucket en Supabase.'));
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  };

  async function fetchProductsData() {
    setLoadingProducts(true);
    const { data: cats } = await supabase.from('categories').select('*').order('sort_order');
    const { data: prods } = await supabase.from('products').select('*').order('created_at', { ascending: false });

    if (cats) {
      setCategories(cats);
      if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
    }
    if (prods) setProducts(prods);
    setLoadingProducts(false);
  }

  // --- ACÁ ESTÁ LA SOLUCIÓN: AHORA PERMITE PRECIO 0 ---
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!name || price === '' || price === null || price === undefined || !categoryId) {
      return alert('Por favor completa los campos obligatorios');
    }

    const productPayload = {
      name,
      description,
      price: parseFloat(price) || 0,
      category_id: categoryId,
      image_url: imageUrl || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
      available: true,
      allows_flavor_selection: allowsFlavorSelection,
      max_flavors: allowsFlavorSelection ? (isUnlimited ? 0 : (parseInt(maxFlavors) || 1)) : 0,
      allow_flavor_repetition: allowsFlavorSelection ? allowFlavorRepetition : true
    };

    let productId = productEditingId;

    if (productEditingId) {
      const { error } = await supabase.from('products').update(productPayload).eq('id', productEditingId);
      if (error) return alert('Error al actualizar: ' + error.message);
    } else {
      const { data, error } = await supabase.from('products').insert([productPayload]).select();
      if (error) return alert('Error al guardar: ' + error.message);
      if (data && data.length > 0) productId = data[0].id;
    }

    if (productId) {
      await supabase.from('product_addons').delete().eq('product_id', productId);

      if (selectedAddonIds.length > 0) {
        const relations = selectedAddonIds.map((addonId) => ({
          product_id: productId,
          addon_id: addonId
        }));
        await supabase.from('product_addons').insert(relations);
      }
    }

    alert('¡Producto guardado con éxito!');
    resetProductForm();
    fetchProductsData();
  };

  const handleEditProduct = async (prod) => {
    setProductEditingId(prod.id);
    setName(prod.name);
    setDescription(prod.description || '');
    setPrice(prod.price ?? 0);
    setCategoryId(prod.category_id);
    setImageUrl(prod.image_url || '');
    setAllowsFlavorSelection(prod.allows_flavor_selection || false);
    
    const maxVal = prod.max_flavors ?? 0;
    setIsUnlimited(maxVal === 0);
    setMaxFlavors(maxVal === 0 ? '' : String(maxVal));

    setAllowFlavorRepetition(prod.allow_flavor_repetition ?? true);

    const { data } = await supabase
      .from('product_addons')
      .select('addon_id')
      .eq('product_id', prod.id);

    if (data) {
      setSelectedAddonIds(data.map((item) => item.addon_id));
    } else {
      setSelectedAddonIds([]);
    }
  };

  const resetProductForm = () => {
    setProductEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setImageUrl('');
    setSelectedAddonIds([]);
    setAllowsFlavorSelection(false);
    setMaxFlavors('1');
    setIsUnlimited(false);
    setAllowFlavorRepetition(true);
  };

  const toggleProductAvailability = async (id, currentStatus) => {
    const { error } = await supabase
      .from('products')
      .update({ available: !currentStatus })
      .eq('id', id);

    if (!error) {
      setProducts(products.map(p => p.id === id ? { ...p, available: !currentStatus } : p));
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      setProducts(products.filter(p => p.id !== id));
      setSelectedProductIds(prev => prev.filter(pId => pId !== id));
    }
  };

  // --- SELECCIÓN Y BORRADO MASIVO DE PRODUCTOS ---
  const toggleSelectProduct = (id) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const selectAllProducts = () => {
    setSelectedProductIds(products.map(p => p.id));
  };

  const deselectAllProducts = () => {
    setSelectedProductIds([]);
  };

  const deleteSelectedProducts = async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`¿Estás seguro de eliminar los ${selectedProductIds.length} productos seleccionados?`)) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', selectedProductIds);

    if (error) {
      alert('Error al borrar productos: ' + error.message);
    } else {
      setProducts(products.filter(p => !selectedProductIds.includes(p.id)));
      setSelectedProductIds([]);
      alert('¡Productos eliminados correctamente!');
    }
  };

  const toggleSelectAddonForProduct = (addonId) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const selectGroupAddons = (groupAddonIds) => {
    setSelectedAddonIds((prev) => Array.from(new Set([...prev, ...groupAddonIds])));
  };

  const deselectGroupAddons = (groupAddonIds) => {
    setSelectedAddonIds((prev) => prev.filter((id) => !groupAddonIds.includes(id)));
  };

  const selectAllGlobalAddons = () => {
    setSelectedAddonIds(addons.map((a) => a.id));
  };

  const deselectAllGlobalAddons = () => {
    setSelectedAddonIds([]);
  };

  async function fetchAddonsData() {
    setLoadingAddons(true);
    const { data, error } = await supabase
      .from('addons')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (!error) setAddons(data || []);
    setLoadingAddons(false);
  }

  const handleAddonSubmit = async (e) => {
    e.preventDefault();
    if (!addonName) return alert('Ingresá el nombre');

    setSavingAddon(true);
    const addonData = {
      name: addonName,
      price: parseFloat(addonPrice) || 0,
      category: addonCategory.trim() || 'General',
      available: addonAvailable,
    };

    try {
      if (addonEditingId) {
        const { error } = await supabase.from('addons').update(addonData).eq('id', addonEditingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('addons').insert([addonData]);
        if (error) throw error;
      }

      resetAddonForm();
      fetchAddonsData();
    } catch (err) {
      alert('Error al guardar el adicional');
    } finally {
      setSavingAddon(false);
    }
  };

  const toggleAddonAvailability = async (addon) => {
    const { error } = await supabase
      .from('addons')
      .update({ available: !addon.available })
      .eq('id', addon.id);

    if (!error) fetchAddonsData();
  };

  const handleEditAddon = (addon) => {
    setAddonEditingId(addon.id);
    setAddonName(addon.name);
    setAddonPrice(addon.price);
    setAddonCategory(addon.category || 'General');
    setAddonAvailable(addon.available);
  };

  const deleteAddon = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este adicional?')) return;
    const { error } = await supabase.from('addons').delete().eq('id', id);
    if (!error) {
      fetchAddonsData();
      setSelectedAddonGroupIds(prev => prev.filter(aId => aId !== id));
    }
  };

  // --- SELECCIÓN Y BORRADO MASIVO DE ADICIONALES ---
  const toggleSelectAddonGroup = (id) => {
    setSelectedAddonGroupIds(prev =>
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  const selectAllAddonsTab = () => {
    setSelectedAddonGroupIds(addons.map(a => a.id));
  };

  const deselectAllAddonsTab = () => {
    setSelectedAddonGroupIds([]);
  };

  const deleteSelectedAddons = async () => {
    if (selectedAddonGroupIds.length === 0) return;
    if (!confirm(`¿Estás seguro de eliminar los ${selectedAddonGroupIds.length} adicionales seleccionados?`)) return;

    const { error } = await supabase
      .from('addons')
      .delete()
      .in('id', selectedAddonGroupIds);

    if (error) {
      alert('Error al borrar adicionales: ' + error.message);
    } else {
      fetchAddonsData();
      setSelectedAddonGroupIds([]);
      alert('¡Adicionales eliminados correctamente!');
    }
  };

  const resetAddonForm = () => {
    setAddonEditingId(null);
    setAddonName('');
    setAddonPrice('');
    setAddonCategory('General');
    setAddonAvailable(true);
  };

  const groupedAddons = addons.reduce((acc, addon) => {
    const catName = addon.category?.trim() || 'General';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(addon);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 text-gray-800 pb-28">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER DE ADMINISTRACIÓN */}
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl shadow-sm gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Panel de Administración ⚙️</h1>
            <p className="text-xs text-gray-500">Gestioná productos, gustos, adicionales y estado del local</p>
          </div>
          <Link
            href="/"
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2 rounded-lg font-semibold transition-all"
          >
            👀 Ver Menú Público
          </Link>
        </div>

        {/* CUBIERTA / INTERRUPTOR DE ESTADO DEL LOCAL */}
        <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-all ${
          isForcedClosed ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div>
            <h3 className={`text-sm font-extrabold ${isForcedClosed ? 'text-red-900' : 'text-emerald-900'}`}>
              {isForcedClosed ? '🔴 Estado: CERRADO MANUALMENTE' : '🟢 Estado: AUTOMÁTICO (Según horarios)'}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              {isForcedClosed
                ? 'El menú público dirá CERRADO todo el tiempo (útil por vacaciones, feriados o reformas).'
                : 'El menú cambiará a abierto o cerrado automáticamente según la hora actual.'}
            </p>
          </div>

          <button
            onClick={toggleForcedClosed}
            disabled={loadingConfig}
            className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all ${
              isForcedClosed
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isForcedClosed ? '🔓 Desactivar Cierre Manual' : '🔒 Forzar Cierre del Local'}
          </button>
        </div>

        {/* NAVEGACIÓN PESTAÑAS */}
        <div className="flex border-b border-gray-200 gap-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all ${
              activeTab === 'products'
                ? 'bg-white text-slate-900 border-t-2 border-slate-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            🍔 Productos ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('addons')}
            className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all ${
              activeTab === 'addons'
                ? 'bg-white text-slate-900 border-t-2 border-slate-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            🥟 Gustos / Adicionales ({addons.length})
          </button>
        </div>

        {/* --- SECCIÓN PRODUCTOS --- */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-slate-900 mb-4">
                {productEditingId ? '✏️ Editar Producto' : '➕ Cargar Nuevo Producto'}
              </h2>
              <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Milanesa sola, Bacon Burger"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Precio ($) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="Ej: 12000 (O 0 para ítems con precios por variedad)"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Categoría *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-slate-900 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Imagen del Producto (Subir foto o poner URL)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                    />
                    {uploadingImage && <p className="text-[11px] text-amber-600 font-bold">Subiendo foto...</p>}
                    
                    <input
                      type="url"
                      placeholder="O pegar URL de imagen: https://..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full p-2 border rounded-lg text-xs outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Descripción</label>
                  <textarea
                    placeholder="Detalles del plato..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-slate-900"
                  />
                </div>

                {/* CONFIGURACIÓN DE GUSTOS E INGREDIENTES */}
                <div className="md:col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                    <input
                      type="checkbox"
                      checked={allowsFlavorSelection}
                      onChange={(e) => setAllowsFlavorSelection(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <span>🥟 ¿Este producto requiere seleccionar Opciones / Carne / Guarnición / Gustos?</span>
                  </label>

                  {allowsFlavorSelection && (
                    <div className="pt-2 border-t border-amber-200/80 space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="text-xs font-bold text-amber-900 block">
                            Cantidad máxima general por sección / opción:
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-950">
                            <input
                              type="checkbox"
                              checked={isUnlimited}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setIsUnlimited(checked);
                                if (!checked && (!maxFlavors || maxFlavors === '0')) {
                                  setMaxFlavors('1');
                                }
                              }}
                              className="w-3.5 h-3.5 accent-amber-600 rounded"
                            />
                            <span>♾️ Sin límite</span>
                          </label>
                        </div>

                        <input
                          type="number"
                          min="1"
                          disabled={isUnlimited}
                          placeholder="Escribí un número..."
                          value={isUnlimited ? '' : maxFlavors}
                          onChange={(e) => setMaxFlavors(e.target.value)}
                          className="w-full p-2 bg-white border border-amber-300 rounded-lg text-sm font-bold text-amber-900 outline-none focus:border-amber-600 disabled:bg-gray-100 disabled:text-gray-400"
                        />
                        <p className="text-[11px] text-amber-800 mt-1">
                          *(Guarniciones y Salsas son opcionales. Las demás secciones exigen elegir al menos 1).*
                        </p>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-950 pt-1">
                        <input
                          type="checkbox"
                          checked={allowFlavorRepetition}
                          onChange={(e) => setAllowFlavorRepetition(e.target.checked)}
                          className="w-4 h-4 accent-amber-600 rounded"
                        />
                        <span>
                          🔄 Permitir repetir la cantidad del mismo ítem
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* SELECTOR DE OPCIONES DIVIDIDO POR CATEGORÍAS */}
                <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                    <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                      🧀 Adicionales y Opciones asociadas a este producto:
                    </label>

                    {addons.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllGlobalAddons}
                          className="text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-white px-2 py-1 rounded-md transition-all"
                        >
                          ✓ Marcar Todo
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllGlobalAddons}
                          className="text-[10px] font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-md transition-all"
                        >
                          ✕ Desmarcar Todo
                        </button>
                      </div>
                    )}
                  </div>

                  {addons.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No hay opciones cargadas aún.</p>
                  ) : (
                    Object.entries(groupedAddons).map(([categoryName, groupItems]) => {
                      const groupIds = groupItems.map((item) => item.id);
                      return (
                        <div key={categoryName} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <span>📁</span>
                              <span>{categoryName}</span>
                              <span className="text-[10px] text-gray-400 font-normal">({groupItems.length})</span>
                            </span>

                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => selectGroupAddons(groupIds)}
                                className="text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 px-2 py-0.5 rounded transition-all"
                              >
                                Marcar sección
                              </button>
                              <button
                                type="button"
                                onClick={() => deselectGroupAddons(groupIds)}
                                className="text-[10px] font-bold text-red-600 hover:bg-red-50 px-2 py-0.5 rounded transition-all"
                              >
                                Desmarcar
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                            {groupItems.map((addon) => {
                              const isChecked = selectedAddonIds.includes(addon.id);
                              return (
                                <button
                                  type="button"
                                  key={addon.id}
                                  onClick={() => toggleSelectAddonForProduct(addon.id)}
                                  className={`p-2 rounded-lg border text-xs font-semibold text-left flex items-center justify-between transition-all ${
                                    isChecked
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                  }`}
                                >
                                  <span className="truncate pr-1">{addon.name}</span>
                                  <span className="text-[10px] font-bold opacity-80 flex-shrink-0">
                                    {addon.price > 0 ? `$${addon.price}` : 'Sin costo'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="md:col-span-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all"
                  >
                    {productEditingId ? 'Guardar Cambios del Producto' : 'Guardar Producto en el Menú'}
                  </button>
                  {productEditingId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold px-4 py-2.5 rounded-lg text-sm transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-100">
                <h2 className="text-base font-bold text-slate-900">📋 Lista de Productos</h2>
                {products.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllProducts}
                      className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg transition-all"
                    >
                      ✓ Marcar todos
                    </button>
                    {selectedProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={deselectAllProducts}
                        className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-all"
                      >
                        ✕ Desmarcar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {loadingProducts ? (
                <p className="text-sm text-gray-500">Cargando datos...</p>
              ) : (
                <div className="divide-y">
                  {products.map((prod) => {
                    const isSelected = selectedProductIds.includes(prod.id);
                    return (
                      <div key={prod.id} className={`py-3 flex items-center justify-between gap-4 px-2 rounded-lg transition-colors ${
                        isSelected ? 'bg-red-50/60' : ''
                      }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(prod.id)}
                            className="w-4 h-4 accent-red-600 rounded cursor-pointer flex-shrink-0"
                          />
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-12 h-12 object-cover rounded-lg bg-gray-100 flex-shrink-0"
                          />
                          <div>
                            <p className="font-bold text-sm text-gray-900">{prod.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-semibold text-gray-500">
                                ${Number(prod.price) > 0 ? Number(prod.price).toLocaleString() : '0 (Por variaciones)'}
                              </span>
                              {prod.allows_flavor_selection && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                                  Configurado por secciones
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditProduct(prod)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => toggleProductAvailability(prod.id, prod.available)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                              prod.available
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {prod.available ? '🟢' : '🔴'}
                          </button>
                          <button
                            onClick={() => deleteProduct(prod.id)}
                            className="text-xs bg-gray-100 hover:bg-red-100 text-red-600 p-1.5 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SECCIÓN GUSTOS / ADICIONALES --- */}
        {activeTab === 'addons' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-slate-900 mb-4">
                {addonEditingId ? '✏️ Editar Gusto / Adicional' : '➕ Cargar Nuevo Gusto / Adicional'}
              </h2>
              <form onSubmit={handleAddonSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ternera, Pollo, Papas Fritas..."
                    value={addonName}
                    onChange={(e) => setAddonName(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Precio ($) - 0 si es libre</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={addonPrice}
                    onChange={(e) => setAddonPrice(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Categoría / Grupo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Tipo de Carne, Guarnición, Empanadas"
                    value={addonCategory}
                    onChange={(e) => setAddonCategory(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-slate-900"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    *Tip: Usá <strong>"Tipo de Carne"</strong> para obligar a elegir 1, y <strong>"Guarnición"</strong> o <strong>"Salsas"</strong> para las opcionales.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={addonAvailable}
                      onChange={(e) => setAddonAvailable(e.target.checked)}
                      className="w-4 h-4 accent-slate-900 rounded"
                    />
                    <span>Disponible para venta</span>
                  </label>
                </div>

                <div className="md:col-span-2 flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={savingAddon}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all"
                  >
                    {savingAddon ? 'Guardando...' : addonEditingId ? 'Guardar Cambios' : 'Crear Gusto / Adicional'}
                  </button>

                  {addonEditingId && (
                    <button
                      type="button"
                      onClick={resetAddonForm}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 px-4 rounded-lg text-sm transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-gray-100">
                <h2 className="text-base font-bold text-slate-900">📋 Lista de Gustos y Adicionales</h2>
                {addons.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllAddonsTab}
                      className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg transition-all"
                    >
                      ✓ Marcar todos
                    </button>
                    {selectedAddonGroupIds.length > 0 && (
                      <button
                        type="button"
                        onClick={deselectAllAddonsTab}
                        className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-all"
                      >
                        ✕ Desmarcar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {loadingAddons ? (
                <p className="text-sm text-gray-500">Cargando datos...</p>
              ) : addons.length === 0 ? (
                <p className="text-sm text-gray-500">No hay ítems cargados aún.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedAddons).map(([catGroup, items]) => (
                    <div key={catGroup} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                        <span>📁 {catGroup}</span>
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-600">
                          {items.length}
                        </span>
                      </h3>
                      <div className="divide-y divide-gray-200/80">
                        {items.map((addon) => {
                          const isSelected = selectedAddonGroupIds.includes(addon.id);
                          return (
                            <div key={addon.id} className={`py-2.5 flex items-center justify-between gap-4 px-2 rounded-lg transition-colors ${
                              isSelected ? 'bg-red-50/60' : ''
                            }`}>
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectAddonGroup(addon.id)}
                                  className="w-4 h-4 accent-red-600 rounded cursor-pointer flex-shrink-0"
                                />
                                <div>
                                  <p className="font-bold text-sm text-gray-900">{addon.name}</p>
                                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                                    {addon.price > 0 ? `$${Number(addon.price).toLocaleString()}` : 'Sin costo adicional'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleAddonAvailability(addon)}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                                    addon.available
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {addon.available ? '🟢 Disponible' : '🔴 Pausado'}
                                </button>
                                <button
                                  onClick={() => handleEditAddon(addon)}
                                  className="text-xs bg-gray-100 hover:bg-gray-200 text-slate-800 px-2.5 py-1.5 rounded-lg font-bold transition-all"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => deleteAddon(addon.id)}
                                  className="text-xs bg-gray-100 hover:bg-red-100 text-red-600 p-1.5 rounded-lg transition-all"
                                  title="Eliminar"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* BARRA FLOTANTE DE ACCIÓN MASIVA PARA PRODUCTOS */}
      {activeTab === 'products' && selectedProductIds.length > 0 && (
        <div className="fixed bottom-5 left-0 right-0 px-4 z-30 max-w-md mx-auto animate-fadeIn">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-slate-700">
            <span className="text-xs font-bold">
              {selectedProductIds.length} {selectedProductIds.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
            </span>
            <button
              onClick={deleteSelectedProducts}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <span>🗑️</span>
              <span>Eliminar Selección</span>
            </button>
          </div>
        </div>
      )}

      {/* BARRA FLOTANTE DE ACCIÓN MASIVA PARA ADICIONALES */}
      {activeTab === 'addons' && selectedAddonGroupIds.length > 0 && (
        <div className="fixed bottom-5 left-0 right-0 px-4 z-30 max-w-md mx-auto animate-fadeIn">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center border border-slate-700">
            <span className="text-xs font-bold">
              {selectedAddonGroupIds.length} {selectedAddonGroupIds.length === 1 ? 'adicional seleccionado' : 'adicionales seleccionados'}
            </span>
            <button
              onClick={deleteSelectedAddons}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <span>🗑️</span>
              <span>Eliminar Selección</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
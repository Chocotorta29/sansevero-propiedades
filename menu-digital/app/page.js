'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicialización del cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  // --- ESTADOS DE BASE DE DATOS ---
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [addons, setAddons] = useState([]);
  const [productAddons, setProductAddons] = useState([]);
  const [storeConfig, setStoreConfig] = useState({ is_forced_closed: false });
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE NAVEGACIÓN Y FILTROS ---
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isHoursOpen, setIsHoursOpen] = useState(false);

  // --- ESTADO DEL MODAL DE PRODUCTO (GUSTOS / ADICIONALES) ---
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState({}); // { addon_id: cantidad }
  const [modalNotes, setModalNotes] = useState('');

  // --- ESTADO DEL CARRITO ---
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // --- FORMULARIO DE CHECKOUT ---
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [customerNotes, setCustomerNotes] = useState('');

  // 1. CARGA DE DATOS DESDE SUPABASE
  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);

      try {
        // Cargar Categorías
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true });

        if (catData && catData.length > 0) {
          setCategories(catData);
          setSelectedCategory(catData[0].id);
        }

        // Cargar Productos
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('available', true)
          .order('created_at', { ascending: false });

        if (prodData) setProducts(prodData);

        // Cargar Adicionales / Gustos
        const { data: addonsData } = await supabase
          .from('addons')
          .select('*')
          .eq('available', true);

        if (addonsData) setAddons(addonsData);

        // Cargar Relación Producto <-> Adicionales
        const { data: paData } = await supabase
          .from('product_addons')
          .select('*');

        if (paData) setProductAddons(paData);

        // Cargar Estado del Local
        const { data: configData } = await supabase
          .from('store_config')
          .select('*')
          .eq('id', 1)
          .single();

        if (configData) setStoreConfig(configData);
      } catch (error) {
        console.error('Error cargando datos de Supabase:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAllData();
  }, []);

  // 2. CÁLCULO DE HORARIOS Y ESTADO DEL LOCAL
  const isOpenNow = useMemo(() => {
    if (storeConfig?.is_forced_closed) return false;

    const now = new Date();
    const day = now.getDay(); // 0 = Dom, 1 = Lun, 2 = Mar, ..., 6 = Sáb
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hour * 60 + minutes;

    // CERRADO: Domingo (0) y Lunes (1)
    if (day === 0 || day === 1) return false;

    // Martes a Sábado (2 a 6): 11:30 - 14:30 y 19:30 - 22:30
    const turn1Start = 11 * 60 + 30; // 11:30
    const turn1End = 14 * 60 + 30;   // 14:30
    const turn2Start = 19 * 60 + 30; // 19:30
    const turn2End = 22 * 60 + 30;   // 22:30

    const inTurn1 = currentTime >= turn1Start && currentTime <= turn1End;
    const inTurn2 = currentTime >= turn2Start && currentTime <= turn2End;

    return inTurn1 || inTurn2;
  }, [storeConfig]);

  // 3. ABRIR MODAL DE PRODUCTO O AGREGAR DIRECTO
  const handleProductClick = (product) => {
    if (!isOpenNow) return;

    // Buscar si el producto tiene adicionales asociados
    const linkedAddonIds = productAddons
      .filter((pa) => pa.product_id === product.id)
      .map((pa) => pa.addon_id);

    const availableProductAddons = addons.filter((a) => linkedAddonIds.includes(a.id));

    if (product.allows_flavor_selection || availableProductAddons.length > 0) {
      setSelectedProduct(product);
      setModalQuantity(1);
      setSelectedAddons({});
      setModalNotes('');
    } else {
      // Agregar directamente si no tiene opciones
      addToCartDirect(product);
    }
  };

  const addToCartDirect = (product) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.id === product.id && Object.keys(item.selectedAddons || {}).length === 0
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += 1;
        return updated;
      }

      return [
        ...prevCart,
        {
          cartItemId: `${product.id}-${Date.now()}`,
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          selectedAddons: {},
          addonDetails: [],
          notes: '',
        },
      ];
    });
  };

  // 4. LÓGICA DEL MODAL DE SELECCIÓN DE GUSTOS / ADICIONALES
  const availableModalAddons = useMemo(() => {
    if (!selectedProduct) return [];
    const linkedAddonIds = productAddons
      .filter((pa) => pa.product_id === selectedProduct.id)
      .map((pa) => pa.addon_id);
    return addons.filter((a) => linkedAddonIds.includes(a.id));
  }, [selectedProduct, productAddons, addons]);

  const totalAddonsSelectedCount = useMemo(() => {
    return Object.values(selectedAddons).reduce((acc, qty) => acc + qty, 0);
  }, [selectedAddons]);

  const handleAddonQuantityChange = (addonId, delta) => {
    const currentQty = selectedAddons[addonId] || 0;
    const newQty = currentQty + delta;

    if (newQty < 0) return;

    if (delta > 0 && selectedProduct?.allows_flavor_selection) {
      const maxAllowed = selectedProduct.max_flavors || 1;
      if (totalAddonsSelectedCount + 1 > maxAllowed) return;

      if (!selectedProduct.allow_flavor_repetition && newQty > 1) return;
    }

    setSelectedAddons((prev) => {
      const updated = { ...prev };
      if (newQty === 0) {
        delete updated[addonId];
      } else {
        updated[addonId] = newQty;
      }
      return updated;
    });
  };

  const calculatedModalUnitPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    let base = Number(selectedProduct.price);

    Object.entries(selectedAddons).forEach(([addonId, qty]) => {
      const addon = addons.find((a) => a.id === addonId);
      if (addon) {
        base += Number(addon.price) * qty;
      }
    });

    return base;
  }, [selectedProduct, selectedAddons, addons]);

  const confirmAddToCartFromModal = () => {
    if (!selectedProduct || !isOpenNow) return;

    if (
      selectedProduct.allows_flavor_selection &&
      totalAddonsSelectedCount < (selectedProduct.max_flavors || 1)
    ) {
      alert(`Por favor seleccioná ${selectedProduct.max_flavors} gustos para continuar.`);
      return;
    }

    const addonDetails = Object.entries(selectedAddons).map(([addonId, qty]) => {
      const addon = addons.find((a) => a.id === addonId);
      return {
        id: addonId,
        name: addon ? addon.name : '',
        quantity: qty,
        price: addon ? Number(addon.price) : 0,
      };
    });

    setCart((prevCart) => [
      ...prevCart,
      {
        cartItemId: `${selectedProduct.id}-${Date.now()}`,
        id: selectedProduct.id,
        name: selectedProduct.name,
        price: calculatedModalUnitPrice,
        quantity: modalQuantity,
        selectedAddons,
        addonDetails,
        notes: modalNotes,
      },
    ]);

    setSelectedProduct(null);
  };

  // 5. GESTIÓN DEL CARRITO DE COMPRAS
  const updateCartQuantity = (cartItemId, delta) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  // 6. ENVÍO DE PEDIDO A WHATSAPP
  const sendWhatsAppOrder = (e) => {
    e.preventDefault();

    if (!isOpenNow) {
      alert('El local se encuentra cerrado en este momento.');
      return;
    }

    if (cart.length === 0) {
      alert('El carrito está vacío.');
      return;
    }

    if (!customerName.trim() || !customerAddress.trim()) {
      alert('Por favor completa tu nombre y dirección.');
      return;
    }

    let message = `*¡Nuevo Pedido - Como en Casa!* 🍽️\n\n`;
    message += `👤 *Cliente:* ${customerName.trim()}\n`;
    message += `📍 *Dirección:* ${customerAddress.trim()}\n`;
    message += `💳 *Forma de pago:* ${paymentMethod}\n`;
    if (customerNotes.trim()) {
      message += `📝 *Aclaraciones:* ${customerNotes.trim()}\n`;
    }
    message += `\n-------------------------------\n`;
    message += `*DETALLE DEL PEDIDO:*\n\n`;

    cart.forEach((item) => {
      message += `• *${item.quantity}x ${item.name}* ($${(item.price * item.quantity).toLocaleString('es-AR')})\n`;

      if (item.addonDetails && item.addonDetails.length > 0) {
        item.addonDetails.forEach((addon) => {
          message += `   └ ${addon.quantity}x ${addon.name}\n`;
        });
      }

      if (item.notes) {
        message += `   └ _Nota: ${item.notes}_\n`;
      }
    });

    message += `\n-------------------------------\n`;
    message += `*TOTAL A PAGAR: $${cartTotal.toLocaleString('es-AR')}*`;

    const phoneNumber = '5492230000000'; // Reemplazar por el WhatsApp oficial
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
  };

  // Productos filtrados por categoría
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-28 font-sans">
      {/* HEADER PRINCIPAL */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-md">
              CC
            </div>
            <div>
              <h1 className="font-black text-xl text-red-600 tracking-tight leading-none">
                COMO EN CASA
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">Simplificamos tu vida cocinándote</p>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-2xl shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="text-xs font-black hidden sm:inline uppercase tracking-wider">Carrito</span>
            <span className="text-lg">🛒</span>
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-slate-900 font-black text-xs w-5 h-5 rounded-full flex items-center justify-center shadow">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* INFORMACIÓN Y ESTADO DEL LOCAL */}
      <section className="max-w-4xl mx-auto px-4 mt-4">
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          {/* Horarios */}
          <div className="relative flex-1 w-full md:w-auto">
            <button
              onClick={() => setIsHoursOpen(!isHoursOpen)}
              className="flex items-center gap-3 text-left w-full focus:outline-none"
            >
              <div className="p-2.5 bg-slate-100 rounded-2xl text-slate-600 text-xl">🕒</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">Horarios</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      isOpenNow ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {isOpenNow ? 'Abierto' : 'Cerrado'}
                  </span>
                  <span className="text-xs text-slate-400">▼</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mar a Sáb 11:30-14:30 / 19:30-22:30 hs
                </p>
              </div>
            </button>

            {/* Desplegable de Horarios */}
            {isHoursOpen && (
              <div className="absolute top-14 left-0 right-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl z-20 text-xs space-y-1">
                <p className="font-bold text-slate-800 border-b pb-1">Horarios Semanales:</p>
                <div className="flex justify-between text-slate-600">
                  <span>Martes a Sábado:</span>
                  <span className="font-semibold">11:30 - 14:30 | 19:30 - 22:30</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Domingo y Lunes:</span>
                  <span className="font-semibold">Cerrado</span>
                </div>
              </div>
            )}
          </div>

          {/* Ubicación y Mapa */}
          <div className="flex items-center justify-between gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 rounded-2xl text-slate-600 text-xl">📍</div>
              <div>
                <span className="font-extrabold text-sm block">Dónde estamos</span>
                <p className="text-xs text-slate-500">Juan Angel Peña 3892, Mar del Plata</p>
              </div>
            </div>

            <button
              onClick={() => setIsMapOpen(true)}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs px-3 py-2 rounded-xl transition-all"
            >
              Ver Mapa
            </button>
          </div>
        </div>
      </section>

      {/* BARRA DE CATEGORÍAS */}
      <nav className="max-w-4xl mx-auto px-4 mt-6 sticky top-16 z-20 bg-slate-100/90 backdrop-blur-md py-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-md shadow-red-200 scale-105'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{cat.icon || '🏷️'}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* LISTADO DE PRODUCTOS */}
      <main className="max-w-4xl mx-auto px-4 mt-4">
        {loading ? (
          <div className="text-center py-20 text-slate-400 font-medium">
            Cargando nuestro menú delicioso...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-medium bg-white rounded-3xl border border-slate-200">
            No hay platos disponibles en esta categoría.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-3xl p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="flex gap-3 items-start">
                  <img
                    src={product.image_url || '/logo.jpg'}
                    alt={product.name}
                    className="w-20 h-20 rounded-2xl object-cover bg-slate-100 flex-shrink-0"
                    onError={(e) => {
                      e.target.src = '/logo.jpg';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-sm text-slate-900 truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {product.description || 'Deliciosa preparación casera recién hecha.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <span className="font-black text-slate-900 text-sm">
                    ${Number(product.price).toLocaleString('es-AR')}
                  </span>

                  <button
                    onClick={() => handleProductClick(product)}
                    disabled={!isOpenNow}
                    className={`text-xs px-3.5 py-1.5 rounded-xl font-extrabold transition-all shadow-sm flex-shrink-0 ${
                      isOpenNow
                        ? 'bg-red-600 hover:bg-red-700 active:scale-95 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                    }`}
                  >
                    {isOpenNow ? '+ Agregar' : 'Cerrado'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL DE SELECCIÓN DE PRODUCTO (GUSTOS / ADICIONALES) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-base text-slate-900">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500">${Number(selectedProduct.price).toLocaleString('es-AR')}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center hover:bg-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Opciones de Gustos o Adicionales */}
              {availableModalAddons.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">
                      {selectedProduct.allows_flavor_selection ? 'Seleccioná los Gustos' : 'Adicionales'}
                    </h4>
                    {selectedProduct.allows_flavor_selection && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">
                        {totalAddonsSelectedCount} / {selectedProduct.max_flavors || 1}
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {availableModalAddons.map((addon) => {
                      const qty = selectedAddons[addon.id] || 0;
                      return (
                        <div key={addon.id} className="p-3 flex items-center justify-between bg-white">
                          <div>
                            <p className="font-bold text-xs text-slate-800">{addon.name}</p>
                            {Number(addon.price) > 0 && (
                              <p className="text-xs text-slate-500">+${Number(addon.price).toLocaleString('es-AR')}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                            <button
                              onClick={() => handleAddonQuantityChange(addon.id, -1)}
                              className="w-6 h-6 bg-white rounded-lg font-black text-xs text-slate-700 shadow-sm flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="text-xs font-black px-1">{qty}</span>
                            <button
                              onClick={() => handleAddonQuantityChange(addon.id, 1)}
                              className="w-6 h-6 bg-white rounded-lg font-black text-xs text-slate-700 shadow-sm flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cantidad total de esta variedad */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Cantidad</span>
                <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                    className="w-8 h-8 bg-white rounded-xl font-black text-sm text-slate-800 shadow-sm flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-black text-sm px-2">{modalQuantity}</span>
                  <button
                    onClick={() => setModalQuantity(modalQuantity + 1)}
                    className="w-8 h-8 bg-white rounded-xl font-black text-sm text-slate-800 shadow-sm flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Notas del producto */}
              <div>
                <label className="block font-extrabold text-xs text-slate-700 uppercase tracking-wider mb-1">
                  Notas / Especificaciones
                </label>
                <textarea
                  placeholder="Ej: Bien cocido / Sin salsa"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs text-slate-500 block">Subtotal</span>
                <span className="font-black text-lg text-slate-900">
                  ${(calculatedModalUnitPrice * modalQuantity).toLocaleString('es-AR')}
                </span>
              </div>

              <button
                onClick={confirmAddToCartFromModal}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95"
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAPA MODAL */}
      {isMapOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-sm">Nuestra Ubicación</h3>
              <button
                onClick={() => setIsMapOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 font-bold text-xs"
              >
                ✕
              </button>
            </div>
            <div className="w-full h-64 rounded-2xl overflow-hidden bg-slate-100">
              <iframe
                title="Ubicacion Como en Casa"
                src="https://maps.google.com/maps?q=Juan%20Angel%20Pe%C3%B1a%203892,%20Mar%20del%20Plata&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* BARRA FLOTANTE INFERIOR DEL CARRITO */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-30">
          <div className="max-w-xl mx-auto bg-slate-900 text-white rounded-3xl p-3 shadow-2xl flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-3 pl-2">
              <span className="bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-xl">
                {cart.reduce((a, b) => a + b.quantity, 0)} items
              </span>
              <span className="font-black text-sm">
                ${cartTotal.toLocaleString('es-AR')}
              </span>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-5 py-2.5 rounded-2xl transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Ver Pedido</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      )}

      {/* DRAWER DEL CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-y-auto p-5 animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h2 className="font-black text-lg text-slate-900">Tu Pedido</h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-medium">
                  Tu carrito está vacío.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 my-4">
                  {cart.map((item) => (
                    <div key={item.cartItemId} className="py-3 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-extrabold text-sm text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          ${(item.price * item.quantity).toLocaleString('es-AR')}
                        </p>

                        {/* Gustos o Adicionales seleccionados */}
                        {item.addonDetails && item.addonDetails.length > 0 && (
                          <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                            {item.addonDetails.map((a, idx) => (
                              <p key={idx}>• {a.quantity}x {a.name}</p>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <p className="text-xs italic text-slate-400 mt-0.5">"{item.notes}"</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                        <button
                          onClick={() => updateCartQuantity(item.cartItemId, -1)}
                          className="w-6 h-6 bg-white rounded-lg font-black text-slate-700 text-xs shadow-sm flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="font-black text-xs text-slate-900 px-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.cartItemId, 1)}
                          className="w-6 h-6 bg-white rounded-lg font-black text-slate-700 text-xs shadow-sm flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* FORMULARIO DE ENVÍO */}
              {cart.length > 0 && (
                <form onSubmit={sendWhatsAppOrder} className="space-y-3 mt-6 pt-4 border-t border-slate-200">
                  <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">
                    Datos de Entrega
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Pérez"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Dirección de Envío *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Jujuy 1234, 2° B"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Forma de Pago</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia / MP">Transferencia / Mercado Pago</option>
                      <option value="Débito / Crédito">Débito / Crédito</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Aclaraciones generales</label>
                    <textarea
                      placeholder="Ej: Timbre ruidoso / Traer cambio de $20.000"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-extrabold text-sm text-slate-700">Total a Pagar:</span>
                      <span className="font-black text-lg text-slate-900">
                        ${cartTotal.toLocaleString('es-AR')}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={!isOpenNow}
                      className={`w-full py-3.5 rounded-2xl font-black text-xs text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                        isOpenNow
                          ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span>{isOpenNow ? 'Enviar Pedido por WhatsApp' : 'Local Cerrado'}</span>
                      {isOpenNow && <span>📲</span>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
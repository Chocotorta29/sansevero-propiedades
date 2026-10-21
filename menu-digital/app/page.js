'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productAddonsMap, setProductAddonsMap] = useState({});
  const [allAddonsMap, setAllAddonsMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estado de apertura manual y fecha actual montada en cliente
  const [isForcedClosed, setIsForcedClosed] = useState(false);
  const [now, setNow] = useState(null);

  // Desplegable Horarios
  const [isHoursOpen, setIsHoursOpen] = useState(false);

  // Modal de Producto
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [availableAddons, setAvailableAddons] = useState([]);
  const [itemNotes, setItemNotes] = useState('');

  // Estructura por cada unidad (para platos no-empanada)
  const [unitsData, setUnitsData] = useState([]);
  const [openUnitIndex, setOpenUnitIndex] = useState(0);

  // Selección acumulada unificada (para Empanadas)
  const [empFlavors, setEmpFlavors] = useState({});

  // Datos Pedido
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('Delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');

  // DATOS DEL NEGOCIO: COMO EN CASA
  const PHONE_NUMBER = '5492236036415';

  const schedule = useMemo(() => [
    { day: 'Lunes', dayIndex: 1, closed: true },
    { day: 'Martes', dayIndex: 2, open1: '11:30', close1: '14:30', open2: '19:30', close2: '22:30' },
    { day: 'Miércoles', dayIndex: 3, open1: '11:30', close1: '14:30', open2: '19:30', close2: '22:30' },
    { day: 'Jueves', dayIndex: 4, open1: '11:30', close1: '14:30', open2: '19:30', close2: '22:30' },
    { day: 'Viernes', dayIndex: 5, open1: '11:30', close1: '14:30', open2: '19:30', close2: '22:30' },
    { day: 'Sábado', dayIndex: 6, open1: '11:30', close1: '14:30', open2: '19:30', close2: '22:30' },
    { day: 'Domingo', dayIndex: 0, open1: '11:30', close1: '14:30', singleShift: true },
  ], []);

  // Inicializar la hora del cliente tras el montaje
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // EVALUAR SI EL LOCAL ESTÁ ABIERTO EN TIEMPO REAL (SOLO CLIENTE)
  const isOpenNow = useMemo(() => {
    if (isForcedClosed) return false;
    if (!now) return false;

    const currentDayIndex = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayConfig = schedule.find((s) => s.dayIndex === currentDayIndex);
    if (!todayConfig || todayConfig.closed) return false;

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const o1 = timeToMinutes(todayConfig.open1);
    const c1 = timeToMinutes(todayConfig.close1);
    const inShift1 = currentMinutes >= o1 && currentMinutes <= c1;

    if (inShift1) return true;

    if (!todayConfig.singleShift && todayConfig.open2 && todayConfig.close2) {
      const o2 = timeToMinutes(todayConfig.open2);
      const c2 = timeToMinutes(todayConfig.close2);
      return currentMinutes >= o2 && currentMinutes <= c2;
    }

    return false;
  }, [isForcedClosed, now, schedule]);

  useEffect(() => {
    fetchMenuData();
    fetchStoreConfig();
  }, []);

  async function fetchStoreConfig() {
    try {
      const { data } = await supabase.from('store_config').select('is_forced_closed').eq('id', 1).single();
      if (data) {
        setIsForcedClosed(data.is_forced_closed || false);
      }
    } catch (err) {
      console.error('Error al cargar config:', err);
    }
  }

  async function fetchMenuData() {
    setLoading(true);
    try {
      const [
        { data: cats },
        { data: prods },
        { data: addonsData },
        { data: prodAddonsData }
      ] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*').eq('available', true),
        supabase.from('addons').select('*').eq('available', true),
        supabase.from('product_addons').select('*')
      ]);

      if (cats && cats.length > 0) {
        const customOrder = [
          'sugerencias',
          'pastas',
          'milanesas',
          'hamburguesas',
          'ensaladas',
          'tartas',
          'pizzas',
          'empanadas',
          'postres',
          'promociones'
        ];

        const sortedCats = [...cats].sort((a, b) => {
          const nameA = a.name.toLowerCase().trim();
          const nameB = b.name.toLowerCase().trim();

          let indexA = customOrder.findIndex((item) => nameA.includes(item));
          let indexB = customOrder.findIndex((item) => nameB.includes(item));

          if (indexA === -1) indexA = 99;
          if (indexB === -1) indexB = 99;

          return indexA - indexB;
        });

        setCategories(sortedCats);
        setSelectedCategory(sortedCats[0].id);
      }

      if (prods) setProducts(prods);

      const addonsById = {};
      if (addonsData) {
        addonsData.forEach((a) => {
          addonsById[a.id] = a;
        });
        setAllAddonsMap(addonsById);
      }

      const map = {};
      if (prodAddonsData) {
        prodAddonsData.forEach((rel) => {
          if (!map[rel.product_id]) map[rel.product_id] = [];
          if (addonsById[rel.addon_id]) {
            map[rel.product_id].push(addonsById[rel.addon_id]);
          }
        });
      }
      setProductAddonsMap(map);

    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  }

  const isEmpanadaProduct = useCallback((product) => {
    if (!product) return false;
    const prodName = product.name.toLowerCase();
    const catObj = categories.find((c) => c.id === product.category_id);
    const catName = (catObj?.name || '').toLowerCase();
    return prodName.includes('empanada') || catName.includes('empanada');
  }, [categories]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  const openProductModal = useCallback((product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
    setUnitsData([{ selectedAddons: [], flavorQuantities: {} }]);
    setOpenUnitIndex(0);
    setEmpFlavors({});
    setItemNotes('');

    const addons = productAddonsMap[product.id] || [];
    setAvailableAddons(addons);
  }, [productAddonsMap]);

  const handleQuantityChange = useCallback((newQty) => {
    if (newQty < 1) return;
    setProductQuantity(newQty);

    setUnitsData((prev) => {
      if (newQty > prev.length) {
        const extra = Array.from({ length: newQty - prev.length }, () => ({
          selectedAddons: [],
          flavorQuantities: {}
        }));
        return [...prev, ...extra];
      } else {
        return prev.slice(0, newQty);
      }
    });

    setOpenUnitIndex((prev) => (prev >= newQty ? newQty - 1 : prev));
  }, []);

  const totalEmpanadaLimit = useMemo(() => {
    if (!selectedProduct) return 0;
    const baseMax = selectedProduct.max_flavors || 1;
    return baseMax * productQuantity;
  }, [selectedProduct, productQuantity]);

  const currentEmpFlavorsCount = useMemo(() => {
    return Object.values(empFlavors).reduce((s, qty) => s + qty, 0);
  }, [empFlavors]);

  const updateEmpanadaFlavorQuantity = useCallback((addonId, delta) => {
    setEmpFlavors((prev) => {
      const current = prev[addonId] || 0;
      let next = current + delta;

      if (delta > 0 && currentEmpFlavorsCount >= totalEmpanadaLimit) {
        return prev;
      }

      next = Math.max(0, next);
      const updated = { ...prev };

      if (next === 0) {
        delete updated[addonId];
      } else {
        updated[addonId] = next;
      }

      return updated;
    });
  }, [currentEmpFlavorsCount, totalEmpanadaLimit]);

  const updateFlavorQuantityForUnit = useCallback((unitIndex, addonId, delta) => {
    if (!selectedProduct) return;

    setUnitsData((prev) => {
      const updated = [...prev];
      const unit = { ...updated[unitIndex] };
      const flavorMap = { ...unit.flavorQuantities };

      const current = flavorMap[addonId] || 0;
      let next = current + delta;

      const addon = availableAddons.find((a) => a.id === addonId) || allAddonsMap[addonId];
      const groupName = (addon?.category || '').toLowerCase();

      const maxFlavorsUnit = selectedProduct.max_flavors || 0;
      const allowRepetition = selectedProduct.allow_flavor_repetition ?? true;

      if (!allowRepetition && delta > 0 && current >= 1) {
        return prev;
      }

      const isCarneGroup = groupName.includes('tipo de carne') || groupName === 'carne' || groupName === 'tipo';
      if (isCarneGroup && delta > 0) {
        Object.keys(flavorMap).forEach((id) => {
          const item = availableAddons.find((a) => a.id === id) || allAddonsMap[id];
          const cat = (item?.category || '').toLowerCase();
          if (cat.includes('tipo de carne') || cat === 'carne' || cat === 'tipo') {
            delete flavorMap[id];
          }
        });
        next = 1;
      }

      if (maxFlavorsUnit > 0 && delta > 0 && !isCarneGroup) {
        const groupAddons = availableAddons.filter((a) => (a.category || '').toLowerCase() === groupName);
        const currentGroupTotal = groupAddons.reduce((s, a) => s + (flavorMap[a.id] || 0), 0);

        if (currentGroupTotal >= maxFlavorsUnit) {
          return prev;
        }
      }

      next = Math.max(0, next);

      if (next === 0) {
        delete flavorMap[addonId];
      } else {
        flavorMap[addonId] = next;
      }

      unit.flavorQuantities = flavorMap;
      updated[unitIndex] = unit;

      return updated;
    });
  }, [selectedProduct, availableAddons, allAddonsMap]);

  const isAllUnitsValid = useCallback(() => {
    if (!selectedProduct) return false;
    if (!selectedProduct.allows_flavor_selection) return true;

    if (isEmpanadaProduct(selectedProduct)) {
      return currentEmpFlavorsCount === totalEmpanadaLimit;
    }

    const groups = availableAddons.reduce((acc, a) => {
      const cat = a.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(a);
      return acc;
    }, {});

    return unitsData.every((unit) => {
      return Object.entries(groups).every(([groupName, groupItems]) => {
        const lowerName = groupName.toLowerCase();
        const selectedInGroup = groupItems.reduce((sum, item) => sum + (unit.flavorQuantities[item.id] || 0), 0);

        const isOpcionalGroup = lowerName.includes('guarnicion') || lowerName.includes('guarnición') || lowerName.includes('salsa');
        if (isOpcionalGroup) {
          const maxLimit = selectedProduct.max_flavors || 0;
          return maxLimit === 0 ? true : selectedInGroup <= maxLimit;
        }

        if (lowerName.includes('tipo de carne') || lowerName === 'carne' || lowerName === 'tipo') {
          return selectedInGroup === 1;
        }

        const maxLimit = selectedProduct.max_flavors || 0;
        if (maxLimit === 0) {
          return selectedInGroup >= 1;
        }

        return selectedInGroup >= 1 && selectedInGroup <= maxLimit;
      });
    });
  }, [selectedProduct, availableAddons, unitsData, isEmpanadaProduct, currentEmpFlavorsCount, totalEmpanadaLimit]);

  const calculateTotalPrice = useCallback(() => {
    if (!selectedProduct) return 0;
    const base = Number(selectedProduct.price) || 0;

    if (isEmpanadaProduct(selectedProduct)) {
      const empAddonsCost = Object.entries(empFlavors).reduce((s, [addonId, qty]) => {
        const addon = availableAddons.find((a) => a.id === addonId) || allAddonsMap[addonId];
        return s + (addon ? Number(addon.price) * qty : 0);
      }, 0);

      return base * productQuantity + empAddonsCost;
    }

    const addonsTotal = unitsData.reduce((sum, unit) => {
      const unitAddons = unit.selectedAddons.reduce((s, a) => s + Number(a.price), 0);
      
      const unitFlavorsCost = Object.entries(unit.flavorQuantities).reduce((s, [addonId, qty]) => {
        const addon = availableAddons.find((a) => a.id === addonId) || allAddonsMap[addonId];
        return s + (addon ? Number(addon.price) * qty : 0);
      }, 0);

      return sum + unitAddons + unitFlavorsCost;
    }, 0);

    return base * productQuantity + addonsTotal;
  }, [selectedProduct, unitsData, productQuantity, availableAddons, allAddonsMap, isEmpanadaProduct, empFlavors]);

  const handleConfirmAddToCart = () => {
    if (!selectedProduct || !isAllUnitsValid()) return;

    const totalPrice = calculateTotalPrice();
    let formattedUnits = [];

    if (isEmpanadaProduct(selectedProduct)) {
      const flavorsList = Object.entries(empFlavors).map(([addonId, qty]) => {
        const addon = availableAddons.find((a) => a.id === addonId) || allAddonsMap[addonId];
        return { name: addon ? addon.name : '', qty };
      });
      formattedUnits = [{ flavors: flavorsList, addons: [] }];
    } else {
      formattedUnits = unitsData.map((unit) => {
        const flavorsList = Object.entries(unit.flavorQuantities).map(([addonId, qty]) => {
          const addon = availableAddons.find((a) => a.id === addonId) || allAddonsMap[addonId];
          return { name: addon ? addon.name : '', qty };
        });

        return {
          flavors: flavorsList,
          addons: unit.selectedAddons
        };
      });
    }

    const cartItemId = `${selectedProduct.id}-${JSON.stringify(isEmpanadaProduct(selectedProduct) ? empFlavors : unitsData)}-${itemNotes.trim()}`;

    const cartItem = {
      cartItemId,
      id: selectedProduct.id,
      name: selectedProduct.name,
      basePrice: Number(selectedProduct.price) || 0,
      price: totalPrice / productQuantity,
      totalPrice: totalPrice,
      quantity: productQuantity,
      units: formattedUnits,
      notes: itemNotes.trim()
    };

    setCart((prev) => [...prev, cartItem]);
    setSelectedProduct(null);
  };

  const updateQuantityInCart = useCallback((cartItemId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const unitPrice = item.totalPrice / item.quantity;
            return {
              ...item,
              quantity: newQty,
              totalPrice: unitPrice * newQty
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  }, []);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const sendWhatsAppOrder = (e) => {
    e.preventDefault();
    if (cart.length === 0 || !customerName) return;

    let text = `*NUEVO PEDIDO - COMO EN CASA*\n`;
    text += `---------------------------------\n`;
    text += `👤 *Cliente:* ${customerName}\n`;
    text += `🛵 *Tipo:* ${orderType}\n`;
    if (orderType === 'Delivery') {
      text += `📍 *Dirección:* ${address}\n`;
    }
    text += `💳 *Pago:* ${paymentMethod}\n`;
    text += `---------------------------------\n`;
    text += `*DETALLE DEL PEDIDO:*\n`;

    cart.forEach((item) => {
      text += `• ${item.quantity}x ${item.name} ($${item.totalPrice.toLocaleString()})\n`;

      item.units.forEach((u, i) => {
        const parts = [];
        if (u.flavors && u.flavors.length > 0) {
          const fStr = u.flavors.map((f) => f.qty > 1 ? `${f.qty}x ${f.name}` : f.name).join(', ');
          parts.push(`Gustos: ${fStr}`);
        }
        if (u.addons && u.addons.length > 0) {
          const aStr = u.addons.map((a) => a.name).join(', ');
          parts.push(`Adicionales: ${aStr}`);
        }

        if (parts.length > 0) {
          text += `   ↳ ${parts.join(' | ')}\n`;
        }
      });

      if (item.notes) {
        text += `   ↳ Nota: "${item.notes}"\n`;
      }
    });

    text += `---------------------------------\n`;
    text += `💰 *TOTAL: $${cartTotal.toLocaleString()}*`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${PHONE_NUMBER}?text=${encodedText}`, '_blank');
  };

  const modalGroupedAddons = useMemo(() => {
    return availableAddons.reduce((acc, addon) => {
      const cat = addon.category?.trim() || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(addon);
      return acc;
    }, {});
  }, [availableAddons]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans selection:bg-red-600 selection:text-white">
      
      {/* HEADER PRINCIPAL */}
      <header className="relative w-full h-72 md:h-80 flex items-center justify-center text-center overflow-hidden border-b border-red-200 shadow-lg">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{ backgroundImage: `url('/encabezado.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-white/50 backdrop-blur-[1px]" />
        
        <div className="relative z-10 px-4 max-w-xl mx-auto flex flex-col items-center">
          <span className="text-[10px] md:text-xs font-extrabold tracking-[0.2em] text-red-700 uppercase bg-red-100/90 px-4 py-1 rounded-full border border-red-300 mb-3 backdrop-blur-md shadow-sm">
            Comida Casera
          </span>

          <div className="flex items-center justify-center gap-3">
            <img
              src="/logo.jpg"
              alt="Logo Como en Casa"
              className="h-12 w-12 md:h-16 md:w-16 object-cover rounded-2xl shadow-md border-2 border-red-600 flex-shrink-0"
            />
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-red-700 uppercase drop-shadow-sm leading-none">
              Como en casa
            </h1>
          </div>

          <p className="text-xs md:text-sm text-slate-700 font-semibold tracking-wide mt-2">
            Simplificamos tu vida cocinándote
          </p>
        </div>
      </header>

      {/* HORARIOS Y UBICACIÓN CON ESTADO ABIERTO/CERRADO REAL */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          
          <div className="w-full">
            <button
              onClick={() => setIsHoursOpen(!isHoursOpen)}
              className="w-full flex items-center justify-between gap-2 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors bg-slate-50 p-3 rounded-xl border border-slate-200"
            >
              <div className="flex items-center gap-2 text-left">
                <span className="text-base">🕒</span>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900">Horarios</strong>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isOpenNow
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-red-100 text-red-700 border-red-300'
                    }`}>
                      {isOpenNow ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mar a Sáb 11:30-14:30 / 19:30-22:30 hs
                  </p>
                </div>
              </div>
              <span className={`text-[10px] text-slate-500 transition-transform duration-200 ${isHoursOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {isHoursOpen && (
              <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 grid gap-1.5 text-xs">
                {schedule.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-1 px-2 rounded-lg hover:bg-slate-100">
                    <span className="font-bold text-slate-800 text-[11px]">{item.day}</span>
                    <span className="text-slate-600 font-mono text-[10px]">
                      {item.closed
                        ? 'Cerrado'
                        : item.singleShift
                        ? `${item.open1} a ${item.close1} hs`
                        : `${item.open1} a ${item.close1} hs y ${item.open2} a ${item.close2} hs`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full flex flex-col justify-between h-full">
            <div className="mb-2">
              <p className="text-[11px] text-slate-500 font-medium">Dónde estamos</p>
              <h3 className="text-xs font-bold text-red-700 flex items-center gap-1">📍 Juan Angel Peña 3892, Mar del Plata</h3>
            </div>
            <div className="relative w-full h-24 rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
              <iframe
                title="Ubicación Como en casa"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3145.4265147986065!2d-57.5512329!3d-37.9834715!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzc3NTknNTYuOSJTIDU3wrAzMyc0MC4zIlc!5e0!3m2!1ses!2sar!4v1680000000000!5m2!1ses!2sar"
                className="w-full h-full border-0 grayscale group-hover:grayscale-0 transition-all duration-300 pointer-events-none"
                loading="lazy"
              ></iframe>
              <a
                href="https://maps.app.goo.gl/PLr6YzkZ1rh5wu8aA"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 bg-red-950/20 hover:bg-red-950/10 flex items-center justify-center transition-all"
              >
                <span className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 scale-95 hover:scale-100 transition-all">
                  <span>📍</span>
                  <span>Abrir Maps</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PESTAÑAS DE CATEGORÍAS CENTRADAS */}
      <div className="sticky top-0 bg-slate-50/95 backdrop-blur-md shadow-sm z-10 py-3.5 border-b border-slate-200 my-4 w-full">
        <div className="flex space-x-2.5 w-full px-6 overflow-x-auto scrollbar-none justify-start md:justify-center items-center">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 border flex-shrink-0 ${
                  isSelected
                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20 scale-105'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{cat.icon || '🏷️'}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GRILLA DE PRODUCTOS */}
      <main className="max-w-6xl mx-auto px-4 mt-4">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-9 h-9 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500">Cargando la mejor comida casera...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">No hay platos disponibles en esta categoría.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const priceNum = Number(product.price) || 0;
              const hasPrice = priceNum > 0;

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-sm flex gap-3 hover:border-red-300 transition-all items-center justify-between"
                >
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-xl bg-slate-100 flex-shrink-0 shadow-inner"
                  />
                  <div className="flex flex-col justify-between flex-1 ml-3 min-w-0 h-full">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{product.name}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">{product.description}</p>
                    </div>
                    <div className="flex justify-between items-center mt-3 gap-2">
                      {hasPrice ? (
                        <span className="font-extrabold text-sm md:text-base text-red-600 flex-shrink-0">
                          ${priceNum.toLocaleString()}
                        </span>
                      ) : (
                        <div />
                      )}
                      <button
                        onClick={() => openProductModal(product)}
                        className="text-xs px-3.5 py-1.5 rounded-xl font-extrabold transition-all shadow-sm flex-shrink-0 bg-red-600 hover:bg-red-700 active:scale-95 text-white ml-auto"
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL DE PERSONALIZACIÓN */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-sm flex justify-end flex-col animate-fadeIn">
          <div className="bg-white border-t border-slate-200 rounded-t-3xl p-5 max-w-md mx-auto w-full max-h-[92vh] overflow-y-auto text-slate-800 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                <div className="flex gap-3 items-center">
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-14 h-14 object-cover rounded-xl border border-slate-200"
                  />
                  <div>
                    <h3 className="font-black text-red-700 text-base leading-snug">{selectedProduct.name}</h3>
                    {Number(selectedProduct.price) > 0 && (
                      <p className="text-xs font-bold text-slate-600 mt-0.5">${Number(selectedProduct.price).toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-800 font-bold text-xl px-2">
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">{selectedProduct.description}</p>

              {/* VISTA PARA EMPANADAS (ACUMULABLE UNIFICADO) */}
              {isEmpanadaProduct(selectedProduct) ? (
                <div className="mt-5 space-y-3">
                  {Object.entries(modalGroupedAddons).map(([groupName, groupItems]) => (
                    <div key={groupName} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                          Elegí tus gustos ({currentEmpFlavorsCount} / {totalEmpanadaLimit})
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          currentEmpFlavorsCount === totalEmpanadaLimit
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-red-100 text-red-700 border-red-300'
                        }`}>
                          {currentEmpFlavorsCount === totalEmpanadaLimit
                            ? 'Completo'
                            : `Faltan ${totalEmpanadaLimit - currentEmpFlavorsCount}`}
                        </span>
                      </div>

                      <div className="grid gap-1.5 pt-1">
                        {groupItems.map((addon) => {
                          const qty = empFlavors[addon.id] || 0;
                          return (
                            <div
                              key={addon.id}
                              className={`flex justify-between items-center p-2 rounded-lg border text-xs font-semibold transition-all ${
                                qty > 0
                                  ? 'bg-red-50 border-red-300 text-red-900'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <div>
                                <span>{addon.name}</span>
                                {addon.price > 0 && (
                                  <span className="text-[10px] text-red-600 font-bold ml-1">
                                    (+${Number(addon.price).toLocaleString()})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1 border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => updateEmpanadaFlavorQuantity(addon.id, -1)}
                                  disabled={qty === 0}
                                  className="font-black text-red-600 disabled:opacity-30 text-sm px-1"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => updateEmpanadaFlavorQuantity(addon.id, 1)}
                                  disabled={currentEmpFlavorsCount >= totalEmpanadaLimit}
                                  className="font-black text-red-600 disabled:opacity-30 text-sm px-1"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* VISTA PARA OTROS PLATOS (DESGLOSADO POR UNIDAD) */
                <div className="mt-5 space-y-3">
                  {unitsData.map((unit, unitIdx) => {
                    const isOpen = openUnitIndex === unitIdx;
                    const isFlavorMode = selectedProduct.allows_flavor_selection;

                    return (
                      <div
                        key={unitIdx}
                        className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden transition-all shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenUnitIndex(isOpen ? -1 : unitIdx)}
                          className="w-full flex items-center justify-between p-3 bg-slate-100/70 hover:bg-slate-200/60 transition-colors text-left"
                        >
                          <span className="text-xs font-extrabold text-red-700">
                            {productQuantity > 1 ? `Unidad #${unitIdx + 1}` : 'Personalización de plato'}
                          </span>

                          <span className={`text-xs text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </button>

                        {isOpen && (
                          <div className="p-3 border-t border-slate-200 bg-white space-y-4">
                            {isFlavorMode && Object.keys(modalGroupedAddons).length > 0 ? (
                              Object.entries(modalGroupedAddons).map(([groupName, groupItems]) => {
                                const lowerGroup = groupName.toLowerCase();
                                const isGuarnicionOSalsa = lowerGroup.includes('guarnicion') || lowerGroup.includes('guarnición') || lowerGroup.includes('salsa');
                                const isCarneGroup = lowerGroup.includes('tipo de carne') || lowerGroup === 'carne' || lowerGroup === 'tipo';
                                
                                const selectedInGroup = groupItems.reduce((s, item) => s + (unit.flavorQuantities[item.id] || 0), 0);
                                const maxLimit = selectedProduct.max_flavors || 0;

                                let isGroupComplete = false;
                                if (isGuarnicionOSalsa) {
                                  isGroupComplete = maxLimit === 0 || selectedInGroup <= maxLimit;
                                } else if (isCarneGroup) {
                                  isGroupComplete = selectedInGroup === 1;
                                } else {
                                  isGroupComplete = maxLimit === 0 ? selectedInGroup >= 1 : (selectedInGroup >= 1 && selectedInGroup <= maxLimit);
                                }

                                return (
                                  <div key={groupName} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                        {groupName} {!isGuarnicionOSalsa && <span className="text-red-600">*</span>}
                                      </span>
                                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                        isGroupComplete
                                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                          : 'bg-red-100 text-red-700 border-red-300'
                                      }`}>
                                        {isGuarnicionOSalsa
                                          ? selectedInGroup === 0 ? 'Opcional' : `${selectedInGroup} elegido`
                                          : isCarneGroup
                                          ? selectedInGroup === 1 ? 'Elegido' : 'Obligatorio (1)'
                                          : selectedInGroup >= 1 ? `${selectedInGroup} elegido` : 'Obligatorio (mínimo 1)'}
                                      </span>
                                    </div>

                                    <div className="grid gap-1.5 pt-1">
                                      {groupItems.map((addon) => {
                                        const qty = unit.flavorQuantities[addon.id] || 0;
                                        return (
                                          <div
                                            key={addon.id}
                                            className={`flex justify-between items-center p-2 rounded-lg border text-xs font-semibold transition-all ${
                                              qty > 0
                                                ? 'bg-red-50 border-red-300 text-red-900'
                                                : 'bg-white border-slate-200 text-slate-700'
                                            }`}
                                          >
                                            <div>
                                              <span>{addon.name}</span>
                                              {addon.price > 0 && (
                                                <span className="text-[10px] text-red-600 font-bold ml-1">
                                                  (+${Number(addon.price).toLocaleString()})
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1 border border-slate-200">
                                              <button
                                                type="button"
                                                onClick={() => updateFlavorQuantityForUnit(unitIdx, addon.id, -1)}
                                                disabled={qty === 0}
                                                className="font-black text-red-600 disabled:opacity-30 text-sm px-1"
                                              >
                                                -
                                              </button>
                                              <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                              <button
                                                type="button"
                                                onClick={() => updateFlavorQuantityForUnit(unitIdx, addon.id, 1)}
                                                className="font-black text-red-600 disabled:opacity-30 text-sm px-1"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-slate-400 italic">Sin personalizaciones obligatorias.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Aclaraciones */}
              <div className="mt-5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Aclaraciones para el pedido
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sin sal, la ensalada bien condimentada..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-red-600 text-slate-800"
                />
              </div>
            </div>

            {/* Controles de Cantidad */}
            <div className="pt-5 border-t border-slate-200 mt-5 flex gap-3 items-center">
              <div className="flex items-center space-x-2 bg-slate-100 rounded-xl px-3 py-2 border border-slate-200">
                <button
                  onClick={() => handleQuantityChange(productQuantity - 1)}
                  className="font-black text-red-600 hover:text-red-700 px-1 text-base"
                >
                  -
                </button>
                <span className="text-xs font-bold w-5 text-center text-slate-900">{productQuantity}</span>
                <button
                  onClick={() => handleQuantityChange(productQuantity + 1)}
                  className="font-black text-red-600 hover:text-red-700 px-1 text-base"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleConfirmAddToCart}
                disabled={!isAllUnitsValid()}
                className={`flex-1 font-black py-3 px-4 rounded-xl shadow-md text-xs flex justify-between items-center transition-all ${
                  isAllUnitsValid()
                    ? 'bg-red-600 hover:bg-red-700 text-white active:scale-98'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <span>
                  {!isAllUnitsValid()
                    ? isEmpanadaProduct(selectedProduct)
                      ? `Completá las ${totalEmpanadaLimit} empanadas`
                      : 'Seleccioná la opción obligatoria'
                    : 'Agregar al Pedido'}
                </span>
                <span>${calculateTotalPrice().toLocaleString()}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE CARRITO */}
      {cart.length > 0 && (
        <div className="fixed bottom-5 left-0 right-0 px-4 z-20 max-w-md mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 px-6 rounded-2xl shadow-xl shadow-red-600/20 flex justify-between items-center font-black text-sm transition-transform active:scale-95"
          >
            <span className="bg-white text-red-600 px-2.5 py-1 rounded-lg text-xs font-black">
              {cart.reduce((a, b) => a + b.quantity, 0)} ítems
            </span>
            <span>Ver Mi Pedido</span>
            <span>${cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MODAL / CARRITO DE COMPRAS */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-md flex justify-end flex-col animate-fadeIn">
          <div className="bg-white border-t border-slate-200 rounded-t-3xl p-6 max-w-md mx-auto w-full max-h-[88vh] overflow-y-auto text-slate-800 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <h2 className="text-lg font-black text-red-700">Tu Pedido</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-slate-800 font-bold text-xl px-2">
                ✕
              </button>
            </div>

            <div className="py-4 divide-y divide-slate-100">
              {cart.map((item) => (
                <div key={item.cartItemId} className="flex justify-between items-start py-3">
                  <div className="pr-2">
                    <p className="font-bold text-sm text-slate-900">{item.name}</p>

                    {item.units &&
                      item.units.map((u, i) => {
                        const hasFlavors = u.flavors && u.flavors.length > 0;
                        const hasAddons = u.addons && u.addons.length > 0;
                        if (!hasFlavors && !hasAddons) return null;

                        return (
                          <div key={i} className="text-[11px] text-red-600 font-medium mt-0.5">
                            ↳ {hasFlavors && u.flavors.map((f) => (f.qty > 1 ? `${f.qty}x ${f.name}` : f.name)).join(', ')}
                            {hasFlavors && hasAddons ? ' | Extras: ' : ''}
                            {hasAddons && u.addons.map((a) => a.name).join(', ')}
                          </div>
                        );
                      })}

                    {item.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">"{item.notes}"</p>}
                    <p className="text-xs text-red-600 font-bold mt-1">
                      ${item.totalPrice.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-100 rounded-xl px-2.5 py-1 border border-slate-200 flex-shrink-0">
                    <button
                      onClick={() => updateQuantityInCart(item.cartItemId, -1)}
                      className="font-black text-red-600 hover:text-red-700 px-1 text-sm"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold w-4 text-center text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantityInCart(item.cartItemId, 1)}
                      className="font-black text-red-600 hover:text-red-700 px-1 text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={sendWhatsAppOrder} className="space-y-3.5 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Tu Nombre *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-red-600 text-slate-800"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType('Delivery')}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl border transition-all ${
                    orderType === 'Delivery'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  🛵 Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('Retiro')}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl border transition-all ${
                    orderType === 'Retiro'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  🛍️ Retiro en local
                </button>
              </div>

              {orderType === 'Delivery' && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Dirección de Envío *</label>
                  <input
                    type="text"
                    required
                    placeholder="Calle, Número y Piso"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-red-600 text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Forma de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-red-600 text-slate-800"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia / Mercado Pago">Transferencia / Mercado Pago</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 mt-4 text-sm flex items-center justify-center gap-2"
              >
                <span>Enviar Pedido por WhatsApp 📲</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
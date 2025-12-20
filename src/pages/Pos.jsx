import { useState, useEffect } from "react";
import {
  Search, ShoppingCart, Trash2, CreditCard, Banknote,
  Landmark, CheckCircle2, Package, UserPlus, Minus, Plus, Wrench, Tag
} from "lucide-react";

import { storage } from "../services/storage";

export default function Pos() {
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);

  // Cliente por defecto: Mostrador
  const clientMostrador = { id: 'mostrador', full_name: '🛒 Público General (Mostrador)' };

  const [selectedCustomer, setSelectedCustomer] = useState(clientMostrador);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [searchItem, setSearchItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [saleSuccess, setSaleSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const inv = await storage.get('inventory_items', []);
    const cust = await storage.get('clientes_list', []);

    setInventory(inv || []);
    setCustomers([clientMostrador, ...(cust || [])]);
    setLoading(false);
  }

  const addToCart = (product) => {
    // Check stock if not a service (specifically Bodega Local)
    const localStock = product.stocksByWarehouse?.["Bodega Local"] || 0;
    if (product.type !== 'Servicio' && localStock <= 0) {
      alert("¡Sin stock en Bodega Local!");
      return;
    }
    const exists = cart.find(item => item.id === product.id);
    if (exists) {
      if (product.type !== 'Servicio' && localStock <= exists.qty) {
        alert("No hay más stock disponible en local");
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const updateQty = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        const localStock = item.stocksByWarehouse?.["Bodega Local"] || 0;

        // Stock check
        if (item.type !== 'Servicio' && delta > 0 && localStock <= item.qty) {
          alert("No hay más stock disponible en local");
          return item;
        }

        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  // Cálculos de Dinero (Chile 19% IVA)
  const total = cart.reduce((acc, item) => acc + (item.price_sell * item.qty), 0);
  const neto = Math.round(total / 1.19);
  const iva = total - neto;

  // (Add this inside handleSale after successful insert)
  const registerInCashFlow = async (total, saleId, docNo, payMethod) => {
    const movements = await storage.get('cash_flow_movements', []);
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    const newMovement = {
      id: `MOV-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: "income",
      docType: "VOU",
      docNumber: docNo,
      description: `Venta ${saleId} | Voucher n°${docNo}`,
      category: "VENTA",
      paymentMethod: payMethod, // Sincronizado con POS
      netAmount: neto,
      taxAmount: iva,
      totalAmount: total,
      isTaxable: true,
      created_at: new Date().toISOString()
    };

    await storage.set('cash_flow_movements', [newMovement, ...movements]);
  };

  const handleSale = async () => {
    if (cart.length === 0 || !selectedCustomer) return;
    setLoading(true);

    try {
      const saleId = `V-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
      const docNo = Math.floor(1000 + Math.random() * 9000).toString();

      // 1. Registrar en flujo de caja (CON MEDIO DE PAGO)
      await registerInCashFlow(total, saleId, docNo, paymentMethod);

      // 2. Registrar la venta en historial (Storage)
      const sales = await storage.get('pos_sales', []);
      const newSale = {
        id: saleId,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.type === 'Empresa' ? selectedCustomer.business_name : selectedCustomer.full_name,
        total_amount: total,
        payment_method: paymentMethod,
        items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price_sell })),
        created_at: new Date().toISOString()
      };
      await storage.set('pos_sales', [newSale, ...sales]);

      // 3. Actualizar Stock en Inventario (Storage)
      const currentInventory = await storage.get('inventory_items', []);
      const updatedInventory = currentInventory.map(invItem => {
        const cartItem = cart.find(c => c.id === invItem.id);
        if (cartItem && invItem.type !== 'Servicio') {
          const updatedStocks = {
            ...invItem.stocksByWarehouse,
            "Bodega Local": Math.max(0, (invItem.stocksByWarehouse?.["Bodega Local"] || 0) - cartItem.qty)
          };
          return {
            ...invItem,
            stocksByWarehouse: updatedStocks,
            stock: Object.values(updatedStocks).reduce((a, b) => a + b, 0)
          };
        }
        return invItem;
      });
      await storage.set('inventory_items', updatedInventory);

      // UI Success
      setSaleSuccess(true);
      setCart([]);
      setSelectedCustomer(clientMostrador);
      setInventory(updatedInventory); // Refresh local list
      setTimeout(() => setSaleSuccess(false), 3000);

    } catch (error) {
      console.error("Error en la venta:", error);
      alert("Hubo un error al procesar la venta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500 overflow-hidden">

      {/* --- PANEL DE PRODUCTOS (IZQUIERDA) --- */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="text-slate-500 group-focus-within:text-brand-cyan transition-colors" size={20} />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-brand-cyan focus:ring-4 focus:ring-brand-cyan/10 transition-all text-lg shadow-2xl"
            value={searchItem}
            onChange={(e) => setSearchItem(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {inventory.filter(i => i.name.toLowerCase().includes(searchItem.toLowerCase())).map(item => (
              <button
                key={item.id} onClick={() => addToCart(item)}
                className="bg-slate-900 border border-white/5 p-4 rounded-3xl hover:border-brand-purple hover:bg-slate-800/50 transition-all text-left flex flex-col shadow-lg relative group active:scale-95"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg tracking-widest ${item.type === 'Servicio' ? 'bg-blue-500/20 text-blue-400' : 'bg-brand-purple/20 text-brand-purple'
                    }`}>
                    {item.type}
                  </span>
                  {item.type !== 'Servicio' && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${(item.stocksByWarehouse?.['Bodega Local'] || 0) <= (item.min_stock || 0)
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                      📦 {item.stocksByWarehouse?.['Bodega Local'] || 0}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-bold text-sm leading-snug flex-1 mb-4 group-hover:text-brand-cyan">
                  {item.name}
                </h3>
                <div className="text-xl font-black text-white">
                  ${item.price_sell.toLocaleString('es-CL')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- PANEL DE TICKET (DERECHA) --- */}
      <div className="w-[460px] flex flex-col bg-slate-950/40 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative backdrop-blur-xl">
        <div className="p-8 bg-slate-900/40 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-gradient rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingCart className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white italic leading-none tracking-tight">TICKET ACTUAL</h2>
              <p className="text-[10px] text-brand-cyan font-bold uppercase tracking-widest mt-1">
                {cart.length} ítems cargados
              </p>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-xl transition-all"
              title="Vaciar Carrito"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>

        {/* LISTA DE ITEMS - DISEÑO COMPACTO Y LIMPIO */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-10">
              <Package size={80} strokeWidth={1} />
              <p className="font-bold uppercase tracking-[0.2em] text-xs italic">Aún no hay productos</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="group bg-slate-900/30 hover:bg-slate-900/60 border border-white/[0.03] hover:border-white/10 rounded-2xl p-3 px-4 flex items-center gap-4 transition-all animate-in slide-in-from-right-4">
                {/* Mini Thumbnail / Icon */}
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                  {item.type === 'Servicio' ? <Wrench size={18} className="text-blue-400" /> : <Package size={18} className="text-brand-purple" />}
                </div>

                {/* Name and Basic Price */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-sm leading-tight truncate">{item.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{item.qty} x</span>
                    <span className="text-xs text-brand-cyan font-black">${item.price_sell.toLocaleString('es-CL')}</span>
                  </div>
                </div>

                {/* Qty Controls & Total */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-950/50 rounded-lg p-1 border border-white/5">
                    <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md text-slate-500 hover:text-white transition-all"><Minus size={12} /></button>
                    <span className="w-6 text-center text-[11px] font-black text-white">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md text-slate-500 hover:text-white transition-all"><Plus size={12} /></button>
                  </div>

                  <div className="w-20 text-right">
                    <span className="text-white font-black text-sm">
                      ${(item.qty * item.price_sell).toLocaleString('es-CL')}
                    </span>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER: RESUMEN DE PAGO ESTILO BOLETA */}
        <div className="p-8 bg-slate-900 border-t border-white/10 space-y-6 relative">
          <div className="space-y-4">
            {/* Cliente Selector */}
            <div className="flex items-center gap-3 bg-slate-950/50 border border-white/5 p-1 rounded-2xl group focus-within:border-brand-cyan transition-all">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center ml-1 text-brand-cyan">
                <UserPlus size={16} />
              </div>
              <select
                className="flex-1 bg-transparent border-none py-2 pr-4 text-white text-xs outline-none font-bold cursor-pointer"
                onChange={(e) => setSelectedCustomer(customers.find(c => c.id === e.target.value))}
                value={selectedCustomer?.id || ""}
              >
                {customers.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.type === 'Empresa' ? c.business_name : c.full_name}</option>)}
              </select>
            </div>

            {/* Tax Breakdown */}
            <div className="space-y-1.5 px-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-[10px] font-black uppercase tracking-widest">Neto</span>
                <span className="text-sm font-mono tracking-tighter font-bold">${neto.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-[10px] font-black uppercase tracking-widest">IVA (19%)</span>
                <span className="text-sm font-mono tracking-tighter font-bold">${iva.toLocaleString('es-CL')}</span>
              </div>
              <div className="pt-4 flex justify-between items-end border-t border-white/5">
                <div>
                  <span className="text-brand-cyan text-[10px] font-black uppercase tracking-[0.2em] block mb-1">Total a Pagar</span>
                  <span className="text-white font-black italic uppercase tracking-tighter text-2xl">TOTAL</span>
                </div>
                <span className="text-4xl font-black text-transparent bg-clip-text bg-brand-gradient drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  ${total.toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Efectivo', icon: <Banknote size={14} /> },
              { id: 'BancoChile', icon: <Landmark size={14} /> },
              { id: 'Mercado Pago', icon: <CreditCard size={14} /> }
            ].map(m => (
              <button
                key={m.id} onClick={() => setPaymentMethod(m.id)}
                className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${paymentMethod === m.id
                  ? 'bg-white text-slate-950 border-white shadow-xl scale-105'
                  : 'bg-slate-950 text-slate-500 border-white/5 hover:border-white/20'
                  }`}
              >
                {m.icon}
                <span className="text-[8px] font-black uppercase tracking-tighter">{m.id}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleSale}
            disabled={cart.length === 0 || loading}
            className="w-full bg-brand-gradient py-5 rounded-2xl text-white font-black uppercase tracking-[0.3em] shadow-2xl hover:brightness-110 active:scale-95 disabled:opacity-20 transition-all italic text-sm relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></div>
            {saleSuccess ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={20} />
                <span>¡Venta Exitosa!</span>
              </div>
            ) : (
              <span>Finalizar Venta</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
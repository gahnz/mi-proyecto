import { useState } from "react";
import {
  Search, ShoppingCart, Trash2, CreditCard, Banknote,
  Landmark, CheckCircle2, Package, UserPlus, Minus, Plus, Wrench
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase/client";

// Hooks
import { useInventory } from "../hooks/useInventory";
import { useCustomers } from "../hooks/useCustomers";

export default function Pos() {
  // --- LÓGICA DE DATOS ---
  const { inventory, updateItem, refresh: refreshInventory } = useInventory();
  const { customers } = useCustomers();

  // Estados del POS
  const [cart, setCart] = useState([]);
  const clientMostrador = { id: 'mostrador', full_name: '🛒 Público General' };
  const [selectedCustomer, setSelectedCustomer] = useState(clientMostrador);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [searchItem, setSearchItem] = useState("");
  const [loadingProcessing, setLoadingProcessing] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);

  // Filtro de productos
  const filteredInventory = inventory.filter(i => 
    i.name.toLowerCase().includes(searchItem.toLowerCase()) || 
    (i.sku && i.sku.toLowerCase().includes(searchItem.toLowerCase()))
  );

  // --- CARRITO ---
  const addToCart = (product) => {
    const localStock = product.stocksByWarehouse?.["Bodega Local"] || 0;
    
    if (product.type !== 'Servicio' && localStock <= 0) {
      toast.error("Sin stock físico en Bodega Local");
      return;
    }

    const exists = cart.find(item => item.id === product.id);
    if (exists) {
      if (product.type !== 'Servicio' && localStock <= exists.qty) {
        toast.warning("Stock máximo alcanzado");
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const updateQty = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        const localStock = item.stocksByWarehouse?.["Bodega Local"] || 0;
        if (item.type !== 'Servicio' && delta > 0 && localStock <= item.qty) {
          toast.warning("Tope de stock alcanzado");
          return item;
        }
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.price_sell * item.qty), 0);
  const neto = Math.round(total / 1.19);
  const iva = total - neto;

  // --- PROCESAR VENTA ---
  const handleSale = async () => {
    if (cart.length === 0) return;
    setLoadingProcessing(true);

    const saleId = `V-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
    const docNo = Math.floor(1000 + Math.random() * 9000).toString();
    const customerName = selectedCustomer.type === 'Empresa' ? selectedCustomer.business_name : selectedCustomer.full_name;

    const promise = (async () => {
        // 1. Guardar Venta
        const { error: saleError } = await supabase.from('sales').insert([{
            sale_id: saleId,
            customer_id: selectedCustomer.id === 'mostrador' ? null : selectedCustomer.id,
            customer_name: customerName,
            total_amount: total,
            payment_method: paymentMethod,
            items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price_sell }))
        }]);
        if (saleError) throw saleError;

        // 2. Caja
        const { error: cashError } = await supabase.from('cash_flow').insert([{
            date: new Date().toISOString().split('T')[0],
            type: "income",
            doc_type: "VOU",
            doc_number: docNo,
            description: `Venta POS ${saleId}`,
            category: "VENTA",
            payment_method: paymentMethod,
            net_amount: neto,
            tax_amount: iva,
            total_amount: total,
            is_ecommerce: false
        }]);
        if (cashError) throw cashError;

        // 3. Stock
        for (const item of cart) {
            if (item.type !== 'Servicio') {
                const currentStock = item.stocksByWarehouse["Bodega Local"] || 0;
                const newStock = Math.max(0, currentStock - item.qty);
                const updatedStocks = { ...item.stocksByWarehouse, "Bodega Local": newStock };
                await updateItem(item.id, { ...item, stocksByWarehouse: updatedStocks });
            }
        }
    })();

    toast.promise(promise, {
        loading: 'Procesando venta...',
        success: () => {
            setSaleSuccess(true);
            setCart([]);
            setSelectedCustomer(clientMostrador);
            refreshInventory();
            setTimeout(() => setSaleSuccess(false), 3000);
            return '¡Venta registrada exitosamente!';
        },
        error: (err) => `Error al procesar: ${err.message}`
    });

    setLoadingProcessing(false);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-85px)] animate-in fade-in duration-500 overflow-hidden">
      
      {/* IZQUIERDA: PRODUCTOS */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-cyan" size={20} />
          <input
            type="text"
            placeholder="Buscar producto..."
            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-brand-cyan transition-all text-lg shadow-xl"
            value={searchItem}
            onChange={(e) => setSearchItem(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredInventory.map(item => (
              <button
                key={item.id} onClick={() => addToCart(item)}
                className="bg-slate-900 border border-white/5 p-4 rounded-3xl hover:border-brand-purple hover:bg-slate-800 transition-all text-left flex flex-col shadow-lg group active:scale-95"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${item.type === 'Servicio' ? 'bg-blue-500/20 text-blue-400' : 'bg-brand-purple/20 text-brand-purple'}`}>{item.type}</span>
                  {item.type !== 'Servicio' && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Stock: {item.stocksByWarehouse?.['Bodega Local'] || 0}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-bold text-sm mb-4 group-hover:text-brand-cyan truncate w-full">{item.name}</h3>
                <div className="text-xl font-black text-white">${(item.price_sell || 0).toLocaleString('es-CL')}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DERECHA: TICKET */}
      <div className="w-[460px] flex flex-col bg-slate-950/40 rounded-[40px] border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="p-8 bg-slate-900/60 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-gradient rounded-2xl flex items-center justify-center shadow-lg"><ShoppingCart className="text-white" size={24} /></div>
            <div>
                <h2 className="text-lg font-black text-white italic">CARRITO</h2>
                <p className="text-[10px] text-brand-cyan font-bold uppercase">{cart.length} ítems en orden</p>
            </div>
          </div>
          {cart.length > 0 && <button onClick={() => setCart([])} className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-xl transition-all"><Trash2 size={20} /></button>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2 custom-scrollbar bg-slate-950/20">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20 space-y-4">
                <Package size={80} strokeWidth={1} />
                <p className="font-bold uppercase tracking-[0.2em] text-xs italic">Carro Vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-slate-900/80 border border-white/5 rounded-2xl p-3 flex items-center gap-3 animate-in slide-in-from-right-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-brand-purple"><Package size={20} /></div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-sm truncate">{item.name}</h4>
                  <div className="text-[10px] text-slate-500 font-mono">${item.price_sell.toLocaleString()} un.</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="text-white font-black text-sm">${(item.qty * item.price_sell).toLocaleString()}</div>
                    <div className="flex items-center bg-slate-950 rounded-lg border border-white/10">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white"><Minus size={10} /></button>
                        <span className="w-6 text-center text-[10px] font-black text-white">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white"><Plus size={10} /></button>
                    </div>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-slate-600 hover:text-rose-500 ml-1"><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-900 border-t border-white/10 space-y-5">
            <div className="flex items-center gap-3 bg-slate-950 border border-white/10 p-1.5 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center ml-1 text-brand-cyan"><UserPlus size={16} /></div>
                <select className="flex-1 bg-transparent border-none text-white text-xs font-bold outline-none cursor-pointer" onChange={(e) => {
                    if (e.target.value === 'mostrador') setSelectedCustomer(clientMostrador);
                    else setSelectedCustomer(customers.find(c => c.id == e.target.value));
                }} value={selectedCustomer.id}>
                    <option value="mostrador" className="bg-slate-900">🛒 Público General</option>
                    {customers.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.type === 'Empresa' ? c.business_name : c.full_name}</option>)}
                </select>
            </div>

            <div className="flex justify-between items-end border-t border-dashed border-white/10 pt-4">
                <div><span className="text-brand-cyan text-[9px] font-black uppercase tracking-[0.2em] block mb-0.5">Total a Pagar</span><span className="text-white font-black italic text-lg">TOTAL</span></div>
                <span className="text-3xl font-black text-transparent bg-clip-text bg-brand-gradient">${total.toLocaleString('es-CL')}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {[{ id: 'Efectivo', icon: <Banknote size={16} /> }, { id: 'BancoChile', icon: <Landmark size={16} /> }, { id: 'Mercado Pago', icon: <CreditCard size={16} /> }].map(m => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === m.id ? 'bg-white text-slate-950 border-white shadow-xl scale-105' : 'bg-slate-950 text-slate-500 border-white/5 hover:text-white'}`}>
                        {m.icon}<span className="text-[9px] font-black uppercase">{m.id}</span>
                    </button>
                ))}
            </div>

            <button onClick={handleSale} disabled={cart.length === 0 || loadingProcessing} className="w-full bg-brand-gradient py-4 rounded-2xl text-white font-black uppercase tracking-[0.3em] shadow-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all text-sm relative overflow-hidden">
                {saleSuccess ? <div className="flex items-center justify-center gap-2"><CheckCircle2 size={20} /><span>¡Venta Exitosa!</span></div> : <span>{loadingProcessing ? "Procesando..." : "Cobrar (Sin Imprimir)"}</span>}
            </button>
        </div>
      </div>
    </div>
  );
}
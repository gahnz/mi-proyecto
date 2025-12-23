import { useState, useMemo } from "react";
import { 
    Search, ShoppingCart, Trash2, Plus, Minus, 
    CheckCircle2, PackageX, Users, X, DollarSign, Wallet
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase/client";
import { useInventory } from "../hooks/useInventory"; 
import { useCustomers } from "../hooks/useCustomers";
import { getChileTime } from "../utils/time";
import { PAYMENT_METHODS } from "../constants";

export default function POS() {
    const { inventory, refreshInventory } = useInventory(); // refreshInventory para actualizar stock al vender
    const { customers } = useCustomers();
    
    // Estados del Carrito
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Todos");
    
    // Estados del Pago y Cliente
    const [paymentMethod, setPaymentMethod] = useState("Efectivo");
    const [isProcessing, setIsProcessing] = useState(false);
    
    // --- LÓGICA DE BÚSQUEDA DE CLIENTES ---
    const [clientSearch, setClientSearch] = useState("");
    const [selectedClient, setSelectedClient] = useState(null);
    const [showClientOptions, setShowClientOptions] = useState(false);

    const filteredClients = useMemo(() => {
        if (!clientSearch) return [];
        const lowerSearch = clientSearch.toLowerCase();
        return customers.filter(c => 
            (c.full_name || "").toLowerCase().includes(lowerSearch) ||
            (c.business_name || "").toLowerCase().includes(lowerSearch) ||
            (c.rut || "").toLowerCase().includes(lowerSearch)
        ).slice(0, 5);
    }, [customers, clientSearch]);

    const handleSelectClient = (client) => {
        setSelectedClient(client);
        setClientSearch(client.business_name || client.full_name);
        setShowClientOptions(false);
    };

    const clearClient = () => {
        setSelectedClient(null);
        setClientSearch("");
    };

    // Filtrado de Productos
    const filteredProducts = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = selectedCategory === "Todos" || item.type === selectedCategory;
            const hasStock = (item.stocksByWarehouse?.["Bodega Local"] || 0) > 0 || item.type === "Servicio";
            return matchesSearch && matchesCategory && hasStock;
        }).sort((a, b) => a.name.localeCompare(b.name)); // 👈 AQUÍ AGREGAMOS EL ORDEN ALFABÉTICO
    }, [inventory, searchTerm, selectedCategory]);

    // Totales
    const total = cart.reduce((acc, item) => acc + (item.price_sell * item.quantity), 0);
    const tax = Math.round(total * 0.19); // IVA 19% aprox (ajustar según régimen)
    const subtotal = total - tax;

    // --- ACCIONES DEL CARRITO ---
    const addToCart = (product) => {
        const existing = cart.find(i => i.id === product.id);
        const currentStock = product.stocksByWarehouse?.["Bodega Local"] || 0;

        if (existing) {
            if (product.type !== "Servicio" && existing.quantity >= currentStock) {
                toast.error("Stock insuficiente en Bodega Local");
                return;
            }
            setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const updateQuantity = (id, delta) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQuantity = Math.max(1, item.quantity + delta);
                if (delta > 0 && item.type !== "Servicio") {
                    const currentStock = inventory.find(i => i.id === id)?.stocksByWarehouse?.["Bodega Local"] || 0;
                    if (newQuantity > currentStock) {
                        toast.error("Stock límite");
                        return item;
                    }
                }
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    // 🔥 PROCESAR VENTA REAL (CAJA + STOCK)
    const handleCheckout = async () => {
        if (cart.length === 0) return toast.error("Carrito vacío");
        setIsProcessing(true);

        const finalClientName = selectedClient ? (selectedClient.business_name || selectedClient.full_name) : (clientSearch || "Cliente General");
        const dateNow = getChileTime().split('T')[0]; 

        try {
            // 1. REGISTRAR EN FLUJO DE CAJA (CASH_FLOW)
            const { error: cashError } = await supabase.from('cash_flow').insert([{
                date: dateNow,
                type: 'income',
                category: 'VENTA',
                description: `Venta POS | ${finalClientName}`, 
                payment_method: paymentMethod,
                total_amount: total,
                net_amount: subtotal,
                tax_amount: tax,
                is_ecommerce: false,
                client_id: selectedClient ? selectedClient.id : null,
                items: cart 
            }]);

            if (cashError) throw new Error("Error registrando en caja: " + cashError.message);

            // 2. DESCONTAR STOCK DE BODEGA LOCAL
            const stockPromises = cart.map(item => {
                if (item.type === 'Servicio') return Promise.resolve(); // No descontar servicios
                
                return supabase.rpc('update_inventory_stock', {
                    item_id: item.id,
                    quantity: item.quantity,
                    warehouse_name: "Bodega Local" // Siempre descuenta de aquí en POS
                });
            });

            await Promise.all(stockPromises);

            // 3. ÉXITO
            toast.success("✅ Venta registrada correctamente", {
                description: `Ingreso de $${total.toLocaleString('es-CL')} añadido a caja.`
            });

            // Limpiar todo
            setCart([]);
            clearClient();
            window.location.reload();

        } catch (error) {
            console.error(error);
            toast.error("Error procesando la venta", { description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-90px)] gap-3 animate-in fade-in duration-500 overflow-hidden">
            
            {/* 🛍️ IZQUIERDA: CATÁLOGO */}
            <div className="flex-1 flex flex-col gap-3 h-full min-w-0">
                
                {/* Header & Filtros */}
                <div className="bg-slate-900/50 p-3 rounded-2xl border border-white/5 backdrop-blur-md flex gap-3 items-center">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-purple transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar producto (F1)..." 
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-brand-purple/50 transition-all placeholder:text-slate-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide max-w-[40%] lg:max-w-[50%]">
                        {["Todos", "Repuesto", "Accesorio", "Servicio"].map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                                    selectedCategory === cat 
                                    ? "bg-brand-gradient text-white shadow-md" 
                                    : "bg-slate-950 text-slate-500 hover:bg-slate-800 hover:text-white"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid de Productos */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-20">
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredProducts.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center text-slate-500 h-64 opacity-50">
                                <PackageX size={48} className="mb-4"/>
                                <p className="font-bold uppercase tracking-widest text-xs">Sin resultados</p>
                            </div>
                        ) : (
                            filteredProducts.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => addToCart(item)}
                                    className="bg-slate-900 border border-white/5 rounded-2xl p-3 cursor-pointer group hover:border-brand-cyan/50 hover:bg-slate-800 transition-all flex flex-col justify-between h-[140px] relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>

                                    <div>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                item.type === 'Servicio' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                                            }`}>
                                                {item.type.slice(0,3)}.
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-mono">
                                                Stock: {item.stocksByWarehouse?.["Bodega Local"] || "∞"}
                                            </span>
                                        </div>
                                        <h3 className="text-xs font-bold text-white leading-tight line-clamp-2 h-8">{item.name}</h3>
                                    </div>

                                    <div className="flex justify-between items-end mt-1">
                                        <p className="text-sm font-black text-brand-cyan tracking-tighter">
                                            ${item.price_sell.toLocaleString('es-CL')}
                                        </p>
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-brand-cyan group-hover:text-black transition-colors shadow-lg">
                                            <Plus size={12} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* 🧾 DERECHA: TICKET DE VENTA */}
            <div className="w-full lg:w-[320px] xl:w-[380px] bg-slate-900 border border-white/10 rounded-2xl flex flex-col shadow-2xl h-full flex-shrink-0">
                
                {/* Header Ticket + BUSCADOR DE CLIENTE */}
                <div className="p-4 border-b border-white/5 bg-slate-950 rounded-t-2xl z-20">
                    <h2 className="text-sm font-black text-white italic uppercase tracking-tighter flex items-center gap-2 mb-3">
                        <ShoppingCart size={16} className="text-brand-purple" /> Ticket de Venta
                    </h2>
                    
                    <div className="relative">
                        <div className={`flex items-center gap-2 bg-slate-900 p-2 rounded-xl border transition-colors ${selectedClient ? 'border-brand-purple/50 bg-brand-purple/5' : 'border-white/5'}`}>
                            <div className={`p-1.5 rounded-lg ${selectedClient ? 'text-brand-purple' : 'text-slate-500'}`}>
                                {selectedClient ? <CheckCircle2 size={14}/> : <Users size={14}/>}
                            </div>
                            <input 
                                type="text" 
                                className="bg-transparent text-xs text-white w-full focus:outline-none font-bold placeholder:text-slate-600"
                                value={clientSearch}
                                onChange={(e) => {
                                    setClientSearch(e.target.value);
                                    setShowClientOptions(true);
                                    if(selectedClient) setSelectedClient(null);
                                }}
                                onFocus={() => setShowClientOptions(true)}
                                placeholder="Buscar Cliente (Nombre/RUT)..."
                            />
                            {clientSearch && (
                                <button onClick={clearClient} className="text-slate-500 hover:text-white"><X size={14}/></button>
                            )}
                        </div>

                        {showClientOptions && clientSearch && !selectedClient && filteredClients.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 animate-in fade-in zoom-in duration-200">
                                {filteredClients.map(c => (
                                    <div 
                                        key={c.id} 
                                        onClick={() => handleSelectClient(c)}
                                        className="p-3 hover:bg-white/10 cursor-pointer border-b border-white/5 text-xs text-white flex flex-col"
                                    >
                                        <span className="font-bold">{c.business_name || c.full_name}</span>
                                        <span className="text-[10px] text-slate-500">{c.rut}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista de Items */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-900/50">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-2 opacity-50">
                            <ShoppingCart size={32} strokeWidth={1} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Carrito Vacío</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="bg-slate-950 p-2 rounded-xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-colors">
                                <div className="flex-1 pr-2 min-w-0">
                                    <p className="text-[11px] font-bold text-white line-clamp-1 truncate">{item.name}</p>
                                    <p className="text-[10px] text-brand-cyan font-mono">${(item.price_sell * item.quantity).toLocaleString('es-CL')}</p>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-white/5">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded transition-all"><Minus size={10}/></button>
                                    <span className="text-xs font-black text-white w-3 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded transition-all"><Plus size={10}/></button>
                                </div>

                                <button onClick={() => removeFromCart(item.id)} className="ml-2 p-1 text-slate-600 hover:text-red-500 transition-colors">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Totales & Pago */}
                <div className="bg-slate-950 p-4 border-t border-white/10 space-y-3 rounded-b-2xl">
                    
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-end pt-1">
                            <span className="font-black text-white uppercase tracking-widest text-sm">Total</span>
                            <span className="font-black text-2xl text-brand-cyan tracking-tighter">${total.toLocaleString('es-CL')}</span>
                        </div>
                    </div>

                    {/* 🔥 SELECTOR DE MÉTODO DE PAGO ACTUALIZADO */}
                    <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map(method => (
                            <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={`py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest border transition-all truncate px-1 ${
                                    paymentMethod === method
                                    ? "bg-white text-black border-white" 
                                    : "bg-slate-900 text-slate-500 border-white/10 hover:bg-slate-800"
                                }`}
                                title={method}
                            >
                                {method}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isProcessing}
                        className="w-full bg-brand-gradient hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-purple/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-xs"
                    >
                        {isProcessing ? (
                            <span className="animate-pulse">Procesando...</span>
                        ) : (
                            <>
                                <Wallet size={16} /> Confirmar Venta
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
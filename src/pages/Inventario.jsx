import { useState, useEffect, useMemo } from "react";
import { 
    Plus, Search, AlertTriangle, Edit3, Trash2, X, Wrench, 
    Home, Truck, Zap, Smartphone, ShoppingCart, PackageCheck, 
    ClipboardList, Calendar, Hash, Clock, PackagePlus, DollarSign,
    CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Link as LinkIcon,
    Copy, ListChecks, FileSpreadsheet, Download // 👈 Agregados iconos para Excel
} from "lucide-react";
import * as XLSX from 'xlsx'; // 👈 Librería para Excel
import { toast } from "sonner"; 
import { supabase } from "../supabase/client"; 
import { useInventory } from "../hooks/useInventory";
import { useEquipos } from "../hooks/useEquipos";

const WAREHOUSES = [
  { id: "Bodega Local", label: "Bodega Local", icon: <Home size={14} />, color: "bg-slate-800 text-slate-300" },
  { id: "Mercado Libre", label: "Mercado Libre", icon: <Truck size={14} />, color: "bg-blue-500 text-white" },
  { id: "Mercado Full", label: "Mercado Full", icon: <Zap size={14} />, color: "bg-yellow-400 text-black" }
];

export default function Inventario() {
  // Asegúrate de que useInventory ya tenga exportada la función createBulkItems
  const { inventory: items, loading, addItem, updateItem, deleteItem, refreshInventory, createBulkItems } = useInventory();
  const { equipments: availableEquipments } = useEquipos();

  const [activeTab, setActiveTab] = useState("inventory"); 

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  
  const [modelSearch, setModelSearch] = useState("");
  const [showModelOptions, setShowModelOptions] = useState(false);

  const [orders, setOrders] = useState([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [newOrder, setNewOrder] = useState({ supplier: "", trackingCode: "", trackingUrl: "", estimatedDate: "", items: [] });
  const [itemSelectorSearch, setItemSelectorSearch] = useState("");

  const initialStocks = { "Bodega Local": 0, "Mercado Libre": 0, "Mercado Full": 0 };

  const [formData, setFormData] = useState({
    type: "Repuesto", name: "", sku: "", price_sell: 0, price_cost: 0,
    stocksByWarehouse: { ...initialStocks }, min_stock: 5, compatible_models: []
  });

  // --- NUEVA LÓGICA: CARGA MASIVA EXCEL ---

  const handleDownloadTemplate = () => {
    const template = [
      {
        NOMBRE: "Pantalla iPhone 13 OLED",
        TIPO: "Repuesto",
        SKU: "PANT-IP13-001",
        PRECIO_VENTA: 85000,
        COSTO: 35000,
        STOCK_MINIMO: 5,
        BODEGA_LOCAL: 10,
        MERCADO_LIBRE: 0,
        MERCADO_FULL: 0,
        COMPATIBILIDAD: "iPhone 13, iPhone 13 Pro" // Separado por comas
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Inventario.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) return toast.error("El archivo está vacío");

        const formattedItems = data.map(row => ({
          name: row.NOMBRE || "Sin nombre",
          type: row.TIPO || "Repuesto",
          sku: row.SKU || "",
          price_sell: Number(row.PRECIO_VENTA) || 0,
          price_cost: Number(row.COSTO) || 0,
          min_stock: Number(row.STOCK_MINIMO) || 5,
          stocks_by_warehouse: {
            "Bodega Local": Number(row.BODEGA_LOCAL) || 0,
            "Mercado Libre": Number(row.MERCADO_LIBRE) || 0,
            "Mercado Full": Number(row.MERCADO_FULL) || 0
          },
          compatible_models: row.COMPATIBILIDAD ? row.COMPATIBILIDAD.split(',').map(m => m.trim()) : []
        }));

        toast.promise(createBulkItems(formattedItems), {
          loading: 'Procesando carga masiva...',
          success: '¡Inventario actualizado con éxito!',
          error: 'Error al importar los datos'
        });
        
        e.target.value = null; // Reset input
      } catch (err) {
        console.error(err);
        toast.error("Error al leer el archivo Excel");
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- FIN LÓGICA EXCEL ---

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase.from('supply_orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  const incomingItemIds = useMemo(() => {
      const ids = new Set();
      orders
        .filter(o => o.status === 'Pendiente')
        .forEach(order => {
            if (Array.isArray(order.items)) {
                order.items.forEach(item => ids.add(item.id));
            }
        });
      return ids;
  }, [orders]);

  const handleSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ArrowUpDown size={12} className="opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-brand-purple" /> : <ArrowDown size={12} className="text-brand-purple" />;
  };

  const filteredEquips = availableEquipments.filter(eq => {
      const searchString = `${eq.brand} ${eq.model} ${eq.type}`.toLowerCase();
      return searchString.includes(modelSearch.toLowerCase());
  });

  const toggleCompatibleModel = (modelName) => {
      const currentModels = formData.compatible_models;
      if (currentModels.includes(modelName)) {
          setFormData({ ...formData, compatible_models: currentModels.filter(m => m !== modelName) });
      } else {
          setFormData({ ...formData, compatible_models: [...currentModels, modelName] });
      }
  };

  const handleSelectAllVisible = () => {
      const visibleModelNames = filteredEquips.map(eq => `${eq.brand} ${eq.model}`);
      const allSelected = visibleModelNames.every(name => formData.compatible_models.includes(name));

      if (allSelected) {
          setFormData({
              ...formData,
              compatible_models: formData.compatible_models.filter(m => !visibleModelNames.includes(m))
          });
      } else {
          const newSelection = new Set([...formData.compatible_models, ...visibleModelNames]);
          setFormData({
              ...formData,
              compatible_models: Array.from(newSelection)
          });
      }
  };

  const removeCompatibleModel = (modelName) => {
      setFormData({ 
          ...formData, 
          compatible_models: formData.compatible_models.filter(m => m !== modelName) 
      });
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      type: item.type, name: item.name, sku: item.sku || "",
      price_sell: item.price_sell, price_cost: item.price_cost || 0,
      stocksByWarehouse: item.stocksByWarehouse || { ...initialStocks },
      min_stock: item.min_stock, compatible_models: item.compatible_models || []
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = (item) => {
      setEditingId(null); 
      setFormData({
          type: item.type,
          name: `${item.name} (Copia)`, 
          sku: "", 
          price_sell: item.price_sell,
          price_cost: item.price_cost || 0,
          stocksByWarehouse: { ...initialStocks }, 
          min_stock: item.min_stock,
          compatible_models: [...(item.compatible_models || [])] 
      });
      setIsModalOpen(true);
      toast.info("Ítem duplicado. Revisa el nombre y SKU.");
  };

  const confirmDelete = (item) => { setItemToDelete(item); setIsDeleteModalOpen(true); };
  
  const handleDelete = async () => {
    if (!itemToDelete) return;
    await deleteItem(itemToDelete.id);
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
    toast.success("Ítem eliminado");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const promise = editingId ? updateItem(editingId, formData) : addItem(formData);
    toast.promise(promise, { loading: 'Guardando...', success: 'Guardado correctamente', error: 'Error al guardar' });
    try {
        await promise;
        setIsModalOpen(false);
        setEditingId(null);
        resetForm();
    } catch (error) { console.error(error); }
  };

  const resetForm = () => {
    setFormData({ type: "Repuesto", name: "", sku: "", price_sell: 0, price_cost: 0, stocksByWarehouse: { ...initialStocks }, min_stock: 5, compatible_models: [] });
    setEditingId(null);
    setModelSearch("");
  };

  const updateWarehouseStock = (warehouseId, value) => {
    setFormData(prev => ({ ...prev, stocksByWarehouse: { ...prev.stocksByWarehouse, [warehouseId]: parseInt(value) || 0 } }));
  };

  const openEditOrderModal = (order) => {
      setEditingOrderId(order.id);
      setNewOrder({
          supplier: order.supplier_name, trackingCode: order.tracking_code || "", trackingUrl: order.tracking_url || "", estimatedDate: order.estimated_delivery_date || "", items: order.items || []
      });
      setIsOrderModalOpen(true);
  };

  const handleDeletePurchase = async (e, orderId) => {
      e.stopPropagation();
      if(!window.confirm("⚠️ ¿Estás seguro de eliminar esta orden de compra?")) return;
      const { error } = await supabase.from('supply_orders').delete().eq('id', orderId);
      if (error) { toast.error("Error al eliminar"); } else { toast.success("Orden eliminada"); fetchOrders(); }
  };

  const handleAddItemToOrder = (item) => {
    const existing = newOrder.items.find(i => i.id === item.id);
    if (existing) return;
    setNewOrder({ ...newOrder, items: [...newOrder.items, { ...item, quantity: 1, purchase_cost: item.price_cost || 0 }] });
    setItemSelectorSearch(""); 
  };

  const updateOrderItem = (id, field, value) => {
    setNewOrder({ ...newOrder, items: newOrder.items.map(i => i.id === id ? { ...i, [field]: Number(value) } : i) });
  };

  const removeOrderItem = (id) => {
    setNewOrder({ ...newOrder, items: newOrder.items.filter(i => i.id !== id) });
  };

  const submitOrder = async () => {
    if (!newOrder.supplier || newOrder.items.length === 0) { toast.error("Falta proveedor o items"); return; }
    const total = newOrder.items.reduce((acc, i) => acc + (i.quantity * i.purchase_cost), 0);
    const payload = {
        supplier_name: newOrder.supplier, items: newOrder.items, total_cost: total,
        tracking_code: newOrder.trackingCode, tracking_url: newOrder.trackingUrl, estimated_delivery_date: newOrder.estimatedDate || null
    };
    if (!editingOrderId) { payload.status = 'Pendiente'; }
    let promise;
    if (editingOrderId) { promise = supabase.from('supply_orders').update(payload).eq('id', editingOrderId); } 
    else { promise = supabase.from('supply_orders').insert([payload]); }
    const { error } = await promise;
    if (error) { toast.error("Error al guardar orden"); } 
    else { toast.success(editingOrderId ? "Orden actualizada" : "Orden creada"); setIsOrderModalOpen(false); setNewOrder({ supplier: "", trackingCode: "", trackingUrl: "", estimatedDate: "", items: [] }); setEditingOrderId(null); fetchOrders(); }
  };

  const handleReceiveOrder = async (e, order) => {
    e.stopPropagation();
    if (!window.confirm("¿Confirmar recepción? Se sumará el stock a Bodega Local.")) return;
    const promises = order.items.map(async (item) => {
        const { data: currentData } = await supabase.from('inventory').select('stocks_by_warehouse').eq('id', item.id).single();
        if (currentData) {
            const currentStock = currentData.stocks_by_warehouse?.["Bodega Local"] || 0;
            const newStock = currentStock + item.quantity;
            const newStocksJson = { ...currentData.stocks_by_warehouse, "Bodega Local": newStock };
            await supabase.from('inventory').update({ stocks_by_warehouse: newStocksJson }).eq('id', item.id);
        }
    });
    await Promise.all(promises);
    await supabase.from('supply_orders').update({ status: 'Recibido', received_at: new Date().toISOString() }).eq('id', order.id);
    toast.success("📦 Stock recepcionado correctamente"); fetchOrders(); refreshInventory();
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase())));
  
  const sortedItems = [...filteredItems].sort((a, b) => {
      if (sortConfig.key === 'name') { return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
      if (sortConfig.key === 'totalStock') {
          const stockA = Object.values(a.stocksByWarehouse || {}).reduce((x, y) => x + y, 0);
          const stockB = Object.values(b.stocksByWarehouse || {}).reduce((x, y) => x + y, 0);
          return sortConfig.direction === 'asc' ? stockA - stockB : stockB - stockA;
      }
      return 0;
  });

  const itemsToBuy = items.filter(i => i.name.toLowerCase().includes(itemSelectorSearch.toLowerCase()) && i.type !== 'Servicio');

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Control de Inventario</h1>
          <div className="flex gap-4 mt-2">
            <button onClick={() => setActiveTab('inventory')} className={`text-sm font-bold uppercase tracking-wider pb-1 transition-all ${activeTab === 'inventory' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-slate-500 hover:text-white'}`}>Mis Productos</button>
            <button onClick={() => setActiveTab('purchases')} className={`text-sm font-bold uppercase tracking-wider pb-1 transition-all ${activeTab === 'purchases' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-slate-500 hover:text-white'}`}>Compras / Reposición</button>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
            {activeTab === 'inventory' && (
              <>
                <button 
                  onClick={handleDownloadTemplate}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-white/10 transition-all text-[10px] uppercase tracking-wider"
                  title="Descargar Plantilla Excel"
                >
                  <Download size={16} /> Plantilla
                </button>

                <div className="relative">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-[10px] uppercase tracking-wider">
                    <FileSpreadsheet size={16} /> Importar Excel
                  </button>
                </div>
              </>
            )}

            {activeTab === 'inventory' ? (
                <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-gradient hover:opacity-90 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-purple/30 text-xs ml-2">
                    <Plus size={18} /> Nuevo Ítem
                </button>
            ) : (
                <button onClick={() => { setEditingOrderId(null); setNewOrder({ supplier: "", trackingCode: "", trackingUrl: "", estimatedDate: "", items: [] }); setIsOrderModalOpen(true); }} className="bg-brand-cyan hover:bg-brand-cyan/80 text-black px-6 py-2.5 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-cyan/30 text-xs"><ShoppingCart size={18} /> Nueva Compra</button>
            )}
        </div>
      </div>

      {/* VISTA 1: INVENTARIO */}
      {activeTab === 'inventory' && (
        <>
            <div className="bg-slate-900/50 p-4 rounded-2x border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="text" placeholder="Buscar por nombre o SKU..." className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 transition-all font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                {loading && <span className="text-xs text-brand-purple animate-pulse font-bold uppercase">Sincronizando...</span>}
            </div>
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm shadow-xl">
                <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                    <tr>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-2">Ítem / Info {getSortIcon('name')}</div>
                        </th>
                        <th className="px-6 py-4">Distribución de Stock</th>
                        <th className="px-6 py-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalStock')}>
                            <div className="flex items-center justify-center gap-2">Total {getSortIcon('totalStock')}</div>
                        </th>
                        <th className="px-6 py-4 text-right">Precio Venta</th>
                        <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {sortedItems.map((item) => { 
                    const totalStock = Object.values(item.stocksByWarehouse || {}).reduce((a, b) => a + b, 0);
                    const isIncoming = incomingItemIds.has(item.id);

                    return (
                        <tr key={item.id} className="hover:bg-white/5 transition-all group">
                        <td className="px-6 py-4">
                            <div className="font-bold text-white uppercase text-sm tracking-tight flex items-center gap-2">
                                {item.name}
                                {isIncoming && (<div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse" title="Hay una compra pendiente de recibir con este ítem"><PackagePlus size={12} /> EN CAMINO</div>)}
                            </div>
                            <div className="flex items-center gap-2 mt-1"><span className="text-[9px] px-1.5 py-0.5 rounded-md bg-brand-purple/20 text-brand-purple border border-brand-purple/30 uppercase font-black tracking-widest">{item.type}</span><span className="text-[10px] text-slate-500 font-mono tracking-tighter">SKU: {item.sku || 'N/A'}</span></div>
                        </td>
                        <td className="px-6 py-4"><div className="flex gap-2">{item.type === 'Servicio' ? (<span className="text-brand-purple text-[10px] font-black uppercase tracking-widest bg-brand-purple/10 px-3 py-1 rounded-lg border border-brand-purple/20">Servicio Intangible</span>) : (<>{WAREHOUSES.map(w => { const stock = item.stocksByWarehouse?.[w.id] || 0; if (stock === 0) return null; return (<div key={w.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-white/5 ${w.color}`}>{w.icon}<span className="text-[10px] font-black uppercase tracking-tighter">{stock}</span></div>); })} {(!item.stocksByWarehouse || Object.values(item.stocksByWarehouse).every(s => s === 0)) && (<span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">Sin stock físico</span>)}</>)}</div></td>
                        <td className="px-6 py-4 text-center">{item.type === 'Servicio' ? <span className="text-slate-600 text-sm font-bold uppercase tracking-widest">—</span> : <span className={`text-lg font-black italic tracking-tighter ${totalStock <= item.min_stock ? "text-rose-500" : "text-brand-cyan"}`}>{totalStock}</span>}</td>
                        <td className="px-6 py-4 text-right text-white font-black italic text-lg tracking-tighter shadow-sm">${(item.price_sell || 0).toLocaleString('es-CL')}</td>
                        <td className="px-6 py-4">
                            <div className="flex justify-center gap-2 truncate">
                                <button onClick={() => handleDuplicate(item)} className="p-2 bg-white/5 hover:bg-brand-purple/20 rounded-xl text-slate-400 hover:text-brand-purple transition-all" title="Duplicar"><Copy size={18} /></button>
                                <button onClick={() => handleEdit(item)} className="p-2 bg-white/5 hover:bg-brand-cyan/20 rounded-xl text-slate-400 hover:text-brand-cyan transition-all"><Edit3 size={18} /></button>
                                <button onClick={() => confirmDelete(item)} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all"><Trash2 size={18} /></button>
                            </div>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
        </>
      )}

      {/* VISTA 2: COMPRAS (Mantener igual que antes) */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
            {orders.length === 0 && <div className="text-center py-20 text-slate-500 italic">No hay órdenes de compra registradas.</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map(order => {
                    const isLate = order.estimated_delivery_date && new Date(order.estimated_delivery_date) < new Date() && order.status === 'Pendiente';
                    return (
                        <div key={order.id} onClick={() => openEditOrderModal(order)} className="bg-slate-900 border border-white/5 p-5 rounded-[2rem] relative overflow-hidden group hover:border-brand-purple/30 transition-all shadow-xl flex flex-col justify-between h-full cursor-pointer hover:bg-slate-800/50">
                            {order.status === 'Recibido' && <div className="absolute right-0 top-0 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest border-l border-b border-emerald-500/20">Recibido</div>}
                            {order.status === 'Pendiente' && <div className="absolute right-0 top-0 bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest border-l border-b border-yellow-500/20 animate-pulse">Pendiente</div>}
                            <div>
                                <div className="mb-4 pr-16"><h3 className="text-lg font-black text-white italic leading-tight truncate">{order.supplier_name}</h3><p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-bold"><Calendar size={10} /> {new Date(order.created_at).toLocaleDateString()}</p></div>
                                {(order.estimated_delivery_date || order.tracking_code) && (<div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">{order.estimated_delivery_date && (<p className={`text-[10px] flex items-center gap-2 font-bold mb-1 ${isLate ? 'text-red-400' : 'text-brand-cyan'}`}><Clock size={12} /> Llegada: {new Date(order.estimated_delivery_date).toLocaleDateString()}</p>)}{order.tracking_code && (<div className="flex items-center justify-between"><p className="text-[10px] text-slate-300 flex items-center gap-2 font-mono"><Hash size={12} /> {order.tracking_code}</p>{order.tracking_url && (<a href={order.tracking_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[9px] text-brand-purple hover:text-white flex items-center gap-1 font-bold uppercase hover:underline"><ExternalLink size={10} /> Seguir</a>)}</div>)}</div>)}
                                <div className="bg-black/20 rounded-xl p-3 mb-4 max-h-32 overflow-y-auto custom-scrollbar border border-white/5"><div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center gap-1"><ClipboardList size={10} /> {order.items.length} Items</div><div className="space-y-1.5">{order.items.map((item, idx) => (<div key={idx} className="flex justify-between text-xs text-slate-300 border-b border-white/5 last:border-0 pb-1 last:pb-0"><span className="truncate pr-2">{item.quantity}x <strong className="text-white">{item.name}</strong></span></div>))}</div></div>
                            </div>
                            <div className="pt-2 border-t border-white/10 mt-auto"><div className="flex justify-between items-end mb-3"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Orden</span><span className="text-xl font-black text-white italic tracking-tighter flex items-center"><DollarSign size={14} className="text-slate-500 mr-0.5" />{order.total_cost.toLocaleString('es-CL')}</span></div><div className="flex gap-2"><button onClick={(e) => handleDeletePurchase(e, order.id)} className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all" title="Eliminar Compra"><Trash2 size={16} /></button>{order.status === 'Pendiente' ? (<button onClick={(e) => handleReceiveOrder(e, order)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"><PackageCheck size={14} /> Recibir</button>) : (<div className="flex-1 bg-slate-800 text-slate-500 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 cursor-default opacity-50"><CheckSquare size={14} /> Finalizado</div>)}</div></div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* MODALES - Mantener iguales */}
      {/* ... Modal Crear Item ... */}
      {/* ... Modal Orden de Compra ... */}
      {/* ... Modal Eliminar ... */}

    </div>
  );
}
import { useState, useEffect, useMemo } from "react";
import {
    Plus, Search, CheckCircle2, AlertCircle, MoreVertical,
    Smartphone, Laptop, Tablet, User, Calendar, DollarSign,
    MapPin, Clock, FileText, PenTool, X, Trash2,
    Save, Monitor, Printer, Cpu, Lock, Share2,
    Receipt, UploadCloud, FileCheck, BoxSelect
} from "lucide-react";
import { supabase } from "../supabase/client";
import { toast } from "sonner"; 

import { useWorkOrders } from "../hooks/useWorkOrders";
import { useCustomers } from "../hooks/useCustomers";
import { useEquipos } from "../hooks/useEquipos";
import { useInventory } from "../hooks/useInventory";
import { generateOrderPDF } from "../utils/pdfGenerator"; 
import { getChileTime } from "../utils/time"; 

const JOB_TYPES = ["Mantenimiento", "Reparación", "Revisión", "Configuración"];
const STATUS_LIST = [
    "En cola", "Trabajando", "Revisión del Coordinador",
    "Notificado y no pagado", "Pagado y no retirado",
    "Retirado y no pagado", "Finalizado y Pagado", "Cancelado"
];
const DOC_TYPES = ["Boleta", "Factura", "Voucher Interno", "Guía de Despacho"];

const Taller = () => {
    // Hooks
const { orders: repairs, loading, createOrder, updateOrder, deleteOrder, refresh } = useWorkOrders();
    const { customers: clients } = useCustomers();
    const { equipments: equipmentsList } = useEquipos();
    const { inventory: inventoryItems } = useInventory();

    // Local State
    const [technicians, setTechnicians] = useState([]);
    const [filterStatus, setFilterStatus] = useState("Todos");
    const [filterLocation, setFilterLocation] = useState("Todos");
    const [filterTech, setFilterTech] = useState("Todos");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal & Interaction State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingDbId, setEditingDbId] = useState(null);
    const [activeTab, setActiveTab] = useState("order");
    const [showScheduler, setShowScheduler] = useState(false);
    const [schedulerDate, setSchedulerDate] = useState(getChileTime().split('T')[0]);

    // Search & Autocomplete State
    const [equipSearch, setEquipSearch] = useState("");
    const [showEquipOptions, setShowEquipOptions] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [showClientOptions, setShowClientOptions] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // Form Data State
    const [formData, setFormData] = useState({
        status: "En cola",
        location: "Local",
        equipmentId: "",
        jobType: "Reparación",
        reportedFault: "",
        clientId: "",
        technician: "",
        startDate: getChileTime().slice(0, 16),
        estimatedEndDate: "",
        internalNotes: "",
        selectedItems: [],
        probReal: "", solReal: "", obs: "",
        photoBefore: null, photoAfter: null,
        receiverName: "", receiverSignature: null,
        paymentMethod: "Efectivo",
        docType: "Boleta", docNumber: "", docUrl: "", docFile: null,
        stockDeducted: false
    });

    useEffect(() => {
        const fetchTechnicians = async () => {
            const { data } = await supabase
                .from("profiles")
                .select("full_name")
                .in("role", ["tecnico", "coordinador", "admin"]);
            if (data) setTechnicians(data.map(t => t.full_name).filter(Boolean));
        };
        fetchTechnicians();
    }, []);

    // Helper Functions
    const smartSearch = (text, search) => {
        if (!text || !search) return false;
        const searchTerms = search.toLowerCase().split(" ").filter(Boolean);
        const textLower = text.toLowerCase();
        return searchTerms.every(term => textLower.includes(term));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "En cola": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
            case "Trabajando": return "bg-brand-purple/10 text-brand-purple border-brand-purple/20";
            case "Finalizado y Pagado": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "Cancelado": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
            default: return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        }
    };

    const getDeviceIcon = (type) => {
        switch ((type || "").toLowerCase()) {
            case "smartphone": case "celular": return <Smartphone size={18} />;
            case "notebook": case "laptop": return <Laptop size={18} />;
            case "tablet": return <Tablet size={18} />;
            case "impresora": return <Printer size={18} />;
            case "pc": return <Monitor size={18} />;
            default: return <Cpu size={18} />;
        }
    };

    // ... (resto del código igual hasta llegar a Filter Logic)

    // Filter Logic
    const filteredClients = clients.filter(c => {
        const searchString = `${c.full_name || ""} ${c.business_name || ""} ${c.rut || ""}`;
        return smartSearch(searchString, clientSearch);
    });

    const filteredEquips = equipmentsList.filter(eq => {
        const searchString = `${eq.brand} ${eq.model} ${eq.type}`;
        return smartSearch(searchString, equipSearch);
    });

    const filteredRepairs = repairs.filter(repair => {
        let matchesStatus = true;
        if (filterStatus !== "Todos") {
            if (filterStatus === "En Cola") {
                matchesStatus = repair.status === "En cola" || repair.status === "Trabajando";
            } 
            else if (filterStatus === "Revisión") {
                matchesStatus = ["Revisión del Coordinador", "Notificado y no pagado", "Pagado y no retirado", "Retirado y no pagado"].includes(repair.status);
            }
            else if (filterStatus === "Finalizados") {
                matchesStatus = ["Finalizado y Pagado", "Cancelado"].includes(repair.status);
            }
            else {
                matchesStatus = repair.status === filterStatus;
            }
        }
        
        const matchesLocation = filterLocation === "Todos" || (repair.location || "Local") === filterLocation; 
        const matchesTech = filterTech === "Todos" || (repair.technician || "").includes(filterTech);
        const searchableString = `${repair.customer || ""} ${repair.id || ""} ${repair.device || ""} ${repair.status || ""}`;
        const matchesSearch = searchTerm === "" || smartSearch(searchableString, searchTerm);

        return matchesStatus && matchesSearch && matchesLocation && matchesTech;
    });

    // Lógica de filtrado de items
    const compatibleItems = useMemo(() => {
        const selectedEquipmentObj = equipmentsList.find(e => e.id === Number(formData.equipmentId));

        if (!selectedEquipmentObj) {
            return inventoryItems.filter(i => i.type === 'Servicio' && (!i.compatible_models || i.compatible_models.length === 0));
        }

        const fullDeviceName = `${selectedEquipmentObj.brand} ${selectedEquipmentObj.model}`.toLowerCase().trim();

        return inventoryItems.filter(item => {
            const models = item.compatible_models || [];
            if (item.type === 'Servicio' && models.length === 0) return true;
            if (item.type !== 'Servicio' && models.length === 0) return false;

            const isMatch = models.some(modelString => {
                const cleanModelString = modelString.toLowerCase().trim();
                return fullDeviceName.includes(cleanModelString) || cleanModelString.includes(fullDeviceName);
            });

            return isMatch;
        });
    }, [inventoryItems, formData.equipmentId, equipmentsList]);

    const showFiscalFields = !['En cola', 'Trabajando'].includes(formData.status);

    // Actions
    const handleShareLink = (e, orderId) => {
        e.stopPropagation();
        const link = `${window.location.origin}/tracker/${orderId}`;
        navigator.clipboard.writeText(link).then(() => {
            toast.success("🔗 Link copiado", { description: "Envíalo al cliente para seguimiento." });
        });
    };

    // 🔥🔥 FUNCIÓN ACTUALIZADA: Recibe docUrl y determina Status
    const registerCashFlowEntry = async (orderId, customerName, total, method, docUrl) => {
        if (!orderId) return;
        const { data: existing } = await supabase.from('cash_flow').select('id').ilike('description', `%${orderId}%`).limit(1);
        if (existing && existing.length > 0) return;

        const neto = Math.round(total / 1.19);
        const tax = total - neto;
        
        // Determinar estado basado en medio de pago
        const isDeferred = ["Mercado Pago", "Webpay"].includes(method);
        const status = isDeferred ? 'pending' : 'confirmed';

        const { error } = await supabase.from('cash_flow').insert([{
            date: getChileTime().split('T')[0],
            type: 'income',
            category: 'VENTA',
            description: `Servicio Técnico ${orderId} | ${customerName}`,
            payment_method: method,
            total_amount: total,
            net_amount: neto,
            tax_amount: tax,
            doc_type: 'VOU',
            doc_number: orderId.replace('OT-', ''),
            is_ecommerce: false,
            status: status, // 👈 Guardamos el estado correcto
            doc_url: docUrl // 👈 Guardamos el PDF de la orden si existe
        }]);

        if (error) console.error("Error caja:", error);
        else toast.success(`💰 Ingreso de $${total.toLocaleString('es-CL')} registrado (${status === 'pending' ? 'Retenido' : 'Disponible'}).`);
    };

    // En src/pages/Taller.jsx

// Localiza handleStockDeduction en src/pages/Taller.jsx
const handleStockDeduction = async (items) => {
    if (!items || items.length === 0) return;

    const promises = items.map(item => {
        return supabase.rpc('update_inventory_stock', {
            item_id: parseInt(item.id, 10), // 👈 Forzamos a entero base 10
            quantity: parseInt(item.quantity || 1, 10),
            warehouse_name: "Bodega Local"
        });
    });

    try {
        const results = await Promise.all(promises);
        
        results.forEach((res, index) => {
            if (res.error) {
                console.error(`❌ Error en ${items[index].name}:`, res.error.message);
            } else {
                console.log(`✅ Stock restado: ${items[index].name}`);
            }
        });
        
        toast.success("Inventario actualizado");
    } catch (error) {
        console.error("Error en proceso de stock:", error);
    }
};

const handleStockRestoration = async (items) => {
    if (!items || items.length === 0) return;
    
    const promises = items.map(item => 
        supabase.rpc('restore_inventory_stock', {
            item_id: parseInt(item.id, 10),
            quantity: parseInt(item.quantity || 1, 10),
            warehouse_name: "Bodega Local"
        })
    );

    try {
        await Promise.all(promises);
        toast.info("📦 Stock devuelto a Bodega Local");
    } catch (error) {
        console.error("Error restaurando stock:", error);
    }
};

    const handleEditOrder = (repair) => {
        setEditingId(repair.id);
        setEditingDbId(repair.db_id);
        setActiveTab("order");
        
        const clientID = repair.customer_id;
        const foundClient = clients.find(c => c.id === clientID);
        const clientName = foundClient ? (foundClient.business_name || foundClient.full_name) : (repair.customer || "");
        
        setFormData({
            status: repair.status || "En cola",
            location: repair.location || "Local",
            equipmentId: repair.equipment_id || "",
            jobType: repair.job_type || "Reparación",
            reportedFault: repair.reported_failure || "",
            clientId: clientID || "",
            technician: repair.technician_name || "",
            internalNotes: repair.internal_notes || "",
            startDate: repair.start_date ? repair.start_date.slice(0, 16) : "",
            estimatedEndDate: repair.estimated_end_date ? repair.estimated_end_date.slice(0, 16) : "",
            selectedItems: repair.items || [],
            probReal: repair.prob_real || "", solReal: repair.sol_real || "", obs: repair.observations || "",
            photoBefore: repair.photo_before || null, photoAfter: repair.photo_after || null,
            receiverName: repair.receiver_name || "", receiverSignature: repair.receiver_signature || null,
            paymentMethod: repair.payment_method || "Efectivo",
            docType: repair.doc_type || "Boleta", docNumber: repair.doc_number || "", docUrl: repair.doc_url || "", docFile: null,
            stockDeducted: repair.stock_deducted || false
        });
        
        setEquipSearch(repair.device || repair.device_name || "");
        setClientSearch(clientName);
        setIsModalOpen(true);
    };

    const handleDeleteOrder = async (uuid, orderId) => {
        if (window.confirm(`⚠️ ¿Eliminar orden ${orderId}?`)) {
            const promise = deleteOrder(uuid);
            toast.promise(promise, { loading: 'Eliminando...', success: 'Orden eliminada', error: 'Error al eliminar' });
        }
    };

    const handleSaveOrder = async () => {
        const missingFields = [];
        if (!formData.clientId) missingFields.push("Cliente");
        if (!formData.technician) missingFields.push("Técnico");
        if (!formData.startDate) missingFields.push("Fecha Inicio");
        if (!formData.equipmentId && (!equipSearch || equipSearch.trim() === "")) missingFields.push("Equipo");
        if (formData.selectedItems.length === 0) missingFields.push("Al menos 1 Item");
        if (!formData.reportedFault) missingFields.push("Falla Reportada");

        if (missingFields.length > 0) {
            toast.error("Faltan datos", { description: missingFields.join(", ") });
            return;
        }

        let finalDocUrl = formData.docUrl;

        // Upload Document Logic
        if (formData.docFile) {
            setUploadingDoc(true);
            try {
                const fileExt = formData.docFile.name.split('.').pop();
                const fileName = `docs/${editingId || 'new'}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('repair-images').upload(fileName, formData.docFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('repair-images').getPublicUrl(fileName);
                finalDocUrl = publicUrl;
            } catch (error) {
                console.error("Error subiendo documento:", error);
                toast.error("Error al subir el documento PDF");
                setUploadingDoc(false);
                return;
            }
            setUploadingDoc(false);
        }

        const totalCost = formData.selectedItems.reduce((acc, item) => acc + (Number(item.price) * (item.quantity || 1)), 0);
        const client = clients.find(c => c.id === formData.clientId);
        const equipment = equipmentsList.find(e => e.id === Number(formData.equipmentId));
        const customerName = client ? (client.business_name || client.full_name) : "Cliente Manual";

        // Lógica de descuento de stock
        let shouldDeductStock = false;
        if (formData.status === "Finalizado y Pagado" && !formData.stockDeducted) {
            shouldDeductStock = true;
        }

        const orderPayload = {
            customer_id: formData.clientId || null,
            customer_name: customerName,
            equipment_id: formData.equipmentId || null,
            device_name: equipment ? `${equipment.brand} ${equipment.model}` : (equipSearch || "Equipo Genérico"),
            device_type: equipment ? equipment.type : "Otro",
            status: formData.status,
            location: formData.location,
            job_type: formData.jobType,
            reported_failure: formData.reportedFault,
            internal_notes: formData.internalNotes,
            technician_name: formData.technician,
            start_date: formData.startDate,
            estimated_end_date: formData.estimatedEndDate,
            items: formData.selectedItems,
            total_cost: totalCost,
            payment_method: formData.paymentMethod,
            prob_real: formData.probReal,
            sol_real: formData.solReal,
            observations: formData.obs,
            photo_before: formData.photoBefore,
            photo_after: formData.photoAfter,
            receiver_name: formData.receiverName,
            receiver_signature: formData.receiverSignature,
            doc_type: formData.docType,
            doc_number: formData.docNumber,
            doc_url: finalDocUrl,
            stock_deducted: shouldDeductStock ? true : formData.stockDeducted
        };

        // MODIFICACIÓN TEMPORAL PARA PRUEBAS
const promise = (async () => {
    if (editingDbId) {
        await updateOrder(editingDbId, orderPayload);
        
        // LOG DE CONTROL:
        console.log("Estado actual del formulario:", formData.status);
        console.log("¿Ya se descontó stock antes?:", formData.stockDeducted);

        // Llamamos a la función sin importar el estado solo para ver los logs de los items
        await handleStockDeduction(formData.selectedItems); 
        
        if (formData.status === "Finalizado y Pagado") {
            await registerCashFlowEntry(editingId, customerName, totalCost, formData.paymentMethod, finalDocUrl);
        }
    } else {
        await createOrder(orderPayload);
    }
})();

        toast.promise(promise, { 
    loading: 'Guardando...', 
    success: () => { 
        setIsModalOpen(false); 
        resetForm(); 
        refresh(); // <--- Agrega esta línea aquí para actualizar la lista local
        return 'Guardado correctamente'; 
    }, 
    error: (err) => `Error: ${err.message}` 
});
    };

    const resetForm = () => {
        setFormData({
            status: "En cola", location: "Local", equipmentId: "", jobType: "Reparación", reportedFault: "", clientId: "", technician: "",
            startDate: getChileTime().slice(0, 16), estimatedEndDate: "", internalNotes: "", selectedItems: [],
            probReal: "", solReal: "", obs: "", photoBefore: null, photoAfter: null, receiverName: "", receiverSignature: null, paymentMethod: "Efectivo",
            docType: "Boleta", docNumber: "", docUrl: "", docFile: null, stockDeducted: false
        });
        setEquipSearch(""); setClientSearch(""); setShowEquipOptions(false); setShowClientOptions(false);
        setEditingId(null); setEditingDbId(null); setActiveTab("order"); setUploadingDoc(false);
    };

    const addItemToOrder = (item) => {
        if (formData.selectedItems.some(i => i.id === item.id)) return;
        setFormData({ ...formData, selectedItems: [...formData.selectedItems, { id: item.id, name: item.name, price: item.price_sell, quantity: 1 }] });
    };

    const removeItemFromOrder = (id) => {
        setFormData({ ...formData, selectedItems: formData.selectedItems.filter(item => item.id !== id) });
    };

    const updateItemPrice = (id, newPrice) => {
        setFormData({ ...formData, selectedItems: formData.selectedItems.map(item => item.id === id ? { ...item, price: parseFloat(newPrice) || 0 } : item) });
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-brand-gradient italic uppercase tracking-tighter">Taller & Servicios</h1>
                    <p className="text-slate-400 font-medium">Gestión integral de órdenes de trabajo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-gradient hover:opacity-90 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-purple/20 hover:scale-105"><Plus size={20} /> Nueva Orden</button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 flex-wrap">
                        {["Todos", "En Cola", "Revisión", "Finalizados"].map((status) => (
                            <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterStatus === status ? "bg-white/10 text-white shadow-inner border border-white/5" : "text-slate-500 hover:text-white hover:bg-white/5"}`}>{status}</button>
                        ))}
                    </div>
                    <div className="hidden md:block w-px h-8 bg-white/10"></div>
                    <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="bg-slate-800/50 border border-white/10 rounded-lg py-2 px-3 text-xs font-bold text-slate-300 focus:outline-none focus:border-brand-purple/50 uppercase tracking-wider">
                        <option value="Todos">👨‍🔧 Todos los Técnicos</option>
                        {technicians.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                    <div className="hidden md:block w-px h-8 bg-white/10"></div>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="text" placeholder="Buscar Cliente, OT, Equipo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all" />
                    </div>
                </div>
            </div>

            {/* Repairs Grid */}
            <div className="grid grid-cols-1 gap-4">
                {filteredRepairs.map((repair) => (
                    <div key={repair.id} onClick={() => handleEditOrder(repair)} className="group bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/5 p-5 hover:border-brand-purple/30 transition-all hover:shadow-lg relative overflow-hidden cursor-pointer">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${repair.status === 'En cola' ? 'bg-blue-500' : 'bg-brand-purple'}`} />
                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center pl-3">
                            <div className="flex items-center gap-4 min-w-[220px]">
                                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-brand-cyan transition-all">{getDeviceIcon(repair.type)}</div>
                                <div><span className="text-[10px] font-black uppercase tracking-widest text-brand-purple block mb-0.5">{repair.id}</span><h3 className="font-bold text-lg text-white leading-tight">{repair.device}</h3><span className="text-[10px] text-slate-500 uppercase font-bold bg-slate-800 px-2 py-0.5 rounded mt-1 inline-block">{repair.job_type}</span></div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getStatusColor(repair.status)}`}>{repair.status}</span>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/5 flex items-center gap-1"><User size={10} /> {repair.customer}</span>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-brand-purple/10 text-brand-purple border border-brand-purple/20 flex items-center gap-1"><PenTool size={10} /> {repair.technician || "Sin Asignar"}</span>
                                </div>
                                <p className="text-slate-400 text-sm line-clamp-1 italic">"{repair.problem}"</p>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-slate-500 min-w-[200px] justify-end">
                                <div className="text-right"><div className="flex items-center justify-end gap-2 text-xs mb-1"><Calendar size={12} /><span>{repair.date}</span></div><div className={`flex items-center justify-end gap-1 font-bold ${repair.total_cost > 0 ? 'text-brand-cyan' : 'text-slate-600'}`}><DollarSign size={14} /><span>{repair.total_cost > 0 ? Number(repair.total_cost).toLocaleString('es-CL') : 'Pendiente'}</span></div></div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); generateOrderPDF(repair); }} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all" title="Descargar Orden PDF"><FileText size={18} /></button>
                                    <button onClick={(e) => handleShareLink(e, repair.id)} className="p-2 bg-white/5 hover:bg-brand-cyan/20 rounded-xl text-slate-400 hover:text-brand-cyan transition-all" title="Copiar Link de Seguimiento"><Share2 size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(repair.db_id, repair.id); }} className="p-2 bg-white/5 hover:bg-red-500/20 rounded-xl text-slate-400 hover:text-red-400 transition-all" title="Eliminar Orden"><Trash2 size={20} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {filteredRepairs.length === 0 && !loading && <div className="text-center py-20 text-slate-300 text-sm font-medium">No hay órdenes registradas.</div>}

            {/* CREATE/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/10 bg-slate-900 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">{editingId ? `Editar ${editingId}` : "Nueva Orden"}</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setActiveTab('order')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase ${activeTab === 'order' ? 'bg-brand-purple text-white' : 'text-slate-400 bg-slate-800'}`}>Datos Orden</button>
                                <button onClick={() => setActiveTab('report')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase ${activeTab === 'report' ? 'bg-brand-purple text-white' : 'text-slate-400 bg-slate-800'}`}>Informe Técnico</button>
                            </div>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-slate-500 hover:text-white" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {activeTab === 'order' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                            {/* ... (Secciones de cliente y tecnico sin cambios) ... */}
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Modalidad</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {['Local', 'Terreno'].map(loc => <button key={loc} onClick={() => setFormData({ ...formData, location: loc })} className={`py-2 rounded-lg text-sm font-bold ${formData.location === loc ? 'bg-brand-purple text-white' : 'bg-slate-800 text-slate-400'}`}>{loc}</button>)}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Estado</label>
                                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>{STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Tipo de Servicio</label>
                                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={formData.jobType} onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}>{JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                            </div>

                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Cliente **</label>
                                                <div className="relative">
                                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-brand-purple outline-none" placeholder="Buscar cliente..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientOptions(true); if (e.target.value === "") setFormData({ ...formData, clientId: "" }); }} onFocus={() => setShowClientOptions(true)} />
                                                    {showClientOptions && clientSearch && (
                                                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50">
                                                            {filteredClients.length > 0 ? filteredClients.map(c => (
                                                                <div key={c.id} onClick={() => { setFormData({ ...formData, clientId: c.id }); setClientSearch(c.type === 'Empresa' ? c.business_name : c.full_name); setShowClientOptions(false); }} className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 text-sm text-white flex flex-col">
                                                                    <span className="font-bold">{c.type === 'Empresa' ? c.business_name : c.full_name}</span>
                                                                    <span className="text-xs text-slate-500">{c.rut}</span>
                                                                </div>
                                                            )) : (
                                                                <div className="p-3 text-xs text-slate-500 text-center">No encontrado. <br />¿Es nuevo? Agrégalo en Clientes.</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Técnico **</label>
                                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={formData.technician} onChange={(e) => setFormData({ ...formData, technician: e.target.value })}><option value="">Seleccionar...</option>{technicians.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2"><Clock size={12} className="text-brand-purple" /> Planificación de Tiempo</label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-slate-900 border border-white/10 rounded-xl p-3 flex flex-col gap-1 hover:border-brand-purple/50 transition-all group relative">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-brand-purple transition-colors">Fecha Inicio</label>
                                                        <div className="flex items-center gap-2"><input type="datetime-local" className="bg-transparent text-white text-xs font-mono outline-none w-full uppercase" style={{ colorScheme: "dark" }} value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} /></div>
                                                    </div>
                                                    <div className="bg-slate-900 border border-white/10 rounded-xl p-3 flex flex-col gap-1 hover:border-brand-cyan/50 transition-all group relative">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-brand-cyan transition-colors">Término (Est.)</label>
                                                        <div className="flex items-center gap-2"><input type="datetime-local" className="bg-transparent text-white text-xs font-mono outline-none w-full uppercase" style={{ colorScheme: "dark" }} value={formData.estimatedEndDate} onChange={(e) => setFormData({ ...formData, estimatedEndDate: e.target.value })} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 h-full flex flex-col">

                                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Equipo</label>
                                            <div className="relative mb-4">
                                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-brand-purple outline-none" placeholder="Buscar marca o modelo..." value={equipSearch} onChange={(e) => { setEquipSearch(e.target.value); setShowEquipOptions(true); }} onFocus={() => setShowEquipOptions(true)} />
                                                {showEquipOptions && equipSearch && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20">
                                                        {filteredEquips.map(eq => (
                                                            <div key={eq.id} onClick={() => { setFormData({ ...formData, equipmentId: eq.id }); setEquipSearch(`${eq.brand} ${eq.model}`); setShowEquipOptions(false); }} className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 text-sm text-white">
                                                                {eq.brand} {eq.model}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Falla Reportada</label>
                                            <textarea className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white resize-none text-sm mb-4" value={formData.reportedFault} onChange={(e) => setFormData({ ...formData, reportedFault: e.target.value })}></textarea>

                                            <div className="mt-2">
                                                <label className="text-[10px] uppercase font-bold text-amber-500 mb-2 block flex items-center gap-2"><Lock size={12} /> Notas Internas (Privado)</label>
                                                <textarea className="w-full h-24 bg-slate-900 border border-amber-500/30 rounded-lg p-3 text-white resize-none text-sm focus:border-amber-500 transition-colors" placeholder="Apuntes visibles solo para técnicos..." value={formData.internalNotes} onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}></textarea>
                                            </div>

                                            {showFiscalFields && (
                                                <div className="mt-4 border-t border-white/10 pt-4 animate-in fade-in slide-in-from-top-2">
                                                    <label className="text-[10px] uppercase font-bold text-emerald-500 mb-2 block flex items-center gap-2">
                                                        <Receipt size={12} /> Documento Fiscal / Cierre
                                                    </label>
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <select className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" value={formData.docType} onChange={(e) => setFormData({ ...formData, docType: e.target.value })}>{DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                                            <input type="text" placeholder="N° Folio/Doc" className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" value={formData.docNumber} onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })} />
                                                        </div>
                                                        <div className="relative">
                                                            <input type="file" accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => setFormData({ ...formData, docFile: e.target.files[0] })} />
                                                            <div className={`border border-dashed ${formData.docFile || formData.docUrl ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'} rounded-lg p-3 flex items-center justify-center gap-2 transition-all`}>
                                                                {uploadingDoc ? <div className="animate-spin text-emerald-500"><Clock size={16} /></div> : <UploadCloud size={16} className={formData.docFile ? "text-emerald-500" : "text-slate-500"} />}
                                                                <span className="text-xs text-slate-400">{formData.docFile ? formData.docFile.name : (formData.docUrl ? "Documento Cargado (Click para cambiar)" : "Subir PDF del Documento")}</span>
                                                            </div>
                                                        </div>
                                                        {formData.docUrl && !formData.docFile && (<a href={formData.docUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"><FileCheck size={10} /> Ver documento actual</a>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-slate-950/50 rounded-xl border border-white/5 h-full flex flex-col p-4">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Repuestos / Servicios</label>
                                            
                                            {/* Mensaje de estado */}
                                            {formData.equipmentId && compatibleItems.length === 0 && (
                                                <p className="text-xs text-amber-500 mb-2 font-bold bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                                    ⚠️ No hay items asignados a este modelo.
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 mb-3">
                                                {/* Contenedor del Select con min-w-0 para evitar desbordes y TRUNCATE */}
                                                <div className="relative flex-1 min-w-0">
                                                    <select 
                                                        id="itemSelect" 
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-brand-purple transition-all truncate pr-8 appearance-none"
                                                        style={{ backgroundImage: 'none' }}
                                                    >
                                                        <option value="">
                                                            {formData.equipmentId ? "Seleccionar item..." : "Primero selecciona un equipo"}
                                                        </option>
                                                        {compatibleItems.map(item => {
                                                            // Cortar nombres largos para el select
                                                            const name = item.name.length > 35 ? item.name.substring(0, 35) + '...' : item.name;
                                                            return (
                                                                <option key={item.id} value={item.id}>
                                                                    {name} — ${Number(item.price_sell).toLocaleString('es-CL')}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    {/* Flecha personalizada */}
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    </div>
                                                </div>

                                                {/* Botón con shrink-0 para que nunca se oculte */}
                                                <button 
                                                    onClick={() => { 
                                                        const sel = document.getElementById('itemSelect'); 
                                                        const item = inventoryItems.find(i => String(i.id) === sel.value); 
                                                        if (item) addItemToOrder(item); 
                                                    }} 
                                                    className="bg-brand-purple hover:bg-brand-purple/80 text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-purple/20 transition-all active:scale-95"
                                                    title="Agregar a la lista"
                                                >
                                                    <Plus size={20} strokeWidth={3} />
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[200px] pr-1">
                                                {formData.selectedItems.map((item) => (
                                                    <div key={item.id} className="bg-slate-800/50 p-2.5 rounded-lg border border-white/5 flex justify-between items-center text-xs text-white group hover:bg-slate-800 transition-all">
                                                        <span className="flex-1 mr-2 font-medium line-clamp-1" title={item.name}>{item.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                                                                <span className="text-slate-500 mr-1">$</span>
                                                                <input 
                                                                    type="number" 
                                                                    value={item.price} 
                                                                    onChange={(e) => updateItemPrice(item.id, e.target.value)} 
                                                                    className="w-16 bg-transparent text-right outline-none text-brand-cyan font-mono font-bold" 
                                                                />
                                                            </div>
                                                            <button 
                                                                onClick={() => removeItemFromOrder(item.id)} 
                                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {formData.selectedItems.length === 0 && (
                                                    <div className="text-center py-8 text-slate-600 text-[10px] italic border-2 border-dashed border-white/5 rounded-xl">
                                                        Sin items agregados
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Indicador Visual de Stock */}
                                            {formData.stockDeducted && (
                                                <div className="mt-2 text-center">
                                                    <span className="text-[10px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full flex items-center justify-center gap-1 font-bold">
                                                        <BoxSelect size={12} /> Stock descontado
                                                    </span>
                                                </div>
                                            )}

                                            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-end">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Estimado</span>
                                                <span className="text-xl font-black text-brand-cyan tracking-tighter">
                                                    ${formData.selectedItems.reduce((acc, i) => acc + i.price, 0).toLocaleString('es-CL')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'report' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Problema Real</label><textarea className="w-full h-40 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white resize-none text-sm" value={formData.probReal} onChange={(e) => setFormData({ ...formData, probReal: e.target.value })}></textarea></div>
                                        <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Solución</label><textarea className="w-full h-40 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white resize-none text-sm" value={formData.solReal} onChange={(e) => setFormData({ ...formData, solReal: e.target.value })}></textarea></div>
                                    </div>
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Observaciones</label><textarea className="w-full h-20 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white resize-none text-sm" value={formData.obs} onChange={(e) => setFormData({ ...formData, obs: e.target.value })}></textarea></div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/10 bg-slate-900 flex justify-end gap-3">
                            <button onClick={resetForm} className="px-5 py-3 rounded-xl text-slate-400 hover:text-white font-bold text-sm">Cancelar</button>
                            <button onClick={handleSaveOrder} className="px-8 py-3 rounded-xl bg-brand-gradient text-white font-black uppercase tracking-widest hover:opacity-90 flex items-center gap-2"><Save size={18} /> Guardar Orden</button>
                        </div>
                    </div>
                </div>
            )}

            {showScheduler && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-6xl h-[85vh] shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="text-brand-purple" size={24} /> Disponibilidad</h3><button onClick={() => setShowScheduler(false)} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
                        <div className="flex-1 overflow-auto p-6"><div className="grid grid-cols-5 gap-4"><div className="text-center text-xs text-slate-500 font-bold">HORA</div>{technicians.map(t => <div key={t} className="text-center text-xs text-white font-bold">{t}</div>)}{Array.from({ length: 9 }, (_, i) => i + 9).map(h => (<><div key={`h-${h}`} className="text-center text-slate-500 text-xs py-2 border-t border-white/5">{h}:00</div>{technicians.map(t => (<div key={`${t}-${h}`} className="border-t border-white/5 py-2"><button onClick={() => { setFormData({ ...formData, technician: t, startDate: `${schedulerDate}T${h.toString().padStart(2, '0')}:00` }); setShowScheduler(false); }} className="w-full h-full bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-500 text-[10px] rounded opacity-0 hover:opacity-100 transition-all">+ Asignar</button></div>))}</>))}</div></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Taller;
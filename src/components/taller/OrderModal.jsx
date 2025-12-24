import { useState, useEffect, useMemo } from "react";
import {
    Save, X, Clock, Lock, Receipt, UploadCloud, 
    FileCheck, Plus, Trash2, BoxSelect, Home, Car, Search
} from "lucide-react";
import { toast } from "sonner"; 
import { supabase } from "../../supabase/client";
import { getChileTime } from "../../utils/time"; 
import { WORKSHOP_STATUSES, JOB_TYPES, DOCUMENT_TYPES, PAYMENT_METHODS } from "../../constants";

// Hooks
import { useWorkOrders } from "../../hooks/useWorkOrders";

export default function OrderModal({ 
    isOpen, onClose, editingOrder, 
    technicians, clients, equipmentsList, inventoryItems, 
    onOrderSaved 
}) {
    const { createOrder, updateOrder } = useWorkOrders();
    
    // Estados locales
    const [activeTab, setActiveTab] = useState("order");
    const [uploadingDoc, setUploadingDoc] = useState(false);
    
    // Buscadores
    const [equipSearch, setEquipSearch] = useState("");
    const [showEquipOptions, setShowEquipOptions] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [showClientOptions, setShowClientOptions] = useState(false);

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
        docType: "Boleta Electrónica", 
        docNumber: "", docUrl: "", docFile: null,
        stockDeducted: false
    });

    // Lógica para mostrar campos fiscales
    const showFiscalFields = !['En cola', 'Trabajando'].includes(formData.status);

    useEffect(() => {
        if (editingOrder) {
            const clientName = editingOrder.customer || "";
            setFormData({
                status: editingOrder.status || "En cola",
                location: editingOrder.location || "Local",
                equipmentId: editingOrder.equipment_id || "",
                jobType: editingOrder.job_type || "Reparación",
                reportedFault: editingOrder.reported_failure || "",
                clientId: editingOrder.customer_id || "",
                technician: editingOrder.technician || "",
                internalNotes: editingOrder.internal_notes || "",
                startDate: editingOrder.start_date ? editingOrder.start_date.slice(0, 16) : "",
                estimatedEndDate: editingOrder.estimated_end_date ? editingOrder.estimated_end_date.slice(0, 16) : "",
                selectedItems: editingOrder.items || [],
                probReal: editingOrder.prob_real || "", solReal: editingOrder.sol_real || "", obs: editingOrder.observations || "",
                photoBefore: editingOrder.photo_before || null, photoAfter: editingOrder.photo_after || null,
                receiverName: editingOrder.receiver_name || "", receiverSignature: editingOrder.receiver_signature || null,
                paymentMethod: editingOrder.payment_method || "Efectivo",
                docType: editingOrder.doc_type || "Boleta Electrónica", 
                docNumber: editingOrder.doc_number || "", docUrl: editingOrder.doc_url || "", docFile: null,
                stockDeducted: editingOrder.stock_deducted || false
            });
            setEquipSearch(editingOrder.device || "");
            setClientSearch(clientName);
        } else {
            resetForm();
        }
    }, [editingOrder, isOpen]);

    const resetForm = () => {
        setFormData({
            status: "En cola", location: "Local", equipmentId: "", jobType: "Reparación", reportedFault: "", clientId: "", technician: "",
            startDate: getChileTime().slice(0, 16), estimatedEndDate: "", internalNotes: "", selectedItems: [],
            probReal: "", solReal: "", obs: "", photoBefore: null, photoAfter: null, receiverName: "", receiverSignature: null, paymentMethod: "Efectivo",
            docType: "Boleta Electrónica", docNumber: "", docUrl: "", docFile: null, stockDeducted: false
        });
        setEquipSearch(""); setClientSearch(""); 
        setActiveTab("order"); setUploadingDoc(false);
    };

    // --- LÓGICA DE NEGOCIO ---

    // 🔥 FUNCIÓN NUEVA PARA EDITAR PRECIOS 🔥
    const updateItemPrice = (id, newPrice) => {
        setFormData(prev => ({
            ...prev,
            selectedItems: prev.selectedItems.map(item => 
                item.id === id ? { ...item, price: parseFloat(newPrice) || 0 } : item
            )
        }));
    };

    const handleStockDeduction = async (items) => {
        if (!items || items.length === 0) return;
        const promises = items.map(item => 
            supabase.rpc('update_inventory_stock', {
                item_id: parseInt(item.id, 10),
                quantity: parseInt(item.quantity || 1, 10),
                warehouse_name: "Bodega Local"
            })
        );
        try {
            await Promise.all(promises);
            toast.success("Inventario actualizado");
        } catch (error) {
            console.error("Error stock:", error);
        }
    };

    const registerCashFlowEntry = async (orderId, customerName, total) => {
        if (!orderId) return;
        const { data: existing } = await supabase.from('cash_flow').select('id').ilike('description', `%${orderId}%`).limit(1);
        if (existing && existing.length > 0) return;

        const neto = Math.round(total / 1.19);
        const tax = total - neto;
        const isDeferred = ["Mercado Pago"].includes(formData.paymentMethod);
        
        const { error } = await supabase.from('cash_flow').insert([{
            date: getChileTime().split('T')[0],
            type: 'income',
            category: 'VENTA',
            description: `Servicio Técnico ${orderId} | ${customerName}`,
            payment_method: formData.paymentMethod,
            total_amount: total,
            net_amount: neto,
            tax_amount: tax,
            doc_type: 'VOU',
            doc_number: orderId.replace('OT-', ''),
            is_ecommerce: false,
            status: isDeferred ? 'pending' : 'confirmed', 
            doc_url: formData.docUrl,
            items: formData.selectedItems
        }]);

        if (error) console.error("Error caja:", error);
        else toast.success("💰 Ingreso registrado en caja");
    };

    const handleSave = async () => {
        const missingFields = [];
        if (!formData.clientId) missingFields.push("Cliente");
        if (!formData.technician) missingFields.push("Técnico");
        if (!formData.startDate) missingFields.push("Fecha Inicio");
        if (!formData.equipmentId && (!equipSearch || equipSearch.trim() === "")) missingFields.push("Equipo");
        if (formData.selectedItems.length === 0) missingFields.push("Al menos 1 Item");
        if (!formData.reportedFault) missingFields.push("Falla Reportada");

        if (missingFields.length > 0) return toast.error("Faltan datos", { description: missingFields.join(", ") });

        if (formData.estimatedEndDate && new Date(formData.estimatedEndDate) <= new Date(formData.startDate)) {
            return toast.error("Error en fechas", { description: "La fecha de término debe ser posterior al inicio." });
        }

        let finalDocUrl = formData.docUrl;
        if (formData.docFile) {
            setUploadingDoc(true);
            try {
                const fileExt = formData.docFile.name.split('.').pop();
                const fileName = `docs/${editingOrder?.id || 'new'}_${Date.now()}.${fileExt}`;
                const { error } = await supabase.storage.from('repair-images').upload(fileName, formData.docFile);
                if (error) throw error;
                const { data } = supabase.storage.from('repair-images').getPublicUrl(fileName);
                finalDocUrl = data.publicUrl;
            } catch (error) {
                setUploadingDoc(false);
                return toast.error("Error al subir PDF");
            }
            setUploadingDoc(false);
        }

        const totalCost = formData.selectedItems.reduce((acc, item) => acc + (Number(item.price) * (item.quantity || 1)), 0);
        const client = clients.find(c => c.id === formData.clientId);
        const customerName = client ? (client.business_name || client.full_name) : "Cliente Manual";
        const equipment = equipmentsList.find(e => e.id === Number(formData.equipmentId));

        let shouldDeductStock = (formData.status === "Finalizado y Pagado" && !formData.stockDeducted);

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

        const promise = (async () => {
            if (editingOrder?.db_id) {
                await updateOrder(editingOrder.db_id, orderPayload);
            } else {
                await createOrder(orderPayload);
            }

            if (shouldDeductStock) {
                await handleStockDeduction(formData.selectedItems);
            }
            
            if (formData.status === "Finalizado y Pagado" && editingOrder?.id) {
                await registerCashFlowEntry(editingOrder.id, customerName, totalCost);
            }
        })();

        toast.promise(promise, {
            loading: 'Guardando...',
            success: () => {
                onOrderSaved(); 
                onClose();
                return 'Orden guardada correctamente';
            },
            error: (err) => `Error: ${err.message}`
        });
    };

    // UI Helpers
    const filteredClients = clientSearch ? clients.filter(c => {
        const str = `${c.full_name} ${c.business_name} ${c.rut}`.toLowerCase();
        return str.includes(clientSearch.toLowerCase());
    }).slice(0, 5) : []; 

    const filteredEquips = equipSearch ? equipmentsList.filter(eq => {
        const str = `${eq.brand} ${eq.model} ${eq.type}`.toLowerCase();
        return str.includes(equipSearch.toLowerCase());
    }).slice(0, 5) : [];

    const compatibleItems = useMemo(() => {
        const selectedEquipmentObj = equipmentsList.find(e => e.id === Number(formData.equipmentId));
        if (!selectedEquipmentObj) return []; // Retorna vacío si no hay equipo seleccionado
        
        const fullDeviceName = `${selectedEquipmentObj.brand} ${selectedEquipmentObj.model}`.toLowerCase().trim();
        return inventoryItems.filter(item => {
            const models = item.compatible_models || [];
            if (item.type === 'Servicio' && models.length === 0) return true;
            if (item.type !== 'Servicio' && models.length === 0) return false;
            return models.some(m => fullDeviceName.includes(m.toLowerCase().trim()) || m.toLowerCase().trim().includes(fullDeviceName));
        });
    }, [inventoryItems, formData.equipmentId, equipmentsList]);

    const addItem = (item) => {
        if (!formData.selectedItems.some(i => i.id === item.id)) {
            setFormData(p => ({ ...p, selectedItems: [...p.selectedItems, { id: item.id, name: item.name, price: item.price_sell, quantity: 1 }] }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in duration-200">
                
                <div className="p-6 border-b border-white/10 bg-slate-900 flex justify-between items-center">
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">
                        {editingOrder ? `Editar ${editingOrder.id}` : "Nueva Orden"}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveTab('order')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase ${activeTab === 'order' ? 'bg-brand-purple text-white' : 'text-slate-400 bg-slate-800'}`}>Datos Orden</button>
                        <button onClick={() => setActiveTab('report')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase ${activeTab === 'report' ? 'bg-brand-purple text-white' : 'text-slate-400 bg-slate-800'}`}>Informe Técnico</button>
                    </div>
                    <button onClick={onClose}><X className="text-slate-500 hover:text-white" /></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {activeTab === 'order' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* COLUMNA 1 */}
                            <div className="lg:col-span-1 space-y-4 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Modalidad</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Local', 'Terreno'].map(loc => (
                                            <button key={loc} onClick={() => setFormData({ ...formData, location: loc })} className={`py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${formData.location === loc ? 'bg-brand-purple text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                {loc === 'Local' ? <Home size={14}/> : <Car size={14}/>} {loc}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Estado</label>
                                    <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>{WORKSHOP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Tipo de Servicio</label>
                                    <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={formData.jobType} onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}>{JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                </div>
                                
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Cliente</label>
                                    <div className="relative">
                                        <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-brand-purple outline-none" placeholder="Buscar cliente..." value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setShowClientOptions(true); }} onFocus={() => setShowClientOptions(true)} />
                                        {showClientOptions && clientSearch && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-50">
                                                {filteredClients.map(c => (
                                                    <div key={c.id} onClick={() => { setFormData({ ...formData, clientId: c.id }); setClientSearch(c.type === 'Empresa' ? c.business_name : c.full_name); setShowClientOptions(false); }} className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 text-sm text-white">
                                                        <span className="font-bold block">{c.type === 'Empresa' ? c.business_name : c.full_name}</span>
                                                    </div>
                                                ))}
                                                {filteredClients.length === 0 && <div className="p-3 text-xs text-slate-500">No encontrado</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Técnico</label>
                                    <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={formData.technician} onChange={(e) => setFormData({ ...formData, technician: e.target.value })}><option value="">Seleccionar...</option>{technicians.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Inicio</label><input type="datetime-local" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white text-xs" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} /></div>
                                    <div><label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Fin Est.</label><input type="datetime-local" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white text-xs" value={formData.estimatedEndDate} onChange={(e) => setFormData({...formData, estimatedEndDate: e.target.value})} /></div>
                                </div>
                            </div>

                            {/* COLUMNA 2 */}
                            <div className="lg:col-span-1 space-y-4 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                <div className="relative">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Equipo</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-brand-purple outline-none" placeholder="Buscar modelo..." value={equipSearch} onChange={(e) => { setEquipSearch(e.target.value); setShowEquipOptions(true); }} onFocus={() => setShowEquipOptions(true)} />
                                    {showEquipOptions && equipSearch && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-20">
                                            {filteredEquips.map(eq => (
                                                <div key={eq.id} onClick={() => { setFormData({ ...formData, equipmentId: eq.id }); setEquipSearch(`${eq.brand} ${eq.model}`); setShowEquipOptions(false); }} className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 text-sm text-white">{eq.brand} {eq.model}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Falla Reportada</label><textarea className="w-full h-20 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm resize-none" value={formData.reportedFault} onChange={(e) => setFormData({ ...formData, reportedFault: e.target.value })}></textarea></div>
                                <div><label className="text-[10px] uppercase font-bold text-amber-500 mb-2 block flex items-center gap-2"><Lock size={12}/> Notas Internas</label><textarea className="w-full h-20 bg-slate-900 border border-amber-500/30 rounded-lg p-3 text-white text-sm resize-none focus:border-amber-500" value={formData.internalNotes} onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}></textarea></div>

                                {/* SECCIÓN DATOS FISCALES */}
                                {showFiscalFields && (
                                    <div className="mt-4 border-t border-white/10 pt-4 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-[10px] uppercase font-bold text-emerald-500 mb-2 block flex items-center gap-2">
                                            <Receipt size={12} /> Documento Fiscal / Cierre
                                        </label>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <select className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" value={formData.docType} onChange={(e) => setFormData({ ...formData, docType: e.target.value })}>
                                                    {DOCUMENT_TYPES.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
                                                </select>
                                                <input type="text" placeholder="N° Folio" className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" value={formData.docNumber} onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })} />
                                            </div>
                                            
                                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs" value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}>
                                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>

                                            <div className="relative">
                                                <input type="file" accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => setFormData({ ...formData, docFile: e.target.files[0] })} />
                                                <div className={`border border-dashed ${formData.docFile || formData.docUrl ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'} rounded-lg p-3 flex items-center justify-center gap-2 transition-all`}>
                                                    {uploadingDoc ? <div className="animate-spin text-emerald-500"><Clock size={16} /></div> : <UploadCloud size={16} className={formData.docFile ? "text-emerald-500" : "text-slate-500"} />}
                                                    <span className="text-xs text-slate-400">{formData.docFile ? formData.docFile.name : (formData.docUrl ? "Documento Cargado" : "Subir PDF")}</span>
                                                </div>
                                            </div>
                                            {formData.docUrl && !formData.docFile && (<a href={formData.docUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"><FileCheck size={10} /> Ver documento</a>)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* COLUMNA 3 */}
                            <div className="lg:col-span-1 bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col h-full">
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Repuestos y Servicios</label>
                                
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="relative flex-1 min-w-0">
                                        <select 
                                            id="modalItemSelect" 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs truncate pr-8 appearance-none"
                                        >
                                            <option value="">{formData.equipmentId ? "Seleccionar item..." : "Seleccione Equipo"}</option>
                                            {compatibleItems.map(i => <option key={i.id} value={i.id}>{i.name} - ${i.price_sell}</option>)}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><Search size={12}/></div>
                                    </div>
                                    <button onClick={() => { const val = document.getElementById('modalItemSelect').value; const it = inventoryItems.find(x => String(x.id) === val); if(it) addItem(it); }} className="bg-brand-purple p-2 rounded-lg text-white shrink-0"><Plus size={16}/></button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[300px]">
                                    {formData.selectedItems.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-white/5 text-xs text-white">
                                            <span className="truncate flex-1 pr-2">{item.name}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* 🔥 INPUT DE PRECIO EDITABLE 🔥 */}
                                                <div className="flex items-center bg-slate-950 border border-slate-700 rounded px-2 py-1">
                                                    <span className="text-slate-500 mr-1">$</span>
                                                    <input 
                                                        type="number" 
                                                        value={item.price} 
                                                        onChange={(e) => updateItemPrice(item.id, e.target.value)} 
                                                        className="w-16 bg-transparent text-right outline-none text-brand-cyan font-mono font-bold" 
                                                    />
                                                </div>
                                                <button onClick={() => setFormData(p => ({...p, selectedItems: p.selectedItems.filter(x => x.id !== item.id)}))} className="text-slate-500 hover:text-red-400"><Trash2 size={12}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-auto pt-4 border-t border-white/10 flex justify-between items-end">
                                    <span className="text-xs font-bold text-slate-400">TOTAL</span>
                                    <span className="text-xl font-black text-brand-cyan">${formData.selectedItems.reduce((acc, i) => acc + i.price, 0).toLocaleString('es-CL')}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'report' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Diagnóstico Real</label><textarea className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm resize-none" value={formData.probReal} onChange={(e) => setFormData({ ...formData, probReal: e.target.value })}></textarea></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Solución Técnica</label><textarea className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm resize-none" value={formData.solReal} onChange={(e) => setFormData({ ...formData, solReal: e.target.value })}></textarea></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-3 rounded-xl text-slate-400 hover:text-white font-bold text-sm">Cancelar</button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-brand-gradient text-white font-black uppercase tracking-widest hover:opacity-90 flex items-center gap-2 shadow-lg"><Save size={18} /> Guardar Orden</button>
                </div>
            </div>
        </div>
    );
}
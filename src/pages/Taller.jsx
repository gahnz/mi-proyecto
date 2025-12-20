import { useState, useEffect } from "react";
import {
    Wrench, Plus, Search, CheckCircle2, AlertCircle, MoreVertical,
    Smartphone, Laptop, Tablet, User, Calendar, DollarSign,
    MapPin, Clock, FileText, Settings, PenTool, Hash, X, Trash2,
    Save, Monitor, Printer, Cpu, Image, Camera, UserCheck, Banknote, CreditCard, Landmark
} from "lucide-react";
import { INITIAL_REPAIRS, INITIAL_EQUIPMENT, EQUIP_TYPES } from "../data/mockData";
import { storage } from "../services/storage";
import { supabase } from "../supabase/client";

// La lista de técnicos ahora se carga dinámicamente desde Supabase
const JOB_TYPES = ["Mantenimiento", "Reparación", "Revisión", "Configuración"];
const STATUS_LIST = [
    "En cola",
    "Trabajando",
    "Revisión del Coordinador",
    "Notificado y no pagado",
    "Pagado y no retirado",
    "Retirado y no pagado",
    "Finalizado y Pagado",
    "Cancelado"
];

const Taller = () => {
    // Main Data State
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [technicians, setTechnicians] = useState([]); // Nueva lista dinámica de técnicos
    const [filterStatus, setFilterStatus] = useState("Todos");
    const [filterLocation, setFilterLocation] = useState("Todos"); // New Location Filter
    const [filterTech, setFilterTech] = useState("Todos");
    const [searchTerm, setSearchTerm] = useState("");

    // Aux Data State
    const [clients, setClients] = useState([]);
    const [equipmentsList, setEquipmentsList] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [equipSearch, setEquipSearch] = useState("");
    const [showEquipOptions, setShowEquipOptions] = useState(false);
    const [activeTab, setActiveTab] = useState("order");

    // Scheduler State
    const [showScheduler, setShowScheduler] = useState(false);
    const [schedulerDate, setSchedulerDate] = useState(new Date().toISOString().split('T')[0]);

    // New Order Form State
    const [formData, setFormData] = useState({
        status: "En cola",
        location: "Local", // Local or Terreno
        equipmentId: "", // ID of selected equipment
        jobType: "Reparación",
        reportedFault: "",
        clientId: "",
        technician: "",
        startDate: new Date().toISOString().split('T')[0],
        estimatedEndDate: "",
        internalNotes: "",
        selectedItems: [], // { id, name, price, quantity }
        // Technical Report Fields
        probReal: "", // Problema Real (Obligatorio)
        solReal: "", // Solucion Real (Obligatorio)
        obs: "", // Observaciones (Opcional)
        photoBefore: null,
        photoAfter: null,
        receiverName: "",
        receiverSignature: null,
        paymentMethod: "Efectivo"
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);

        // Parallel data fetching
        const [equipData, invData] = await Promise.all([
            storage.get('equipos_list', INITIAL_EQUIPMENT),
            storage.get('inventory_items', [])
        ]);

        // Fetch Work Orders from Supabase
        const { data: repairsData } = await supabase
            .from("work_orders")
            .select("*")
            .order('created_at', { ascending: false });

        // Fetch Clients from Supabase
        const { data: clientsData } = await supabase.from("customers").select("id, full_name, business_name, type, address, comuna, region");

        // Fetch Technicians from Profiles
        const { data: techData } = await supabase
            .from("profiles")
            .select("full_name")
            .in("role", ["tecnico", "coordinador", "admin"]);

        setRepairs(repairsData?.map(r => ({
            ...r,
            id: r.display_id || r.id, // Use display_id for UI
            db_id: r.id, // Keep the UUID for updates
            type: r.job_type,
            problem: r.reported_fault,
            customer: r.customer_name,
            technician: r.technician_name
        })) || []);

        setEquipmentsList(equipData || []);
        setInventoryItems(invData || []);
        if (clientsData) setClients(clientsData);
        if (techData) setTechnicians(techData.map(t => t.full_name).filter(Boolean));

        setLoading(false);
    };

    // --- Actions ---

    const handleEditOrder = (repair) => {
        setEditingId(repair.id);
        setActiveTab("order");

        setFormData({
            status: repair.status || "En cola",
            location: repair.location || "Local",
            equipmentId: repair.equipment_id || "",
            jobType: repair.job_type || "Reparación",
            reported_fault: repair.reported_fault || "",
            reportedFault: repair.reported_fault || "", // Keep both for safety
            clientId: repair.customer_id || "",
            technician: repair.technician_name || "",
            startDate: repair.start_date || repair.startDate || "",
            estimatedEndDate: repair.estimated_end_date || repair.estimatedEndDate || "",
            internalNotes: repair.internal_notes || "",
            selectedItems: repair.items || [],
            // Technical Report Fields
            probReal: repair.prob_real || "",
            solReal: repair.sol_real || "",
            obs: repair.observations || "",
            photoBefore: repair.photo_before || null,
            photoAfter: repair.photo_after || null,
            receiverName: repair.receiver_name || "",
            receiverSignature: repair.receiver_signature || null,
            paymentMethod: repair.paymentMethod || "Efectivo"
        });

        setEquipSearch(repair.device || repair.device_name || ""); // Pre-fill search visual
        setIsModalOpen(true);
    };

    const handleSaveOrder = async () => {
        if (!formData.clientId || !formData.technician) {
            alert("Por favor complete los campos obligatorios (Cliente, Técnico).");
            return;
        }

        const totalCost = formData.selectedItems.reduce((acc, item) => acc + (Number(item.price) * (item.quantity || 1)), 0);
        const client = clients.find(c => c.id === formData.clientId);
        const equipment = equipmentsList.find(e => e.id === Number(formData.equipmentId));

        // Map UI fields to Database Columns
        const dbPayload = {
            status: formData.status,
            location: formData.location,
            job_type: formData.jobType,
            customer_id: formData.clientId,
            customer_name: client ? (client.business_name || client.full_name) : "Cliente Desc.",
            equipment_id: formData.equipmentId ? Number(formData.equipmentId) : null,
            device_name: equipment ? `${equipment.brand} ${equipment.model}` : (formData.equipmentId ? "Equipo Desc." : (equipSearch || "Genérico")),
            device_type: equipment ? equipment.type : "Otro",
            reported_fault: formData.reportedFault,
            internal_notes: formData.internalNotes,
            technician_name: formData.technician,
            start_date: formData.startDate || new Date().toISOString(),
            estimated_end_date: formData.estimatedEndDate || null,
            items: formData.selectedItems,
            total_cost: totalCost,
            payment_method: formData.paymentMethod,
            prob_real: formData.probReal,
            sol_real: formData.solReal,
            observations: formData.obs,
            photo_before: formData.photoBefore,
            photo_after: formData.photoAfter,
            receiver_name: formData.receiverName,
            receiver_signature: formData.receiverSignature
        };

        const registerServiceInCashFlow = async (order, cost) => {
            const movements = await storage.get('cash_flow_movements', []);
            if (movements.some(m => m.description.includes(order.id))) return;

            const neto = Math.round(cost / 1.19);
            const iva = cost - neto;

            const newMovement = {
                id: `MOV-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                type: "income",
                docType: "VOU",
                docNumber: order.id.split('-')[1] || "0",
                description: `Servicio Técnico ${order.id} | ${order.customer}`,
                category: "VENTA",
                paymentMethod: order.paymentMethod || "Efectivo",
                netAmount: neto,
                taxAmount: iva,
                totalAmount: cost,
                isTaxable: true,
                created_at: new Date().toISOString()
            };

            await storage.set('cash_flow_movements', [newMovement, ...movements]);
        };

        if (editingId) {
            // Find the database UUID (db_id) we stored during load
            const orderToUpdate = repairs.find(r => r.id === editingId);
            const { error } = await supabase
                .from("work_orders")
                .update(dbPayload)
                .eq("id", orderToUpdate.db_id || editingId);

            if (error) {
                alert("Error al actualizar la orden: " + error.message);
                return;
            }
        } else {
            const { error } = await supabase
                .from("work_orders")
                .insert([dbPayload]);

            if (error) {
                alert("Error al crear la orden: " + error.message);
                return;
            }
        }

        if (dbPayload.status === "Finalizado y Pagado") {
            await registerServiceInCashFlow({ id: editingId || "Nueva OT", customer: dbPayload.customer_name }, totalCost);
        }

        setIsModalOpen(false);
        resetForm();
        loadData(); // Refresh from DB
    };

    const resetForm = () => {
        setFormData({
            status: "En cola",
            location: "Local",
            equipmentId: "",
            jobType: "Reparación",
            reportedFault: "",
            clientId: "",
            technician: "",
            startDate: new Date().toISOString().split('T')[0],
            estimatedEndDate: "",
            internalNotes: "",
            selectedItems: [],
            probReal: "",
            solReal: "",
            obs: "",
            photoBefore: null,
            photoAfter: null,
            receiverName: "",
            receiverSignature: null,
            paymentMethod: "Efectivo"
        });
        setEquipSearch("");
        setShowEquipOptions(false);
        setEditingId(null);
        setActiveTab("order");
    };

    const addItemToOrder = (item) => {
        // Check if already added
        if (formData.selectedItems.some(i => i.id === item.id)) return;

        const newItem = {
            id: item.id,
            name: item.name,
            price: item.price_sell, // Default price, editable
            quantity: 1
        };

        setFormData({
            ...formData,
            selectedItems: [...formData.selectedItems, newItem]
        });
    };

    const updateItemPrice = (id, newPrice) => {
        setFormData({
            ...formData,
            selectedItems: formData.selectedItems.map(item =>
                item.id === id ? { ...item, price: Number(newPrice) } : item
            )
        });
    };

    const removeItemFromOrder = (id) => {
        setFormData({
            ...formData,
            selectedItems: formData.selectedItems.filter(item => item.id !== id)
        });
    };

    // --- Helpers ---

    const getStatusColor = (status) => {
        switch (status) {
            case "En cola": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
            case "Trabajando": return "bg-brand-purple/10 text-brand-purple border-brand-purple/20";
            case "Revisión del Coordinador": return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
            case "Notificado y no pagado": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
            case "Pagado y no retirado": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "Retirado y no pagado": return "bg-red-500/10 text-red-400 border-red-500/20";
            case "Finalizado y Pagado": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "Cancelado": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
            default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
        }
    };

    const getDeviceIcon = (type) => {
        // Safe mapping
        switch ((type || "").toLowerCase()) {
            case "smartphone": case "celular": return <Smartphone size={18} />;
            case "notebook": case "laptop": return <Laptop size={18} />;
            case "tablet": return <Tablet size={18} />;
            case "impresora": return <Printer size={18} />;
            case "pc": return <Monitor size={18} />;
            default: return <Cpu size={18} />;
        }
    };

    // Filter Logic
    const filteredRepairs = repairs.filter(repair => {
        let matchesStatus = true;
        if (filterStatus !== "Todos") {
            if (filterStatus === "En Cola") {
                matchesStatus = repair.status === "En cola";
            } else if (filterStatus === "Revisión") {
                matchesStatus = ["Trabajando", "Revisión del Coordinador", "Notificado y no pagado", "Pagado y no retirado", "Retirado y no pagado"].includes(repair.status);
            } else if (filterStatus === "Finalizados") {
                matchesStatus = ["Finalizado y Pagado", "Cancelado"].includes(repair.status);
            } else {
                matchesStatus = repair.status === filterStatus;
            }
        }

        const matchesLocation = filterLocation === "Todos" || (repair.location || "Local") === filterLocation;
        const matchesTech = filterTech === "Todos" || (repair.technician || repair.technician_name) === filterTech;
        const matchesSearch =
            (repair.customer || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (repair.device || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (repair.id || "").toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch && matchesLocation && matchesTech;
    });

    // Derived State for Modal
    const selectedEquipmentObj = equipmentsList.find(e => e.id === Number(formData.equipmentId));

    // Filter compatible items for the selected equipment
    const compatibleItems = selectedEquipmentObj ? inventoryItems.filter(item =>
        !item.compatible_models || // Universal
        item.compatible_models.length === 0 ||
        item.compatible_models.includes(`${selectedEquipmentObj.brand} ${selectedEquipmentObj.model}`)
    ) : [];

    // Filtered Equipments for Search
    const filteredEquips = equipmentsList.filter(eq =>
        eq.brand.toLowerCase().includes(equipSearch.toLowerCase()) ||
        eq.model.toLowerCase().includes(equipSearch.toLowerCase()) ||
        eq.type.toLowerCase().includes(equipSearch.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-brand-gradient italic uppercase tracking-tighter">
                        Taller & Servicios
                    </h1>
                    <p className="text-slate-400 font-medium">Gestión integral de órdenes de trabajo.</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="bg-brand-gradient hover:opacity-90 transition-all text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-purple/20 hover:scale-105"
                >
                    <Plus size={20} />
                    Nueva Orden
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="En Cola"
                    value={repairs.filter(r => r.status === "En cola").length}
                    icon={<Clock size={24} className="text-slate-400" />}
                    delay={0}
                />
                <StatCard
                    title="En Revisión"
                    value={repairs.filter(r => ["Trabajando", "Revisión del Coordinador", "Notificado y no pagado", "Pagado y no retirado", "Retirado y no pagado"].includes(r.status)).length}
                    icon={<AlertCircle size={24} className="text-amber-400" />}
                    delay={100}
                />
                <StatCard
                    title="Finalizados"
                    value={repairs.filter(r => r.status === "Finalizado y Pagado" || r.status === "Cancelado").length}
                    icon={<CheckCircle2 size={24} className="text-emerald-400" />}
                    delay={200}
                />
                <StatCard
                    title="Total Mes"
                    value={repairs.length}
                    icon={<Hash size={24} className="text-brand-purple" />}
                    delay={300}
                />
            </div>

            {/* Filters and Search */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Status Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {["Todos", "En Cola", "Revisión", "Finalizados"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterStatus === status
                                    ? "bg-white/10 text-white shadow-inner border border-white/5"
                                    : "text-slate-500 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    {/* Vertical Divider (Hidden on mobile) */}
                    <div className="hidden md:block w-px h-8 bg-white/10"></div>

                    {/* Location Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {["Todos", "Local", "Terreno"].map((loc) => (
                            <button
                                key={loc}
                                onClick={() => setFilterLocation(loc)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${filterLocation === loc
                                    ? "bg-brand-purple/20 text-brand-purple border border-brand-purple/50"
                                    : "text-slate-500 hover:text-white hover:bg-white/5 border border-transparent"
                                    }`}
                            >
                                {loc === 'Local' && <MapPin size={12} />}
                                {loc === 'Terreno' && <Smartphone size={12} />}
                                {loc === 'Todos' && <Search size={12} />}
                                {loc}
                            </button>
                        ))}
                    </div>

                    {/* Vertical Divider */}
                    <div className="hidden md:block w-px h-8 bg-white/10"></div>

                    {/* Tech Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={filterTech}
                            onChange={(e) => setFilterTech(e.target.value)}
                            className="bg-slate-800/50 border border-white/10 rounded-lg py-2 px-3 text-xs font-bold text-slate-300 focus:outline-none focus:border-brand-purple/50 transition-all uppercase tracking-wider min-w-[200px]"
                        >
                            <option value="Todos">👨‍🔧 TODOS LOS TÉCNICOS</option>
                            {technicians.map(t => (
                                <option key={t} value={t}>{t.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar OT, Cliente o Equipo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all"
                    />
                </div>
            </div>

            {/* Repairs Kanban/Grid */}
            <div className="grid grid-cols-1 gap-4">
                {filteredRepairs.map((repair) => (
                    <div
                        key={repair.id}
                        className="group bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/5 p-5 hover:border-brand-purple/30 transition-all hover:shadow-lg hover:shadow-brand-purple/5 relative overflow-hidden"
                    >
                        {/* Status Bar Indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${repair.priority === 'Alta' ? 'bg-red-500' :
                            repair.priority === 'Media' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`} />

                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center pl-3">

                            {/* Device Info */}
                            <div className="flex items-center gap-4 min-w-[220px]">
                                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-brand-cyan group-hover:scale-105 transition-all">
                                    {getDeviceIcon(repair.deviceType || repair.type)}
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple block mb-0.5">{repair.id}</span>
                                    <h3 className="font-bold text-lg text-white leading-tight">{repair.device}</h3>
                                    {/* Location Badge */}
                                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-1 ${(repair.location || "Local") === "Terreno"
                                        ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        }`}>
                                        <MapPin size={10} /> {repair.location || "Local"}
                                    </div>
                                </div>
                            </div>

                            {/* Main Details */}
                            <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getStatusColor(repair.status)}`}>
                                        {repair.status}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/5 flex items-center gap-1">
                                        <User size={10} /> {repair.customer}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/5 flex items-center gap-1">
                                        <Wrench size={10} /> {repair.type || "Servicio"}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-brand-purple/10 text-brand-purple border border-brand-purple/20 flex items-center gap-1">
                                        <PenTool size={10} /> {repair.technician || repair.technician_name || "Sin Asignar"}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm line-clamp-2 md:line-clamp-1 italic">"{repair.problem}"</p>
                            </div>

                            {/* Meta Info & Actions */}
                            <div className="flex items-center gap-6 text-sm text-slate-500 min-w-[200px] justify-end">
                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-2 text-xs mb-1" title="Fecha inicio">
                                        <Calendar size={12} />
                                        <span>{repair.date || repair.startDate}</span>
                                    </div>
                                    <div className={`flex items-center justify-end gap-1 font-bold ${repair.cost > 0 ? 'text-brand-cyan' : 'text-slate-600'}`}>
                                        <DollarSign size={14} />
                                        <span>{repair.cost > 0 ? repair.cost.toLocaleString() : 'Pendiente'}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleEditOrder(repair)}
                                    className="p-2 bg-white/5 hover:bg-brand-purple/20 rounded-xl text-slate-400 hover:text-brand-purple transition-all"
                                >
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredRepairs.length === 0 && !loading && (
                <div className="text-center py-20 text-slate-500">
                    <Wrench size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No se encontraron órdenes de trabajo.</p>
                </div>
            )}

            {/* --- CREATE ORDER MODAL --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 bg-slate-900 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">
                                    {editingId ? `Editar Orden: ${editingId}` : "Nueva Orden de Trabajo"}
                                </h2>

                                {/* TABS */}
                                <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg inline-flex">
                                    <button
                                        onClick={() => setActiveTab('order')}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'order' ? 'bg-brand-purple text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <FileText size={14} /> Datos de la Orden
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('report')}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'report' ? 'bg-brand-purple text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <Wrench size={14} /> Informe Técnico
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {activeTab === 'order' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                                    {/* LEFT COLUMN: BASIC INFO */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <SectionTitle icon={<MapPin size={16} />} title="1. Ubicación y Tipo" />

                                        <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Modalidad</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {['Local', 'Terreno'].map(loc => (
                                                        <button
                                                            key={loc}
                                                            onClick={() => setFormData({ ...formData, location: loc })}
                                                            className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${formData.location === loc
                                                                ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20'
                                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                                }`}
                                                        >
                                                            {loc}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Tipo de Trabajo</label>
                                                <select
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-brand-purple outline-none"
                                                    value={formData.jobType}
                                                    onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                                                >
                                                    {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Estado de la Orden</label>
                                                <select
                                                    className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-brand-purple outline-none font-bold ${formData.status === 'Trabajando' ? 'text-brand-purple' :
                                                        formData.status === 'Finalizado y Pagado' ? 'text-emerald-400' :
                                                            formData.status === 'Cancelado' ? 'text-rose-400' :
                                                                formData.status === 'Revisión del Coordinador' ? 'text-indigo-400' : 'text-white'
                                                        }`}
                                                    value={formData.status}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                >
                                                    {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>

                                            {formData.status === "Finalizado y Pagado" && (
                                                <div className="animate-in slide-in-from-top-2">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Medio de Pago</label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[
                                                            { id: 'Efectivo', icon: <Banknote size={14} /> },
                                                            { id: 'BancoChile', icon: <Landmark size={14} /> },
                                                            { id: 'Mercado Pago', icon: <CreditCard size={14} /> }
                                                        ].map(m => (
                                                            <button
                                                                key={m.id}
                                                                onClick={() => setFormData({ ...formData, paymentMethod: m.id })}
                                                                className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${formData.paymentMethod === m.id
                                                                    ? 'bg-white text-slate-950 border-white shadow-xl scale-105'
                                                                    : 'bg-slate-950 text-slate-500 border-white/5 hover:border-white/20'
                                                                    }`}
                                                            >
                                                                {m.icon}
                                                                <span className="text-[8px] font-black uppercase mt-1">{m.id}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <SectionTitle
                                                    icon={<Calendar size={16} />}
                                                    title="Fechas"
                                                    action={
                                                        <button onClick={() => setShowScheduler(true)} className="text-[10px] text-brand-purple hover:underline cursor-pointer font-bold flex items-center gap-1">
                                                            <Calendar size={12} /> Ver Disponibilidad
                                                        </button>
                                                    }
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-xs text-slate-500 block mb-1">Inicio</span>
                                                        <input
                                                            type="datetime-local"
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                                                            value={formData.startDate}
                                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-slate-500 block mb-1">Fin Est.</span>
                                                        <input
                                                            type="datetime-local"
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                                                            value={formData.estimatedEndDate}
                                                            onChange={(e) => setFormData({ ...formData, estimatedEndDate: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <SectionTitle icon={<User size={16} />} title="2. Asignación" />
                                        <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Técnico Ejecutor **</label>
                                                <select
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-brand-purple outline-none"
                                                    value={formData.technician}
                                                    onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                                                >
                                                    <option value="">Seleccionar Técnico...</option>
                                                    {technicians.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Cliente **</label>
                                                <select
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-brand-purple outline-none"
                                                    value={formData.clientId}
                                                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                                >
                                                    <option value="">Seleccionar Cliente...</option>
                                                    {clients.map(c =>
                                                        <option key={c.id} value={c.id}>
                                                            {c.type === 'Empresa' ? `🏢 ${c.business_name}` : `👤 ${c.full_name}`}
                                                        </option>
                                                    )}
                                                </select>
                                                {formData.clientId && formData.location === 'Terreno' && (
                                                    <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-400">
                                                        {(() => {
                                                            const client = clients.find(c => c.id === formData.clientId);
                                                            return client ? (
                                                                <div className="flex items-start gap-2">
                                                                    <MapPin size={14} className="text-brand-purple mt-0.5 shrink-0" />
                                                                    <div>
                                                                        <p className="font-bold text-slate-300">{client.address}</p>
                                                                        <p>{client.comuna}, {client.region}</p>
                                                                    </div>
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* MIDDLE COLUMN: EQUIPMENT & FAULT */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <SectionTitle icon={<Monitor size={16} />} title="3. Equipo y Falla" />
                                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 h-full flex flex-col">
                                            <div className="mb-4 relative">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Equipo a Intervenir **</label>

                                                {/* SEARCHABLE DROPDOWN */}
                                                <div className="relative">
                                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white focus:border-brand-purple outline-none text-sm transition-all"
                                                        placeholder="Buscar por marca, modelo o tipo..."
                                                        value={equipSearch}
                                                        onChange={(e) => {
                                                            setEquipSearch(e.target.value);
                                                            setFormData({ ...formData, equipmentId: "" }); // Clear selection on type
                                                            setShowEquipOptions(true);
                                                        }}
                                                        onFocus={() => setShowEquipOptions(true)}
                                                    />
                                                    {formData.equipmentId && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-cyan">
                                                            <CheckCircle2 size={16} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* DROPDOWN OPTIONS */}
                                                {showEquipOptions && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setShowEquipOptions(false)}></div>
                                                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 custom-scrollbar border-t-4 border-t-brand-purple">
                                                            {filteredEquips.length > 0 ? filteredEquips.map(eq => (
                                                                <div
                                                                    key={eq.id}
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, equipmentId: eq.id, selectedItems: [] });
                                                                        setEquipSearch(`${eq.brand} ${eq.model}`);
                                                                        setShowEquipOptions(false);
                                                                    }}
                                                                    className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 flex items-center gap-3 transition-colors"
                                                                >
                                                                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-400">
                                                                        {getDeviceIcon(eq.type)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-white">{eq.brand} {eq.model}</p>
                                                                        <p className="text-[10px] text-brand-purple uppercase tracking-wider">{eq.type}</p>
                                                                    </div>
                                                                </div>
                                                            )) : (
                                                                <div className="p-4 text-center text-slate-500 text-xs">
                                                                    No se encontraron equipos...
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {formData.equipmentId && !showEquipOptions && (
                                                    <div className="mt-2 text-xs text-brand-cyan flex items-center gap-1 animate-fadeIn">
                                                        <CheckCircle2 size={12} />
                                                        Seleccionado: <span className="font-bold text-white">{equipmentsList.find(e => e.id == formData.equipmentId)?.brand} {equipmentsList.find(e => e.id == formData.equipmentId)?.model}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-4 flex-1">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Falla Reportada</label>
                                                <textarea
                                                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-purple outline-none resize-none placeholder-slate-600 custom-scrollbar"
                                                    placeholder="Describa el problema detalladamente..."
                                                    value={formData.reportedFault}
                                                    onChange={(e) => setFormData({ ...formData, reportedFault: e.target.value })}
                                                ></textarea>
                                            </div>

                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Notas Internas</label>
                                                <textarea
                                                    className="w-full h-20 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-purple outline-none resize-none placeholder-slate-600 custom-scrollbar"
                                                    placeholder="Notas para el técnico (Opcional)..."
                                                    value={formData.internalNotes}
                                                    onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                                                ></textarea>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT COLUMN: ITEMS & COSTS */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <SectionTitle icon={<DollarSign size={16} />} title="4. Items y Servicios" />
                                        <div className="bg-slate-950/50 rounded-xl border border-white/5 flex flex-col h-full overflow-hidden">

                                            {/* Item Selector */}
                                            <div className="p-4 border-b border-white/5 bg-slate-900/50">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">
                                                    Agregar Items {selectedEquipmentObj ? `(Compatibles con ${selectedEquipmentObj.model})` : ''}
                                                </label>
                                                <div className="flex gap-2">
                                                    <select id="itemSelect" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none">
                                                        <option value="">Seleccionar Item...</option>
                                                        {compatibleItems.map(item => (
                                                            <option key={item.id} value={item.id}>{item.name} (${item.price_sell})</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            const select = document.getElementById('itemSelect');
                                                            const itemId = select.value;
                                                            const item = inventoryItems.find(i => String(i.id) === itemId);
                                                            if (item) { addItemToOrder(item); select.value = ""; }
                                                        }}
                                                        className="bg-brand-purple hover:bg-brand-purple/80 text-white rounded-lg px-3 transition-colors"
                                                    >
                                                        <Plus size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Selected Items List */}
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                                {formData.selectedItems.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                                                        <FileText size={48} className="mb-2" />
                                                        <p className="text-xs text-center px-4">Seleccione equipo para ver ítems compatibles, o agregue ítems manuales.</p>
                                                    </div>
                                                ) : (
                                                    formData.selectedItems.map((item, idx) => (
                                                        <div key={idx} className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center group border border-white/5">
                                                            <div className="flex-1">
                                                                <div className="text-xs font-bold text-white">{item.name}</div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-slate-500 uppercase">Precio:</span>
                                                                    <input
                                                                        type="number"
                                                                        className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-brand-cyan w-20 outline-none focus:border-brand-purple"
                                                                        value={item.price}
                                                                        onChange={(e) => updateItemPrice(item.id, e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => removeItemFromOrder(item.id)}
                                                                className="text-slate-600 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Totals */}
                                            <div className="p-4 bg-slate-900 border-t border-white/10">
                                                <div className="flex justify-between items-center text-sm font-medium text-slate-400 mb-1">
                                                    <span>Total Items:</span>
                                                    <span>{formData.selectedItems.length}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xl font-black text-white">
                                                    <span>Total Estimado</span>
                                                    <span className="text-brand-cyan">
                                                        ${formData.selectedItems.reduce((acc, item) => acc + (Number(item.price) * (item.quantity || 1)), 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: TECHNICAL REPORT */}
                            {activeTab === 'report' && (
                                <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">

                                    {/* Problem & Solution Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-slate-950 border border-brand-purple/20 p-5 rounded-2xl shadow-xl shadow-brand-purple/5">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                                    <AlertCircle size={16} />
                                                </div>
                                                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Problema Real **</h3>
                                            </div>
                                            <textarea
                                                className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white/90 focus:border-brand-purple outline-none resize-none placeholder-slate-600 custom-scrollbar text-sm font-mono"
                                                placeholder="Describa el problema real encontrado tras el diagnóstico..."
                                                value={formData.probReal}
                                                onChange={(e) => setFormData({ ...formData, probReal: e.target.value })}
                                            ></textarea>
                                        </div>

                                        <div className="bg-slate-950 border border-emerald-500/20 p-5 rounded-2xl shadow-xl shadow-emerald-500/5">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <CheckCircle2 size={16} />
                                                </div>
                                                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Solución Real **</h3>
                                            </div>
                                            <textarea
                                                className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white/90 focus:border-emerald-500/50 outline-none resize-none placeholder-slate-600 custom-scrollbar text-sm font-mono"
                                                placeholder="Detalle los procedimientos y repuestos utilizados para la solución..."
                                                value={formData.solReal}
                                                onChange={(e) => setFormData({ ...formData, solReal: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>

                                    {/* Observations & Photos */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Observations Column */}
                                        <div className="lg:col-span-1 bg-slate-950 border border-white/5 p-5 rounded-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                    <FileText size={16} />
                                                </div>
                                                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Observaciones</h3>
                                            </div>
                                            <textarea
                                                className="w-full h-[312px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-white/90 focus:border-blue-500/50 outline-none resize-none placeholder-slate-600 custom-scrollbar text-sm"
                                                placeholder="Notas adicionales o recomendaciones preventivas..."
                                                value={formData.obs}
                                                onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
                                            ></textarea>
                                        </div>

                                        {/* Photos Column */}
                                        <div className="lg:col-span-2 space-y-6">
                                            <div className="bg-slate-950 border border-white/5 p-5 rounded-2xl">
                                                <div className="flex items-center gap-3 mb-5">
                                                    <div className="w-8 h-8 rounded-full bg-brand-cyan/10 flex items-center justify-center text-brand-cyan">
                                                        <Camera size={16} />
                                                    </div>
                                                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">Registro Fotográfico</h3>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Photo Before */}
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Estado Inicial (Antes)</label>
                                                        <div className="relative aspect-video rounded-xl border-2 border-dashed border-white/5 hover:border-brand-purple/50 bg-slate-900/50 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group">
                                                            {formData.photoBefore ? (
                                                                <>
                                                                    <img src={formData.photoBefore} className="w-full h-full object-cover" alt="Antes" />
                                                                    <button onClick={() => setFormData({ ...formData, photoBefore: null })} className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                                                                </>
                                                            ) : (
                                                                <div className="text-center p-4">
                                                                    <Image size={32} className="mx-auto mb-2 text-slate-700" />
                                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Subir Foto Antes</p>
                                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                                        const file = e.target.files[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onloadend = () => setFormData({ ...formData, photoBefore: reader.result });
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Photo After */}
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Estado Final (Después)</label>
                                                        <div className="relative aspect-video rounded-xl border-2 border-dashed border-white/5 hover:border-emerald-500/50 bg-slate-900/50 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group">
                                                            {formData.photoAfter ? (
                                                                <>
                                                                    <img src={formData.photoAfter} className="w-full h-full object-cover" alt="Después" />
                                                                    <button onClick={() => setFormData({ ...formData, photoAfter: null })} className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                                                                </>
                                                            ) : (
                                                                <div className="text-center p-4">
                                                                    <Image size={32} className="mx-auto mb-2 text-slate-700" />
                                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Subir Foto Después</p>
                                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                                        const file = e.target.files[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onloadend = () => setFormData({ ...formData, photoAfter: reader.result });
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Client Signature/Reception Column */}
                                            <div className="bg-slate-950 border border-white/5 p-5 rounded-2xl">
                                                <div className="flex items-center gap-3 mb-5">
                                                    <div className="w-8 h-8 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple">
                                                        <UserCheck size={16} />
                                                    </div>
                                                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">Recepción de Equipo</h3>
                                                </div>

                                                <div className="flex flex-col md:flex-row gap-6">
                                                    <div className="flex-1 space-y-4">
                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Nombre de quien recibe</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Nombre Completo..."
                                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm focus:border-brand-purple outline-none transition-all"
                                                                value={formData.receiverName}
                                                                onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 italic">
                                                            Al firmar, el cliente declara conformidad con el trabajo realizado y la recepción del equipo en las condiciones descritas.
                                                        </p>
                                                    </div>

                                                    <div className="w-full md:w-64">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-2">Firma Digital</label>
                                                        <div className="h-28 rounded-xl border border-white/5 bg-slate-950 relative flex items-center justify-center group overflow-hidden">
                                                            {formData.receiverSignature ? (
                                                                <img src={formData.receiverSignature} className="h-full object-contain" alt="Firma" />
                                                            ) : (
                                                                <div className="text-center p-4">
                                                                    <PenTool size={24} className="mx-auto mb-1 text-slate-700" />
                                                                    <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Espacio para Firma</p>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files[0];
                                                                            if (file) {
                                                                                const reader = new FileReader();
                                                                                reader.onloadend = () => setFormData({ ...formData, receiverSignature: reader.result });
                                                                                reader.readAsDataURL(file);
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {formData.receiverSignature && (
                                                                <button onClick={() => setFormData({ ...formData, receiverSignature: null })} className="absolute top-1 right-1 p-1 bg-red-500/20 hover:bg-red-500 rounded text-red-500 hover:text-white transition-all"><X size={10} /></button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Actions */}
                        <div className="p-6 border-t border-white/10 bg-slate-900 flex justify-end gap-3 z-10 box-shadow-xl">
                            <button onClick={resetForm} className="px-5 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-bold text-sm transition-all">
                                Limpiar
                            </button>
                            <button
                                onClick={handleSaveOrder}
                                className="px-8 py-3 rounded-xl bg-brand-gradient text-white font-black uppercase tracking-widest hover:opacity-90 hover:scale-[1.02] shadow-lg shadow-brand-purple/20 transition-all flex items-center gap-2"
                            >
                                <Save size={18} />
                                {editingId ? "Guardar Cambios" : "Crear Orden"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- SCHEDULER MODAL --- */}
            {showScheduler && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-6xl h-[85vh] shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Calendar className="text-brand-purple" size={24} />
                                    Disponibilidad de Técnicos
                                </h3>
                                <p className="text-slate-400 text-xs">Seleccione un bloque para agendar. Duración estándar: 2 horas.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <input
                                    type="date"
                                    value={schedulerDate}
                                    onChange={(e) => setSchedulerDate(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                />
                                <button onClick={() => setShowScheduler(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-6">
                            <div className="min-w-[800px]">
                                {/* Header Row */}
                                <div className="grid grid-cols-5 gap-4 mb-4 sticky top-0 bg-slate-900 z-10 pb-2 border-b border-white/5">
                                    <div className="text-slate-500 font-bold text-center text-xs uppercase tracking-wider py-2">Horario</div>
                                    {TECHNICIANS.map(tech => (
                                        <div key={tech} className="text-center">
                                            <div className="mx-auto w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-brand-cyan font-bold mb-2 border border-white/10">
                                                {tech.charAt(0)}
                                            </div>
                                            <div className="text-white font-bold text-sm">{tech}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Timerows */}
                                {Array.from({ length: 10 }, (_, i) => i + 9).map(hour => (
                                    <div key={hour} className="grid grid-cols-5 gap-4 mb-2">
                                        {/* Time Label */}
                                        <div className="text-slate-500 text-xs font-mono font-bold flex flex-col items-center justify-start pt-2 border-t border-white/5">
                                            {`${hour}:00`}
                                            <span className="text-[10px] opacity-50 font-normal">{`${hour + 1}:00`}</span>
                                        </div>

                                        {/* Tech Columns */}
                                        {TECHNICIANS.map(tech => {
                                            // Check availability
                                            const slotStart = new Date(`${schedulerDate}T${hour.toString().padStart(2, '0')}:00`);
                                            const slotEnd = new Date(`${schedulerDate}T${(hour + 2).toString().padStart(2, '0')}:00`); // 2 Hour looking forward

                                            // Find overlapping repairs
                                            const busy = repairs.some(r => {
                                                if (r.technician !== tech) return false;
                                                const rStart = new Date(r.startDate || r.date); // Fallback for old data
                                                const rEnd = new Date(r.estimatedEndDate || rStart.getTime() + 7200000); // Fallback 2h

                                                // Check intersection: (StartA <= EndB) and (EndA >= StartB)
                                                // Check if this hour slot (1h) is inside a repair
                                                // Actually checking if the proposed 2h slot overlaps with any existing work
                                                const checkStart = slotStart;
                                                const checkEnd = new Date(checkStart.getTime() + 60 * 60 * 1000); // Checking 1h block visual

                                                return (rStart < checkEnd && rEnd > checkStart);
                                            });

                                            return (
                                                <div key={tech} className="relative h-14">
                                                    {busy ? (
                                                        <div className="absolute inset-0 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center">
                                                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Ocupado</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`¿Agendar con ${tech} el ${schedulerDate} a las ${hour}:00?`)) {
                                                                    setFormData({
                                                                        ...formData,
                                                                        technician: tech,
                                                                        startDate: `${schedulerDate}T${hour.toString().padStart(2, '0')}:00`,
                                                                        estimatedEndDate: `${schedulerDate}T${(hour + 2).toString().padStart(2, '0')}:00`
                                                                    });
                                                                    setShowScheduler(false);
                                                                }
                                                            }}
                                                            className="absolute inset-0 bg-emerald-500/5 hover:bg-emerald-500/20 border border-emerald-500/10 hover:border-emerald-500/50 rounded-lg transition-all group flex items-center justify-center cursor-pointer"
                                                        >
                                                            <span className="text-emerald-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                                + Asignar
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Stateless Components
const SectionTitle = ({ icon, title, action }) => (
    <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-brand-purple">
            {icon}
            <h3 className="font-bold uppercase tracking-wider text-xs">{title}</h3>
        </div>
        {action}
    </div>
);

const StatCard = ({ title, value, icon, delay }) => (
    <div
        className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-5 rounded-2xl flex items-center gap-4 hover:border-brand-purple/20 transition-all group"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            {icon}
        </div>
        <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-black text-white group-hover:text-brand-purple transition-colors">{value}</h3>
        </div>
    </div>
);

export default Taller;

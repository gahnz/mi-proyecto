import { useState } from "react";
import {
    Search,
    Plus,
    Pencil,
    Trash2,
    Laptop2,
    Cpu,
    AlertTriangle,
    Download,       // 👈 Icono Descarga
    FileSpreadsheet // 👈 Icono Excel
} from "lucide-react";
import * as XLSX from 'xlsx'; // 👈 Importamos la librería de Excel
import { toast } from "sonner"; 
import { EQUIP_TYPES } from "../data/mockData";
import { useEquipos } from "../hooks/useEquipos";
import { useInventory } from "../hooks/useInventory";

const Equipos = () => {
    // Agregamos createBulkEquipments del hook
    const { equipments, loading: loadingEquipos, addEquipo, createBulkEquipments, updateEquipo, deleteEquipo } = useEquipos();
    const { inventory, loading: loadingInventory } = useInventory();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const [editingId, setEditingId] = useState(null);
    const [newEquip, setNewEquip] = useState({ type: "Notebook", brand: "", model: "" });

    // --- LÓGICA DE EXCEL ---

    // 1. Descargar Plantilla
    const handleDownloadTemplate = () => {
        const headers = [
            { TIPO: "Notebook", MARCA: "HP", MODELO: "Pavilion 15" },
            { TIPO: "Smartphone", MARCA: "Samsung", MODELO: "Galaxy S23" },
            { TIPO: "PC", MARCA: "Generico", MODELO: "Torre ATX" }
        ];
        
        const ws = XLSX.utils.json_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla Equipos");
        XLSX.writeFile(wb, "Plantilla_Equipos.xlsx");
    };

    // 2. Subir Excel
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast.error("El archivo está vacío");
                    return;
                }

                // Mapeo: Columnas Excel (Mayúsculas) -> Base de Datos (Minúsculas)
                const formattedData = data.map(row => ({
                    type: row.TIPO || "Otro",
                    brand: row.MARCA || "Genérico",
                    model: row.MODELO || "Genérico"
                }));

                const promise = createBulkEquipments(formattedData);

                toast.promise(promise, {
                    loading: `Procesando ${formattedData.length} modelos...`,
                    success: () => {
                        e.target.value = null; // Limpiar input
                        return `${formattedData.length} modelos importados exitosamente`;
                    },
                    error: (err) => {
                        e.target.value = null;
                        return `Error: ${err.message}`;
                    }
                });
            } catch (error) {
                console.error(error);
                toast.error("Error al leer el archivo Excel");
            }
        };

        reader.readAsBinaryString(file);
    };

    // --- FIN LÓGICA EXCEL ---

    const filteredEquipments = equipments.filter(item =>
        item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (equip = null) => {
        if (equip) {
            setEditingId(equip.id);
            setNewEquip({ type: equip.type, brand: equip.brand, model: equip.model });
        } else {
            setEditingId(null);
            setNewEquip({ type: "Notebook", brand: "", model: "" });
        }
        setIsModalOpen(true);
    };

    const handleSaveEquipment = async () => {
        if (!newEquip.brand || !newEquip.model) {
            toast.error("Faltan datos", { description: "Marca y Modelo son obligatorios" });
            return;
        }

        const promise = editingId 
            ? updateEquipo(editingId, newEquip)
            : addEquipo(newEquip);

        toast.promise(promise, {
            loading: editingId ? 'Actualizando modelo...' : 'Registrando modelo...',
            success: () => {
                setEditingId(null);
                setNewEquip({ type: "Notebook", brand: "", model: "" });
                setIsModalOpen(false);
                return editingId ? 'Modelo actualizado' : 'Modelo registrado';
            },
            error: (err) => `Error: ${err.message}`
        });
    };

    const confirmDelete = (item) => {
        setItemToDelete(item);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;

        const promise = deleteEquipo(itemToDelete.id);

        toast.promise(promise, {
            loading: 'Eliminando modelo...',
            success: () => {
                setIsDeleteModalOpen(false);
                setItemToDelete(null);
                return 'Modelo eliminado correctamente';
            },
            error: (err) => `Error: ${err.message}`
        });
    };

    const getTypeIcon = (typeName) => {
        const type = EQUIP_TYPES.find(t => t.id === typeName);
        const Icon = type ? type.icon : Cpu;
        return <Icon size={20} />;
    };

    if (loadingEquipos || loadingInventory) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Sincronizando datos...</div>;
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-brand-gradient">
                        Catálogo de Equipos
                    </h1>
                    <p className="text-slate-400 mt-1">Gestión centralizada en Nube ☁️</p>
                </div>
                
                {/* Botones de Acción */}
                <div className="flex flex-wrap gap-2">
                    {/* Botón Descargar Plantilla */}
                    <button 
                        onClick={handleDownloadTemplate}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-white/10 transition-all text-xs uppercase tracking-wider"
                        title="Descargar Plantilla Excel"
                    >
                        <Download size={16} /> Plantilla
                    </button>

                    {/* Botón Subir Excel */}
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleFileUpload} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-xs uppercase tracking-wider">
                            <FileSpreadsheet size={16} /> Importar Excel
                        </button>
                    </div>

                    {/* Botón Registrar Nuevo */}
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-brand-gradient hover:opacity-90 transition-opacity text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-brand-purple/20 text-xs uppercase tracking-wider"
                    >
                        <Plus size={18} />
                        Registrar Modelo
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por marca, modelo o tipo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all"
                    />
                </div>
                <div className="text-slate-400 text-sm">
                    Total: <span className="text-white font-medium">{filteredEquipments.length}</span> modelos
                </div>
            </div>

            {/* Grid of Equipment Models */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredEquipments.map((item) => {
                    const linkedItems = inventory.filter(invItem =>
                        invItem.compatible_models?.includes(`${item.brand} ${item.model}`)
                    );

                    return (
                        <div
                            key={item.id}
                            className="group bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/5 p-5 hover:border-brand-cyan/30 transition-all hover:shadow-lg hover:shadow-brand-cyan/5 relative overflow-hidden flex flex-col h-full"
                        >
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleOpenModal(item)}
                                    className="p-2 text-slate-400 hover:text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    onClick={() => confirmDelete(item)}
                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Eliminar"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="flex items-center gap-4 mb-4 mt-2">
                                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-brand-cyan">
                                    {getTypeIcon(item.type)}
                                </div>
                                <div>
                                    <span className="text-xs font-mono text-slate-500 block uppercase tracking-wider">{item.type}</span>
                                    <h3 className="font-bold text-lg text-slate-100 leading-tight">{item.brand}</h3>
                                </div>
                            </div>

                            <div className="bg-slate-950/30 rounded-lg p-3 border border-white/5 mb-4">
                                <p className="text-sm text-slate-400">Modelo:</p>
                                <p className="text-white font-medium truncate" title={item.model}>{item.model}</p>
                            </div>

                            <div className="mt-auto pt-4 border-t border-white/5">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>
                                    Ítems Enlazados ({linkedItems.length})
                                </p>
                                {linkedItems.length > 0 ? (
                                    <div className="space-y-1">
                                        {linkedItems.slice(0, 3).map(link => (
                                            <div key={link.id} className="text-xs text-slate-300 flex justify-between items-center bg-white/5 px-2 py-1 rounded">
                                                <span className="truncate flex-1">{link.name}</span>
                                                <span className={`font-mono ${link.stock > 0 ? "text-brand-cyan" : "text-red-400"}`}>
                                                    {link.stock}
                                                </span>
                                            </div>
                                        ))}
                                        {linkedItems.length > 3 && (
                                            <p className="text-[10px] text-center text-slate-500 mt-1">
                                                +{linkedItems.length - 3} más...
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-600 italic pl-2">Sin ítems asociados</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Crear/Editar */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">
                                {editingId ? "Editar Modelo" : "Nuevo Modelo de Equipo"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Tipo de Equipo</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {EQUIP_TYPES.map(type => (
                                        <button
                                            key={type.id}
                                            onClick={() => setNewEquip({ ...newEquip, type: type.id })}
                                            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-all ${newEquip.type === type.id
                                                ? "bg-brand-purple/20 border-brand-purple text-white"
                                                : "bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700"
                                                }`}
                                        >
                                            <type.icon size={20} className="mb-1" />
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Marca</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white focus:border-brand-cyan outline-none"
                                    placeholder="Ej. Samsung, HP, Lenovo..."
                                    value={newEquip.brand}
                                    onChange={(e) => setNewEquip({ ...newEquip, brand: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Modelo</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white focus:border-brand-cyan outline-none"
                                    placeholder="Ej. Galaxy S23, Victus 15..."
                                    value={newEquip.model}
                                    onChange={(e) => setNewEquip({ ...newEquip, model: e.target.value })}
                                />
                            </div>

                            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5">Cancelar</button>
                                <button
                                    onClick={handleSaveEquipment}
                                    disabled={!newEquip.brand || !newEquip.model}
                                    className="px-4 py-2 rounded-lg bg-brand-gradient text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingId ? "Guardar Cambios" : "Guardar Modelo"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Eliminar */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-slate-900 border border-red-500/30 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-xl font-black text-white mb-2 uppercase italic">¿Eliminar Equipo?</h2>
                        <p className="text-slate-400 mb-8 text-xs font-medium px-4">
                            Borrarás <span className="text-white font-bold italic">"{itemToDelete?.brand} {itemToDelete?.model}"</span>. Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 uppercase text-[10px] tracking-widest italic"
                            >
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Equipos;
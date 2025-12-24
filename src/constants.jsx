import { Home, Truck, Zap } from "lucide-react";

// ==========================================
// 💰 FINANZAS Y PAGOS
// ==========================================

export const PAYMENT_METHODS = [
    "Efectivo", 
    "Banco de Chile", 
    "Mercado Pago"
];

export const TAX_CATEGORIES = [
    { id: "VENTA", label: "Venta de Servicios/Productos", type: "income" },
    { id: "MERCADERIA", label: "Compra de Mercadería / Repuestos", type: "expense" },
    { id: "REMUNERACION", label: "Remuneraciones / Sueldos", type: "expense" },
    { id: "ARRIENDO", label: "Arriendo de Local", type: "expense" },
    { id: "SERVICIOS", label: "Servicios Básicos (Luz, Agua, Internet)", type: "expense" },
    { id: "HONORARIOS", label: "Honorarios Profesionales", type: "expense" },
    { id: "HERRAMIENTAS", label: "Herramientas e Insumos", type: "expense" },
    { id: "IMPUESTOS", label: "Pago de Impuestos (F29/F22)", type: "expense" },
    { id: "RETIRO", label: "Retiro de Socios", type: "expense" },
    { id: "G_GENERAL", label: "Gasto General / Otros", type: "expense" }
];

export const DOCUMENT_TYPES = [
    { id: "39", label: "Boleta Electrónica" },
    { id: "33", label: "Factura Electrónica" },
    { id: "VOU", label: "Voucher / Transbank" },
    { id: "OTR", label: "Otro" }
];

// ==========================================
// 🛠️ TALLER Y SERVICIOS
// ==========================================

export const WORKSHOP_STATUSES = [
    "En cola",
    "Trabajando",
    "Revisión del Coordinador",
    "Notificado y no pagado",
    "Pagado y no retirado",
    "Retirado y no pagado",
    "Finalizado y Pagado",
    "Cancelado"
];

export const JOB_TYPES = [
    "Mantenimiento", 
    "Reparación", 
    "Revisión", 
    "Configuración"
];

// ==========================================
// 📦 INVENTARIO Y BODEGAS
// ==========================================

export const WAREHOUSES = [
    { id: "Bodega Local", label: "Bodega Local", icon: <Home size={14} />, color: "bg-slate-800 text-slate-300" },
    { id: "Mercado Libre", label: "Mercado Libre", icon: <Truck size={14} />, color: "bg-blue-500 text-white" },
    { id: "Mercado Full", label: "Mercado Full", icon: <Zap size={14} />, color: "bg-yellow-400 text-black" }
];

export const CHILE_DATA = [
    {
  "region": "Metropolitana de Santiago",
  "comunas": [
    "Alhué",
    "Buin",
    "Calera de Tango",
    "Cerrillos",
    "Cerro Navia",
    "Colina",
    "Conchalí",
    "Curacaví",
    "El Bosque",
    "El Monte",
    "Estación Central",
    "Huechuraba",
    "Independencia",
    "Isla de Maipo",
    "La Cisterna",
    "La Florida",
    "La Granja",
    "La Pintana",
    "La Reina",
    "Lampa",
    "Las Condes",
    "Lo Barnechea",
    "Lo Espejo",
    "Lo Prado",
    "Macul",
    "Maipú",
    "María Pinto",
    "Melipilla",
    "Ñuñoa",
    "Padre Hurtado",
    "Paine",
    "Pedro Aguirre Cerda",
    "Peñaflor",
    "Peñalolén",
    "Pirque",
    "Providencia",
    "Pudahuel",
    "Puente Alto",
    "Quilicura",
    "Quinta Normal",
    "Recoleta",
    "Renca",
    "San Bernardo",
    "San Joaquín",
    "San José de Maipo",
    "San Miguel",
    "San Pedro",
    "San Ramón",
    "Santiago",
    "Talagante",
    "Til Til",
    "Vitacura"
  ]
},
    {
        region: "Valparaíso",
        comunas: ["Valparaíso", "Viña del Mar", "Concón", "Quilpué", "Villa Alemana"]
    },
    {
        region: "Biobío",
        comunas: ["Concepción", "Talcahuano", "San Pedro de la Paz", "Chiguayante"]
    },
    // ... puedes agregar el resto de regiones aquí
];
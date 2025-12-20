import { Laptop, Smartphone, Printer, Monitor, Cpu } from "lucide-react";

export const EQUIP_TYPES = [
    { id: "Notebook", icon: Laptop, label: "Notebook" },
    { id: "Celular", icon: Smartphone, label: "Celular" },
    { id: "Impresora", icon: Printer, label: "Impresora" },
    { id: "PC", icon: Monitor, label: "PC Escritorio" },
    { id: "Otro", icon: Cpu, label: "Otro" },
];

export const INITIAL_EQUIPMENT = [
    { id: 1, type: "Notebook", brand: "HP", model: "Victus 15" },
    { id: 2, type: "Celular", brand: "Samsung", model: "Galaxy S23" },
    { id: 3, type: "Impresora", brand: "Epson", model: "L3150" },
    { id: 4, type: "PC", brand: "Genérico", model: "Custom Build i5" },
    { id: 5, type: "Notebook", brand: "Lenovo", model: "ThinkPad E14" },
    { id: 6, type: "Notebook", brand: "Invictus", model: "16" }, // Added based on user request
    { id: 7, type: "Impresora", brand: "Epson", model: "L3250" }, // Added based on user request
];

export const INITIAL_REPAIRS = [
    {
        id: "REP-001",
        device: "iPhone 13 Pro",
        type: "smartphone",
        problem: "Pantalla rota + Batería",
        customer: "Juan Pérez",
        status: "En Reparación",
        priority: "Alta",
        date: "2024-03-20",
        cost: 120000,
        technician: "Gonzalo"
    },
    {
        id: "REP-002",
        device: "MacBook Air M1",
        type: "laptop",
        problem: "No enciende, daño por líquido",
        customer: "María González",
        status: "Diagnóstico",
        priority: "Media",
        date: "2024-03-21",
        cost: 0,
        technician: "Pendiente"
    },
    {
        id: "REP-003",
        device: "iPad Air 4",
        type: "tablet",
        problem: "Puerto de carga dañado",
        customer: "Carlos Ruiz",
        status: "Listo",
        priority: "Baja",
        date: "2024-03-18",
        cost: 45000,
        technician: "Gonzalo"
    },
    {
        id: "REP-004",
        device: "Samsung S21",
        type: "smartphone",
        problem: "Cambio de tapa trasera",
        customer: "Ana López",
        status: "Entregado",
        priority: "Baja",
        date: "2024-03-15",
        cost: 35000,
        technician: "Gonzalo"
    }
];

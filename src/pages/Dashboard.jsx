import { useEffect, useState } from "react";
import {
  AlertCircle, Wrench, CheckCircle2, DollarSign, TrendingUp,
  ArrowUpRight, ArrowDownRight, Package, ShoppingBag, Landmark,
  LayoutDashboard, History, BarChart3, Trophy, Users
} from "lucide-react";
// 👇 IMPORTAMOS RECHARTS PARA LOS GRÁFICOS
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';

// 👇 IMPORTAMOS LOS HOOKS REALES
import { useWorkOrders } from "../hooks/useWorkOrders";
import { useCashFlow } from "../hooks/useCashFlow";
import { useInventory } from "../hooks/useInventory";

export default function Dashboard() {
  // 1. Obtenemos datos frescos de la BD
  const { orders, loading: loadingOrders } = useWorkOrders();
  const { movements, loading: loadingCash } = useCashFlow();
  const { inventory, loading: loadingInv } = useInventory();

  const [stats, setStats] = useState({
    waiting_count: 0,
    active_count: 0,
    ready_to_collect_count: 0,
    monthly_revenue: 0,
    monthly_expenses: 0,
    total_stock_value: 0,
    low_stock_items: 0,
    movements_count: 0
  });

  // 👇 ESTADOS NUEVOS PARA GRÁFICOS
  const [salesData, setSalesData] = useState([]);
  const [techRanking, setTechRanking] = useState([]);

  const loading = loadingOrders || loadingCash || loadingInv;

  useEffect(() => {
    if (loading) return;

    // --- CÁLCULOS EN TIEMPO REAL ---

    // 1. Taller Stats
    const waiting = orders.filter(o => o.status === 'En cola').length;
    const active = orders.filter(o => ['Trabajando', 'Revisión del Coordinador'].includes(o.status)).length;
    // OTs listas para entrega
    const ready = orders.filter(o => ['Pagado y no retirado', 'Notificado y no pagado'].includes(o.status)).length;

    // 2. Finanzas Stats (Mes Actual)
    const currentMonthISO = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthMovements = movements.filter(m => m.date && m.date.startsWith(currentMonthISO));

    const revenue = monthMovements
      .filter(m => m.type === 'income')
      .reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0);

    const expenses = monthMovements
      .filter(m => m.type === 'expense')
      .reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0);

    // 3. Inventario Stats
    const lowStock = inventory.filter(i => {
      const totalStock = Object.values(i.stocksByWarehouse || {}).reduce((a, b) => a + b, 0);
      return i.type !== 'Servicio' && totalStock <= (i.min_stock || 0);
    }).length;

    const stockValue = inventory.reduce((acc, i) => {
      const totalStock = Object.values(i.stocksByWarehouse || {}).reduce((a, b) => a + b, 0);
      return acc + (totalStock * (i.price_cost || 0));
    }, 0);

    // --- 🔥 LOGICA NUEVA PARA GRÁFICOS ---

    // A. Datos para Gráfico de Ventas (Agrupar por día)
    const incomeByDay = monthMovements
        .filter(m => m.type === 'income')
        .reduce((acc, curr) => {
            const day = curr.date.split('T')[0].split('-')[2]; // Sacar solo el día (01, 02, etc)
            acc[day] = (acc[day] || 0) + Number(curr.totalAmount);
            return acc;
        }, {});
    
    // Rellenar días del gráfico y ordenar
    const chartData = Object.keys(incomeByDay).map(day => ({
        name: `Día ${day}`,
        ventas: incomeByDay[day]
    })).sort((a, b) => a.name.localeCompare(b.name));

    // B. Ranking de Técnicos (Basado en órdenes finalizadas este mes)
    // Filtramos órdenes que tengan fecha de término este mes (o creación si no tienes término)
    const finishedThisMonth = orders.filter(o => 
        o.status === 'Finalizado y Pagado' && 
        o.date && o.date.includes(new Date().getMonth() + 1 + "") // Ajuste simple de fecha
    );

    const rankingMap = orders.reduce((acc, curr) => {
        // Contamos todas las órdenes asignadas (o solo finalizadas si prefieres)
        if(curr.technician && curr.status === 'Finalizado y Pagado') {
            acc[curr.technician] = (acc[curr.technician] || 0) + 1;
        }
        return acc;
    }, {});

    const rankingArray = Object.keys(rankingMap).map(tech => ({
        name: tech,
        count: rankingMap[tech]
    })).sort((a, b) => b.count - a.count).slice(0, 3); // Top 3

    setSalesData(chartData);
    setTechRanking(rankingArray);

    setStats({
      waiting_count: waiting,
      active_count: active,
      ready_to_collect_count: ready,
      monthly_revenue: revenue,
      monthly_expenses: expenses,
      total_stock_value: stockValue,
      low_stock_items: lowStock,
      movements_count: monthMovements.length
    });

  }, [orders, movements, inventory, loading]);

  const recentMovements = movements.slice(0, 5); // Últimos 5 movimientos

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Conectando con Satélite...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Dashboard <span className="text-brand-purple">Central</span></h1>
          <p className="text-slate-400 font-medium">Estado real de Técnico Computín.</p>
        </div>
        <div className="bg-slate-900 border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Base de Datos: Conectada</span>
        </div>
      </div>

      {/* PRIMARY STATS GRID (Sin cambios) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* TALLER STATS */}
        <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-xl hover:border-brand-purple/30 transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-brand-purple/10 rounded-2xl text-brand-purple group-hover:scale-110 transition-transform">
              <Wrench size={24} />
            </div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg">Workshop</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">En Reparación</p>
                <h3 className="text-3xl font-black text-white italic">{stats.active_count}</h3>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Nuevos</p>
                <h3 className="text-lg font-black text-slate-400">{stats.waiting_count}</h3>
              </div>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
              <div className="bg-brand-purple h-full rounded-full" style={{ width: `${Math.min(100, (stats.active_count / 10) * 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* CASH FLOW STATS */}
        <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-xl hover:border-emerald-500/30 transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg">Finanzas Mes</span>
          </div>
          <div className="space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Ingresos Totales</p>
            <h3 className="text-3xl font-black text-emerald-400 italic leading-none">{formatCurrency(stats.monthly_revenue)}</h3>
            <div className="flex items-center gap-1.5 text-slate-500 pt-2">
              <ArrowDownRight size={14} className="text-rose-500" />
              <span className="text-[10px] font-bold">Gastos: {formatCurrency(stats.monthly_expenses)}</span>
            </div>
          </div>
        </div>

        {/* INVENTORY STATS */}
        <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-xl hover:border-brand-cyan/30 transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-brand-cyan/10 rounded-2xl text-brand-cyan group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg">Inventario</span>
          </div>
          <div className="space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Valorización Stock</p>
            <h3 className="text-3xl font-black text-white italic leading-none">{formatCurrency(stats.total_stock_value)}</h3>
            <div className={`flex items-center gap-1.5 pt-2 ${stats.low_stock_items > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{stats.low_stock_items} Ítems con Stock Bajo</span>
            </div>
          </div>
        </div>

        {/* READY FOR COLLECTION */}
        <div className="bg-brand-gradient p-6 rounded-[2.5rem] shadow-2xl shadow-brand-purple/40 hover:scale-[1.02] transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <ShoppingBag size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="p-3 bg-white/20 rounded-2xl text-white w-fit">
              <CheckCircle2 size={24} />
            </div>
            <div className="mt-8">
              <h3 className="text-5xl font-black text-white italic">{stats.ready_to_collect_count}</h3>
              <p className="text-white/80 text-[10px] font-black uppercase tracking-widest mt-1">Listos para Retiro</p>
            </div>
          </div>
        </div>

      </div>

      {/* 🔥 ZONA DE INTELIGENCIA (NUEVA SECCIÓN INSERTADA) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* GRÁFICO DE VENTAS */}
          <div className="lg:col-span-2 bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8">
              <div className="flex items-center justify-between mb-6">
                  <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Tendencia de Ventas</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ingresos por día (Mes actual)</p>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><BarChart3 size={20}/></div>
              </div>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesData}>
                          <defs>
                              <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                          <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                              itemStyle={{ color: '#10b981' }}
                              formatter={(value) => [formatCurrency(value), 'Ventas']}
                          />
                          <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* RANKING TÉCNICOS */}
          <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8">
              <div className="flex items-center justify-between mb-6">
                  <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Top Técnicos</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Mayor productividad</p>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><Trophy size={20}/></div>
              </div>
              <div className="space-y-4">
                  {techRanking.length === 0 ? (
                      <div className="text-center py-8 text-slate-600 text-xs">Sin datos suficientes</div>
                  ) : (
                      techRanking.map((tech, index) => (
                          <div key={tech.name} className="flex items-center gap-4 group">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-400'}`}>
                                  {index + 1}
                              </div>
                              <div className="flex-1">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-sm font-bold text-white">{tech.name}</span>
                                      <span className="text-xs font-mono text-brand-purple">{tech.count} OTs</span>
                                  </div>
                                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-gradient-to-r from-brand-purple to-brand-cyan h-full rounded-full" style={{ width: `${(tech.count / (techRanking[0].count || 1)) * 100}%` }}></div>
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECENT ACTIVITY (Sin cambios, solo desplazado abajo) */}
        <div className="lg:col-span-2 bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <History size={20} className="text-slate-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Actividad Reciente</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Últimos movimientos financieros</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {recentMovements.length === 0 ? (
              <div className="text-center py-10 opacity-20">No hay movimientos registrados.</div>
            ) : (
              recentMovements.map(mov => (
                <div key={mov.id} className="flex items-center justify-between p-4 bg-slate-950 border border-white/5 rounded-2xl group hover:bg-slate-900 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mov.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {mov.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate max-w-[200px]">{mov.description}</p>
                      <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{mov.paymentMethod || 'Otro'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black italic ${mov.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {mov.type === 'income' ? '+' : '-'} {formatCurrency(mov.totalAmount)}
                    </p>
                    <p className="text-[9px] text-slate-600 font-mono italic">{mov.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* QUICK STATS / SYSTEM INFO (Sin cambios) */}
        <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8">
          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-8">Estado de Red</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-cyan/10 rounded-lg text-brand-cyan">
                  <Landmark size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Transacciones</span>
              </div>
              <span className="text-sm font-black text-white italic">{stats.movements_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-purple/10 rounded-lg text-brand-purple">
                  <LayoutDashboard size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Estado</span>
              </div>
              <span className="text-sm font-black text-emerald-400 italic">Online</span>
            </div>
            <div className="pt-6 border-t border-white/5 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-brand-gradient rounded-full flex items-center justify-center p-0.5 shadow-2xl shadow-brand-purple/20">
                <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                  <TrendingUp className="text-brand-cyan" size={32} />
                </div>
              </div>
              <h4 className="text-white font-black uppercase italic tracking-widest mt-4">Sistema Sincronizado</h4>
              <p className="text-[10px] text-slate-500 font-bold mt-1">Todos tus módulos están conectados a la nube.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
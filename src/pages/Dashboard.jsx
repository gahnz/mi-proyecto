import { useEffect, useState } from "react";
import {
  Wrench, CheckCircle2, TrendingUp, ArrowDownRight, Package, ShoppingBag, 
  Landmark, BarChart3, Trophy, PieChart as PieIcon, AlertTriangle, Archive,
  ArrowUpRight
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from "../supabase/client";

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // Estado unificado (viene del RPC)
  const [data, setData] = useState({
    waiting_count: 0, active_count: 0, ready_to_collect_count: 0,
    monthly_revenue: 0, monthly_expenses: 0,
    total_stock_value: 0, total_stock_items: 0, low_stock_items: 0,
    movements_count: 0,
    sales_data: [],
    tech_ranking: [],
    warehouse_distribution: []
  });

  const [topItems, setTopItems] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [currentMonth]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. CARGA PESADA (Estadísticas calculadas en Servidor)
      const { data: stats, error: statsError } = await supabase.rpc('get_enterprise_dashboard_stats', { 
        target_month: currentMonth 
      });
      if (statsError) throw statsError;
      
      // 2. CARGA LIGERA (Listas pequeñas)
      // A. Últimos 5 movimientos
      const { data: movements } = await supabase
        .from('cash_flow')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);

      // B. Top Items (Hack: Traemos los últimos 50 items vendidos para estimar tendencia, es más rápido que leer todo el historial)
      // Nota: Una implementación real de "Top histórico" requiere una tabla agregada, pero esto simula la carga sin colapsar.
      const { data: orders } = await supabase
        .from('work_orders')
        .select('items')
        .order('created_at', { ascending: false })
        .limit(50); // Muestra de las últimas 50 órdenes para tendencia reciente

      // Procesar Top Items en cliente (solo con la muestra pequeña)
      const itemUsage = {};
      orders?.forEach(o => {
        o.items?.forEach(i => {
            if(i.type !== 'Servicio') itemUsage[i.name] = (itemUsage[i.name] || 0) + (i.quantity || 1);
        });
      });
      const sortedItems = Object.keys(itemUsage)
        .map(k => ({ name: k, count: itemUsage[k] }))
        .sort((a,b) => b.count - a.count)
        .slice(0, 5);

      setData(stats);
      setRecentMovements(movements || []);
      setTopItems(sortedItems);

    } catch (error) {
      console.error("Error dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Procesando Big Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Dashboard <span className="text-brand-purple">Central</span></h1>
          <p className="text-slate-400 font-medium">Estado del negocio en tiempo real.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
            <input 
                type="month" 
                value={currentMonth} 
                onChange={(e) => setCurrentMonth(e.target.value)} 
                className="bg-transparent text-white font-bold text-sm outline-none px-2 uppercase"
            />
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
            </div>
        </div>
      </div>

      {/* KPI GRID (Resumen General) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* TALLER */}
        <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-xl group hover:border-brand-purple/30 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-brand-purple/10 rounded-2xl text-brand-purple"><Wrench size={24} /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg">Taller</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">En Proceso</p><h3 className="text-3xl font-black text-white italic">{data.active_count}</h3></div>
              <div className="text-right"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">En Cola</p><h3 className="text-lg font-black text-slate-400">{data.waiting_count}</h3></div>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden"><div className="bg-brand-purple h-full rounded-full" style={{ width: `${Math.min(100, (data.active_count / 15) * 100)}%` }}></div></div>
          </div>
        </div>

        {/* FINANZAS */}
        <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-xl group hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><TrendingUp size={24} /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg">Caja Mes</span>
          </div>
          <div className="space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Ingresos</p>
            <h3 className="text-3xl font-black text-emerald-400 italic leading-none">{formatCurrency(data.monthly_revenue)}</h3>
            <div className="flex items-center gap-1.5 text-slate-500 pt-2"><ArrowDownRight size={14} className="text-rose-500" /><span className="text-[10px] font-bold">Gastos: {formatCurrency(data.monthly_expenses)}</span></div>
          </div>
        </div>

        {/* INVENTARIO KPI */}
        <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-xl group hover:border-brand-cyan/30 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-brand-cyan/10 rounded-2xl text-brand-cyan"><Package size={24} /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-lg">Inventario</span>
          </div>
          <div className="space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Valorización</p>
            <h3 className="text-3xl font-black text-white italic leading-none">{formatCurrency(data.total_stock_value)}</h3>
            <div className="flex items-center gap-1.5 pt-2 text-slate-500">
                <Archive size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{data.total_stock_items} Unidades</span>
            </div>
          </div>
        </div>

        {/* RETIROS PENDIENTES */}
        <div className="bg-brand-gradient p-6 rounded-[2.5rem] shadow-2xl shadow-brand-purple/40 hover:scale-[1.02] transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><ShoppingBag size={120} /></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="p-3 bg-white/20 rounded-2xl text-white w-fit"><CheckCircle2 size={24} /></div>
            <div className="mt-8"><h3 className="text-5xl font-black text-white italic">{data.ready_to_collect_count}</h3><p className="text-white/80 text-[10px] font-black uppercase tracking-widest mt-1">Listos para Retiro</p></div>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE GRÁFICOS Y ANÁLISIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. TOP REPUESTOS (Rotación) */}
          <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8">
              <div className="flex items-center justify-between mb-6">
                  <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Top Repuestos</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tendencia reciente</p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><BarChart3 size={20}/></div>
              </div>
              <div className="space-y-4">
                  {topItems.length === 0 ? <div className="text-center text-xs text-slate-600 py-4">Sin actividad reciente</div> : 
                    topItems.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-300">
                                <span className="truncate max-w-[180px]">{item.name}</span>
                                <span className="text-brand-cyan">{item.count} un.</span>
                            </div>
                            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(item.count / topItems[0].count) * 100}%` }}></div>
                            </div>
                        </div>
                    ))
                  }
              </div>
          </div>

          {/* 2. DISTRIBUCIÓN BODEGA */}
          <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                  <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Bodegas</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Distribución de stock</p>
                  </div>
                  <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500"><PieIcon size={20}/></div>
              </div>
              <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data.warehouse_distribution}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.warehouse_distribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}/>
                    </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* 3. ALERTA STOCK */}
          <div className={`bg-slate-900/50 rounded-[2.5rem] border backdrop-blur-md p-8 ${data.low_stock_items > 0 ? 'border-rose-500/30 border-l-4 border-l-rose-500' : 'border-white/5'}`}>
              <div className="flex items-center justify-between mb-6">
                  <div>
                      <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                          Stock Crítico <span className={`text-[10px] px-2 py-0.5 rounded-full not-italic ${data.low_stock_items > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>{data.low_stock_items}</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{data.low_stock_items > 0 ? 'Requiere Atención' : 'Todo en orden'}</p>
                  </div>
                  <div className={`p-2 rounded-xl ${data.low_stock_items > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}><AlertTriangle size={20}/></div>
              </div>
              <div className="flex items-center justify-center h-24">
                  {data.low_stock_items > 0 ? (
                      <div className="text-center">
                          <p className="text-rose-400 font-bold text-sm">Hay {data.low_stock_items} productos</p>
                          <p className="text-slate-500 text-xs">bajo el stock mínimo.</p>
                      </div>
                  ) : (
                      <div className="text-emerald-500 font-bold text-sm flex items-center gap-2">
                          <CheckCircle2 size={18} /> Inventario Saludable
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* ZONA INFERIOR: GRÁFICOS Y RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* GRÁFICO DE VENTAS */}
          <div className="lg:col-span-2 bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8">
              <div className="flex items-center justify-between mb-6">
                  <div><h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Flujo Mensual</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ingresos Diarios</p></div>
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><BarChart3 size={20}/></div>
              </div>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.sales_data}>
                          <defs><linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: '#10b981' }} formatter={(value) => [formatCurrency(value), 'Ventas']} />
                          <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* RANKING TÉCNICOS */}
          <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8">
              <div className="flex items-center justify-between mb-6">
                  <div><h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Productividad</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">OTs Finalizadas</p></div>
                  <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><Trophy size={20}/></div>
              </div>
              <div className="space-y-4">
                  {data.tech_ranking.length === 0 ? <div className="text-center py-8 text-slate-600 text-xs">Sin finalizaciones este mes</div> : data.tech_ranking.map((tech, index) => (
                      <div key={tech.name} className="flex items-center gap-4 group">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-400'}`}>{index + 1}</div>
                          <div className="flex-1">
                              <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold text-white">{tech.name}</span><span className="text-xs font-mono text-brand-purple">{tech.count} OT</span></div>
                              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-brand-purple to-brand-cyan h-full rounded-full" style={{ width: `${(tech.count / (data.tech_ranking[0].count || 1)) * 100}%` }}></div></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* MOVIMIENTOS RECIENTES */}
      <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 backdrop-blur-md p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-xl border border-white/10"><Landmark size={20} className="text-slate-400" /></div>
              <div><h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Últimos Movimientos</h3></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {recentMovements.length === 0 ? <div className="col-span-5 text-center text-slate-600 py-4">Sin movimientos recientes</div> : recentMovements.map(mov => (
                <div key={mov.id} className="bg-slate-950 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-white/10 transition-all">
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded-lg ${mov.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {mov.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{mov.date.slice(5)}</span>
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm truncate">{formatCurrency(mov.totalAmount)}</h4>
                        <p className="text-[10px] text-slate-500 truncate mt-1">{mov.description}</p>
                    </div>
                </div>
            ))}
          </div>
      </div>
    </div>
  );
}
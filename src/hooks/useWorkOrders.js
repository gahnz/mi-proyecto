import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useWorkOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar Órdenes
  const fetchOrders = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers (
          phone,
          address
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error cargando órdenes:", error);
    } else {
      setOrders(data.map(o => ({
        ...o,
        db_id: o.id,               
        id: o.order_id,            
        
        customer: o.customer_name || "Sin Nombre", 
        device: o.device_name || "Equipo Genérico",     
        type: o.device_type,
        problem: o.reported_failure,
        technician: o.technician_name,
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString('es-CL'),
        total_cost: o.total_cost,
        
        // 👇 AQUÍ ESTÁ EL CAMBIO IMPORTANTE:
        customer_phone: o.customers?.phone || o.customer_phone || "", 
        
        // 1. location: Es la MODALIDAD (Local / Terreno)
        location: o.location || "Local", 
        
        // 2. customer_address: Es la DIRECCIÓN FÍSICA (Calle...)
        customer_address: o.customers?.address || "No registrada", 
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // 2. Crear Orden
  const createOrder = async (orderData) => {
    const { error } = await supabase.from('work_orders').insert([orderData]);
    if (error) throw error;
    await fetchOrders();
  };

  // 3. Actualizar Orden
  const updateOrder = async (uuid, updates) => {
    const { error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', uuid);

    if (error) throw error;
    await fetchOrders();
  };

  // 4. Eliminar Orden
  const deleteOrder = async (uuid) => {
    const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', uuid);

    if (error) throw error;
    await fetchOrders();
  };

  return { orders, loading, createOrder, updateOrder, deleteOrder, refresh: fetchOrders };
};
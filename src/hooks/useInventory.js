import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando inventario:', error);
      setError(error.message);
    } else {
      // Mapeamos los datos para que coincidan con lo que espera tu UI
      const mappedData = data.map(item => ({
        ...item,
        stocksByWarehouse: item.stocks_by_warehouse || { "Bodega Local": 0, "Mercado Libre": 0, "Mercado Full": 0 },
        // Aseguramos que compatible_models sea un array
        compatible_models: item.compatible_models || []
      }));
      setInventory(mappedData);
    }
    setLoading(false);
  };

  const addItem = async (item) => {
    // Preparamos el objeto para Supabase (snake_case)
    const dbPayload = {
      name: item.name,
      type: item.type,
      sku: item.sku,
      price_sell: item.price_sell,
      price_cost: item.price_cost,
      min_stock: item.min_stock,
      stocks_by_warehouse: item.stocksByWarehouse, // Supabase guardará el JSON
      compatible_models: item.compatible_models
    };

    const { error } = await supabase.from('inventory').insert([dbPayload]);
    if (error) throw error;
    await fetchInventory();
  };

  const updateItem = async (id, item) => {
    const dbPayload = {
      name: item.name,
      type: item.type,
      sku: item.sku,
      price_sell: item.price_sell,
      price_cost: item.price_cost,
      min_stock: item.min_stock,
      stocks_by_warehouse: item.stocksByWarehouse,
      compatible_models: item.compatible_models
    };

    const { error } = await supabase.from('inventory').update(dbPayload).eq('id', id);
    if (error) throw error;
    await fetchInventory();
  };

  const deleteItem = async (id) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) throw error;
    await fetchInventory();
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  return { inventory, loading, error, addItem, updateItem, deleteItem, refresh: fetchInventory };
};
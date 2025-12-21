import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export const useCashFlow = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMovements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cash_flow')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando caja:', error);
      setError(error.message);
    } else {
      // Mapear de snake_case (BD) a camelCase (App)
      setMovements(data.map(m => ({
        ...m,
        totalAmount: m.total_amount,
        netAmount: m.net_amount,
        taxAmount: m.tax_amount,
        paymentMethod: m.payment_method,
        docType: m.doc_type,
        docNumber: m.doc_number,
        isEcommerce: m.is_ecommerce
      })));
    }
    setLoading(false);
  };

  const addMovement = async (mov) => {
    const dbPayload = {
      date: mov.date,
      type: mov.type, // 'income' or 'expense'
      category: mov.category,
      description: mov.description,
      payment_method: mov.paymentMethod,
      total_amount: mov.totalAmount,
      net_amount: mov.netAmount,
      tax_amount: mov.taxAmount,
      doc_type: mov.docType,
      doc_number: mov.docNumber,
      is_ecommerce: mov.isEcommerce || false
    };

    const { error } = await supabase.from('cash_flow').insert([dbPayload]);
    if (error) throw error;
    await fetchMovements();
  };

  const updateMovement = async (id, mov) => {
    const dbPayload = {
      date: mov.date,
      type: mov.type,
      category: mov.category,
      description: mov.description,
      payment_method: mov.paymentMethod,
      total_amount: mov.totalAmount,
      net_amount: mov.netAmount,
      tax_amount: mov.taxAmount,
      doc_type: mov.docType,
      doc_number: mov.docNumber,
      is_ecommerce: mov.isEcommerce
    };

    const { error } = await supabase.from('cash_flow').update(dbPayload).eq('id', id);
    if (error) throw error;
    await fetchMovements();
  };

  const deleteMovement = async (id) => {
    const { error } = await supabase.from('cash_flow').delete().eq('id', id);
    if (error) throw error;
    await fetchMovements();
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  return { movements, loading, error, addMovement, updateMovement, deleteMovement, refresh: fetchMovements };
};
import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { loadPricing, savePricing } from '../shared';

export function usePricing() {
  const [pricing, setPricingState] = useState(loadPricing());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseReady) { setPricingState(loadPricing()); setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data } = await supabase.from('pricing').select('data').eq('id', 1).single();
      if (!mounted) return;
      if (data?.data) setPricingState(data.data);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('pricing').on('postgres_changes', { event: '*', schema: 'public', table: 'pricing' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const savePricingData = async (newPricing) => {
    setPricingState(newPricing);
    if (!supabaseReady) { savePricing(newPricing); return; }
    await supabase.from('pricing').upsert({ id: 1, data: newPricing, updated_at: new Date().toISOString() });
  };

  return { pricing, setPricing: savePricingData, loading };
}

import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

export function usePayroll(weekStart) {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payslips, setPayslips]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const [recRes, slipRes] = await Promise.all([
        supabase.from('payroll_records').select('*, profiles(full_name)').order('created_at', { ascending: false }),
        supabase.from('payslips').select('*').order('created_at', { ascending: false }),
      ]);
      if (!mounted) return;
      if (recRes.error) setError(recRes.error); else setPayrollRecords(recRes.data ?? []);
      if (!slipRes.error) setPayslips(slipRes.data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('payroll').on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_records' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [weekStart]);

  const savePayrollRecord = async (record) => {
    if (!supabaseReady) return;
    const { data, error } = await supabase.from('payroll_records').upsert(record, { onConflict: 'staff_id,week_start' }).select().single();
    if (error) throw error;
    return data;
  };

  const savePayslip = async (payslip) => {
    if (!supabaseReady) return;
    const { data, error } = await supabase.from('payslips').insert(payslip).select().single();
    if (error) throw error;
    return data;
  };

  const weekRecords = weekStart ? payrollRecords.filter(r => r.week_start === weekStart) : payrollRecords;

  return { payrollRecords, weekRecords, payslips, loading, error, savePayrollRecord, savePayslip };
}

import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

const normalizePhoto = (row) => {
  const id = row?.id;
  const jobId = row?.job_id ?? row?.jobId ?? null;
  const clientId = row?.client_id ?? row?.clientId ?? null;
  const uploadedAt = row?.uploaded_at ?? row?.uploadedAt ?? row?.created_at ?? row?.createdAt ?? null;
  return {
    ...row,
    id,
    job_id: jobId,
    jobId,
    client_id: clientId,
    clientId,
    uploaded_at: uploadedAt,
    uploadedAt,
    storage_path: row?.storage_path ?? row?.storagePath ?? null,
    storagePath: row?.storage_path ?? row?.storagePath ?? null,
  };
};

const inferExt = (file) => {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const fromType = String(file?.type || '').split('/').pop()?.toLowerCase();
  if (fromType) return fromType === 'jpeg' ? 'jpg' : fromType;
  return 'jpg';
};

export function usePhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshPhotos = async () => {
    if (!supabaseReady) return;
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    setPhotos((data ?? []).map(normalizePhoto));
  };

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .order('uploaded_at', { ascending: false });
        if (!mounted) return;
        if (error) {
          setError(error);
          return;
        }
        setPhotos((data ?? []).map(normalizePhoto));
      } catch (err) {
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    const ch = supabase
      .channel('photos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetch)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const uploadPhoto = async ({ jobId, clientId, date, type, file, uploadedBy }) => {
    if (!supabaseReady) throw new Error('Supabase not configured');
    if (!jobId) throw new Error('Job ID is required');
    const ext = inferExt(file);
    const safeType = (type === 'after' ? 'after' : 'before');
    const safeDate = date || new Date().toISOString().split('T')[0];
    const path = `${jobId}/${safeDate}/${Date.now()}-${safeType}.${ext}`;
    const contentType = file?.type || 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('photos')
      .insert({
        job_id: jobId,
        client_id: clientId,
        date: safeDate,
        type: safeType,
        storage_path: path,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();
    if (error) throw error;
    const normalized = normalizePhoto(data);
    setPhotos(prev => [normalized, ...prev.filter(p => p.id !== normalized.id)]);
    return normalized;
  };

  const getSignedUrl = async (storagePath) => {
    if (!supabaseReady) return null;
    const { data, error } = await supabase.storage.from('job-photos').createSignedUrl(storagePath, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  };

  const removePhoto = async (id, storagePath) => {
    if (!supabaseReady) return;
    await supabase.storage.from('job-photos').remove([storagePath]);
    await supabase.from('photos').delete().eq('id', id);
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  return { photos, setPhotos, loading, error, refreshPhotos, uploadPhoto, getSignedUrl, removePhoto };
}

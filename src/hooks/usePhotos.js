import { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';

export function usePhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      const { data } = await supabase.from('photos').select('*').order('uploaded_at', { ascending: false });
      if (!mounted) return;
      setPhotos(data ?? []);
      setLoading(false);
    };
    fetch();
    const ch = supabase.channel('photos').on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetch).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const uploadPhoto = async ({ jobId, clientId, date, type, file, uploadedBy }) => {
    if (!supabaseReady) throw new Error('Supabase not configured');
    const path = `${jobId}/${Date.now()}-${type}.jpg`;
    const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase.from('photos').insert({ job_id: jobId, client_id: clientId, date, type, storage_path: path, uploaded_by: uploadedBy }).select().single();
    if (error) throw error;
    return data;
  };

  const getSignedUrl = async (storagePath) => {
    if (!supabaseReady) return null;
    const { data } = await supabase.storage.from('job-photos').createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  };

  const removePhoto = async (id, storagePath) => {
    if (!supabaseReady) return;
    await supabase.storage.from('job-photos').remove([storagePath]);
    await supabase.from('photos').delete().eq('id', id);
  };

  return { photos, loading, uploadPhoto, getSignedUrl, removePhoto };
}

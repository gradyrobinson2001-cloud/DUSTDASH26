import { useState, useEffect, useCallback, useRef } from 'react';
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

const parseJsonSafe = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

export function usePhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const refreshPhotos = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      setError(null);
      setPhotos((data ?? []).map(normalizePhoto));
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }
    let mounted = true;
    const fetch = async () => {
      try {
        await refreshPhotos();
        if (!mounted) return;
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
  }, [refreshPhotos]);

  const uploadPhotoDirect = async ({ jobId, clientId, date, type, file, uploadedBy }) => {
    const ext = inferExt(file);
    const safeType = (type === 'after' ? 'after' : 'before');
    const safeDate = date || new Date().toISOString().split('T')[0];
    const path = `${jobId}/${safeDate}/${Date.now()}-${safeType}.${ext}`;
    const contentType = file?.type || 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) {
      throw new Error(uploadError.message || 'Storage upload failed.');
    }

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
    if (error) {
      throw new Error(error.message || 'Failed to save photo metadata.');
    }
    return normalizePhoto(data);
  };

  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message || 'Failed to load session.');
    const token = data?.session?.access_token;
    if (!token) throw new Error('Please sign in again to upload photos.');
    return token;
  };

  const uploadPhoto = async ({ jobId, clientId, date, type, file, uploadedBy }) => {
    if (!supabaseReady) throw new Error('Supabase not configured');
    if (!jobId) throw new Error('Job ID is required');

    const safeType = (type === 'after' ? 'after' : 'before');
    const safeDate = date || new Date().toISOString().split('T')[0];
    const contentType = file?.type || 'image/jpeg';

    let stage = 'request-upload-url';
    try {
      const accessToken = await getAccessToken();

      const createRes = await fetch('/api/photos/create-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          jobId,
          clientId,
          date: safeDate,
          type: safeType,
          fileName: file?.name || '',
          contentType,
        }),
      });
      const createBody = await parseJsonSafe(createRes);
      if (!createRes.ok || createBody?.error) {
        const message = createBody?.error || createBody?.details || `Upload URL request failed (${createRes.status})`;
        throw new Error(message);
      }

      const uploadPath = createBody?.upload?.path;
      const uploadToken = createBody?.upload?.token;
      if (!uploadPath || !uploadToken) {
        throw new Error('Upload URL response missing token/path.');
      }

      stage = 'upload-to-signed-url';
      const { error: signedUploadError } = await supabase.storage
        .from('job-photos')
        .uploadToSignedUrl(uploadPath, uploadToken, file, { contentType, upsert: false });
      if (signedUploadError) {
        throw new Error(signedUploadError.message || 'Signed upload failed.');
      }

      stage = 'complete-upload';
      const completeRes = await fetch('/api/photos/complete-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          jobId,
          clientId,
          date: safeDate,
          type: safeType,
          storagePath: uploadPath,
          uploadedBy,
        }),
      });
      const completeBody = await parseJsonSafe(completeRes);
      if (!completeRes.ok || completeBody?.error) {
        const message = completeBody?.error || completeBody?.details || `Upload completion failed (${completeRes.status})`;
        throw new Error(message);
      }

      const normalized = normalizePhoto(completeBody?.photo);
      setPhotos(prev => [normalized, ...prev.filter(p => p.id !== normalized.id)]);
      return normalized;
    } catch (secureErr) {
      const message = secureErr?.message || 'Unknown upload error.';
      const canFallback = stage === 'request-upload-url' && (
        message.includes('404') ||
        message.includes('Method not allowed') ||
        message.includes('Failed to fetch')
      );

      if (!canFallback) {
        throw new Error(`Photo upload failed (${stage}): ${message}`);
      }

      // Local-dev fallback where API routes may not be running.
      try {
        const normalized = await uploadPhotoDirect({ jobId, clientId, date: safeDate, type: safeType, file, uploadedBy });
        setPhotos(prev => [normalized, ...prev.filter(p => p.id !== normalized.id)]);
        return normalized;
      } catch (directErr) {
        throw new Error(`Photo upload failed: ${directErr?.message || message}`);
      }
    }
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

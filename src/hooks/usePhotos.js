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

const isSupportedImageType = (file) => {
  const type = String(file?.type || '').toLowerCase().trim();
  if (!type) return true;
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
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

  const completeUploadViaApi = async ({ accessToken, jobId, clientId, date, type, storagePath, uploadedBy }) => {
    const completeRes = await fetch('/api/photos/complete-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jobId,
        clientId,
        date,
        type,
        storagePath,
        uploadedBy,
      }),
    });
    const completeBody = await parseJsonSafe(completeRes);
    if (!completeRes.ok || completeBody?.error) {
      const message = completeBody?.error || completeBody?.details || `Upload completion failed (${completeRes.status})`;
      throw new Error(message);
    }
    return normalizePhoto(completeBody?.photo);
  };

  const uploadPhotoDirect = async ({ accessToken, jobId, clientId, date, type, file, uploadedBy }) => {
    const ext = inferExt(file);
    const safeType = (type === 'after' ? 'after' : 'before');
    const safeDate = date || new Date().toISOString().split('T')[0];
    const path = `${jobId}/${safeDate}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeType}.${ext}`;
    const contentType = file?.type || 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) {
      throw new Error(uploadError.message || 'Storage upload failed.');
    }

    try {
      return await completeUploadViaApi({
        accessToken,
        jobId,
        clientId,
        date: safeDate,
        type: safeType,
        storagePath: path,
        uploadedBy,
      });
    } catch (err) {
      // Avoid orphan files when metadata creation fails.
      await supabase.storage.from('job-photos').remove([path]);
      throw err;
    }
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
    if (!file) throw new Error('Photo file is required');
    if (file.size > 15 * 1024 * 1024) throw new Error('Photo is too large. Please keep uploads under 15MB.');
    if (!isSupportedImageType(file)) throw new Error('Unsupported format. Please upload JPG, PNG, or WEBP.');

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
      const normalized = await completeUploadViaApi({
        accessToken,
        jobId,
        clientId,
        date: safeDate,
        type: safeType,
        storagePath: uploadPath,
        uploadedBy,
      });
      setPhotos(prev => [normalized, ...prev.filter(p => p.id !== normalized.id)]);
      return normalized;
    } catch (secureErr) {
      const message = secureErr?.message || 'Unknown upload error.';
      // Fallback to direct upload to improve resilience when secure route path fails.
      try {
        const accessToken = await getAccessToken();
        const normalized = await uploadPhotoDirect({ accessToken, jobId, clientId, date: safeDate, type: safeType, file, uploadedBy });
        setPhotos(prev => [normalized, ...prev.filter(p => p.id !== normalized.id)]);
        return normalized;
      } catch (directErr) {
        throw new Error(`Photo upload failed (${stage}): ${message}. Direct fallback also failed: ${directErr?.message || 'unknown error'}`);
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

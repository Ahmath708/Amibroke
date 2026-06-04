// User profile read/write + avatar upload (Supabase `profiles` table + `avatars`
// storage bucket).
import { getSupabase } from './supabaseClient';
import { TABLES, BUCKETS } from './tables';

export async function getProfile(userId: string): Promise<any> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await (client as any)
      .from(TABLES.profiles)
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('Failed to fetch profile:', error);
    return null;
  }
}

export async function updateProfile(userId: string, updates: { username?: string; display_name?: string; avatar_url?: string }): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await (client as any)
      .from(TABLES.profiles)
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Failed to update profile:', error);
    return false;
  }
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) {
    console.warn('[uploadAvatar] Supabase client not available');
    return null;
  }

  try {
    console.log('[uploadAvatar] Fetching local image URI:', localUri);
    const response = await fetch(localUri);
    const blob = await response.blob();

    const fileExt = localUri.split('.').pop() || 'jpg';
    const fileName = `avatar-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('[uploadAvatar] Uploading image blob to storage bucket "avatars":', filePath);
    const { error: uploadError } = await client.storage
      .from(BUCKETS.avatars)
      .upload(filePath, blob, {
        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('[uploadAvatar] Storage upload failed:', uploadError.message);
      throw uploadError;
    }

    const { data } = client.storage.from(BUCKETS.avatars).getPublicUrl(filePath);
    const publicUrl = data.publicUrl;
    console.log('[uploadAvatar] Upload succeeded. Public URL:', publicUrl);

    const ok = await updateProfile(userId, { avatar_url: publicUrl });
    if (!ok) {
      console.warn('[uploadAvatar] Failed to update profile database row with avatar URL');
      return null;
    }

    return publicUrl;
  } catch (error) {
    console.warn('[uploadAvatar] Failed to upload avatar:', error);
    return null;
  }
}

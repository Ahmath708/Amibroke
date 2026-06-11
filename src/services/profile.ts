// User profile read/write + avatar upload (Supabase `profiles` table + `avatars`
// storage bucket).
import { withClient } from './supabaseClient';
import { TABLES, BUCKETS } from './tables';

export async function getProfile(userId: string): Promise<any> {
  return withClient('fetch profile', null, async (client) => {
    const { data, error } = await client
      .from(TABLES.profiles)
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  });
}

export async function updateProfile(userId: string, updates: { username?: string; avatar_url?: string; preferred_tone?: string; debt_strategy?: string; first_name?: string; last_name?: string }): Promise<boolean> {
  return withClient('update profile', false, async (client) => {
    const { error } = await client
      .from(TABLES.profiles)
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  });
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string | null> {
  return withClient('upload avatar', null, async (client) => {
    const response = await fetch(localUri);
    const blob = await response.blob();

    const fileExt = localUri.split('.').pop() || 'jpg';
    const fileName = `avatar-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await client.storage
      .from(BUCKETS.avatars)
      .upload(filePath, blob, {
        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data } = client.storage.from(BUCKETS.avatars).getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const ok = await updateProfile(userId, { avatar_url: publicUrl });
    return ok ? publicUrl : null;
  });
}

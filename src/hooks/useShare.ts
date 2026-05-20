import { useState, useCallback } from 'react';
import { Share, Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { trackShareInitiated, trackShareCompleted } from '@/services/analytics';

interface UseShareOptions {
  title?: string;
  message?: string;
  url?: string;
  score?: number;
}

export function useShare() {
  const [sharing, setSharing] = useState(false);

  const share = useCallback(async (options: UseShareOptions) => {
    setSharing(true);
    await trackShareInitiated('native', options.score || 0);

    try {
      await Share.share({
        title: options.title,
        message: options.message || 'Check out my financial health score on Am I Broke!',
        url: options.url,
      });
      await trackShareCompleted('native');
      return { success: true };
    } catch (e: any) {
      if (e.message !== 'Share canceled') {
        Alert.alert('Share failed', 'Could not share. Please try again.');
      }
      return { success: false };
    } finally {
      setSharing(false);
    }
  }, []);

  const shareFile = useCallback(async (fileUri: string, mimeType = 'image/png') => {
    setSharing(true);
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Sharing.shareAsync(fileUri, { mimeType, UTI: mimeType === 'image/png' ? 'public.png' : undefined });
      } else {
        await Share.share({ url: fileUri });
      }
      await trackShareCompleted('file');
      return { success: true };
    } catch {
      Alert.alert('Share failed', 'Could not share the file.');
      return { success: false };
    } finally {
      setSharing(false);
    }
  }, []);

  return { share, shareFile, sharing };
}

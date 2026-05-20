import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { trackScreenView, trackEvent, initAnalytics } from '@/services/analytics';

export function useAnalytics(screenName?: string) {
  useEffect(() => {
    initAnalytics().catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (screenName) {
        trackScreenView(screenName);
      }
    }, [screenName]),
  );

  return {
    track: trackEvent,
    trackScreen: trackScreenView,
  };
}

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored !== null) {
          setValue(JSON.parse(stored));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [key]);

  const setStoredValue = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      const resolved = typeof newValue === 'function' ? (newValue as (prev: T) => T)(value) : newValue;
      setValue(resolved);
      try {
        await AsyncStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // ignore
      }
    },
    [key, value],
  );

  return { value, setValue: setStoredValue, loading };
}

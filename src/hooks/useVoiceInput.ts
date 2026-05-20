import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';

interface UseVoiceInputResult {
  listening: boolean;
  transcript: string;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  supported: boolean;
  error: string | null;
}

export function useVoiceInput(): UseVoiceInputResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const permissionRef = useRef(false);

  const isWeb = Platform.OS === 'web';

  const supported = isWeb
    ? typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    : Platform.OS === 'ios' || Platform.OS === 'android';

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      permissionRef.current = granted;
      if (!granted) {
        setError('Microphone permission denied. Please enable it in settings.');
        return false;
      }
      return true;
    } catch {
      setError('Failed to request microphone permission.');
      return false;
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);

    if (isWeb) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          setError('Voice input is not supported in this browser.');
          return;
        }

        setListening(true);
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event: any) => {
          const t = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join(' ');
          setTranscript(t);
        };

        recognition.onend = () => setListening(false);
        recognition.onerror = (e: any) => {
          setError(`Voice recognition error: ${e.error}`);
          setListening(false);
        };

        recognition.start();
      } catch {
        setError('Failed to start voice input.');
        setListening(false);
      }
      return;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      setListening(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.SPEECH_RECOGNITION,
      );
      await recording.startAsync();
      recordingRef.current = recording;
    } catch (e) {
      setError('Failed to start recording. Please try again.');
      setListening(false);
      console.error('[voice] start error:', e);
    }
  }, [isWeb, requestPermission]);

  const stopListening = useCallback(async () => {
    if (isWeb) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.stop();
        }
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch {
      // ignore
    }
    setListening(false);
  }, [isWeb]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  return {
    listening,
    transcript,
    startListening,
    stopListening,
    supported,
    error,
  };
}

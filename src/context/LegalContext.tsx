import React, { createContext, useContext, useState, useCallback } from 'react';
import LegalSheet, { LegalDoc } from '@/components/LegalSheet';

interface LegalContextValue {
  showLegal: (doc: LegalDoc) => void;
  hideLegal: () => void;
}

const LegalContext = createContext<LegalContextValue>({ showLegal: () => {}, hideLegal: () => {} });

/** Access the legal viewer from anywhere: const { showLegal } = useLegal(). */
export const useLegal = () => useContext(LegalContext);

/**
 * Provides showLegal/hideLegal and renders the LegalSheet overlay once, above the
 * whole app. Legal pages are shown as a Modal (not a navigator screen) so they work
 * in both the auth and app contexts and can't get stuck (see LegalSheet).
 */
export function LegalProvider({ children }: { children: React.ReactNode }) {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const showLegal = useCallback((d: LegalDoc) => setDoc(d), []);
  const hideLegal = useCallback(() => setDoc(null), []);

  return (
    <LegalContext.Provider value={{ showLegal, hideLegal }}>
      {children}
      <LegalSheet doc={doc} onClose={hideLegal} />
    </LegalContext.Provider>
  );
}

import { createContext, useContext, useState, type ReactNode } from "react";
import { isSummaryLanguage, LANGUAGE_STORAGE_KEY, type SummaryLanguage } from "../lib/language";

const LanguageContext = createContext<{
  language: SummaryLanguage;
  setLanguage: (language: SummaryLanguage) => void;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<SummaryLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return isSummaryLanguage(saved) ? saved : "en";
    } catch {
      return "en";
    }
  });

  function setLanguage(next: SummaryLanguage): void {
    updateLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Privacy settings may block persistence; the current page still works.
    }
  }

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("Summary language requires LanguageProvider.");
  return context;
}

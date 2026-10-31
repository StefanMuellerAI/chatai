import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import the JSON resource files
import en from './i18n/en';
import de from './i18n/de';

// Optional default language from front.json ("defaultLanguage"). When set, it applies to
// everyone without a saved choice (?lng=, localStorage) and the browser language is ignored.
const supportedLanguages = ["en", "de"];
const defaultLanguage = import.meta.env.VITE_DEFAULT_LANGUAGE;
const hasDefaultLanguage = supportedLanguages.includes(defaultLanguage);

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    debug: false,
    fallbackLng: hasDefaultLanguage ? [defaultLanguage, "en"] : "en",
    ...(hasDefaultLanguage && {
      supportedLngs: supportedLanguages,
      detection: { order: ["querystring", "localStorage", "cookie"], caches: ["localStorage"] },
    }),
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
  });

// Keep <html lang> in sync for screen readers and hyphenation
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.resolvedLanguage || i18n.language || "en";

export default i18n;

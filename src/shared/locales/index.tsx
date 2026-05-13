
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import spanishLang from "./es_ES.json";
import englishLang from "./en_US.json";

export const normalizeLng = (lng: string) => {
  switch (lng) {
    case "en-US":
    case "en_US":
      return "en_US";
    case "es-ES":
    case "es_ES":
      return "es_ES";
    default:
      return "en_US";
  }
};

// List of supported languages
export const availableLanguages = [
  { lang: "en_US", name: "English (EE.UU.)" },
  { lang: "es_ES", name: "Español (España)" },
];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en_US: { translation: englishLang },
      es_ES: { translation: spanishLang },
    },
    fallbackLng: "en_US",
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    lng: normalizeLng(localStorage.getItem("i18nextLng") || navigator.language),
  });

  
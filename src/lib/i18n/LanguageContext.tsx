"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Language, TranslationKey, translations } from "./translations";

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en");

    // Load saved language on mount
    useEffect(() => {
        try {
            const savedLang = localStorage.getItem("language") as Language;
            if (savedLang === "en" || savedLang === "my") {
                setLanguageState(savedLang);
            }
        } catch (e) { }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        try {
            localStorage.setItem("language", lang);
        } catch (e) { }
    };

    const t = (key: TranslationKey): string => {
        return translations[language][key] || translations["en"][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}

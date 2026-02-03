/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { createContext, useContext, useState } from 'react';
import { translations } from '../utils/translations';

// Create Language Context
const LanguageContext = createContext();

// Language Provider Component
export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('km');

  const toggleLang = () => {
    setLang(prev => prev === 'km' ? 'en' : 'km');
  };

  const t = (key, params) => {
    let text = translations[lang][key] || key;
    
    // Replace {{variable}} with values from params object
    if (params) {
      Object.keys(params).forEach(paramKey => {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), params[paramKey]);
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
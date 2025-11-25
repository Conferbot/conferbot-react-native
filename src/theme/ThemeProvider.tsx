import React, { createContext, useContext, useMemo } from 'react';
import type { ConferBotTheme, ConferBotThemeOverride } from './types';
import { defaultTheme } from './defaultTheme';

// Deep merge utility
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target };

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key as keyof T];
    const targetValue = output[key as keyof T];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object'
    ) {
      output[key as keyof T] = deepMerge(targetValue, sourceValue as any);
    } else if (sourceValue !== undefined) {
      output[key as keyof T] = sourceValue as any;
    }
  });

  return output;
}

// Theme context
const ThemeContext = createContext<ConferBotTheme>(defaultTheme);

// Theme provider props
interface ThemeProviderProps {
  theme?: ConferBotThemeOverride;
  children: React.ReactNode;
}

// Theme provider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ theme: themeOverride, children }) => {
  const mergedTheme = useMemo(() => {
    if (!themeOverride) {
      return defaultTheme;
    }

    return deepMerge(defaultTheme, themeOverride as Partial<ConferBotTheme>);
  }, [themeOverride]);

  return <ThemeContext.Provider value={mergedTheme}>{children}</ThemeContext.Provider>;
};

// Hook to use theme
export const useTheme = (): ConferBotTheme => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

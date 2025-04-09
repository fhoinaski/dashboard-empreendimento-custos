"use client"; // Add 'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// Import useTheme from next-themes to use internally
import { ThemeProvider as NextThemesProvider, useTheme as useNextThemes, type ThemeProviderProps } from 'next-themes';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Internal hook to access next-themes context
function useThemeInternal() {
    // Directly use the hook from next-themes
    const { theme, setTheme } = useNextThemes();
    // Return the values, ensuring theme is compatible with our Theme type or defaults to 'system'
    return {
        // Cast the theme from next-themes (string | undefined) to our specific Theme type
        currentNextTheme: (theme as Theme) ?? 'system',
        setNextTheme: setTheme,
    };
}


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Get the actual theme and setter from next-themes
  const { currentNextTheme, setNextTheme } = useThemeInternal();

  // Local state might still be useful if you need to track the *user's preference* separately
  // from the *currently applied* theme (e.g., if 'system' is preferred but currently applies 'dark').
  // Or, simplify and remove this if you only care about the applied theme.
  const [preferredTheme, setPreferredTheme] = useState<Theme>(currentNextTheme);

  // Update local preference when next-themes reports a change
  useEffect(() => {
      // FIX: Assert the type when setting the local state
      setPreferredTheme(currentNextTheme as Theme);
  }, [currentNextTheme]);


  // Function to set the theme using next-themes' setter
  const setTheme = (newTheme: Theme) => {
    setNextTheme(newTheme); // Tell next-themes to change the theme
    // No need to update local state here, useEffect above handles it
    // setPreferredTheme(newTheme);
  };

  // Value for your custom context uses the theme reported by next-themes
  const value: ThemeContextType = {
    theme: currentNextTheme, // Directly use the theme from next-themes
    setTheme,
  };

  // Render the NextThemesProvider which actually controls the theme
  return (
    <ThemeContext.Provider value={value}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        {...props} // Pass through other props like storageKey etc.
      >
        {children}
      </NextThemesProvider>
    </ThemeContext.Provider>
  );
}

// Your custom hook remains the same, consuming your custom context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
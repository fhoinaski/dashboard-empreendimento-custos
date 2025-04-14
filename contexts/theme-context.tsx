"use client"; // Add 'use client'

import React, { createContext, useContext, useState, useEffect } from 'react';
// Import useTheme from next-themes to use internally
import { ThemeProvider as NextThemesProvider, useTheme as useNextThemes, type ThemeProviderProps, Theme } from 'next-themes';

type AppTheme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: AppTheme;
    setTheme: (theme: AppTheme) => void;
    applyTheme: (theme: AppTheme) => void; // New function to apply theme
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    // Get the actual theme and setter from next-themes
    const { theme: currentNextTheme, setTheme: setNextTheme } = useNextThemes();

    // State to manage the preferred theme
    const [preferredTheme, setPreferredTheme] = useState<AppTheme>(() => {
        // Load preferred theme from localStorage on initialization
        const storedTheme = localStorage.getItem('theme') as AppTheme;
        return storedTheme || 'system';
    });

    useEffect(() => {
        // This effect synchronizes the preferred theme with the theme from next-themes
        // and updates the localStorage whenever the preferred theme changes.
        if (preferredTheme !== currentNextTheme && preferredTheme !== 'system') {
            setNextTheme(preferredTheme as Theme)
        }
        
        localStorage.setItem('theme', preferredTheme);
    }, [preferredTheme]);

    // Effect to apply the theme to the documentElement (<html>)
    useEffect(() => {
        applyTheme(preferredTheme);
    }, [preferredTheme]);

    // Function to set the theme and persist the change
    const setTheme = (newTheme: AppTheme) => {
        setPreferredTheme(newTheme);
    };

     // Function to apply the theme to the documentElement (<html>)
    const applyTheme = (theme: AppTheme) => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    };

    const value: ThemeContextType = {
        theme: preferredTheme,
        setTheme,
        applyTheme, // Expose the new applyTheme function
    };

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
}+}
declare module 'next-themes' {
  interface ThemeProviderProps {
    children: React.ReactNode;
    attribute?: string;
    enableSystem?: boolean;
    defaultTheme?: string;
    storageKey?: string;
    disableTransitionOnChange?: boolean;
  }

  export function ThemeProvider(props: ThemeProviderProps): JSX.Element;
  export function useTheme(): {
    theme: string | undefined;
    setTheme: (theme: string) => void;
    themes: string[];
  };
}
import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Define os tipos de temas suportados pela aplicação.
 */
type Theme = 'light' | 'dark' | 'emerald' | 'calendar' | 'midnight' | 'ocean' | 'system';

/**
 * Estrutura do contexto de tema.
 */
interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    customStyles: Record<string, string>;
    updateCustomStyle: (key: string, value: string) => void;
    resetCustomStyles: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provedor de Contexto de Tema.
 * Gerencia a preferência de cor (claro, escuro ou sistema) e persiste no localStorage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Inicializa o estado do tema buscando no localStorage ou assumindo 'system' como padrão
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('irongrid_theme');
        return (saved as Theme) || 'system';
    });

    // Custom styles for runtime theme design
    const [customStyles, setCustomStyles] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('irongrid_custom_styles');
        return saved ? JSON.parse(saved) : {};
    });

    /**
     * Atualiza o tema tanto no estado do React quanto no armazenamento local.
     */
    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('irongrid_theme', newTheme);
    };

    const updateCustomStyle = (key: string, value: string) => {
        const newStyles = { ...customStyles, [key]: value };
        setCustomStyles(newStyles);
        localStorage.setItem('irongrid_custom_styles', JSON.stringify(newStyles));
    };

    const resetCustomStyles = () => {
        setCustomStyles({});
        localStorage.removeItem('irongrid_custom_styles');
        // Reload to clear inline styles on root
        window.location.reload();
    };

    /**
     * Efeito para aplicar as classes de CSS no elemento raiz (HTML) 
     * sempre que o tema for alterado.
     */
    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = (t: Theme) => {
            root.classList.remove('light', 'dark', 'midnight', 'ocean', 'emerald', 'calendar');
            root.setAttribute('data-theme', t);

            // Se for 'system', detecta a preferência do sistema operacional
            if (t === 'system') {
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                root.classList.add(systemTheme);
            } else if (['midnight', 'ocean', 'emerald'].includes(t)) {
                // Temas escuros, então adicionamos a classe 'dark' base
                root.classList.add(t);
                root.classList.add('dark');
            } else {
                root.classList.add(t);
            }
        };

        applyTheme(theme);

        /**
         * Adiciona um ouvinte para mudanças no tema do sistema operacional 
         * caso a opção 'system' esteja selecionada.
         */
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme('system');
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    // Apply custom styles
    useEffect(() => {
        const root = window.document.documentElement;
        Object.entries(customStyles).forEach(([key, value]) => {
            // Convert Hex to RGB space separated if it looks like hex
            if (value.startsWith('#')) {
                const r = parseInt(value.slice(1, 3), 16);
                const g = parseInt(value.slice(3, 5), 16);
                const b = parseInt(value.slice(5, 7), 16);
                root.style.setProperty(`--${key}`, `${r} ${g} ${b}`);
            } else {
                root.style.setProperty(`--${key}`, value);
            }
        });
    }, [customStyles]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, customStyles, updateCustomStyle, resetCustomStyles }}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Hook customizado para acessar o contexto de tema de forma simplificada.
 */
export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
    }
    return context;
}

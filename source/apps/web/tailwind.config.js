/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                page: 'rgb(var(--bg-main) / <alpha-value>)',
                sidebar: 'rgb(var(--bg-sidebar) / <alpha-value>)',
                header: 'rgb(var(--bg-header) / <alpha-value>)',
                main: 'rgb(var(--text-primary) / <alpha-value>)',
                secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
                muted: 'rgb(var(--text-muted) / <alpha-value>)',
                border: 'rgb(var(--border) / <alpha-value>)',
                card: 'rgb(var(--card) / <alpha-value>)',
                accent: 'rgb(var(--accent) / <alpha-value>)',
                primary: 'rgb(var(--accent) / <alpha-value>)',
                success: 'rgb(var(--success) / <alpha-value>)',
                warning: 'rgb(var(--warning) / <alpha-value>)',
                error: 'rgb(var(--error) / <alpha-value>)',
                'input-bg': 'rgb(var(--input-bg) / <alpha-value>)',
                'input-border': 'rgb(var(--border) / <alpha-value>)',
            }
        },
    },
    plugins: [],
}

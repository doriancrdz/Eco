import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        aura: {
          emerald: {
            light: '#d4f4e0',
            DEFAULT: '#b8e8d0',
          },
          blue: {
            light: '#d4e8f4',
            DEFAULT: '#b8d8e8',
          },
          sand: {
            light: '#f0e8d8',
            DEFAULT: '#e8dcc8',
          },
        },
      },
      borderRadius: {
        'glass': '20px',
        'card': '32px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'floating': '0 20px 60px rgba(0, 0, 0, 0.12)',
        'aura': '0 0 40px rgba(184, 232, 208, 0.3)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
};
export default config;

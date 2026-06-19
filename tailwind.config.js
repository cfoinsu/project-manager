/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        notion: {
          blue: {
            DEFAULT: '#0075de',
            active: '#005bab'
          },
          indigo: '#213183',
          sky: '#62aef0',
          purple: {
            DEFAULT: '#d6b6f6',
            deep: '#391c57'
          },
          pink: '#ff64c8',
          orange: {
            DEFAULT: '#dd5b00',
            deep: '#793400'
          },
          teal: '#2a9d99',
          green: '#1aae39',
          brown: '#523410',
          canvas: {
            DEFAULT: '#ffffff',
            soft: '#f6f5f4'
          },
          hairline: '#e6e6e6',
          ink: {
            DEFAULT: '#191919',
            secondary: '#31302e',
            muted: '#615d59',
            faint: '#a39e98'
          }
        },
        toss: {
          blue: {
            DEFAULT: '#3182F6',
            light: '#E8F3FF',
            hover: '#1B64DA',
            alpha: 'rgba(49, 130, 246, 0.1)',
            dark: '#1B64DA'
          },
          gray: {
            50: '#F9FAFB',
            100: '#F2F4F6',
            200: '#E5E8EB',
            300: '#D1D6DB',
            400: '#B0B8C1',
            500: '#8B95A1',
            600: '#6B7684',
            700: '#4E5968',
            800: '#333D4B',
            900: '#191F28',
          },
          red: {
            DEFAULT: '#F04452',
            light: '#FEECEE',
          },
          green: {
            DEFAULT: '#00B06C',
            light: '#E6F8F1',
          },
          yellow: {
            DEFAULT: '#FFAD0D',
            light: '#FFF6E6',
          }
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'notion-1': '0 0.175px 1.041px rgba(0,0,0,0.01), 0 0.8px 2.925px rgba(0,0,0,0.02), 0 2.025px 7.847px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)',
        'notion-2': '0 2px 8px rgba(0,0,0,0.02), 0 10px 24px rgba(0,0,0,0.03), 0 23px 52px rgba(0,0,0,0.05)',
        toss: '0 8px 24px rgba(0, 0, 0, 0.04)',
        'toss-lg': '0 16px 40px rgba(0, 0, 0, 0.06)',
        'toss-dark': '0 8px 24px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}

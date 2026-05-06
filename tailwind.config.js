/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'PingFang SC',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        ink: {
          900: '#1d1d1f',
          700: '#424245',
          500: '#6e6e73',
          400: '#86868b',
          300: '#a1a1a6',
        },
        line: {
          DEFAULT: '#d2d2d7',
          soft: '#e8e8ed',
        },
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f5f5f7',
          warm: '#fbfbfd',
        },
        accent: {
          DEFAULT: '#0071e3',
          hover: '#0077ED',
          soft: '#e8f1fc',
        },
        good: '#1f883d',
        warn: '#bf6900',
        bad: '#c4314b',
      },
      borderRadius: {
        xl2: '1rem',
        '3xl2': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        pop: '0 4px 12px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.10)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flipIn: {
          '0%': { opacity: '0', transform: 'rotateY(-8deg)' },
          '100%': { opacity: '1', transform: 'rotateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.3)', opacity: '0.6' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 350ms cubic-bezier(0.25, 0.1, 0.25, 1) both',
        flipIn: 'flipIn 280ms cubic-bezier(0.25, 0.1, 0.25, 1) both',
        pulseDot: 'pulseDot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

import type { Config } from 'tailwindcss'
import { heroui } from '@heroui/react'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A4F72',
          hover: '#0F3351',
          light: '#2E6A96',
        },
        gold: {
          DEFAULT: '#C9922A',
          light: '#E8B84B',
        },
        steel: '#A8C4D4',
        surface: '#FFFFFF',
        bg: '#F5F6F8',
        border: '#E0E6ED',
        text: {
          DEFAULT: '#1A2C3D',
          secondary: '#4A6580',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'navbar-gradient': 'linear-gradient(135deg, #0F2F47 0%, #1A4F72 60%, #1d5a82 100%)',
      },
    },
  },
  darkMode: 'class',
  plugins: [heroui()],
}

export default config

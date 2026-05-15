import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7c3aed',
          foreground: '#ffffff',
        },
        background: '#0b0b10',
        foreground: '#f5f5f7',
        muted: '#1a1a22',
        'muted-foreground': '#a1a1aa',
        border: '#27272a',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Consolas', 'monospace'],
      },
      maxWidth: {
        container: '72rem',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.93)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%':       { transform: 'translateY(-10px) rotate(0.4deg)' },
          '66%':       { transform: 'translateY(-6px) rotate(-0.3deg)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% center' },
          to:   { backgroundPosition: '-200% center' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'orb-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%':       { transform: 'translate(35px, -25px) scale(1.04)' },
          '50%':       { transform: 'translate(15px, 20px) scale(0.97)' },
          '75%':       { transform: 'translate(-25px, -10px) scale(1.02)' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(0.9)', opacity: '0.9' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'key-press': {
          '0%, 100%': { transform: 'translateY(0)', boxShadow: '0 3px 0 rgba(0,0,0,0.45)' },
          '50%':       { transform: 'translateY(2px)', boxShadow: '0 1px 0 rgba(0,0,0,0.45)' },
        },
        'border-shimmer': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':       { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fade-up':        'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':        'fade-in 0.4s ease-out forwards',
        'scale-in':       'scale-in 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'float':          'float 8s ease-in-out infinite',
        'shimmer':        'shimmer 5s linear infinite',
        'marquee':        'marquee 28s linear infinite',
        'orb-drift':      'orb-drift 14s ease-in-out infinite',
        'orb-drift-slow': 'orb-drift 20s ease-in-out infinite reverse',
        'pulse-ring':     'pulse-ring 2s ease-out infinite',
        'key-press':      'key-press 0.2s ease-in-out',
        'border-shimmer': 'border-shimmer 5s ease infinite',
        'ping-slow':      'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config

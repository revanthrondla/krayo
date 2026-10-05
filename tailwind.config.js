/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#141B26',
          soft: '#212B3B',
        },
        paper: '#F6F8FA',
        card: '#FFFFFF',
        line: '#E1E6EB',
        text: {
          DEFAULT: '#1B2430',
          muted: '#5B6472',
          faint: '#93A0B0',
        },
        thread: {
          DEFAULT: '#2F8074',
          dark: '#256459',
          light: '#7FD8C6',
          bg: '#2F807414',
        },
        amber: {
          DEFAULT: '#C08A2E',
          light: '#E0B466',
          bg: '#C08A2E1A',
        },
        blue: {
          DEFAULT: '#3B6FA0',
          light: '#7FA8CE',
          bg: '#3B6FA01A',
        },
        red: {
          DEFAULT: '#B24C4C',
          light: '#E39494',
          bg: '#B24C4C1A',
        },
        violet: {
          DEFAULT: '#7B5EA7',
          light: '#B79ED6',
          bg: '#7B5EA71A',
        },
        orange: {
          DEFAULT: '#B4652A',
          light: '#E0A66E',
          bg: '#B4652A1A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '9px',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm editorial neutrals; legacy token names preserve existing component states.
        stone: {"50":"#F4F1EA","100":"#ECE8DE","200":"#DDD8CC","300":"#C5BFB2","400":"#A39D92","500":"#7E7970","600":"#5E5A54","700":"#45423E","800":"#2E2C2B","900":"#1B1B1F","950":"#111114"},
        // Soft dusty plum: dark sections, the footer and the workspace surfaces.
        plum: {"DEFAULT":"#5D4052","600":"#A98399","700":"#86607A","800":"#6B4A5E","850":"#634558","900":"#5D4052","950":"#46303F"},
        // Bougainvillea. 500 and up are dark enough for small text on ivory.
        magenta: {"50":"#FAF3F6","100":"#F4E6EC","200":"#EBCFDB","300":"#DDAFC4","400":"#C98AA7","500":"#9A5675","600":"#7E4560","700":"#5D4052"},
        gold: {"DEFAULT":"#C9A227","100":"#FAF1D2","200":"#F0DE9E","300":"#E8CF7A","400":"#C9A227","500":"#A88418","600":"#8C6A12","700":"#6A500D"},
        ivory: '#F4F1EA',
        ink: '#1B1B1F',
        sky: '#B9D3E6',
        blossom: { DEFAULT: '#D590AE', soft: '#F1D9E4' },
        sage: { 500: '#4A6B5D' },
        blueprint: { 500: '#2B5B84', 600: '#1E4364' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        script: ['var(--font-script)', 'cursive'],
        mono: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gem: '0 1px 0 rgba(255,255,255,0.35) inset, 0 10px 30px -12px rgba(35,40,34,0.12)',
        plate: '0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 50px -24px rgba(35,40,34,0.12)',
        lift: '0 30px 80px -30px rgba(14,7,13,0.65)',
      },
      keyframes: {
        scan: { '0%': { clipPath: 'inset(0 0 100% 0)' }, '100%': { clipPath: 'inset(0 0 0 0)' } },
        scanline: { '0%': { top: '0%', opacity: '1' }, '92%': { opacity: '1' }, '100%': { top: '100%', opacity: '0' } },
        rise: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        scan: 'scan 2.6s cubic-bezier(.65,.05,.25,1) .2s both',
        scanline: 'scanline 2.6s cubic-bezier(.65,.05,.25,1) .2s both',
        rise: 'rise .5s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  // 👇 AQUÍ ESTABA EL PROBLEMA: Tailwind estaba buscando en el lugar incorrecto
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#cb5eee',
          cyan: '#4be1ec',
          dark: '#0f172a',
        }
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #cb5eee 0%, #4be1ec 100%)',
      },
    },
  },
  plugins: [],
}
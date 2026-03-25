// js/config.example.js — template para configuración local
// Copiá este archivo como js/config.js y completá tus keys.
// js/config.js está en .gitignore — nunca se commitea.

window.DFA_CONFIG = {

  // ── Opción A: Sin backend (directo a APIs externas) ──────────────────────
  // Necesitás una CoinGecko API key (Demo gratuita)
  // Obtener en: https://www.coingecko.com/api/pricing
  COINGECKO_API_KEY: '',

  // ── Opción B: Con backend (recomendado) ──────────────────────────────────
  // Cuando BACKEND_URL está seteado, la API key de CoinGecko no es necesaria
  // en el frontend (se maneja del lado del servidor).
  // BACKEND_URL: 'https://tu-backend.railway.app'

};

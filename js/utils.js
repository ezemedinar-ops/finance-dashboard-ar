/**
 * utils.js — Argentine Finance Dashboard
 * Formatters, DOM helpers, skeleton/error UI
 */

// ─── Skeleton CSS (injected once) ───────────────────────────────────────────
(function injectSkeletonCSS() {
  if (document.getElementById('dfa-skeleton-css')) return;
  const style = document.createElement('style');
  style.id = 'dfa-skeleton-css';
  style.textContent = `
    .dfa-skeleton {
      background: linear-gradient(90deg, #eae7e7 25%, #f0eded 50%, #eae7e7 75%);
      background-size: 200% 100%;
      animation: dfa-shimmer 1.4s infinite;
      display: inline-block;
      border-radius: 0;
    }
    @keyframes dfa-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    #dfa-error-banner { display: none; }
    #dfa-stale-badge  { display: none; }
  `;
  document.head.appendChild(style);
})();

// ─── Number Formatters ───────────────────────────────────────────────────────

/** Format as Argentine pesos: $1.245,00 */
function formatARS(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/** Format as USD: u$s 64,281.50 */
function formatUSD(n) {
  if (n == null || isNaN(n)) return '—';
  return 'u$s ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/** Format as signed percentage: +2.45% */
function formatPct(n) {
  if (n == null || isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

/** Format large numbers: $1.26T, $82.4B, $450M */
function formatMarketCap(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + n.toLocaleString('en-US');
}

/** Format BTC amount with satoshi display */
function formatBTC(n) {
  if (n == null || isNaN(n)) return '—';
  if (n < 0.001) {
    const sats = Math.round(n * 1e8);
    return sats.toLocaleString('es-AR') + ' sats';
  }
  return n.toFixed(8).replace(/\.?0+$/, '') + ' BTC';
}

/** Format ETH amount */
function formatETH(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(6).replace(/\.?0+$/, '') + ' ETH';
}

// ─── Color / Icon Helpers ────────────────────────────────────────────────────

/** Returns Tailwind text color class based on percentage change */
function changeClass(pct) {
  if (pct == null || isNaN(pct)) return 'text-outline';
  if (Math.abs(pct) < 0.05) return 'text-outline';
  return pct > 0 ? 'text-secondary' : 'text-error';
}

/** Returns Material Symbols icon name based on percentage change */
function changeIcon(pct) {
  if (pct == null || isNaN(pct)) return 'horizontal_rule';
  if (Math.abs(pct) < 0.05) return 'horizontal_rule';
  return pct > 0 ? 'arrow_upward' : 'arrow_downward';
}

// ─── Skeleton Helpers ────────────────────────────────────────────────────────

/** Replace element content with a shimmer placeholder */
function showSkeleton(el, width = 'w-24', height = 'h-6') {
  if (!el) return;
  el.innerHTML = `<span class="dfa-skeleton ${width} ${height}"></span>`;
}

/** Render 20 skeleton rows in the crypto table */
function showTableSkeletons() {
  const tbody = document.getElementById('crypto-table-body');
  if (!tbody) return;
  let html = '';
  for (let i = 0; i < 20; i++) {
    html += `<tr class="border-b-4 border-surface-container">
      <td class="p-3 md:p-6"><span class="dfa-skeleton w-6 h-4"></span></td>
      <td class="p-3 md:p-6"><span class="dfa-skeleton w-28 md:w-36 h-5"></span></td>
      <td class="p-3 md:p-6 text-right"><span class="dfa-skeleton w-20 md:w-24 h-5"></span></td>
      <td class="p-3 md:p-6 text-right hidden sm:table-cell"><span class="dfa-skeleton w-24 md:w-28 h-5"></span></td>
      <td class="p-3 md:p-6 text-right"><span class="dfa-skeleton w-14 md:w-16 h-5"></span></td>
      <td class="p-3 md:p-6 text-right hidden lg:table-cell"><span class="dfa-skeleton w-16 h-5"></span></td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

// ─── Error / Stale UI ────────────────────────────────────────────────────────

/** Show error banner (must exist in DOM with id="dfa-error-banner") */
function showError(msg) {
  const banner = document.getElementById('dfa-error-banner');
  const msgEl = document.getElementById('dfa-error-message');
  if (!banner) return;
  if (msgEl) msgEl.textContent = msg || 'Error al cargar datos. Verificá tu conexión.';
  banner.style.display = 'flex';
}

/** Show stale data badge */
function showStale() {
  const badge = document.getElementById('dfa-stale-badge');
  if (badge) badge.style.display = 'inline-flex';
}

/** Hide error banner */
function hideError() {
  const banner = document.getElementById('dfa-error-banner');
  if (banner) banner.style.display = 'none';
}

// ─── CoinGecko Attribution ────────────────────────────────────────────────────
// Required by CoinGecko API attribution guide: brand.coingecko.com/resources/attribution-guide
(function injectCoinGeckoAttribution() {
  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main');
    if (!main) return;

    const utmLink = 'https://www.coingecko.com?utm_source=finance-dashboard-ar&utm_medium=referral';

    const badge = document.createElement('div');
    badge.id = 'coingecko-attribution';
    badge.style.cssText = 'padding: 1.5rem 2rem; border-top: 2px solid #c5c6d2; margin-top: 3rem; display: flex; align-items: center; gap: 0.75rem;';
    badge.innerHTML = `
      <span style="font-family: Inter, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #757682;">
        Precio y datos de mercado
      </span>
      <a href="${utmLink}" target="_blank" rel="noopener noreferrer"
         style="display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; border: 1.5px solid #c5c6d2; padding: 0.3rem 0.75rem;">
        <img
          src="https://static.coingecko.com/s/coingecko-logo-5683263fd3ea8a4f152dd5f7299acfc5f84ee73955428acff22913b8e59e6c54.svg"
          alt="CoinGecko"
          height="16"
          onerror="this.style.display='none'"
          style="display: block; height: 16px; width: auto;"
        />
        <span style="font-family: Inter, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #330001;">
          CoinGecko
        </span>
      </a>
    `;

    main.appendChild(badge);
  });
})();

// ─── Exports (global for non-module use) ────────────────────────────────────
window.DFA = window.DFA || {};
Object.assign(window.DFA, {
  formatARS,
  formatUSD,
  formatPct,
  formatMarketCap,
  formatBTC,
  formatETH,
  changeClass,
  changeIcon,
  showSkeleton,
  showTableSkeletons,
  showError,
  showStale,
  hideError
});

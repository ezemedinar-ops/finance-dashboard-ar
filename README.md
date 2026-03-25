# DÓLAR+CRYPTO — Finanzas Argentinas

Monitor de cotizaciones del dólar y mercado crypto en tiempo real para el mercado argentino. Sin backend, sin base de datos — puro HTML, CSS y JS del lado del cliente.

---

## Páginas

| Página | Archivo | Descripción |
|---|---|---|
| **Resumen** | `index.html` | Cards con todas las cotizaciones (blue, oficial, MEP, CCL, cripto, tarjeta), precio de BTC con sparkline. Auto-refresh cada 5 minutos. |
| **Conversor** | `conversor.html` | Ingresás un monto en ARS o USD y ves al instante el equivalente en cada tipo de cambio y en BTC, ETH, USDT. |
| **Mercado Crypto** | `mercado.html` | Top 20 criptomonedas con precio en USD, precio en ARS (usando blue como referencia), variación 24h y market cap. |
| **Historial** | `historial.html` | Gráfico interactivo con evolución del dólar blue y Bitcoin. Filtros 7D, 30D, 90D. |

---

## Stack

- **HTML + Tailwind CSS** (CDN) — sin build step
- **Chart.js 4.4** (CDN) — sparkline y gráficos históricos
- **Vanilla JS** — sin frameworks
- **sessionStorage** — cache de 5 minutos para no abusar los rate limits

---

## Fuentes de datos

| Dato | API | Auth |
|---|---|---|
| Cotizaciones del dólar | [DolarAPI](https://dolarapi.com) | Sin key |
| Precios crypto | [CoinGecko](https://coingecko.com/api) | Sin key (free tier: 30 req/min) |
| Historial dólar blue | [Bluelytics](https://bluelytics.com.ar) | Sin key |
| Fear & Greed Index | [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) | Sin key |

---

## Cómo usar

Abrí `index.html` directamente en el browser. No requiere servidor local ni instalación.

```
Finance/
├── index.html        ← empezar acá
├── conversor.html
├── mercado.html
├── historial.html
├── js/
│   ├── api.js        ← fetch wrappers + cache
│   └── utils.js      ← formateadores + helpers DOM
├── assets/
│   └── screenshots/
└── docs/
    └── DESIGN.md     ← sistema de diseño completo
```

---

## Diseño

El sistema visual está documentado en [`docs/DESIGN.md`](docs/DESIGN.md). Inspirado en los principios de Massimo Vignelli: tipografía Inter en pesos negros, grilla estricta, cero border-radius, paleta limitada centrada en rojo primario `#330001` y azul secundario `#1659c2`.

---

## API Keys (opcional)

Ver [`.env.example`](.env.example) para opciones de upgrade. Actualmente no se requiere ninguna key.

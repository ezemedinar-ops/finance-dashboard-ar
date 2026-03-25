```markdown
# Design System Strategy: The Rationalist Radical

## 1. Overview & Creative North Star
**Creative North Star: The Rationalist Radical**

This design system is a dialogue between the rigid architectural logic of Massimo Vignelli and the playful, symbolic wit of Paul Rand. It is designed to transform complex Argentine financial data into a high-end editorial experience. We are moving away from the "software" look and toward a "published" look. 

The system rejects the clutter of modern SaaS interfaces. Instead, it embraces the **International Typographic Style**: mathematical grids, radical whitespace, and a "brutalist-lite" approach where structure is a feature, not a hidden detail. By using intentional asymmetry and a primary-color-only accent strategy, we create a dashboard that feels authoritative, timeless, and distinctly sophisticated.

---

## 2. Colors
Our palette is rooted in a high-contrast, neutral foundation, punctuated by the "Primary Triad" (Red, Blue, Yellow). 

*   **Primary (`#330001` / `#c0000c`):** An authoritative deep red for critical financial actions and branding.
*   **Secondary (`#1659c2`):** A corporate blue used for data visualization and secondary interactions.
*   **Tertiary (`#705d00` / `#ffe16d`):** A "Gold" yellow reserved for alerts, warnings, or highlighting specific wealth metrics.
*   **The Neutrals:** The background (`#fcf9f8`) and surface tiers are intentionally warm-leaning to avoid the "sterile" feel of pure white, providing an expensive, paper-like quality.

### The Structural Rule (The "Anti-Detail" Rule)
While the original inspiration calls for thick lines, we must apply them with editorial intent.
- **Architectural Lines:** Use `outline` (`#757682`) at **2px or 4px** only for major section breaks (e.g., separating the sidebar from the main stage).
- **The "No-Line" Rule for UI:** Prohibit 1px solid borders for standard components (cards, buttons, inputs). Boundaries must be defined through **Background Color Shifts**. For example, a card (`surface-container-lowest`) should sit on a section background (`surface-container-low`) to create definition through tone, not lines.
- **Signature Textures:** Use subtle vertical gradients on hero balance cards (e.g., `primary` to `primary_container`) to provide a "weighted" feel that flat color cannot achieve.

---

## 3. Typography
We utilize **Inter** as our core grotesque. In this system, typography is the primary "graphic" element.

*   **Display & Headlines:** Use `display-lg` and `headline-lg` in **Bold** weights. Tracking should be tightened (-2% or -4%) to mimic the Swiss "tight but not touching" aesthetic. Headlines should drive the layout—do not be afraid to let a large number (e.g., a total balance) occupy significant whitespace.
*   **Hierarchy as Authority:** Financial data must be legible. Use `title-lg` for data labels and `body-lg` for the data itself. 
*   **The Rand Influence:** Use `label-sm` in all-caps with generous letter spacing (10-15%) for metadata to create a "captioned" editorial look.

---

## 4. Elevation & Depth
In a modernist system, we avoid "real" shadows. Depth is achieved through **Tonal Layering** and **Materiality**.

*   **The Layering Principle:** Treat the UI as stacked sheets of heavy cardstock. 
    *   Level 0: `surface` (Background)
    *   Level 1: `surface-container-low` (Main Content Area)
    *   Level 2: `surface-container-lowest` (Interactive Cards)
*   **Glassmorphism for Floating Elements:** For mobile navigation bars or floating action buttons, use the `surface` color at 80% opacity with a heavy `backdrop-blur`. This ensures the mathematical grid remains visible beneath the UI, maintaining the "transparency" of the Swiss style.
*   **Ambient Shadows:** If a shadow is required for a modal, use the `on-surface` color at 5% opacity with a blur of `32px` and `0px` offset. It should look like a soft glow, not a drop shadow.
*   **Ghost Borders:** If a container needs extra definition against a similar background, use `outline-variant` at 15% opacity. Never use 100% opaque gray lines for small containers.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` background, `on-primary` text. **Hard 0px corners.** Minimum height 56px for mobile-first accessibility.
*   **Secondary:** Solid `secondary` background. Used specifically for "Growth" or "Positive" actions in a finance context.
*   **Tertiary:** No background. `primary` text, bold weight, underlined with a 2px offset.

### Cards & Lists
*   **Strict Grid:** All cards must align to the `spacing-8` (1.75rem) grid. 
*   **No Dividers:** Forbid the use of 1px horizontal lines between list items. Use vertical whitespace (`spacing-4` or `spacing-6`) and a subtle shift to `surface-container-high` on hover to indicate interactivity.
*   **Data Density:** For financial lists (transactions), use `body-md` for the description and `title-sm` (Bold) for the currency amount.

### Input Fields
*   **Style:** Underline only. Use a 2px `outline` color for the bottom border. When focused, the border transitions to 3px `secondary` (Blue).
*   **Labeling:** Floating labels are prohibited. Use `label-md` (Bold) positioned strictly above the input field.

### Charts & Graphs
*   **Rand’s Palette:** Use `secondary` (Blue) for "Actuals," `tertiary_container` (Yellow) for "Forecasts," and `error` (Red) for "Deficits." 
*   **Geometry:** Use sharp, non-rounded line graphs. No smoothed splines.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Radical Whitespace:** If a section feels "empty," leave it. Whitespace is a functional element in the Swiss style.
*   **Align to the Grid:** Every element must have a mathematical relationship to its neighbor. Use `spacing-10`, `12`, and `16` for section margins.
*   **Boldness is Clarity:** Use the heaviest weights of Inter for primary financial figures.

### Don't:
*   **No Rounded Corners:** `roundedness: 0px` is a hard rule. Rounded corners break the modernist architectural integrity.
*   **No Center Alignment:** All text should be flush-left. This creates a strong vertical "axis" that the eye can follow down the dashboard.
*   **No Soft Grays:** Avoid using middle-gray for text. Use `on-surface` (`#1c1b1b`) for maximum contrast and legibility, or `on-surface-variant` (`#444650`) for secondary text.
*   **No "Icons for Everything":** Use an icon only if it clarifies a function. If text is faster to read, use text. Icons must be geometric and stroke-based (2px thickness).

---

## 7. Signature Interaction: "The Vignelli Reveal"
When transitioning between views (e.g., clicking a transaction to see details), do not use "slid-in" animations. Use a **direct cut** or a **vertical expansion** that pushes the grid down. The movement should feel mechanical and purposeful, like a physical ledger being opened.```
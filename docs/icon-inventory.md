# Icon Inventory

Use this list when commissioning or designing a custom icon set. Each row captures where the graphic appears, what action/state it should communicate, and suggested specs so replacements drop into the existing layout without further CSS tweaks.

| Icon ID (code) | Appears In | Meaning / User Action | Notes for Designer | Recommended Asset |
| --- | --- | --- | --- | --- |
| `IconMenu` | Mobile header (top-left) | Open scene tree drawer | Should read as navigation menu/hamburger; consider subtle 3D cues to match viewer theme. | 24×24 vector (SVG) or 2× PNG. |
| `IconPrefs` | Header (top-right) | Open preferences modal | Gear/cog; ensure distinct from menu and help icons. | 24×24 vector. |
| `IconHelp` | Header (top-right) | Toggle viewer tips card | Info badge; consider animated/outlined version for attention pulse. | 24×24 vector, supports pulse overlay. |
| `IconDock` | Mobile/tablet FAB & dock end cap | Expand/collapse bottom control tray | Ellipsis-style or slider glyph; should suggest "more controls". | 24×24 vector (animations applied via CSS halo). |
| `IconClose` | Drawer close buttons, release notes modal, tablet dock end cap | Dismiss current overlay | Prefer balanced cross that remains legible at 20×20 inside circular buttons. | 20×20 vector (monochrome). |
| `IconCaret` (open/closed) | Scene tree nodes | Expand/collapse child nodes | Provide both closed & rotated states; ensure smooth transform around centre. | 16×16 vector (filled or stroked). |
| `IconCube` | Scene tree | Mesh node indicator | Could become a simplified 3D box icon with depth shading. | 20×20 vector. |
| `IconLight` | Scene tree | Light object indicator | Stylised lamp/bulb; optional emissive glow. | 20×20 vector. |
| `IconGroup` | Scene tree | Group/parent node | Nesting icon (stacked boxes). | 20×20 vector. |
| `IconGeometry` | Scene tree metadata | Geometry container | Abstract shape (triangle/polygon). | 20×20 vector. |
| `IconMaterial` | Scene tree metadata | Material definition | Swatch/circle; may need two-tone to imply fill. | 20×20 vector. |
| `IconScalar` | Scene tree metadata | Scalar/parameter entry | Wave or slider to indicate numeric value. | 20×20 vector. |
| `IconPlus` / `IconMinus` | Bottom toolbar | Zoom in/out | Should convey magnifying glass with +/- to avoid confusion. | 24×24 vector each. |
| `IconFit` | Bottom toolbar | Fit model to view | Could be bounding-box corners collapsing onto object. | 24×24 vector. |
| `IconReset` | Bottom toolbar | Reset camera orientation | Use counter-clockwise arrow around a cube. | 24×24 vector. |
| `IconCamera` | Bottom toolbar | Capture screenshot | Camera body icon, mindful of small size clarity. | 24×24 vector. |
| `IconGrid` | Bottom toolbar | Toggle grid helper | Grid plane icon. | 24×24 vector. |
| `IconGround` | Bottom toolbar | Toggle ground plane | Circle+shadow or plane icon distinct from grid. | 24×24 vector. |
| `IconStats` | Bottom toolbar | Toggle FPS stats overlay | Bar chart/performance graph. | 24×24 vector. |
| `IconShadows` | Bottom toolbar | Toggle shadows | Spotlight casting shadow or shadowed sphere. | 24×24 vector, allow partial tint. |
| `IconWireframe` | Bottom toolbar | Enable wireframe mode | Mesh wireframe cube. | 24×24 vector (thin strokes). |
| `IconWireframeOverlay` | Bottom toolbar | Enable edges overlay | Combination of solid + wire overlay. | 24×24 vector. |
| `IconArrowUp/Down/Left/Right` | Desktop D-pad | Pan camera | Arrows inside circular pad – ensure consistent weight, readability at 18×18. | 18×18 vector each. |

## Format Guidelines

- Prefer SVG assets with viewBox sized to the recommended pixel dimensions. For raster fallbacks, export @1× (24×24) and @2× (48×48).
- Use a consistent stroke weight (≈1.5–2 px at 24×24) and rounded stroke caps to match the viewer’s soft UI.
- Deliver monochrome variants; colour is applied via CSS (current colour inherits `text-slate-...`).
- Ensure icons remain legible against light backgrounds (`bg-white/95`) and dark buttons (`bg-slate-900`).

## Delivery Checklist for New Icon Set

1. Provide SVG files named after the IDs above (e.g., `icon-menu.svg`).
2. Supply optional Lottie/GIF if the dock halo animation should sync with custom glyph lighting.
3. Verify icons scale correctly inside 32px circular buttons (no clipping).
4. Spot-check in both desktop and touch layouts.

Update `src/components/ui/Icons.jsx` to import the new SVGs or inline components once assets are ready.

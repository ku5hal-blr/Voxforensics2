# 🎨 VoxForensics - Design System & UI Specification

## 1. Design Tokens & Theme Foundation

### Color Palette
- **Base Canvas**: Deep space dark (`#030712` / `#050914`)
- **Panel Background**: Semi-transparent dark navy (`rgba(10, 17, 40, 0.70)`)
- **Panel Borders**: High-tech subtle blue borders (`rgba(255, 255, 255, 0.08)` / `#1a2a4a`)
- **Primary Brand / Neon Cyan**: `#00F2FE` / `#00d4ff` (Primary actions, scan buttons, waveform strokes)
- **Secondary / Vivid Purple**: `#7F00FF` / `#a855f7` (Deepfake/Synthetic indicators, audio features)
- **Forensic Success / Neon Green**: `#00FF88` (Authentic / Real voice indicators)
- **Forensic Danger / Neon Red**: `#FF0055` / `#ef4444` (Critical alerts, recording pulse, destructive actions)

### Typography
- **Primary Font**: `Inter` (sans-serif)
- **Monospace Font**: `JetBrains Mono` / monospace for numerical values, timestamps, and acoustic metrics.
- **Hierarchy**:
  - Hero Title: 800 weight with metallic gradient and glow filter.
  - Section Headings: 700 weight with uppercase tracking.
  - Data Labels: 500 weight uppercase muted text (`text-gray-400`).

---

## 2. 3D Background System (`src/components/LiveBackground.tsx`)

Built with **Three.js** and **React Three Fiber**:
- **3D Wireframe Face Silhouette**: 3,000-point particle cloud forming a human head mesh.
  - Parametric vertex distribution for jaw, forehead, nose, and eye sockets.
  - Cyan-to-purple vertical gradient.
  - Responsive mouse-tracking rotation and continuous breathing scale oscillation (0.5 Hz).
- **Luminous Sine Wave Strands**: 5 animated sine wave geometries with additive blending (`THREE.AdditiveBlending`).
- **Ambient Floating Particles**: 200 drift particles creating spatial depth.
- **CSS Radial Glows**: Hardware-accelerated radial blurs positioned at top-right (`bg-glow-purple`) and bottom-left (`bg-glow-cyan`).

---

## 3. Component Design Patterns

### Glassmorphic Panels
```css
.glass-card {
  background: rgba(10, 17, 40, 0.70);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.glass-card:hover {
  border-color: rgba(0, 212, 255, 0.3);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.15);
}
```

### Forensic PDF Report Design System
- **Document Dimensions**: Standard Letter / A4 portrait format via `jspdf`.
- **Header**: Deep navy accent bar with bold "VOXFORENSICS" typographic brand and metadata box (Report ID, Timestamp).
- **Verdict Banner**: Prominent colored box with high-contrast verdict text (`AUTHENTIC SPEECH` or `SYNTHETIC / AI SPEECH`) and confidence percentage.
- **Embedded Waveform**: Visual audio amplitude graph rendered via an offscreen canvas and embedded directly into the report.
- **Acoustic Metric Tables**: Structured 2-column tables with alternating row shading for acoustic parameters.
- **Evidentiary Footer**: Formal disclaimer, confidentiality mark, and dynamic page numbering ("Page X of Y").

### Interactive Password Input Component
- Masked password input accompanied by an interactive eye toggle (`Eye` / `EyeOff` icons).
- Provides immediate visual feedback to the user without altering authentication state.

### Batch Processing Queue Components
- Multi-file dropzone with drag-over state styling.
- Compact progress bar with gradient fill.
- Results table with color-coded status badges (`Pending`, `Processing`, `Completed`, `Error`).
- Per-row action buttons for downloading individual PDF reports.

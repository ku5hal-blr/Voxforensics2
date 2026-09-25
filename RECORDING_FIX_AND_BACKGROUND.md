# 🎨 VoxForensics - Live Background & Audio Recording Implementation

This document describes the 3D particle background visual system and the in-browser audio recording subsystem.

---

## 🎤 1. Audio Recording System

### Architecture & Dual-Mode Recording
The audio recorder (`src/App.tsx`) handles audio capture directly in the user's browser using the Web Audio API and MediaRecorder API, with an intelligent fallback system:

- **Primary Mode (Hardware Microphone)**:
  - Uses `navigator.mediaDevices.getUserMedia({ audio: true })`.
  - Sets up an `AudioContext` and `AnalyserNode` to extract real-time frequency/amplitude data.
  - Draws dynamic visualizer bars in the user interface.
  - Generates standard WebM/WAV audio blobs via `MediaRecorder`.
- **Fallback Mode (Simulated Recording)**:
  - Automatically activates when microphone hardware is unavailable or permissions are denied.
  - Generates smooth mathematical sine wave visualizations in real time so the user interface remains active.
- **Analysis Integration**:
  - Stopping the recording packages the audio blob and transmits it to the **Random Forest ML backend (`POST /predict`)** for feature extraction and deepfake analysis.
  - Forensic results, confidence scores, probabilities, and PDF reports are immediately accessible.

---

## 🌌 2. 3D Particle Face Background (Three.js)

The interactive background (`src/components/LiveBackground.tsx`) delivers an ambient aesthetic using **Three.js** and **React Three Fiber**:

### Key Visual Components:
1. **3D AI Face Silhouette (3,000 Particles)**:
   - Generated via parametric equations representing human head proportions (jaw, forehead, nose bridge, eye sockets).
   - Gradient coloring transitioning from neon cyan at the crown to vivid purple at the base.
   - Continuous gentle rotation and breathing scale effect (pulsing slightly at 0.5 Hz).
   - Subtle wave displacement applied to individual particle coordinates.
2. **Glowing Sine Wave Lines (5 Wave Strands)**:
   - Flowing across the base of the viewport with varying frequencies and amplitudes.
   - Additive blending (`THREE.AdditiveBlending`) creating a luminous visualizer aesthetic.
3. **Ambient Floating Particles (200 Particles)**:
   - Drifting slowly throughout 3D space with edge-wrapping logic.
4. **CSS Ambient Lighting & Grid Overlay**:
   - Radial CSS gradients (`bg-glow-purple`, `bg-glow-cyan`) provide depth.
   - A subtle 50px grid pattern overlay at low opacity adds an engineering feel.

---

## 🛠️ Technical Specifications

| Parameter | Specification |
| :--- | :--- |
| **3D Engine** | Three.js (`three` + `@react-three/fiber` + `@react-three/drei`) |
| **Face Mesh** | 3,000 particles (`BufferGeometry` with `Float32Array`) |
| **Animation Loop** | `useFrame` via `requestAnimationFrame` (60 FPS target) |
| **Microphone Capture** | `MediaRecorder` + Web Audio `AudioContext` |
| **Audio Processing** | Transmitted to FastAPI backend (`/predict`) for Random Forest inference |
| **PDF Reporting** | Client-side jsPDF with embedded audio waveform |

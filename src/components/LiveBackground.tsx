import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================
// TYPES
// ============================================================

interface ParticleData {
  positions: Float32Array;
  velocities: Float32Array;
}

// ============================================================
// GENERATE HEAD-SHAPED POINT CLOUD
// ============================================================

function generateHeadPoints(count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;

    let r = 1.0;

    const y = Math.cos(phi);

    // Flatten top of skull
    if (y > 0.7) {
      r *= 0.85 - (y - 0.7) * 0.3;
    }

    // Narrow bottom of head
    if (y < -0.5) {
      r *= 0.7 + (y + 0.5) * 0.2;
    }

    // Jaw shape
    if (y < -0.2 && y > -0.8) {
      const jawFactor = 1 - Math.abs(y + 0.5) * 0.3;
      r *= jawFactor;
    }

    // Forehead
    if (y > 0.3 && y < 0.7) {
      r *= 1.05;
    }

    const x = Math.sin(phi) * Math.cos(theta);
    const z = Math.sin(phi) * Math.sin(theta);

    // Nose protrusion
    if (
      z > 0.7 &&
      Math.abs(x) < 0.15 &&
      y > -0.2 &&
      y < 0.2
    ) {
      r *= 1.15;
    }

    // Eye socket indentations
    if (
      z > 0.5 &&
      Math.abs(x) > 0.15 &&
      Math.abs(x) < 0.4 &&
      y > 0 &&
      y < 0.3
    ) {
      r *= 0.92;
    }

    // Organic surface noise
    r += (Math.random() - 0.5) * 0.02;

    positions[i3] = x * r * 1.2;
    positions[i3 + 1] = y * r * 1.5;
    positions[i3 + 2] = z * r;
  }

  return positions;
}

// ============================================================
// FACE POINT CLOUD
// ============================================================

function FacePointCloud() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const count = 3000;

    const positions = generateHeadPoints(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      const y = positions[i3 + 1];

      const t = Math.max(
        0,
        Math.min(1, (y + 1.5) / 3)
      );

      // Cyan / blue / purple gradient
      colors[i3] = 0.3 * (1 - t);
      colors[i3 + 1] = 0.95 * t;
      colors[i3 + 2] = 1;
    }

    return {
      positions,
      colors,
    };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.elapsedTime;

    // Gentle rotation
    pointsRef.current.rotation.y = time * 0.1;

    // Subtle breathing
    const breathe =
      1 + Math.sin(time * 0.5) * 0.02;

    pointsRef.current.scale.set(
      breathe,
      breathe,
      breathe
    );

    const positionAttribute =
      pointsRef.current.geometry.attributes
        .position;

    const positionArray =
      positionAttribute.array as Float32Array;

    // Animate individual points
    for (
      let i = 0;
      i < positionArray.length;
      i += 3
    ) {
      const originalX = positions[i];
      const originalY = positions[i + 1];
      const originalZ = positions[i + 2];

      const wave =
        Math.sin(
          time * 2 + originalY * 3
        ) * 0.01;

      positionArray[i] =
        originalX + wave;

      positionArray[i + 1] =
        originalY +
        Math.sin(
          time * 1.5 + originalX * 2
        ) * 0.008;

      positionArray[i + 2] =
        originalZ +
        Math.cos(
          time * 1.8 + originalY * 2
        ) * 0.005;
    }

    positionAttribute.needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      position={[0, 0, 0]}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />

        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.015}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ============================================================
// ANIMATED WAVE LINES
// ============================================================

function WaveLines() {
  const linesRef = useRef<THREE.Group>(null);

  const lineGeometries = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    const numberOfLines = 5;
    const pointsPerLine = 200;

    for (
      let lineIndex = 0;
      lineIndex < numberOfLines;
      lineIndex++
    ) {
      const positions =
        new Float32Array(
          pointsPerLine * 3
        );

      for (
        let i = 0;
        i < pointsPerLine;
        i++
      ) {
        positions[i * 3] =
          (i / pointsPerLine - 0.5) * 12;

        positions[i * 3 + 1] = 0;

        positions[i * 3 + 2] =
          (lineIndex -
            numberOfLines / 2) *
          0.8;
      }

      const geometry =
        new THREE.BufferGeometry();

      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          positions,
          3
        )
      );

      geometries.push(geometry);
    }

    return geometries;
  }, []);

  const colors = [
    '#00d4ff',
    '#4FACFE',
    '#a855f7',
    '#E100FF',
    '#00d4ff',
  ];

  useFrame((state) => {
    if (!linesRef.current) return;

    const time =
      state.clock.elapsedTime;

    linesRef.current.children.forEach(
      (child, lineIndex) => {
        const line =
          child as THREE.Line;

        const positionAttribute =
          line.geometry.attributes
            .position;

        const positionArray =
          positionAttribute.array as Float32Array;

        const pointsPerLine =
          positionArray.length / 3;

        for (
          let i = 0;
          i < pointsPerLine;
          i++
        ) {
          const x =
            positionArray[i * 3];

          const frequency1 =
            0.5 + lineIndex * 0.1;

          const frequency2 =
            1.2 + lineIndex * 0.15;

          const amplitude =
            0.3 - lineIndex * 0.04;

          positionArray[i * 3 + 1] =
            Math.sin(
              x * frequency1 +
                time *
                  (0.5 +
                    lineIndex * 0.2)
            ) *
              amplitude +
            Math.sin(
              x * frequency2 +
                time * 0.8
            ) *
              amplitude *
              0.5;
        }

        positionAttribute.needsUpdate = true;
      }
    );
  });

  return (
    <group
      ref={linesRef}
      position={[0, -2, -2]}
    >
      {lineGeometries.map(
        (geometry, index) => {
          const material =
            new THREE.LineBasicMaterial({
              color: colors[index],
              transparent: true,
              opacity:
                0.3 - index * 0.04,
              blending:
                THREE.AdditiveBlending,
              depthWrite: false,
            });

          return (
            <primitive
              key={index}
              object={
                new THREE.Line(
                  geometry,
                  material
                )
              }
            />
          );
        }
      )}
    </group>
  );
}

// ============================================================
// FLOATING PARTICLES
// ============================================================

function FloatingParticles() {
  const particlesRef =
    useRef<THREE.Points>(null);

  const {
    positions,
    velocities,
  }: ParticleData = useMemo(() => {
    const count = 200;

    const positions =
      new Float32Array(
        count * 3
      );

    const velocities =
      new Float32Array(
        count * 3
      );

    for (let i = 0; i < count; i++) {
      positions[i * 3] =
        (Math.random() - 0.5) * 15;

      positions[i * 3 + 1] =
        (Math.random() - 0.5) * 10;

      positions[i * 3 + 2] =
        (Math.random() - 0.5) * 8 - 2;

      velocities[i * 3] =
        (Math.random() - 0.5) * 0.005;

      velocities[i * 3 + 1] =
        (Math.random() - 0.5) * 0.005;

      velocities[i * 3 + 2] =
        (Math.random() - 0.5) * 0.002;
    }

    return {
      positions,
      velocities,
    };
  }, []);

  useFrame(() => {
    if (!particlesRef.current) return;

    const positionAttribute =
      particlesRef.current.geometry
        .attributes.position;

    const positionArray =
      positionAttribute.array as Float32Array;

    for (
      let i = 0;
      i < positionArray.length;
      i += 3
    ) {
      positionArray[i] +=
        velocities[i];

      positionArray[i + 1] +=
        velocities[i + 1];

      positionArray[i + 2] +=
        velocities[i + 2];

      // Horizontal wrapping
      if (positionArray[i] > 7.5) {
        positionArray[i] = -7.5;
      }

      if (positionArray[i] < -7.5) {
        positionArray[i] = 7.5;
      }

      // Vertical wrapping
      if (positionArray[i + 1] > 5) {
        positionArray[i + 1] = -5;
      }

      if (positionArray[i + 1] < -5) {
        positionArray[i + 1] = 5;
      }
    }

    positionAttribute.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.03}
        color="#00d4ff"
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ============================================================
// THREE.JS SCENE
// ============================================================

function Scene() {
  return (
    <>
      <ambientLight intensity={0.1} />

      <FacePointCloud />

      <WaveLines />

      <FloatingParticles />
    </>
  );
}

// ============================================================
// LIVE BACKGROUND
// ============================================================

export default function LiveBackground() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      {/* =====================================================
          LAYER 1 — ORIGINAL BACKGROUND IMAGE
          This remains completely unchanged.
          ===================================================== */}

      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage:
            "url('/background.jpg')",
          backgroundPosition:
            '72% center',
        }}
      />

      {/* =====================================================
          LAYER 2 — THREE.JS ANIMATIONS
          Transparent canvas sitting over background.jpg
          ===================================================== */}

      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
        }}
      >
        <Canvas
          camera={{
            position: [0, 0, 4],
            fov: 60,
          }}
          gl={{
            antialias: true,
            alpha: true,
          }}
          dpr={[1, 2]}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
          }}
        >
          <Scene />
        </Canvas>
      </div>

      {/* =====================================================
          LAYER 3 — PURPLE GLOW
          ===================================================== */}

      <div
        className="bg-glow-purple"
        style={{
          top: '-10%',
          right: '-5%',
          zIndex: 2,
        }}
      />

      {/* =====================================================
          LAYER 4 — CYAN GLOW
          ===================================================== */}

      <div
        className="bg-glow-cyan"
        style={{
          bottom: '-10%',
          left: '-5%',
          zIndex: 2,
        }}
      />

      {/* =====================================================
          LAYER 5 — CENTER GLOW
          ===================================================== */}

      <div
        className="bg-glow-purple"
        style={{
          top: '40%',
          left: '30%',
          width: '400px',
          height: '400px',
          opacity: 0.5,
          zIndex: 2,
        }}
      />

      {/* =====================================================
          LAYER 6 — GRID
          ===================================================== */}

      <div
        className="absolute inset-0 grid-pattern opacity-30"
        style={{
          zIndex: 3,
        }}
      />
    </div>
  );
}
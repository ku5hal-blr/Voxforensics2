import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: 'cyan' | 'purple';
  phase: number;
  speed: number;
}

// Lightweight 2D canvas: drifting, twinkling particles so the
// reference artwork stays "live" like the original design.
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(90, Math.max(40, Math.floor(window.innerWidth / 18)));
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1,
      hue: Math.random() > 0.62 ? 'purple' : 'cyan',
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const t = Date.now() * 0.001;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        if (p.y > height + 5) p.y = -5;

        const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.speed + p.phase));
        const alpha = 0.55 * twinkle;
        if (p.hue === 'cyan') {
          ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
          ctx.shadowColor = 'rgba(0, 212, 255, 0.9)';
        } else {
          ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
          ctx.shadowColor = 'rgba(168, 85, 247, 0.9)';
        }
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export default function LiveBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#04070f]">
      {/* Reference artwork: digital face, neon waves, spectrum, starfield */}
      <div
        className="absolute inset-0 bg-cover"
        style={{
          backgroundImage: "url('/background.jpg')",
          backgroundPosition: '72% center',
        }}
      />

      {/* Vignette to deepen edges and keep text readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 52%, rgba(2, 5, 12, 0.55) 100%)',
        }}
      />

      {/* Live drifting particles */}
      <ParticleCanvas />

      {/* Handwritten accent from the reference design */}
      <div
        className="hidden lg:block absolute top-[66%] right-[36%] script-font text-3xl leading-relaxed text-[#c7d2fe]/45 select-none pointer-events-none text-right"
        aria-hidden="true"
      >
        Voices
        <br />
        Reveal
        <br />
        Truth
      </div>
    </div>
  );
}

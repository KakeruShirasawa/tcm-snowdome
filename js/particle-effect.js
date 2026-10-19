// ============================================================
// パーティクルエフェクト（旧 SnowEffect を拡張）
// 雪、ラメ、紙吹雪、金粉、星、花びら、ハート を選べる
// ============================================================

const PARTICLE_PRESETS = {
  snow: {
    name: '雪',
    icon: '❄',
    colors: ['#ffffff', '#eaf4ff'],
    shape: 'circle',
    size: [1.5, 4],
    speed: [0.3, 1.3],
    sway: 0.7,
    alpha: [0.7, 1],
    glow: 0,
  },
  gold: {
    name: 'ゴールドラメ',
    icon: '✨',
    colors: ['#ffd77a', '#ffefc0', '#c9a66b'],
    shape: 'sparkle',
    size: [1, 3],
    speed: [0.4, 1.6],
    sway: 1.2,
    alpha: [0.7, 1],
    glow: 6,
    twinkle: true,
  },
  silver: {
    name: 'シルバーラメ',
    icon: '❅',
    colors: ['#ffffff', '#d0e0ec', '#a0c0d0'],
    shape: 'sparkle',
    size: [1, 3],
    speed: [0.4, 1.4],
    sway: 1.0,
    alpha: [0.7, 1],
    glow: 5,
    twinkle: true,
  },
  confetti: {
    name: '紙吹雪',
    icon: '🎉',
    colors: ['#e8321f', '#1f4b2e', '#ffd77a', '#f5ead5', '#b02a35'],
    shape: 'rect',
    size: [3, 7],
    speed: [0.6, 1.8],
    sway: 2.0,
    alpha: [0.9, 1],
    glow: 0,
    spin: true,
  },
  star: {
    name: '星くず',
    icon: '⭐',
    colors: ['#ffd77a', '#ffefc0', '#ffffff'],
    shape: 'star',
    size: [3, 7],
    speed: [0.3, 1.2],
    sway: 1.0,
    alpha: [0.8, 1],
    glow: 8,
    twinkle: true,
  },
  petal: {
    name: '花びら',
    icon: '🌸',
    colors: ['#ff9ec7', '#ffc0d8', '#ffe0ec'],
    shape: 'petal',
    size: [4, 9],
    speed: [0.3, 1.0],
    sway: 2.2,
    alpha: [0.75, 1],
    glow: 2,
    spin: true,
  },
  heart: {
    name: 'ハート',
    icon: '♥',
    colors: ['#ff6b8a', '#e8321f', '#ff9ec7'],
    shape: 'heart',
    size: [5, 10],
    speed: [0.3, 1.2],
    sway: 1.3,
    alpha: [0.8, 1],
    glow: 4,
    spin: false,
  },
  bubble: {
    name: 'シャボン玉',
    icon: '●',
    colors: ['rgba(200,230,255,0.5)', 'rgba(255,220,240,0.5)', 'rgba(220,255,230,0.5)'],
    shape: 'bubble',
    size: [4, 12],
    speed: [-0.3, -1.2], // 上に上がる
    sway: 1.0,
    alpha: [0.5, 0.9],
    glow: 3,
  },
  rainbow: {
    name: 'レインボー',
    icon: '🌈',
    colors: ['#e8321f', '#ff9b2a', '#ffd77a', '#1f4b2e', '#3a6bb5', '#8a3fb5'],
    shape: 'sparkle',
    size: [2, 5],
    speed: [0.4, 1.5],
    sway: 1.4,
    alpha: [0.8, 1],
    glow: 5,
    twinkle: true,
  },
};

class ParticleEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.running = false;
    this.preset = PARTICLE_PRESETS.snow;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  }

  setPreset(key) {
    this.preset = PARTICLE_PRESETS[key] || PARTICLE_PRESETS.snow;
  }

  shake(count = 140, burst = true) {
    this._resize();
    this.particles = [];
    const p = this.preset;
    for (let i = 0; i < count; i++) {
      const sizeRng = p.size[1] - p.size[0];
      const speedRng = p.speed[1] - p.speed[0];
      const alphaRng = p.alpha[1] - p.alpha[0];
      const upward = p.speed[0] < 0;
      this.particles.push({
        x: Math.random() * this.w,
        y: upward ? this.h + Math.random() * 50 : (burst ? Math.random() * this.h : -Math.random() * this.h),
        r: p.size[0] + Math.random() * sizeRng,
        vx: (Math.random() - 0.5) * 2,
        vy: p.speed[0] + Math.random() * speedRng,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: 0.012 + Math.random() * 0.03,
        swayAmp: p.sway * (0.5 + Math.random() * 0.8),
        alpha: p.alpha[0] + Math.random() * alphaRng,
        baseAlpha: 1,
        color: p.colors[Math.floor(Math.random() * p.colors.length)],
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    if (!this.running) {
      this.running = true;
      this._loop();
    }
  }

  stop() { this.running = false; }

  _drawParticle(f) {
    const ctx = this.ctx;
    const p = this.preset;
    let a = f.alpha;
    if (p.twinkle) {
      a *= (0.6 + 0.4 * Math.abs(Math.sin(f.twinklePhase)));
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    if (p.glow) {
      ctx.shadowColor = f.color;
      ctx.shadowBlur = p.glow;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    if (p.spin) ctx.rotate(f.rot);

    switch (p.shape) {
      case 'circle':
        ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.fill();
        break;
      case 'rect':
        ctx.fillRect(-f.r, -f.r * 0.4, f.r * 2, f.r * 0.8);
        break;
      case 'sparkle':
        // 4点キラキラ
        ctx.beginPath();
        ctx.moveTo(0, -f.r * 1.4);
        ctx.lineTo(f.r * 0.4, -f.r * 0.4);
        ctx.lineTo(f.r * 1.4, 0);
        ctx.lineTo(f.r * 0.4, f.r * 0.4);
        ctx.lineTo(0, f.r * 1.4);
        ctx.lineTo(-f.r * 0.4, f.r * 0.4);
        ctx.lineTo(-f.r * 1.4, 0);
        ctx.lineTo(-f.r * 0.4, -f.r * 0.4);
        ctx.closePath(); ctx.fill();
        break;
      case 'star':
        this._pathStar(ctx, 0, 0, f.r * 1.2, f.r * 0.5, 5);
        ctx.fill();
        break;
      case 'petal':
        // 楕円
        ctx.beginPath();
        ctx.ellipse(0, 0, f.r * 0.6, f.r * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'heart':
        this._pathHeart(ctx, 0, 0, f.r);
        ctx.fill();
        break;
      case 'bubble':
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.stroke();
        // ハイライト
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-f.r * 0.3, -f.r * 0.3, f.r * 0.25, 0, Math.PI * 2); ctx.fill();
        break;
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  _pathStar(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  _pathHeart(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.3);
    ctx.bezierCurveTo(cx + r, cy - r * 0.5, cx + r, cy - r * 1.2, cx, cy - r * 0.5);
    ctx.bezierCurveTo(cx - r, cy - r * 1.2, cx - r, cy - r * 0.5, cx, cy + r * 0.3);
    ctx.closePath();
  }

  _loop() {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    const p = this.preset;

    let alive = 0;
    for (const f of this.particles) {
      f.swing += f.swingSpeed;
      f.x += f.vx + Math.sin(f.swing) * f.swayAmp * 0.4;
      f.y += f.vy;
      f.vx *= 0.985;
      f.rot += f.rotSpeed;
      if (p.twinkle) f.twinklePhase += 0.08;

      const upward = f.vy < 0;
      const offStage = upward ? (f.y < -20) : (f.y > this.h + 10);
      if (offStage || f.x < -20 || f.x > this.w + 20) {
        f.alpha *= 0.9;
        if (f.alpha < 0.04) continue;
      }
      alive++;
      this._drawParticle(f);
    }
    this.ctx.globalAlpha = 1;

    if (alive === 0) {
      this.running = false;
      return;
    }
    requestAnimationFrame(() => this._loop());
  }

  getFlakes() {
    return this.particles
      .filter(f => f.alpha > 0.1 && f.y > 0 && f.y < this.h && f.x > 0 && f.x < this.w)
      .map(f => ({
        x: f.x, y: f.y, r: f.r, alpha: f.alpha, color: f.color,
        shape: this.preset.shape, rot: f.rot,
      }));
  }

  getPresetKey() {
    for (const [k, v] of Object.entries(PARTICLE_PRESETS)) {
      if (v === this.preset) return k;
    }
    return 'snow';
  }
}

// 後方互換（SnowEffect という名前で呼んでいる場所用）
const SnowEffect = ParticleEffect;

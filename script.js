/* ── Stars & Comets canvas ── */
const canvas = document.getElementById("space");
const ctx = canvas.getContext("2d");
let width, height;
function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
window.addEventListener("resize", resize); resize();

const stars = [];
for (let i = 0; i < 550; i++) {
  stars.push({
    x: Math.random() * width, y: Math.random() * height,
    radius: Math.random() * 1.5, alpha: .5 + Math.random() * .5, phase: Math.random() * Math.PI * 2
  });
}
class Comet {
  constructor() { this.reset(); }
  reset() { this.x = Math.random() > .5 ? width + 100 : -100; this.y = Math.random() * height * .7; this.vx = this.x > 0 ? -2 : 2; this.vy = -1; this.life = 1; }
  update() { this.x += this.vx; this.y += this.vy; this.life -= .002; }
  draw() {
    const g = ctx.createLinearGradient(this.x, this.y, this.x - this.vx * 50, this.y - this.vy * 50);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 50, this.y - this.vy * 50); ctx.stroke();
  }
}
const comets = [];
function animate(t) {
  ctx.clearRect(0, 0, width, height);
  stars.forEach(s => { const p = Math.sin(t * .002 + s.phase) * .3; ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${s.alpha + p})`; ctx.fill(); });
  if (comets.length < 3 && Math.random() < .005) comets.push(new Comet());
  for (let i = comets.length - 1; i >= 0; i--) { comets[i].update(); comets[i].draw(); if (comets[i].life <= 0) comets.splice(i, 1); }
  requestAnimationFrame(animate);
}
animate(0);

/* ════════════════════════════════════
   GSLV ROCKET ANIMATION  ·  ~5.5 s total
   Stage triggers by progress 0→1:
     0.00 = Launch (Stage 00 · High School)
     0.30 = Booster Jettison (Stage 01 · Bachelor's)
     0.60 = Core-Stage Separation (Stage 02 · Internships)
     1.00 = Fairing Release + Satellite Deploy (Stage 03 · Masters)
════════════════════════════════════ */
class RocketAnimation {
  constructor() {
    this.c = document.getElementById('rocketCanvas');
    this.x2d = this.c.getContext('2d');
    this.raf = null; this.running = false;

    // particle pools
    this.exhParticles = [];   // main engine exhaust smoke
    this.sepParticles = [];   // separation debris
    this.flashRings = [];

    // state
    this.activeStage = -1;
    this.progress = 0;
    this.t0 = null;

    // GSLV detachable parts (each has a life flag + animation offset)
    this.boosterL = { alive: true, x: 0, y: 0, vx: 0, vy: 0, rot: 0, alpha: 1 };
    this.boosterR = { alive: true, x: 0, y: 0, vx: 0, vy: 0, rot: 0, alpha: 1 };
    this.coreStage = { alive: true, x: 0, y: 0, vx: 0, vy: 0, alpha: 1 };
    this.upperStage = { alive: true, x: 0, y: 0, vx: 0, vy: 0, alpha: 1 };
    this.fairingL = { alive: true, x: 0, y: 0, vx: 0, vy: 0, rot: 0, alpha: 1 };
    this.fairingR = { alive: true, x: 0, y: 0, vx: 0, vy: 0, rot: 0, alpha: 1 };
    this.satelliteDeployed = false;
    this.solarAngle = 0; // 0→Math.PI/2 unfold animation

    // stage trigger progress values
    this.STAGE_AT = [0, 0.33, 0.66, 0.88];
    this.DURATION = 6000; // ms
  }

  /* ── sizing ── */
  resize() {
    // Match internal pixel density to element's display size to prevent "bulkiness"
    this.c.width = this.c.offsetWidth || 160;
    this.c.height = this.c.offsetHeight;
  }

  /* ── kick off ── */
  start() {
    this.resize();
    this.progress = 0; this.t0 = null;
    this.exhParticles = []; this.sepParticles = []; this.flashRings = [];
    this.activeStage = -1;
    this.running = true;

    // reset detachable pieces to "alive"
    this.boosterL = { alive: true, x: 0, y: 0, vx: -2.0, vy: 0.8, rot: 0, alpha: 1 };
    this.boosterR = { alive: true, x: 0, y: 0, vx: 2.0, vy: 0.8, rot: 0, alpha: 1 };
    this.coreStage = { alive: true, x: 0, y: 0, vx: 0, vy: 2.2, alpha: 1 };
    this.upperStage = { alive: true, x: 0, y: 0, vx: 0, vy: 1.6, alpha: 1 };
    this.fairingL = { alive: true, x: 0, y: 0, vx: -2.5, vy: -1.0, rot: 0, alpha: 1 };
    this.fairingR = { alive: true, x: 0, y: 0, vx: 2.5, vy: -1.0, rot: 0, alpha: 1 };
    this.satelliteDeployed = false;
    this.solarAngle = 0;

    document.querySelectorAll('.stage-box').forEach(b => b.classList.remove('stage-active'));
    document.querySelectorAll('.timeline-dot').forEach(d => d.classList.remove('dot-active'));
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(ts => this.frame(ts));
  }

  stop() {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  /* ── y-position of rocket centre on canvas ── */
  rocketY(p) { return this.c.height * (0.95 - 0.85 * p); }

  /* ── main loop ── */
  frame(ts) {
    if (!this.t0) this.t0 = ts;
    this.progress = Math.min(1, (ts - this.t0) / this.DURATION);
    this.draw(ts);
    for (let i = this.STAGE_AT.length - 1; i >= 0; i--) {
      if (this.progress >= this.STAGE_AT[i] && this.activeStage < i) {
        this.activateStage(i);
        break;
      }
    }
    if (this.running && this.progress < 1) this.raf = requestAnimationFrame(ts2 => this.frame(ts2));
    else { this.running = false; }
  }

  /* ── stage activation ── */
  activateStage(idx) {
    this.activeStage = idx;
    const cx = this.c.width / 2;
    const ry = this.rocketY(this.progress);

    if (idx === 1) {
      // Booster jettison: set starting position = booster attach points
      this.boosterL.alive = false;
      this.boosterL.x = cx - 22; this.boosterL.y = ry + 10;
      this.boosterR.alive = false;
      this.boosterR.x = cx + 22; this.boosterR.y = ry + 10;
      this._spawnSepRing(cx - 22, ry + 10, '#ff9050');
      this._spawnSepRing(cx + 22, ry + 10, '#ff9050');
      this._spawnDebris(cx, ry, 18, '#ffa060');
    }
    if (idx === 2) {
      // Core-stage separation
      this.coreStage.alive = false;
      this.coreStage.x = cx; this.coreStage.y = ry + 30;
      this._spawnSepRing(cx, ry + 20, '#c4b5fd');
      this._spawnDebris(cx, ry + 20, 24, '#b0a0ff');
    }
    if (idx === 3) {
      // Fairing + satellite deploy
      this.fairingL.alive = false;
      this.fairingL.x = cx - 8; this.fairingL.y = ry - 10;
      this.fairingR.alive = false;
      this.fairingR.x = cx + 8; this.fairingR.y = ry - 10;
      this.satelliteDeployed = true;
      this._spawnSepRing(cx, ry - 15, '#7fffd4');
      this._spawnDebris(cx, ry - 12, 20, '#aaffee');
    }

    // update side panels
    document.querySelectorAll('.stage-box').forEach((b, i) => b.classList.toggle('stage-active', i === idx));
    document.querySelectorAll('.timeline-dot').forEach(d => {
      d.classList.toggle('dot-active', +d.dataset.stage <= idx);
    });
  }

  /* ── helpers ── */
  _spawnSepRing(x, y, color) {
    this.flashRings.push({ x, y, r: 8, life: 1, color });
  }
  _spawnDebris(cx, cy, n, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, sp = 1.5 + Math.random() * 3;
      this.sepParticles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp + (Math.random() - .5),
        vy: Math.sin(a) * sp + (Math.random() - .5),
        life: 1, size: 2 + Math.random() * 3, color,
        type: 'debris'
      });
    }
    // Add ACS gas puffs (white/light-blue smoke) for futuristic realism
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 1.5;
      this.sepParticles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        life: 1.2, size: 4 + Math.random() * 6, color: 'rgba(200, 230, 255, 0.4)',
        type: 'acs'
      });
    }
  }

  /* ════ DRAW ════ */
  draw(ts) {
    if (!this.t0) return;
    const c = this.x2d, W = this.c.width, H = this.c.height;
    if (W <= 0 || H <= 0) return; // Safety: skip if not sized
    const cx = W / 2;
    c.clearRect(0, 0, W, H);
    const ry = this.rocketY(this.progress);
    if (isNaN(ry)) return; // Safety: skip if math failed
    const t = ts * 0.001;

    // 1) main engine exhaust (only visible before stage 2 separation)
    if (!this.satelliteDeployed && this.progress < 0.60 && ry > 0) {
      this._drawExhaust(cx, ry, t, false);
    }

    // 2) detached pieces drifting (drawn under rocket)
    this._animateDetached(t);

    // 3) particles & rings
    this._drawFlashRings();
    this._drawParticles();

    // 4) the rocket (remaining parts)
    this._drawGSLV(cx, ry, t);
  }

  /* ─── GSLV body renderer ─── */
  _drawGSLV(cx, ry, t) {
    const c = this.x2d;
    const BW = 10, BH = 38;   // core body half-width, height
    const p = this.progress;

    /* — ambient glow — */
    const glo = c.createRadialGradient(cx, ry, 3, cx, ry, 60);
    glo.addColorStop(0, 'rgba(160,120,255,0.2)'); glo.addColorStop(1, 'rgba(100,80,220,0)');
    c.fillStyle = glo; c.beginPath(); c.arc(cx, ry, 60, 0, Math.PI * 2); c.fill();

    /* — STRAP-ON BOOSTERS (visible only before stage 1) — */
    if (this.boosterL.alive) {
      this._drawBooster(cx - 22, ry, -1, t);   // left
      this._drawBoosterExhaust(cx - 22, ry, t, -1);
    }
    if (this.boosterR.alive) {
      this._drawBooster(cx + 22, ry, 1, t);    // right
      this._drawBoosterExhaust(cx + 22, ry, t, 1);
    }

    /* — CORE first stage (below ry+BH/2, visible before stage 2) — */
    if (this.coreStage.alive && p < 0.60) {
      this._drawFirstStage(cx, ry, BW, BH);
    }

    /* — UPPER STAGE body (always, until satellite deploy) — */
    if (!this.satelliteDeployed) {
      this._drawUpperBody(cx, ry, BW, BH, p < 1.0);
    }

    /* — FAIRING (nose cone halves, before stage 3) — */
    if (this.fairingL.alive) {
      this._drawFairing(cx, ry, BW, BH);
    }

    /* — SATELLITE (after fairing jettison) — */
    if (this.satelliteDeployed) {
      if (this.solarAngle < Math.PI / 2) this.solarAngle += 0.025;
      this._drawSatellite(cx, ry - BH / 2 - 10, this.solarAngle, t);
    }
  }

  /* ─── Strap-on booster ─── */
  _drawBooster(x, ry, side, t) {
    const c = this.x2d;
    const bw = 5, bh = 30;
    // booster body gradient
    const bg = c.createLinearGradient(x - bw, 0, x + bw, 0);
    bg.addColorStop(0, 'rgba(160,150,210,1)');
    bg.addColorStop(.4, 'rgba(235,230,255,1)');
    bg.addColorStop(.6, 'rgba(200,190,250,1)');
    bg.addColorStop(1, 'rgba(140,130,190,1)');
    c.fillStyle = bg;
    c.beginPath();
    if (c.roundRect) c.roundRect(x - bw, ry - bh / 2 + 4, bw * 2, bh, [3, 3, 5, 5]);
    else c.rect(x - bw, ry - bh / 2 + 4, bw * 2, bh);
    c.fill();

    // Futuristic paneling and rivets
    c.strokeStyle = 'rgba(0,0,0,0.15)';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(x - bw, ry); c.lineTo(x + bw, ry);
    c.moveTo(x - bw, ry + 8); c.lineTo(x + bw, ry + 8);
    c.stroke();

    c.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = -2; i <= 2; i++) {
      c.beginPath(); c.arc(x - bw + 1.5, ry + i * 6, 0.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + bw - 1.5, ry + i * 6, 0.4, 0, Math.PI * 2); c.fill();
    }

    // booster nose with glint
    c.fillStyle = 'rgba(210,195,255,1)';
    c.beginPath();
    c.moveTo(x - bw, ry - bh / 2 + 4);
    c.lineTo(x, ry - bh / 2 - 8);
    c.lineTo(x + bw, ry - bh / 2 + 4);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.moveTo(x - bw * 0.4, ry - bh / 2 + 2); c.lineTo(x, ry - bh / 2 - 4); c.lineTo(x + bw * 0.1, ry - bh / 2 + 2); c.fill();
    // strut connecting booster to core
    c.strokeStyle = 'rgba(180,160,240,.55)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x + (side < 0 ? bw : -bw), ry);
    c.lineTo(x + (side < 0 ? bw + 12 : -bw - 12), ry);
    c.stroke();
    // booster fin
    c.fillStyle = 'rgba(120,60,200,.85)';
    c.beginPath();
    c.moveTo(x + side * bw, ry + bh / 2 - 4);
    c.lineTo(x + side * (bw + 9), ry + bh / 2 + 10);
    c.lineTo(x + side * bw, ry + bh / 2 + 5);
    c.fill();
    // booster engine bell
    c.fillStyle = 'rgba(120,100,180,.8)';
    c.beginPath();
    c.moveTo(x - bw * .5, ry + bh / 2 + 4);
    c.lineTo(x - bw, ry + bh / 2 + 10);
    c.lineTo(x + bw, ry + bh / 2 + 10);
    c.lineTo(x + bw * .5, ry + bh / 2 + 4);
    c.fill();
  }

  /* ─── Booster exhaust ─── */
  _drawBoosterExhaust(x, ry, t, side) {
    const c = this.x2d;
    const baseY = ry + 18 + 10;
    const f = Math.sin(t * 20 + side) * 2;
    const len = 28 + Math.sin(t * 11) * 5;
    const og = c.createLinearGradient(x, baseY, x, baseY + len);
    og.addColorStop(0, 'rgba(255,200,80,.85)');
    og.addColorStop(.5, 'rgba(255,100,30,.5)');
    og.addColorStop(1, 'rgba(120,0,0,0)');
    c.fillStyle = og;
    c.beginPath();
    c.moveTo(x - 5, baseY);
    c.quadraticCurveTo(x - 7 + f, baseY + len * .5, x + f * .5, baseY + len);
    c.quadraticCurveTo(x + 7 + f, baseY + len * .5, x + 5, baseY);
    c.fill();
    // spawn small particles occasionally
    if (Math.random() < .4) {
      this.exhParticles.push({
        x: x + (Math.random() - .5) * 6, y: baseY + len * .7,
        vx: (Math.random() - .5) * .8, vy: .5 + Math.random(),
        life: .7 + Math.random() * .3, size: 1.2 + Math.random() * 2,
        color: `hsl(${15 + Math.random() * 30},100%,${35 + Math.random() * 20}%)`
      });
    }
  }

  /* ─── Core first stage (lower-body section) ─── */
  _drawFirstStage(cx, ry, BW, BH) {
    const c = this.x2d;
    const stH = 22;
    const topY = ry + BH / 2;
    const bg = c.createLinearGradient(cx - BW, 0, cx + BW, 0);
    bg.addColorStop(0, 'rgba(150,130,210,1)');
    bg.addColorStop(.4, 'rgba(230,220,255,1)');
    bg.addColorStop(1, 'rgba(140,120,200,1)');
    c.fillStyle = bg;
    c.beginPath();
    c.rect(cx - BW, topY, BW * 2, stH);
    c.fill();

    // Metallic paneling lines
    c.strokeStyle = 'rgba(0,0,0,0.2)';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(cx, topY); c.lineTo(cx, topY + stH);
    c.moveTo(cx - BW, topY + stH * 0.5); c.lineTo(cx + BW, topY + stH * 0.5);
    c.stroke();

    // Orange separation band with texture
    c.fillStyle = 'rgba(255,100,20,0.9)';
    c.fillRect(cx - BW, topY, BW * 2, 4);
    c.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = -BW; i < BW; i += 4) c.fillRect(cx + i, topY, 1, 4);

    // Engine bells (GSLV style)
    const bellW = BW * 0.45, bellH = 14;
    const bellPositions = [-BW * .65, -BW * .18, BW * .18, BW * .65];
    bellPositions.forEach(bx => {
      const bg2 = c.createLinearGradient(cx + bx - bellW, 0, cx + bx + bellW, 0);
      bg2.addColorStop(0, '#554488'); bg2.addColorStop(1, '#7766AA');
      c.fillStyle = bg2;
      c.beginPath();
      c.moveTo(cx + bx - bellW * .6, topY + stH);
      c.lineTo(cx + bx - bellW, topY + stH + bellH);
      c.lineTo(cx + bx + bellW, topY + stH + bellH);
      c.lineTo(cx + bx + bellW * .6, topY + stH);
      c.fill();
    });

    this._drawExhaust(cx, ry, performance.now() * 0.001, true, topY + stH + bellH);

    // Fins - Futuristic sweep
    c.fillStyle = 'rgba(60,30,120,1)';
    c.beginPath();
    c.moveTo(cx - BW, topY + stH - 8);
    c.lineTo(cx - BW - 20, topY + stH + 18);
    c.lineTo(cx - BW, topY + stH + 4);
    c.fill();
    c.beginPath();
    c.moveTo(cx + BW, topY + stH - 8);
    c.lineTo(cx + BW + 20, topY + stH + 18);
    c.lineTo(cx + BW, topY + stH + 4);
    c.fill();
  }

  /* ─── upper body (second stage + payload section) ─── */
  _drawUpperBody(cx, ry, BW, BH) {
    const c = this.x2d;
    const bg = c.createLinearGradient(cx - BW, 0, cx + BW, 0);
    bg.addColorStop(0, 'rgba(180,165,245,1)');
    bg.addColorStop(.4, 'rgba(250,250,255,1)');
    bg.addColorStop(.6, 'rgba(220,210,250,1)');
    bg.addColorStop(1, 'rgba(150,135,210,1)');
    c.fillStyle = bg;
    c.beginPath();
    if (c.roundRect) c.roundRect(cx - BW, ry - BH / 2, BW * 2, BH, [4, 4, 2, 2]);
    else c.rect(cx - BW, ry - BH / 2, BW * 2, BH);
    c.fill();

    // Body paneling & decals
    c.strokeStyle = 'rgba(0,0,0,0.1)';
    c.beginPath();
    c.moveTo(cx - BW, ry - BH * 0.2); c.lineTo(cx + BW, ry - BH * 0.2);
    c.stroke();
    // Cyber-highlight
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(cx - BW + 1.5, ry - BH / 2 + 5, 2.5, BH - 12);

    // Blue "ISRO/GSLV" style vertical stripe
    c.fillStyle = 'rgba(100,150,255,0.7)';
    c.fillRect(cx + BW - 3, ry - BH / 2 + 8, 1.5, BH * 0.4);

    if (this.progress >= 0.60) {
      c.fillStyle = 'rgba(255,160,60,0.8)';
      c.fillRect(cx - BW, ry + BH / 2 - 4, BW * 2, 3);
    }
    // upper stage engine bell
    c.fillStyle = 'rgba(100,90,160,1)';
    c.beginPath();
    c.moveTo(cx - BW * .5, ry + BH / 2);
    c.lineTo(cx - BW * .8, ry + BH / 2 + 12);
    c.lineTo(cx + BW * .8, ry + BH / 2 + 12);
    c.lineTo(cx + BW * .5, ry + BH / 2);
    c.fill();

    // Upper exhaust ONLY after core separation (stage 2)
    if (this.progress >= 0.60) {
      this._drawExhaust(cx, ry, performance.now() * 0.001, false);
    }
  }

  /* ─── Fairing (two halves around the nose) ─── */
  _drawFairing(cx, ry, BW, BH) {
    const c = this.x2d;
    const nosH = 26; // Slightly taller for futuristic look
    const topY = ry - BH / 2;
    // left half
    c.fillStyle = 'rgba(205,195,255,1)';
    c.beginPath();
    c.moveTo(cx - BW, topY);
    c.quadraticCurveTo(cx - BW, topY - nosH * 0.4, cx, topY - nosH);
    c.lineTo(cx, topY);
    c.fill();
    // right half
    c.fillStyle = 'rgba(225,215,255,1)';
    c.beginPath();
    c.moveTo(cx + BW, topY);
    c.quadraticCurveTo(cx + BW, topY - nosH * 0.4, cx, topY - nosH);
    c.lineTo(cx, topY);
    c.fill();
    // Divider
    c.strokeStyle = 'rgba(0,0,0,0.2)';
    c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(cx, topY); c.lineTo(cx, topY - nosH); c.stroke();
    // Tip glow
    const tg = c.createRadialGradient(cx, topY - nosH, 0, cx, topY - nosH, 8);
    tg.addColorStop(0, 'rgba(200,220,255,0.3)'); tg.addColorStop(1, 'transparent');
    c.fillStyle = tg; c.beginPath(); c.arc(cx, topY - nosH, 8, 0, Math.PI * 2); c.fill();
  }

  /* ─── SATELLITE ─── */
  _drawSatellite(cx, satY, solarAngle, t) {
    const c = this.x2d;

    // Cubesat Body - Simple rectangular prism
    const bw = 8, bh = 8;
    c.fillStyle = '#6688aa'; // Brighter body
    c.fillRect(cx - bw, satY - bh, bw * 2, bh * 2);

    // Body glow
    const g = c.createRadialGradient(cx, satY, 0, cx, satY, 15);
    g.addColorStop(0, 'rgba(100, 200, 255, 0.4)');
    g.addColorStop(1, 'rgba(100, 200, 255, 0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, satY, 15, 0, Math.PI * 2); c.fill();

    c.strokeStyle = '#aaddff';
    c.lineWidth = 1.5;
    c.strokeRect(cx - bw, satY - bh, bw * 2, bh * 2);

    // Antenna on TOP
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx, satY - bh);
    c.lineTo(cx, satY - bh - 10);
    c.stroke();
    // Antenna tip glow
    c.fillStyle = '#00ffff';
    c.beginPath(); c.arc(cx, satY - bh - 10, 1.5, 0, Math.PI * 2); c.fill();

    // Rectangular solar panels on LEFT and RIGHT
    const pw = 24, ph = 10;
    const p = Math.min(1, solarAngle / (Math.PI / 2));

    // Left Panel
    c.fillStyle = '#2a4a7a';
    c.fillRect(cx - bw - pw * p, satY - ph / 2, pw * p, ph);
    c.strokeStyle = '#00ffff';
    c.lineWidth = 1;
    c.strokeRect(cx - bw - pw * p, satY - ph / 2, pw * p, ph);
    // Panel grid lines
    if (p > 0.5) {
      c.strokeStyle = 'rgba(0, 255, 255, 0.3)';
      for (let i = 1; i < 4; i++) {
        const lx = cx - bw - (pw * p / 4) * i;
        c.beginPath(); c.moveTo(lx, satY - ph / 2); c.lineTo(lx, satY + ph / 2); c.stroke();
      }
    }

    // Right Panel
    c.fillStyle = '#2a4a7a';
    c.fillRect(cx + bw, satY - ph / 2, pw * p, ph);
    c.strokeStyle = '#00ffff';
    c.lineWidth = 1;
    c.strokeRect(cx + bw, satY - ph / 2, pw * p, ph);
    if (p > 0.5) {
      c.strokeStyle = 'rgba(0, 255, 255, 0.3)';
      for (let i = 1; i < 4; i++) {
        const lx = cx + bw + (pw * p / 4) * i;
        c.beginPath(); c.moveTo(lx, satY - ph / 2); c.lineTo(lx, satY + ph / 2); c.stroke();
      }
    }

    // Small nozzle at BOTTOM
    const nozzX = cx, nozzY = satY + bh;
    c.fillStyle = '#555555';
    c.fillRect(nozzX - 3, nozzY, 6, 3);

    // Green-blue tiny ion exhaust - more vivid
    const fl = Math.sin(t * 30) * 2;
    const fg = c.createLinearGradient(nozzX, nozzY + 3, nozzX, nozzY + 15 + fl);
    fg.addColorStop(0, '#00ffff');
    fg.addColorStop(0.3, '#00ffccaa');
    fg.addColorStop(1, 'transparent');
    c.fillStyle = fg;
    c.beginPath();
    c.moveTo(nozzX - 2.5, nozzY + 3);
    c.lineTo(nozzX, nozzY + 15 + fl);
    c.lineTo(nozzX + 2.5, nozzY + 3);
    c.fill();
  }

  /* ─── Main engine exhaust ─── */
  _drawExhaust(cx, ry, t, isCluster, overrideBaseY) {
    if (cx <= 0 || isNaN(ry)) return;
    const c = this.x2d;
    const BH = 38;
    const baseY = overrideBaseY !== undefined ? overrideBaseY : ry + BH / 2 + 10;
    if (baseY < -50 || baseY > this.c.height + 50) return; // Don't draw if far off-canvas
    const f1 = Math.sin(t * 25) * 3;
    const len = isCluster ? 80 + Math.sin(t * 8) * 12 : 60 + Math.sin(t * 10) * 10;
    const hw = isCluster ? 14 : 10;

    // Outer Violet/Orange Flame
    const og = c.createLinearGradient(cx, baseY, cx, baseY + len);
    og.addColorStop(0, 'rgba(255, 200, 100, 0.9)');
    og.addColorStop(0.2, 'rgba(255, 100, 50, 0.7)');
    og.addColorStop(0.6, 'rgba(150, 50, 255, 0.3)');
    og.addColorStop(1, 'transparent');
    c.fillStyle = og;
    c.beginPath();
    c.moveTo(cx - hw, baseY);
    c.quadraticCurveTo(cx - hw * 2 + f1, baseY + len * 0.5, cx, baseY + len);
    c.quadraticCurveTo(cx + hw * 2 + f1, baseY + len * 0.5, cx + hw, baseY);
    c.fill();

    // White Core Spike
    const cg = c.createLinearGradient(cx, baseY, cx, baseY + len * 0.4);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, 'transparent');
    c.fillStyle = cg;
    c.beginPath();
    c.moveTo(cx - 3, baseY); c.lineTo(cx, baseY + len * 0.35 + f1); c.lineTo(cx + 3, baseY);
    c.fill();

    if (Math.random() < 0.6) {
      this.exhParticles.push({
        x: cx + (Math.random() - .5) * hw, y: baseY + len * 0.8,
        vx: (Math.random() - .5) * 1.5, vy: 1 + Math.random() * 2,
        life: 1.0 + Math.random() * 0.5, size: 2 + Math.random() * 4,
        color: `rgba(180, 180, 200, ${0.2 + Math.random() * 0.3})`
      });
    }
  }

  /* ─── Detached parts drift away ─── */
  _animateDetached(t) {
    const c = this.x2d;
    const fade = (obj, drawFn) => {
      if (obj.alive) return;
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.vy += 0.05;        // gravity
      obj.alpha = Math.max(0, obj.alpha - 0.018);
      if (obj.alpha <= 0) return;
      c.globalAlpha = obj.alpha;
      drawFn();
      c.globalAlpha = 1;
    };

    // drifting booster L
    fade(this.boosterL, () => {
      this.boosterL.rot += 0.04;
      c.save();
      c.translate(this.boosterL.x, this.boosterL.y);
      c.rotate(this.boosterL.rot);
      this._drawBooster(0, 0, -1, t);
      c.restore();
    });
    // drifting booster R
    fade(this.boosterR, () => {
      this.boosterR.rot -= 0.04;
      c.save();
      c.translate(this.boosterR.x, this.boosterR.y);
      c.rotate(this.boosterR.rot);
      this._drawBooster(0, 0, 1, t);
      c.restore();
    });
    // drifting core stage
    fade(this.coreStage, () => {
      c.save();
      c.translate(this.coreStage.x, this.coreStage.y);
      const BW = 10, BH = 38;
      this._drawFirstStage(0, 0, BW, BH);
      c.restore();
    });
    // drifting fairing halves
    fade(this.fairingL, () => {
      this.fairingL.rot -= 0.04;
      c.save(); c.translate(this.fairingL.x, this.fairingL.y); c.rotate(this.fairingL.rot);
      c.fillStyle = 'rgba(205,195,255, 0.9)';
      c.beginPath();
      c.moveTo(-10, 0);
      c.quadraticCurveTo(-10, -10, 0, -26);
      c.lineTo(0, 0);
      c.fill();
      c.restore();
    });
    fade(this.fairingR, () => {
      this.fairingR.rot += 0.04;
      c.save(); c.translate(this.fairingR.x, this.fairingR.y); c.rotate(this.fairingR.rot);
      c.fillStyle = 'rgba(225,215,255, 0.9)';
      c.beginPath();
      c.moveTo(10, 0);
      c.quadraticCurveTo(10, -10, 0, -26);
      c.lineTo(0, 0);
      c.fill();
      c.restore();
    });
  }

  /* ─── Particles ─── */
  _drawParticles() {
    const c = this.x2d;
    [...this.exhParticles, ...this.sepParticles].forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.type === 'acs') {
        p.vx *= 0.98; p.vy *= 0.98; p.size += 0.1;
      } else {
        p.vy += 0.04;
      }
      p.life -= p.type === 'acs' ? 0.01 : 0.02;
      if (p.life <= 0) return;
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, Math.max(.1, p.size * p.life), 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
    this.exhParticles = this.exhParticles.filter(p => p.life > 0);
    this.sepParticles = this.sepParticles.filter(p => p.life > 0);
  }

  /* ─── Flash rings ─── */
  _drawFlashRings() {
    const c = this.x2d;
    this.flashRings.forEach(r => {
      r.r += 4; r.life -= 0.04;
      if (r.life <= 0) return;
      c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      c.strokeStyle = r.color ? `${r.color}${Math.floor(r.life * 255).toString(16).padStart(2, '0')}` : `rgba(167, 139, 250, ${r.life * 0.75})`;
      c.lineWidth = 2.5; c.stroke();
    });
    this.flashRings = this.flashRings.filter(r => r.life > 0);
  }
}

const rocket = new RocketAnimation();
window.addEventListener('resize', () => { if (currentPage === 1) rocket.resize(); });

/* ════════════════════════
   PAGED SCROLL SYSTEM
════════════════════════ */
const TOTAL_PAGES = 4;
const container = document.getElementById('pagesContainer');
const dots = document.querySelectorAll('.dot');
const navLinks = document.querySelectorAll('.nav-link');

let currentPage = 0;
let innerState = 0;   // 0 = hero view, 1 = about panel (page 0 only)
let scrollLocked = false;
let scrollTimer = null;

/* ── About panel helpers ── */
function revealAbout() { innerState = 1; document.body.classList.add('revealed'); }
function hideAbout() { innerState = 0; document.body.classList.remove('revealed'); }

/* ── Scroll lock (replaces isAnimating + animTimer) ── */
function lockScroll(ms) {
  scrollLocked = true;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { scrollLocked = false; scrollTimer = null; }, ms);
}

/* ── Sync side-dots and navbar highlights ── */
function syncIndicators() {
  dots.forEach(d => d.classList.toggle('active', +d.dataset.page === currentPage));
  navLinks.forEach(l => l.classList.toggle('active', +l.dataset.page === currentPage));
}

/* ── Core navigate function – single source of truth ── */
function navigate(targetPage, showAbout) {
  targetPage = Math.max(0, Math.min(TOTAL_PAGES - 1, targetPage));

  /* Rocket: stop when leaving Education, start when entering it */
  if (currentPage === 1 && targetPage !== 1) { try { rocket.stop(); } catch (e) { } }
  if (targetPage === 1 && currentPage !== 1) {
    setTimeout(() => { try { rocket.start(); } catch (e) { console.error(e); } }, 50);
  }

  currentPage = targetPage;
  container.style.transform = `translateY(-${targetPage * 100}vh)`;

  /* About panel */
  if (targetPage === 0 && showAbout) revealAbout(); else hideAbout();

  syncIndicators();
  lockScroll(900);   /* lock for full CSS transition duration */
}

/* ── Scroll handler ── */
function handleScroll(delta) {
  if (scrollLocked) return;
  /* Check modal — query directly so no forward-ref issues */
  const modal = document.getElementById('modalOverlay');
  if (modal && modal.classList.contains('open')) return;
  if (Math.abs(delta) < 15) return;

  if (delta > 0) {
    /* Scroll DOWN */
    if (currentPage === 0 && innerState === 0) { revealAbout(); lockScroll(450); }
    else if (currentPage < TOTAL_PAGES - 1) { navigate(currentPage + 1, false); }
  } else {
    /* Scroll UP */
    if (currentPage === 0 && innerState === 1) { hideAbout(); lockScroll(450); }
    else if (currentPage > 0) { navigate(currentPage - 1, true); }
  }
}

/* ── Event listeners ── */
window.addEventListener('wheel', e => handleScroll(e.deltaY), { passive: true });
window.addEventListener('mousewheel', e => handleScroll(-e.wheelDelta), { passive: true });
let lastTouchY = 0;
window.addEventListener('touchstart', e => { lastTouchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', e => {
  const d = lastTouchY - e.changedTouches[0].clientY;
  if (Math.abs(d) > 40) handleScroll(d);
}, { passive: true });
window.addEventListener('keydown', e => {
  if (['ArrowDown', 'PageDown'].includes(e.key)) handleScroll(100);
  if (['ArrowUp', 'PageUp'].includes(e.key)) handleScroll(-100);
});

/* ── Nav bar clicks ── */
navLinks.forEach(link => link.addEventListener('click', e => {
  e.preventDefault();
  const pg = +link.dataset.page;
  if (pg === 0 && currentPage === 0 && innerState === 1) return; /* already on about */
  if (pg === 0 && currentPage === 0) { revealAbout(); lockScroll(450); syncIndicators(); return; }
  navigate(pg, pg === 0);
}));

/* ── Side dot clicks ── */
dots.forEach(dot => dot.addEventListener('click', () => {
  const pg = +dot.dataset.page;
  navigate(pg, pg === 0);
}));

/* ── Init: sync indicators to match HTML initial state ── */
syncIndicators();

/* ════════════════════════
   MODAL DATA
════════════════════════ */

const modalData = {
  'stage-0': {
    title: 'High School',
    meta: '',
    body: `
<div class="modal-split-header">
  <div class="header-left">
    <span class="modal-university-title">ADITYA BIRLA PUBLIC SCHOOL</span>
    <span class="modal-degree-subtitle">- Secondary Education</span>
  </div>
  <div class="header-right">
    <span class="modal-year-right">2000 – 2014</span>
  </div>
</div>
<p>What started as a childhood memory of watching a starry sky during a power cut, listening to family talk about planets and the universe, quietly shaped everything that followed. That sense of wonder grew into a love for Science, and science projects became a playground for curiosity.</p>

<h4 style="margin-top: 25px;">ACHIEVEMENTS</h4>
<div class="star-list" style="margin-top: 10px;">
  <div class="star-item">
    <span class="star">✦</span>
    <span>Multiple Science & Mathematics Olympiad medals at state and national level</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Top honours in a Cambridge University accredited English programme</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Consistent academic distinction across the sciences</span>
  </div>
</div>
<p style="margin-top: 20px;">Inspired by APJ Abdul Kalam, Kalpana Chawla, and Sunita Williams, that childhood fascination with the cosmos evolved into a clear and unwavering ambition to pursue aerospace engineering and space exploration as a career.</p>`
  },
  'stage-1': {
    title: "Bachelor's Degree",
    meta: '',
    body: `
<div class="modal-split-header">
  <div class="header-left">
    <span class="modal-university-title">AMITY UNIVERSITY</span>
    <span class="modal-degree-subtitle">- B.Tech Aerospace Engineering</span>
  </div>
  <div class="header-right">
    <span class="modal-year-right">2014-2018</span>
  </div>
</div>

<h4 class="modal-section-subtitle" style="margin-top: 10px;">CORE CURRICULUM</h4>
<div class="course-pills">
  <span class="pill">Propulsion</span>
  <span class="pill">Fluid Mechanics</span>
  <span class="pill">Thermodynamics</span>
  <span class="pill">Aerodynamics</span>
  <span class="pill">Mechanical Design</span>
  <span class="pill">Structures</span>
</div>

<h4 class="modal-section-subtitle">NOTABLE PROJECTS</h4>
<div class="star-list">
  <div class="star-item">
    <span class="star">✦</span>
    <span>CFD Analysis of Airfoils using ANSYS Fluent</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Combustion Chamber and Turbine Design using CATIA</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>FEM Analysis of Beam Sections using ANSYS</span>
  </div>
</div>

<h4 class="modal-section-subtitle">MAJOR PROJECT</h4>
<div class="modal-card-inset" style="margin-top: 10px;">
  <b style="color: #fff; font-size: 0.95rem; display: block; margin-bottom: 8px;">Self-Healing Composites</b>
  <p style="margin-bottom: 0;">Investigated self-healing composite technologies to improve structural durability and damage tolerance. Led a team demonstration of an intrinsic self-healing method where damaged specimens recovered structural integrity after healing.</p>
</div>

<div class="modal-gallery-quad">
  <div class="gallery-item">
    <img src="assets/Amity1.jpeg" alt="Turbine Lab">
    <div class="gallery-caption">Turbine Lab · Amity University</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Amity2.jpeg" alt="Self-healing composite test">
    <div class="gallery-caption">Self-healing composite test</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Amity3.png" alt="FEM beam analysis">
    <div class="gallery-caption">FEM beam analysis · Ansys</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Amity4.png" alt="Compressor design">
    <div class="gallery-caption">Compressor design · Catia</div>
  </div>
</div>`
  },
  'stage-2': {
    title: 'Internships',
    meta: '',
    body: `
<div class="modal-split-header">
  <div class="header-left">
    <span class="modal-university-title">CETPA INFOTECH</span>
    <span class="modal-degree-subtitle">- CATIA V5 Training</span>
  </div>
  <div class="header-right">
    <span class="modal-year-right">Intern</span>
  </div>
</div>
<p>Received structured training in CATIA V5 with a focus on engineering design workflows. Developed skills in 2D drafting, 3D part modelling, assembly design, and sheet-metal design. Learned technical drawing standards, design documentation, and practical CAD methodologies used in mechanical and aerospace environments. This training built the foundational CAD proficiency that supported all subsequent project and academic work.</p>

<div class="modal-gallery-grid" style="margin-top: 10px; margin-bottom: 25px; overflow: hidden;">
  <div class="gallery-item">
    <img src="assets/cetpa1.png" alt="Fan Stage Design">
    <div class="gallery-caption">Fan Stage Design · CATIA V5</div>
  </div>
  <div class="gallery-item">
    <img src="assets/cetpa2.png" alt="Compressor Assembly">
    <div class="gallery-caption">Compressor Assembly · CATIA V5</div>
  </div>
</div>

<div class="modal-split-header" style="margin-top: 40px;">
  <div class="header-left">
    <span class="modal-university-title">HINDUSTAN AERONAUTICS LIMITED (HAL)</span>
  </div>
  <div class="header-right">
    <span class="modal-year-right">Intern</span>
  </div>
</div>
<p>Gained industrial exposure to aerospace manufacturing and maintenance practices at one of India's leading aerospace organisations. Observed CNC machining operations, component manufacturing processes, and assembly workflows for aircraft structures.</p>

<p>While many projects were confidential due to their defence sensitivity, the internship offered valuable insight into how major aircraft programs are structured and assembled, including exposure to fighter aircraft manufacturing ecosystems such as those supporting the <b>Tejas LCA</b> program. This experience gave me a grounded understanding of large-scale aerospace production and the discipline required in defence manufacturing.</p>

<div class="modal-gallery-grid" style="margin-top: 10px; margin-bottom: 25px;">
  <div class="gallery-item wide">
    <img src="assets/Hindustan.jpg" alt="HAL Tejas Floor">
    <div class="gallery-caption">HAL · Tejas LCA Assembly Floor</div>
  </div>
</div>

<div class="modal-split-header" style="margin-top: 40px;">
  <div class="header-left">
    <span class="modal-university-title">BRAHMASTRA AEROSPACE</span>
    <span class="modal-degree-subtitle">- CubeSats</span>
  </div>
  <div class="header-right">
    <span class="modal-year-right">Virtual Intern</span>
  </div>
</div>
<p>Completed a virtual internship during the COVID period focused on CubeSat systems and small-satellite engineering. Studied CubeSat structures, subsystems, mission design, and propulsion technologies.</p>

<p>Led a four-member team to develop a technical presentation on <b>CubeSat propulsion</b>, with a particular focus on electric propulsion concepts and emerging water-based propulsion research. This project sparked a deeper interest in electric propulsion systems that would go on to define my graduate research.</p>

<div class="modal-trophy-box">
  <div class="trophy-icon">🏆</div>
  <div class="trophy-text">
    Received a <b>merit-based appreciation award</b> from the programme mentor for contributions to CubeSat propulsion research.
  </div>
</div>`
  },
  'stage-3': {
    title: "Master's Degree",
    meta: '',
    body: `
<div class="modal-split-header">
  <div class="header-left">
    <span class="modal-university-title">MS in Space Engineering</span>
    <span class="modal-degree-subtitle">- UNIVERSITY OF PISA</span>
  </div>
  <div class="header-right">
    <span class="modal-year-right">2023–2025</span>
  </div>
</div>

<h4 class="modal-section-subtitle" style="margin-top: 10px;">CORE CURRICULUM</h4>
<div class="course-pills">
  <span class="pill">Spacecraft Propulsion</span>
  <span class="pill">Electric Propulsion</span>
  <span class="pill">Fluid Dynamics</span>
  <span class="pill">Space Systems Engineering</span>
  <span class="pill">Spaceflight Mechanics</span>
  <span class="pill">Space Communications</span>
  <span class="pill">Spacecraft Structures</span>
  <span class="pill">ADCS / ADSA</span>
</div>
<div class="modal-card-inset">
  <h4 class="modal-section-subtitle">THESIS</h4>
  <span class="thesis-quote">"Analysing the Role of Thermal Dissociation on the Performance of an Iodine-Fed Hall Thruster"</span>
  <p>Conducted numerical simulations of iodine-fed Hall thruster performance using a 1D unsteady multi-species plasma fluid model in MATLAB based on SPT-100 configuration, analysing thermal dissociation effects on discharge behaviour, plasma characteristics, and overall performance parameters. Designed and integrated a dedicated RLC circuit model to regulate discharge current and mitigate high-frequency oscillations for improved operational stability.</p>
  <hr style="opacity: 0.1; margin: 15px 0;">
  <h4 class="modal-section-subtitle">ACADEMIC PROJECTS</h4>
  <div class="star-list" style="margin-top: 10px;">
    <div class="star-item"><span class="star">✦</span> Io Exploration Mission Concept - mission architecture and subsystem-level design</div>
    <div class="star-item"><span class="star">✦</span> Vega Stage 3 Structural Analysis - structural, buckling, and vibration analysis</div>
  </div>
</div>

<div class="modal-card-purple">
  <h4 class="modal-section-subtitle" style="margin-top: 0; color: #fff;">ACADEMIC RECOGNITION & SCHOLARSHIPS</h4>
  <div class="scholarship-item">
    <div class="star">✦</div>
    <div class="scholarship-content">
      <b>DSU Scholarship</b> · <span>University of Pisa</span>
      <p style="text-align: left; margin: 4px 0 0; font-size: 0.85rem;">Awarded during the first year of master's studies.</p>
    </div>
  </div>
  <div class="scholarship-item">
    <div class="star">✦</div>
    <div class="scholarship-content">
      <b>Academic Support Award — €1,500</b> · <span>University of Pisa</span>
      <p style="text-align: left; margin: 4px 0 0; font-size: 0.85rem;">Received based on academic performance and credit completion.</p>
    </div>
  </div>
  <div class="scholarship-item">
    <div class="star">✦</div>
    <div class="scholarship-content">
      <b>Santé Malatesta Educational Support</b>
      <p style="text-align: left; margin: 4px 0 0; font-size: 0.85rem;">Awarded in recognition of academic progress.</p>
    </div>
  </div>
</div>

<p style="font-style: italic; opacity: 0.7; font-size: 0.9rem; margin: 20px 0;">With the programme strongly oriented towards propulsion-related studies, I naturally focused my academic path on electric propulsion and aligned my thesis and project work under this theme to build deeper expertise in space propulsion systems.</p>

<span class="section-tag">GALLERY</span>
<div class="modal-gallery-grid">
  <div class="gallery-item">
    <img src="assets/masters1.jpeg" alt="Graduation">
    <div class="gallery-caption">Graduation · Pisa</div>
  </div>
  <div class="gallery-item">
    <img src="assets/masters2.jpeg" alt="ARGO Team">
    <div class="gallery-caption">ARGO Mission Team</div>
  </div>
  <div class="gallery-item">
    <img src="assets/masters3.jpeg" alt="ARGO Presentation">
    <div class="gallery-caption">ARGO Mission Presentation</div>
  </div>
  <div class="gallery-item">
    <img src="assets/masters4.jpeg" alt="UNIPI">
    <div class="gallery-caption">UNIPI · Ingegneria</div>
  </div>
</div>`
  },
  'proj-hall': {
    title: "Master's Thesis — “Analyzing the Role of Thermal Dissociation on Performance Parameters of an Iodine Hall Thruster”",
    meta: "solo · matlab · electric propulsion",
    body: `
<p style="margin-top: 20px;">Numerical investigation of thermal dissociation effects on the performance of an iodine-fed Hall thruster, combining a 1D unsteady multi-species plasma fluid model with an integrated RLC discharge circuit in MATLAB.</p>

<h4 class="modal-section-subtitle">KEY WORK & IMPACT</h4>
<div class="star-list">
  <div class="star-item">
    <span class="star">✦</span>
    <span>Conducted MATLAB-based 1D unsteady plasma simulations to study discharge behaviour, iodine dissociation, and performance coupling</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Developed and integrated an RLC circuit model to analyse and stabilise discharge current oscillations</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Investigated breathing-mode instabilities and the influence of anode temperature on plasma dynamics</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Derived performance and stability insights relevant to iodine as an alternative propellant for small satellite propulsion</span>
  </div>
</div>

<h4 class="modal-section-subtitle">THRUSTER and CIRCUIT MODEL</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item">
    <img src="assets/Thruster1.jpg" alt="SPT-100 Hall Thruster">
    <div class="gallery-caption">SPT-100 Hall Thruster</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Thruster2.jpg" alt="RLC Circuit Model">
    <div class="gallery-caption">RLC Circuit Model · Discharge Stabilization</div>
  </div>
</div>

<h4 class="modal-section-subtitle">PLASMA DYNAMICS</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item wide">
    <img src="assets/Thruster3.png" alt="Iodine Dissociation Mechanisms">
    <div class="gallery-caption">Electron Impact vs Thermal Dissociation · Thesis Presentation Slide</div>
  </div>
</div>

<h4 class="modal-section-subtitle">SIMULATION RESULTS</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item">
    <img src="assets/Thruster4.jpg" alt="With Thermal Dissociation at Anode">
    <div class="gallery-caption">With Thermal Dissociation at Anode</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Thruster5.jpg" alt="With Electron Impact Dissociation downstream">
    <div class="gallery-caption">With Electron Impact Dissociation downstream</div>
  </div>
</div>

<h4 class="modal-section-subtitle">PROPELLANT ANALYSIS</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item wide">
    <img src="assets/Thruster6.png" alt="Iodine vs Xenon Performance Analysis">
    <div class="gallery-caption">Iodine vs Xenon Performance Analysis in various Hall Thruster</div>
  </div>
</div>

<h4 class="modal-section-subtitle">TOOLS AND TECHNIQUES USED</h4>
<div class="tool-pills">
  <div class="tool-pill">
    <i class="devicon-matlab-plain"></i>
    <span>MATLAB</span>
  </div>
  <div class="tool-pill">
    <span>∿ Simulink</span>
  </div>
  <div class="tool-pill">
    <i class="devicon-microsoftoffice-plain"></i>
    <span>MS Office</span>
  </div>
  <div class="tool-pill">
    <span>⚡ Plasma Modeling</span>
  </div>
  <div class="tool-pill">
    <span>∑ Numerical Analysis</span>
  </div>
  <div class="tool-pill">
    <span>⚛ RLC Circuit Simulation</span>
  </div>
</div>

<div class="modal-trophy-box">
  <div class="trophy-icon">🏆</div>
  <div class="trophy-text">
    Graduated with <b>30/30 cum laude (maximum academic distinction)</b> for in-depth research on iodine-based Hall thrusters and electric propulsion performance optimisation.
  </div>
</div>`
  },
  'proj-vega': {
    title: 'Vega Stage 3 Upper Stage Structural Analysis',
    meta: 'Structural Engineering · Team (2 members) · ANSYS · FEM',
    body: `
<div class="modal-gallery-grid" style="margin-top:20px; margin-bottom:10px;">
  <div class="gallery-item fit">
    <img src="assets/vega.jpg" alt="Vega Upper Stage">
  </div>
</div>

<p style="margin-top:16px;">Structural integrity and vibration analysis of the Vega launch vehicle upper stage, applying real-world launcher structural assessment methods to evaluate deformation, failure risk, and design margins.</p>

<h4 class="modal-section-subtitle">KEY WORK & IMPACT</h4>
<div class="star-list">
  <div class="star-item">
    <span class="star">✦</span>
    <span>Performed structural, buckling, and modal analyses to identify deformation and stress-critical regions</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Interpreted FEM results to evaluate failure risks and propose design improvements</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Applied real-world launcher structural assessment approaches aligned with industry practice</span>
  </div>
</div>

<h4 class="modal-section-subtitle">ANALYSIS SCOPE</h4>
<div class="star-list">
  <div class="star-item">
    <span class="star">✦</span>
    <span>Static Structural: Total deformation and principal stress evaluation</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Vibration & Random: Lateral directional deformation and 3σ equivalent stress</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Modal Analysis: Fixed-free modes extraction</span>
  </div>
</div>

<h4 class="modal-section-subtitle">DESIGN AND DRAFTING</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item fit">
    <img src="assets/Vega1.jpg" alt="Engineering Drawing and 3D Model">
    <div class="gallery-caption">Engineering drawing and 3D model · Vega upper stage geometry</div>
  </div>
</div>

<h4 class="modal-section-subtitle">FEM MESH</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item fit">
    <img src="assets/Vega2.jpg" alt="FEM Mesh View">
    <div class="gallery-caption">FEM mesh view · front and isometric · ANSYS 2024 R1</div>
  </div>
</div>

<h4 class="modal-section-subtitle">STATIC STRUCTURAL ANALYSIS</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item">
    <img src="assets/Vega3.jpg" alt="Total Deformation">
    <div class="gallery-caption">Total deformation · static structural</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Vega4.jpg" alt="Min Principal Stress">
    <div class="gallery-caption">Min principal stress &amp; elastic strain</div>
  </div>
</div>

<h4 class="modal-section-subtitle">VIBRATION & RANDOM ANALYSIS</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item">
    <img src="assets/Vega5.jpg" alt="Lateral Directional Deformation">
    <div class="gallery-caption">Lateral directional deformation · random vibration</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Vega6.jpg" alt="Equivalent Stress">
    <div class="gallery-caption">Equivalent stress · random vibration (3σ)</div>
  </div>
</div>
<div class="modal-gallery-grid" style="margin-top:10px;">
  <div class="gallery-item fit">
    <img src="assets/Vega7.jpg" alt="Fixed-Free Modal Analysis">
    <div class="gallery-caption">Fixed-free modal analysis · modes 1–4</div>
  </div>
</div>

<h4 class="modal-section-subtitle">TOOLS USED</h4>
<div class="tool-pills">
  <div class="tool-pill">
    <i class="devicon-ansys-plain" style="color:#ffb800;"></i>
    <span>ANSYS 2024 R1</span>
  </div>
  <div class="tool-pill">
    <span>✦ CATIA</span>
  </div>
  <div class="tool-pill">
    <span>⬡ SolidWorks</span>
  </div>
  <div class="tool-pill">
    <span>⚙ FEM Methods</span>
  </div>
  <div class="tool-pill">
    <i class="devicon-microsoftoffice-plain"></i>
    <span>MS Office</span>
  </div>
  <div class="tool-pill">
    <span>🔩 Structural Analysis</span>
  </div>
</div>

<div class="modal-trophy-box" style="border-left-color: #a5c8ff; background: rgba(165,200,255,0.07);">
  <div class="trophy-icon">✅</div>
  <div class="trophy-text">
    Strengthened practical understanding of aerospace structural verification and launch vehicle design modules.
  </div>
</div>`
  },
  'proj-argo': {
    title: 'ARGO - Io Exploration Mission Concept Study',
    meta: 'Deep Space Mission Design and Architecture · University of Pisa · Space Systems Project',
    body: `
<div class="modal-overview-split">
  <div class="overview-logo">
    <img src="assets/Argo1.jpeg" alt="ARGO Mission Logo">
  </div>
  <div class="overview-text">
    <p>End-to-end conceptual design of a scientific mission to Jupiter's moon Io. Architecture definition, subsystem design, plume analysis, and full systems engineering documentation across the full mission life-cycle.</p>
  </div>
</div>

<h4 class="modal-section-subtitle">KEY CONTRIBUTIONS</h4>
<div class="star-list">
  <div class="star-item">
    <span class="star">✦</span>
    <span>Conducted Io surface analysis and payload selection aligned with scientific objectives</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Proposed mission architecture: Main spacecraft (Argo) + de-orbiter + dual probes (Eurydice &amp; Orpheus)</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Performed plume altitude estimation analysis and preliminary SPH-based plume modelling</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Contributed to mass, power, link, and cost budgets using ECSS practices</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Designed probe subsystem layouts considering Jupiter's intense radiation environment</span>
  </div>
</div>

<h4 class="modal-section-subtitle">SPACECRAFT DESIGN – ARGO</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item">
    <img src="assets/Argo2.jpg" alt="Argo Spacecraft Front View">
    <div class="gallery-caption">Argo spacecraft · Front view</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Argo3.jpg" alt="Argo Spacecraft expanding solar panels">
    <div class="gallery-caption">Argo spacecraft expanding solar panels</div>
  </div>
</div>

<h4 class="modal-section-subtitle">PHYSICAL SCALE MODEL</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item fit">
    <img src="assets/Argo4.jpeg" alt="3D Printed Scale Model">
    <div class="gallery-caption">3D printed scale model of Argo spacecraft</div>
  </div>
</div>

<h4 class="modal-section-subtitle">TRANSFER TRAJECTORY – VEEGA</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item fit">
    <img src="assets/Argo5.jpg" alt="VEEGA Transfer Trajectory">
  </div>
</div>

<h4 class="modal-section-subtitle">ORBIT ANIMATION</h4>
<div class="video-wrapper">
  <video autoplay muted loop playsinline>
    <source src="assets/Argo6.mp4" type="video/mp4">
  </video>
  <div class="video-caption left">Io Impact Sequence</div>
</div>

<h4 class="modal-section-subtitle">D-ORBITER AND PROBES</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item fit">
    <img src="assets/Argo7.jpg" alt="D-Orbiter and Probes">
    <div class="gallery-caption">D-Orbiter · Eurydice (impacting probe) · Orpheus (plume analyzing probe)</div>
  </div>
</div>

<h4 class="modal-section-subtitle">SPH PLUME SIMULATION</h4>
<div class="video-wrapper">
  <video autoplay muted loop playsinline>
    <source src="assets/Argo8.mp4" type="video/mp4">
  </video>
  <div class="video-caption right">SPH plume simulation · Ejecta altitude estimation</div>
</div>

<h4 class="modal-section-subtitle">MISSION TIMELINE</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item fit">
    <img src="assets/Argo9.jpg" alt="Mission Timeline">
    <div class="gallery-caption">Mission timeline · Launch 2029 → End mission / extension 2036</div>
  </div>
</div>

<h4 class="modal-section-subtitle">TOOLS USED</h4>
<div class="tool-pills">
  <div class="tool-pill">
    <i class="devicon-matlab-plain"></i>
    <span>MATLAB</span>
  </div>
  <div class="tool-pill">
    <span>⬡ SolidWorks</span>
  </div>
  <div class="tool-pill">
    <span>∿ SPH Methods</span>
  </div>
  <div class="tool-pill">
    <span>⚙ Systems Engineering</span>
  </div>
  <div class="tool-pill">
    <span>∑ Systems Analysis</span>
  </div>
  <div class="tool-pill">
    <span>📋 ECSS Standards</span>
  </div>
  <div class="tool-pill">
    <i class="devicon-microsoftoffice-plain"></i>
    <span>MS Office</span>
  </div>
  <div class="tool-pill">
    <span>📋 LaTex</span>
  </div>
</div>

<div class="modal-trophy-box">
  <div class="trophy-icon">🏆</div>
  <div class="trophy-text">
    <b>Project grade: 30/30</b> - Recognised for strong technical contribution and systems thinking approach across the full mission design cycle.
  </div>
</div>`
  },
  'proj-composites': {
    title: "Bachelor's Major Project – Self-Healing Composites for Aerospace Structures",
    meta: 'Team Lead (4 members) · Experimental Research · 2017–2018',
    body: `
<p style="margin-top:18px;">Research-focused project exploring self-healing composite technologies to enhance durability, damage tolerance, and lifecycle reliability of aerospace structures. The project combined theoretical analysis with hands-on experimental demonstration of intrinsic healing mechanisms at macroscopic scale.</p>

<h4 class="modal-section-subtitle">KEYWORDS AND IMPACT</h4>
<div class="star-list">
  <div class="star-item">
    <span class="star">✦</span>
    <span>Studied intrinsic and extrinsic self-healing composite mechanisms and their aerospace applicability</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Led a 4-member team to experimentally demonstrate an extrinsic self-healing method at macroscopic level</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Designed and executed a damage-and-heal demonstration where specimens recovered structural integrity</span>
  </div>
  <div class="star-item">
    <span class="star">✦</span>
    <span>Assessed post-healing performance to understand feasibility and design implications for future structures</span>
  </div>
</div>

<h4 class="modal-section-subtitle">SELF-HEALING MECHANISM – HOLLOW FIBER COMPOSITES</h4>
<div class="modal-gallery-grid">
  <div class="gallery-item fit">
    <img src="assets/Sh1.jpg" alt="Hollow Fiber Healing Mechanism">
    <div class="gallery-caption">Hollow fiber extrinsic healing · Crack plane · Healing agent release</div>
  </div>
</div>

<h4 class="modal-section-subtitle">LAB DOCUMENTATION</h4>
<div class="modal-gallery-quad">
  <div class="gallery-item">
    <img src="assets/Sh2.jpeg" alt="Sandwich Composite Block">
    <div class="gallery-caption">Sandwich composite block</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Sh3.jpeg" alt="Healed Spectrum Crack Cross Section">
    <div class="gallery-caption">Healed spectrum crack cross section</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Sh4.jpeg" alt="Three-Point Bend Test">
    <div class="gallery-caption">Three-point bend test · Damage induction</div>
  </div>
  <div class="gallery-item">
    <img src="assets/Sh5.jpeg" alt="Compression Test">
    <div class="gallery-caption">Compression test · Healing agent extrusion</div>
  </div>
</div>

<h4 class="modal-section-subtitle">TOOLS AND METHODS</h4>
<div class="tool-pills">
  <div class="tool-pill">
    <span>🔬 Materials Testing</span>
  </div>
  <div class="tool-pill">
    <span>⚙ Composite Theory</span>
  </div>
  <div class="tool-pill">
    <span>∑ Structural Evaluation</span>
  </div>
  <div class="tool-pill">
    <span>🧪 Experimental Methods</span>
  </div>
  <div class="tool-pill">
    <i class="devicon-microsoftoffice-plain"></i>
    <span>MS Office</span>
  </div>
  <div class="tool-pill">
    <span>✦ CATIA</span>
  </div>
  <div class="tool-pill">
    <span>⬡ FEM Analysis</span>
  </div>
</div>

<div class="modal-trophy-box" style="border-left-color: #a5c8ff; background: rgba(165,200,255,0.07);">
  <div class="trophy-icon">✅</div>
  <div class="trophy-text">
    <div style="margin-bottom:8px;">Demonstrated practical feasibility of self-healing composites and their relevance to future aerospace structures.</div>
    <div>Development of teamwork, experimental research capability, and project leadership skills.</div>
  </div>
</div>`
  }
};

/* ── Modal open/close ── */
const overlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalContent = document.getElementById('modalContent');

function openModal(key) {
  const d = modalData[key]; if (!d) return;
  modalContent.innerHTML = `<h2>${d.title}</h2><span class="modal-meta">${d.meta}</span>${d.body}`;
  overlay.classList.add('open');
}
function closeModal() { overlay.classList.remove('open'); }

document.querySelectorAll('.clickable').forEach(el => el.addEventListener('click', () => openModal(el.dataset.modal)));
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

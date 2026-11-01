/* ============================================================
   fx.js — อนุภาคบรรยากาศบนแคนวาส: ละอองทอง กลีบดอกไม้ หิ่งห้อย
   ============================================================ */
(function () {
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let mode = "dust"; // dust | firefly | rain
  let running = true;
  let last = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function makeParticle(kind) {
    const x = Math.random() * W, y = Math.random() * H;
    if (kind === "firefly") {
      return { kind, x, y, r: 1.2 + Math.random() * 2.2, a: Math.random() * Math.PI * 2,
        sp: 0.15 + Math.random() * 0.35, ph: Math.random() * Math.PI * 2, blink: 0.5 + Math.random() * 1.5 };
    }
    if (kind === "petal") {
      return { kind, x, y: -20, r: 2.5 + Math.random() * 3.5, vy: 0.25 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.3, ph: Math.random() * Math.PI * 2, hue: 28 + Math.random() * 20 };
    }
    // dust
    return { kind: "dust", x, y, r: 0.8 + Math.random() * 1.8, vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.12, ph: Math.random() * Math.PI * 2 };
  }

  function setMode(m) {
    mode = m;
    particles = [];
    const n = m === "firefly" ? Math.min(70, W / 18) : m === "petal" ? Math.min(46, W / 26) : Math.min(60, W / 24);
    for (let i = 0; i < n; i++) particles.push(makeParticle(m === "firefly" ? "firefly" : m === "petal" ? "petal" : "dust"));
  }
  setMode("dust");

  function tick(t) {
    requestAnimationFrame(tick);
    if (!running) { last = t; return; }
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      p.ph += dt * 2;
      if (p.kind === "firefly") {
        p.a += (Math.random() - 0.5) * 0.4;
        p.x += Math.cos(p.a) * p.sp * 60 * dt * 0.4;
        p.y += Math.sin(p.a) * p.sp * 60 * dt * 0.3;
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
        const glow = (Math.sin(p.ph * p.blink) + 1) / 2;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 214, 120, ${0.12 + glow * 0.5})`;
        ctx.shadowColor = "rgba(255, 200, 90, .9)"; ctx.shadowBlur = 8 + glow * 10;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.kind === "petal") {
        p.y += p.vy * 60 * dt;
        p.x += (p.vx + Math.sin(p.ph) * 0.25) * 60 * dt;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.ph);
        ctx.fillStyle = `hsla(${p.hue}, 55%, 72%, .55)`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        const a = 0.1 + (Math.sin(p.ph) + 1) * 0.12;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 226, 160, ${a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  requestAnimationFrame(tick);

  // เอฟเฟกต์ฉลอง: กระดาษทองพุ่งกระจาย
  function burst(x, y) {
    const n = 26;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 240;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 1, hue: 40 + Math.random() * 15, r: 2 + Math.random() * 3 });
    }
    let lastB = performance.now();
    function step(t) {
      const dt = (t - lastB) / 1000; lastB = t;
      let alive = false;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive = true;
        p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = `hsl(${p.hue}, 75%, 60%)`;
        ctx.fillRect(p.x, p.y, p.r, p.r * 1.6);
        ctx.restore();
      }
      if (alive) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  window.FX = { setMode, burst, set running(v) { running = v; } };
})();

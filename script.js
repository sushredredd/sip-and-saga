/* ============================================================
   SIP & SAGA — script.js
   Vanilla JS. No libraries. rAF-driven canvases, FLIP detail,
   instant filters/search, Bartender's Slang translator.
   ============================================================ */
"use strict";

/* ---------- environment ---------- */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DPR = Math.min(devicePixelRatio || 1, 2);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

/* Pause any canvas loop when offscreen or tab hidden */
function loopWhenVisible(el, tick) {
  let running = false, raf = 0, last = 0, visible = false;
  const frame = (t) => {
    if (!running) return;
    const dt = Math.min((t - last) / 1000 || 0.016, 0.05);
    last = t; tick(dt, t / 1000);
    raf = requestAnimationFrame(frame);
  };
  const set = (v) => {
    visible = v;
    const should = visible && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; cancelAnimationFrame(raf); }
  };
  new IntersectionObserver((e) => set(e[0].isIntersecting), { threshold: 0.05 }).observe(el);
  document.addEventListener("visibilitychange", () => set(visible));
}

function fitCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w: r.width, h: r.height };
}

/* ============================================================
   1 · BARTENDER'S SLANG — the funny quantity translator
   ============================================================ */
const SLANG_ML = [
  [5,   "a whisper"],
  [10,  "a shy splash"],
  [15,  "one steady splash"],
  [20,  "a friendly splash"],
  [22.5,"a bartender's wink"],
  [30,  "one confident glug"],
  [45,  "a glug and a half"],
  [60,  "two generous glugs"],
  [75,  "two glugs and a wink"],
  [90,  "three honest glugs"],
  [100, "a small tumbler's worth"],
  [120, "half a chai glass"],
  [150, "most of a chai glass"],
  [180, "one full cutting glass"],
  [200, "a proper steel tumbler"],
  [240, "one brimming chai glass"],
  [250, "a hostel-mug pour"],
  [300, "a lassi-shop ladle"],
  [350, "a monsoon downpour"],
  [400, "two steel tumblers"],
  [500, "a jug-tilting commitment"],
];
const SLANG_T = {
  "1 tsp": "a polite spoon", "2 tsp": "two polite spoons", "1/2 tsp": "half a polite spoon",
  "1 tbsp": "one grandmother-approved spoon", "2 tbsp": "two grandmother-approved spoons",
  "1 pinch": "a pinch, like you mean it", "2 pinches": "two decisive pinches",
  "1": "one, obviously", "2": "a matching pair", "3": "a small crowd", "4": "a family pack",
  "1/2": "half — save the rest", "6": "six, no judgement", "8": "eight brave soldiers",
  "10-12": "a generous handful", "to top": "keep going till it looks right",
  "1 scoop": "one heroic scoop", "2 scoops": "two heroic scoops", "3 scoops": "three heroic scoops",
  "1 shot": "one confident shot", "1 dash": "a flick of the wrist", "2 dashes": "two flicks of the wrist",
  "3 dashes": "three flicks of the wrist", "1 wedge": "a cheerful wedge", "1 slice": "one photogenic slice",
  "1 sprig": "a proud little sprig", "1 stick": "one sturdy stick", "1 cup": "one honest cup", "2 cups": "two honest cups",
};
function mlToSlang(ml) {
  let best = SLANG_ML[0];
  for (const s of SLANG_ML) if (Math.abs(s[0] - ml) < Math.abs(best[0] - ml)) best = s;
  if (Math.abs(best[0] - ml) < 0.26 * best[0]) return best[1];
  return `${ml} ml (even the slang gave up)`;
}
function qtyText(q, slang) {
  if (typeof q === "number") return slang ? mlToSlang(q) : `${q} ml`;
  const s = String(q);
  if (!slang) return s;
  return SLANG_T[s] || s;
}
let slangOn = false;

/* ============================================================
   2 · AMBIENT DUST (fixed canvas, very light)
   ============================================================ */
(function dust() {
  const cv = $("#dust"), ctx = cv.getContext("2d");
  if (REDUCED) { cv.remove(); return; }
  let W = 0, H = 0;
  const N = innerWidth < 700 ? 22 : 42;
  const P = Array.from({ length: N }, () => ({
    x: Math.random(), y: Math.random(), r: rand(0.6, 2.1),
    vx: rand(-0.008, 0.008), vy: rand(-0.02, -0.004),
    a: rand(0.04, 0.16), ph: rand(0, 6.28),
  }));
  const size = () => { W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; };
  size(); addEventListener("resize", size, { passive: true });
  loopWhenVisible(cv, (dt, t) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      if (p.x < -0.02) p.x = 1.02; if (p.x > 1.02) p.x = -0.02;
      const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + p.ph);
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r * DPR, 0, 6.28318);
      ctx.fillStyle = `rgba(246,205,160,${(p.a * tw).toFixed(3)})`;
      ctx.fill();
    }
  });
})();

/* ============================================================
   3 · HERO — the cinematic pour loop
   State machine: idle → tilt → pour → garnish → admire → reset
   Bottle tilts, stream with slight wobble, glass fills with
   sloshing surface, ice bobs, bubbles rise, condensation beads,
   a lime wheel drops at the end. Loops forever.
   ============================================================ */
(function hero() {
  const cv = $("#pourCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const caption = $("#stageCaption");

  const AMBER = "#e89b4b", AMBER_D = "#c97a2c", PEACH = "#f6cda0";

  /* timeline (seconds) */
  const T_TILT = 1.4, T_POUR = 3.4, T_GARN = 1.1, T_ADMIRE = 2.6, T_RESET = 1.2;
  const TOTAL = T_TILT + T_POUR + T_GARN + T_ADMIRE + T_RESET;

  let time = REDUCED ? T_TILT + T_POUR + T_GARN + 0.5 : 0;   /* reduced motion: hold on the full glass */
  let fill = REDUCED ? 1 : 0;              /* 0..1 glass fill */
  let slosh = 0, sloshV = 0;               /* liquid surface spring */
  const bubbles = [];
  const beads = [];                        /* condensation */
  const splash = [];
  let garnishY = -1, garnishV = 0, garnishSettled = REDUCED;

  const easeIO = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeO = (t) => 1 - Math.pow(1 - t, 3);

  function phase() {
    if (time < T_TILT) return ["tilt", time / T_TILT];
    if (time < T_TILT + T_POUR) return ["pour", (time - T_TILT) / T_POUR];
    if (time < T_TILT + T_POUR + T_GARN) return ["garnish", (time - T_TILT - T_POUR) / T_GARN];
    if (time < TOTAL - T_RESET) return ["admire", (time - T_TILT - T_POUR - T_GARN) / T_ADMIRE];
    return ["reset", (time - (TOTAL - T_RESET)) / T_RESET];
  }
  const CAPS = { tilt: "the bottle leans in", pour: "a confident glug…", garnish: "lime, dropped from a height", admire: "let it settle", reset: "once more, with feeling" };

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  loopWhenVisible(cv, (dt, t) => {
    const { w: W, h: H } = fitCanvas(cv);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!REDUCED) time = (time + dt) % TOTAL;
    const [ph, k] = phase();
    if (caption && caption.dataset.p !== ph) { caption.dataset.p = ph; caption.textContent = CAPS[ph]; }

    /* layout */
    const cx = W * 0.5, floor = H * 0.82;
    const gw = Math.min(W * 0.34, 150), gh = gw * 1.18;      /* glass */
    const gx = cx - gw / 2, gy = floor - gh;
    const bw = gw * 0.52, bh = gh * 1.5;                      /* bottle */

    /* -------- state updates -------- */
    let tilt = 0, pouring = false;
    if (ph === "tilt") tilt = easeIO(k) * 1;
    else if (ph === "pour") { tilt = 1; pouring = k < 0.94; }
    else if (ph === "garnish" || ph === "admire") tilt = 1 - easeIO(Math.min(1, k * (ph === "garnish" ? 1.6 : 1)));
    else if (ph === "reset") { tilt = 0; }

    if (ph === "reset" && k > 0.5 && fill > 0) { fill = Math.max(0, fill - dt * 2.2); if (fill === 0) { garnishSettled = false; garnishY = -1; } }
    if (pouring) {
      fill = clamp(fill + dt / (T_POUR * 0.94), 0, 1);
      sloshV += (Math.sin(t * 13) * 3.2 + rand(-1, 1)) * dt;
      if (Math.random() < 0.5) bubbles.push({ x: rand(-0.3, 0.3), y: 0, r: rand(1, 2.6), v: rand(18, 40), a: 1 });
      if (Math.random() < 0.3) splash.push({ x: rand(-0.12, 0.12), y: 0, vx: rand(-30, 30), vy: rand(-60, -20), a: 1 });
    }
    /* liquid surface spring */
    sloshV += -slosh * 42 * dt - sloshV * 4.5 * dt;
    slosh += sloshV * dt;

    /* garnish drop */
    if (ph === "garnish" && garnishY < 0 && k > 0.15) { garnishY = gy - 60; garnishV = 30; }
    if (garnishY >= 0 && !garnishSettled) {
      garnishV += 560 * dt; garnishY += garnishV * dt;
      const surf = gy + gh * (1 - fill * 0.82) - 6;
      if (garnishY > surf) { garnishY = surf; garnishV *= -0.32; sloshV += 6; if (Math.abs(garnishV) < 12) garnishSettled = true;
        for (let i = 0; i < 5; i++) splash.push({ x: rand(-0.2, 0.2), y: 0, vx: rand(-50, 50), vy: rand(-90, -30), a: 1 });
      }
    }
    /* condensation grows while glass is cold+full */
    if (fill > 0.35 && beads.length < 26 && Math.random() < 0.1)
      beads.push({ x: rand(0.08, 0.92), y: rand(0.2, 0.85), r: rand(0.8, 2), a: 0, drip: Math.random() < 0.22 });
    for (const b of beads) { b.a = Math.min(1, b.a + dt * 0.7); if (b.drip) b.y = Math.min(0.95, b.y + dt * 0.02); }
    if (ph === "reset") beads.length = Math.max(0, beads.length - 1);

    /* -------- draw: back glow + table -------- */
    const glow = ctx.createRadialGradient(cx, gy + gh * 0.4, 10, cx, gy + gh * 0.4, W * 0.5);
    glow.addColorStop(0, "rgba(246,205,160,.16)"); glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(cx, floor + 8, gw * 0.95, 12, 0, 0, 6.28318); ctx.fill();
    ctx.strokeStyle = "rgba(246,205,160,.12)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * 0.08, floor + 20); ctx.lineTo(W * 0.92, floor + 20); ctx.stroke();

    /* -------- bottle -------- */
    const bpx = lerp(cx + gw * 0.9, cx + gw * 0.28, tilt);
    const bpy = lerp(gy - bh * 0.16, gy - bh * 0.5, tilt);
    const ang = lerp(0, -2.05, tilt);
    ctx.save(); ctx.translate(bpx, bpy); ctx.rotate(ang);
    /* body */
    const bg = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    bg.addColorStop(0, "#3a2a17"); bg.addColorStop(0.45, "#7a4d1e"); bg.addColorStop(0.55, "#a86d2e"); bg.addColorStop(1, "#2c1f10");
    ctx.fillStyle = bg;
    roundedRect(-bw / 2, -bh * 0.24, bw, bh * 0.72, bw * 0.16); ctx.fill();
    /* shoulder + neck */
    ctx.beginPath();
    ctx.moveTo(-bw / 2, -bh * 0.24); ctx.quadraticCurveTo(-bw * 0.12, -bh * 0.4, -bw * 0.12, -bh * 0.46);
    ctx.lineTo(-bw * 0.12, -bh * 0.62); ctx.lineTo(bw * 0.12, -bh * 0.62); ctx.lineTo(bw * 0.12, -bh * 0.46);
    ctx.quadraticCurveTo(bw * 0.12, -bh * 0.4, bw / 2, -bh * 0.24); ctx.closePath(); ctx.fill();
    /* liquid inside bottle (drains as glass fills) */
    ctx.save(); roundedRect(-bw / 2 + 3, -bh * 0.24 + 3, bw - 6, bh * 0.72 - 6, bw * 0.13); ctx.clip();
    ctx.fillStyle = "rgba(232,155,75,.75)";
    const inLevel = lerp(-bh * 0.1, bh * 0.35, fill);
    ctx.fillRect(-bw / 2, inLevel, bw, bh); ctx.restore();
    /* label + shine */
    ctx.fillStyle = "rgba(242,235,221,.9)"; roundedRect(-bw * 0.34, -bh * 0.06, bw * 0.68, bh * 0.3, 4); ctx.fill();
    ctx.fillStyle = "#2a1708"; ctx.font = `italic ${Math.max(9, bw * 0.15)}px Fraunces, serif`; ctx.textAlign = "center";
    ctx.fillText("saga", 0, bh * 0.1); ctx.font = `${Math.max(6, bw * 0.08)}px Karla, sans-serif`; ctx.fillText("· house pour ·", 0, bh * 0.17);
    ctx.fillStyle = "rgba(255,255,255,.16)"; roundedRect(-bw * 0.38, -bh * 0.2, bw * 0.1, bh * 0.6, 5); ctx.fill();
    /* cap */
    ctx.fillStyle = PEACH; roundedRect(-bw * 0.13, -bh * 0.68, bw * 0.26, bh * 0.07, 2); ctx.fill();
    /* mouth position for stream */
    const mouth = { x: 0, y: -bh * 0.66 };
    const mAbs = { x: bpx + mouth.x * Math.cos(ang) - mouth.y * Math.sin(ang), y: bpy + mouth.x * Math.sin(ang) + mouth.y * Math.cos(ang) };
    ctx.restore();

    /* -------- pour stream -------- */
    const surfY = gy + gh * (1 - fill * 0.82) - 4;
    if (pouring) {
      const sway = Math.sin(t * 21) * 1.6;
      const grad = ctx.createLinearGradient(0, mAbs.y, 0, surfY);
      grad.addColorStop(0, "rgba(246,205,160,.95)"); grad.addColorStop(1, "rgba(232,155,75,.85)");
      ctx.strokeStyle = grad; ctx.lineCap = "round";
      const wStream = lerp(2.2, 4.6, Math.min(1, k * 6)) * (k > 0.85 ? (0.94 - k) * 11 : 1);
      ctx.lineWidth = Math.max(0.8, wStream);
      ctx.beginPath(); ctx.moveTo(mAbs.x, mAbs.y);
      ctx.bezierCurveTo(mAbs.x + 6 + sway, lerp(mAbs.y, surfY, 0.3), cx + sway, lerp(mAbs.y, surfY, 0.7), cx + sway * 0.4, surfY);
      ctx.stroke();
      /* impact glow */
      ctx.fillStyle = "rgba(246,205,160,.35)";
      ctx.beginPath(); ctx.ellipse(cx + sway * 0.4, surfY, 7, 2.6, 0, 0, 6.28318); ctx.fill();
    }

    /* -------- glass -------- */
    ctx.save();
    /* clip to glass interior for liquid */
    const gInner = () => { ctx.beginPath(); ctx.moveTo(gx + 6, gy + 4); ctx.lineTo(gx + gw - 6, gy + 4); ctx.lineTo(gx + gw - 12, gy + gh - 5); ctx.lineTo(gx + 12, gy + gh - 5); ctx.closePath(); };
    gInner(); ctx.clip();
    if (fill > 0.01) {
      const lv = gy + gh * (1 - fill * 0.82);
      const lg = ctx.createLinearGradient(0, lv, 0, gy + gh);
      lg.addColorStop(0, "rgba(246,205,160,.92)"); lg.addColorStop(0.25, AMBER); lg.addColorStop(1, AMBER_D);
      ctx.fillStyle = lg;
      ctx.beginPath();
      const s1 = slosh * 2.4, s2 = -slosh * 2.4;
      ctx.moveTo(gx, lv + s1);
      ctx.quadraticCurveTo(cx, lv - (s1 + s2) * 0.8 + Math.sin(t * 3) * (pouring ? 1.6 : 0.5), gx + gw, lv + s2);
      ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx, gy + gh); ctx.closePath(); ctx.fill();
      /* surface sheen */
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(gx + 4, lv + s1);
      ctx.quadraticCurveTo(cx, lv - (s1 + s2) * 0.8, gx + gw - 4, lv + s2); ctx.stroke();

      /* ice cubes bobbing */
      for (let i = 0; i < 2; i++) {
        const ix = cx + (i ? gw * 0.18 : -gw * 0.16) + Math.sin(t * 1.4 + i * 2) * 2;
        const iy = lv + 10 + i * 14 + Math.sin(t * 1.9 + i) * 2 + slosh * (i ? -2 : 2);
        if (fill > 0.22 + i * 0.18) {
          ctx.save(); ctx.translate(ix, iy); ctx.rotate(Math.sin(t * 0.8 + i * 3) * 0.16 + i);
          ctx.fillStyle = "rgba(255,255,255,.34)"; roundedRect(-11, -11, 22, 22, 5); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1; roundedRect(-11, -11, 22, 22, 5); ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.5)"; roundedRect(-8, -8, 7, 5, 2); ctx.fill();
          ctx.restore();
        }
      }
      /* bubbles */
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]; b.y += b.v * dt; b.a -= dt * 0.5;
        const bx = cx + b.x * gw * 0.8 + Math.sin(t * 4 + i) * 2, by = gy + gh - 8 - b.y;
        if (by < lv + 4 || b.a <= 0) { bubbles.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(bx, by, b.r, 0, 6.28318);
        ctx.strokeStyle = `rgba(255,255,255,${(0.5 * b.a).toFixed(2)})`; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    ctx.restore();

    /* splash droplets (above surface, outside clip) */
    for (let i = splash.length - 1; i >= 0; i--) {
      const s = splash[i]; s.vy += 500 * dt; s.x += s.vx * dt / gw; s.y += s.vy * dt; s.a -= dt * 1.8;
      if (s.a <= 0) { splash.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(246,205,160,${s.a.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(cx + s.x * gw, surfY - 2 + s.y * 0.2, 1.7, 0, 6.28318); ctx.fill();
    }

    /* glass walls (drawn over liquid) */
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 10, gy + gh); ctx.lineTo(gx + gw - 10, gy + gh); ctx.lineTo(gx + gw - 2, gy); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(gx + 6, gy + 8); ctx.lineTo(gx + 12, gy + gh - 8); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(cx, gy, gw / 2 - 1, 5, 0, 0, 6.28318); ctx.stroke();
    /* condensation beads */
    for (const b of beads) {
      ctx.beginPath(); ctx.arc(gx + b.x * gw, gy + b.y * gh, b.r, 0, 6.28318);
      ctx.fillStyle = `rgba(255,255,255,${(0.34 * b.a).toFixed(2)})`; ctx.fill();
    }

    /* garnish — lime wheel */
    if (garnishY >= 0) {
      ctx.save(); ctx.translate(cx + gw * 0.22, garnishY); ctx.rotate(garnishSettled ? 0.5 : t * 3);
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.28318); ctx.fillStyle = "#b9d77e"; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.28318); ctx.strokeStyle = "#5d7c33"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = "rgba(93,124,51,.7)"; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 1.047) * 10, Math.sin(i * 1.047) * 10); ctx.stroke(); }
      ctx.restore();
    }
  });
})();

/* ============================================================
   4 · LIBRARY — chips, search, grid, lazy images
   ============================================================ */
const CATS = ["Cocktails","Mocktails","Under 5 Minutes","Under ₹200","Party","Wedding","Summer","Winter","Festival","Kids","Coffee","Tea","Healthy","Sugar-Free","Protein","Indian","Bomb Shots","Layered Shots","Smoothies","Milkshakes","Classic","Street","Premium"];
const TASTES = ["Sweet","Sour","Strong","Refreshing","Fruity","Spicy","Creamy","Bitter"];
const activeCats = new Set(), activeTastes = new Set();
let query = "";

function drinkMatches(d) {
  for (const c of activeCats) {
    if (c === "Under 5 Minutes") { if (d.min > 5) return false; }
    else if (c === "Under ₹200") { if (d.price >= 200) return false; }
    else if (!d.c.includes(c)) return false;
  }
  for (const t of activeTastes) if (!d.t.includes(t)) return false;
  if (query) {
    const hay = d._hay || (d._hay = (d.n + " " + d.c.join(" ") + " " + d.t.join(" ") + " " + d.g + " " + d.gar + " " + d.i.map(i => i[1]).join(" ") + " " + d.de + " " + d.s).toLowerCase());
    for (const w of query.split(/\s+/)) if (w && !hay.includes(w)) return false;
  }
  return true;
}

const io = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) {
    const img = e.target.querySelector("img[data-src]");
    if (img) { img.src = img.dataset.src; img.removeAttribute("data-src"); img.onload = () => img.classList.add("ld"); }
    e.target.classList.add("in");
    io.unobserve(e.target);
  }
}, { rootMargin: "220px" });

const ICON_CLOCK = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_FLAME = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 3c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1.4-.8-2.4-.8-2.4C17 10 19 12 19 15a7 7 0 1 1-14 0c0-5 5-7 7-12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

function cardHTML(d) {
  const alc = d.abv > 0;
  return `<article class="card" data-id="${d.id}" tabindex="0" role="button" aria-label="Open recipe: ${d.n}">
    <div class="card-media">
      <span class="badge ${alc ? "alc" : "zero"}">${alc ? d.abv + "% abv" : "zero proof"}</span>
      <img data-src="${d.img}" alt="${d.n} in a ${d.g}" loading="lazy" decoding="async" referrerpolicy="no-referrer"
           onerror="this.onerror=null;this.style.background='linear-gradient(160deg,#2c1d3e,#221632)';this.removeAttribute('src');this.classList.add('ld')">
      <span class="bubbles" aria-hidden="true"><b></b><b></b><b></b><b></b></span>
    </div>
    <div class="card-body">
      <h3>${d.n}</h3>
      <div class="card-meta">
        <span>${ICON_CLOCK}${d.min} min</span>
        <span>${ICON_FLAME}${d.kcal} kcal</span>
        <span>₹${d.price}</span>
      </div>
      <div class="tags">${d.t.slice(0, 3).map(t => `<span class="tag t">${t}</span>`).join("")}${d.c.slice(0, 2).map(c => `<span class="tag">${c}</span>`).join("")}</div>
    </div>
  </article>`;
}

function renderGrid() {
  const grid = $("#grid"), empty = $("#empty"), count = $("#count");
  const list = DRINKS.filter(drinkMatches);
  count.textContent = `${list.length} of ${DRINKS.length} drinks on the shelf`;
  empty.hidden = list.length > 0;
  grid.innerHTML = list.map(cardHTML).join("");
  $$(".card", grid).forEach((c) => io.observe(c));
}

function makeChips(host, names, set, showCounts) {
  host.innerHTML = names.map((n) => `<button class="chip" type="button" aria-pressed="false" data-v="${n}">${n}</button>`).join("");
  host.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    const v = b.dataset.v, on = set.has(v);
    on ? set.delete(v) : set.add(v);
    b.setAttribute("aria-pressed", String(!on));
    renderGrid();
  });
}

/* ============================================================
   5 · DETAIL — FLIP expansion + staged recipe playback
   ============================================================ */
const overlay = document.createElement("div");
overlay.className = "overlay";
overlay.innerHTML = `<div class="overlay-bg"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-inner"></div></div>`;
document.body.appendChild(overlay);
const sheetInner = $(".sheet-inner", overlay);
let lastCard = null, openId = null, revealTimers = [];

function affLink(q) { return `https://www.amazon.in/s?k=${encodeURIComponent(q)}&tag=sipandsaga-21`; }

function sheetHTML(d) {
  const alc = d.abv > 0;
  return `
  <div class="sheet-hero">
    <img src="${d.img}" alt="${d.n}" referrerpolicy="no-referrer">
    <button class="close" type="button" aria-label="Close recipe">×</button>
    <canvas id="miniPour" width="120" height="150" aria-hidden="true"></canvas>
    <div class="sheet-title">
      <p class="cat-line">${d.c.slice(0, 3).join(" · ")} · ${alc ? d.abv + "% ABV" : "Zero proof"}</p>
      <h2>${d.n}</h2>
    </div>
  </div>
  <div class="sheet-body">
    <p class="sheet-desc reveal">${d.de}</p>
    <div class="facts reveal">
      <div class="fact"><b>${d.min} min</b><span>time</span></div>
      <div class="fact"><b>${d.d}</b><span>difficulty</span></div>
      <div class="fact"><b>${d.kcal}</b><span>kcal est.</span></div>
      <div class="fact"><b>${alc ? d.abv + "%" : "0%"}</b><span>abv</span></div>
      <div class="fact"><b>₹${d.price}</b><span>per glass est.</span></div>
      <div class="fact"><b>${d.g}</b><span>glass</span></div>
    </div>
    <div class="sheet-cols">
      <div>
        <h3>Ingredients</h3>
        <ul class="ing-list">${d.i.map((i) => `<li><span class="qty ${slangOn ? "slang" : ""}" data-q='${JSON.stringify(i[0])}'>${qtyText(i[0], slangOn)}</span><span>${i[1]}</span></li>`).join("")}</ul>
        <p class="aff-note" style="margin-top:.9rem">Garnish: ${d.gar} · Serve: ${d.s}</p>
      </div>
      <div>
        <h3>The build</h3>
        <div class="pour-progress" aria-hidden="true"><i></i></div>
        <ol class="steps">${d.st.map((s) => `<li>${s}</li>`).join("")}</ol>
      </div>
    </div>
    <div class="lore reveal">
      <article><h4>The story</h4><p>${d.h}</p></article>
      <article><h4>Pairs with</h4><p>${d.p}</p></article>
      <article><h4>Make it yours</h4><p>${d.v}</p></article>
    </div>
    <div class="aff reveal">
      <h3>Stock the bar for this one</h3>
      <div class="aff-row">${d.aff.map((a) => `<a class="aff-link" href="${affLink(a)}" target="_blank" rel="noopener sponsored">🛒 ${a}</a>`).join("")}</div>
      <p class="aff-note">Links open Amazon.in searches. As an Amazon Associate, Sip &amp; Saga may earn from qualifying purchases.</p>
    </div>
  </div>`;
}

/* Mini pour canvas inside detail hero — fills with the drink's colour */
function miniPour(color) {
  const cv = $("#miniPour", overlay); if (!cv) return;
  const ctx = cv.getContext("2d");
  let fill = 0, tSt = performance.now();
  const draw = () => {
    if (!overlay.classList.contains("open")) return;
    const t = (performance.now() - tSt) / 1000;
    fill = REDUCED ? 1 : Math.min(1, t / 2.4);
    ctx.clearRect(0, 0, 120, 150);
    const gx = 26, gy = 20, gw = 68, gh = 108;
    /* stream */
    if (fill < 1 && !REDUCED) {
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.moveTo(60 + Math.sin(t * 18) * 1.2, 0); ctx.lineTo(60, gy + gh * (1 - fill * 0.8)); ctx.stroke(); ctx.globalAlpha = 1;
    }
    /* liquid */
    ctx.save();
    ctx.beginPath(); ctx.moveTo(gx + 3, gy + 2); ctx.lineTo(gx + gw - 3, gy + 2); ctx.lineTo(gx + gw - 9, gy + gh - 3); ctx.lineTo(gx + 9, gy + gh - 3); ctx.closePath(); ctx.clip();
    const lv = gy + gh * (1 - fill * 0.8);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(gx, lv + Math.sin(t * 5) * 1.5);
    ctx.quadraticCurveTo(gx + gw / 2, lv - Math.sin(t * 5) * 2, gx + gw, lv + Math.sin(t * 5 + 2) * 1.5);
    ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx, gy + gh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(gx + 6, lv, gw - 12, 2);
    ctx.restore();
    /* glass */
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 8, gy + gh); ctx.lineTo(gx + gw - 8, gy + gh); ctx.lineTo(gx + gw, gy); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(gx + gw / 2, gy, gw / 2, 4, 0, 0, 6.28318); ctx.stroke();
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

function stageReveals() {
  revealTimers.forEach(clearTimeout); revealTimers = [];
  const push = (fn, ms) => revealTimers.push(setTimeout(fn, REDUCED ? 0 : ms));
  $$(".reveal", sheetInner).forEach((el, i) => push(() => el.classList.add("in"), 120 + i * 160));
  $$(".ing-list li", sheetInner).forEach((el, i) => push(() => el.classList.add("in"), 300 + i * 90));
  const steps = $$(".steps li", sheetInner);
  const bar = $(".pour-progress i", sheetInner);
  steps.forEach((el, i) => push(() => {
    el.classList.add("in");
    if (bar) bar.style.width = `${((i + 1) / steps.length) * 100}%`;
  }, 650 + i * 560));
}

function openDetail(card) {
  const d = DRINKS.find((x) => x.id === +card.dataset.id); if (!d) return;
  openId = d.id; lastCard = card;
  sheetInner.innerHTML = sheetHTML(d);
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  $(".sheet", overlay).scrollTop = 0;

  /* FLIP: fly a ghost of the card image to the sheet hero */
  const media = $(".card-media", card);
  const heroImg = $(".sheet-hero", sheetInner);
  if (!REDUCED && media) {
    const a = media.getBoundingClientRect();
    requestAnimationFrame(() => {
      const b = heroImg.getBoundingClientRect();
      const ghost = document.createElement("div");
      ghost.className = "flip-ghost";
      ghost.innerHTML = `<img src="${$("img", media).src}" alt="">`;
      Object.assign(ghost.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
      document.body.appendChild(ghost);
      heroImg.style.visibility = "hidden";
      ghost.animate([
        { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", borderRadius: "22px" },
        { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px", borderRadius: "26px 26px 0 0" },
      ], { duration: 520, easing: "cubic-bezier(.2,.9,.25,1)", fill: "forwards" }).onfinish = () => {
        heroImg.style.visibility = ""; ghost.remove();
      };
    });
  }
  miniPour(d.col);
  stageReveals();
  $(".close", sheetInner).focus({ preventScroll: true });
}

function closeDetail() {
  if (!overlay.classList.contains("open")) return;
  revealTimers.forEach(clearTimeout);
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  if (lastCard) lastCard.focus({ preventScroll: true });
  openId = null;
}

overlay.addEventListener("click", (e) => {
  if (e.target.closest(".close") || e.target.classList.contains("overlay-bg") || e.target.classList.contains("sheet")) closeDetail();
});
addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

/* ============================================================
   6 · BOMB LAB — shot glass drop, splash, foam, loop
   ============================================================ */
(function bombLab() {
  const cv = $("#bombCanvas"); if (!cv) return;
  const ctx = cv.getContext("2d");
  const chipsHost = $("#bombChips"), note = $("#bombNote"), openBtn = $("#bombOpen");
  const bombs = DRINKS.filter((d) => d.c.includes("Bomb Shots"));
  let cur = bombs[0];

  chipsHost.innerHTML = bombs.map((b, i) => `<button class="chip" type="button" aria-pressed="${i === 0}" data-id="${b.id}">${b.n}</button>`).join("");
  const setNote = () => { note.textContent = `“${cur.de}”`; };
  setNote();
  chipsHost.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    $$(".chip", chipsHost).forEach((c) => c.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", "true");
    cur = bombs.find((x) => x.id === +b.dataset.id); setNote(); time = 0; foam = 0; drops.length = 0;
  });
  openBtn.addEventListener("click", () => {
    const card = $(`.card[data-id="${cur.id}"]`);
    openDetail(card || Object.assign(document.createElement("div"), { dataset: { id: cur.id } }));
  });

  /* loop: hover(1.2) → drop(0.5) → splash/settle(2.6) → reset(0.8) */
  const T1 = 1.2, T2 = 0.5, T3 = 2.6, T4 = 0.8, TOT = T1 + T2 + T3 + T4;
  let time = REDUCED ? T1 + T2 + 0.2 : 0, foam = 0;
  const drops = [];
  const easeIn = (t) => t * t;

  loopWhenVisible(cv, (dt, t) => {
    const { w: W, h: H } = fitCanvas(cv);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!REDUCED) time = (time + dt) % TOT;

    const cx = W / 2, floor = H * 0.86;
    const gw = Math.min(W * 0.42, 190), gh = gw * 1.05, gx = cx - gw / 2, gy = floor - gh;
    const baseCol = cur.col || "#e8b64b";
    const shotCol = "#6b4522";

    /* phase */
    let shotY, inGlass = false, splashK = 0;
    const hoverY = gy - 70;
    const surf0 = gy + gh * 0.42;
    if (time < T1) shotY = hoverY + Math.sin(t * 2.2) * 5;
    else if (time < T1 + T2) { const k = easeIn((time - T1) / T2); shotY = lerp(hoverY, surf0 + 26, k); if (k > 0.93) inGlass = true; }
    else if (time < T1 + T2 + T3) { inGlass = true; shotY = surf0 + 26 + Math.sin((time - T1 - T2) * 3) * 2; splashK = 1 - Math.min(1, (time - T1 - T2) / 0.7); }
    else { inGlass = true; shotY = surf0 + 26; }
    const resetK = time > TOT - T4 ? (time - (TOT - T4)) / T4 : 0;

    if (splashK > 0.85 && drops.length < 26)
      for (let i = 0; i < 8; i++) drops.push({ x: rand(-0.4, 0.4), y: 0, vx: rand(-90, 90), vy: rand(-180, -60), a: 1 });
    foam = inGlass ? Math.min(1, foam + dt * 1.6) : Math.max(0, foam - dt * 2);
    if (resetK > 0) foam *= 1 - resetK;

    /* glow + table */
    const glow = ctx.createRadialGradient(cx, gy + gh / 2, 8, cx, gy + gh / 2, W * 0.45);
    glow.addColorStop(0, "rgba(232,155,75,.13)"); glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.beginPath(); ctx.ellipse(cx, floor + 7, gw * 0.8, 10, 0, 0, 6.28318); ctx.fill();

    /* pint glass + base liquid */
    ctx.save();
    ctx.beginPath(); ctx.moveTo(gx + 6, gy + 3); ctx.lineTo(gx + gw - 6, gy + 3); ctx.lineTo(gx + gw - 16, gy + gh - 4); ctx.lineTo(gx + 16, gy + gh - 4); ctx.closePath(); ctx.clip();
    const lg = ctx.createLinearGradient(0, surf0, 0, gy + gh);
    lg.addColorStop(0, baseCol); lg.addColorStop(1, "#1c1210");
    ctx.fillStyle = lg;
    const wob = Math.sin(t * 5) * (inGlass ? 2.5 : 0.8);
    ctx.beginPath();
    ctx.moveTo(gx, surf0 + wob);
    ctx.quadraticCurveTo(cx, surf0 - wob * 1.6, gx + gw, surf0 + wob);
    ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx, gy + gh); ctx.closePath(); ctx.fill();
    /* rising bubbles when detonated */
    if (inGlass) for (let i = 0; i < 12; i++) {
      const bx = gx + 20 + ((i * 53) % (gw - 40)), byy = gy + gh - ((t * 55 + i * 41) % (gy + gh - surf0 - 6));
      ctx.beginPath(); ctx.arc(bx, byy, 1.6 + (i % 3) * 0.7, 0, 6.28318);
      ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1; ctx.stroke();
    }
    /* foam head */
    if (foam > 0.02) {
      ctx.fillStyle = `rgba(246,238,222,${(0.85 * foam).toFixed(2)})`;
      for (let i = 0; i < 9; i++) {
        const fx = gx + 10 + (i / 8) * (gw - 20);
        ctx.beginPath(); ctx.arc(fx, surf0 + wob - 5 * foam + Math.sin(i * 2.7 + t * 2) * 2, 9 * foam + (i % 3) * 2, 0, 6.28318); ctx.fill();
      }
    }
    /* shot glass inside */
    if (shotY > gy) {
      ctx.save(); ctx.translate(cx, shotY); ctx.rotate(inGlass ? 0.35 + Math.sin(t * 2) * 0.05 : Math.sin(t * 3) * 0.06);
      ctx.fillStyle = shotCol; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.moveTo(-15, -20); ctx.lineTo(15, -20); ctx.lineTo(10, 16); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(16, -22); ctx.lineTo(11, 18); ctx.lineTo(-11, 18); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    /* shot glass above rim (unclipped) */
    if (shotY <= gy) {
      ctx.save(); ctx.translate(cx, shotY); ctx.rotate(Math.sin(t * 3) * 0.06);
      ctx.fillStyle = shotCol;
      ctx.beginPath(); ctx.moveTo(-15, -20); ctx.lineTo(15, -20); ctx.lineTo(10, 16); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(16, -22); ctx.lineTo(11, 18); ctx.lineTo(-11, 18); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }

    /* splash droplets */
    for (let i = drops.length - 1; i >= 0; i--) {
      const s = drops[i]; s.vy += 620 * dt; s.x += (s.vx * dt) / gw; s.y += s.vy * dt; s.a -= dt * 1.4;
      if (s.a <= 0) { drops.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(246,222,180,${s.a.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(cx + s.x * gw, surf0 + s.y * 0.25, 2, 0, 6.28318); ctx.fill();
    }

    /* glass outline over everything */
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 14, gy + gh); ctx.lineTo(gx + gw - 14, gy + gh); ctx.lineTo(gx + gw - 2, gy); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, gy, gw / 2 - 1, 5.5, 0, 0, 6.28318); ctx.stroke();
  });
})();

/* ============================================================
   7 · BAR SHELF — affiliate cards
   ============================================================ */
(function shelf() {
  const items = [
    ["🥃", "Boston Shaker Set", "Two-piece weighted tins — the only shaker that survives a house party.", "boston shaker set steel"],
    ["🥄", "Bar Spoon & Jigger", "A 30/60 ml jigger and a long twisted spoon: the entire measurement department.", "bar spoon jigger set"],
    ["🧊", "Large Ice Cube Trays", "2-inch cubes melt slower — your Old Fashioned stays a drink, not a soup.", "large ice cube tray whiskey"],
    ["🍋", "Citrus Press", "One squeeze, all the juice, none of the seeds. Mojito season essential.", "citrus press juicer manual"],
    ["🫗", "Muddler & Strainer", "For mint, kokum and every chaat-masala experiment you're about to have.", "cocktail muddler hawthorne strainer"],
    ["🏺", "Copper Serving Mugs", "For jaljeera, mules and looking suspiciously professional at 6 pm.", "copper mug set moscow mule"],
  ];
  $("#shelfGrid").innerHTML = items.map(([ico, t, p, q]) =>
    `<a class="shelf-card" href="${affLink(q)}" target="_blank" rel="noopener sponsored">
      <span class="s-ico">${ico}</span><h3>${t}</h3><p>${p}</p><span class="s-cta">Find on Amazon.in →</span>
    </a>`).join("");
})();

/* ============================================================
   8 · WIRING
   ============================================================ */
function refreshSlangInSheet() {
  $$(".ing-list .qty", sheetInner).forEach((el) => {
    const q = JSON.parse(el.dataset.q);
    el.textContent = qtyText(q, slangOn);
    el.classList.toggle("slang", slangOn);
  });
}
$("#slangToggle").addEventListener("change", (e) => { slangOn = e.target.checked; refreshSlangInSheet(); });
$("#slangHint").addEventListener("click", () => {
  const tgl = $("#slangToggle"); tgl.checked = !tgl.checked; tgl.dispatchEvent(new Event("change"));
  tgl.closest(".slang-toggle").animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
});

const grid = $("#grid");
grid.addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openDetail(c); });
grid.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { const c = e.target.closest(".card"); if (c) { e.preventDefault(); openDetail(c); } }
});

const search = $("#search"), clearBtn = $("#clearSearch");
let debounce = 0;
search.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    query = search.value.trim().toLowerCase();
    clearBtn.hidden = !query;
    renderGrid();
  }, 90);
});
clearBtn.addEventListener("click", () => { search.value = ""; query = ""; clearBtn.hidden = true; renderGrid(); search.focus(); });

/* ribbon: duplicate content for seamless loop */
const track = $("#ribbonTrack");
track.innerHTML += track.innerHTML;

$("#yr").textContent = new Date().getFullYear();

makeChips($("#catChips"), CATS, activeCats);
makeChips($("#tasteChips"), TASTES, activeTastes);
renderGrid();

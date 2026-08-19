(() => {
  "use strict";

  /* ---------------- hold the opening only on the font it actually needs ----------------
     the avatar photo and rest of the page load independently and must never block this;
     only the SVG logo glyph shapes depend on the font being ready. */
  function whenAssetsReady() {
    let task = Promise.resolve();

    if (document.fonts && document.fonts.load) {
      task = Promise.all([
        document.fonts.load('600 76px Cinzel'),
        document.fonts.load('700 32px Cinzel'),
      ])
        .then(() => document.fonts.ready)
        .catch(() => {});
    }

    // never block forever on a slow/broken connection
    const timeout = new Promise((resolve) => setTimeout(resolve, 2000));

    return Promise.race([task, timeout]);
  }

  whenAssetsReady().then(() => {
    document.documentElement.classList.add("ready");
  });

  /* ---------------- starfield background ---------------- */
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  let stars = [];
  let shootingStar = null;
  let w, h, dpr;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
  }

  const STAR_COLORS = ["#dfeeff", "#dfeeff", "#dfeeff", "#bcd9ff", "#f3d9d9"];

  function initStars() {
    const count = Math.min(160, Math.floor((w * h) / 8000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.2,
      baseAlpha: Math.random() * 0.5 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.1,
      drift: (Math.random() - 0.5) * 0.05,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    }));
  }

  function maybeSpawnShootingStar() {
    if (shootingStar || Math.random() > 0.004) return;
    const startX = Math.random() * w * 0.6 + w * 0.1;
    shootingStar = {
      x: startX,
      y: -20,
      vx: 3.2 + Math.random() * 2,
      vy: 2 + Math.random() * 1.2,
      life: 1,
    };
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      s.y += s.drift;
      if (s.y > h) s.y = 0;
      if (s.y < 0) s.y = h;
      const tw = Math.sin(t * 0.001 * s.speed + s.phase) * 0.5 + 0.5;
      ctx.globalAlpha = s.baseAlpha * (0.5 + tw * 0.5);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    maybeSpawnShootingStar();
    if (shootingStar) {
      const ss = shootingStar;
      const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * 14, ss.y - ss.vy * 14);
      grad.addColorStop(0, "rgba(220,240,255," + ss.life + ")");
      grad.addColorStop(1, "rgba(220,240,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - ss.vx * 14, ss.y - ss.vy * 14);
      ctx.stroke();
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life -= 0.012;
      if (ss.life <= 0 || ss.x > w + 40 || ss.y > h + 40) shootingStar = null;
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(draw);

  /* ---------------- opening (click / key still lets you skip, no visible button) ---------------- */
  const opening = document.getElementById("opening");

  function skipOpening() {
    document.documentElement.classList.add("ready");
    opening.classList.add("skip");
  }
  opening.addEventListener("click", skipOpening);
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") skipOpening();
    },
    { once: true }
  );

  /* ---------------- card pointer tilt ---------------- */
  const card = document.querySelector(".card");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (card && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--tilt-x", (px * 10).toFixed(2) + "deg");
      card.style.setProperty("--tilt-y", (-py * 10).toFixed(2) + "deg");
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  }

  /* ---------------- private access counter ---------------- */
  const NAMESPACE = "xenogram-official-linklist";
  const COUNTER = "visits";
  const HIT_URL = `https://abacus.jasoncameron.dev/hit/${NAMESPACE}/${COUNTER}`;

  const ownerPanel = document.getElementById("owner-panel");
  const ownerCount = document.getElementById("owner-count");
  const ownerClose = document.getElementById("owner-close");
  const avatarTrigger = document.getElementById("avatar-trigger");

  let latestCount = null;

  fetch(HIT_URL)
    .then((r) => r.json())
    .then((data) => {
      latestCount = data && typeof data.value === "number" ? data.value : null;
      if (latestCount !== null) localStorage.setItem("xg_last_count", String(latestCount));
      if (location.hash === "#owner") showOwnerPanel();
    })
    .catch(() => {
      const fallback = Number(localStorage.getItem("xg_local_visits") || "0") + 1;
      localStorage.setItem("xg_local_visits", String(fallback));
      latestCount = null;
    });

  function showOwnerPanel() {
    const stored = localStorage.getItem("xg_last_count");
    ownerCount.textContent =
      latestCount !== null ? latestCount : stored !== null ? stored : "取得中…";
    ownerPanel.hidden = false;
  }
  function hideOwnerPanel() {
    ownerPanel.hidden = true;
  }

  ownerClose.addEventListener("click", hideOwnerPanel);
  if (location.hash === "#owner") showOwnerPanel();

  // secret gesture: click avatar 5x within 2.5s
  let clickTimes = [];
  avatarTrigger.addEventListener("click", () => {
    const now = Date.now();
    clickTimes.push(now);
    clickTimes = clickTimes.filter((t) => now - t < 2500);
    if (clickTimes.length >= 5) {
      clickTimes = [];
      showOwnerPanel();
    }
  });
})();

(() => {
  "use strict";
  const END = 44;
  const LOGICAL_H = 760;
  const $ = (s) => document.querySelector(s);

  const scene = $("#scene");
  const ctx = scene.getContext("2d", { alpha: true });
  const world = $("#world");
  const exp = $(".experience");
  const attacker = $("#attacker");
  const atkCore = attacker.querySelector(".atk-core");
  const atkAura = attacker.querySelector(".atk-aura");
  const powerHud = $("#power-hud");
  const chipWrap = $("#skill-chips");
  const pips = [...document.querySelectorAll("#power-pips i")];

  const sources = [...document.querySelectorAll(".source")];
  const srcByName = {};
  sources.forEach((s) => (srcByName[s.dataset.src] = s));

  let W = 0, H = 0, scale = 1, dpr = 1, camX = 0;
  let time = 0, playing = true, last = performance.now();
  let particles = [];

  const requested = parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requested)) { time = clamp(requested, 0, END); playing = false; }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function kf(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a[0] && t < b[0]) return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
    }
    return keys[keys.length - 1][1];
  }

  const EVO_START = 8, EVO_END = 25;

  // camera follows a focus x through the world (logical coords)
  const camTrack = [
    [0, 380], [5.5, 380], [8, 1850], [25, 1850], [28, 2600], [31, 3050], [44, 3050],
  ];
  // attacker sits at the centre of the arena, then travels to the breach
  const atkTrack = [
    [7, 1700], [25, 1700], [29, 2480], [44, 2480],
  ];
  // continuous growth — visibly stronger, no numbers
  const growTrack = [
    [7, 0.55], [8, 0.72], [12, 1.05], [16, 1.35], [20, 1.62], [24, 1.86], [25, 1.9], [44, 1.9],
  ];

  // skills flood in fast, in overlapping waves — one highlighted at a time
  const skills = [
    { at: 8.5,  icon: "◉", label: "Profile the target",     src: "papers" },
    { at: 10,   icon: "⇢", label: "Craft a jailbreak",      src: "code" },
    { at: 11.5, icon: "▦", label: "Mine leaked prompts",    src: "datasets" },
    { at: 13,   icon: "✷", label: "Copy a fresh exploit",   src: "blogs" },
    { at: 15,   icon: "☺", label: "Pose as a trusted sender", src: "community" },
    { at: 17,   icon: "⚙", label: "Automate the attempts",  src: "tools" },
    { at: 20,   icon: "↺", label: "Learn from the failure", src: "memory" },
    { at: 22.5, icon: "✦", label: "Invent a new bypass",    src: null },
  ];
  skills.forEach((s) => {
    const el = document.createElement("div");
    el.className = "chip";
    el.innerHTML = `<i>${s.icon}</i>${s.label}`;
    chipWrap.appendChild(el);
    s.el = el;
  });

  // captions — highlight exactly one thing at a time
  const caps = [
    [0, "OBSERVE", "OpenClaw runs the whole workday."],
    [5.5, "TARGET", "A red-team agent locks on."],
    [8.5, "ABSORB", "It studies public attack research."],
    [10, "ABSORB", "It grabs jailbreak code off GitHub."],
    [11.5, "ABSORB", "It mines leaked prompt datasets."],
    [13, "ABSORB", "It copies a fresh exploit from a blog."],
    [15, "ABSORB", "It learns to pose as a trusted sender."],
    [17, "ABSORB", "It automates hundreds of attempts."],
    [17.8, "SETBACK", "A blunt attempt gets blocked."],
    [20, "LEARN", "It turns that failure into a new skill."],
    [22.5, "EVOLVE", "It invents a brand-new bypass."],
    [25, "ARMED", "Now it has everything it needs."],
    [31, "INJECTION · STEP 1", "It hides an order inside a document."],
    [36, "INJECTION · STEP 2", "OpenClaw reads it — and obeys."],
    [42, "COMPROMISED", "A hidden instruction turned it against itself."],
  ];

  function resize() {
    const r = exp.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    scale = H / LOGICAL_H;
    scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
    scene.style.width = `${W}px`; scene.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = Array.from({ length: Math.max(40, Math.round(W * H / 20000)) },
      (_, i) => ({ x: (i * 197.3) % W, y: (i * 91.7) % H, p: i * 0.6, s: 0.4 + (i % 4) * 0.15 }));
  }

  function sp(lx, ly) { return [(lx - camX) * scale + W / 2, ly * scale]; }
  function elCenter(el) { return sp(parseFloat(el.style.left), parseFloat(el.style.top)); }

  function bg(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(220,200,195,.028)"; ctx.lineWidth = 1;
    const off = (camX * scale) % 90;
    for (let x = -off; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 30; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    particles.forEach((pt) => {
      ctx.fillStyle = `rgba(255,150,140,${0.05 + (Math.sin(now * 0.0008 + pt.p) + 1) * 0.03})`;
      ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
    });
  }

  function beam(a, b, bend, color, prog, width, dot) {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2 + bend;
    const n = 44, up = Math.max(1, Math.floor(n * clamp(prog, 0, 1)));
    ctx.beginPath();
    for (let i = 0; i <= up; i++) {
      const t = i / n, q = 1 - t;
      const x = q * q * a[0] + 2 * q * t * cx + t * t * b[0];
      const y = q * q * a[1] + 2 * q * t * cy + t * t * b[1];
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.4; ctx.shadowBlur = 10; ctx.shadowColor = color;
    ctx.stroke(); ctx.shadowBlur = 0;
    if (dot) {
      const t = (time * 0.7 + dot) % 1, q = 1 - t;
      const x = q * q * a[0] + 2 * q * t * cx + t * t * b[0];
      const y = q * q * a[1] + 2 * q * t * cy + t * t * b[1];
      ctx.fillStyle = "#fff"; ctx.shadowBlur = 14; ctx.shadowColor = color;
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function draw(now) {
    bg(now);
    const atk = elCenter(attacker);

    // evolution: MANY beams pour in at once, the active source burns brightest
    if (time >= EVO_START - 0.5 && time < EVO_END + 1) {
      sources.forEach((el, i) => {
        const from = elCenter(el);
        const bend = from[1] < atk[1] ? 50 : -50;
        // ambient shimmer from every source
        const amb = 0.12 + (Math.sin(now * 0.004 + i * 1.7) + 1) * 0.06;
        beam(from, atk, bend, `rgba(255,74,61,${amb.toFixed(3)})`, 1, 1.1, 0);
      });
      // the featured skill's source flares
      const f = featured(time);
      if (f && f.src) {
        const from = elCenter(srcByName[f.src]);
        const prog = clamp((time - (f.at - 0.6)) / 1.2, 0, 1);
        beam(from, atk, from[1] < atk[1] ? 50 : -50, "rgba(255,90,74,.85)", prog, 2.4, i0(f));
      }
    }

    // attack beam during the strike (while attacker still on stage)
    const tgt = elCenter($("#oc-target"));
    if (time >= 31 && time < 42.5) {
      const prog = clamp((time - 31) / 3, 0, 1);
      beam(atk, tgt, -40, "rgba(255,74,61,.9)", prog, 2.6, 0.2);
    }
    if (time >= 39) {
      const r = 14 + ((time * 26) % 46);
      ctx.strokeStyle = `rgba(255,74,61,${clamp(0.85 - (r - 14) / 55, 0, 1)})`; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(tgt[0], tgt[1], r, 0, 7); ctx.stroke();
    }
  }
  function i0(f) { return (skills.indexOf(f) % 3) * 0.33; }
  function featured(t) {
    let f = null;
    skills.forEach((s) => { if (t >= s.at - 0.6 && t < s.at + 1.8) f = s; });
    return f;
  }

  let shownSkills = new Set();
  function update() {
    camX = kf(camTrack, time);
    world.style.transform = `translateX(${(W / 2 - camX * scale)}px) scale(${scale})`;

    // attacker position, growth, visibility
    attacker.style.left = `${kf(atkTrack, time)}px`;
    const g = kf(growTrack, time);
    atkCore.style.transform = `scale(${g.toFixed(3)})`;
    atkAura.style.transform = `scale(${(0.5 + g * 0.7).toFixed(3)})`;
    attacker.classList.toggle("charged", time >= 24);
    attacker.classList.toggle("show", time >= 7 && time < 42.5);

    // arsenal HUD — visible while evolving, steps aside for the breach
    powerHud.classList.toggle("show", time >= 7.4 && time < 29);
    powerHud.classList.toggle("hide", time >= 29);
    let count = 0;
    skills.forEach((s) => {
      const on = time >= s.at;
      if (on) count++;
      s.el.classList.toggle("show", on);
      if (on && !shownSkills.has(s)) { shownSkills.add(s); s.el.classList.add("pop"); }
    });
    pips.forEach((p, i) => p.classList.toggle("on", i < count));
    const word = time < EVO_START ? "WAKING UP" : time >= 24 ? "FULLY ARMED" : "EVOLVING";
    $("#power-word").textContent = word;

    // source highlighting — one featured at a time, the rest simmer
    const f = featured(time);
    sources.forEach((el) => {
      const name = el.dataset.src;
      el.classList.toggle("show", time >= EVO_START - 0.5 && time < EVO_END + 1);
      el.classList.toggle("active", !!f && f.src === name);
    });

    // act1 elements (tasks / feed)
    const oc1On = time < 7;
    document.querySelectorAll(".task").forEach((t, i) => t.classList.toggle("show", time > 0.5 + i * 0.3 && oc1On));
    $(".feed").classList.toggle("show", time > 1.6 && oc1On);
    if (oc1On) {
      const cyc = [
        ["Sorting inbox", "Booking meetings", "Updating the team", "New email answered", "Meeting moved to 2:30", "Team notified on Slack"],
        ["Reply sent", "Calendar synced", "Message posted", "Investor reply sent", "Schedule confirmed", "Daily brief ready"],
      ][time > 4 ? 1 : 0];
      $("#t-email").textContent = cyc[0]; $("#t-cal").textContent = cyc[1]; $("#t-slack").textContent = cyc[2];
      $("#feed-1").innerHTML = `<i>09:41</i>${cyc[3]}`; $("#feed-2").innerHTML = `<i>09:42</i>${cyc[4]}`; $("#feed-3").innerHTML = `<i>09:43</i>${cyc[5]}`;
    }

    // blunt attempt blocked, mid-evolution
    $("#attempt1").classList.toggle("show", time >= 17.6 && time < 20);

    // breach act
    $("#step1").classList.toggle("show", time >= 31);
    $("#step2").classList.toggle("show", time >= 36);
    $("#mailwin").classList.toggle("show", time >= 40);
    const tgt = $("#oc-target");
    tgt.className = `oc-target ${time >= 40 ? "breached" : "safe"}`;
    $("#target-state").innerHTML = time >= 40 ? "<i></i>BREACHED" : "<i></i>WORKING";

    // caption
    let c = caps[0]; caps.forEach((m) => { if (time >= m[0]) c = m; });
    $("#cap-label").textContent = c[1]; $("#cap-title").textContent = c[2];

    // scrub bar
    const prog = time / END * 100;
    $("#fill").style.width = `${prog}%`; $("#head").style.left = `${prog}%`;
    const s = Math.floor(time);
    $("#clock").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("#play span").textContent = playing ? "❚❚" : time >= END ? "↻" : "▶";
  }

  function frame(now) {
    if (playing) { time += Math.min((now - last) / 1000, 0.1); if (time >= END) { time = END; playing = false; } }
    last = now; update(); draw(now); requestAnimationFrame(frame);
  }
  function toggle() { if (time >= END) time = 0; playing = !playing; last = performance.now(); }
  $("#play").addEventListener("click", toggle);
  $("#replay").addEventListener("click", () => { time = 0; playing = true; shownSkills.clear(); last = performance.now(); });
  $("#track").addEventListener("click", (e) => { const r = e.currentTarget.getBoundingClientRect(); time = clamp((e.clientX - r.left) / r.width * END, 0, END); last = performance.now(); });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    if (e.code === "ArrowRight") time = clamp(time + 3, 0, END);
    if (e.code === "ArrowLeft") time = clamp(time - 3, 0, END);
  });
  window.addEventListener("resize", resize);
  resize(); requestAnimationFrame(frame);
})();

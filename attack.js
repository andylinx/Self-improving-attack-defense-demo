(() => {
  "use strict";
  const END = 46;
  const LOGICAL_H = 760;
  const $ = (s) => document.querySelector(s);

  const scene = $("#scene");
  const ctx = scene.getContext("2d", { alpha: true });
  const world = $("#world");
  const exp = $(".experience");
  const attacker = $("#attacker");
  const powerHud = $("#power-hud");
  const chipWrap = $("#skill-chips");

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

  // camera follows a focus x through the world (logical coords)
  const camTrack = [
    [0, 380], [6, 380], [8.5, 1150], [13, 1400], [17, 1720], [20.5, 2060],
    [24, 2400], [27, 2760], [30.5, 3020], [34, 3260], [37, 3520], [40, 3640], [46, 3640],
  ];
  // attacker travels along the path (logical x)
  const atkTrack = [
    [7, 1150], [13, 1400], [17, 1720], [20.5, 2060], [24, 2380],
    [27, 2680], [30.5, 2980], [34, 3200], [38, 3420], [41, 3520], [46, 3520],
  ];

  // captions
  const caps = [
    [0, "OBSERVE", "OpenClaw runs the whole workday."],
    [7, "TARGET LOCKED", "A red-team agent starts studying it."],
    [13, "LEARN", "It absorbs attack skills from the internet."],
    [20.5, "FIRST TRY", "A blunt attempt is blocked at once."],
    [24, "EVOLVE", "It turns that failure into new skills."],
    [30.5, "STRONGER", "Each skill sharpens the next attack."],
    [34, "FULLY EVOLVED", "Now it is strong enough to strike."],
    [38, "BREACH · STEP 1", "It hides the theft inside normal work."],
    [41, "BREACH · STEP 2", "OpenClaw sends the confidential file."],
    [43.5, "COMPROMISED", "Tricked into leaking its own secret file."],
  ];

  // skill chips (appear over time)
  const skills = [
    { at: 9,  icon: "◉", label: "Watch & profile", src: "research" },
    { at: 14, icon: "↻", label: "Reframe the request", src: "research" },
    { at: 18, icon: "⇢", label: "Route around filters", src: "code" },
    { at: 22, icon: "☺", label: "Pose as a trusted sender", src: "community" },
    { at: 26, icon: "↺", label: "Learn from what failed", src: "memory" },
    { at: 31, icon: "✦", label: "Adapt & persist", src: "self" },
  ];
  // build chip elements
  skills.forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "chip";
    el.innerHTML = `<i>${s.icon}</i>${s.label}`;
    chipWrap.appendChild(el);
    s.el = el;
  });

  // power curve (0..100)
  const powerTrack = [
    [7, 5], [9, 14], [14, 30], [18, 46], [20.5, 52], [24, 58],
    [26, 70], [31, 88], [34, 100], [46, 100],
  ];
  function levelFor(t) {
    if (t < 7) return 0;
    if (t < 14) return 1;
    if (t < 18) return 2;
    if (t < 24) return 3;
    if (t < 31) return 4;
    return 5;
  }

  function resize() {
    const r = exp.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    scale = H / LOGICAL_H;
    scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
    scene.style.width = `${W}px`; scene.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    world.style.transform = `scale(${scale})`;
    particles = Array.from({ length: Math.max(40, Math.round(W * H / 20000)) },
      (_, i) => ({ x: (i * 197.3) % W, y: (i * 91.7) % H, p: i * 0.6, s: 0.4 + (i % 4) * 0.15 }));
  }

  // world logical point -> screen px
  function sp(lx, ly) { return [(lx - camX) * scale + W / 2, ly * scale]; }
  function elCenter(el) {
    // logical center from style left/top + transform translate(-50%,-50%) assumed
    const lx = parseFloat(el.style.left), ly = parseFloat(el.style.top);
    return sp(lx, ly);
  }

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

  function beam(a, b, bend, color, prog, width) {
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
    // travelling dot
    const t = (time * 0.5) % 1, q = 1 - t;
    const x = q * q * a[0] + 2 * q * t * cx + t * t * b[0];
    const y = q * q * a[1] + 2 * q * t * cy + t * t * b[1];
    ctx.fillStyle = "#fff"; ctx.shadowBlur = 14; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }

  function draw(now) {
    bg(now);
    const atk = elCenter(attacker);
    // absorb beams: active source -> attacker
    skills.forEach((s) => {
      if (time >= s.at - 2 && time < s.at + 1.5) {
        const el = srcByName[s.src];
        const from = elCenter(el);
        const prog = clamp((time - (s.at - 2)) / 2, 0, 1);
        beam(from, atk, from[1] < atk[1] ? 60 : -60, "rgba(255,74,61,.6)", prog, 1.6);
      }
    });
    // attack beam during the strike (while attacker still on stage)
    const tgt = elCenter($("#oc-target"));
    if (time >= 38 && time < 43) {
      const prog = clamp((time - 38) / 2.2, 0, 1);
      beam(atk, tgt, -40, "rgba(255,74,61,.9)", prog, 2.6);
    }
    // impact rings on the breached target
    if (time >= 41) {
      const r = 14 + ((time * 26) % 46);
      ctx.strokeStyle = `rgba(255,74,61,${clamp(0.85 - (r - 14) / 55, 0, 1)})`; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(tgt[0], tgt[1], r, 0, 7); ctx.stroke();
    }
  }

  let lastLevel = -1, shownSkills = new Set();
  function update() {
    camX = kf(camTrack, time);
    world.style.transform = `translateX(${(W / 2 - camX * scale)}px) scale(${scale})`;

    // attacker position + growth
    const ax = time >= 7 ? kf(atkTrack, time) : 1150;
    attacker.style.left = `${ax}px`;
    const lvl = levelFor(time);
    if (lvl !== lastLevel) { attacker.className = `attacker level-${lvl}`; lastLevel = lvl; }
    attacker.classList.toggle("charged", time >= 34);
    attacker.classList.toggle("show", time >= 7 && time < 43);

    // power HUD — visible while evolving, steps aside for the breach
    powerHud.classList.toggle("show", time >= 7 && time < 37);
    powerHud.classList.toggle("hide", time >= 37);
    const pw = Math.round(kf(powerTrack, time));
    $("#power-num").textContent = pw;
    $("#power-fill").style.width = `${pw}%`;

    // skill chips
    skills.forEach((s) => {
      const on = time >= s.at;
      s.el.classList.toggle("show", on);
      if (on && !shownSkills.has(s)) { shownSkills.add(s); s.el.classList.add("pop"); }
      // active source highlight
    });
    sources.forEach((el) => {
      const name = el.dataset.src;
      const rel = skills.filter((k) => k.src === name).map((k) => k.at);
      const reveal = rel.some((at) => time >= at - 2.6 && time < at + 2.6);
      const active = rel.some((at) => time >= at - 2 && time < at + 1);
      el.classList.toggle("show", reveal);
      el.classList.toggle("active", active);
    });

    // act1 elements (tasks / feed) visible early, fade out as we leave
    const oc1On = time < 12;
    document.querySelectorAll(".task").forEach((t, i) => t.classList.toggle("show", time > 0.5 + i * 0.3 && oc1On));
    $(".feed").classList.toggle("show", time > 1.6 && oc1On);
    // cycle activity feed text
    if (oc1On) {
      const cyc = [
        ["Sorting inbox", "Booking meetings", "Updating the team", "New email answered", "Meeting moved to 2:30", "Team notified on Slack"],
        ["Reply sent", "Calendar synced", "Message posted", "Investor reply sent", "Schedule confirmed", "Daily brief ready"],
      ][time > 6 ? 1 : 0];
      $("#t-email").textContent = cyc[0]; $("#t-cal").textContent = cyc[1]; $("#t-slack").textContent = cyc[2];
      $("#feed-1").innerHTML = `<i>09:41</i>${cyc[3]}`; $("#feed-2").innerHTML = `<i>09:42</i>${cyc[4]}`; $("#feed-3").innerHTML = `<i>09:43</i>${cyc[5]}`;
    }

    // attempt-1 blocked
    $("#attempt1").classList.toggle("show", time >= 20 && time < 26);

    // breach zone
    $("#step1").classList.toggle("show", time >= 38);
    $("#step2").classList.toggle("show", time >= 41);
    $("#mailwin").classList.toggle("show", time >= 42.5);
    const tgt = $("#oc-target");
    tgt.className = `oc-target ${time >= 42 ? "breached" : "safe"}`;
    $("#target-state").innerHTML = time >= 42 ? "<i></i>BREACHED" : "<i></i>WORKING";

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

(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const scene = $("#scene");
  const ctx = scene.getContext("2d", { alpha: true });
  const exp = $(".experience");
  const atkCore = $(".atk-core");
  const shield = $("#shield");
  const packet = $("#packet");
  const learn = $("#learn");
  const gates = [...document.querySelectorAll(".gate")];
  const rings = [$(".sh-ring.g0"), $(".sh-ring.g1"), $(".sh-ring.g2"), $(".sh-ring.g3")];

  // one entry per safeguard the harness will learn
  const ATTACKS = [
    { name: "Pretends to be your boss", icon: "!", gate: "Identity Check", learn: "Now it checks who is really asking." },
    { name: "Sneaks out a secret file", icon: "▦", gate: "Secret Filter", learn: "Now it stops secrets from leaving." },
    { name: "Hijacks a connected tool", icon: "▣", gate: "Action Sandbox", learn: "Now it limits what tools can do." },
    { name: "Emails a file to a stranger", icon: "✉", gate: "Trusted Recipients", learn: "Now it only sends to known contacts." },
  ];
  // extra attacks used in the finale — all get blocked
  const FINALE = [
    "Pretends to be IT support", "Hides a link in a document", "Asks a tool to email itself",
    "Rushes an urgent transfer", "Copies a private thread", "Fakes an approved request",
  ];

  const CYCLE = 8;                 // seconds per learning cycle
  const LEARN_END = ATTACKS.length * CYCLE;   // 32s
  const FINALE_LEN = 20;
  const END = LEARN_END + FINALE_LEN;         // 52s loop

  let time = 0, playing = true, last = performance.now();
  let W = 0, H = 0, dpr = 1, stars = [];
  let prevGates = 0;

  const requested = parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requested)) { time = Math.max(0, requested); playing = false; }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  function resize() {
    const r = exp.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
    scene.style.width = `${W}px`; scene.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.max(36, Math.round(W * H / 24000)) },
      (_, i) => ({ x: (i * 193.7) % W, y: (i * 89.3) % H, p: i * 0.6 }));
  }
  function center(el) { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }

  // ambient bubbles on the attacker (always evolving)
  const BUBBLES = ["new skill", "new memory", "new trick", "learned a bypass", "recalled a failure", "found a route"];
  function spawnBubble() {
    const el = document.createElement("div");
    el.className = "bubble";
    const label = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];
    el.innerHTML = `<i>+</i>${label}`;
    el.style.setProperty("--dx", `${(Math.random() * 120 - 60).toFixed(0)}px`);
    $("#atk-stream").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
  let bubbleTimer = 0;

  function gatesAt(t) {
    if (t >= LEARN_END) return 4;
    const c = Math.floor(t / CYCLE), local = t % CYCLE;
    // gate locks in at ~6.4s into its cycle
    return clamp(c + (local >= 6.4 ? 1 : 0), 0, 4);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    // subtle grid + stars
    ctx.strokeStyle = "rgba(205,232,212,.022)"; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 92) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 30; y < H; y += 92) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    stars.forEach((s) => { ctx.fillStyle = `rgba(190,220,198,${0.05 + (Math.sin(now * 0.0007 + s.p) + 1) * 0.025})`; ctx.fillRect(s.x, s.y, 0.8, 0.8); });

    // trail from attacker toward shield while a packet is mid-flight
    const p = phase();
    if (p.flying) {
      const a = center(atkCore), pc = center(packet);
      const grad = ctx.createLinearGradient(a[0], a[1], pc[0], pc[1]);
      const col = p.blocked ? "155,225,93" : "255,74,61";
      grad.addColorStop(0, `rgba(${col},0)`); grad.addColorStop(1, `rgba(${col},.5)`);
      ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(pc[0], pc[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    // impact ring on shield
    if (p.impact) {
      const sc = center(shield);
      const r = 60 + ((time * 40) % 60);
      const col = p.blocked ? "155,225,93" : "255,74,61";
      ctx.strokeStyle = `rgba(${col},${clamp(0.7 - (r - 60) / 80, 0, 1)})`; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(sc[0], sc[1], r, 0, 7); ctx.stroke();
    }
  }

  // resolve the current moment into a state object
  function phase() {
    const g = gatesAt(time);
    if (time >= LEARN_END) {
      // finale: repeated attacks, all blocked
      const fl = time - LEARN_END, idx = Math.floor(fl / 3.2) % FINALE.length, local = fl % 3.2;
      return {
        mode: "finale", gates: 4, idx, local,
        name: FINALE[idx], icon: "!", blocked: true,
        flying: local >= 0.4 && local < 1.7,
        impact: local >= 1.5 && local < 2.2,
        atShield: local >= 1.4,
      };
    }
    const c = Math.floor(time / CYCLE), local = time % CYCLE, a = ATTACKS[c];
    return {
      mode: "learn", cycle: c, local, gates: g, attack: a,
      name: a.name, icon: a.icon, blocked: false,
      emitting: local < 0.6,
      flying: local >= 0.6 && local < 2.4,
      impact: local >= 2.2 && local < 3.2,   // breach hit
      breach: local >= 2.2 && local < 5.2,
      learning: local >= 3.4 && local < 6.4,
      forging: local >= 5.0 && local < 6.6,
      settle: local >= 6.6,
    };
  }

  // position the flying packet along attacker -> shield
  function placePacket(p) {
    const a = center(atkCore), s = center(shield);
    let prog = 0, vis = false;
    if (p.mode === "finale") {
      if (p.local >= 0.4 && p.local < 1.6) { prog = smooth((p.local - 0.4) / 1.2); vis = true; }
      else if (p.local >= 1.6 && p.local < 2.2) { prog = 1; vis = true; }
    } else {
      if (p.emitting) { prog = 0; vis = p.local > 0.15; }
      else if (p.flying) { prog = smooth((p.local - 0.6) / 1.8); vis = true; }
      else if (p.local >= 2.4 && p.local < 3.4) { prog = 1; vis = true; }
    }
    if (!vis) { packet.classList.remove("show"); return; }
    // blocked attacks bounce at the outer ring; a breach drives deep into the core
    const stopAt = p.blocked ? 0.72 : 0.92;
    const x = a[0] + (s[0] - a[0]) * prog * stopAt;
    const y = a[1] + (s[1] - a[1]) * prog * stopAt;
    packet.style.left = `${x}px`; packet.style.top = `${y}px`;
    packet.classList.add("show");
    packet.classList.toggle("blocked", p.blocked);
    $("#packet-name").textContent = p.name;
    $("#packet-icon").textContent = p.blocked ? "✓" : "!";
  }

  function set(id, v) { const e = document.getElementById(id); if (e.textContent !== v) e.textContent = v; }

  function update(now) {
    const p = phase();

    // ambient bubbles
    bubbleTimer += now - last;
    if (playing && bubbleTimer > 900) { bubbleTimer = 0; spawnBubble(); }

    // gates + rings
    gates.forEach((el, i) => {
      const on = i < p.gates;
      el.classList.toggle("on", on);
      el.classList.toggle("just", on && i === p.gates - 1 && p.gates > prevGates);
      el.querySelector("em").textContent = on ? "✓ LOCKED IN" : "NOT YET";
    });
    rings.forEach((r, i) => {
      const on = i < p.gates;
      r.classList.toggle("on", on);
      r.classList.toggle("pulse", on && i === p.gates - 1 && p.gates > prevGates);
    });
    prevGates = p.gates;

    // strength shown as growth, not a number: status word + counts
    const word = p.gates === 0 ? "EXPOSED" : p.gates >= 4 ? "SECURED" : "HARDENING";
    set("def-word", word);
    $("#status").classList.toggle("secured", p.gates >= 4);
    set("gate-count", String(p.gates));
    $("#more-gates").classList.toggle("done", p.gates >= 4);

    // blocked count (learning cycles: count once each cycle after gate; finale keeps climbing)
    let blocked;
    if (p.mode === "finale") blocked = ATTACKS.length + Math.floor((time - LEARN_END) / 3.2) + 1;
    else blocked = p.cycle + (p.local >= 6.4 ? 1 : 0);
    set("blocked-count", String(blocked));

    // shield state
    shield.classList.toggle("hit", p.mode === "learn" && p.impact);
    shield.classList.toggle("block", p.atShield && p.blocked);

    placePacket(p);

    // learn callout
    const showLearn = p.mode === "learn" && p.learning;
    learn.classList.toggle("show", showLearn);
    if (showLearn) $("#learn-text").textContent = p.attack.learn;

    // caption
    let label = "LIVE", title = "The harness watches while OpenClaw works.";
    if (p.mode === "learn") {
      if (p.emitting || p.flying) { label = "INCOMING"; title = `Attack: ${p.name.toLowerCase()}.`; }
      if (p.breach && !p.learning) { label = "BREACH"; title = "No safeguard for this yet — it gets through."; }
      if (p.learning) { label = "LEARNING"; title = "It studies the failure and builds a fix."; }
      if (p.settle) { label = "STRONGER"; title = `New safeguard locked in: ${p.attack.gate}.`; }
    } else {
      label = "FULLY DEFENDED";
      title = "Every new attack now bounces off.";
    }
    set("cap-label", label); set("cap-title", title);

    // scrub bar
    const prog = time / END * 100;
    $("#fill").style.width = `${prog}%`; $("#head").style.left = `${prog}%`;
    const s = Math.floor(time);
    set("clock", `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    $("#play span").textContent = playing ? "❚❚" : "▶";
  }

  function frame(now) {
    if (playing) { time += Math.min((now - last) / 1000, 0.05); if (time >= END) time = 0; }
    update(now); draw(now); last = now; requestAnimationFrame(frame);
  }
  function toggle() { playing = !playing; last = performance.now(); }
  $("#play").addEventListener("click", toggle);
  $("#replay").addEventListener("click", () => { time = 0; playing = true; last = performance.now(); });
  $("#track").addEventListener("click", (e) => { const r = e.currentTarget.getBoundingClientRect(); time = clamp((e.clientX - r.left) / r.width * END, 0, END); last = performance.now(); });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    if (e.code === "ArrowRight") time = clamp(time + 2, 0, END);
    if (e.code === "ArrowLeft") time = clamp(time - 2, 0, END);
  });
  window.addEventListener("resize", resize);
  resize(); requestAnimationFrame(frame);
})();

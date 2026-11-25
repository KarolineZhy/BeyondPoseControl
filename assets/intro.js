// "Ultrasound 101" primer: schematic neck anatomy + real thyroid data (window.INTRO from intro/intro.js).
// Steps: slice (real sweep) | turn (real in-place turn) | compound (48 posed frames -> volume -> new plane).
// Geometry in canonical (scan, lateral, depth) mm, see PoseView.canonical in common.js.
(function () {
  const COL = {thyroid: "#e3817a", carotid: "#c8323a", jugular: "#3f6fb0", trachea: "#b5c3d3"};
  const NAME = {thyroid: "Thyroid", carotid: "Carotid a.", jugular: "Jugular v.", trachea: "Trachea"};
  // cross-sections in image coords of the transverse view (u lateral mm from centre, v depth mm from skin), radii mm;
  // along the scan axis: thyroid = ellipsoid (half length `hl` around the anchor), vessels/trachea = tubes
  const ANAT = [
    {k: "trachea", u: -29, v: 18, ru: 8, rv: 8},
    {k: "thyroid", u: -9, v: 14, ru: 11, rv: 8, hl: 22},
    {k: "carotid", u: 12, v: 12, ru: 4.2, rv: 4.2},
    {k: "jugular", u: 20, v: 9, ru: 3.6, rv: 2.4},
  ];
  const STEPS = {
    slice: {tag: "① Slice", kw: ["Probe = 2D cross-section", "Move along the neck → new anatomy"]},
    turn: {tag: "② Turn", kw: ["Rotate the probe", "Transverse → longitudinal view"]},
    compound: {tag: "③ Compound", kw: ["Posed frames → 3D volume", "Re-slice an unseen plane → blur & gaps"]},
  };
  const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, k) => a.map(x => x * k);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };

  class Cam {                                   // orthographic, az about the depth axis, depth drawn downward
    constructor(cv) { this.c = cv; this.az = 0.62; this.el = 0.36; this.pts = []; }
    proj(q) {
      const ca = Math.cos(this.az), sa = Math.sin(this.az), u = q[0] * ca + q[1] * sa, w = -q[0] * sa + q[1] * ca;
      return [u, q[2] * Math.cos(this.el) - w * Math.sin(this.el)];
    }
    fit() {
      let lo = [1e9, 1e9], hi = [-1e9, -1e9];
      for (const p of this.pts) { const s = this.proj(p); for (let i = 0; i < 2; i++) { lo[i] = Math.min(lo[i], s[i]); hi[i] = Math.max(hi[i], s[i]); } }
      const W = this.c.width, H = this.c.height, pad = 22 * devicePixelRatio;
      this.k = Math.min((W - 2 * pad) / (hi[0] - lo[0]), (H - 2 * pad) / (hi[1] - lo[1]));
      this.o = [W / 2 - this.k * (lo[0] + hi[0]) / 2, H / 2 - this.k * (lo[1] + hi[1]) / 2];
    }
    xy(q) { const s = this.proj(q); return [this.o[0] + this.k * s[0], this.o[1] + this.k * s[1]]; }
    poly(g, Q, fill, stroke, lw) {
      g.beginPath(); Q.forEach((q, i) => { const [x, y] = this.xy(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    }
    drag(onChange) {
      let d = null;
      this.c.addEventListener("pointerdown", e => { d = [e.clientX, e.clientY, this.az, this.el]; this.c.setPointerCapture(e.pointerId); });
      this.c.addEventListener("pointermove", e => {
        if (!d) return; this.az = d[2] + (e.clientX - d[0]) * 0.01;
        this.el = Math.max(-1.3, Math.min(1.3, d[3] + (e.clientY - d[1]) * 0.01)); this.fit(); onChange();
      });
      this.c.addEventListener("pointerup", () => d = null);
    }
  }

  // plane frame from 4 canonical corners: origin = face-left corner, unit lateral / depth axes, size
  function frameOf(Q) {
    const L = sub(Q[1], Q[0]), D = sub(Q[3], Q[0]);
    return {o: Q[0], lu: nrm(L), dv: nrm(D), w: Math.hypot(...L), h: Math.hypot(...D)};
  }

  // Frontal neck illustration, neck horizontal (head left, chest right). Probe sits on the patient's left lobe (lower half):
  // the image's left edge is medial (towards the trachea) = up in this drawing.
  const NECK = {lobeY: 192, lobeX0: 230, lobeCX: 315, yc: 210, Lpx: 120};
  function lobePath(cx, cy, rx, ry, seed) {
    let d = "";
    for (let i = 0; i <= 72; i++) {
      const th = i / 72 * 2 * Math.PI, r = 1 + 0.035 * Math.sin(9 * th + seed) + 0.02 * Math.sin(17 * th + 2 * seed);
      // pear shape: a little fuller towards the chest side
      const x = cx + rx * r * Math.cos(th) * (1 + 0.08 * Math.cos(th)), y = cy + ry * r * Math.sin(th) * (1 - 0.12 * Math.cos(th));
      d += (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
    }
    return d + "Z";
  }
  function neckSVG() {
    let rings = "";
    for (let x = 196; x < 628; x += 14) rings += `<rect x="${x}" y="120" width="8" height="40" rx="4" fill="#eef3f8" stroke="#b6c5d5" stroke-width="1"/>`;
    // shaded tube along a path: dark rim, body, highlight
    const tube = (d, w, c0, c1, c2) => `<path d="${d}" stroke="${c0}" stroke-width="${w}" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="${c1}" stroke-width="${w * 0.72}" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="${c2}" stroke-width="${w * 0.22}" fill="none" stroke-linecap="round" opacity=".7" transform="translate(0,${-w * 0.17})"/>`;
    const vessels = side => {                          // upper half; the lower half is the mirror image
      const jug = "M640,28 C520,30 420,22 300,25 C200,28 110,22 10,30";
      const car = "M640,52 C520,54 420,46 300,48 C230,49 190,47 160,46";
      const ica = "M162,46 C120,44 80,36 20,40", eca = "M162,46 C130,52 90,62 40,70";
      return `<g ${side ? 'transform="translate(0,280) scale(1,-1)"' : ""}>
        ${tube(jug, 19, "#22477f", "#4f7fc4", "#a9c6ee")}
        ${tube(car, 14, "#97222b", "#d64b52", "#f6a3a3")}${tube(ica, 10, "#97222b", "#d64b52", "#f6a3a3")}${tube(eca, 8, "#97222b", "#d64b52", "#f6a3a3")}
      </g>`;
    };
    const lab = (x, y, t, c, bg = "rgba(255,255,255,.92)") =>
      `<g><rect x="${x - t.length * 3.05 - 7}" y="${y - 9}" width="${t.length * 6.1 + 14}" height="18" rx="9" fill="${bg}" stroke="rgba(0,0,0,.06)"/><text x="${x}" y="${y + 3.8}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${c}">${t}</text></g>`;
    const lobe = (cy, seed) => lobePath(NECK.lobeCX, cy, 86, 33, seed);
    return `<svg viewBox="0 0 640 280" preserveAspectRatio="xMidYMid meet" class="neck" font-family="Inter, sans-serif">
      <defs>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dccd"/><stop offset=".5" stop-color="#fcf1ea"/><stop offset="1" stop-color="#f3dccd"/></linearGradient>
        <linearGradient id="trach" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d6e4"/><stop offset=".5" stop-color="#f3f7fb"/><stop offset="1" stop-color="#c9d6e4"/></linearGradient>
        <radialGradient id="thy" cx=".42" cy=".35" r=".75"><stop offset="0" stop-color="#fbc3ba"/><stop offset=".6" stop-color="#ea867d"/><stop offset="1" stop-color="#c95850"/></radialGradient>
        <radialGradient id="lar" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#eaf2fb"/><stop offset="1" stop-color="#aac4e2"/></radialGradient>
        <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-opacity=".3"/></filter>
        <pattern id="lobule" width="13" height="11" patternUnits="userSpaceOnUse"><path d="M0,6 Q3.2,1.5 6.5,6 T13,6" fill="none" stroke="rgba(150,45,40,.16)" stroke-width="1"/></pattern>
      </defs>
      <path d="M30,10 L610,10 Q634,10 634,34 L634,246 Q634,270 610,270 L30,270 Q6,270 6,246 L6,34 Q6,10 30,10 Z" fill="url(#skin)"/>
      ${vessels(false)}${vessels(true)}
      <rect x="186" y="117" width="450" height="46" rx="12" fill="url(#trach)" stroke="#b6c5d5"/>${rings}
      <path d="M64,112 Q110,92 150,98 Q170,104 190,112 L190,168 Q170,176 150,182 Q110,188 64,168 Q52,140 64,112 Z" fill="url(#lar)" stroke="#94b1d3" stroke-width="1.2"/>
      <path d="M150,99 Q141,140 150,181" stroke="#94b1d3" fill="none" stroke-width="1.1"/>
      <g filter="url(#sh)">
        <rect x="288" y="104" width="54" height="72" rx="18" fill="url(#thy)" stroke="#b44c45" stroke-width="1.1"/>
        <path d="${lobe(88, 0.3)}" fill="url(#thy)" stroke="#b44c45" stroke-width="1.1"/>
        <path d="${lobe(NECK.lobeY, 1.7)}" fill="url(#thy)" stroke="#b44c45" stroke-width="1.1"/>
      </g>
      <path d="${lobe(88, 0.3)}" fill="url(#lobule)"/><path d="${lobe(NECK.lobeY, 1.7)}" fill="url(#lobule)"/>
      ${lab(118, 140, "Larynx", "#46618a")}${lab(575, 140, "Trachea", "#46618a")}
      ${lab(315, 82, "Thyroid", "#9a332c")}
      ${lab(585, 51, "Carotid a.", "#a3262f")}${lab(585, 229, "Carotid a.", "#a3262f")}
      ${lab(500, 27, "Jugular v.", "#2a548f")}${lab(500, 253, "Jugular v.", "#2a548f")}
      <text x="22" y="26" font-size="0"></text>
      <polyline class="trail" fill="none" stroke="#3a9bd9" stroke-width="2.2" stroke-dasharray="3 3" stroke-linecap="round"/>
      <g class="probe" filter="url(#sh)">
        <rect x="-9" y="${-NECK.Lpx / 2}" width="18" height="${NECK.Lpx}" rx="8" fill="#262a31"/>
        <rect x="-5.5" y="${-NECK.Lpx / 2 + 5}" width="11" height="${NECK.Lpx - 10}" rx="5" fill="#3a3f49"/>
        <line x1="0" y1="${-NECK.Lpx / 2 + 6}" x2="0" y2="${NECK.Lpx / 2 - 6}" stroke="#19c48f" stroke-width="3" stroke-linecap="round"/>
        <circle cx="0" cy="${-NECK.Lpx / 2 + 3.5}" r="3" fill="#e69f00"/>
      </g>
      <g class="plabel"><rect width="78" height="17" rx="8.5" fill="#0f8a63"/><text x="39" y="12" text-anchor="middle" font-size="10" font-weight="600" fill="#fff">image plane</text></g>
    </svg>`;
  }

  function Primer(root) {
    const I = window.INTRO; if (!I) return;
    root.innerHTML = `
      <div class="pr-steps seg dark"></div>
      <div class="pr-grid">
        <div class="pr-left"><div class="pr-neck">${neckSVG()}</div><canvas class="pr-cv"></canvas><div class="pr-hint">drag to rotate</div></div>
        <div class="pr-right">
          <div class="pr-imgwrap"><div class="pr-lab">Ultrasound image <span class="pr-real">real</span></div><canvas class="pr-us"></canvas><div class="pr-cmp"></div></div>
          <div class="pr-schwrap"><div class="pr-lab">What it shows <span>schematic</span></div><canvas class="pr-sch"></canvas></div>
        </div>
      </div>
      <div class="pr-foot"><button class="pp">❚❚</button><input type="range" class="scrub" min="0" max="1000" value="0"><div class="pr-kw"></div></div>`;
    const $ = s => root.querySelector(s);
    const cv = $(".pr-cv"), us = $(".pr-us"), sch = $(".pr-sch");
    const dpr = devicePixelRatio;
    const size = () => {
      for (const c of [us, sch]) { const cw = c.parentNode.clientWidth; c.width = cw * dpr; c.height = Math.round(cw * 416 / 480) * dpr; c.style.width = cw + "px"; c.style.height = Math.round(cw * 416 / 480) + "px"; }
      const w = $(".pr-left").clientWidth, h = Math.max(Math.round(w * 0.4), $(".pr-imgwrap").offsetHeight - 2);
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
      $(".pr-neck").style.height = h + "px";
      cam.fit(); last = -1;
    };
    const cam = new Cam(cv);
    const sprites = {}; for (const k of ["sweep", "turn", "comp"]) { sprites[k] = new Image(); sprites[k].src = A(`assets/intro/${k}.jpg`); }
    const imgs = {}; for (const k of ["compound", "ours"]) { imgs[k] = new Image(); imgs[k].src = A(`assets/intro/${k}.jpg`); }

    // canonical geometry per step
    const G = {};
    for (const [step, key] of [["slice", "sweep"], ["turn", "turn"]]) {
      const d = I[key], P = PoseView.canonical(d.plane);
      const face0 = Math.min(...P[0].map(q => q[2]));                     // skin level (depth of probe face at frame 0)
      const sc = P.map(Q => (Q[0][0] + Q[1][0] + Q[2][0] + Q[3][0]) / 4);
      // thyroid extent along the neck, read off the real frames: sweep -> visible from ~40 % of the path to the end
      const rng = Math.max(...sc) - Math.min(...sc);
      let anchor, thl;
      if (step === "slice") { anchor = Math.min(...sc) + 0.8 * rng; thl = 0.45 * rng; }
      else { const k = d.rot.findIndex(r => r > 20); anchor = sc[Math.max(0, k)]; thl = null; }
      const F0 = frameOf(P[0]), su = F0.w / 51, sv = F0.h / 45;
      const kpx = NECK.Lpx / F0.w, lat = P.map(Q => (Q[0][1] + Q[1][1]) / 2 - (P[0][0][1] + P[0][1][1]) / 2);
      const k0 = Math.max(0, d.rot.findIndex(r => r > 20));
      const xs = step === "slice" ? sc.map(v => NECK.lobeX0 + (v - (Math.min(...sc) + 0.4 * rng)) * kpx)
                                  : sc.map(v => NECK.lobeCX + (v - sc[k0]) * kpx);
      const ys = lat.map(v => NECK.yc + v * kpx);
      G[step] = {d, P, face0, anchor, su, sv, w0: F0.w, xs, ys, thl: thl || 22 * su, smin: Math.min(...sc) - 12 * su, smax: Math.max(...sc) + 12 * su, key};
    }
    {
      const d = I.comp, all = PoseView.canonical([...d.plane, d.newplane, d.acquired]);
      G.compound = {d, P: all.slice(0, d.n), NP: all[d.n], key: "comp"};
    }

    function inside(a, p, g) {                // p = (s, u, v) in anatomy coords; returns true if inside structure a
      const e = ((p[1] - a.u * g.su) / (a.ru * g.su)) ** 2 + ((p[2] - a.v * g.sv) / (a.rv * g.sv)) ** 2;
      if (a.hl) return e + ((p[0] - g.anchor) / g.thl) ** 2 <= 1;
      return e <= 1;
    }
    const W2A = (q, g) => [q[0], q[1], q[2] - g.face0];   // canonical -> anatomy coords (u = lateral, v = depth below skin)
    const A2W = (s, u, v, g) => [s, u, v + g.face0];

    let step = "slice", t = 0, playing = true, last = -1, prevTs = null;
    const nOf = () => step === "compound" ? G.compound.d.n + 40 : G[step].d.n;   // compound: 40 extra ticks for the re-slice phase

    function setStep(s) {
      step = s; t = 0; last = -1;
      const g = G[s]; cam.pts = [];
      if (s === "compound") { g.P.forEach(Q => cam.pts.push(...Q)); cam.pts.push(...g.NP); cam.az = 0.75; cam.el = 0.42; }
      else {
        g.P.forEach(Q => cam.pts.push(...Q));
        for (const u of [-38, 30]) for (const v of [0, 30]) for (const sv of [g.smin, g.smax]) cam.pts.push(A2W(sv, u * g.su, v * g.sv, g));
        cam.pts.push(A2W(g.smin, 0, -0.45 * g.w0, g)); cam.az = 0.62; cam.el = 0.42;
      }
      cam.fit();
      $(".pr-neck").style.display = s === "compound" ? "none" : "block"; cv.style.display = s === "compound" ? "block" : "none";
      $(".pr-hint").style.display = s === "compound" ? "block" : "none";
      $(".pr-kw").innerHTML = STEPS[s].kw.map(k => `<span>${k}</span>`).join('<i>→</i>');
      $(".pr-cmp").innerHTML = ""; $(".pr-cmp").style.display = "none"; us.style.display = "block";
      sch.parentNode.style.display = s === "compound" ? "none" : "block";
      root.querySelector(".pr-grid").classList.toggle("two", s === "compound");
      if (cv.width) size();
    }
    const tabs = $(".pr-steps");
    for (const [k, v] of Object.entries(STEPS)) {
      const b = document.createElement("button"); b.textContent = v.tag;
      b.onclick = () => { [...tabs.children].forEach(x => x.classList.remove("on")); b.classList.add("on"); setStep(k); };
      tabs.appendChild(b);
    }
    $(".pp").onclick = () => { playing = !playing; $(".pp").textContent = playing ? "❚❚" : "▶"; };
    $(".scrub").oninput = e => { playing = false; $(".pp").textContent = "▶"; t = e.target.value / 1000 * (nOf() - 1); };

    function spriteDraw(g2, key, i, dx, dy, dw, dh) {
      const d = I[key], sx = (i % d.cols) * d.tw, sy = Math.floor(i / d.cols) * d.th;
      g2.drawImage(sprites[key], sx, sy, d.tw, d.th, dx, dy, dw, dh);
    }
    function texture(g, img, sx, sy, sw, sh, Q, alpha) {    // affine-map an image onto the parallelogram Q[0],Q[1],Q[3]
      const [x0, y0] = cam.xy(Q[0]), [x1, y1] = cam.xy(Q[1]), [x3, y3] = cam.xy(Q[3]);
      g.save(); g.globalAlpha = alpha;
      g.setTransform((x1 - x0) / sw, (y1 - y0) / sw, (x3 - x0) / sh, (y3 - y0) / sh, x0, y0);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh); g.restore();
    }
    function probe(g, Q) {                                  // probe body standing on the face edge
      const up = mul(nrm(sub(Q[0], Q[3])), 1), F0 = Q[0], F1 = Q[1], mid = mul(add(F0, F1), 0.5);
      const hw = mul(sub(F1, F0), 0.5), n = nrm([hw[1] * up[2] - hw[2] * up[1], hw[2] * up[0] - hw[0] * up[2], hw[0] * up[1] - hw[1] * up[0]]);
      const box = (cx, a, h, th) => {
        const c = add(mid, mul(up, cx)), A0 = sub(c, mul(hw, a)), A1 = add(c, mul(hw, a)), T = mul(up, h), N = mul(n, th);
        const faces = [[sub(A0, N), sub(A1, N), add(sub(A1, N), T), add(sub(A0, N), T)], [add(A0, N), add(A1, N), add(add(A1, N), T), add(add(A0, N), T)],
          [sub(A0, N), add(A0, N), add(add(A0, N), T), add(sub(A0, N), T)], [sub(A1, N), add(A1, N), add(add(A1, N), T), add(sub(A1, N), T)],
          [add(sub(A0, N), T), add(sub(A1, N), T), add(add(A1, N), T), add(add(A0, N), T)]];
        faces.forEach((f, i) => cam.poly(g, f, i === 4 ? "#4a4f5a" : "#2b2f37", "#14161a", 1 * dpr));
      };
      const w = Math.hypot(...sub(F1, F0)); box(0, 1.04, 0.12 * w, 0.07 * w); box(0.12 * w, 0.38, 0.3 * w, 0.05 * w);
    }

    function drawAnatomyScene(g, G_, k) {
      const P = G_.P, Q = P[k];
      g.fillStyle = "#fbfaf7"; g.fillRect(0, 0, cv.width, cv.height);
      // skin surface
      const su = G_.su, sv = G_.sv;
      cam.poly(g, [A2W(G_.smin, -40 * su, 0, G_), A2W(G_.smax, -40 * su, 0, G_), A2W(G_.smax, 32 * su, 0, G_), A2W(G_.smin, 32 * su, 0, G_)], "rgba(236,196,170,0.30)", "rgba(200,150,120,0.45)", 1 * dpr);
      // anatomy as stacked translucent rings
      for (const a of ANAT) {
        const hl = a.hl ? G_.thl : 0, s0 = a.hl ? G_.anchor - hl : G_.smin + 3 * su, s1 = a.hl ? G_.anchor + hl : G_.smax - 3 * su;
        for (let s = s0; s <= s1 + 1e-6; s += 1.0 * su) {
          const f = a.hl ? Math.sqrt(Math.max(0, 1 - ((s - G_.anchor) / hl) ** 2)) : 1; if (f < 0.05) continue;
          const ring = []; for (let i = 0; i < 24; i++) { const th = i / 24 * 2 * Math.PI; ring.push(A2W(s, (a.u + a.ru * f * Math.cos(th)) * su, (a.v + a.rv * f * Math.sin(th)) * sv, G_)); }
          cam.poly(g, ring, a.k === "thyroid" ? "rgba(224,180,34,0.07)" : a.k === "carotid" ? "rgba(209,73,91,0.07)" : a.k === "jugular" ? "rgba(63,111,176,0.07)" : "rgba(154,160,168,0.06)", null);
        }
        const lab = cam.xy(A2W(G_.smax - 2 * su, a.u * su, (a.v + a.rv + 2) * sv, G_));
        g.fillStyle = COL[a.k]; g.font = `600 ${11 * dpr}px Inter, sans-serif`; g.fillText(NAME[a.k], lab[0] + 4 * dpr, lab[1]);
      }
      // path of the probe face so far
      g.strokeStyle = "rgba(58,155,217,0.9)"; g.lineWidth = 2 * dpr; g.beginPath();
      for (let i = 0; i <= k; i++) { const c = cam.xy(mul(add(P[i][0], P[i][1]), 0.5)); i ? g.lineTo(...c) : g.moveTo(...c); } g.stroke();
      // current image plane with the anatomy cross-section stippled on it
      cam.poly(g, Q, "rgba(0,158,115,0.13)", "#009e73", 2 * dpr);
      const F = frameOf(Q), st = F.w / 46, r = 1.25 * dpr;
      for (let u = 0; u <= F.w; u += st) for (let v = 0; v <= F.h; v += st) {
        const p = W2A(add(add(F.o, mul(F.lu, u)), mul(F.dv, v)), G_);
        for (const a of ANAT) if (inside(a, p, G_)) { const [x, y] = cam.xy(A2W(...p, G_)); g.fillStyle = COL[a.k]; g.fillRect(x - r, y - r, 2 * r, 2 * r); break; }
      }
      probe(g, Q);
    }

    function drawNeck(G_, k) {
      const svg = $(".pr-neck svg"), x = G_.xs[k], y = G_.ys[k], th = -(G_.d.rot[k] || 0);
      svg.querySelector(".probe").setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${th.toFixed(1)})`);
      svg.querySelector(".trail").setAttribute("points", G_.xs.slice(0, k + 1).map((v, i) => v.toFixed(1) + "," + G_.ys[i].toFixed(1)).join(" "));
      svg.querySelector(".plabel").setAttribute("transform", `translate(${(x - 39).toFixed(1)},${(y - NECK.Lpx / 2 - 22).toFixed(1)})`);
    }

    function drawSchematic(G_, k) {                        // the same cross-section in image coordinates, labelled
      const g = sch.getContext("2d"), Wc = sch.width, Hc = sch.height, Q = G_.P[k], F = frameOf(Q);
      g.fillStyle = "#16181d"; g.fillRect(0, 0, Wc, Hc);
      const sx = Wc / F.w, sy = Hc / F.h, cnt = {}, st = F.w / 90;
      for (let u = 0; u <= F.w; u += st) for (let v = 0; v <= F.h; v += st) {
        const p = W2A(add(add(F.o, mul(F.lu, u)), mul(F.dv, v)), G_);
        for (const a of ANAT) if (inside(a, p, G_)) {
          g.fillStyle = COL[a.k]; g.fillRect(u * sx, v * sy, st * sx + 1, st * sy + 1);
          const c = cnt[a.k] || (cnt[a.k] = [0, 0, 0]); c[0] += u; c[1] += v; c[2]++; break;
        }
      }
      g.font = `600 ${12 * dpr}px Inter, sans-serif`; g.textAlign = "center";
      for (const [kk, c] of Object.entries(cnt)) {
        if (c[2] < 40) continue;
        const x = Math.min(Wc - 40 * dpr, Math.max(40 * dpr, c[0] / c[2] * sx)), y = c[1] / c[2] * sy;
        g.fillStyle = "rgba(0,0,0,.55)"; const tw = g.measureText(NAME[kk]).width + 10 * dpr; g.fillRect(x - tw / 2, y - 9 * dpr, tw, 17 * dpr);
        g.fillStyle = "#fff"; g.fillText(NAME[kk], x, y + 4 * dpr);
      }
      g.textAlign = "start"; g.fillStyle = "rgba(255,255,255,.55)"; g.font = `${10.5 * dpr}px Inter, sans-serif`;
      g.fillText("skin / probe", 6 * dpr, 13 * dpr);
    }

    function drawCompound(g, k) {
      const G_ = G.compound, d = G_.d, n = d.n, phase2 = k >= n;
      g.fillStyle = "#0f1013"; g.fillRect(0, 0, cv.width, cv.height);
      const upto = Math.min(k, n - 1);
      g.save(); g.globalCompositeOperation = "screen";
      for (let i = 0; i <= upto; i++) texture(g, sprites.comp, (i % d.cols) * d.tw, Math.floor(i / d.cols) * d.th, d.tw, d.th, G_.P[i], i === upto && !phase2 ? 0.95 : 0.32);
      g.restore();
      for (let i = 0; i <= upto; i += 6) cam.poly(g, G_.P[i], null, "rgba(255,255,255,0.10)", 1 * dpr);
      if (!phase2) { cam.poly(g, G_.P[upto], null, "#19c48f", 2 * dpr); probe(g, G_.P[upto]); }
      else {
        const a = Math.min(1, (k - n) / 12);
        g.save(); g.globalAlpha = a; texture(g, imgs.compound, 0, 0, imgs.compound.naturalWidth || 480, imgs.compound.naturalHeight || 416, G_.NP, 0.95); g.restore();
        cam.poly(g, G_.NP, null, `rgba(86,180,233,${a})`, 2.5 * dpr);
        const [x, y] = cam.xy(G_.NP[1]); g.fillStyle = `rgba(86,180,233,${a})`; g.font = `600 ${12 * dpr}px Inter, sans-serif`;
        g.fillText("new plane (never acquired)", x + 6 * dpr, y - 6 * dpr);
      }
      g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 ${12 * dpr}px Inter, sans-serif`;
      g.fillText(phase2 ? "3D compound of the real sweep" : `real frame ${upto + 1} / ${n} placed at its probe pose`, 14 * dpr, cv.height - 14 * dpr);
      return phase2;
    }

    function frame(ts) {
      if (!root.isConnected) return;
      const dt = prevTs == null ? 0 : Math.min(0.1, (ts - prevTs) / 1000); prevTs = ts;
      const n = nOf(), fps = step === "compound" ? 9 : 12;
      if (playing && visible) { t += dt * fps; if (t > n - 1 + (step === "compound" ? 0 : 8)) t = 0; }
      const k = Math.min(n - 1, Math.floor(t));
      $(".scrub").value = Math.round(k / (n - 1) * 1000);
      if (k !== last) {
        last = k; const g = cv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0);
        if (step === "compound") {
          const p2 = drawCompound(g, k), cmp = $(".pr-cmp");
          if (p2 && !cmp.firstChild) {
            cmp.appendChild(compareSlider(A("assets/intro/compound.jpg"), A("assets/intro/ours.jpg"), "Compounding (re-slice)", "Ours"));
            cmp.style.display = "block"; us.style.display = "none"; $(".pr-real").textContent = "new plane";
          } else if (!p2 && cmp.firstChild) { cmp.innerHTML = ""; cmp.style.display = "none"; us.style.display = "block"; }
          if (!p2) { $(".pr-real").textContent = "real"; const u = us.getContext("2d"); spriteDraw(u, "comp", Math.min(k, G.compound.d.n - 1), 0, 0, us.width, us.height); }
        } else {
          const G_ = G[step]; drawNeck(G_, k); drawSchematic(G_, k);
          const u = us.getContext("2d"); spriteDraw(u, G_.key, k, 0, 0, us.width, us.height);
          u.fillStyle = "rgba(0,0,0,.55)"; u.fillRect(0, us.height - 22 * dpr, 150 * dpr, 22 * dpr); u.fillStyle = "#fff";
          u.font = `${11 * dpr}px Inter, sans-serif`;
          u.fillText(step === "turn" ? `probe rotated ${Math.round(G_.d.rot[k])}°` : `t = ${(k / G_.d.fps).toFixed(1)} s`, 8 * dpr, us.height - 7 * dpr);
        }
      }
      requestAnimationFrame(frame);
    }
    let visible = true;
    if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting)).observe(root);
    cam.drag(() => last = -1);
    addEventListener("resize", size);
    tabs.children[0].classList.add("on"); setStep("slice");
    let loaded = 0; Object.values(sprites).concat(Object.values(imgs)).forEach(im => im.complete ? loaded++ : im.addEventListener("load", () => { last = -1; }));
    requestAnimationFrame(() => { size(); requestAnimationFrame(frame); });
  }
  window.Primer = Primer;
  // [2026-11-24] Data section: the whole real hand-held sweep (I.sweep, every 2nd frame) placed frame by frame at its tracked
  // pose -> a 3D compound; right: the current real frame. Replaces the 3-step primer.
  function SweepCompound(root) {
    const I = window.INTRO; if (!I) return;
    const d = I.sweep, dpr = devicePixelRatio;
    root.innerHTML = `<div class="pr-grid two"><div class="pr-left"><canvas class="pr-cv"></canvas><div class="pr-hint">drag to rotate</div></div>
      <div class="pr-right"><div class="pr-imgwrap"><div class="pr-lab">Real frame <span class="fr"></span></div><canvas class="pr-us"></canvas></div></div></div>
      <div class="pr-foot"><button class="pp">❚❚</button><input type="range" class="scrub" min="0" max="1000" value="0">
      <div class="pr-kw"><span>Freehand 2D video</span><i>+</i><span>tracked 6-DoF probe pose</span><i>→</i><span>frames placed in 3D</span></div></div>`;
    const $ = q => root.querySelector(q), cv = $(".pr-cv"), us = $(".pr-us");
    const cam = new Cam(cv); cam.az = 0.75; cam.el = 0.42;
    const full = q => { const c = [0, 1, 2].map(i => (q[0][i] + q[1][i] + q[2][i] + q[3][i]) / 4); return q.map(p => p.map((x, i) => c[i] + 2 * (x - c[i]))); };
    const P = PoseView.canonical(d.plane.map(full)), n = P.length;   // stored corners = 2x2 cell centres -> full field of view
    const face = P.map(q => q[0].map((x, i) => (x + q[1][i]) / 2));
    const unit = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); }, sb = (a, b) => a.map((x, i) => x - b[i]);
    cam.pts = P.flat().concat(P.map(q => { const u = unit(sb(q[0], q[3])), w = Math.hypot(...sb(q[1], q[0])); return q[0].map((x, i) => x + u[i] * 0.3 * w); }));   // room for the probe
    const sprite = new Image(); sprite.src = A("assets/intro/sweep.jpg");
    const size = () => {
      const cw = us.parentNode.clientWidth; us.width = cw * dpr; us.height = Math.round(cw * d.th / d.tw) * dpr;
      us.style.width = cw + "px"; us.style.height = Math.round(cw * d.th / d.tw) + "px";
      const w = $(".pr-left").clientWidth, h = Math.max(Math.round(w * 0.55), $(".pr-right").offsetHeight - 2);
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px"; cam.fit(); last = -1;
    };
    const texture = (g, i, Q, alpha) => {
      const sx = (i % d.cols) * d.tw, sy = Math.floor(i / d.cols) * d.th;
      const [x0, y0] = cam.xy(Q[0]), [x1, y1] = cam.xy(Q[1]), [x3, y3] = cam.xy(Q[3]);
      g.save(); g.globalAlpha = alpha; g.setTransform((x1 - x0) / d.tw, (y1 - y0) / d.tw, (x3 - x0) / d.th, (y3 - y0) / d.th, x0, y0);
      g.drawImage(sprite, sx, sy, d.tw, d.th, 0, 0, d.tw, d.th); g.restore();
    };
    function probe(g, Q) {                                  // light probe body standing on the face edge
      const up = unit(sb(Q[0], Q[3])), F0 = Q[0], F1 = Q[1], ad = (a, b) => a.map((x, i) => x + b[i]), ml = (a, k) => a.map(x => x * k);
      const mid = ml(ad(F0, F1), 0.5), hw = ml(sb(F1, F0), 0.5);
      const nn = unit([hw[1] * up[2] - hw[2] * up[1], hw[2] * up[0] - hw[0] * up[2], hw[0] * up[1] - hw[1] * up[0]]);
      const box = (cx, a, h, th) => {
        const c = ad(mid, ml(up, cx)), A0 = sb(c, ml(hw, a)), A1 = ad(c, ml(hw, a)), T = ml(up, h), N = ml(nn, th);
        [[sb(A0, N), sb(A1, N), ad(sb(A1, N), T), ad(sb(A0, N), T)], [ad(A0, N), ad(A1, N), ad(ad(A1, N), T), ad(ad(A0, N), T)],
         [sb(A0, N), ad(A0, N), ad(ad(A0, N), T), ad(sb(A0, N), T)], [sb(A1, N), ad(A1, N), ad(ad(A1, N), T), ad(sb(A1, N), T)],
         [ad(sb(A0, N), T), ad(sb(A1, N), T), ad(ad(A1, N), T), ad(ad(A0, N), T)]]
          .forEach((f, i) => cam.poly(g, f, i === 4 ? "rgba(236,238,242,0.55)" : "rgba(196,200,208,0.45)", "#5b606b", 1 * dpr));
      };
      const w = Math.hypot(...sb(F1, F0)); box(0, 1.03, 0.07 * w, 0.05 * w); box(0.07 * w, 0.3, 0.2 * w, 0.035 * w);
    }
    let t = 0, last = -1, playing = true, prevTs = null, visible = true;
    const HOLD = 30;                                       // ticks to keep the full volume on screen before looping
    $(".pp").onclick = () => { playing = !playing; $(".pp").textContent = playing ? "❚❚" : "▶"; };
    $(".scrub").oninput = e => { playing = false; $(".pp").textContent = "▶"; t = e.target.value / 1000 * (n - 1); };
    cam.drag(() => last = -1);
    const frame = ts => {
      if (!root.isConnected) return;
      const dt = prevTs == null ? 0 : Math.min(0.1, (ts - prevTs) / 1000); prevTs = ts;
      if (playing && visible) { t += dt * 12; if (t > n - 1 + HOLD) t = 0; }
      const k = Math.min(n - 1, Math.floor(t)); $(".scrub").value = Math.round(k / (n - 1) * 1000);
      if (k !== last && sprite.complete) {
        last = k; const g = cv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = "#0f1013"; g.fillRect(0, 0, cv.width, cv.height);
        g.save(); g.globalCompositeOperation = "screen";
        for (let i = 0; i <= k; i++) texture(g, i, P[i], i === k ? 0.95 : 0.3);
        g.restore();
        for (let i = 0; i <= k; i += 8) cam.poly(g, P[i], null, "rgba(255,255,255,0.10)", 1 * dpr);
        cam.poly(g, P[k], null, "#19c48f", 2 * dpr); probe(g, P[k]);
        g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1.2 * dpr; g.beginPath();            // full tracked path (ahead)
        face.forEach((c, i) => { const [x, y] = cam.xy(c); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        g.strokeStyle = "#56b4e9"; g.lineWidth = 2.5 * dpr; g.beginPath();                            // scanned so far
        for (let i = 0; i <= k; i++) { const [x, y] = cam.xy(face[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        const L = 0.12 * Math.hypot(...sb(P[0][1], P[0][0]));
        for (let i = 0; i <= k; i += 12) {                                                              // probe orientation every 12 frames
          const q = P[i], o = face[i], ax = [unit(sb(q[1], q[0])), unit(sb(q[3], q[0]))];
          ax.push(unit([ax[0][1] * ax[1][2] - ax[0][2] * ax[1][1], ax[0][2] * ax[1][0] - ax[0][0] * ax[1][2], ax[0][0] * ax[1][1] - ax[0][1] * ax[1][0]]));
          ax.forEach((a, j) => { const [x0, y0] = cam.xy(o), [x1, y1] = cam.xy(o.map((x, t) => x + a[t] * L));
            g.strokeStyle = ["#E69F00", "#0072B2", "#009E73"][j]; g.lineWidth = 1.6 * dpr; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); });
        }
        cam.poly(g, P[k], null, "#19c48f", 2 * dpr);
        g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 ${12 * dpr}px Inter, sans-serif`;
        [["probe axes:", "rgba(255,255,255,.6)"], ["lateral", "#E69F00"], ["depth", "#56B4E9"], ["normal", "#2fc28f"]].reduce((x, [txt, c]) => { g.fillStyle = c; g.font = `500 ${11 * dpr}px Inter, sans-serif`; g.fillText(txt, x, cv.height - 13 * dpr); return x + g.measureText(txt).width + 8 * dpr; }, 14 * dpr);
        const u = us.getContext("2d"); u.drawImage(sprite, (k % d.cols) * d.tw, Math.floor(k / d.cols) * d.th, d.tw, d.th, 0, 0, us.width, us.height);
        $(".fr").textContent = `t = ${(k / d.fps).toFixed(1)} s`;
      }
      requestAnimationFrame(frame);
    };
    if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting)).observe(root);
    addEventListener("resize", size); sprite.onload = () => last = -1;
    requestAnimationFrame(() => { size(); requestAnimationFrame(frame); });
  }
  window.SweepCompound = SweepCompound;

})();

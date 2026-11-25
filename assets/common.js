// Shared helpers for index.html and select.html: arm labels, lazy pose loading, the probe-pose canvas synced to a video.
const FPS = 15;
const ARM_LABEL = {gt: "Ground Truth", ours: "Ours", cameractrl: "CameraCtrl", worldmem: "WorldMem", cam: "Context-as-Memory",
  g3c: "Gen3C", pnn: "Compounding (PNN)", pose_only: "Pose only", g60n: "w/o Memory", noprior: "w/o Prior"};
const ORGAN_LABEL = {thyroid: "Thyroid", kidney: "Kidney", spine: "Spine", thyroid_tilt: "Thyroid · probe tilt"};
// module badges for ablation columns: [Pose, Prior, Memory]
const ARM_MODS = {pose_only: [1, 0, 0], g60n: [1, 1, 0], noprior: [1, 0, 1], ours: [1, 1, 1]};
const MOD_STYLE = [["Pose", "#009e73"], ["Prior", "#e69f00"], ["Memory", "#3a9bd9"]];
function colLabels(m) {
  const abl = m.set && m.set.startsWith("abl");
  return m.arms.map(a => {
    let mods = "";
    if (abl && ARM_MODS[a]) mods = '<div class="mods">' + ARM_MODS[a].map((on, i) =>
      `<span class="${on ? "on" : "off"}" style="${on ? "background:" + MOD_STYLE[i][1] : ""}">${MOD_STYLE[i][0]}</span>`).join("") + "</div>";
    else if (abl) mods = '<div class="mods"><span class="off" style="visibility:hidden">·</span></div>';
    return `<div class="${a === "ours" ? "ours" : a === "gt" ? "gt" : ""}">${ARM_LABEL[a] || a}${mods}</div>`;
  }).join("");
}
const CAT_LABEL = {short: "Short clip", "return": "Return (revisit)", turn: "Turn"};

function ref(m) { return `${m.organ}/${m.set}/${m.id}`; }
function A(p) { return (window.INLINE || {})[p] || p; }      // single-file preview: data URIs keyed by asset path
function src(m, ext) { return A(`assets/pool/${m.organ}/${m.set}/${m.id}.${ext}`); }
function findMeta(r) {             // r = "organ/set/id" or "organ/set/id|cat" (category override from select.html)
  const [path, cat] = r.split("|"), [o, s, id] = path.split("/");
  const m = ((window.POOL[o] || {})[s] || []).find(m => m.id === id);
  return m && cat ? Object.assign({}, m, {cat}) : m;
}

const _poseWait = {};
function loadPose(m) {           // lazy <script> load so the page also works from file://
  const k = ref(m);
  window.POSE = window.POSE || {};
  if (window.POSE[k]) return Promise.resolve(window.POSE[k]);
  if (!_poseWait[k]) _poseWait[k] = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src(m, "pose.js");
    s.onload = () => res(window.POSE[k]); s.onerror = rej; document.head.appendChild(s);
  });
  return _poseWait[k];
}

// Probe-pose view: scan-frame axes x = scan, y = lateral, z = depth (drawn downward). Drag to rotate.
class PoseView {
  static ALT_COL = ["#e69f00", "#cc79a7"];                       // probe shifted left / right
  constructor(canvas, pose, video, opts = {}) {
    // stored corners are the centres of a 2x2 grid over the image (quarter depth / quarter width):
    // expand x2 about the plane centre -> full field of view with the top edge on the skin; convex probe (kidney) -> fan
    const full = q => {
      const c = [0, 1, 2].map(i => (q[0][i] + q[1][i] + q[2][i] + q[3][i]) / 4);
      let r = q.map(p => p.map((x, i) => c[i] + 2 * (x - c[i])));
      if (opts.fan) {
        const top = [0, 1, 2].map(i => (r[0][i] + r[1][i]) / 2);
        r = [r[0].map((x, i) => top[i] + 0.3 * (x - top[i])), r[1].map((x, i) => top[i] + 0.3 * (x - top[i])), r[2], r[3]];
      }
      return r;
    };
    pose = Object.assign({}, pose, {plane: pose.plane.map(full), mem: pose.mem ? pose.mem.map(full) : pose.mem,
                                    alt: (pose.alt || []).map(a => Object.assign({}, a, {plane: a.plane.map(full)}))});
    const n0 = pose.plane.length, extra = [...(pose.mem || []), ...pose.alt.flatMap(a => a.plane)];
    const all = PoseView.canonical([...pose.plane, ...extra]);          // memory / shifted planes share the frame
    this.mem = pose.mem ? all.slice(n0, n0 + pose.mem.length) : null; this.rotLab = pose.mem ? "off-sweep" : "tilt";
    let k0 = n0 + (pose.mem ? pose.mem.length : 0);
    this.alt = pose.alt.map((a, i) => ({label: a.label, col: PoseView.ALT_COL[i % 2], p: all.slice(k0 + i * n0, k0 + (i + 1) * n0)}));
    this.c = canvas; this.p = all.slice(0, pose.plane.length); this.rot = pose.rot; this.match = pose.match; this.v = video;
    this.az = 0.55; this.el = 0.32; this.n = this.p.length;
    this.face = this.p.map(q => q.slice(0, 2).reduce((a, b) => a.map((x, i) => x + b[i] / 2), [0, 0, 0]));
    this.fit(); this.bindDrag(); this.last = -1;
    const loop = () => { if (!this.c.isConnected) return; this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // Same view for every organ: frame-0 plane normal = scan axis (points along the motion, drawn left -> right),
  // its face edge = lateral, depth = down. Returns corners in (scan, lateral, depth) mm.
  static canonical(P) {
    const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const nrm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const q = P[0], lat = nrm(sub(q[1], q[0]));
    let dep = sub(q[3], q[0]); dep = nrm(sub(dep, lat.map(x => x * dot(dep, lat))));
    let scan = nrm(cross(lat, dep));
    const c = k => P[k].reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]);
    let far = 0, best = -1;                               // farthest frame from the start = main sweep direction
    for (let k = 0; k < P.length; k++) { const d = Math.hypot(...sub(c(k), c(0))); if (d > best) { best = d; far = k; } }
    if (dot(sub(c(far), c(0)), scan) < 0) scan = scan.map(x => -x);
    const o = c(0);
    return P.map(f => f.map(v => { const d = sub(v, o); return [dot(d, scan), dot(d, lat), dot(d, dep)]; }));
  }
  proj(q) {                                               // q = (scan, lateral, depth); az turns about the depth axis
    const [x, y, z] = q, ca = Math.cos(this.az), sa = Math.sin(this.az);
    const u = x * ca + y * sa, w = -x * sa + y * ca;
    return [u, z * Math.cos(this.el) - w * Math.sin(this.el)];
  }
  fit() {
    let lo = [1e9, 1e9], hi = [-1e9, -1e9];
    for (const q of [...this.p, ...(this.alt || []).flatMap(a => a.p)]) for (const c of q) { const s = this.proj(c); for (let i = 0; i < 2; i++) { lo[i] = Math.min(lo[i], s[i]); hi[i] = Math.max(hi[i], s[i]); } }
    const W = this.c.width, H = this.c.height, pad = 14 * devicePixelRatio;
    this.k = Math.min((W - 2 * pad) / (hi[0] - lo[0] + 1e-6), (H - 2 * pad - 14 * devicePixelRatio) / (hi[1] - lo[1] + 1e-6));
    this.o = [W / 2 - this.k * (lo[0] + hi[0]) / 2, (H - 14 * devicePixelRatio) / 2 - this.k * (lo[1] + hi[1]) / 2];
    this.last = -1;
  }
  xy(q) { const s = this.proj(q); return [this.o[0] + this.k * s[0], this.o[1] + this.k * s[1]]; }
  bindDrag() {
    let d = null;
    this.c.addEventListener("pointerdown", e => { d = [e.clientX, e.clientY, this.az, this.el]; this.c.setPointerCapture(e.pointerId); });
    this.c.addEventListener("pointermove", e => {
      if (!d) return;
      this.az = d[2] + (e.clientX - d[0]) * 0.01; this.el = Math.max(-1.4, Math.min(1.4, d[3] + (e.clientY - d[1]) * 0.01)); this.fit();
    });
    this.c.addEventListener("pointerup", () => d = null);
  }
  quad(g, q, fill, stroke, lw) {
    g.beginPath(); q.forEach((c, i) => { const [x, y] = this.xy(c); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  draw() {
    const t = Math.min(this.n - 1, Math.max(0, Math.floor((this.v ? this.v.currentTime : 0) * FPS + 1e-3)));
    if (t === this.last) return; this.last = t;
    const g = this.c.getContext("2d"), r = devicePixelRatio; g.clearRect(0, 0, this.c.width, this.c.height);
    if (this.mem) for (const q of this.mem) this.quad(g, q, "rgba(120,120,120,0.06)", "rgba(90,90,90,0.28)", 1 * r);   // real sweep = memory
    for (let i = 0; i < this.n; i += 24) this.quad(g, this.p[i], null, "rgba(0,0,0,0.10)", 1 * r);   // sparse ghost planes = whole path
    g.lineWidth = 1.5 * r; g.strokeStyle = "#c9c9c9"; g.beginPath();
    this.face.forEach((c, i) => { const [x, y] = this.xy(c); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.lineWidth = 2.5 * r; g.strokeStyle = "#3a9bd9"; g.beginPath();                                   // already scanned (memory)
    for (let i = 0; i <= t; i++) { const [x, y] = this.xy(this.face[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    for (const a of this.alt || []) {                                                                  // commanded (shifted) paths
      const fa = a.p.map(q => q.slice(0, 2).reduce((u, w) => u.map((x, i) => x + w[i] / 2), [0, 0, 0]));
      g.lineWidth = 2 * r; g.strokeStyle = a.col; g.beginPath();
      for (let i = 0; i <= t; i++) { const [x, y] = this.xy(fa[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.setLineDash([4 * r, 3 * r]); this.quad(g, a.p[t], null, a.col, 2 * r); g.setLineDash([]);
    }
    const j = this.match ? this.match[t] : -1;
    this.quad(g, this.p[t], "rgba(0,158,115,0.28)", "#009e73", 2 * r);                                 // current probe plane
    if (j >= 0) {                     // first visit of this pose, drawn on top (it usually coincides with the current plane)
      g.setLineDash([5 * r, 4 * r]); this.quad(g, this.p[j], "rgba(230,159,0,0.22)", "#e69f00", 2.5 * r); g.setLineDash([]);
      const [x, y] = this.xy(this.face[j]); g.fillStyle = "#e69f00"; g.beginPath(); g.arc(x, y, 4 * r, 0, 7); g.fill();
    }
    const [a, b] = [this.xy(this.p[t][0]), this.xy(this.p[t][1])];
    g.strokeStyle = "#1f1f1f"; g.lineWidth = 4 * r; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();   // probe face
    g.fillStyle = "#737885"; g.font = `500 ${11 * r}px Inter, sans-serif`;
    g.fillText(`t = ${(t / FPS).toFixed(1)} s   ${this.rotLab} ${Math.round(this.rot[t] || 0)}°`, 6 * r, this.c.height - 5 * r);
  }
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas"); c.width = w * devicePixelRatio; c.height = h * devicePixelRatio;
  c.style.width = w + "px"; c.style.height = h + "px"; c.className = "posecv"; c.title = "GT probe pose (drag to rotate)"; return c;
}

// A synced player block: [pose canvas] [column labels + strip video] + controls
function player(m, opts = {}) {
  const el = document.createElement("div"); el.className = "player";
  const left = document.createElement("div"); left.className = "poseside";
  left.innerHTML = `<div class="ttl">${m.rowlabels && m.rows === 3 ? "Probe poses: real / shifted" : "GT probe pose"}</div>`;
  const cv = makeCanvas(opts.poseW || 190, opts.poseH || 170); left.appendChild(cv);
  const leg = document.createElement("div"); leg.className = "poseleg";
  leg.innerHTML = `<span class="sw" style="background:#009e73;margin-left:2px"></span>probe <span class="sw" style="background:#3a9bd9"></span>scanned`;
  left.appendChild(leg);
  const right = document.createElement("div"); right.className = "vidside";
  // opts.cols = subset of arms to show: the strip video plays hidden and the chosen columns are copied to a canvas (stays in sync)
  const ORDER = ["cameractrl", "worldmem", "cam", "g3c", "pose_only", "g60n", "noprior"];
  const arms = opts.cols || [...ORDER.filter(a => m.arms.includes(a)), ...m.arms.filter(a => !ORDER.includes(a) && a !== "ours" && a !== "gt"),
                             ...["ours", "gt"].filter(a => m.arms.includes(a))];
  const lab = document.createElement("div"); lab.className = "collab"; lab.style.gridTemplateColumns = `repeat(${arms.length},1fr)`;
  lab.innerHTML = colLabels(Object.assign({}, m, {arms}));
  const v = document.createElement("video"); v.muted = true; v.loop = true; v.playsInline = true; v.preload = opts.preload || "metadata";
  v.poster = src(m, "jpg"); v.src = src(m, "mp4");
  const ctl = document.createElement("div"); ctl.className = "ctl";
  ctl.innerHTML = `<button class="pp">▶</button><span class="scwrap"><input type="range" min="0" max="${m.n - 1}" value="0" class="scrub"><span class="marks"></span></span>
    <select class="spd"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>${opts.meta ? `<span class="meta">${opts.meta}</span>` : ""}`;
  const pp = ctl.querySelector(".pp"), sc = ctl.querySelector(".scrub");
  pp.onclick = () => (v.paused ? v.play() : v.pause());
  let disp = v;
  if (arms.join() !== m.arms.join()) {              // columns cropped / reordered from the strip video
    const PITCH = 242, TW = 240, idx = arms.map(a => m.arms.indexOf(a));
    const cc = document.createElement("canvas"); cc.width = idx.length * PITCH - 2; cc.height = m.h; cc.className = "cropv";
    const poster = new Image(); poster.src = src(m, "jpg");
    let lastT = -1;
    const draw = () => {
      if (!cc.isConnected && lastT >= 0) return;
      const live = v.readyState >= 2, key = live ? v.currentTime : -2;
      if (key !== lastT && (live || poster.complete)) {
        const g = cc.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cc.width, cc.height);
        idx.forEach((i, j) => g.drawImage(live ? v : poster, i * PITCH, 0, TW, m.h, j * PITCH, 0, TW, m.h));
        lastT = key;
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    v.className = "hiddenv"; disp = cc;
  }
  disp.onclick = pp.onclick;
  const wrap = document.createElement("div"); wrap.className = "dispwrap"; wrap.appendChild(disp);
  v.onplay = () => pp.textContent = "❚❚"; v.onpause = () => pp.textContent = "▶";
  v.ontimeupdate = () => sc.value = Math.floor(v.currentTime * FPS);
  sc.oninput = () => { v.pause(); v.currentTime = (+sc.value + 0.5) / FPS; };
  ctl.querySelector(".spd").onchange = e => v.playbackRate = +e.target.value;
  if (m.rowlabels && m.rows === 3) leg.innerHTML = `<span class="sw" style="background:#009e73;margin-left:2px"></span>real path<br>`
    + `<span class="sw" style="background:#e69f00;margin-left:2px"></span>${m.rowlabels[1]}<br><span class="sw" style="background:#cc79a7;margin-left:2px"></span>${m.rowlabels[2]}`;
  if (m.set === "comp") leg.innerHTML += `<br><span class="sw" style="background:#9a9a9a;margin-left:2px"></span>real sweep (memory)`;
  if (m.rows >= 2) {                                    // return clips: now / earlier; pose following: original / left / right
    const vw = document.createElement("div"); vw.className = "vrows";
    const RL = m.rowlabels || ["Now", "Same pose,<br>earlier"];
    vw.innerHTML = `<div class="rowlab">${RL.map((t, i) => `<span class="${i ? "ea" : ""}">${t}</span>`).join("")}</div>`;
    vw.appendChild(wrap); right.append(lab, vw, ctl);
    lab.style.marginLeft = "30px";
    if (!m.rowlabels) leg.innerHTML += `<br><span class="sw" style="background:#e69f00;margin-left:2px"></span>earlier visit`;
  } else right.append(lab, wrap, ctl);
  if (disp !== v) right.appendChild(v);
  addCaptions(right, wrap, ctl, v, m, arms, opts.capKey);
  right.style.setProperty("--ncol", arms.length);                        // style.css sizes the strip as ncol x --tile
  right.style.setProperty("--rl", m.rows >= 2 ? "30px" : "0px");         // + the row-label gutter of multi-row clips
  el.append(left, right);
  loadPose(m).then(p => new PoseView(cv, p, v, {fan: m.organ === "kidney"})).catch(() => left.innerHTML = "<i>pose n/a</i>");
  if (opts.autoplay) autoPlayWhenVisible(v);
  return el;
}

const _io = ("IntersectionObserver" in window) ? new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
}), {threshold: 0.35}) : null;
function autoPlayWhenVisible(v) { if (_io) _io.observe(v); }

// Before/after slider: left = a, right = b.
function compareSlider(a, b, la, lb) {
  const el = document.createElement("div"); el.className = "cmp";
  el.innerHTML = `<img class="b" src="${b}"><div class="aw"><img class="a" src="${a}"></div><div class="bar"><span>&#x2194;</span></div>
    <div class="tag l">${la}</div><div class="tag r">${lb}</div>`;
  const aw = el.querySelector(".aw"), bar = el.querySelector(".bar"), ai = el.querySelector(".a");
  const set = f => { f = Math.max(0, Math.min(1, f)); aw.style.width = f * 100 + "%"; bar.style.left = f * 100 + "%"; };
  const fit = () => ai.style.width = el.clientWidth + "px";
  new ResizeObserver(fit).observe(el);
  let drag = false;
  const mv = e => { if (!drag) return; const r = el.getBoundingClientRect(); set((e.clientX - r.left) / r.width); };
  el.addEventListener("pointerdown", e => { drag = true; el.setPointerCapture(e.pointerId); mv(e); });
  el.addEventListener("pointermove", mv); el.addEventListener("pointerup", () => drag = false);
  set(0.5); return el;
}

// ---- per-video captions (assets/captions.js): a paragraph + timed moments with scrub-bar marks and column highlights.
// window.CAPTIONS[key] = {text, moments: [{t, dur, label, text, cols: [arm...], tag, pause}]}; empty entries are not shown.
function addCaptions(right, wrap, ctl, v, m, arms, key) {
  const C = (window.CAPTIONS || {})[key] || {};
  const moments = (C.moments || []).filter(x => x && x.text);
  if (!C.text && !moments.length) return;
  const dur = () => (v.duration && isFinite(v.duration)) ? v.duration : m.n / FPS;
  const box = document.createElement("div"); box.className = "caps";
  if (C.text) box.insertAdjacentHTML("beforeend", `<p class="captext">${C.text}</p>`);
  const list = document.createElement("div"); list.className = "moments"; box.appendChild(list);
  const marks = ctl.querySelector(".marks");
  const hl = document.createElement("div"); hl.className = "hlayer"; wrap.appendChild(hl);
  const items = moments.map((mo, i) => {
    const b = document.createElement("button"); b.className = "moment";
    b.innerHTML = `<span class="mt">${mo.t.toFixed(1)} s</span><b>${mo.label || ""}</b><span class="mx">${mo.text}</span>`;
    const seek = () => { v.pause(); v.currentTime = mo.t + 0.01; };
    b.onclick = seek; list.appendChild(b);
    const mk = document.createElement("span"); mk.className = "mark"; mk.title = mo.label || mo.text;
    const place = () => mk.style.left = (100 * mo.t / dur()) + "%"; place(); v.addEventListener("loadedmetadata", place);
    mk.onclick = seek; marks.appendChild(mk);
    return b;
  });
  let active = -1, paused = new Set();
  const tick = () => {
    const t = v.currentTime;
    const a = moments.findIndex(mo => t >= mo.t && t < mo.t + (mo.dur || 2));
    if (a !== active) {
      active = a; items.forEach((b, i) => b.classList.toggle("on", i === a));
      hl.innerHTML = "";
      if (a >= 0) {
        const mo = moments[a];
        for (const c of mo.cols || []) {
          const i = arms.indexOf(c); if (i < 0) continue;
          hl.insertAdjacentHTML("beforeend", `<div class="hlbox" style="left:${100 * i / arms.length}%;width:${100 / arms.length}%">${mo.tag ? `<span>${mo.tag}</span>` : ""}</div>`);
        }
        if (mo.pause && !paused.has(a) && !v.paused) { paused.add(a); v.pause(); }
      }
      if (a < 0) paused.forEach(i => { if (Math.abs(t - moments[i].t) > (moments[i].dur || 2) + 0.5) paused.delete(i); });
    }
    if (right.isConnected) requestAnimationFrame(tick);
  };
  right.appendChild(box);
  requestAnimationFrame(tick);
}

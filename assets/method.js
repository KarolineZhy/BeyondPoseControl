/* [2026-11-24] Method walkthrough: Alg. 1 step by step on the PAPER'S method figure (assets/method_fig.js = pipeline.pdf as SVG,
   _src/prep_method_fig.py). Each step lights the parts of the figure it uses and greys the rest (no redrawing); the algorithm line
   is lit on the right; below, the same step on a real rollout (thyroid forward sweep ca_demo11, final model, I0 + 3 chunks; the lobe appears and leaves the plane;
   assets/method_data.js + assets/intro/m_{gen,mem,pri}.jpg from _src/prep_method.py). Previous self-drawn version: _src/method_selfdrawn_bak_20261124.js. v4 (2026-11-25): 3 chunks (new / memory hit / new), memory + prior play with the pose. */
(function () {
  const C = {pose: "#009E73", mem: "#0072B2", pri: "#E27A00", ink: "#1d1f24", mute: "#8a8f99", line: "#dedad2"};
  const ease = u => u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u), seg = (u, a, b) => ease((u - a) / (b - a)), lerp = (a, b, u) => a + (b - a) * u;
  const ALG = [
    "X<sub>ctx</sub> ← I<sub>0</sub>",
    "<b class='pa'><i>A</i></b> ← μ",
    "<b class='me'><i>M</i></b> ← empty volume",
    "<b>for</b> k = 1 … K",
    "&nbsp;&nbsp;<b class='po'>c<sub><i>P</i></sub></b> ← PointMap(P<sup>k</sup>)",
    "&nbsp;&nbsp;<b class='me'>c<sub><i>M</i></sub></b> ← Reslice(<b class='me'><i>M</i></b>, P<sup>k</sup>)",
    "&nbsp;&nbsp;<b class='pa'>c<sub><i>A</i></sub></b> ← Reslice(<b class='pa'><i>A</i></b>, P<sup>k</sup>)",
    "&nbsp;&nbsp;X̂<sup>k</sup> ~ p<sub>θ</sub>(X<sup>k</sup> | X<sub>ctx</sub>, <b class='po'>c<sub><i>P</i></sub></b>, <b class='me'>c<sub><i>M</i></sub></b>, <b class='pa'>c<sub><i>A</i></sub></b>)",
    "&nbsp;&nbsp;<b class='me'><i>M</i></b> ← Compound(<b class='me'><i>M</i></b>, X̂<sup>k</sup>, P<sup>k</sup>)",
    "&nbsp;&nbsp;<b class='pa'><i>A</i></b> ← Posterior(<b class='me'><i>M</i></b>)",
    "&nbsp;&nbsp;X<sub>ctx</sub> ← last frame of X̂<sup>k</sup>",
    "<b>end for</b>",
    "<b>return</b> X̂<sup>1:K</sup>",
  ];

  // parts of the paper figure, by position (figure points, 682 x 267)
  function region(x, y) {
    if (y < 16) return "title";
    if (y >= 249) return "legend";
    if (x < 432) {
      if (y < 46 && x < 125) return "img_in";
      if (y < 80 && x < 125) return "pose_in";
      if (y < 73 && x < 312) return "vdm";
      if (y < 95 && x >= 300) return "dec";
      if (y < 95) return x < 183 ? "reslice" : x < 212 ? "cM" : x < 245 ? "cA" : "update";
      if (x < 62) return y < 172 ? "memlab" : "prilab";
      const c = x < 180 ? 1 : x < 300 ? 2 : 3;
      return (y < 160 ? "mem" : y < 181 ? "chunk" : "pri") + c;
    }
    if (x >= 641 || (x >= 615 && y > 180 && y < 216)) return "psi";
    return y < 46 ? "priB" : y < 72 ? "memB" : y < 92 ? "poseB" : y < 128 ? "imgB" : y < 147 ? "concat" : y < 172 ? "patch" : y < 216 ? "dit" : "gentok";
  }
  // what each step lights in the figure. Chunk 1 line by line; chunks 2 (memory hit) and 3 (new region) as reslice / generate / update;
  // figure columns: chunk 1 = first chunk, chunk 2 = memory read-out filled, chunk k = new region (read-out empty)
  const GEN = ["img_in", "pose_in", "reslice", "cM", "cA", "vdm", "dec", "priB", "memB", "poseB", "imgB", "concat", "patch", "dit", "gentok", "psi"];
  const RES = c => ["pose_in", "memlab", "prilab", `mem${c}`, `pri${c}`, `chunk${c}`, "reslice", "cM", "cA"];
  const ONSET = {
    l1: ["img_in"], l2: ["prilab", "pri1"], l3: ["memlab", "mem1"],
    l5: ["pose_in"], l6: ["memlab", "mem1", "reslice", "cM"], l7: ["prilab", "pri1", "reslice", "cA"], l8: GEN,
    l9: ["dec", "update", "memlab", "mem2", "chunk2"], l10: ["dec", "update", "prilab", "pri2", "chunk2"], l11: ["dec", "img_in"],
    c2res: RES(2), c2gen: GEN, c2upd: ["dec", "update", "memlab", "prilab", "mem3", "pri3", "chunk3"],
    c3res: RES(3), c3gen: GEN,
    end: ["dec"],
  };
  const ON = ph => new Set(["title", "legend"].concat(ONSET[ph]));

  function MethodAnim(root) {
    const D = window.METHOD; if (!D || !window.METHOD_SVG) return;
    const K = (D.n - 1) / D.chunk, CH = D.chunk;
    // the second illustrated chunk = the first one whose memory read-out is mostly filled (the probe comes back)
    const fillOf = k => D.empty.slice((k - 1) * CH + 1, k * CH + 1).filter(e => !e).length / CH;
    const K2 = [...Array(K).keys()].map(i => i + 1).find(k => k > 1 && fillOf(k) > 0.5) || 2;
    root.innerHTML = `<div class="mth"><div class="mth-stage"><div class="mth-cap"><b></b><span></span></div><div class="mth-svg">${window.METHOD_SVG}</div>
        <div class="mth-real-h">Real example · thyroid</div><canvas></canvas>
        <div class="mth-ctl"><button class="pp" title="play / pause">❚❚</button><button class="st prev" title="previous step">‹</button><button class="st next" title="next step">›</button>
        <div class="mth-bar"><div class="mth-fill"></div></div><div class="mth-dots"></div></div></div>
      <div class="mth-alg"><div class="mth-alg-h">Algorithm 1 · chunk-wise generation</div>${ALG.map((l, i) => `<div class="al" data-i="${i}"><span class="ln">${i + 1}</span><span>${l}</span></div>`).join("")}</div></div>`;

    // ---- classify the leaves of the figure once (bounding-box centre -> part)
    const svg = root.querySelector(".mth-svg svg"); svg.removeAttribute("width"); svg.removeAttribute("height");
    let leaves = null, litKey = "";
    const classify = () => {
      const R = svg.getBoundingClientRect(); if (!R.width) return false;
      const vb = svg.viewBox.baseVal, sx = vb.width / R.width, sy = vb.height / R.height;
      leaves = [...svg.querySelectorAll("path, image, use")].filter(e => !e.closest("defs, clipPath, mask")).map(e => {
        const b = e.getBoundingClientRect(); return [e, region((b.left + b.width / 2 - R.left) * sx, (b.top + b.height / 2 - R.top) * sy)];
      });
      return true;
    };
    const light = ph => {
      if (ph === litKey || (!leaves && !classify())) return; litKey = ph;
      const on = ON(ph); leaves.forEach(([e, r]) => e.classList.toggle("off", ph !== "end" && !on.has(r)));   // result: whole figure, nothing greyed
    };

    // ---- real example strip: Context | Memory | Prior | Generated (same size) + small overview of the generated video
    const cv = root.querySelector("canvas"), g = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), W = 760, H = 256;
    const sp = {}; ["gen", "mem", "pri", "pp"].forEach(k => { sp[k] = new Image(); sp[k].src = A(`assets/intro/m_${k}.jpg`); });
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
    const text = (s, x, y, o = {}) => { g.font = `${o.w || 500} ${o.s || 12}px Inter, system-ui, sans-serif`; g.fillStyle = o.c || C.ink; g.textAlign = o.a || "left"; g.fillText(s, x, y); g.textAlign = "left"; };
    const slot = (x, y, w, h) => { rr(x, y, w, h, 7); g.fillStyle = "#f4f2ed"; g.fill(); g.strokeStyle = C.line; g.lineWidth = 1; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); };
    const tile = (k, i, x, y, w, h, col, a = 1, lw = 2) => {
      g.save(); g.globalAlpha = a; rr(x, y, w, h, 7); g.save(); g.clip();
      const emp = k === "mem" && D.empty[i];
      if (emp) { g.fillStyle = "#f1efe9"; g.fillRect(x, y, w, h); text("∅", x + w / 2, y + h / 2 + 10, {s: 30, w: 400, c: C.mem, a: "center"}); }
      else if (sp[k].complete) g.drawImage(sp[k], (i % D.cols) * D.tw, Math.floor(i / D.cols) * D.th, D.tw, D.th, x, y, w, h);
      g.restore(); rr(x, y, w, h, 7); g.strokeStyle = col; g.lineWidth = lw; if (emp) g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); g.restore();
    };

    const ppTile = (i, x, y, w, h, a, lw) => {
      g.save(); g.globalAlpha = a; rr(x, y, w, h, 7); g.save(); g.clip(); if (sp.pp.complete) g.drawImage(sp.pp, i * D.tw, 0, D.tw, D.th, x, y, w, h);
      g.restore(); rr(x, y, w, h, 7); g.strokeStyle = C.pri; g.lineWidth = lw; g.stroke(); g.restore();
    };
    // ---- script
    const STEPS = [
      {ph: "l1", k: 0, line: [0], dur: 2.4, cap: ["Line 1", "first frame = image condition"]},
      {ph: "l2", k: 0, line: [1], dur: 2.4, cap: ["Line 2", "prior starts as the population mean"]},
      {ph: "l3", k: 0, line: [2], dur: 2.4, cap: ["Line 3", "memory starts empty"]},
      {ph: "l5", k: 1, line: [3, 4], dur: 2.2, cap: ["Chunk 1 · line 5", "probe poses → point map"]},
      {ph: "l6", k: 1, line: [3, 5], dur: 2.6, cap: ["Chunk 1 · line 6", "reslice memory at the poses → ∅"]},
      {ph: "l7", k: 1, line: [3, 6], dur: 2.6, cap: ["Chunk 1 · line 7", "reslice prior at the poses"]},
      {ph: "l8", k: 1, line: [3, 7], dur: 4.0, cap: ["Chunk 1 · line 8", "generate"]},
      {ph: "l9", k: 1, line: [3, 8], dur: 2.2, cap: ["Chunk 1 · line 9", "compound into memory"]},
      {ph: "l10", k: 1, line: [3, 9], dur: 2.2, cap: ["Chunk 1 · line 10", "update the prior"]},
      {ph: "l11", k: 1, line: [3, 10], dur: 1.6, cap: ["Chunk 1 · line 11", "last frame → next context"]},
      {ph: "c2res", k: K2, line: [3, 4, 5, 6], dur: 2.8, cap: [`Chunk ${K2} · back`, "reslice → memory has this region"]},
      {ph: "c2gen", k: K2, line: [3, 7], dur: 4.0, cap: [`Chunk ${K2} · back`, "generate"]},
      {ph: "end", k: 9, line: [12], dur: 10, cap: ["Result", "generated video"]},
    ];
    const T0 = []; let tot = 0; STEPS.forEach(s => { T0.push(tot); tot += s.dur; });
    const PH = ["res", "gen", "upd"], stage = s => s.ph.startsWith("c") ? PH.indexOf(s.ph.slice(2)) : {l5: 0, l6: 0, l7: 0, l8: 1, l9: 2, l10: 2, l11: 2}[s.ph] ?? -1;
    const genDone = (s, kk) => s.ph === "end" || s.k > kk || (s.k === kk && stage(s) >= 2);   // chunks between 1 and K2 count as done

    const TW = 166, TH = 144, L = {ctx: 0, mem: 198, pri: 396, gen: 594, ty: 30, tl: [0, 212, 760, 38]};
    function strip(s, u) {
      g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); g.clearRect(0, 0, W, H);
      const lab = (t, x, c, sub) => { text(t, x, 20, {s: 15, w: 700, c}); if (sub) text(sub, x, L.ty + TH + 15, {s: 11, w: 600, c}); };
      const k = Math.max(1, Math.min(K, s.k)), c0 = (k - 1) * CH + 1, c1 = k * CH, st = stage(s);
      // frame shown in the tiles: the chunk's first pose while reslicing, playing through the chunk while generating, the whole video at the end
      const cur = s.ph === "end" ? 1 + Math.floor(u * (D.n - 2)) : st === 1 || (st === 0 && s.ph.startsWith("c")) ? Math.round(lerp(c0, c1, seg(u, 0.05, 0.95))) : st === 0 ? c0 : c1;
      const on = new Set({l6: ["mem"], l7: ["pri"], l8: ["ctx", "mem", "pri", "gen"], l9: ["mem"], l10: ["pri"], l11: ["ctx"],
        c2res: ["mem", "pri"], c2gen: ["ctx", "mem", "pri", "gen"], c2upd: ["mem", "pri"], c3res: ["mem", "pri"], c3gen: ["ctx", "mem", "pri", "gen"],
        end: ["gen"]}[s.ph] || []);
      const al = key => on.has(key) ? 1 : 0.32;
      const init = s.k === 0 || s.ph === "l5";                // initialisation: nothing to show below yet
      const ctxI = s.ph === "l11" && u > 0.4 ? c1 : c0 - 1;
      if (s.ph !== "end") { lab("Context", L.ctx, on.has("ctx") ? C.ink : C.mute); lab("Memory", L.mem, on.has("mem") ? C.mem : C.mute);
        lab("Prior", L.pri, on.has("pri") ? C.pri : C.mute); } if (s.ph === "end") text("Generated video", W / 2, 20, {s: 15, w: 700, a: "center"}); else lab(`Generated · chunk ${k}`, L.gen, on.has("gen") ? C.ink : C.mute);
      if (s.ph === "end") { /* result: only the generated video */ } else if (init) slot(L.ctx, L.ty, TW, TH); else tile("gen", ctxI, L.ctx, L.ty, TW, TH, C.ink, al("ctx"));
      const memShown = !init && !(s.ph === "l6" && u < 0.25), priShown = !init && s.ph !== "l6" && !(s.ph === "l7" && u < 0.25);
      if (s.ph === "end") { /* nothing */ } else if (s.ph === "l9" || s.ph === "l10" || s.ph === "l11") tile("gen", c1, L.mem, L.ty, TW, TH, C.mem, al("mem"), on.has("mem") ? 2.5 : 1.5);   // just written
      else if (memShown) tile("mem", cur, L.mem, L.ty, TW, TH, C.mem, al("mem"), on.has("mem") ? 2.5 : 1.5); else slot(L.mem, L.ty, TW, TH);
      // prior tile = the first version's pixel-level prior images (assets/intro/m_pp.jpg, _src/prep_method_pp.py): 0 = population mean, then sharper
      const ppI = s.k >= K2 && s.ph !== "end" ? Math.min(6, K2) : (s.ph === "l10" || s.ph === "l11") ? 2 : 0;
      // from chunk K2 on the prior follows the probe: pixel-level posterior resliced at the current pose (m_pri.jpg, _src/prep_method_pxprior.py)
      if (s.ph === "end") { /* nothing */ } else if (priShown && s.k >= K2) tile("pri", cur, L.pri, L.ty, TW, TH, C.pri, al("pri"), on.has("pri") ? 2.5 : 1.5);
      else if (priShown) ppTile(ppI, L.pri, L.ty, TW, TH, al("pri"), on.has("pri") ? 2.5 : 1.5); else slot(L.pri, L.ty, TW, TH);
      if (s.ph === "end") tile("gen", cur, (W - TW) / 2, L.ty, TW, TH, "#3a3d45", 1);       // result: the generated video, centred
      else if (st >= 1) tile("gen", cur, L.gen, L.ty, TW, TH, "#3a3d45", al("gen"));
      else slot(L.gen, L.ty, TW, TH);
      if (st === 1) { g.save(); g.globalAlpha = 1 - seg(u, 0, 0.25); rr(L.gen, L.ty, TW, TH, 7); g.fillStyle = "#8a8d96"; g.fill(); g.restore(); }
      const memSub = {l6: "∅ · nothing generated here", l9: "chunk 1 written", c2res: "generated here before", c2upd: "chunk 2 written", c3res: "runs out → ∅ in the new region"}[s.ph];
      const priSub = {l7: "population mean", l10: "updated", c2res: "updated"}[s.ph];
      if (memSub) text(memSub, L.mem, L.ty + TH + 15, {s: 11, w: 600, c: C.mem});
      if (priSub) text(priSub, L.pri, L.ty + TH + 15, {s: 11, w: 600, c: C.pri});
      // small overview of the generated video
      const [tx, ty, tw, th] = L.tl, cw = tw / K, NT = Math.max(2, Math.round(18 / K));
      text("generated video", tx, ty - 7, {s: 11, w: 700, c: C.mute});
      for (let kk = 1; kk <= K; kk++) {
        const x = tx + (kk - 1) * cw, now = s.k === kk && st === 1;
        for (let j = 0; j < NT; j++) {
          const w = (cw - 10 - 2 * (NT - 1)) / NT, xx = x + j * (w + 2), i = (kk - 1) * CH + Math.round(CH * (j + 1) / NT);
          if (genDone(s, kk) || (now && cur >= i)) tile("gen", i, xx, ty, w, th, s.ph === "end" && cur >= i - 2 && cur <= i + 2 ? C.ink : "#c9c6bf", 1, 1);
          else { rr(xx, ty, w, th, 4); g.fillStyle = "#f1efe9"; g.fill(); }
        }
      }
    }

    // ---- controls + loop
    const alg = [...root.querySelectorAll(".al")], fill = root.querySelector(".mth-fill"), dots = root.querySelector(".mth-dots");
    const capB = root.querySelector(".mth-cap b"), capS = root.querySelector(".mth-cap span");
    const DOT = st => st.ph.startsWith("c") ? (st.ph.endsWith("res") ? `chunk ${st.k}` : null) : st.ph === "end" ? "13" : st.ph.slice(1);
    dots.innerHTML = STEPS.map((st, i) => DOT(st) ? `<button data-i="${i}">${DOT(st)}</button>` : "").join("");
    let t = 0, playing = true, prev = null, visible = true;
    const size = () => { const w = cv.parentNode.clientWidth; cv.width = Math.round(w * dpr); cv.height = Math.round(w * H / W * dpr); cv.style.width = w + "px"; cv.style.height = Math.round(w * H / W) + "px"; leaves = null; litKey = ""; };
    const setPlay = p => { playing = p; root.querySelector(".pp").textContent = p ? "❚❚" : "▶"; };
    root.querySelector(".pp").onclick = () => setPlay(!playing);
    const stepIdx = () => { for (let i = 0; i < STEPS.length; i++) if (t < T0[i] + STEPS[i].dur - 1e-6) return i; return STEPS.length - 1; };
    root.querySelector(".prev").onclick = () => { setPlay(false); const si = stepIdx(); t = T0[Math.max(0, t - T0[si] > 0.3 ? si : si - 1)] + 0.001; };
    root.querySelector(".next").onclick = () => { setPlay(false); const si = stepIdx(); t = si + 1 < STEPS.length ? T0[si + 1] + STEPS[si + 1].dur * 0.6 : 0; };
    dots.onclick = e => { const b = e.target.closest("button"); if (!b) return; t = T0[+b.dataset.i] + 0.001; setPlay(true); };
    root.querySelector(".mth-bar").onclick = e => { const r = e.currentTarget.getBoundingClientRect(); t = (e.clientX - r.left) / r.width * tot; };
    const frame = ts => {
      if (!root.isConnected) return;
      const dt = prev == null ? 0 : Math.min(0.1, (ts - prev) / 1000); prev = ts;
      if (playing && visible) { t += dt; if (t >= tot) t = 0; }
      const si = stepIdx(), s = STEPS[si], u = Math.min(1, (t - T0[si]) / s.dur);
      light(s.ph); strip(s, u);
      if (capB.textContent !== s.cap[0]) {                    // step change: re-trigger the pop animation of the caption
        capB.textContent = s.cap[0]; capS.textContent = s.cap[1]; const cap = capB.parentNode; cap.classList.remove("pop"); void cap.offsetWidth; cap.classList.add("pop");
      }
      alg.forEach((el, i) => { el.classList.toggle("on", s.line.includes(i)); el.classList.toggle("cur", s.line.includes(i) && (i !== 3 || s.line.length === 1)); });
      fill.style.width = (100 * t / tot).toFixed(2) + "%";
      const act = Math.max(...[...dots.children].map(b => +b.dataset.i).filter(i => i <= si));
      [...dots.children].forEach(b => b.classList.toggle("on", +b.dataset.i === act));
      requestAnimationFrame(frame);
    };
    if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => visible = e.isIntersecting)).observe(root);
    addEventListener("resize", size); size(); requestAnimationFrame(frame);
    root._seek = x => { t = x; setPlay(false); };              // used by the video export
    root._total = tot;
  }
  window.MethodAnim = MethodAnim;
})();

// Per-video captions (one line each), condensed from the supplementary figure captions (main_overleaf/sec/X_suppl.tex, 2026-11-23).
// moments only where the supplementary gives a time; pose-following captions are generated from the annotated shifts in index.html.
window.CAPTIONS = {
 "thyroid/real/real_01": {
  "text": "",
  "moments": [
   {
    "t": 2.1,
    "dur": 2.5,
    "label": "Thyroid lobe",
    "text": "Others: no lobe / frozen · Ours: lobe, as real",
    "cols": [
     "ours"
    ],
    "pause": true
   }
  ]
 },
 "thyroid/real/real_06": {
  "text": "",
  "moments": [
   {
    "t": 2.7,
    "dur": 3.0,
    "label": "No lobe here",
    "text": "Others: hallucinated lobe · Ours: none, as real",
    "cols": [
     "cam",
     "g3c"
    ],
    "tag": "hallucinated",
    "pause": true
   }
  ]
 },
 "thyroid/real/real_12": {
  "text": "",
  "moments": [
   {
    "t": 16.0,
    "dur": 2.5,
    "label": "Longitudinal view",
    "text": "Others: still round / blank / distorted · Ours: long carotid + gland, as real",
    "cols": [
     "ours"
    ],
    "tag": "longitudinal",
    "pause": true
   }
  ]
 },
 "thyroid/real/real_07": {
  "text": "",
  "moments": [
   {
    "t": 7.0,
    "dur": 2.5,
    "label": "During the turn",
    "text": "Others: collapsed · Ours: gland + carotid, as real",
    "cols": [
     "cameractrl",
     "cam",
     "g3c"
    ],
    "tag": "collapsed",
    "pause": true
   }
  ]
 },
 "thyroid/long/long_21": {
  "text": "",
  "moments": [
   {
    "t": 18.0,
    "dur": 2.0,
    "label": "Revisit",
    "text": "Others: blank / changed · Ours: same lobe + carotid as earlier",
    "cols": [
     "ours"
    ],
    "tag": "consistent",
    "pause": true
   }
  ]
 },
 "thyroid/long/long_08": {
  "text": "",
  "moments": [
   {
    "t": 11.1,
    "dur": 2.0,
    "label": "Revisit",
    "text": "Others: smeared / changed / no lobe · Ours: same lobe + carotid, as real",
    "cols": [
     "ours"
    ],
    "tag": "consistent",
    "pause": true
   }
  ]
 },
 "kidney/real/real_06s": {
  "text": "",
  "moments": [
   {
    "t": 6.0,
    "dur": 1.8,
    "label": "Long-axis sweep",
    "text": "Others: no clear kidney · Ours: largest long-axis section, as real",
    "cols": [
     "ours"
    ],
    "tag": "max section",
    "pause": true
   }
  ]
 },
 "kidney/real/real_12s": {
  "text": "",
  "moments": [
   {
    "t": 2.8,
    "dur": 1.5,
    "label": "Long-axis sweep",
    "text": "Others: no / faint kidney · Ours: largest long-axis section, as real",
    "cols": [
     "ours"
    ],
    "tag": "max section",
    "pause": true
   }
  ]
 },
 "kidney/real/real_19": {
  "text": "After the turn (≈70°) the kidney becomes a wide long-axis oval: Ours generates it, most clearly in this case; CaM and Gen3C show no kidney after the turn.",
  "moments": []
 },
 "kidney/real/real_04": {
  "text": "After the turn (≈70°) the kidney becomes a wide long-axis oval: Ours generates it; CaM and Gen3C show no kidney after the turn.",
  "moments": []
 },
 "kidney/long/long_s1": {
  "text": "On return, CameraCtrl and WorldMem forget the kidney; CaM and Gen3C repeat themselves, often without a clear kidney; Ours shows the same kidney every time.",
  "moments": []
 },
 "kidney/long/long_02": {
  "text": "On return, CameraCtrl and WorldMem forget the kidney; CaM and Gen3C repeat themselves, often without a clear kidney; Ours shows the same kidney every time.",
  "moments": []
 },
 "spine/real/real_07s": {
  "text": "The spinous process casts a dark shadow that changes along the sweep: Ours renders a sharp bright bone curve above it; CameraCtrl stays blurred, WorldMem adds a blocky band, CaM and Gen3C wash out.",
  "moments": []
 },
 "spine/real/real_15s": {
  "text": "The spinous process casts a dark shadow that changes along the sweep: Ours renders a sharp bright bone curve above it, best in this case; the baselines blur, block or wash out.",
  "moments": []
 },
 "spine/real/real_05": {
  "text": "Before the turn a bump with a shadow, after it (>50°) flat layers: Ours shows both; Gen3C and CameraCtrl keep the transverse shadow, CaM shows little structure.",
  "moments": []
 },
 "spine/real/real_16": {
  "text": "Before the turn a bump with a shadow, after it (>50°) flat layers: Ours shows both; Gen3C and CameraCtrl keep the transverse shadow, CaM shows little structure.",
  "moments": []
 },
 "spine/long/long_s1": {
  "text": "On return, Ours shows the same spinous process with its shadow; CameraCtrl and WorldMem forget, CaM and Gen3C keep only weak bone structure.",
  "moments": []
 },
 "spine/long/long_12": {
  "text": "On return, Ours shows the same spinous process with its shadow; CameraCtrl and WorldMem forget, CaM and Gen3C keep only weak bone structure.",
  "moments": []
 },
 "thyroid/abl_long/abl_long_05|mem": {
  "text": "Without memory the anatomy is regenerated on every visit, so the bottom row differs; with memory the revisit repeats the first visit.",
  "moments": []
 },
 "thyroid/abl_long/abl_long_03|mem": {
  "text": "Without memory the anatomy is regenerated on every visit, so the bottom row differs; with memory the revisit repeats the first visit.",
  "moments": []
 },
 "thyroid/abl_real/abl_real_01|prior": {
  "text": "Newly scanned tissue: without the prior the thyroid lobe is blurred or missing; with the prior it appears where expected.",
  "moments": []
 },
 "thyroid/abl_real/abl_real_10|prior": {
  "text": "The real scan has no lobe here: without the prior the model hallucinates one; with the prior, Ours does not.",
  "moments": []
 },
 "thyroid/abl_long/abl_long_22|pose": {
  "text": "",
  "moments": []
 },
 "spine/cshort/cshort_05": {
  "text": "Spinous-process shadow · Others: blurred / blocky / washed out · Ours: sharp bone curve + shadow, as real",
  "moments": []
 },
 "kidney/real/real_22": {
  "text": "After the ≈90° turn · CameraCtrl / WorldMem: break down · Ours: follows the new view",
  "moments": []
 },
 "spine/long/long_03": {
  "text": "Revisit · CameraCtrl / WorldMem: smeared / blocky · Ours: same spinous process + shadow as earlier",
  "moments": []
 },
 "spine/long/long_15": {
  "text": "Revisit · CameraCtrl / WorldMem: smeared / blocky · Ours: same spinous process + shadow as earlier",
  "moments": []
 }
};

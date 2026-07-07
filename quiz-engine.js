/* 自适应小测引擎 QuizEngine
 * - 每轮由通义千问实时生成 15 道全新题目（选择/简答/思考）
 * - 按考点跟踪掌握度：连续答对 2 次 = 已掌握，不再出题
 * - 做错的考点下轮出同考点不同情境的新题，直到掌握
 * - 每科每天最多 90 题，未掌握考点自动留到第二天
 * - 简答/思考题由模型批改（对/部分对/错 + 点评）
 * 两个学习舱运行时（pod-runtime.js / script.js）共用本模块。
 */
(function () {
  "use strict";

  var ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  var DAILY_LIMIT = 90;
  var ROUND_SIZE = 15;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function extractJson(text) {
    text = String(text).trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    try { return JSON.parse(text); } catch (e) {
      var s = text.indexOf("{"), en = text.lastIndexOf("}");
      if (s >= 0 && en > s) return JSON.parse(text.slice(s, en + 1));
      throw new Error("模型返回的不是合法 JSON");
    }
  }
  function callModel(cfg, prompt) {
    return fetch(cfg.endpoint || ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || "qwen-plus",
        temperature: 0.7,
        messages: [
          { role: "system", content: "你是一位耐心的中小学老师，只输出合法 JSON。" },
          { role: "user", content: prompt },
        ],
      }),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(friendlyError((d.error && d.error.message) || "接口返回 " + r.status, r.status));
        return extractJson(d.choices[0].message.content);
      });
    });
  }

  /* 纯文本调用（用于口语化讲解，不要求 JSON） */
  function callModelText(cfg, prompt) {
    return fetch(cfg.endpoint || ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || "qwen-plus",
        temperature: 0.6,
        messages: [
          { role: "system", content: "你是一位耐心温和的中小学老师。" },
          { role: "user", content: prompt },
        ],
      }),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(friendlyError((d.error && d.error.message) || "接口返回 " + r.status, r.status));
        return String(d.choices[0].message.content || "").trim();
      });
    });
  }

  /* 多模态调用：识别孩子画的图 / 拍的照片（默认走通义 qwen-vl-plus） */
  function visionModelFor(cfg) {
    var ep = cfg.endpoint || ENDPOINT;
    if (/dashscope/i.test(ep)) return "qwen-vl-plus";
    return cfg.model || "qwen-plus";
  }
  function callVision(cfg, prompt, dataUrl) {
    return fetch(cfg.endpoint || ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.apiKey },
      body: JSON.stringify({
        model: visionModelFor(cfg),
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
      }),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(friendlyError((d.error && d.error.message) || "接口返回 " + r.status, r.status));
        return String(d.choices[0].message.content || "").trim();
      });
    });
  }

  /* 批改一道图片作答的题（识别 + 判分） */
  function gradeImage(cfg, item) {
    var prompt =
      "孩子用手绘图或拍照的方式回答了下面这道题。\n题目：" + item.question + "\n参考答案：" + item.refAnswer +
      (item.childAnswer ? "\n孩子的文字补充：" + item.childAnswer : "") +
      '\n请先识别图片中的内容（文字、算式、图形、函数图像等），再宽容地判断作答核心意思是否正确。' +
      '只返回 JSON：{"desc":"图中画/写了什么（30字内）","verdict":"right|partial|wrong","comment":"一句话点评"}';
    return callVision(cfg, prompt, item.img).then(function (t) {
      var j = extractJson(t);
      return {
        verdict: /^(right|partial|wrong)$/.test(j.verdict) ? j.verdict : "wrong",
        comment: String(j.comment || ""),
        desc: String(j.desc || ""),
      };
    });
  }

  /* SVG 图例净化：只允许安全的静态/动画图形，拦掉脚本与外链 */
  function sanitizeSvg(s) {
    s = String(s || "").trim();
    if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return "";
    if (s.length > 20000) return "";
    if (/<\s*(script|foreignObject|iframe|object|embed|image|use|video|audio)\b/i.test(s)) return "";
    if (/\son\w+\s*=/i.test(s)) return "";
    if (/javascript:/i.test(s)) return "";
    if (/(xlink:)?href\s*=\s*["'](?!#)/i.test(s)) return ""; // 只允许 #内部引用
    return s;
  }

  /* 判断题目是否明显涉及画图/图像 */
  function needsFigure(q, childText) {
    var t = (q.question || "") + (q.refAnswer || "") + (q.explain || "") + (childText || "");
    return /画|作图|图像|图形|几何|坐标|函数图|示意图|三角形|抛物线|直线|曲线|折线|扇形|图表/.test(t);
  }

  function explainQuestion(cfg, r) {
    var q = r.q;
    var wantFig = needsFigure(q, r.childText) || r.hasImg;
    var prompt =
      "给" + (cfg.grade || "中小学") + "的孩子口头讲解这道做错的" + (q.type === "choice" ? "选择题" : "题目") + "。\n" +
      "题目：" + q.question + "\n" +
      (q.type === "choice"
        ? "选项:" + q.options.join("；") + "\n正确答案：" + q.options[q.answer] + "\n"
        : "参考答案：" + q.refAnswer + "\n") +
      "孩子的回答：" + (r.childText || "（未作答)") + "\n" +
      (q.explain ? "解析提示：" + q.explain + "\n" : "") +
      "要求：口语化、鼓励的语气，像面对面讲课；先温和指出孩子的答案错在哪里，再一步一步讲清正确思路，最后一句话总结要点。150-250 字。讲解正文是纯文本，不要任何 markdown 符号和标题。\n" +
      (wantFig
        ? "这道题涉及图形，必须在讲解正文之后另起一行，输出一个完整的 <svg>...</svg> 图例来配合讲解：viewBox=\"0 0 600 400\"，白底，只用基本图形（线、圆、矩形、路径、text 中文标注），关键元素用醒目颜色；如果分步演示更清楚，用 <animate> 或 <animateTransform> 让关键线条或点动起来（时长 2-4 秒、repeatCount=\"indefinite\"）。不要输出 script。"
        : "如果画一张图能明显帮助理解（几何、函数图像、示意图等），就在正文之后另起一行输出一个完整的 <svg>...</svg> 图例（viewBox=\"0 0 600 400\"，中文标注，可用 <animate> 做简单动画）；否则不要输出任何 SVG。");
    return callModelText(cfg, prompt).then(function (t) {
      var svg = "";
      var m = t.match(/<svg[\s\S]*<\/svg>/i);
      if (m) { svg = sanitizeSvg(m[0]); t = t.replace(m[0], ""); }
      var text = t.replace(/```[a-z]*|```/gi, "").trim();
      return { text: text, svg: svg };
    });
  }

  /* 把供应商的英文报错翻译成家长能看懂的提示 */
  function friendlyError(msg, status) {
    var m = String(msg);
    if (/insufficient balance|suspended|recharge|arrears|欠费|余额不足/i.test(m)) {
      return "AI 账号余额不足，供应商已暂停服务。请到该供应商控制台充值，或在起始页“AI 设置”里换成有额度的供应商（通义千问新用户有免费额度）。";
    }
    if (/incorrect api key|invalid api[- ]?key|authentication|api key/i.test(m) || status === 401) {
      return "API Key 不正确或已失效，请到起始页“AI 设置”重新粘贴 Key。";
    }
    if (/rate limit|too many requests/i.test(m) || status === 429) {
      return "调用太频繁，休息一两分钟再试。";
    }
    if (/model.*(not exist|not found|invalid)/i.test(m)) {
      return "模型名不存在，请到起始页“AI 设置”检查模型名是否拼写正确。";
    }
    return m;
  }

  function lessonText(lesson) {
    var parts = [lesson.oneLine || ""];
    (lesson.sections || []).forEach(function (s) { parts.push((s.h || "") + "：" + (s.text || "")); });
    parts.push("步骤：" + (lesson.steps || []).join("；"));
    if (lesson.example) parts.push("例子：" + lesson.example);
    if (lesson.mistake) parts.push("易错：" + lesson.mistake);
    return parts.join("\n").slice(0, 6000);
  }

  /* ---------- 模型调用：考点提炼 / 出题 / 批改 ---------- */

  function extractPoints(cfg, lesson) {
    if (Array.isArray(lesson.points) && lesson.points.length >= 2) {
      return Promise.resolve(lesson.points.map(function (p, i) {
        return { id: String(p.id || "p" + (i + 1)), label: String(p.label || p) };
      }));
    }
    var prompt = "从下面这节课的内容中提炼 5-8 个可考核的考点。课程：" + cfg.subjectLabel + "《" + lesson.title + "》\n课文：\n" +
      lessonText(lesson) + '\n\n只返回 JSON：{"points":[{"id":"p1","label":"考点名称"}]}';
    return callModel(cfg, prompt).then(function (raw) {
      var pts = (raw.points || []).slice(0, 8).map(function (p, i) {
        return { id: String(p.id || "p" + (i + 1)), label: String(p.label || "考点" + (i + 1)) };
      }).filter(function (p) { return p.label; });
      if (pts.length < 2) throw new Error("考点提炼失败，请重试");
      return pts;
    });
  }

  function generateRound(cfg, lesson, points, entry, recentWrong, count) {
    var lines = points.map(function (p) {
      var st = entry.points[p.id] || {};
      if (st.mastered) return "- [" + p.id + "] " + p.label + "（已掌握，禁止出题）";
      var extra = st.wrong ? "，此前答错 " + st.wrong + " 次，请换新情境重点考核" : "";
      return "- [" + p.id + "] " + p.label + "（未掌握" + extra + "）";
    });
    var wrongTxt = recentWrong.length
      ? "\n孩子最近做错的题目（针对相同考点出全新情境的类似题，禁止重复原题）：\n" +
        recentWrong.slice(-8).map(function (w) { return "· " + w; }).join("\n")
      : "";
    var prompt =
      "为" + (cfg.grade || "中小学") + "的孩子，就 " + cfg.subjectLabel + "《" + lesson.title + "》重新思考并出 " + count + " 道全新题目。\n" +
      "课文内容：\n" + lessonText(lesson) + "\n\n考点清单（只对“未掌握”考点出题）：\n" + lines.join("\n") + wrongTxt + "\n\n" +
      "题型配比：选择题(choice)约 60%，简答题(short)约 25%，思考题(think)约 15%，至少各 1 道（除非题量不足）。\n" +
      '只返回 JSON：{"questions":[' +
      '{"pointId":"p1","type":"choice","question":"题干","options":["A内容","B内容","C内容","D内容"],"answer":2,"explain":"解析"},' +
      '{"pointId":"p2","type":"short","question":"题干","refAnswer":"参考答案","explain":"考察点"},' +
      '{"pointId":"p3","type":"think","question":"开放思考题干","refAnswer":"思考要点","explain":"考察点"}]}\n' +
      "要求：每题必须标注真实存在的 pointId；选择题 3-4 个选项、answer 为下标且位置随机分布；题目内容不得与孩子做过的题重复；难度贴合年级；只返回 JSON。";
    return callModel(cfg, prompt).then(function (raw) {
      var valid = [];
      var pidSet = {};
      points.forEach(function (p) { pidSet[p.id] = true; });
      (raw.questions || []).forEach(function (q, i) {
        if (!q || !q.question) return;
        var pid = pidSet[q.pointId] ? String(q.pointId) : points[0].id;
        if ((entry.points[pid] || {}).mastered) return; // 已掌握考点的题丢弃
        if (q.type === "choice") {
          var opts = (q.options || []).slice(0, 4).map(String);
          var ans = parseInt(q.answer, 10);
          if (opts.length < 2 || isNaN(ans) || ans < 0 || ans >= opts.length) return;
          valid.push({ id: "q" + i, pointId: pid, type: "choice", question: String(q.question), options: opts, answer: ans, explain: String(q.explain || "") });
        } else if (q.type === "short" || q.type === "think") {
          if (!q.refAnswer) return;
          valid.push({ id: "q" + i, pointId: pid, type: q.type, question: String(q.question), refAnswer: String(q.refAnswer), explain: String(q.explain || "") });
        }
      });
      if (!valid.length) throw new Error("本轮出题失败（模型返回无有效题目），请重试");
      return valid.slice(0, count);
    });
  }

  function gradeOpen(cfg, items) {
    if (!items.length) return Promise.resolve([]);
    var body = items.map(function (it, i) {
      return "题" + i + "：" + it.question + "\n参考答案：" + it.refAnswer + "\n孩子的回答：" + (it.childAnswer || "（空）");
    }).join("\n\n");
    var prompt = "批改下面孩子的答题。宽容对待表述差异，看核心意思是否正确。\n\n" + body +
      '\n\n只返回 JSON：{"grades":[{"i":0,"verdict":"right","comment":"一句话点评"}]}\nverdict 只能是 right / partial / wrong。';
    return callModel(cfg, prompt).then(function (raw) {
      var out = items.map(function () { return { verdict: "wrong", comment: "未获得批改结果" }; });
      (raw.grades || []).forEach(function (g) {
        var i = parseInt(g.i, 10);
        if (i >= 0 && i < items.length && /^(right|partial|wrong)$/.test(g.verdict)) {
          out[i] = { verdict: g.verdict, comment: String(g.comment || "") };
        }
      });
      return out;
    });
  }

  /* ---------- 🔊 PodVoice：挑选最自然的中文男/女老师声音 ----------
   * 浏览器/系统里往往装着好几个中文声音，质量差别很大。
   * 这里按"自然度"打分挑选：微软 Natural/Neural 在线声(Edge) > Google 普通话 >
   * 系统声(婷婷等) > 兜底默认声。家长/孩子可切换 男老师/女老师。 */
  var VOICE_KEY = "family:voice";
  var FEMALE_HINTS = ["xiaoxiao", "xiaoyi", "xiaohan", "xiaomo", "xiaoxuan", "xiaorui", "晓", "tingting", "ting-ting", "婷", "meijia", "美嘉", "huihui", "慧", "yaoyao", "瑶", "lili", "yushu", "语舒", "善怡", "sandy", "shelley", "flo", "grandma", "female", "女"];
  var MALE_HINTS = ["yunxi", "云希", "yunjian", "云健", "yunyang", "云扬", "yunye", "云野", "yunhao", "云皓", "kangkang", "康", "binbin", "斌", "li-mu", "limu", "eddy", "reed", "rocko", "grandpa", "male", "男"];
  function voicePref() {
    try { return localStorage.getItem(VOICE_KEY) || "female"; } catch (e) { return "female"; }
  }
  function setVoicePref(v) { try { localStorage.setItem(VOICE_KEY, v); } catch (e) { /* 忽略 */ } }
  function zhVoices() {
    try {
      return window.speechSynthesis.getVoices().filter(function (v) {
        return /^zh|^cmn/i.test(v.lang || "") || /中文|普通话|Chinese/i.test(v.name || "");
      });
    } catch (e) { return []; }
  }
  function scoreVoice(v, gender) {
    var n = (v.name || "").toLowerCase();
    var s = 0;
    if (/natural|neural/.test(n)) s += 60;            // Edge 的拟真人声
    else if (/online/.test(n)) s += 40;
    if (n.indexOf("google") >= 0) s += 25;             // Chrome 的谷歌声比系统声自然
    if (!v.localService) s += 8;
    if (/^zh[-_]cn/i.test(v.lang || "")) s += 6;
    var want = gender === "male" ? MALE_HINTS : FEMALE_HINTS;
    var avoid = gender === "male" ? FEMALE_HINTS : MALE_HINTS;
    for (var i = 0; i < want.length; i++) { if (n.indexOf(want[i]) >= 0) { s += 35; break; } }
    for (var j = 0; j < avoid.length; j++) { if (n.indexOf(avoid[j]) >= 0) { s -= 30; break; } }
    return s;
  }
  function pickVoice(gender) {
    var vs = zhVoices();
    if (!vs.length) return null;
    var best = null, bs = -1e9;
    vs.forEach(function (v) { var s = scoreVoice(v, gender); if (s > bs) { bs = s; best = v; } });
    return best;
  }
  function podSpeak(text, onend) {
    if (!("speechSynthesis" in window)) { if (onend) onend(); return false; }
    var g = voicePref();
    var u = new SpeechSynthesisUtterance(String(text));
    u.lang = "zh-CN";
    var v = pickVoice(g);
    if (v) u.voice = v;
    var natural = v && /natural|neural/i.test(v.name || "");
    u.rate = natural ? 1.0 : 0.92;                       // 拟真人声用原速，普通声放慢更像讲课
    if (v) u.pitch = g === "male" ? 0.92 : 1.03;
    else u.pitch = g === "male" ? 0.72 : 1.12;           // 找不到对应性别声音时用音调区分
    u.onend = u.onerror = function () { if (onend) onend(); };
    try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) { if (onend) onend(); }
    return true;
  }
  window.PodVoice = {
    pref: voicePref,
    setPref: setVoicePref,
    pick: pickVoice,
    speak: podSpeak,
    supported: function () { return "speechSynthesis" in window; },
  };

  /* 供运行时复用的 AI 能力（图解动画课堂等） */
  window.PodAI = {
    callText: callModelText,
    callJson: callModel,
    sanitizeSvg: sanitizeSvg,
    friendlyError: friendlyError,
  };
  /* 声音列表是异步加载的，先“预热”一次 */
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
        window.speechSynthesis.onvoiceschanged = function () { try { window.speechSynthesis.getVoices(); } catch (e) { /* 忽略 */ } };
      }
    }
  } catch (e) { /* 忽略 */ }

  /* ---------- 🎊 彩带庆祝（答满分/掌握考点/完成任务时的欢呼） ---------- */
  function fxBurst(count) {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var layer = document.createElement("div");
      layer.className = "fx-layer";
      var colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c56cf0", "#ff9f43", "#0f9f9a"];
      for (var i = 0; i < count; i++) {
        var p = document.createElement("i");
        p.className = "fx-piece";
        p.style.left = (Math.random() * 100) + "vw";
        p.style.background = colors[i % colors.length];
        p.style.setProperty("--dx", (Math.random() * 180 - 90).toFixed(0) + "px");
        p.style.setProperty("--rot", (Math.random() * 900 - 450).toFixed(0) + "deg");
        p.style.animationDuration = (1.6 + Math.random() * 1.5).toFixed(2) + "s";
        p.style.animationDelay = (Math.random() * 0.35).toFixed(2) + "s";
        if (Math.random() < 0.3) { p.style.borderRadius = "50%"; p.style.width = p.style.height = "9px"; }
        layer.appendChild(p);
      }
      document.body.appendChild(layer);
      setTimeout(function () { try { layer.remove(); } catch (e) { /* 忽略 */ } }, 3800);
    } catch (e) { /* 庆祝失败不影响功能 */ }
  }
  window.PodFX = { burst: fxBurst };

  /* ---------- 画板：全页面共享一个弹层，完成后回调图片 dataURL ---------- */

  var padEls = null;
  function ensurePad() {
    if (padEls) return padEls;
    var mask = document.createElement("div");
    mask.className = "qe-pad-mask";
    mask.hidden = true;
    mask.innerHTML =
      '<div class="qe-pad">' +
      '<div class="qe-pad-head"><strong>画图作答</strong><span>用手指或鼠标在白板上画，画完点“用这张图作答”</span></div>' +
      '<canvas class="qe-pad-canvas" width="800" height="520"></canvas>' +
      '<div class="qe-pad-tools">' +
      '<button type="button" data-pen="3" class="on">✏️ 细笔</button>' +
      '<button type="button" data-pen="7">🖊️ 粗笔</button>' +
      '<button type="button" data-pen="24" data-eraser="1">🧽 橡皮</button>' +
      '<button type="button" data-act="clear">🗑️ 清空</button>' +
      '<button type="button" data-act="ok" class="qe-pad-ok">✔ 用这张图作答</button>' +
      '<button type="button" data-act="cancel">取消</button>' +
      "</div></div>";
    document.body.appendChild(mask);
    var canvas = mask.querySelector("canvas");
    var g = canvas.getContext("2d");
    var pen = { w: 3, eraser: false };
    var drawing = false, hasInk = false;
    function reset() {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, canvas.width, canvas.height);
      hasInk = false;
    }
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    }
    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      drawing = true;
      hasInk = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      var p = pos(e);
      g.beginPath();
      g.moveTo(p.x, p.y);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.lineWidth = pen.w;
      g.strokeStyle = pen.eraser ? "#ffffff" : "#17324d";
      g.lineTo(p.x, p.y);
      g.stroke();
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      canvas.addEventListener(ev, function () { drawing = false; });
    });
    mask.querySelectorAll("[data-pen]").forEach(function (b) {
      b.addEventListener("click", function () {
        pen.w = Number(b.dataset.pen);
        pen.eraser = !!b.dataset.eraser;
        mask.querySelectorAll("[data-pen]").forEach(function (x) { x.classList.toggle("on", x === b); });
      });
    });
    padEls = { mask: mask, canvas: canvas, reset: reset, hasInk: function () { return hasInk; } };
    mask.querySelector('[data-act="clear"]').addEventListener("click", reset);
    mask.querySelector('[data-act="cancel"]').addEventListener("click", function () { mask.hidden = true; });
    mask.querySelector('[data-act="ok"]').addEventListener("click", function () {
      if (!hasInk) { mask.hidden = true; return; }
      mask.hidden = true;
      if (padEls.onDone) padEls.onDone(canvas.toDataURL("image/jpeg", 0.85));
    });
    return padEls;
  }
  function openPad(onDone) {
    var p = ensurePad();
    p.onDone = onDone;
    p.reset();
    p.mask.hidden = false;
  }

  /* 照片/图片文件 → 压缩后的 dataURL（最长边 1024） */
  function fileToDataUrl(file, cb, err) {
    if (!/^image\//.test(file.type || "")) { err("请选择图片文件（照片、截图）"); return; }
    if (file.size > 20 * 1024 * 1024) { err("图片太大，请在 20MB 以内"); return; }
    var fr = new FileReader();
    fr.onerror = function () { err("图片读取失败"); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { err("图片解析失败"); };
      img.onload = function () {
        var MAX = 1024;
        var sc = Math.min(1, MAX / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * sc));
        cv.height = Math.max(1, Math.round(img.height * sc));
        var g = cv.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL("image/jpeg", 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ---------- 挂载：完整小测 UI 与状态机 ---------- */

  window.QuizEngine = {
    DAILY_LIMIT: DAILY_LIMIT,

    mount: function (ctx) {
      // ctx: { els:{box,actionBtn,result}, storage:{load,save}, getApiKey, model, grade,
      //        getContext():{subjectKey,subjectLabel,lesson,lessonIndex}, hooks:{logEvent,pushScore,pushWrong} }
      var round = null; // {questions, graded}
      var busy = false;

      function todayKey() { return fmtDate(new Date()); }
      function masteryAll() { return ctx.storage.load("mastery", {}); }
      function saveMastery(m) { ctx.storage.save("mastery", m); }
      function lessonEntry(c) {
        var m = masteryAll();
        var k = c.subjectKey + ":" + c.lessonIndex;
        if (!m[k]) m[k] = { subjectLabel: c.subjectLabel, lessonTitle: c.lesson.title, pointList: null, points: {} };
        return { map: m, key: k, entry: m[k] };
      }
      function quotaUsed(label) {
        var q = ctx.storage.load("quota", {});
        return (q[todayKey()] || {})[label] || 0;
      }
      function addQuota(label, n) {
        var q = ctx.storage.load("quota", {});
        var day = q[todayKey()] || {};
        day[label] = (day[label] || 0) + n;
        q[todayKey()] = day;
        ctx.storage.save("quota", q);
      }
      function getAI() {
        if (ctx.getAI) return ctx.getAI();
        var k = ctx.getApiKey ? ctx.getApiKey() : "";
        return k ? { apiKey: k, model: ctx.model, endpoint: "" } : null;
      }
      function cfg(c) {
        var ai = getAI() || {};
        return { apiKey: ai.apiKey, model: ai.model || ctx.model, endpoint: ai.endpoint || "", grade: ctx.grade, subjectLabel: c.subjectLabel };
      }
      function statusLine(c, entry) {
        var used = quotaUsed(c.subjectLabel);
        var pts = entry.pointList || [];
        var mastered = pts.filter(function (p) { return (entry.points[p.id] || {}).mastered; }).length;
        return "今日 " + c.subjectLabel + " 已做 " + used + "/" + DAILY_LIMIT + " 题" +
          (pts.length ? " · 本课考点 " + mastered + "/" + pts.length + " 已掌握" : "");
      }
      function setResult(text, cls) {
        ctx.els.result.textContent = text;
        ctx.els.result.className = "quiz-result" + (cls ? " " + cls : "");
      }

      /* ---- 错题语音讲解 ---- */
      var speakingBtn = null;
      function stopEngineSpeech() {
        try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
        if (speakingBtn) { speakingBtn.textContent = "🔈 再听一遍"; speakingBtn = null; }
      }
      function speakText(text, btn) {
        stopEngineSpeech();
        if (!window.PodVoice || !window.PodVoice.supported()) { btn.textContent = "🔈 再听一遍"; return; }
        speakingBtn = btn;
        btn.textContent = "⏹ 停止朗读";
        window.PodVoice.speak(text, function () {
          if (speakingBtn === btn) { btn.textContent = "🔈 再听一遍"; speakingBtn = null; }
        });
      }
      function showExplainText(r, btn) {
        var fb = btn.closest(".qe-feedback");
        if (!fb) return;
        if (r.q.explainSvg && !fb.querySelector(".qe-explain-fig")) {
          var fig = document.createElement("div");
          fig.className = "qe-explain-fig";
          fig.innerHTML = r.q.explainSvg; // 已经过 sanitizeSvg 白名单净化
          fb.appendChild(fig);
        }
        if (!fb.querySelector(".qe-explain-text")) {
          var p = document.createElement("p");
          p.className = "qe-explain-text";
          p.textContent = r.q.explainText;
          fb.appendChild(p);
        }
      }
      function explainHandler(r, btn) {
        if (speakingBtn === btn) { stopEngineSpeech(); return; }
        if (r.q.explainText) {
          showExplainText(r, btn);
          speakText(r.q.explainText, btn);
          return;
        }
        if (btn.dataset.busy) return;
        btn.dataset.busy = "1";
        btn.textContent = "老师备课中，稍等...";
        var c = ctx.getContext();
        explainQuestion(cfg(c), r).then(function (out) {
          delete btn.dataset.busy;
          if (!out.text) throw new Error("讲解为空");
          r.q.explainText = out.text;
          r.q.explainSvg = out.svg || "";
          showExplainText(r, btn);
          ctx.hooks.logEvent("explain", "听讲解：" + r.q.question.slice(0, 40));
          speakText(out.text, btn);
        }).catch(function (e) {
          delete btn.dataset.busy;
          btn.textContent = "讲解失败，点击重试";
        });
      }

      function renderIdle() {
        var c = ctx.getContext();
        var le = lessonEntry(c);
        round = null;
        var used = quotaUsed(c.subjectLabel);
        var pts = le.entry.pointList || [];
        var mastered = pts.filter(function (p) { return (le.entry.points[p.id] || {}).mastered; }).length;
        var html = '<p class="qe-status">' + esc(statusLine(c, le.entry)) + "</p>";
        if (used >= DAILY_LIMIT) {
          html += '<p class="qe-done">今天 ' + esc(c.subjectLabel) + " 的 " + DAILY_LIMIT + " 题已完成，课程结束！未掌握的考点明天继续。</p>";
          ctx.els.actionBtn.hidden = true;
        } else if (pts.length && mastered === pts.length) {
          html += '<p class="qe-done">本课所有考点都已连对两次，全部掌握！可以学下一课了。</p>';
          ctx.els.actionBtn.hidden = true;
        } else {
          html += '<p class="qe-tip">点击下方按钮，AI 会根据你的掌握情况重新思考，出一轮全新题目（选择+简答+思考）。做错的考点会反复出新题，连对两次才算过关。</p>';
          ctx.els.actionBtn.hidden = false;
          ctx.els.actionBtn.textContent = "开始新一轮小测（AI 出新题）";
        }
        ctx.els.box.innerHTML = html;
        setResult("");
      }

      function renderQuestions() {
        var c = ctx.getContext();
        var le = lessonEntry(c);
        var typeName = { choice: "选择", short: "简答", think: "思考" };
        ctx.els.box.innerHTML =
          '<p class="qe-status">' + esc(statusLine(c, le.entry)) + "</p>" +
          round.questions.map(function (q, qi) {
            var head = '<div class="quiz-question" data-q="' + qi + '"><strong><span class="qe-chip qe-' + q.type + '">' +
              typeName[q.type] + "</span>" + (qi + 1) + ". " + esc(q.question) + "</strong>";
            if (q.type === "choice") {
              return head + q.options.map(function (o, oi) {
                return '<label><input type="radio" name="qe' + qi + '" value="' + oi + '" /> ' + esc(o) + "</label>";
              }).join("") + "</div>";
            }
            return head + '<textarea class="qe-answer" data-a="' + qi + '" rows="' + (q.type === "think" ? 4 : 2) +
              '" placeholder="' + (q.type === "think" ? "写下你的思考过程..." : "写下你的答案...") + '"></textarea>' +
              '<div class="qe-tools" data-t="' + qi + '">' +
              '<button class="qe-mic" data-q="' + qi + '" type="button">🎤 按住说话</button>' +
              '<button class="qe-draw" data-q="' + qi + '" type="button">✏️ 画图作答</button>' +
              '<button class="qe-photo" data-q="' + qi + '" type="button">📷 拍照上传</button>' +
              '<span class="qe-tool-msg" data-m="' + qi + '"></span>' +
              "</div>" +
              '<div class="qe-img-box" data-i="' + qi + '" hidden><img alt="作答图片" /><button class="qe-img-del" data-q="' + qi + '" type="button">✕ 移除图片</button></div>' +
              "</div>";
          }).join("") +
          '<input type="file" class="qe-photo-file" accept="image/*" hidden />';
        bindAnswerTools();
        ctx.els.actionBtn.hidden = false;
        ctx.els.actionBtn.textContent = "提交本轮 " + round.questions.length + " 道题";
        setResult("");
      }

      /* ---- 语音 / 画图 / 拍照 作答工具 ---- */
      function toolMsg(qi, text, bad) {
        var el = ctx.els.box.querySelector('.qe-tool-msg[data-m="' + qi + '"]');
        if (el) { el.textContent = text; el.classList.toggle("bad", !!bad); }
      }
      function setImage(qi, dataUrl) {
        round.images[qi] = dataUrl;
        var b = ctx.els.box.querySelector('.qe-img-box[data-i="' + qi + '"]');
        if (b) { b.hidden = false; b.querySelector("img").src = dataUrl; }
        toolMsg(qi, "图片已作为这道题的答案，还可以在上面补充文字说明。");
      }
      function bindAnswerTools() {
        round.images = round.images || {};
        var box = ctx.els.box;
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        var fileInput = box.querySelector(".qe-photo-file");
        var photoQi = -1;

        Array.prototype.forEach.call(box.querySelectorAll(".qe-mic"), function (btn) {
          if (!SR) { btn.hidden = true; return; }
          var qi = Number(btn.dataset.q);
          var ta = box.querySelector('textarea[data-a="' + qi + '"]');
          var rec = null, finalTxt = "";
          function start(e) {
            e.preventDefault();
            if (rec || round.graded) return;
            finalTxt = "";
            rec = new SR();
            rec.lang = "zh-CN";
            rec.continuous = true;
            rec.interimResults = true;
            rec.onresult = function (ev) {
              for (var i = ev.resultIndex; i < ev.results.length; i++) {
                if (ev.results[i].isFinal) finalTxt += ev.results[i][0].transcript;
              }
            };
            rec.onerror = function (ev) {
              if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
                toolMsg(qi, "麦克风没有授权，请在浏览器地址栏允许使用麦克风。", true);
              }
            };
            rec.onend = function () {
              rec = null;
              btn.classList.remove("rec");
              btn.textContent = "🎤 按住说话";
              var raw = finalTxt.trim();
              if (!raw) { toolMsg(qi, "没有听清，请按住按钮后大声说。", true); return; }
              toolMsg(qi, "听到了，AI 正在把你的话整理成答案...");
              var q = round.questions[qi];
              var prompt =
                "孩子在回答题目「" + q.question.slice(0, 120) + "」，下面是语音转文字的口述内容（可能有同音字错误和口语词）：\n" + raw +
                "\n请整理成书面答案：纠正同音字、去掉口语词，保留孩子原本的意思，绝对不要补充孩子没有表达的内容。只返回整理后的答案本身。";
              callModelText(cfg(ctx.getContext()), prompt).then(function (txt) {
                if (!txt) throw new Error("空");
                ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + txt;
                toolMsg(qi, "已整理填入，你可以再修改，或继续按住说话补充。");
              }).catch(function () {
                ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + raw;
                toolMsg(qi, "已按原话填入（AI 整理暂时不可用）。");
              });
            };
            try { rec.start(); } catch (err) { rec = null; return; }
            btn.classList.add("rec");
            btn.textContent = "🔴 正在听...松开结束";
            toolMsg(qi, "正在听你说话...");
          }
          function stop() { if (rec) { try { rec.stop(); } catch (e) { /* 忽略 */ } } }
          btn.addEventListener("pointerdown", start);
          btn.addEventListener("pointerup", stop);
          btn.addEventListener("pointerleave", stop);
          btn.addEventListener("pointercancel", stop);
          btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        });

        Array.prototype.forEach.call(box.querySelectorAll(".qe-draw"), function (btn) {
          btn.addEventListener("click", function () {
            if (round.graded) return;
            var qi = Number(btn.dataset.q);
            openPad(function (dataUrl) { setImage(qi, dataUrl); });
          });
        });
        Array.prototype.forEach.call(box.querySelectorAll(".qe-photo"), function (btn) {
          btn.addEventListener("click", function () {
            if (round.graded) return;
            photoQi = Number(btn.dataset.q);
            fileInput.value = "";
            fileInput.click();
          });
        });
        if (fileInput) {
          fileInput.addEventListener("change", function () {
            var f = fileInput.files[0];
            if (!f || photoQi < 0) return;
            var qi = photoQi;
            toolMsg(qi, "正在处理图片...");
            fileToDataUrl(f, function (dataUrl) { setImage(qi, dataUrl); }, function (msg) { toolMsg(qi, msg, true); });
          });
        }
        Array.prototype.forEach.call(box.querySelectorAll(".qe-img-del"), function (btn) {
          btn.addEventListener("click", function () {
            if (round.graded) return;
            var qi = Number(btn.dataset.q);
            delete round.images[qi];
            var b = box.querySelector('.qe-img-box[data-i="' + qi + '"]');
            if (b) { b.hidden = true; b.querySelector("img").src = ""; }
            toolMsg(qi, "图片已移除。");
          });
        });
      }

      function applyGrades(results) {
        // results: [{q, verdict, comment}] 与 round.questions 对齐
        var c = ctx.getContext();
        var le = lessonEntry(c);
        var right = 0, partial = 0;
        results.forEach(function (r) {
          var st = le.entry.points[r.q.pointId] || { label: "", streak: 0, mastered: false, wrong: 0 };
          var p = (le.entry.pointList || []).filter(function (x) { return x.id === r.q.pointId; })[0];
          st.label = p ? p.label : st.label;
          if (r.verdict === "right") {
            right++;
            st.streak = (st.streak || 0) + 1;
            if (st.streak >= 2) st.mastered = true;
          } else {
            if (r.verdict === "partial") partial++;
            st.streak = 0;
            st.wrong = (st.wrong || 0) + 1;
            ctx.hooks.pushWrong({
              question: r.q.question,
              correct: r.q.type === "choice" ? r.q.options[r.q.answer] : r.q.refAnswer,
              chosen: r.childText || "（见作答）",
              pointLabel: st.label,
            });
          }
          le.entry.points[r.q.pointId] = st;
        });
        saveMastery(le.map);
        addQuota(c.subjectLabel, round.questions.length);
        var score = right + partial * 0.5;
        ctx.hooks.pushScore({ score: score, total: round.questions.length });
        ctx.hooks.logEvent("quiz", c.subjectLabel + "《" + c.lesson.title + "》AI小测 " + score + "/" + round.questions.length +
          "（对" + right + " 半对" + partial + " 错" + (round.questions.length - right - partial) + "）");

        // 渲染逐题反馈（做错/半对的题带"听老师讲解"按钮）
        var icon = { right: "✔ 正确", partial: "◐ 部分正确", wrong: "✘ 不对" };
        results.forEach(function (r, qi) {
          var div = ctx.els.box.querySelector('.quiz-question[data-q="' + qi + '"]');
          if (!div) return;
          div.classList.add("qe-" + r.verdict);
          var fb = '<div class="qe-feedback qe-fb-' + r.verdict + '"><strong>' + icon[r.verdict] + "</strong> " + esc(r.comment || "") +
            (r.verdict !== "right"
              ? "<br />参考答案：" + esc(r.q.type === "choice" ? r.q.options[r.q.answer] : r.q.refAnswer) +
                (r.q.explain ? "<br />解析：" + esc(r.q.explain) : "") +
                '<br /><button class="qe-explain" data-q="' + qi + '" type="button">🔈 听老师讲解</button>'
              : "") + "</div>";
          div.insertAdjacentHTML("beforeend", fb);
          Array.prototype.forEach.call(div.querySelectorAll("input,textarea"), function (el) { el.disabled = true; });
          var tools = div.querySelector(".qe-tools");
          if (tools) tools.hidden = true;
          var imgDel = div.querySelector(".qe-img-del");
          if (imgDel) imgDel.hidden = true;
        });
        Array.prototype.forEach.call(ctx.els.box.querySelectorAll(".qe-explain"), function (btn) {
          btn.addEventListener("click", function () {
            explainHandler(results[Number(btn.dataset.q)], btn);
          });
        });

        round.graded = true;
        var used = quotaUsed(c.subjectLabel);
        var pts = le.entry.pointList || [];
        var masteredAll = pts.length && pts.every(function (p) { return (le.entry.points[p.id] || {}).mastered; });
        var perfect = score === round.questions.length;
        setResult((perfect ? "🎉 满分！本轮得分 " : "本轮得分 ") + score + "/" + round.questions.length + "。" +
          (masteredAll ? "本课考点全部掌握，太棒了！🏆" : used >= DAILY_LIMIT ? "今日 " + DAILY_LIMIT + " 题已完成，明天继续。💪" : "错过的考点下一轮会出新题。"),
          perfect ? "" : "bad");
        if (masteredAll || used >= DAILY_LIMIT) fxBurst(150);
        else if (perfect) fxBurst(80);
        ctx.els.actionBtn.hidden = false;
        ctx.els.actionBtn.textContent = used >= DAILY_LIMIT || masteredAll ? "查看小测状态" : "再来一轮（AI 出新题）";
      }

      function startRound() {
        stopEngineSpeech();
        var c = ctx.getContext();
        var le = lessonEntry(c);
        var used = quotaUsed(c.subjectLabel);
        if (used >= DAILY_LIMIT) { renderIdle(); return; }
        busy = true;
        ctx.els.actionBtn.hidden = true;
        ctx.els.box.innerHTML = '<p class="qe-loading">AI 正在根据你的掌握情况重新思考出题，请稍候（约 20-60 秒）...</p>';
        var ensure = le.entry.pointList
          ? Promise.resolve(le.entry.pointList)
          : extractPoints(cfg(c), c.lesson).then(function (pts) {
              le.entry.pointList = pts;
              saveMastery(le.map);
              return pts;
            });
        ensure.then(function (pts) {
          var unmastered = pts.filter(function (p) { return !(le.entry.points[p.id] || {}).mastered; });
          if (!unmastered.length) { busy = false; renderIdle(); return null; }
          var recentWrong = ctx.storage.load("wrongBook", []).slice(-8).map(function (w) { return w.question; });
          return generateRound(cfg(c), c.lesson, pts, le.entry, recentWrong, Math.min(ROUND_SIZE, DAILY_LIMIT - used));
        }).then(function (questions) {
          busy = false;
          if (!questions) return;
          round = { questions: questions, graded: false, images: {} };
          renderQuestions();
        }).catch(function (e) {
          busy = false;
          ctx.els.box.innerHTML = '<p class="qe-error">出题失败：' + esc(e.message) + "</p>";
          ctx.els.actionBtn.hidden = false;
          ctx.els.actionBtn.textContent = "重试出题";
        });
      }

      function submitRound() {
        var answers = [];
        round.images = round.images || {};
        for (var qi = 0; qi < round.questions.length; qi++) {
          var q = round.questions[qi];
          if (q.type === "choice") {
            var checked = ctx.els.box.querySelector('input[name="qe' + qi + '"]:checked');
            if (!checked) { setResult("第 " + (qi + 1) + " 题还没有选。", "bad"); return; }
            answers.push({ q: q, choice: Number(checked.value) });
          } else {
            var ta = ctx.els.box.querySelector('textarea[data-a="' + qi + '"]');
            var txt = ta ? ta.value.trim() : "";
            var img = round.images[qi] || null;
            if (!txt && !img) { setResult("第 " + (qi + 1) + " 题还没有作答（可以打字、按住🎤说话，或✏️画图/📷拍照）。", "bad"); return; }
            answers.push({ q: q, text: txt, img: img });
          }
        }
        busy = true;
        ctx.els.actionBtn.hidden = true;
        var opens = answers.filter(function (a) { return a.q.type !== "choice"; });
        var textOpens = opens.filter(function (a) { return !a.img; });
        var imgOpens = opens.filter(function (a) { return a.img; });
        setResult(imgOpens.length
          ? "选择题已判分，AI 正在识别你画的图并批改简答和思考题..."
          : "选择题已判分，AI 正在批改简答和思考题...");
        var c0 = cfg(ctx.getContext());
        Promise.all([
          gradeOpen(c0, textOpens.map(function (a) {
            return { question: a.q.question, refAnswer: a.q.refAnswer, childAnswer: a.text };
          })),
          Promise.all(imgOpens.map(function (a) {
            return gradeImage(c0, { question: a.q.question, refAnswer: a.q.refAnswer, childAnswer: a.text, img: a.img });
          })),
        ]).then(function (res) {
          busy = false;
          var tv = res[0], iv = res[1];
          var ti = 0, ii = 0;
          var results = answers.map(function (a) {
            if (a.q.type === "choice") {
              return { q: a.q, verdict: a.choice === a.q.answer ? "right" : "wrong", comment: "", childText: a.q.options[a.choice] };
            }
            if (a.img) {
              var v = iv[ii++] || { verdict: "wrong", comment: "", desc: "" };
              return {
                q: a.q, verdict: v.verdict,
                comment: (v.desc ? "AI 看到：" + v.desc + "。" : "") + (v.comment || ""),
                childText: (a.text ? a.text + "；" : "") + "[画图作答] " + (v.desc || ""),
                hasImg: true,
              };
            }
            var v2 = tv[ti++] || { verdict: "wrong", comment: "" };
            return { q: a.q, verdict: v2.verdict, comment: v2.comment, childText: a.text };
          });
          applyGrades(results);
        }).catch(function (e) {
          busy = false;
          setResult("批改失败：" + e.message + "。请点按钮重试提交。", "bad");
          ctx.els.actionBtn.hidden = false;
          ctx.els.actionBtn.textContent = "重试提交";
        });
      }

      ctx.els.actionBtn.addEventListener("click", function () {
        var ai = getAI();
        if (!ai || !ai.apiKey) return; // 无 Key 时由旧版静态小测接管按钮
        if (busy) return;
        if (!round || round.graded) startRound();
        else submitRound();
      });

      return {
        // 课程/科目切换时调用；无 Key 返回 false 由运行时走旧静态小测
        refresh: function () {
          var ai = getAI();
          if (!ai || !ai.apiKey) return false;
          stopEngineSpeech();
          round = null;
          busy = false;
          renderIdle();
          return true;
        },
      };
    },
  };
})();

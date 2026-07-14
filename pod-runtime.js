/* 学习舱运行时 v2 - 与新版学习舱功能对齐
 * - 小测选项乱序、逐题判对错、错题真实进入复核队列
 * - 今日任务按日期保存、标记已学可撤销、朗读可停止
 * - 分步讲解播完即停，不无限循环
 * - 动态日期 / 计划进度 / 连续学习天数
 * - localStorage 按 podId 隔离，多个孩子互不污染
 * - 所有模型生成文本经 esc() 转义后再进入 innerHTML
 */
(function () {
  "use strict";

  const learningData = window.LEARNING_DATA || {};
  const subjects = learningData.subjects || {};
  const subjectKeys = Object.keys(subjects);
  const student = learningData.student || {};
  const POD = String(learningData.podId || "pod");

  if (!subjectKeys.length) {
    document.body.innerHTML =
      '<p style="padding:40px;font-family:sans-serif;color:#334">学习数据为空，请回到生成器重新生成。</p>';
    return;
  }

  /* ---------- 工具 ---------- */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function shuffleIndices(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(POD + ":" + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(POD + ":" + key, JSON.stringify(value));
    } catch (e) {
      /* 隐私模式下忽略 */
    }
  }

  /* ---------- 日期与进度 ---------- */

  function fmtDate(d) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = fmtDate(today);
  const TOTAL_DAYS = Math.max(1, parseInt(student.days, 10) || 56);
  let startDate = today;
  if (typeof learningData.generatedAt === "string") {
    const parts = learningData.generatedAt.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  const rawDay = Math.floor((today - startDate) / 86400000) + 1;

  /* ---------- 持久化状态 ---------- */

  const completedLessons = new Set(loadJSON("completed", []));
  const tasksState = loadJSON("tasks", {});
  const wrongBook = loadJSON("wrongBook", []);
  const scores = loadJSON("scores", []);
  const activeDays = loadJSON("activeDays", []);

  function markActiveToday() {
    if (!activeDays.includes(todayKey)) {
      activeDays.push(todayKey);
      saveJSON("activeDays", activeDays);
    }
    renderHeader();
  }

  function computeStreak() {
    const set = new Set(activeDays);
    const d = new Date(today);
    if (!set.has(fmtDate(d))) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (set.has(fmtDate(d))) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  /* ---------- 学习过程记录（供家长报告页使用） ---------- */

  function logEvent(type, detail) {
    const log = loadJSON("log", []);
    log.push({ t: Date.now(), d: fmtDate(new Date()), type: type, detail: String(detail) });
    while (log.length > 600) log.shift();
    saveJSON("log", log);
  }

  /* 学习时长：页面可见且 3 分钟内有过操作时，每 30 秒累计一次 */
  let lastActivity = Date.now();
  ["click", "keydown", "scroll", "touchstart", "pointerdown"].forEach(function (ev) {
    document.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
  });
  setInterval(function () {
    if (document.visibilityState === "hidden") return;
    if (Date.now() - lastActivity > 180000) return;
    const key = fmtDate(new Date());
    const time = loadJSON("time", {});
    time[key] = (time[key] || 0) + 30;
    saveJSON("time", time);
    // 按科目累计当天时长，供家长报告分科统计
    const timeSub = loadJSON("timeSub", {});
    if (!timeSub[key]) timeSub[key] = {};
    const sk = currentSubjectKey;
    timeSub[key][sk] = (timeSub[key][sk] || 0) + 30;
    saveJSON("timeSub", timeSub);
    writeDailySnapshot();
  }, 30000);

  /* ---------- 每日报告快照：把当天各科汇总冻结存档，防止日志滚动丢历史 ---------- */
  function computeDailySnapshot(dateKey) {
    const scores = loadJSON("scores", []).filter(function (s) { return s.date === dateKey; });
    const log = loadJSON("log", []).filter(function (e) { return e.d === dateKey; });
    const wrong = loadJSON("wrongBook", []).filter(function (w) { return w.date === dateKey; });
    const timeSub = loadJSON("timeSub", {})[dateKey] || {};
    const totalTime = loadJSON("time", {})[dateKey] || 0;
    const quota = loadJSON("quota", {})[dateKey] || {};
    const mastery = loadJSON("mastery", {});
    // 分科聚合
    const subs = {};
    function ensure(label) { if (!subs[label]) subs[label] = { label: label, sec: 0, quizzes: 0, qGot: 0, qTotal: 0, mastered: 0, points: 0, pending: [], quiz: 0 }; return subs[label]; }
    Object.keys(subjects).forEach(function (k) { ensure(subjects[k].label); });
    // 时长(按科目key映射到label)
    Object.keys(timeSub).forEach(function (k) {
      const label = subjects[k] ? subjects[k].label : k;
      ensure(label).sec += timeSub[k];
    });
    scores.forEach(function (s) {
      const e = ensure(s.subjectLabel || s.subject);
      e.quizzes++; e.qGot += s.score; e.qTotal += s.total;
    });
    Object.keys(quota).forEach(function (label) { ensure(label).quiz = quota[label]; });
    Object.keys(mastery).forEach(function (k) {
      const m = mastery[k];
      if (!m.pointList) return;
      const e = ensure(m.subjectLabel);
      m.pointList.forEach(function (p) {
        e.points++;
        const st = (m.points || {})[p.id] || {};
        if (st.mastered) e.mastered++;
        else e.pending.push(m.lessonTitle + "·" + p.label);
      });
    });
    const bySubject = Object.keys(subs).map(function (label) {
      const e = subs[label];
      return { label: label, sec: e.sec, quizzes: e.quizzes, pct: e.qTotal ? Math.round((e.qGot / e.qTotal) * 100) : null,
        todayQuestions: e.quiz, mastered: e.mastered, points: e.points, pending: e.pending.slice(0, 20) };
    }).filter(function (e) { return e.sec || e.quizzes || e.points || e.todayQuestions; });
    return {
      date: dateKey, totalSec: totalTime,
      lessons: log.filter(function (e) { return e.type === "lesson_done"; }).length,
      tasks: log.filter(function (e) { return e.type === "task"; }).length,
      newWrong: wrong.length,
      bySubject: bySubject,
      updatedAt: Date.now(),
    };
  }
  function writeDailySnapshot() {
    try {
      const dk = fmtDate(new Date());
      const daily = loadJSON("daily", {});
      daily[dk] = computeDailySnapshot(dk);
      // 只保留最近 120 天
      const keys = Object.keys(daily).sort();
      while (keys.length > 120) { delete daily[keys.shift()]; }
      saveJSON("daily", daily);
    } catch (e) { /* 忽略 */ }
  }
  window.__computeDailySnapshot = computeDailySnapshot; // 供发送报告按钮复用
  window.__writeDailySnapshot = writeDailySnapshot;

  /* ---------- 运行状态 ---------- */

  let currentSubjectKey = subjectKeys[0];
  let currentLessonIndex = 0;
  let currentAnimationStep = 0;
  let animationTimer = null;
  let quizView = [];
  let quizGraded = false;
  let speaking = false;
  let quizEngine = null;
  let dynamicQuiz = false;

  /* ---------- DOM ---------- */

  const $ = (id) => document.getElementById(id);
  const subjectNav = document.querySelector(".subject-nav");
  const dateLine = $("dateLine");
  const topGreeting = $("topGreeting");
  const progressDays = $("progressDays");
  const progressFill = $("progressFill");
  const streakLine = $("streakLine");
  const taskList = $("taskList");
  const questMap = $("questMap");
  const subjectSummary = $("subjectSummary");
  const lessonSubject = $("lessonSubject");
  const lessonTitle = $("lessonTitle");
  const lessonOneLine = $("lessonOneLine");
  const conceptBox = $("conceptBox");
  const termStrip = $("termStrip");
  const lessonExample = $("lessonExample");
  const mistakeText = $("mistakeText");
  const reviewPoints = $("reviewPoints");
  const narrationText = $("narrationText");
  const animationLabel = $("animationLabel");
  const animationProgress = $("animationProgress");
  const quizBox = $("quizBox");
  const quizResult = $("quizResult");
  const reviewQueue = $("reviewQueue");
  const markDone = $("markDone");
  const playLesson = $("playLesson");
  const speakLesson = $("speakLesson");
  const submitQuiz = $("submitQuiz");

  function lessonKey(subjectKey, index) {
    return subjectKey + ":" + index;
  }

  function getLesson() {
    return subjects[currentSubjectKey].lessons[currentLessonIndex];
  }

  /* ---------- 顶部 ---------- */

  function renderHeader() {
    const m = today.getMonth() + 1;
    const d = today.getDate();
    let phase;
    if (rawDay > TOTAL_DAYS) {
      phase = "学习计划已完成";
      topGreeting.textContent = "整理学习成果，保持好习惯";
    } else {
      phase = "学习计划第 " + Math.max(rawDay, 1) + " 天，共 " + TOTAL_DAYS + " 天";
      const ratio = rawDay / TOTAL_DAYS;
      if (ratio <= 0.5) topGreeting.textContent = "把基础任务稳步往前推";
      else if (ratio <= 0.85) topGreeting.textContent = "进入巩固与提升阶段";
      else topGreeting.textContent = "收尾、错题复盘、综合检测";
    }
    dateLine.textContent = today.getFullYear() + " 年 " + m + " 月 " + d + " 日 · " + phase;

    const doneDays = Math.min(Math.max(rawDay, 0), TOTAL_DAYS);
    progressDays.textContent = doneDays + " / " + TOTAL_DAYS + " 天";
    progressFill.style.width = (doneDays / TOTAL_DAYS) * 100 + "%";

    const streak = computeStreak();
    streakLine.textContent =
      streak > 0 ? "已连续学习 " + streak + " 天，别断档" : "今天完成一项任务，开始积累连续天数";
  }

  /* ---------- 科目导航（含完成度） ---------- */

  function renderNav() {
    subjectNav.innerHTML = subjectKeys
      .map(function (key) {
        const subject = subjects[key];
        const done = subject.lessons.filter(function (_, i) {
          return completedLessons.has(lessonKey(key, i));
        }).length;
        return (
          '<button class="subject-button ' +
          (key === currentSubjectKey ? "active" : "") +
          '" data-subject="' +
          esc(key) +
          '">' +
          esc(subject.label) +
          '<span class="nav-count">' +
          done +
          "/" +
          subject.lessons.length +
          "</span></button>"
        );
      })
      .join("");
    subjectNav.querySelectorAll(".subject-button").forEach(function (button) {
      button.addEventListener("click", function () {
        currentSubjectKey = button.dataset.subject;
        currentLessonIndex = 0;
        currentAnimationStep = 0;
        stopAnimation();
        stopSpeech();
        fullRender();
      });
    });
  }

  /* ---------- 今日任务（按日期保存勾选） ---------- */

  function getTodayTaskState(subjectKey) {
    const day = tasksState[todayKey] || {};
    return day[subjectKey] || [];
  }

  function setTodayTaskState(subjectKey, checkedIndices) {
    if (!tasksState[todayKey]) tasksState[todayKey] = {};
    tasksState[todayKey][subjectKey] = checkedIndices;
    saveJSON("tasks", tasksState);
  }

  /* ---------- 每日任务：每天自动变化 ----------
   * 第 1 条永远是“今日主线”，绑定闯关地图上“今日建议”的那一关（学完就自动换成下一关）；
   * 其余 4 条从任务池里按当天日期轮换，天天不重样。 */
  const TASK_POOL = [
    ["AI 小测一轮", "完成一轮 15 道的 AI 小测，做错的题点开听老师讲解。"],
    ["错题复核", "把复核队列里的错题重做一遍，能说出错在哪才算过。"],
    ["开口讲一讲", "把今天学的知识点讲给家长听 1 分钟，讲得清才算真会。"],
    ["朗读课文", "点“朗读讲解”跟着老师念一遍，或自己大声读课文和生活例子。"],
    ["预习下一关", "打开闯关地图的下一个知识点，先把概念看一遍。"],
    ["看图解动画课", "点“🎬 图解动画课”，跟着 5 幕动画把今天的知识点再过一遍。"],
    ["语音作答练习", "小测的简答题用“🎤 按住说话”作答，练习把思路讲清楚。"],
    ["考点自查", "对着闯关地图上的考点清单，逐条问自己“我能讲明白吗”。"],
    ["限时挑战", "给自己计时 10 分钟，看能不能做完一轮小测且正确率过 80%。"],
    ["整理笔记", "把今天的关键词和易错提醒抄到笔记本上，明早再看一眼。"],
  ];
  /* 当天的日期序号（本地时区），用于每日轮换 */
  function dayNumber() {
    return Math.floor((today.getTime() - today.getTimezoneOffset() * 60000) / 86400000);
  }
  /* 该科目第一个没学完的关卡 = 今日建议 */
  function firstIncomplete(subjectKey, subject) {
    for (let i = 0; i < subject.lessons.length; i++) {
      if (!completedLessons.has(lessonKey(subjectKey, i))) return i;
    }
    return -1;
  }
  /* ---------- 🤖 AI 每日定制任务：每天早上按昨天的错题现生成 ---------- */
  function podAIConfig() {
    let ai = null;
    if (learningData.ai && learningData.ai.apiKey) ai = learningData.ai;
    else if (learningData.apiKey) ai = { apiKey: learningData.apiKey, model: learningData.model || "qwen-plus", endpoint: "" };
    else {
      try {
        const c = JSON.parse(localStorage.getItem("family:aiConfig") || "null");
        if (c && c.apiKey) ai = c;
        else { const k = localStorage.getItem("family:apiKey"); if (k) ai = { apiKey: k, model: "qwen-plus", endpoint: "" }; }
      } catch (e) { /* 忽略 */ }
    }
    if (!ai || !ai.apiKey) return null;
    return { apiKey: ai.apiKey, model: ai.model || "qwen-plus", endpoint: ai.endpoint || "", grade: student.grade || "" };
  }
  const aiTaskPending = {};
  const aiTaskFailed = {};
  function yesterdayKey() {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return fmtDate(d);
  }
  function buildTaskPrompt(subject, subjectKey) {
    const yk = yesterdayKey();
    const label = subject.label;
    const wrongAll = loadJSON("wrongBook", []).filter(function (w) { return w.subjectLabel === label; });
    const wrongY = wrongAll.filter(function (w) { return w.date === yk; });
    const wrongUse = (wrongY.length ? wrongY : wrongAll).slice(-6);
    const scoresY = loadJSON("scores", []).filter(function (s) { return s.date === yk && (s.subjectLabel || s.subject) === label; });
    let got = 0, tot = 0;
    scoresY.forEach(function (s) { got += s.score; tot += s.total; });
    const pct = tot ? Math.round((got / tot) * 100) : null;
    const mastery = loadJSON("mastery", {});
    const pending = [];
    Object.keys(mastery).forEach(function (k) {
      const m = mastery[k];
      if (m.subjectLabel !== label || !m.pointList) return;
      m.pointList.forEach(function (p) {
        const st = (m.points || {})[p.id] || {};
        if (!st.mastered) pending.push(m.lessonTitle + "·" + p.label + (st.wrong ? "(错" + st.wrong + "次)" : ""));
      });
    });
    const ti = firstIncomplete(subjectKey, subject);
    const lessonTitle = ti >= 0 ? subject.lessons[ti].title : "该科已全部通关";
    return (
      "你是" + (student.grade || "中小学") + "学生" + (student.name || "孩子") + "的学习教练。请为他安排今天【" + label + "】的 4 条学习任务。\n" +
      "今天要学的知识点：《" + lessonTitle + "》\n" +
      (pct === null ? "昨天这科没有小测记录。\n" : "昨天这科小测正确率：" + pct + "%。\n") +
      (wrongUse.length
        ? "他做错过的题（要针对这些设计任务）：\n" + wrongUse.map(function (w) { return "· " + w.question + "（正确答案：" + w.correct + "，他答：" + w.chosen + "）"; }).join("\n") + "\n"
        : "暂时没有错题记录。\n") +
      (pending.length ? "还没掌握的考点：" + pending.slice(0, 8).join("；") + "\n" : "") +
      "\n要求：\n" +
      "1. 每条任务 10-25 分钟内能完成，具体到做什么、怎样算完成，不要空话。\n" +
      "2. 至少 2 条要直接针对上面的错题或未掌握考点（点名是哪个知识点/哪类题）。\n" +
      "3. 语气像教练对孩子说话，亲切、有干劲，不要说教。\n" +
      "4. 标题不超过 10 个字；说明 20-45 字。\n" +
      "5. 不要安排“学完《" + lessonTitle + "》”这条（已有单独的主线任务）。\n" +
      '只返回 JSON：{"tasks":[["任务标题","任务说明"],["...","..."],["...","..."],["...","..."]]}'
    );
  }
  /* 返回今天该科的 AI 任务；没有就后台生成一次，好了自动刷新 */
  function ensureAiTasks(subject, subjectKey) {
    const dk = fmtDate(today);
    const store = loadJSON("aiTasks", {});
    if (store[dk] && store[dk][subjectKey]) return store[dk][subjectKey];
    if (aiTaskPending[subjectKey] || aiTaskFailed[subjectKey]) return null;
    const cfg = podAIConfig();
    if (!cfg || !window.PodAI) return null;
    aiTaskPending[subjectKey] = true;
    // 超时保护：网络不通时别让角标一直卡在“正在定制”
    const timeout = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error("生成任务超时")); }, 45000);
    });
    Promise.race([window.PodAI.callJson(cfg, buildTaskPrompt(subject, subjectKey)), timeout]).then(function (raw) {
      aiTaskPending[subjectKey] = false;
      const list = (raw.tasks || []).slice(0, 4).map(function (t) {
        if (Array.isArray(t) && t.length >= 2 && t[0]) return [String(t[0]).slice(0, 20), String(t[1]).slice(0, 140)];
        if (t && typeof t === "object" && t.title) return [String(t.title).slice(0, 20), String(t.detail || t.desc || "").slice(0, 140)];
        return null;
      }).filter(Boolean);
      if (!list.length) {
        aiTaskFailed[subjectKey] = true;
        if (currentSubjectKey === subjectKey) renderTasks(subjects[subjectKey]);
        return;
      }
      const s2 = loadJSON("aiTasks", {});
      if (!s2[dk]) s2[dk] = {};
      s2[dk][subjectKey] = list;
      Object.keys(s2).sort().slice(0, -7).forEach(function (k) { delete s2[k]; }); // 只留最近 7 天
      saveJSON("aiTasks", s2);
      logEvent("ai_tasks", subject.label + "：AI 按错题生成今日任务 " + list.length + " 条");
      if (currentSubjectKey === subjectKey) renderTasks(subjects[subjectKey]);
    }).catch(function () {
      // 网络不通/接口报错：静默回退到每日轮换任务，并把角标恢复正常
      aiTaskPending[subjectKey] = false;
      aiTaskFailed[subjectKey] = true;
      if (currentSubjectKey === subjectKey) renderTasks(subjects[subjectKey]);
    });
    return null;
  }

  function fullTasks(subject, subjectKey) {
    const out = [];
    const ti = firstIncomplete(subjectKey, subject);
    if (ti >= 0) {
      const l = subject.lessons[ti];
      out.push([
        "今日主线 · " + l.title,
        "学完第 " + (ti + 1) + " 关《" + l.title + "》：看讲解 → 点“标记已学” → 做一轮 AI 小测。",
      ]);
    } else {
      out.push(["复习巩固", "本科所有关卡都通关啦！挑一个还没掌握的考点，再做一轮小测。"]);
    }
    // 优先用 AI 按昨天错题定制的今日任务
    const aiList = ensureAiTasks(subject, subjectKey);
    let usedAI = false;
    if (aiList && aiList.length) {
      aiList.forEach(function (t) {
        if (out.length < 5 && !out.some(function (x) { return x[0] === t[0]; })) { out.push(t); usedAI = true; }
      });
    }
    // 不足 5 条时，用科目自带任务 + 通用任务池按当天日期轮换补齐
    const rest = (subject.tasks || []).map(function (x) { return [String(x[0]), String(x[1])]; }).concat(TASK_POOL);
    const start = rest.length ? (dayNumber() % rest.length) : 0;
    for (let i = 0; out.length < 5 && i < rest.length; i++) {
      const t = rest[(start + i) % rest.length];
      if (!out.some(function (x) { return x[0] === t[0]; })) out.push(t);
    }
    // 面板角标：让孩子知道今天的任务是 AI 现给的
    const tag = document.querySelector(".today-panel .section-title span");
    if (tag) {
      tag.textContent = usedAI ? "🤖 AI 按昨天错题定制" : (aiTaskPending[subjectKey] ? "🤖 AI 正在定制今日任务..." : "完成后点亮");
    }
    return out;
  }

  function renderTasks(subject) {
    const checked = getTodayTaskState(currentSubjectKey);
    const tasks = fullTasks(subject, currentSubjectKey);
    taskList.innerHTML = tasks
      .map(function (task, index) {
        const isDone = checked.indexOf(index) !== -1;
        return (
          '<label class="task ' +
          (isDone ? "done" : "") +
          '"><input type="checkbox" data-task="' +
          index +
          '" ' +
          (isDone ? "checked" : "") +
          ' /><span><strong>' +
          esc(task[0]) +
          "</strong><p>" +
          esc(task[1]) +
          "</p></span></label>"
        );
      })
      .join("");
    taskList.querySelectorAll("input[type=checkbox]").forEach(function (box) {
      box.addEventListener("change", function () {
        const idx = Number(box.dataset.task);
        const set = new Set(getTodayTaskState(currentSubjectKey));
        if (box.checked) set.add(idx);
        else set.delete(idx);
        setTodayTaskState(currentSubjectKey, Array.from(set));
        box.closest(".task").classList.toggle("done", box.checked);
        if (box.checked) {
          markActiveToday();
          logEvent("task", subject.label + "任务：" + (tasks[idx] ? tasks[idx][0] : "任务" + (idx + 1)));
        }
      });
    });
  }

  /* ---------- 闯关地图 ---------- */

  function renderMap(subjectKey, subject) {
    const doneCount = subject.lessons.filter(function (_, i) { return completedLessons.has(lessonKey(subjectKey, i)); }).length;
    subjectSummary.textContent = subject.label + " · 共 " + subject.lessons.length + " 关 · 已通 " + doneCount + " 关";
    // 每日安排：按由易到难的课程顺序，第一个未学完的就是今天建议学的
    const todayIndex = firstIncomplete(subjectKey, subject);
    const masteryMap = loadJSON("mastery", {});
    questMap.innerHTML = subject.lessons
      .map(function (lesson, index) {
        const done = completedLessons.has(lessonKey(subjectKey, index));
        /* 考点掌握进度（AI 小测记录的连对两次数据） */
        const mk = masteryMap[subjectKey + ":" + index] || {};
        const ptList = mk.pointList || lesson.points || [];
        const ptTotal = ptList.length;
        let ptDone = 0;
        ptList.forEach(function (p) { if (((mk.points || {})[p.id] || {}).mastered) ptDone++; });
        const secN = (lesson.sections || []).length;
        const termN = (lesson.terms || []).length;
        const pct = ptTotal ? Math.round((ptDone / ptTotal) * 100) : (done ? 100 : 0);
        const meta =
          '<span class="node-meta">' +
          (secN ? "<i>📚 " + secN + " 节课文</i>" : "<i>📚 精讲课</i>") +
          (ptTotal ? "<i>🎯 考点 " + ptDone + "/" + ptTotal + "</i>" : "<i>🎯 考点测出来解锁</i>") +
          (termN ? "<i>🔤 " + termN + " 个关键词</i>" : "") +
          "</span>" +
          '<span class="node-bar"><i style="width:' + pct + '%"></i></span>';
        return (
          '<button class="quest-node ' +
          (index === currentLessonIndex ? "active" : "") +
          " " +
          (done ? "done" : "") +
          '" data-index="' +
          index +
          '"><span class="node-top"><span class="node-num">第 ' + (index + 1) + " 关</span>" +
          '<span class="node-status">' +
          (done ? "已通关 ✓" : esc(lesson.status)) +
          "</span>" +
          (index === todayIndex ? '<span class="today-badge">今日建议</span>' : "") +
          "</span><h4>" +
          esc(lesson.title) +
          "</h4><p>" +
          esc(lesson.oneLine) +
          "</p>" + meta + "</button>"
        );
      })
      .join("");
    questMap.querySelectorAll(".quest-node").forEach(function (node) {
      node.addEventListener("click", function () {
        currentLessonIndex = Number(node.dataset.index);
        currentAnimationStep = 0;
        stopAnimation();
        stopSpeech();
        fullRender();
      });
    });
  }

  /* ---------- 讲解面板 ---------- */

  function renderLesson(subjectKey, subject) {
    const lesson = getLesson();
    lessonSubject.textContent = subject.label;
    lessonTitle.textContent = lesson.title;
    lessonOneLine.textContent = lesson.oneLine;

    /* 富课文分节（新版课程带 sections，旧课程自动跳过） */
    let secBox = document.getElementById("lessonSections");
    if (!secBox) {
      lessonOneLine.insertAdjacentHTML("afterend", '<div id="lessonSections" class="lesson-sections"></div>');
      secBox = document.getElementById("lessonSections");
    }
    secBox.innerHTML = (lesson.sections || [])
      .map(function (s, i) {
        return "<details" + (i === 0 ? " open" : "") + "><summary>" + esc(s.h || "第 " + (i + 1) + " 节") +
          "</summary><p>" + esc(s.text || "").replace(/\n/g, "<br />") + "</p></details>";
      })
      .join("");
    lessonExample.textContent = lesson.example;
    mistakeText.textContent = lesson.mistake;

    const done = completedLessons.has(lessonKey(subjectKey, currentLessonIndex));
    markDone.textContent = done ? "已学 · 点击取消" : "标记已学";
    markDone.classList.toggle("active", done);

    const playingNow = Boolean(animationTimer) || playingVoice;
    playLesson.textContent = playingNow ? "⏸ 停止讲解" : "▶ 播放讲解";
    playLesson.classList.toggle("active", playingNow);
    animationLabel.textContent =
      "分步讲解 · Step " + (currentAnimationStep + 1) + "/" + lesson.steps.length;
    animationProgress.style.width =
      ((currentAnimationStep + 1) / lesson.steps.length) * 100 + "%";
    narrationText.textContent = lesson.narration[currentAnimationStep] || lesson.oneLine;

    conceptBox.innerHTML = lesson.steps
      .map(function (step, index) {
        return (
          '<div class="concept-step ' +
          (index === currentAnimationStep ? "current" : "") +
          '" data-step="' +
          index +
          '"><span>STEP ' +
          (index + 1) +
          "</span><strong>" +
          esc(step) +
          "</strong></div>"
        );
      })
      .join("");
    conceptBox.querySelectorAll(".concept-step").forEach(function (step) {
      step.addEventListener("click", function () {
        currentAnimationStep = Number(step.dataset.step);
        stopAnimation();
        render();
      });
    });

    termStrip.innerHTML = (lesson.terms || [])
      .map(function (item) {
        return (
          '<span class="term-chip"><strong>' +
          esc(item[0]) +
          "</strong>&nbsp;" +
          esc(item[1]) +
          "</span>"
        );
      })
      .join("");
    reviewPoints.innerHTML = (lesson.review || [])
      .map(function (item) {
        return "<li>" + esc(item) + "</li>";
      })
      .join("");
  }

  /* ---------- 小测（选项乱序 + 判错 + 错题入队） ---------- */

  function renderQuiz() {
    const lesson = getLesson();
    quizGraded = false;
    quizView = (lesson.quiz || []).map(function (q) {
      const question = q[0];
      const options = q[1];
      const answer = q[2];
      const order = shuffleIndices(options.length);
      return {
        question: question,
        options: order.map(function (i) {
          return options[i];
        }),
        answer: order.indexOf(answer),
      };
    });

    quizBox.innerHTML = quizView
      .map(function (item, qIndex) {
        return (
          '<div class="quiz-question" data-q="' +
          qIndex +
          '"><strong>' +
          (qIndex + 1) +
          ". " +
          esc(item.question) +
          "</strong>" +
          item.options
            .map(function (option, oIndex) {
              return (
                '<label data-o="' +
                oIndex +
                '"><input type="radio" name="q' +
                qIndex +
                '" value="' +
                oIndex +
                '" /> ' +
                esc(option) +
                "</label>"
              );
            })
            .join("") +
          "</div>"
        );
      })
      .join("");

    submitQuiz.textContent = "提交小测";
    const last = scores
      .filter(function (s) {
        return s.subject === currentSubjectKey && s.lesson === currentLessonIndex;
      })
      .slice(-1)[0];
    quizResult.classList.remove("bad");
    quizResult.textContent = last
      ? "上次成绩：" + last.score + "/" + last.total + "（" + last.date.slice(5) + "）"
      : "";
  }

  function gradeQuiz() {
    const subject = subjects[currentSubjectKey];
    const lesson = getLesson();
    const answers = quizView.map(function (_, qIndex) {
      const checked = quizBox.querySelector('input[name="q' + qIndex + '"]:checked');
      return checked ? Number(checked.value) : null;
    });
    const firstEmpty = answers.indexOf(null);
    if (firstEmpty !== -1) {
      quizResult.classList.add("bad");
      quizResult.textContent = "第 " + (firstEmpty + 1) + " 题还没有选，答完再提交。";
      return;
    }

    let score = 0;
    quizView.forEach(function (item, qIndex) {
      const div = quizBox.querySelector('.quiz-question[data-q="' + qIndex + '"]');
      const labels = div.querySelectorAll("label");
      labels.forEach(function (label) {
        label.querySelector("input").setAttribute("disabled", "disabled");
      });
      labels[item.answer].classList.add("opt-correct");
      if (answers[qIndex] === item.answer) {
        score += 1;
        div.classList.add("right");
      } else {
        labels[answers[qIndex]].classList.add("opt-wrong");
        div.classList.add("wrong");
        wrongBook.push({
          date: todayKey,
          subjectLabel: subject.label,
          lessonTitle: lesson.title,
          question: item.question,
          correct: item.options[item.answer],
          chosen: item.options[answers[qIndex]],
        });
      }
    });

    while (wrongBook.length > 60) wrongBook.shift();
    saveJSON("wrongBook", wrongBook);
    scores.push({
      date: todayKey,
      subject: currentSubjectKey,
      lesson: currentLessonIndex,
      subjectLabel: subject.label,
      lessonTitle: lesson.title,
      score: score,
      total: quizView.length,
    });
    while (scores.length > 300) scores.shift();
    saveJSON("scores", scores);
    logEvent("quiz", subject.label + "《" + lesson.title + "》小测 " + score + "/" + quizView.length);

    markActiveToday();
    quizGraded = true;
    submitQuiz.textContent = "换一组顺序，再测一遍";
    if (score === quizView.length) {
      quizResult.classList.remove("bad");
      quizResult.textContent = "满分 " + score + "/" + quizView.length + "！这个知识点过关了。";
    } else {
      quizResult.classList.add("bad");
      quizResult.textContent =
        "得分 " + score + "/" + quizView.length + "，错题已进入复核队列。";
    }
    renderReviewQueue();
  }

  /* ---------- 复核队列（真实错题本） ---------- */

  function renderReviewQueue() {
    if (!wrongBook.length) {
      reviewQueue.innerHTML =
        '<li class="rq-empty">暂时没有错题。小测里做错的题会自动收集到这里，明早重做一遍再移除。</li>';
      return;
    }
    const items = wrongBook
      .map(function (item, realIndex) {
        return { item: item, realIndex: realIndex };
      })
      .reverse()
      .slice(0, 10);
    reviewQueue.innerHTML = items
      .map(function (entry) {
        return (
          '<li class="rq-item"><div class="rq-head"><span class="rq-tag">' +
          esc(entry.item.subjectLabel) +
          "</span>" +
          esc(entry.item.question) +
          '</div><p class="rq-detail">正确答案：' +
          esc(entry.item.correct) +
          "（当时选了：" +
          esc(entry.item.chosen) +
          "）· " +
          esc(String(entry.item.date).slice(5)) +
          '</p><button class="rq-done" data-rq="' +
          entry.realIndex +
          '">复核完成，移除</button></li>'
        );
      })
      .join("");
    reviewQueue.querySelectorAll(".rq-done").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = wrongBook[Number(btn.dataset.rq)];
        wrongBook.splice(Number(btn.dataset.rq), 1);
        saveJSON("wrongBook", wrongBook);
        if (item) logEvent("review_done", "复核完成：" + item.question);
        renderReviewQueue();
      });
    });
  }

  /* ---------- 渲染入口 ---------- */

  function render() {
    const subject = subjects[currentSubjectKey];
    if (currentAnimationStep >= subject.lessons[currentLessonIndex].steps.length) {
      currentAnimationStep = 0;
    }
    renderNav();
    renderTasks(subject);
    renderMap(currentSubjectKey, subject);
    renderLesson(currentSubjectKey, subject);
  }

  function fullRender() {
    render();
    dynamicQuiz = quizEngine ? quizEngine.refresh() : false;
    if (!dynamicQuiz) renderQuiz();
    renderReviewQueue();
  }

  /* ---------- 分步讲解：老师逐步开口讲，讲完一步自动进下一步 ---------- */

  let playingVoice = false; // 语音分步讲解进行中

  function stopAnimation() {
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
    if (playingVoice) {
      playingVoice = false;
      try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
    }
  }

  function isPlaying() { return Boolean(animationTimer) || playingVoice; }

  function advanceAnimation() {
    const lesson = getLesson();
    if (currentAnimationStep >= lesson.steps.length - 1) {
      stopAnimation();
      render();
      return;
    }
    currentAnimationStep += 1;
    render();
  }

  /* 语音版：讲当前步（步骤名+讲解词），讲完自动进入下一步 */
  function playStepVoice() {
    if (!playingVoice) return;
    const lesson = getLesson();
    render();
    const text = "第" + (currentAnimationStep + 1) + "步，" +
      (lesson.steps[currentAnimationStep] || "") + "。" +
      (lesson.narration[currentAnimationStep] || "");
    window.PodVoice.speak(text, function () {
      if (!playingVoice) return;
      if (currentAnimationStep >= getLesson().steps.length - 1) {
        playingVoice = false;
        render();
        return;
      }
      currentAnimationStep += 1;
      playStepVoice();
    });
  }

  playLesson.addEventListener("click", function () {
    if (isPlaying()) {
      stopAnimation();
      render();
      return;
    }
    stopSpeech();
    const lesson = getLesson();
    if (currentAnimationStep >= lesson.steps.length - 1) currentAnimationStep = 0;
    if (window.PodVoice && window.PodVoice.supported()) {
      playingVoice = true;
      logEvent("play", "播放讲解：《" + lesson.title + "》");
      playStepVoice();
    } else {
      advanceAnimation();
      if (currentAnimationStep < lesson.steps.length - 1) {
        animationTimer = setInterval(advanceAnimation, 2400);
      }
    }
    render();
  });

  /* ---------- 朗读：可开可停 ---------- */

  function stopSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speaking = false;
    speakLesson.textContent = "朗读讲解";
    speakLesson.classList.remove("active");
  }

  speakLesson.addEventListener("click", function () {
    if (speaking) {
      stopSpeech();
      return;
    }
    if (!window.PodVoice || !window.PodVoice.supported()) {
      narrationText.textContent = "当前浏览器不支持语音朗读，可以直接阅读这一段讲解。";
      return;
    }
    stopAnimation(); // 停掉分步讲解，避免两个声音打架
    const lesson = getLesson();
    const text =
      lesson.title +
      "。" +
      lesson.oneLine +
      "。" +
      (lesson.narration[currentAnimationStep] || "") +
      "。生活例子：" +
      lesson.example +
      "。易错提醒：" +
      lesson.mistake;
    window.PodVoice.speak(text, stopSpeech);
    speaking = true;
    speakLesson.textContent = "停止朗读";
    speakLesson.classList.add("active");
  });

  /* ---------- 👩/👨 老师声音切换（存到家庭档案，全站共用） ---------- */
  (function () {
    if (!window.PodVoice) return;
    const actions = document.querySelector(".lesson-actions");
    if (!actions) return;
    const btn = document.createElement("button");
    btn.className = "ghost-button voice-btn";
    btn.type = "button";
    function refresh() {
      btn.textContent = window.PodVoice.pref() === "male" ? "👨 男老师声" : "👩 女老师声";
    }
    btn.addEventListener("click", function () {
      const next = window.PodVoice.pref() === "male" ? "female" : "male";
      window.PodVoice.setPref(next);
      refresh();
      stopSpeech();
      stopAnimation();
      window.PodVoice.speak(next === "male" ? "你好呀，我是男老师，接下来由我给你讲课。" : "你好呀，我是女老师，接下来由我给你讲课。");
      logEvent("voice", "切换为" + (next === "male" ? "男" : "女") + "老师声音");
    });
    refresh();
    actions.insertBefore(btn, actions.firstChild);
  })();

  /* ---------- 🎬 图解动画课堂：AI 把每节课做成 5 幕带动画图解的小课件 ----------
   * 每幕 = 幕标题 + 220-320 字详细讲解词 + 一张会动的 SVG 图解，老师配音自动连播。
   * 生成一次缓存在本机（最多留 25 课，旧的自动清理），以后秒开。 */
  (function () {
    if (!window.PodAI) return;
    const actions = document.querySelector(".lesson-actions");
    if (!actions) return;

    function getAIConfig() {
      let ai = null;
      if (learningData.ai && learningData.ai.apiKey) ai = learningData.ai;
      else if (learningData.apiKey) ai = { apiKey: learningData.apiKey, model: learningData.model || "qwen-plus", endpoint: "" };
      else {
        try {
          const c = JSON.parse(localStorage.getItem("family:aiConfig") || "null");
          if (c && c.apiKey) ai = c;
          else {
            const k = localStorage.getItem("family:apiKey");
            if (k) ai = { apiKey: k, model: "qwen-plus", endpoint: "" };
          }
        } catch (e) { /* 忽略 */ }
      }
      if (!ai || !ai.apiKey) return null;
      return { apiKey: ai.apiKey, model: ai.model || "qwen-plus", endpoint: ai.endpoint || "" };
    }

    /* 弹层 */
    const mask = document.createElement("div");
    mask.className = "vl-mask";
    mask.hidden = true;
    mask.innerHTML =
      '<div class="vl-box">' +
      '<div class="vl-head"><strong id="vlTitle">图解动画课</strong><span id="vlSceneNo"></span><button class="vl-close" id="vlClose" type="button">✕</button></div>' +
      '<div class="vl-body"><div class="vl-fig" id="vlFig"></div><h3 id="vlSceneTitle"></h3><p id="vlText"></p></div>' +
      '<div class="vl-controls">' +
      '<button id="vlPrev" type="button">◀ 上一幕</button>' +
      '<span class="vl-dots" id="vlDots"></span>' +
      '<button id="vlNext" type="button">下一幕 ▶</button>' +
      '<button id="vlPlay" class="vl-play" type="button">🔊 自动连播</button>' +
      '<button id="vlRedo" type="button">🔁 重新生成</button>' +
      "</div></div>";
    document.body.appendChild(mask);
    const $v = (id) => document.getElementById(id);

    let scenes = [];
    let sceneIdx = 0;
    let autoPlaying = false;
    let generating = false;

    function stopAuto() {
      autoPlaying = false;
      $v("vlPlay").textContent = "🔊 自动连播";
      try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
    }
    function messageOnly(msg) {
      scenes = [];
      $v("vlSceneNo").textContent = "";
      $v("vlSceneTitle").textContent = "";
      $v("vlText").textContent = "";
      $v("vlDots").innerHTML = "";
      $v("vlFig").innerHTML = '<p class="vl-nofig"></p>';
      $v("vlFig").querySelector(".vl-nofig").textContent = msg;
      mask.hidden = false;
    }
    function showScene(i) {
      if (!scenes.length) return;
      sceneIdx = Math.max(0, Math.min(scenes.length - 1, i));
      const s = scenes[sceneIdx];
      $v("vlSceneNo").textContent = "第 " + (sceneIdx + 1) + " / " + scenes.length + " 幕";
      $v("vlSceneTitle").textContent = s.title;
      $v("vlText").textContent = s.text;
      if (s.svg) $v("vlFig").innerHTML = s.svg; // 存入前和取出时都过了 sanitizeSvg 白名单
      else { $v("vlFig").innerHTML = '<p class="vl-nofig">🖼 这一幕老师用语言描述，认真听～</p>'; }
      $v("vlDots").innerHTML = scenes.map(function (_, di) {
        return '<i class="' + (di === sceneIdx ? "on" : "") + '" data-d="' + di + '"></i>';
      }).join("");
      Array.prototype.forEach.call($v("vlDots").querySelectorAll("i"), function (d) {
        d.addEventListener("click", function () { stopAuto(); showScene(Number(d.dataset.d)); });
      });
      $v("vlPrev").disabled = sceneIdx === 0;
      $v("vlNext").disabled = sceneIdx === scenes.length - 1;
    }
    function playScene() {
      if (!autoPlaying || !scenes.length) return;
      const s = scenes[sceneIdx];
      window.PodVoice.speak(s.title + "。" + s.text, function () {
        if (!autoPlaying) return;
        if (sceneIdx >= scenes.length - 1) { stopAuto(); return; }
        showScene(sceneIdx + 1);
        playScene();
      });
    }
    $v("vlClose").addEventListener("click", function () { stopAuto(); mask.hidden = true; });
    mask.addEventListener("click", function (e) { if (e.target === mask) { stopAuto(); mask.hidden = true; } });
    $v("vlPrev").addEventListener("click", function () { stopAuto(); showScene(sceneIdx - 1); });
    $v("vlNext").addEventListener("click", function () { stopAuto(); showScene(sceneIdx + 1); });
    $v("vlPlay").addEventListener("click", function () {
      if (autoPlaying) { stopAuto(); return; }
      if (!scenes.length) return;
      autoPlaying = true;
      $v("vlPlay").textContent = "⏹ 停止连播";
      playScene();
    });
    $v("vlRedo").addEventListener("click", function () {
      stopAuto();
      const all = loadJSON("visuals", {});
      delete all[currentSubjectKey + ":" + currentLessonIndex];
      saveJSON("visuals", all);
      generate(subjects[currentSubjectKey], getLesson(), currentSubjectKey + ":" + currentLessonIndex);
    });

    /* 解析：@@幕 标题 \n 讲解词 ... <svg>...</svg> */
    function parseScenes(raw) {
      const parts = String(raw).split(/@@\s*幕/).map(function (s) { return s.trim(); }).filter(Boolean);
      const out = [];
      parts.forEach(function (p) {
        const nl = p.indexOf("\n");
        if (nl < 0) return;
        const title = p.slice(0, nl).trim().replace(/^[:：、.\s]+/, "").slice(0, 20);
        let rest = p.slice(nl + 1);
        let svg = "";
        const m = rest.match(/<svg[\s\S]*<\/svg>/i);
        if (m) { svg = window.PodAI.sanitizeSvg(m[0]); rest = rest.replace(m[0], ""); }
        const text = rest.replace(/```[a-z]*|```/gi, "").trim();
        if (text.length >= 30) out.push({ title: title || "第" + (out.length + 1) + "幕", text: text.slice(0, 1500), svg: svg });
      });
      return out.slice(0, 8);
    }

    function saveVisual(key, sc) {
      const all = loadJSON("visuals", {});
      all[key] = { t: Date.now(), scenes: sc };
      const keys = Object.keys(all);
      if (keys.length > 25) {
        keys.sort(function (a, b) { return (all[a].t || 0) - (all[b].t || 0); });
        for (let i = 0; i < keys.length - 25; i++) delete all[keys[i]];
      }
      saveJSON("visuals", all);
    }

    function lessonBrief(lesson) {
      const parts = [lesson.oneLine || ""];
      (lesson.sections || []).slice(0, 6).forEach(function (s) { parts.push((s.h || "") + "：" + (s.text || "")); });
      parts.push("步骤：" + (lesson.steps || []).join("；"));
      (lesson.narration || []).forEach(function (n) { parts.push(n); });
      if (lesson.example) parts.push("生活例子：" + lesson.example);
      if (lesson.mistake) parts.push("易错提醒：" + lesson.mistake);
      return parts.join("\n").slice(0, 5000);
    }

    function buildPrompt(subject, lesson) {
      return (
        "你是一位特级教师兼动画设计师。请把下面这节课做成给" + (student.grade || "中小学") + "孩子看的『图解动画课』，共 5 幕。\n" +
        "科目：" + subject.label + "，课程：《" + lesson.title + "》\n课程材料：\n" + lessonBrief(lesson) + "\n\n" +
        "每一幕的格式（严格遵守）：\n" +
        "第一行：@@幕 幕标题（不超过12个字）\n" +
        "接着是这一幕的讲解词，220-320字：像面对面讲课一样口语化，有比喻、有生活场景，一步一步推导。第1幕讲“这是什么、为什么有用”；第2-4幕把原理和方法层层讲透，其中必须有一幕是完整例题（题目、每一步怎么想、答案）；第5幕总结要点+易错提醒+一句鼓励。纯文本，禁止任何markdown符号。\n" +
        "讲解词之后输出一个完整的 <svg>...</svg> 图解（每幕都必须有）：viewBox=\"0 0 600 400\"，白色背景，用基本图形和中文文字标注，字号不小于16，颜色鲜明；这一幕的关键过程必须用 <animate>、<animateTransform> 或 <animateMotion> 做 2-6 秒循环动画演示（例如：逐步画出的线、沿路径移动的点、逐个亮起的方块、跳动的数字标注）。图要和讲解词内容一一对应。禁止 script、事件属性、外部链接。\n" +
        "除了 5 幕内容本身，不要输出任何开场白、结尾说明或其他文字。"
      );
    }

    function openViewer(subject, lesson) {
      $v("vlTitle").textContent = subject.label + "《" + lesson.title + "》· 图解动画课";
      mask.hidden = false;
      showScene(0);
      autoPlaying = true; // 打开即自动连播，孩子零操作
      $v("vlPlay").textContent = "⏹ 停止连播";
      playScene();
    }

    function generate(subject, lesson, key) {
      if (generating) return;
      const cfg = getAIConfig();
      $v("vlTitle").textContent = subject.label + "《" + lesson.title + "》· 图解动画课";
      if (!cfg) { messageOnly("需要先在起始页「AI Key 设置」里配置 API Key，才能生成图解动画课。"); return; }
      generating = true;
      vlBtn.disabled = true;
      messageOnly("🎬 AI 老师正在为《" + lesson.title + "》绘制 5 幕图解动画（约 60-120 秒）。只需生成一次，以后打开秒放～");
      window.PodAI.callText(cfg, buildPrompt(subject, lesson)).then(function (raw) {
        generating = false;
        vlBtn.disabled = false;
        const sc = parseScenes(raw);
        if (sc.length < 3) throw new Error("生成的课件不完整，请点「重新生成」再试一次");
        scenes = sc;
        saveVisual(key, sc);
        logEvent("visual", "生成图解动画课：《" + lesson.title + "》" + sc.length + " 幕");
        openViewer(subject, lesson);
      }).catch(function (e) {
        generating = false;
        vlBtn.disabled = false;
        var msg = /failed to fetch|networkerror|load failed/i.test(String(e.message))
          ? "连不上 AI 服务器：请检查网络是否正常；如果开着 VPN 或代理，请关掉后点「重新生成」再试。"
          : "生成失败：" + e.message;
        messageOnly(msg);
      });
    }

    const vlBtn = document.createElement("button");
    vlBtn.className = "ghost-button vl-btn";
    vlBtn.type = "button";
    vlBtn.textContent = "🎬 图解动画课";
    vlBtn.addEventListener("click", function () {
      const subject = subjects[currentSubjectKey];
      const lesson = getLesson();
      const key = currentSubjectKey + ":" + currentLessonIndex;
      stopSpeech();
      stopAnimation();
      const cached = (loadJSON("visuals", {})[key] || {}).scenes;
      if (cached && cached.length) {
        scenes = cached.map(function (s) {
          return { title: String(s.title || ""), text: String(s.text || ""), svg: window.PodAI.sanitizeSvg(s.svg || "") };
        });
        logEvent("visual", "观看图解动画课：《" + lesson.title + "》");
        openViewer(subject, lesson);
        return;
      }
      generate(subject, lesson, key);
    });
    actions.insertBefore(vlBtn, actions.firstChild);
  })();

  /* ---------- 标记已学：可切换 ---------- */

  markDone.addEventListener("click", function () {
    const key = lessonKey(currentSubjectKey, currentLessonIndex);
    const subject = subjects[currentSubjectKey];
    const lesson = getLesson();
    if (completedLessons.has(key)) {
      completedLessons.delete(key);
    } else {
      completedLessons.add(key);
      markActiveToday();
      logEvent("lesson_done", "学完 " + subject.label + "《" + lesson.title + "》");
      if (window.PodFX) window.PodFX.burst(60); // 🎉 学完一课，撒点彩带
    }
    saveJSON("completed", Array.from(completedLessons));
    writeDailySnapshot();
    render();
  });

  submitQuiz.addEventListener("click", function () {
    if (dynamicQuiz) return; // AI 小测由 QuizEngine 接管
    if (quizGraded) {
      renderQuiz();
      return;
    }
    gradeQuiz();
  });

  /* ---------- AI 自适应小测引擎（有 Key 时接管小测面板） ---------- */

  if (window.QuizEngine) {
    quizEngine = window.QuizEngine.mount({
      els: { box: quizBox, actionBtn: submitQuiz, result: quizResult },
      storage: { load: loadJSON, save: saveJSON },
      getAI: function () {
        if (learningData.ai && learningData.ai.apiKey) {
          return { apiKey: learningData.ai.apiKey, model: learningData.ai.model || "qwen-plus", endpoint: learningData.ai.endpoint || "" };
        }
        if (learningData.apiKey) return { apiKey: learningData.apiKey, model: learningData.model || "qwen-plus", endpoint: "" };
        try {
          const c = JSON.parse(localStorage.getItem("family:aiConfig") || "null");
          if (c && c.apiKey) return { apiKey: c.apiKey, model: c.model || "qwen-plus", endpoint: c.endpoint || "" };
          const k = localStorage.getItem("family:apiKey");
          if (k) return { apiKey: k, model: "qwen-plus", endpoint: "" };
        } catch (e) { /* 忽略 */ }
        return null;
      },
      model: learningData.model || "qwen-plus",
      grade: student.grade || "",
      getContext: function () {
        return {
          subjectKey: currentSubjectKey,
          subjectLabel: subjects[currentSubjectKey].label,
          lesson: getLesson(),
          lessonIndex: currentLessonIndex,
        };
      },
      hooks: {
        logEvent: logEvent,
        pushScore: function (e) {
          scores.push({
            date: todayKey,
            subject: currentSubjectKey,
            lesson: currentLessonIndex,
            subjectLabel: subjects[currentSubjectKey].label,
            lessonTitle: getLesson().title,
            score: e.score,
            total: e.total,
          });
          while (scores.length > 300) scores.shift();
          saveJSON("scores", scores);
          markActiveToday();
        },
        pushWrong: function (w) {
          wrongBook.push({
            date: todayKey,
            subjectLabel: subjects[currentSubjectKey].label,
            lessonTitle: getLesson().title,
            question: w.question,
            correct: w.correct,
            chosen: w.chosen,
          });
          while (wrongBook.length > 60) wrongBook.shift();
          saveJSON("wrongBook", wrongBook);
          renderReviewQueue();
        },
      },
    });
  }

  /* ---------- 启动 ---------- */

  renderHeader();
  fullRender();
})();

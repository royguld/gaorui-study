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
  }, 30000);

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

  function renderTasks(subject) {
    const checked = getTodayTaskState(currentSubjectKey);
    taskList.innerHTML = (subject.tasks || [])
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
          logEvent("task", subject.label + "任务：" + (subject.tasks[idx] ? subject.tasks[idx][0] : "任务" + (idx + 1)));
        }
      });
    });
  }

  /* ---------- 闯关地图 ---------- */

  function renderMap(subjectKey, subject) {
    subjectSummary.textContent = subject.label + " · " + subject.lessons.length + " 个知识点";
    // 每日安排：按由易到难的课程顺序，第一个未学完的就是今天建议学的
    let todayIndex = -1;
    for (let i = 0; i < subject.lessons.length; i++) {
      if (!completedLessons.has(lessonKey(subjectKey, i))) { todayIndex = i; break; }
    }
    questMap.innerHTML = subject.lessons
      .map(function (lesson, index) {
        const done = completedLessons.has(lessonKey(subjectKey, index));
        return (
          '<button class="quest-node ' +
          (index === currentLessonIndex ? "active" : "") +
          " " +
          (done ? "done" : "") +
          '" data-index="' +
          index +
          '"><span class="node-status">' +
          (done ? "已学 ✓" : esc(lesson.status)) +
          "</span>" +
          (index === todayIndex ? '<span class="today-badge">今日建议</span>' : "") +
          "<h4>" +
          esc(lesson.title) +
          "</h4><p>" +
          esc(lesson.oneLine) +
          "</p></button>"
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

    playLesson.textContent = animationTimer ? "暂停" : "播放讲解";
    playLesson.classList.toggle("active", Boolean(animationTimer));
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

  /* ---------- 分步讲解：播完即停 ---------- */

  function stopAnimation() {
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

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

  playLesson.addEventListener("click", function () {
    if (animationTimer) {
      stopAnimation();
      render();
      return;
    }
    const lesson = getLesson();
    if (currentAnimationStep >= lesson.steps.length - 1) currentAnimationStep = -1;
    advanceAnimation();
    if (currentAnimationStep < lesson.steps.length - 1) {
      animationTimer = setInterval(advanceAnimation, 2400);
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
    if (!("speechSynthesis" in window)) {
      narrationText.textContent = "当前浏览器不支持语音朗读，可以直接阅读这一段讲解。";
      return;
    }
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
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.92;
    utterance.onend = stopSpeech;
    utterance.onerror = stopSpeech;
    window.speechSynthesis.speak(utterance);
    speaking = true;
    speakLesson.textContent = "停止朗读";
    speakLesson.classList.add("active");
  });

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
    }
    saveJSON("completed", Array.from(completedLessons));
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

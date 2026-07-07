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
        if (!r.ok) throw new Error((d.error && d.error.message) || "接口返回 " + r.status);
        return extractJson(d.choices[0].message.content);
      });
    });
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
              '" placeholder="' + (q.type === "think" ? "写下你的思考过程..." : "写下你的答案...") + '"></textarea></div>';
          }).join("");
        ctx.els.actionBtn.hidden = false;
        ctx.els.actionBtn.textContent = "提交本轮 " + round.questions.length + " 道题";
        setResult("");
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

        // 渲染逐题反馈
        var icon = { right: "✔ 正确", partial: "◐ 部分正确", wrong: "✘ 不对" };
        results.forEach(function (r, qi) {
          var div = ctx.els.box.querySelector('.quiz-question[data-q="' + qi + '"]');
          if (!div) return;
          div.classList.add("qe-" + r.verdict);
          var fb = '<div class="qe-feedback qe-fb-' + r.verdict + '"><strong>' + icon[r.verdict] + "</strong> " + esc(r.comment || "") +
            (r.verdict !== "right"
              ? "<br />参考答案：" + esc(r.q.type === "choice" ? r.q.options[r.q.answer] : r.q.refAnswer) +
                (r.q.explain ? "<br />解析：" + esc(r.q.explain) : "")
              : "") + "</div>";
          div.insertAdjacentHTML("beforeend", fb);
          Array.prototype.forEach.call(div.querySelectorAll("input,textarea"), function (el) { el.disabled = true; });
        });

        round.graded = true;
        var used = quotaUsed(c.subjectLabel);
        var pts = le.entry.pointList || [];
        var masteredAll = pts.length && pts.every(function (p) { return (le.entry.points[p.id] || {}).mastered; });
        setResult("本轮得分 " + score + "/" + round.questions.length + "。" +
          (masteredAll ? "本课考点全部掌握！" : used >= DAILY_LIMIT ? "今日 " + DAILY_LIMIT + " 题已完成，明天继续。" : "错过的考点下一轮会出新题。"),
          score === round.questions.length ? "" : "bad");
        ctx.els.actionBtn.hidden = false;
        ctx.els.actionBtn.textContent = used >= DAILY_LIMIT || masteredAll ? "查看小测状态" : "再来一轮（AI 出新题）";
      }

      function startRound() {
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
          round = { questions: questions, graded: false };
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
        for (var qi = 0; qi < round.questions.length; qi++) {
          var q = round.questions[qi];
          if (q.type === "choice") {
            var checked = ctx.els.box.querySelector('input[name="qe' + qi + '"]:checked');
            if (!checked) { setResult("第 " + (qi + 1) + " 题还没有选。", "bad"); return; }
            answers.push({ q: q, choice: Number(checked.value) });
          } else {
            var ta = ctx.els.box.querySelector('textarea[data-a="' + qi + '"]');
            if (!ta.value.trim()) { setResult("第 " + (qi + 1) + " 题还没有作答。", "bad"); return; }
            answers.push({ q: q, text: ta.value.trim() });
          }
        }
        busy = true;
        ctx.els.actionBtn.hidden = true;
        setResult("选择题已判分，AI 正在批改简答和思考题...");
        var opens = answers.filter(function (a) { return a.q.type !== "choice"; });
        gradeOpen(cfg(ctx.getContext()), opens.map(function (a) {
          return { question: a.q.question, refAnswer: a.q.refAnswer, childAnswer: a.text };
        })).then(function (verdicts) {
          busy = false;
          var oi = 0;
          var results = answers.map(function (a) {
            if (a.q.type === "choice") {
              return { q: a.q, verdict: a.choice === a.q.answer ? "right" : "wrong", comment: "", childText: a.q.options[a.choice] };
            }
            var v = verdicts[oi++] || { verdict: "wrong", comment: "" };
            return { q: a.q, verdict: v.verdict, comment: v.comment, childText: a.text };
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
          round = null;
          busy = false;
          renderIdle();
          return true;
        },
      };
    },
  };
})();

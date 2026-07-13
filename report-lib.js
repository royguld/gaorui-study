/* 家长报告公共库：构建报告 HTML、发送到邮件端点。
 * 被 learn.html（孩子点“发送报告”）和 report.html（家长查看/导出）共用。 */
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtMin(sec) {
    if (!sec) return "0 分钟";
    var m = Math.round(sec / 60);
    if (m < 60) return m + " 分钟";
    return Math.floor(m / 60) + " 小时 " + (m % 60) + " 分";
  }

  /* snap: computeDailySnapshot 产出的当日快照 {date,totalSec,lessons,tasks,newWrong,bySubject:[...]} */
  function buildReportHTML(childName, snap) {
    var subjRows = (snap.bySubject || []).map(function (s) {
      var pct = s.pct === null || s.pct === undefined ? "—" : s.pct + "%";
      var pctColor = (s.pct !== null && s.pct !== undefined && s.pct < 60) ? "#b13c2e" : "#1d7a4f";
      var mastered = s.points ? (s.mastered + "/" + s.points) : "—";
      var pending = (s.pending && s.pending.length)
        ? s.pending.slice(0, 12).map(esc).join("；") + (s.pending.length > 12 ? " 等 " + s.pending.length + " 个" : "")
        : "（本科已掌握或暂无考点数据）";
      return (
        '<tr>' +
        '<td style="font-weight:700;color:#14283f">' + esc(s.label) + "</td>" +
        '<td>' + fmtMin(s.sec) + "</td>" +
        '<td>' + (s.quizzes || 0) + " 次</td>" +
        '<td style="color:' + pctColor + ';font-weight:700">' + pct + "</td>" +
        '<td>' + (s.todayQuestions || 0) + "/90</td>" +
        '<td>' + mastered + "</td>" +
        '<td style="color:#7a5410;font-size:12px;line-height:1.6">' + pending + "</td>" +
        "</tr>"
      );
    }).join("");
    if (!subjRows) subjRows = '<tr><td colspan="7" style="color:#8aa;padding:14px">今天还没有学习记录。</td></tr>';

    return (
      '<div style="font-family:-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;max-width:720px;margin:0 auto;color:#14283f">' +
      '<h2 style="margin:0 0 4px;font-size:20px">' + esc(childName) + " · 今日学习报告</h2>" +
      '<p style="margin:0 0 14px;color:#64748b;font-size:13px">日期：' + esc(snap.date) + "　（家长专属，孩子不可见）</p>" +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
      tile("今日总时长", fmtMin(snap.totalSec)) +
      tile("学完知识点", (snap.lessons || 0) + " 个") +
      tile("完成任务", (snap.tasks || 0) + " 项") +
      tile("新增错题", (snap.newWrong || 0) + " 道") +
      "</div>" +
      '<h3 style="font-size:15px;margin:0 0 8px;color:#0b7c78">分科目明细</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="background:#f0f6fa;color:#5d7288;font-size:12px">' +
      "<th style='text-align:left;padding:8px'>科目</th><th style='text-align:left;padding:8px'>时长</th>" +
      "<th style='text-align:left;padding:8px'>小测</th><th style='text-align:left;padding:8px'>正确率</th>" +
      "<th style='text-align:left;padding:8px'>今日题量</th><th style='text-align:left;padding:8px'>已掌握考点</th>" +
      "<th style='text-align:left;padding:8px'>未掌握考点</th></tr></thead>" +
      '<tbody>' + subjRows.replace(/<td>/g, "<td style='padding:8px;border-top:1px solid #eef3f8'>") + "</tbody></table>" +
      '<p style="margin-top:16px;color:#9aa9ba;font-size:11px">本报告由家庭学习舱自动生成 · 数据来自孩子学习舱的真实操作记录</p>' +
      "</div>"
    );
  }
  function tile(label, val) {
    return '<div style="flex:1;min-width:120px;background:#f7fbff;border:1px solid #e3edf5;border-radius:8px;padding:12px">' +
      '<div style="color:#64748b;font-size:12px;margin-bottom:5px">' + esc(label) + "</div>" +
      '<div style="font-size:19px;font-weight:800">' + esc(val) + "</div></div>";
  }

  function buildReportText(childName, snap) {
    var lines = [childName + " 今日学习报告（" + snap.date + "）",
      "总时长：" + fmtMin(snap.totalSec) + "；学完知识点：" + (snap.lessons || 0) + " 个；完成任务：" + (snap.tasks || 0) + " 项；新增错题：" + (snap.newWrong || 0) + " 道",
      "—— 分科目 ——"];
    (snap.bySubject || []).forEach(function (s) {
      lines.push("【" + s.label + "】时长 " + fmtMin(s.sec) + "，小测 " + (s.quizzes || 0) + " 次，正确率 " +
        (s.pct == null ? "—" : s.pct + "%") + "，今日 " + (s.todayQuestions || 0) + "/90 题，已掌握考点 " +
        (s.points ? s.mastered + "/" + s.points : "—"));
      if (s.pending && s.pending.length) lines.push("　未掌握：" + s.pending.slice(0, 12).join("；"));
    });
    if (!(snap.bySubject || []).length) lines.push("今天还没有学习记录。");
    return lines.join("\n");
  }

  /* 发送到家长配置的邮件端点（Google Apps Script Web App）。
   * 用 no-cors + text/plain 避免 CORS 预检；Apps Script 端解析 JSON 字符串。 */
  function sendReport(hookUrl, payload) {
    if (!hookUrl) return Promise.reject(new Error("尚未配置邮件端点"));
    return fetch(hookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).then(function () {
      // no-cors 下拿不到响应体，只要没抛网络错误就视为已投递
      return true;
    });
  }

  window.ReportLib = {
    esc: esc,
    fmtMin: fmtMin,
    buildReportHTML: buildReportHTML,
    buildReportText: buildReportText,
    sendReport: sendReport,
    RECIPIENTS: ["gaojh@chinanewbase.com", "royguld@gmail.com"],
    SENDER: "royguld@gmail.com",
  };
})();

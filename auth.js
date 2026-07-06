/* 家庭学习舱 - 授权守卫
 * 校验本机是否已通过起始页授权（30 天有效）。未授权则跳回起始页。
 * 授权码只保存 SHA-256 哈希，源码中不出现明文。
 */
(function () {
  "use strict";
  var EXPECTED = "35877d8de72fbb66117be6da30e7503b171e4e16de487155175a6aaa53140329";
  var VALID_MS = 30 * 24 * 3600 * 1000;
  try {
    var a = JSON.parse(localStorage.getItem("family:auth") || "null");
    if (a && a.h === EXPECTED && Date.now() - a.ts < VALID_MS) return; // 已授权
  } catch (e) { /* 继续跳转 */ }
  var here = location.pathname.split("/").pop() + location.search;
  location.replace("./home.html?next=" + encodeURIComponent(here));
})();

/* 實驗室共用：隨機選擇題。LabQuiz(容器 id, 出題函式)
   出題函式回傳 { q: 題目 HTML, ans: 正確答案文字, wrong: [錯的選項…], ex: 解說 } */
(function () {
  'use strict';
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  window.LabQuiz = function (id, gen) {
    var box = document.getElementById(id), ok = 0, n = 0;
    if (!box) return;
    box.innerHTML = '<h3>猜一猜</h3><p class="lq-q"></p><div class="lq-o" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"></div><p class="verdict-line lq-m"></p><button type="button" class="lq-n">下一題</button> <span class="why lq-s"></span>';
    var qe = box.querySelector('.lq-q'), oe = box.querySelector('.lq-o'), me = box.querySelector('.lq-m'), se = box.querySelector('.lq-s');
    function next() {
      var q = gen(), seen = {}, opts = [q.ans], done = false;
      seen[q.ans] = 1;
      shuffle(q.wrong.slice()).forEach(function (w) { if (!seen[w] && opts.length < 4) { seen[w] = 1; opts.push(w); } });
      shuffle(opts);
      qe.innerHTML = q.q; oe.innerHTML = ''; me.textContent = ''; me.className = 'verdict-line lq-m';
      opts.forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = o;
        b.onclick = function () {
          if (done) return; done = true; n++;
          var good = o === q.ans; if (good) ok++;
          Array.prototype.forEach.call(oe.children, function (c) { if (c.textContent === q.ans) c.style.cssText = 'border-color:#1f9d3a;box-shadow:0 0 0 2px #1f9d3a inset'; });
          if (!good) b.style.cssText = 'border-color:#dc2626;box-shadow:0 0 0 2px #dc2626 inset';
          me.textContent = (good ? '✔ 答對！' : '✖ 答案是「' + q.ans + '」。') + q.ex; me.className = 'verdict-line lq-m ' + (good ? 'ok' : 'bad');
          se.textContent = '答對 ' + ok + ' / ' + n;
        };
        oe.appendChild(b);
      });
    }
    box.querySelector('.lq-n').onclick = next; next();
    return { next: next, score: function () { return [ok, n]; } };
  };
})();

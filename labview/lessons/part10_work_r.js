/* 實務案例 W21：LabVIEW 和 Python 並用。交班時，測試站叫同事寫好的 Python 腳本，做這一班的良率和 p 管制圖。
   職缺對照（docs/research_W21.md 第 1 節）：多半寫「LabVIEW 或 Python 擇一」「熟 Python 尤佳」（Y03、Y09）；電源廠多寫 LabVIEW，伺服器廠多寫 Python。
   主線：System Exec 呼叫 python.exe，stdout 回一行 JSON（W18 的做法）。LabVIEW 2018 的 Python Node 只支援已停止維護的 2.7、3.6，當補充說明。
   重點：介面規格（命令列、ASCII JSON、ok 欄位、結束碼、stderr）、三個輸出都要看、逾時、部署、判定不要交出去。 */
(function(){
const L=window.LESSONS,fn=C.fn;
const PART='實務案例';
const ask=(q,a)=>`<details class="think"><summary><span class="q">問自己：${q}</span><span class="hint">先想一下，寫下你的猜測，再點開看</span></summary>${a}</details>`;
const warn=(t,b)=>`<div class="warn"><b>${t}</b>${b}</div>`;
const note=(t,b)=>`<div class="note"><b>${t}</b>${b}</div>`;
const tip=(t,b)=>`<div class="tip"><b>${t}</b>${b}</div>`;
if(!LV.F['Match Regular Expression'])LV.F['Match Regular Expression']={g:'.*',ins:['input string','regular expression'],outs:['before match','whole match','after match','offset past match'],w:56,pal:['Functions','Programming','String','Match Regular Expression']};
if(!LV.F['Unflatten From JSON'])LV.F['Unflatten From JSON']={g:'→{ }',ins:['JSON string','type'],outs:['value','error out'],pal:['Functions','Programming','String','Flatten/Unflatten String','Unflatten From JSON']};

/* ---- 圖：交班時叫 Python，七種情況 ---- */
const PK=[['Q','python.exe 和腳本的路徑加雙引號'],['R','看結束碼（和 System Exec 的 error out）'],['J','解析 stdout 的 JSON，看 ok 欄位'],['L','只解析 stdout 的最後一行'],['A','規格要求腳本的 JSON 只放 ASCII（json.dumps 預設 ensure_ascii）'],['T','放在背景迴圈跑，60 秒逾時就結束它'],['E','stderr 存進 log']];
const PC=[
 {t:'正常',ok:1},
 {t:'產線電腦沒裝 Python，或設定檔裡的 python.exe 路徑打錯'},
 {t:'python.exe 裝在 C:\\Program Files\\Python312\\',ok:1,sp:1},
 {t:'資料庫被鎖住，腳本拋出例外'},
 {t:'同事除錯時加了一行 print("loading...")，忘了拿掉',ok:1},
 {t:'同事把 JSON 的站名改成中文「一號站」',ok:1,cn:1},
 {t:'資料庫被別的程式鎖住，腳本一直等'},
 {t:'這一班換線，只測了 12 片（腳本回 ok:false、結束碼 3）'},
 {t:'同事改了腳本：先印 JSON 再存圖，存圖時磁碟滿了（stdout 已經印了 ok:true，結束碼 2）'}
];
function pyJudge(i,c){
  const cs=PC[i];
  if(i===8){if(c.R)return ['發現','g','結束碼 2：雖然 stdout 寫 ok:true，還是判失敗'+(c.E?'；stderr 寫著 No space left on device':'')];return ['錯','r',c.J?'只看 ok：報表說成功，附上的圖檔卻不存在':'以為成功，圖檔不存在'];}
  if(cs.sp&&!c.Q)return ['天天失敗','y','命令在空白處斷開，Windows 去找一個叫 C:\Program 的程式：每一班都跑不起來'+(c.R||c.J?'，天天通知工程師，直到有人加上引號':'，而且沒有人發現')];
  if(i===6&&!c.T)return ['卡住','r','交班時測試站卡住：System Exec 沒有逾時，一直等腳本。作業員只能強制關程式'];
  if(i===6)return ['發現','g','60 秒逾時，結束 python.exe，這一班的報表記「失敗：逾時」並通知工程師；測試站照常'+(c.E?'；log 裡有 stderr 可以查':'')];
  if(cs.ok){
    if(!c.J)return ['沒數字','y','跑完了，但 LabVIEW 沒解析輸出：報表上沒有良率，也不知道有沒有超出管制界限'];
    if(i===4&&!c.L)return ['誤判','y','stdout 有兩行，整段當 JSON 解析失敗：明明成功了，卻記成「報表失敗」。改成只取最後一行，或規定除錯訊息只能印到 stderr'];
    if(cs.cn&&!c.A)return ['錯','r','中文經過管線變成 cp950 編碼，LabVIEW 讀到的站名是亂碼，報表上就這樣印出去了'];
    return ['成功','g','拿到 n、fail、p、alarm 和圖檔路徑，附進交班報表'];
  }
  const seen=c.R||c.J;
  if(!seen)return ['錯','r','以為成功：沒有看結束碼也沒解析輸出，交班報表的良率欄是空的，沒人發現'];
  if(i===7)return ['發現','g','報表註明「資料不足（12 片），不畫管制圖」：這不是錯誤，是正確的結果'];
  if(i===3&&!c.E)return ['不知原因','y','知道失敗了，但不知道為什麼：stderr 沒有存下來，工程師只能到產線電腦上重跑一次'];
  return ['發現','g','知道失敗了，報表記「分析失敗」並通知工程師；測試站照常'+(i===3?'。log 裡的 stderr 有完整的 traceback：database is locked':'')];
}
function pyFig(el){
  el.className='fig';el.style.cssText='border:1px solid #c9d6e8;border-radius:6px;padding:10px 12px;background:#f8fbff';
  el.innerHTML=`<div style="font-size:13px">${PK.map(([k,t])=>`<label style="display:block"><input type="checkbox" data-k="${k}"> ${k}. ${t}</label>`).join('')}</div>
   <div data-o="out" style="font-size:13px;overflow-x:auto"></div>`;
  function draw(){
    const c={};PK.forEach(([k])=>c[k]=el.querySelector('[data-k='+k+']').checked);
    let red=0,yel=0;
    const rows=PC.map((cs,i)=>{const [v,k,why]=pyJudge(i,c);if(k==='r')red++;if(k==='y')yel++;const col=k==='r'?'#c0392b':k==='y'?'#b9770e':'#1e7b34';return `<tr><td>${cs.t}</td><td style="color:${col};font-weight:700">${v}</td><td>${why}</td></tr>`;}).join('');
    el.querySelector('[data-o=out]').innerHTML=`<table class="tbl" style="margin-top:6px"><tr><th>交班時的情況</th><th>結果</th><th>發生什麼事</th></tr>${rows}</table>
     <p style="margin:4px 0">默默錯或卡住：<b style="color:${red?'#c0392b':'#1e7b34'}">${red}</b> 種　沒數字或誤判：<b style="color:${yel?'#b9770e':'#1e7b34'}">${yel}</b> 種</p>`;
  }
  el.querySelectorAll('input').forEach(s=>s.onchange=draw);draw();
}

/* ---- 一步一步寫：RunPy.vi ---- */
const RC=['正常','多印了一行 loading...','腳本例外（資料庫被鎖）','這一班不到 20 片'];
const OUTS=[
 ['{"ok": true, "ver": "1.0.0", "n": 214, "fail": 5, "p": 0.0234, "alarm": false, "png": "C:\\\\ProgramData\\\\MyCompany\\\\PM5Station\\\\report\\\\p_ST01_2026-11-14.png"}','',0],
 ['loading...\n{"ok": true, "ver": "1.0.0", "n": 214, "fail": 5, "p": 0.0234, "alarm": false, "png": "C:\\\\ProgramData\\\\…\\\\p_ST01_2026-11-14.png"}','',0],
 ['{"ok": false, "err": "OperationalError", "ver": "1.0.0"}','Traceback (most recent call last):\n  …\nsqlite3.OperationalError: database is locked',2],
 ['{"ok": false, "err": "too few tests", "n": 12, "ver": "1.0.0"}','',3]];
const rv={name:'RunPy.vi',view:'split',ratio:1.5,
 fp:{w:360,h:330,items:[
  {id:'cs',k:'enum',ctl:true,label:'這一次（模擬用）',options:RC,x:12,y:8,v:0},
  {id:'so',k:'str',label:'standard output',x:12,y:60,w:330,h:60},
  {id:'se',k:'str',label:'standard error（存進 log）',x:12,y:140,w:330,h:44},
  {id:'rc',k:'num',label:'return code',x:12,y:204,w:50},
  {id:'p',k:'num',label:'p（FAIL 比例）',x:100,y:204,w:70,dig:4},
  {id:'done',k:'led',label:'分析成功',color:'green',x:220,y:204},
  {id:'eo',k:'led',label:'JSON 解析錯誤',color:'red',x:12,y:262}]},
 bd:{w:960,h:330,structs:[],
  nodes:[
  {id:'kf',k:'const',t:'str',v:'"%s" "%s" --day %s',x:20,y:20},
  {id:'py',k:'ctl',t:'str',label:'python.exe（設定檔）',x:20,y:80},
  {id:'scr',k:'ctl',t:'str',label:'yield_report.py',x:20,y:130},
  {id:'day',k:'ctl',t:'str',label:'day',x:20,y:180},
  {id:'fis',k:'fn',fn:'Format Into String',ins:['format string','input 1','input 2','input 3'],x:190,y:60,h:70},
  {id:'kT',k:'const',t:'bool',v:true,x:230,y:180,label:'wait'},
  {id:'sx',k:'sub',name:'System Exec.vi',icon:['SYS','EXEC'],ins:['command line','wait until completion?'],outs:['standard output','standard error','return code'],x:300,y:60,w:64,h:90,color:'#5a6b7d'},
  {id:'so',k:'ind',t:'str',label:'stdout',x:430,y:0},
  {id:'se',k:'ind',t:'str',label:'stderr（log）',x:430,y:260},
  {id:'kre',k:'const',t:'str',v:'[^\\r\\n]+\\s*$',x:395,y:160,label:'最後一行'},
  {id:'mre',k:'fn',fn:'Match Regular Expression',x:510,y:60,h:56},
  {id:'kty',k:'const',t:'clu',v:'{ok, n, fail, p, alarm, png}',x:398,y:210,label:'type：只放要用的欄位'},
  {id:'uj',k:'fn',fn:'Unflatten From JSON',x:640,y:70,h:40},
  {id:'ub',k:'fn',fn:'Unbundle By Name',outs:['ok','p'],x:730,y:70,h:40},
  {id:'p',k:'ind',t:'dbl',label:'p',x:880,y:20},
  {id:'rc',k:'ind',t:'i32',label:'return code',x:430,y:300},
  {id:'eq',k:'fn',fn:'Equal To 0?',x:640,y:170},
  {id:'and',k:'fn',fn:'And',x:820,y:120},
  {id:'done',k:'ind',t:'bool',label:'分析成功',x:880,y:124},
  {id:'eo',k:'ind',t:'err',label:'error out',x:740,y:220}],
  wires:[
  {id:'w1',from:'kf',to:'fis.format string',t:'str',mx:170},
  {id:'w2',from:'py',to:'fis.input 1',t:'str',mx:165},
  {id:'w3',from:'scr',to:'fis.input 2',t:'str',mx:170},
  {id:'w4',from:'day',to:'fis.input 3',t:'str',mx:175},
  {id:'w5',from:'fis.resulting string',to:'sx.command line',t:'str'},
  {id:'w6',from:'kT',to:'sx.wait until completion?',t:'bool',mx:285},
  {id:'w7',from:'sx.standard output',to:'so',t:'str',mx:400},
  {id:'w8',from:'sx.standard output',to:'mre.input string',t:'str',mx:400},
  {id:'w9',from:'kre',to:'mre.regular expression',t:'str',mx:500},
  {id:'w10',from:'sx.standard error',to:'se',t:'str',mx:390},
  {id:'w11',from:'mre.whole match',to:'uj.JSON string',t:'str'},
  {id:'w12',from:'kty',to:'uj.type',t:'clu',mx:620},
  {id:'w13',from:'uj.value',to:'ub',t:'clu'},
  {id:'w14',from:'ub.p',to:'p',t:'dbl',mx:860},
  {id:'w15',from:'sx.return code',to:'rc',t:'i32',mx:380},
  {id:'w16',from:'sx.return code',to:'eq',t:'i32',mx:385},
  {id:'w17',from:'ub.ok',to:'and.x',t:'bool',mx:800},
  {id:'w18',from:'eq.out',to:'and.y',t:'bool',mx:805},
  {id:'w19',from:'and.out',to:'done',t:'bool'},
  {id:'w20',from:'uj.error out',to:'eo',t:'err',mx:710}]},
 sim:{init:()=>({}),
  step(inp){
   const n=+inp.cs||0,[so,se,rc]=OUTS[n];
   const last=so.split('\n').filter(Boolean).pop();
   const ok=/"ok": true/.test(last),p=ok?0.0234:0,done=ok&&rc===0;
   return {out:{so,se,rc,p,done,eo:false},
    vals:{'fis.resulting string':'"C:\\PM5Tools\\py\\python.exe" "C:\\PM5Tools\\yield_report.py" --day 2026-11-14','sx.return code':rc,'mre.whole match':last.slice(0,40)+'…','ub.ok':ok,'ub.p':p,'eq.out':rc===0,'and.out':done},
    msg:n===0?'結束碼 0、ok 是 true：分析成功，p ＝ 0.0234，圖檔路徑附進報表。':n===1?'stdout 有兩行：只取最後一行，照樣解析成功。如果把整段當 JSON，就會解析錯誤。':n===2?'結束碼 2、ok 是 false：分析失敗。原因在 stderr：database is locked，存進 log。':'結束碼 3、ok 是 false：資料不足，不是錯誤。報表註明「這一班只有 12 片，不畫管制圖」。'};},
  doneMsg:'換一種情況再 Run'}
};

const PYSRC=`import argparse, json, os, sqlite3, sys
import pandas as pd
import matplotlib
matplotlib.use("Agg")              # 不開視窗，只存檔
import matplotlib.pyplot as plt

VERSION = "1.0.0"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--station", required=True)    # ST01
    ap.add_argument("--day", required=True)        # 2026-11-14
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    con = sqlite3.connect(a.db)
    df = pd.read_sql_query(
        "SELECT ts, result FROM tests WHERE station = ? AND ts LIKE ?",
        con, params=(a.station, a.day + "%"))
    df = df[df.result.isin(["PASS", "FAIL"])]    # ERROR 不算（W6）
    if len(df) < 20:
        print(json.dumps({"ok": False, "err": "too few tests",
                          "n": len(df), "ver": VERSION}))
        return 3
    df["hour"] = df.ts.str[11:13]                # 每小時一個子群
    g = df.groupby("hour").result.agg(
        n="size", fail=lambda r: int((r == "FAIL").sum()))
    pbar = g.fail.sum() / g.n.sum()
    g["p"] = g.fail / g.n
    g["ucl"] = pbar + 3 * (pbar * (1 - pbar) / g.n) ** 0.5
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.plot(g.index, g.p, "o-", label="p")
    ax.plot(g.index, g.ucl, "r--", label="UCL")
    ax.axhline(pbar, color="gray", label="p-bar")
    ax.legend()
    png = os.path.join(a.out, f"p_{a.station}_{a.day}.png")
    fig.savefig(png)
    print(json.dumps({"ok": True, "ver": VERSION,
                      "n": int(g.n.sum()), "fail": int(g.fail.sum()),
                      "p": round(float(pbar), 4),
                      "alarm": bool((g.p > g.ucl).any()), "png": png}))
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(json.dumps({"ok": False, "err": type(e).__name__,
                          "ver": VERSION}))
        import traceback
        traceback.print_exc()                   # 印到 stderr
        sys.exit(2)`;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');

L.push({id:'W21',order:30.9992,no:'W21',part:PART,title:'LabVIEW 和 Python 並用：交班時叫 Python 做良率報表和管制圖',mins:70,files:['練習\\實務\\Station\\RunPy.vi','練習\\實務\\Station\\yield_report.py'],
goals:[['學會','什麼工作適合交給 Python、什麼要留在 LabVIEW（判定不要交出去）；四種接法和選擇；LabVIEW 2018 的 Python Node 為什麼不適合新專案；寫介面規格：命令列參數、一行 ASCII JSON、ok 欄位、結束碼、stderr；System Exec 的三個輸出都要看、要有逾時；部署 Python（版本、位元數、requirements.txt、離線安裝）；用 Python 當主程式時流程一樣、哪裡會不一樣。'],['做出','在交班模擬上讓八種情況都不會默默錯、不會卡住；RunPy.vi：組命令、執行、取最後一行 JSON、看 ok 和結束碼；讀懂 yield_report.py 並改一處。'],['為什麼是這個題目','測試職缺常寫「LabVIEW 或 Python 擇一」「熟 Python 尤佳」。實際上常常兩個都會碰到：LabVIEW 管儀器和產線流程，同事用 Python 做分析和報表。兩邊怎麼接、出事時誰負責，就是這一課。']],
check:'不看課文，能說出哪些工作適合交給 Python、為什麼判定不要交出去、介面規格要寫哪幾項、為什麼 JSON 只放 ASCII、為什麼只取最後一行、為什麼要逾時，以及 Python 的 lo <= v <= hi 和 In Range and Coerce 預設有什麼不同。',
body:[
C.h3('這一課的工作','x','兩種語言，一條產線'),
`<p>W9 的資料庫裡有每一片的結果。品保要的是每一班的<b>良率</b>和<b>管制圖</b>（W14 的 p 管制圖）。資料分析的同事已經用 Python（pandas、matplotlib）寫好一支腳本。你的工作不是重寫它，而是讓測試站在交班時<b>穩穩地叫它</b>，把結果附進交班報表。</p>`,
C.h3('① 聽懂需求','','品保經理的原話'),
`<div class="fig" style="background:#fffdf3;border:1px solid #e8dca8;border-radius:6px;padding:10px 14px"><p>「每一班結束，每一站要一張良率和 p 管制圖，附在交班報表裡。小林已經用 Python 寫好了，在他電腦上跑得很好。你接到測試站上。」</p></div>`,
ask('「在他電腦上跑得很好」之後，你要先問清楚什麼？',
 `<ol><li><b>多久跑一次、可以等多久？</b>一班一次，交班時跑，等 1 分鐘可以。</li>
 <li><b>失敗了要不要停站？</b>不行：報表是給品保看的，產線不能因為報表停下來。失敗要記錄、通知，測試照常。</li>
 <li><b>它要什麼輸入、給什麼輸出？</b>資料庫、站號、日期；回傳良率、有沒有超出管制界限、圖檔在哪。用什麼格式？</li>
 <li><b>用哪一版 Python、哪些套件？</b>產線電腦上沒有，誰裝、誰管、版本怎麼鎖？（W19）</li>
 <li><b>腳本誰改、改了怎麼通知？</b>小林改一行，測試站的報表就可能壞掉（W8 的變更管理）。</li></ol>
 <p>還有一條底線：<b>PASS／FAIL 的判定留在 LabVIEW</b>。上下限是品保核准的（W6），判定分散在兩種語言裡，就會有兩份規格，遲早對不上。Python 做的是事後的統計和畫圖。</p>`),
C.h3('② 選接法','','四種做法'),
C.table(['做法','每次呼叫','錯誤怎麼回來','部署','適合'],[
 ['System Exec 呼叫 python.exe，stdout 回 JSON（W18 的做法）','慢（每次都要啟動、import）','結束碼＋stderr＋JSON 的 ok 欄位','任何版本、任何位元數；用完整路徑','一班、一批一次的分析和報表'],
 ['Python 常駐，LabVIEW 用 TCP 或 HTTP 叫它（W17）','快','回應的 JSON；還要處理連不上、逾時','多一個常駐程式要管（誰啟動、掛了誰重開）','每片都要做的運算（例如 W13 每張影像）'],
 ['檔案交換','看多久掃一次','另一個錯誤檔','最簡單','跨電腦、不急的'],
 ['LabVIEW 的 Python Node','快（session 開著）','error out','LabVIEW 2018 只支援 Python 2.7 和 3.6，位元數要和 LabVIEW 一樣，不能用虛擬環境','舊專案維護']
]),
note('為什麼不用 Python Node','LabVIEW 2018 的 Python Node（Open Python Session、Python Node、Close Python Session）只支援 Python 2.7 和 3.6，這兩版都已經停止維護（2.7 在 2020 年初，3.6 在 2021 年底），配 3.6 只能用很舊的 pandas、NumPy；Python 的位元數還要和 LabVIEW 一樣（學校的 LabVIEW 2018 常是 32 位元）。新版的 LabVIEW 支援的 Python 版本比較新。用 System Exec，LabVIEW 只是啟動另一個程式，Python 用哪一版都可以，小林也能在命令列單獨測他的腳本。'),
C.h3('③ 介面規格','','雙方都簽名'),
C.table(['編號','規格'],[
 ['PY1','命令：<code>"python.exe 完整路徑" "yield_report.py 完整路徑" --db … --station ST01 --day 2026-11-14 --out …</code>；路徑都加雙引號'],
 ['PY2','stdout 只印<b>一行 JSON</b>：成功 <code>{"ok": true, "ver": …, "n": …, "fail": …, "p": …, "alarm": …, "png": …}</code>；失敗 <code>{"ok": false, "err": …, "ver": …}</code>'],
 ['PY3','JSON 只放英文鍵名和 ASCII 值（Python 的 <code>json.dumps</code> 預設就會把中文轉成 \\uXXXX）'],
 ['PY4','結束碼：0 成功、3 資料不足（不是錯誤）、2 例外或參數錯誤'],
 ['PY5','除錯訊息、錯誤的 traceback 一律印到 stderr；LabVIEW 存進 log'],
 ['PY6','60 秒內結束；超過，LabVIEW 結束它，記「逾時」'],
 ['PY7','腳本版本（ver）寫進交班報表；腳本、requirements.txt 和 LabVIEW 程式一起發行（W19）']
]),
ask('PY3 為什麼不能直接用中文？',
 `<p>在 Windows 上，Python 的 stdout 接到管線（不是視窗）時，用的是系統的地區編碼（繁體中文 Windows 是 cp950），不是 UTF-8；新版 Python 才會改成預設 UTF-8。LabVIEW 2018 的字串又是另一回事（W17 講過）。中間任何一邊對不上，中文就變亂碼，而且<b>不會報錯</b>，亂碼就這樣印進報表。</p>
 <p>只放 ASCII，三方都不會誤會。要給人看的中文（站名、原因），由 LabVIEW 用代碼對照（W17 的原因代碼）。</p>`),
C.h3('④ 先在交班模擬上試','','八種情況'),
`<p>交班時可能遇到的八種情況，和七道可以加的檢查。全部不勾試一次，再一道一道加上去。目標：沒有「錯」（默默錯）和「卡住」；「沒數字」「誤判」也要清掉。</p>`,
{fn:pyFig},
ask('「多印了一行 loading...」為什麼會讓成功變成失敗？',
 `<p>LabVIEW 把整個 stdout 當成 JSON 解析，第一行 <code>loading...</code> 不是 JSON，解析失敗，明明成功了卻記成「報表失敗」。兩個解法要一起用：規格寫清楚「除錯訊息只能印到 stderr」（PY5），LabVIEW 這邊也只取<b>最後一行</b>解析，對同事的小疏忽寬容一點。</p>
 <p>這是和別人的程式接的通則：<b>規格要嚴格，接收要寬容</b>，但寬容不能寬容到把錯誤當成成功（所以 ok 欄位和結束碼還是要看）。</p>`),
ask('「資料不足」為什麼不算錯誤？',
 `<p>換線的那一班只測了 12 片，畫管制圖沒有意義，腳本照規格回 ok:false、結束碼 3。這是<b>正確的結果</b>：報表上寫「資料不足，不畫管制圖」。如果 LabVIEW 把它當成錯誤通知工程師，工程師每次換線都被叫一次，很快就沒人理這個通知了（W11 的警報洗版）。所以 PY4 把「資料不足」和「出錯」分成不同的結束碼。</p>`),
C.h3('⑤ 寫程式','','RunPy.vi'),
{steps:{title:'RunPy.vi：組命令 → 執行 → 最後一行 JSON → ok 和結束碼',lv:rv,steps:[
 {t:'組出命令',view:'split',add:['cs','kf','py','scr','day','fis','w1','w2','w3','w4'],h:`<p>和 W18 一樣用 Format Into String，路徑兩邊加雙引號（python.exe 常裝在 <code>C:\\Program Files\\…</code>，有空白）。python.exe 用<b>完整路徑</b>，從設定檔讀（W19 的 ConfigPath）：不要只寫 <code>python</code>，產線電腦上可能有好幾個 Python，也可能根本不在 PATH 裡。（圖上只放了 --day，其他參數同樣加進格式字串。）</p>`},
 {t:'執行',view:'split',add:['kT','sx','w5','w6','so','w7','se','w10','rc','w15'],h:`<p>System Exec 等它結束（wait ＝ True），拿到 stdout、stderr、結束碼。stderr 存進 log：失敗時，原因（traceback）都在這裡。</p><p>System Exec 沒有逾時（W18）。所以 RunPy.vi 要放在<b>背景迴圈</b>裡跑，不能放在測試迴圈：等一分鐘的報表，不能讓測試站停一分鐘。要結束卡住的腳本，用 W18 講過的做法（不等＋計時＋taskkill，或 .NET 的 Process）。</p>`},
 {t:'取最後一行，解析 JSON',view:'split',add:['kre','mre','w8','w9','kty','uj','w11','w12','ub','w13','p','w14','eo','w20'],h:`<p>Match Regular Expression 用 <code>[^\\r\\n]+\\s*$</code>：最後一段不是換行的字，後面只剩空白到結尾，也就是最後一行。</p><p>Unflatten From JSON 的 type 接一個 Cluster，只放要用的欄位（W17：多的欄位會被忽略，少了才出錯），標籤和 JSON 的鍵名一模一樣。解析失敗時 error out 有錯，ok 是預設值 False：不會被當成成功。</p>`},
 {t:'ok 和結束碼都要對',view:'split',add:['eq','w16','and','w17','w18','done','w19'],h:`<p>結束碼 ＝ 0 <b>而且</b> ok 是 true，才算分析成功。只看結束碼：腳本自己忘了回非 0 的時候會漏；只看 ok：Python 根本沒跑起來時沒有 JSON。和 W18 的燒錄一樣，不只看一個。</p><p>結束碼 3（資料不足）在上層另外處理：報表寫「資料不足」，不通知工程師。</p>`},
 {t:'Run：四種情況',view:'split',add:[],h:`<p>依序 Run 四種情況。第二種最值得注意：多印了一行，只取最後一行就不受影響。</p>`}
]}},
C.h3('⑥ 讀懂腳本','','yield_report.py'),
`<p>小林的腳本（約 50 行）。你不用會寫 pandas，但要看得懂它<b>照不照規格</b>：輸入是什麼、stdout 印什麼、結束碼什麼時候回什麼、錯誤印到哪裡。</p>`,
`<pre style="font-size:12px;line-height:1.45;overflow-x:auto;background:#f6f8fa;border:1px solid #dde;border-radius:6px;padding:10px">${esc(PYSRC)}</pre>`,
ask('對照 PY1～PY7，這支腳本哪裡照規格、哪裡要注意？',
 `<ul><li>PY2、PY3：成功、失敗都只 <code>print</code> 一行 <code>json.dumps</code>，預設會把非 ASCII 轉成 \\uXXXX。</li>
 <li>PY4：資料不足回 3，例外回 2，成功回 0。注意 argparse 參數錯誤時也是結束碼 2，而且會把說明印到 stderr。</li>
 <li>PY5：例外時 <code>traceback.print_exc()</code> 印到 stderr。</li>
 <li>管制界限：p̄ ＋ 3 × √(p̄(1 − p̄) ÷ n)，n 是每小時的片數（每一點的界限不一樣），和 W14 的 7.9 % 是同一個公式。</li>
 <li><code>matplotlib.use("Agg")</code>：產線電腦上不開視窗，只存 PNG。</li>
 <li>ERROR 的片不算進良率（W6：ERROR 不是 PASS 也不是 FAIL）。這是規格的一部分，要和品保確認。</li></ul>
 <p>試著改一處：把子群從每小時改成每 50 片，要改哪幾行？改完要更新 ver，報表上才看得出是新版（PY7）。</p>`),
C.h3('⑦ 部署','','併進 W19 的部署清單'),
C.table(['項目','寫什麼'],[
 ['Python 版本和位元數','例如 3.12.x 64 位元。用 System Exec，和 LabVIEW 的位元數無關'],
 ['裝法','正式安裝＋虛擬環境（venv 不能搬，要在產線電腦上重建），或 python.org 的 embeddable 可攜版（沒有 pip，套件要自己放進去）'],
 ['python.exe 完整路徑','寫進 LabVIEW 的設定檔'],
 ['requirements.txt','用 <code>==</code> 釘死每個套件的版本，和程式一起發行'],
 ['離線安裝','產線電腦多半不能上網：先做好 wheel 檔的資料夾，安裝時只從資料夾裝'],
 ['驗收','在產線電腦上跑一次 <code>python.exe yield_report.py --selftest</code> 之類的自我測試，回 ok 才算裝好；用作業員帳號跑（W19）'],
 ['退回','舊版的 Python 資料夾或 venv 留到新版穩定']
]),
C.h3('⑧ 反過來','','Python 當主程式'),
`<p>有些公司整個測試站都用 Python 寫：PyVISA 控制儀器（它有純 Python 的後端，不一定要裝 NI-VISA），nidaqmx 套件控制 NI 的 DAQ（要先裝 DAQmx 驅動）。流程和你在 LabVIEW 裡做的一模一樣：</p>`,
C.table(['步驟','LabVIEW','Python'],[
 ['開儀器','VISA Open','<code>rm = pyvisa.ResourceManager()</code>、<code>dmm = rm.open_resource(...)</code>'],
 ['量測','VISA Write ＋ VISA Read，Scan From String','<code>v = float(dmm.query("MEAS:VOLT:DC?"))</code>'],
 ['判定','In Range and Coerce','<code>lo &lt;= v &lt;= hi</code>'],
 ['錯誤處理','錯誤線','<code>try</code>／<code>except</code>'],
 ['結束','VISA Close（不管有沒有錯）','<code>finally: dmm.close()</code>']
]),
warn('同一個判定，兩種語言不一樣','Python 的 <code>lo &lt;= v &lt;= hi</code> 包含上下限；LabVIEW 的 In Range and Coerce <b>預設不包含上限</b>（要右鍵勾 Include upper limit，W6 講過）。W6 的規格 S3 是「下限 ≤ x ≤ 上限，含邊界」：同一份規格翻成兩種語言，一邊寫對、一邊忘了勾，剛好落在上限的板子就會一邊 PASS、一邊 FAIL。這也是「判定只放一個地方」的理由。'),
note('這一課用到的前面的東西','W6 的判定和 ERROR、W9 的資料庫、W11 的警報洗版、W14 的 p 管制圖、W17 的 JSON 和原因代碼、W18 的 System Exec 和「不只看結束碼」、W19 的部署清單和設定檔。'),
C.h3('測','q','小測驗'),
{quiz:[
 {q:'哪一件事不應該交給 Python 腳本？',o:['每一片的 PASS／FAIL 判定','畫管制圖','算良率','產生報表'],a:0,ex:'判定和上下限只放一個地方。'},
 {q:'LabVIEW 2018 的 Python Node 為什麼不適合新專案？',o:['只支援已停止維護的 Python 2.7、3.6，位元數也要一樣','它不能傳數字','它要另外付費','它只能在 Linux 用'],a:0,ex:'用 System Exec，Python 哪一版都可以。'},
 {q:'腳本的 stdout 為什麼只能印一行 JSON？',o:['LabVIEW 要解析它；除錯訊息印到 stderr','比較快','Python 規定','LabVIEW 只能讀一行'],a:0,ex:'LabVIEW 這邊也只取最後一行，寬容一點。'},
 {q:'JSON 裡為什麼只放 ASCII？',o:['中文經過管線和不同編碼會變亂碼，而且不會報錯','JSON 不能有中文','比較短','LabVIEW 不支援 JSON'],a:0,ex:'要中文由 LabVIEW 用代碼對照。'},
 {q:'分析成功的條件？',o:['結束碼 0 而且 ok 是 true','結束碼 0 就好','有輸出就好','沒有 stderr 就好'],a:0,ex:'不只看一個。'},
 {q:'RunPy.vi 應該放在哪裡跑？',o:['背景迴圈，不擋測試','測試迴圈裡','前面板','不用跑'],a:0,ex:'System Exec 沒有逾時，報表不能讓測試站停。'},
 {q:'這一班只有 12 片，腳本回 ok:false、結束碼 3，LabVIEW 應該？',o:['報表寫「資料不足」，不通知工程師','通知工程師','重跑','停站'],a:0,ex:'這是正確的結果，不是錯誤。'},
 {q:'Python 的 lo <= v <= hi 和 LabVIEW In Range and Coerce 的預設差在哪？',o:['Python 包含上限，In Range 預設不包含','完全一樣','Python 不包含下限','In Range 預設包含上限'],a:0,ex:'要右鍵勾 Include upper limit。'}
]}
]});
})();

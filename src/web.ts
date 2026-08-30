const STYLE = `
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,'Noto Sans Thai',sans-serif;
background:#faf7f2;color:#221c17}
.wrap{max-width:520px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:#7a6a5c;font-size:14px;margin:0 0 20px}
.card{background:#fff;border:1px solid #ece4da;border-radius:16px;padding:18px;margin-bottom:14px;
box-shadow:0 1px 3px rgba(80,60,40,.06)}
label{display:block;font-size:13px;color:#7a6a5c;margin:0 0 6px}
input,select{width:100%;padding:13px;font-size:17px;border:1px solid #ddd2c6;border-radius:11px;
background:#fff;color:inherit;margin-bottom:12px}
button{width:100%;padding:15px;font-size:17px;font-weight:600;border:0;border-radius:11px;
background:#e8622c;color:#fff;cursor:pointer}
button:disabled{background:#d9cfc5;color:#8b7d70;cursor:not-allowed}
button.ghost{background:#fff;color:#e8622c;border:1.5px solid #e8622c}
.stars{font-size:30px;letter-spacing:2px;line-height:1.35;word-break:break-all}
.big{font-size:40px;font-weight:700;margin:2px 0}
.row{display:flex;gap:10px}
.row>*{flex:1}
.menu-btn{padding:13px;border:1.5px solid #ddd2c6;border-radius:11px;background:#fff;color:inherit;
font-size:16px;font-weight:500;margin-bottom:8px;text-align:left}
.menu-btn.on{border-color:#e8622c;background:#fdece5;color:#b4441a}
.msg{padding:13px;border-radius:11px;font-size:15px;margin-bottom:12px;display:none}
.ok{background:#e6f6ec;color:#1c6b3a}
.err{background:#fdeaea;color:#a32626}
.code{font-size:34px;font-weight:700;letter-spacing:4px;text-align:center;color:#e8622c;margin:10px 0}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{padding:9px 6px;text-align:left;border-bottom:1px solid #f0e8de}
th{color:#7a6a5c;font-weight:500;font-size:13px}
td.n,th.n{text-align:right}
nav{display:flex;gap:8px;margin-bottom:16px;font-size:14px}
nav a{flex:1;text-align:center;padding:9px;border-radius:10px;text-decoration:none;
background:#fff;border:1px solid #ece4da;color:#7a6a5c}
nav a.on{background:#221c17;color:#fff;border-color:#221c17}
.muted{color:#7a6a5c;font-size:13px}
@media(prefers-color-scheme:dark){
body{background:#17130f;color:#f2ece5}
.card{background:#221c17;border-color:#33291f;box-shadow:none}
input,select,.menu-btn,nav a,button.ghost{background:#2b2319;border-color:#3d3227;color:#f2ece5}
.menu-btn.on{background:#43281c;border-color:#e8622c;color:#ffb591}
nav a.on{background:#e8622c;border-color:#e8622c;color:#fff}
.ok{background:#1c3327;color:#8fe0ae}.err{background:#3a1f1f;color:#f0a3a3}
}`;

function page(title: string, active: string, body: string, script: string): string {
  const nav =
    '<nav>' +
    '<a href="/" class="' + (active === 'home' ? 'on' : '') + '">สะสมดาว</a>' +
    '<a href="/staff" class="' + (active === 'staff' ? 'on' : '') + '">พนักงาน</a>' +
    '<a href="/dashboard" class="' + (active === 'dash' ? 'on' : '') + '">สถิติ</a>' +
    '</nav>';
  return '<!doctype html><html lang="th"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title><style>' + STYLE + '</style></head><body><div class="wrap">' +
    nav + body + '</div><script>' + script + '</script></body></html>';
}

const HELPERS = `
function $(id){return document.getElementById(id)}
function show(id,text,cls){var e=$(id);e.textContent=text;e.className='msg '+cls;e.style.display='block'}
function hide(id){$(id).style.display='none'}
function api(method,url,body){
  return fetch(url,{method:method,headers:{'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined}).then(function(r){
    return r.json().then(function(d){ if(!r.ok){throw new Error(d.error||'เกิดข้อผิดพลาด')} return d })})
}
function deviceId(){
  var d=localStorage.getItem('frs_device');
  if(!d){d='dev-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
    localStorage.setItem('frs_device',d)}
  return d
}
function starRow(n){var f=n>10?10:n;var s='';for(var i=0;i<10;i++){s+=(i<f)?'⭐':'☆'}return s}
`;

export function homePage(): string {
  const body = `
<h1>สะสมดาว รับข้าวฟรี</h1>
<p class="sub">ซื้อครบ 10 ดาว = ข้าวกล่องฟรี 1 กล่อง</p>
<div class="card">
  <div id="msg" class="msg"></div>
  <label>เบอร์โทรของคุณ</label>
  <input id="phone" type="tel" inputmode="numeric" placeholder="08XXXXXXXX" maxlength="10">
  <label>ชื่อ (ใส่ครั้งแรกครั้งเดียว)</label>
  <input id="name" type="text" placeholder="ชื่อเล่นก็ได้">
  <label>วันนี้ซื้อเมนูอะไร</label>
  <div id="menu"></div>
  <button id="go">รับดาว</button>
</div>
<div class="card" id="balance" style="display:none">
  <div class="muted">ดาวสะสมของ <span id="who"></span></div>
  <div class="big"><span id="count">0</span> ดาว</div>
  <div class="stars" id="stars"></div>
  <p class="muted" id="hint"></p>
  <button id="redeem" class="ghost" style="display:none">แลกข้าวฟรี 1 กล่อง</button>
  <div id="codebox" style="display:none">
    <p class="muted" style="text-align:center;margin:14px 0 0">โชว์รหัสนี้ให้พนักงาน</p>
    <div class="code" id="code"></div>
  </div>
</div>`;

  const script = HELPERS + `
var picked=null, menus=[];
function drawMenu(){
  var box=$('menu'); box.innerHTML='';
  if(!menus.length){box.innerHTML='<p class="muted">ยังไม่ได้ตั้งเมนูวันนี้ — กดรับดาวได้เลย</p>';return}
  menus.forEach(function(m){
    var b=document.createElement('button');
    b.type='button'; b.className='menu-btn'+(picked&&picked.menu_name===m.menu_name?' on':'');
    b.textContent=m.menu_name+(m.price?'  '+m.price+' บาท':'');
    b.onclick=function(){picked=m;drawMenu()};
    box.appendChild(b)
  })
}
function paint(d){
  $('balance').style.display='block';
  $('who').textContent=d.name||d.phone;
  $('count').textContent=d.stars;
  $('stars').textContent=starRow(d.stars>=10?10:d.stars);
  var left=10-(d.stars%10===0&&d.stars>0?10:d.stars%10);
  $('hint').textContent=d.stars>=10?'ครบแล้ว! แลกข้าวฟรีได้เลย':'อีก '+left+' ดาว ได้ข้าวฟรี 1 กล่อง';
  $('redeem').style.display=d.stars>=10?'block':'none';
}
$('go').onclick=function(){
  var phone=$('phone').value.replace(/\\D/g,'');
  if(phone.length<9){show('msg','ใส่เบอร์โทรให้ครบก่อนนะ','err');return}
  hide('msg'); $('go').disabled=true; $('go').textContent='กำลังบันทึก...';
  api('POST','/api/v1/checkin',{phone:phone,name:$('name').value||null,
    menu:picked?picked.menu_name:null,price:picked?picked.price:null,device_id:deviceId()})
  .then(function(d){
    show('msg',d.message,d.awarded?'ok':'err'); paint(d);
    localStorage.setItem('frs_phone',phone)
  }).catch(function(e){show('msg',e.message,'err')})
  .then(function(){$('go').disabled=false;$('go').textContent='รับดาว'});
};
$('redeem').onclick=function(){
  var phone=$('phone').value.replace(/\\D/g,'');
  api('POST','/api/v1/redeem',{phone:phone}).then(function(d){
    $('codebox').style.display='block'; $('code').textContent=d.reward_code;
    $('redeem').style.display='none';
    show('msg','แลกสำเร็จ! โชว์รหัสให้พนักงาน','ok');
    return api('GET','/api/v1/customer/'+phone)
  }).then(paint).catch(function(e){show('msg',e.message,'err')})
};
var saved=localStorage.getItem('frs_phone');
if(saved){$('phone').value=saved;
  api('GET','/api/v1/customer/'+saved).then(function(d){$('name').value=d.name||'';paint(d)}).catch(function(){})}
api('GET','/api/v1/menu/today').then(function(d){menus=d.items;drawMenu()}).catch(function(){drawMenu()});
`;
  return page('สะสมดาว รับข้าวฟรี', 'home', body, script);
}

export function staffPage(): string {
  const body = `
<h1>หน้าพนักงาน</h1>
<p class="sub">ตั้งเมนูวันนี้ และตรวจรหัสแลกของรางวัล</p>
<div class="card">
  <label>ตรวจรหัสแลกข้าวฟรี</label>
  <div id="rmsg" class="msg"></div>
  <input id="rcode" type="text" placeholder="เช่น 4821" maxlength="12">
  <button id="rgo">ตรวจและตัดรหัส</button>
</div>
<div class="card">
  <label>เมนูวันนี้</label>
  <div id="mmsg" class="msg"></div>
  <div class="row">
    <input id="mname" type="text" placeholder="ชื่อเมนู เช่น ข้าวกะเพราไก่">
    <input id="mprice" type="number" placeholder="ราคา">
  </div>
  <button id="mgo" class="ghost">เพิ่มเมนู</button>
  <table id="mtable"></table>
</div>
<div class="card">
  <label>ยอดวันนี้</label>
  <table id="today"></table>
</div>`;

  const script = HELPERS + `
function loadMenu(){
  api('GET','/api/v1/menu/today').then(function(d){
    var t='<tr><th>เมนู</th><th class="n">ราคา</th></tr>';
    if(!d.items.length){t+='<tr><td colspan="2" class="muted">ยังไม่มีเมนูวันนี้</td></tr>'}
    d.items.forEach(function(m){t+='<tr><td>'+m.menu_name+'</td><td class="n">'+(m.price||'-')+'</td></tr>'});
    $('mtable').innerHTML=t
  })
}
function loadToday(){
  api('GET','/api/v1/summary').then(function(d){
    var t='<tr><th>เมนู</th><th class="n">ขายได้</th><th class="n">เงิน</th></tr>';
    d.items.forEach(function(r){t+='<tr><td>'+r.menu+'</td><td class="n">'+r.units+'</td><td class="n">'+r.revenue+'</td></tr>'});
    t+='<tr><td><b>รวม</b></td><td class="n"><b>'+d.summary.total_units+'</b></td><td class="n"><b>'+d.summary.total_revenue+'</b></td></tr>';
    $('today').innerHTML=t
  })
}
$('rgo').onclick=function(){
  var c=$('rcode').value.trim();
  if(!c){show('rmsg','ใส่รหัสก่อน','err');return}
  api('POST','/api/v1/redeem/confirm',{code:c}).then(function(d){
    show('rmsg','ถูกต้อง! ให้ข้าวฟรี 1 กล่อง ('+(d.name||d.phone)+')','ok');$('rcode').value=''
  }).catch(function(e){show('rmsg',e.message,'err')})
};
$('mgo').onclick=function(){
  var n=$('mname').value.trim();
  if(!n){show('mmsg','ใส่ชื่อเมนูก่อน','err');return}
  api('POST','/api/v1/menu',{menu_name:n,price:parseInt($('mprice').value||'0',10)}).then(function(){
    show('mmsg','เพิ่มเมนูแล้ว','ok');$('mname').value='';$('mprice').value='';loadMenu()
  }).catch(function(e){show('mmsg',e.message,'err')})
};
loadMenu();loadToday();
`;
  return page('หน้าพนักงาน', 'staff', body, script);
}

export function dashboardPage(): string {
  const body = `
<h1>สถิติร้าน</h1>
<p class="sub">อัปเดตอัตโนมัติทุกครั้งที่ลูกค้ากดรับดาว</p>
<div class="card">
  <div class="muted">ยอดวันนี้</div>
  <div class="big"><span id="rev">0</span> บาท</div>
  <p class="muted"><span id="units">0</span> กล่อง · <span id="cust">0</span> คน</p>
</div>
<div class="card"><label>เมนูขายดี 7 วันล่าสุด</label><table id="best"></table></div>
<div class="card"><label>ยอดขายรายวัน</label><table id="daily"></table></div>
<div class="card"><label>ลูกค้าประจำ</label><table id="top"></table></div>`;

  const script = HELPERS + `
api('GET','/api/v1/summary').then(function(d){
  $('rev').textContent=d.summary.total_revenue;
  $('units').textContent=d.summary.total_units;
  $('cust').textContent=d.summary.customers;
});
api('GET','/api/v1/stats').then(function(d){
  var t='<tr><th>เมนู</th><th class="n">กล่อง</th><th class="n">บาท</th></tr>';
  d.best_menu.forEach(function(r){t+='<tr><td>'+r.menu+'</td><td class="n">'+r.units+'</td><td class="n">'+r.revenue+'</td></tr>'});
  $('best').innerHTML=t||'';
  var t2='<tr><th>วันที่</th><th class="n">กล่อง</th><th class="n">บาท</th></tr>';
  d.daily.forEach(function(r){t2+='<tr><td>'+r.date+'</td><td class="n">'+r.units+'</td><td class="n">'+r.revenue+'</td></tr>'});
  $('daily').innerHTML=t2;
  var t3='<tr><th>ลูกค้า</th><th class="n">ครั้ง</th><th class="n">ดาว</th></tr>';
  d.top_customers.forEach(function(r){t3+='<tr><td>'+(r.name||r.phone)+'</td><td class="n">'+r.visits+'</td><td class="n">'+r.stars+'</td></tr>'});
  $('top').innerHTML=t3;
});
`;
  return page('สถิติร้าน', 'dash', body, script);
}

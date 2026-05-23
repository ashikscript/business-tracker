// ===== FIREBASE CONFIG (pre-configured) =====
const FIREBASE_CFG = {
  apiKey: "AIzaSyDMMoEAz6ifCX_Ym7Hw31DyNd9Pka30iPk",
  dbUrl: "https://jaif-business-tracker-default-rtdb.firebaseio.com",
  projectId: "jaif-business-tracker",
  appId: "1:675337399137:web:04f5c8a3072d73e5ae7320"
};
/* ===== STATE ===== */
let entries = JSON.parse(localStorage.getItem('biz_e')||'[]');
let trash   = JSON.parse(localStorage.getItem('biz_t')||'[]');
let isAuth  = sessionStorage.getItem('biz_auth')==='1';
let isVO    = sessionStorage.getItem('biz_vo')==='1';
let flt='all', rptP='3m';
let db=null, fbRef=null, tbRef=null;
let CH={};
const CLR=['#185FA5','#3B6D11','#854F0B','#993556','#533AB7','#0F6E56'];

function H(s){let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h.toString(16)}
function getPass(){return localStorage.getItem('biz_pw')||H('1234')}

/* ===== AUTH ===== */
function doLogin(){
  const v=document.getElementById('passInput').value;
  if(!v){hint('Please enter your password');return}
  if(H(v)===getPass()){
    sessionStorage.setItem('biz_auth','1');
    sessionStorage.removeItem('biz_vo');
    isAuth=true;isVO=false;
    boot();
  } else {
    hint('Incorrect password. Try again.');
    document.getElementById('passInput').value='';
    document.getElementById('passInput').focus();
  }
}
function goViewOnly(){
  sessionStorage.removeItem('biz_auth');
  sessionStorage.setItem('biz_vo','1');
  isAuth=false;isVO=true;
  boot();
}
function doLogout(){
  sessionStorage.clear();isAuth=false;isVO=false;
  document.getElementById('mainApp').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('passInput').value='';
}
function toggleEye(){
  const i=document.getElementById('passInput'),ic=document.getElementById('eyeIcon');
  if(i.type==='password'){i.type='text';ic.className='ti ti-eye-off';}
  else{i.type='password';ic.className='ti ti-eye';}
}
function hint(m){const h=document.getElementById('loginHint');h.textContent=m;setTimeout(()=>h.textContent='',3000)}

function changePass(){
  if(!isAuth){toast('You must be logged in to change the password','er');return}
  const o=document.getElementById('oldP').value;
  const n=document.getElementById('newP').value;
  const c=document.getElementById('confP').value;
  if(H(o)!==getPass()){toast('Current password is incorrect','er');return}
  if(n.length<4){toast('New password must be at least 4 characters','er');return}
  if(n!==c){toast('Passwords do not match','er');return}
  localStorage.setItem('biz_pw',H(n));
  ['oldP','newP','confP'].forEach(id=>document.getElementById(id).value='');
  toast('Password updated successfully!','ok');
}

function boot(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('voBar').style.display=isVO?'flex':'none';
  document.getElementById('tabAdd').style.display=isVO?'none':'';
  document.getElementById('logLabel').textContent=isAuth?'Logout':'Login';
  document.getElementById('dateDisplay').textContent=
    new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  autoClean();updateTCnt();
  const cfg=JSON.parse(localStorage.getItem('fbCfg')||'{}');
  if(cfg.apiKey) initFb(cfg);
  renderDash();
}

if(isAuth||isVO){document.addEventListener('DOMContentLoaded',boot);}

/* ===== TABS ===== */
function showTab(n){
  if(n==='add'&&isVO){toast('Please login to add entries','er');return}
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+n).classList.add('active');
  const tabs=['dashboard','add','history','report','trash','setup'];
  const i=tabs.indexOf(n);if(i>=0)document.querySelectorAll('.tab')[i].classList.add('active');
  if(n==='dashboard')renderDash();
  if(n==='history')renderHistory();
  if(n==='report')renderReport();
  if(n==='trash')renderTrash();
  if(n==='setup')loadCfg();
}

/* ===== ENTRIES ===== */
function addEntry(){
  const p=document.getElementById('fProd').value.trim();
  const a=parseFloat(document.getElementById('fAmt').value);
  if(!p){toast('Please enter a product name','er');return}
  if(!a||a<=0){toast('Please enter a valid amount','er');return}
  const e={
    id:Date.now()+'_'+Math.random().toString(36).substr(2,5),
    product:p,amount:a,
    category:document.getElementById('fCat').value,
    payment:document.getElementById('fPay').value,
    customer:document.getElementById('fCust').value.trim(),
    type:document.getElementById('fType').value,
    note:document.getElementById('fNote').value.trim(),
    date:new Date().toISOString()
  };
  entries.unshift(e);saveE();
  if(db&&fbRef)fbRef.child(e.id).set(e);
  clearForm();toast('Entry saved successfully!','ok');showTab('dashboard');
}
function clearForm(){
  ['fProd','fAmt','fCust','fNote'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fType').value='sale';
}
function deleteEntry(id){
  if(!isAuth){toast('Please login to delete entries','er');return}
  const e=entries.find(x=>x.id===id);if(!e)return;
  e.deletedAt=new Date().toISOString();
  trash.unshift(e);entries=entries.filter(x=>x.id!==id);
  saveE();saveT();
  if(db){if(fbRef)fbRef.child(id).remove();if(tbRef)tbRef.child(id).set(e);}
  updateTCnt();renderHistory();renderDash();toast('Moved to Trash','inf');
}
function openEdit(id){
  if(!isAuth){toast('Please login to edit entries','er');return}
  const e=entries.find(x=>x.id===id);if(!e)return;
  document.getElementById('eId').value=e.id;
  document.getElementById('eProd').value=e.product;
  document.getElementById('eAmt').value=e.amount;
  document.getElementById('eCat').value=e.category;
  document.getElementById('ePay').value=e.payment;
  document.getElementById('eCust').value=e.customer||'';
  document.getElementById('eType').value=e.type;
  document.getElementById('eNote').value=e.note||'';
  document.getElementById('editModal').classList.add('open');
}
function closeEdit(){document.getElementById('editModal').classList.remove('open')}
function saveEdit(){
  const id=document.getElementById('eId').value;
  const p=document.getElementById('eProd').value.trim();
  const a=parseFloat(document.getElementById('eAmt').value);
  if(!p){toast('Product name is required','er');return}
  if(!a||a<=0){toast('Enter a valid amount','er');return}
  const i=entries.findIndex(e=>e.id===id);if(i<0)return;
  entries[i]={...entries[i],product:p,amount:a,
    category:document.getElementById('eCat').value,
    payment:document.getElementById('ePay').value,
    customer:document.getElementById('eCust').value.trim(),
    type:document.getElementById('eType').value,
    note:document.getElementById('eNote').value.trim(),
    editedAt:new Date().toISOString()};
  saveE();
  if(db&&fbRef)fbRef.child(id).set(entries[i]);
  closeEdit();renderHistory();renderDash();toast('Entry updated!','ok');
}

/* ===== TRASH ===== */
function autoClean(){
  const before=trash.length;
  trash=trash.filter(e=>Date.now()-new Date(e.deletedAt).getTime()<15*86400000);
  if(trash.length<before)saveT();
}
function dLeft(d){return Math.max(0,15-Math.floor((Date.now()-new Date(d).getTime())/86400000))}
function restoreEntry(id){
  if(!isAuth){toast('Please login to restore entries','er');return}
  const e=trash.find(x=>x.id===id);if(!e)return;
  delete e.deletedAt;entries.unshift(e);trash=trash.filter(x=>x.id!==id);
  saveE();saveT();
  if(db){if(fbRef)fbRef.child(id).set(e);if(tbRef)tbRef.child(id).remove();}
  updateTCnt();renderTrash();renderDash();toast('Entry restored!','ok');
}
function permDel(id){
  if(!isAuth){toast('Please login','er');return}
  if(!confirm('Permanently delete this entry? This cannot be undone.'))return;
  trash=trash.filter(e=>e.id!==id);saveT();
  if(db&&tbRef)tbRef.child(id).remove();
  updateTCnt();renderTrash();toast('Permanently deleted','inf');
}
function emptyTrash(){
  if(!isAuth){toast('Please login','er');return}
  if(!confirm('Permanently delete ALL trash items?'))return;
  trash=[];saveT();
  if(db&&tbRef)tbRef.set({});
  updateTCnt();renderTrash();toast('Trash emptied','inf');
}
function updateTCnt(){
  const c=document.getElementById('tCnt');
  if(trash.length){c.textContent=trash.length>9?'9+':trash.length;c.style.display='flex';}
  else c.style.display='none';
}
function saveE(){localStorage.setItem('biz_e',JSON.stringify(entries))}
function saveT(){localStorage.setItem('biz_t',JSON.stringify(trash))}

/* ===== HELPERS ===== */
function fD(iso){return new Date(iso).toLocaleDateString('en-US',{day:'2-digit',month:'short'})}
function fA(a){return '৳'+Math.round(a).toLocaleString('en-IN')}

function filtered(){
  let d=[...entries];
  const s=(document.getElementById('srch')?.value||'').toLowerCase();
  const c=document.getElementById('fltCat')?.value||'';
  if(s)d=d.filter(e=>e.product.toLowerCase().includes(s)||(e.customer||'').toLowerCase().includes(s));
  if(c)d=d.filter(e=>e.category===c);
  const n=new Date();
  if(flt==='sale')d=d.filter(e=>e.type==='sale');
  else if(flt==='refund')d=d.filter(e=>e.type==='refund');
  else if(flt==='today')d=d.filter(e=>new Date(e.date).toDateString()===n.toDateString());
  else if(flt==='month')d=d.filter(e=>{const x=new Date(e.date);return x.getMonth()===n.getMonth()&&x.getFullYear()===n.getFullYear();});
  return d;
}
function setFlt(f,b){flt=f;document.querySelectorAll('#tab-history .fb').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderHistory()}
function setRpt(p,b){rptP=p;document.querySelectorAll('#tab-report .fb').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderReport()}

function mkC(id,type,labels,datasets,opts={}){
  if(CH[id])CH[id].destroy();
  const c=document.getElementById(id);if(!c)return;
  CH[id]=new Chart(c,{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},...opts}});
}

/* ===== RENDER DASHBOARD ===== */
function renderDash(){
  const n=new Date();
  const mo=entries.filter(e=>{const d=new Date(e.date);return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()});
  const sl=mo.filter(e=>e.type==='sale'),rf=mo.filter(e=>e.type==='refund');
  const ts=sl.reduce((s,e)=>s+e.amount,0),tr=rf.reduce((s,e)=>s+e.amount,0),net=ts-tr;
  const lm=new Date(n.getFullYear(),n.getMonth()-1,1);
  const lms=entries.filter(e=>{const d=new Date(e.date);return d.getMonth()===lm.getMonth()&&d.getFullYear()===lm.getFullYear()&&e.type==='sale'}).reduce((s,e)=>s+e.amount,0);
  const gr=lms?Math.round(((net-lms)/lms)*100):0;
  const all=entries.filter(e=>e.type==='sale').reduce((s,e)=>s+e.amount,0);
  document.getElementById('metGrid').innerHTML=`
    <div class="metric"><div class="m-label">Net Revenue This Month</div><div class="m-val up">${fA(net)}</div><div class="m-sub">${gr>=0?'▲':'▼'} ${Math.abs(gr)}% vs last month</div></div>
    <div class="metric"><div class="m-label">Total Sales</div><div class="m-val">${fA(ts)}</div><div class="m-sub">${sl.length} transactions</div></div>
    <div class="metric"><div class="m-label">Refunds</div><div class="m-val warn">${fA(tr)}</div><div class="m-sub">${rf.length} refunds</div></div>
    <div class="metric"><div class="m-label">All-Time Revenue</div><div class="m-val">${fA(all)}</div><div class="m-sub">${entries.length} total entries</div></div>
  `;
  const dim=new Date(n.getFullYear(),n.getMonth()+1,0).getDate();
  const dm={};sl.forEach(e=>{const d=new Date(e.date).getDate();dm[d]=(dm[d]||0)+e.amount});
  const dlbl=Array.from({length:dim},(_,i)=>i+1);
  mkC('dayChart','bar',dlbl,[{data:dlbl.map(d=>Math.round(dm[d]||0)),backgroundColor:'rgba(24,95,165,0.15)',borderColor:'#185FA5',borderWidth:1.5,borderRadius:4}],
    {scales:{x:{ticks:{color:'#888',font:{size:10}},grid:{display:false}},y:{ticks:{color:'#888',font:{size:10},callback:v=>'৳'+v},grid:{color:'rgba(0,0,0,0.04)'}}}});

  const rec=entries.slice(0,5);
  document.getElementById('dashAddBtn').style.display=isVO?'none':'';
  document.getElementById('recentList').innerHTML=rec.length?rec.map(e=>`
    <div class="re-item">
      <div class="re-ico ${e.type==='refund'?'rf':''}"><i class="ti ti-${e.type==='sale'?'receipt':'receipt-refund'}"></i></div>
      <div class="re-info">
        <div class="re-name">${e.product}</div>
        <div class="re-meta">${fD(e.date)} · ${e.payment}${e.customer?' · '+e.customer:''}</div>
      </div>
      <div class="re-amt ${e.type==='sale'?'apos':'aneg'}">${e.type==='refund'?'−':''}${fA(e.amount)}</div>
      <div class="re-acts">${isAuth?`
        <button class="bic ed btn-sm" onclick="openEdit('${e.id}')" title="Edit"><i class="ti ti-edit"></i></button>
        <button class="bic dl btn-sm" onclick="deleteEntry('${e.id}')" title="Delete"><i class="ti ti-trash"></i></button>`:''}</div>
    </div>`).join(''):'<div class="empty" style="padding:1.5rem"><i class="ti ti-receipt-off"></i>No entries yet</div>';
}

/* ===== RENDER HISTORY ===== */
function renderHistory(){
  const d=filtered();
  const body=document.getElementById('histBody'),emp=document.getElementById('histEmpty');
  if(!d.length){body.innerHTML='';emp.style.display='';return}
  emp.style.display='none';
  body.innerHTML=d.map(e=>`
    <tr>
      <td style="font-size:12px;color:var(--text2)">${fD(e.date)}</td>
      <td><div style="font-weight:500">${e.product}</div>${e.customer?`<div style="font-size:11px;color:var(--text3)">${e.customer}</div>`:''}</td>
      <td><span class="badge b-blue">${e.category}</span></td>
      <td style="font-size:12px;color:var(--text2)">${e.payment}</td>
      <td class="${e.type==='sale'?'apos':'aneg'}">${e.type==='refund'?'−':''}${fA(e.amount)}</td>
      <td style="white-space:nowrap">${isAuth?`
        <button class="bic ed btn-sm" onclick="openEdit('${e.id}')" title="Edit"><i class="ti ti-edit"></i></button>
        <button class="bic dl btn-sm" onclick="deleteEntry('${e.id}')" title="Delete"><i class="ti ti-trash"></i></button>`:'<span style="font-size:11px;color:var(--text3)">view only</span>'}
      </td>
    </tr>`).join('');
}

/* ===== RENDER TRASH ===== */
function renderTrash(){
  const lst=document.getElementById('trashList'),emp=document.getElementById('trashEmpty');
  document.getElementById('emptyBtn').style.display=trash.length&&isAuth?'':'none';
  if(!trash.length){lst.innerHTML='';emp.style.display='';return}
  emp.style.display='none';
  lst.innerHTML=trash.map(e=>`
    <div class="tr-item">
      <div class="tr-info">
        <div class="tr-name">${e.product} <span style="font-size:11px;color:var(--text3)">(${fA(e.amount)})</span></div>
        <div class="tr-meta">${e.category} · ${e.payment} · ${fD(e.date)}</div>
      </div>
      <span class="tr-days">${dLeft(e.deletedAt)}d left</span>
      ${isAuth?`<button class="bic rs btn-sm" onclick="restoreEntry('${e.id}')" title="Restore"><i class="ti ti-restore"></i></button>
      <button class="bic dl btn-sm" onclick="permDel('${e.id}')" title="Delete permanently"><i class="ti ti-trash-x"></i></button>`:'' }
    </div>`).join('');
}

/* ===== RENDER REPORT ===== */
function renderReport(){
  const mo=rptP==='3m'?3:rptP==='6m'?6:12;
  const n=new Date(),md=[];
  for(let i=mo-1;i>=0;i--){
    const d=new Date(n.getFullYear(),n.getMonth()-i,1);
    const lbl=d.toLocaleDateString('en-US',{month:'short',year:'2-digit'});
    const s=entries.filter(e=>{const x=new Date(e.date);return x.getMonth()===d.getMonth()&&x.getFullYear()===d.getFullYear()&&e.type==='sale'}).reduce((a,e)=>a+e.amount,0);
    const r=entries.filter(e=>{const x=new Date(e.date);return x.getMonth()===d.getMonth()&&x.getFullYear()===d.getFullYear()&&e.type==='refund'}).reduce((a,e)=>a+e.amount,0);
    md.push({lbl,s:Math.round(s),r:Math.round(r),net:Math.round(s-r)});
  }
  const tot=md.reduce((a,m)=>a+m.net,0),avg=Math.round(tot/mo);
  const best=md.reduce((a,b)=>b.net>a.net?b:a,{net:0,lbl:'-'});
  document.getElementById('rptMet').innerHTML=`
    <div class="metric"><div class="m-label">Total Revenue (${mo} months)</div><div class="m-val up">${fA(tot)}</div></div>
    <div class="metric"><div class="m-label">Monthly Average</div><div class="m-val">${fA(avg)}</div></div>
    <div class="metric"><div class="m-label">Best Month</div><div class="m-val">${best.lbl}</div><div class="m-sub">${fA(best.net)}</div></div>
  `;
  mkC('rptChart','line',md.map(m=>m.lbl),[
    {label:'Sales',data:md.map(m=>m.s),borderColor:'#185FA5',backgroundColor:'rgba(24,95,165,0.07)',fill:true,tension:.4,pointRadius:4,borderWidth:2},
    {label:'Refunds',data:md.map(m=>m.r),borderColor:'#A32D2D',backgroundColor:'rgba(163,45,45,0.05)',fill:true,tension:.4,pointRadius:4,borderWidth:2,borderDash:[5,3]}
  ],{scales:{x:{ticks:{color:'#888',font:{size:11}},grid:{display:false}},y:{ticks:{color:'#888',font:{size:11},callback:v=>'৳'+v.toLocaleString()},grid:{color:'rgba(0,0,0,0.04)'}}}});

  const ct={};entries.filter(e=>e.type==='sale').forEach(e=>{ct[e.category]=(ct[e.category]||0)+e.amount});
  const ck=Object.keys(ct),cv=ck.map(k=>Math.round(ct[k]));
  const tot2=cv.reduce((a,b)=>a+b,0)||1;
  mkC('donut','doughnut',ck,[{data:cv,backgroundColor:CLR.slice(0,ck.length),borderWidth:0,hoverOffset:4}],{cutout:'62%'});
  document.getElementById('donutLgd').innerHTML=ck.map((k,i)=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
      <span style="width:10px;height:10px;border-radius:2px;background:${CLR[i]};flex-shrink:0"></span>
      <span style="font-size:13px;color:var(--text2)">${k}</span>
      <span style="font-size:13px;font-weight:600;margin-left:auto">${Math.round(ct[k]/tot2*100)}%</span>
    </div>`).join('');

  const pm={};entries.filter(e=>e.type==='sale').forEach(e=>{pm[e.product]=(pm[e.product]||0)+e.amount});
  const top=Object.entries(pm).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const mx=top[0]?.[1]||1;
  document.getElementById('topProds').innerHTML=top.length?top.map(([nm,a],i)=>`
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:13px;font-weight:500">${i+1}. ${nm}</span>
        <span style="font-size:13px;color:var(--green);font-weight:600">${fA(Math.round(a))}</span>
      </div>
      <div class="pbar"><div class="pfill" style="width:${Math.round(a/mx*100)}%"></div></div>
    </div>`).join(''):'<div class="empty" style="padding:1rem"><i class="ti ti-package-off"></i>No data yet</div>';
}

/* ===== FIREBASE ===== */
function loadCfg(){
  const c=JSON.parse(localStorage.getItem('fbCfg')||'{}');
  if(c.apiKey)document.getElementById('fbKey').value=c.apiKey;
  if(c.dbUrl)document.getElementById('fbUrl').value=c.dbUrl;
  if(c.projectId)document.getElementById('fbPid').value=c.projectId;
  if(c.appId)document.getElementById('fbAid').value=c.appId;
}
function saveFb(){ toast('Firebase is pre-configured and always connected!','ok'); initFb(FIREBASE_CFG); }
function initFb(cfg){
  const dot=document.getElementById('syncDot'),txt=document.getElementById('syncTxt');
  if(typeof firebase==='undefined'){
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-app-compat.min.js';
    s.onload=()=>{const s2=document.createElement('script');s2.src='https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-database-compat.min.js';s2.onload=()=>conFb(cfg);document.head.appendChild(s2)};
    document.head.appendChild(s);
  } else conFb(cfg);
  dot.className='dot y';txt.textContent='Connecting...';
}
function conFb(cfg){
  const dot=document.getElementById('syncDot'),txt=document.getElementById('syncTxt');
  try{
    try{firebase.app()}catch(e){firebase.initializeApp({apiKey:cfg.apiKey,databaseURL:cfg.dbUrl,projectId:cfg.projectId,appId:cfg.appId})}
    db=firebase.database();fbRef=db.ref('bizEntries');tbRef=db.ref('bizTrash');
    fbRef.on('value',snap=>{
      const d=snap.val();
      if(d){entries=Object.values(d).sort((a,b)=>new Date(b.date)-new Date(a.date));saveE();}
      dot.className='dot g';txt.textContent='Synced ✓';
      toast('Firebase connected — real-time sync active!','ok');renderDash();
    },err=>{dot.className='dot r';txt.textContent='Error';toast('Firebase error: '+err.message,'er')});
    tbRef.on('value',snap=>{
      const d=snap.val();
      if(d){trash=Object.values(d).sort((a,b)=>new Date(b.deletedAt)-new Date(a.deletedAt));saveT();updateTCnt();}
    });
  }catch(e){dot.className='dot r';txt.textContent='Failed';toast('Error: '+e.message,'er')}
}
function testFb(){
  if(!db){toast('Please save Firebase config first','er');return}
  db.ref('.info/connected').once('value',s=>{if(s.val())toast('Firebase is connected!','ok');else toast('Not connected','er')});
}

/* ===== EXPORT ===== */
function expCSV(){
  const rows=[['Date','Product','Category','Payment','Type','Amount (৳)','Customer','Note']];
  entries.forEach(e=>rows.push([new Date(e.date).toLocaleDateString('en-US'),e.product,e.category,e.payment,e.type,e.amount,e.customer||'',e.note||'']));
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download='business_report.csv';a.click();
  toast('CSV downloaded!','ok');
}
function expJSON(){
  const a=document.createElement('a');a.href='data:application/json,'+encodeURIComponent(JSON.stringify(entries,null,2));a.download='business_backup.json';a.click();
  toast('JSON backup downloaded!','ok');
}
function nukeAll(){
  if(!isAuth){toast('Please login first','er');return}
  if(!confirm('Delete ALL data permanently? This cannot be undone!'))return;
  entries=[];trash=[];saveE();saveT();
  if(db&&fbRef)fbRef.set({});if(db&&tbRef)tbRef.set({});
  updateTCnt();renderDash();toast('All data deleted','inf');
}

/* ===== TOAST ===== */
function toast(m,t='ok'){const x=document.getElementById('toast');x.textContent=m;x.className='toast '+t+' show';setTimeout(()=>x.classList.remove('show'),3200)}

/* Auto-boot if already authenticated */
// Auto-connect with pre-configured Firebase
if(isAuth||isVO){ document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(()=>initFb(FIREBASE_CFG), 500); }); }

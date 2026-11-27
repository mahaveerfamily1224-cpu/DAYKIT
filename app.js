import './style.css';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DB='daykit-v1', STORE='records';
let data={docs:[],expenses:[],tasks:[],warranties:[]}, db;
let saveQueue=Promise.resolve();
const translations={
en:{tag:'Your everyday life, organized.',welcome:'WELCOME BACK',dashboard:'Your dashboard',offline:'Works offline',tasks:'Pending tasks',spend:"This month's spend",docs:'Saved documents',home:'Home',documents:'Documents',expenses:'Expenses',planner:'Planner',warranty:'Warranty',tools:'Tools',backup:'Backup',quick:'Quick actions',adddoc:'Add document',addexpense:'Add expense',addtask:'Add task',addwarranty:'Add warranty',recent:'Recent activity',nothing:'Nothing here yet. Add your first item.',privacy:'Your information stays on this device. Export a backup regularly.',upload:'Add file',docHint:'Files are saved on this device.',saveExpense:'Save expense',addTaskBtn:'Add task',saveWarranty:'Save warranty',currency:'Currency split',calculate:'Calculate',qr:'QR generator',makeQR:'Create QR',unit:'Unit converter',convert:'Convert to miles',backupHint:'Export your DAYKIT records and saved documents to a backup file. Keep it somewhere safe.',export:'Export backup',import:'Restore backup',restoreWarning:'Restoring replaces the current DAYKIT data on this device.'},
ta:{tag:'உங்கள் அன்றாட வாழ்க்கை, ஒரே இடத்தில்.',welcome:'மீண்டும் வரவேற்கிறோம்',dashboard:'உங்கள் முகப்பு',offline:'இணையமின்றி இயங்கும்',tasks:'நிலுவைப் பணிகள்',spend:'இந்த மாதச் செலவு',docs:'சேமித்த ஆவணங்கள்',home:'முகப்பு',documents:'ஆவணங்கள்',expenses:'செலவுகள்',planner:'திட்டமிடல்',warranty:'உத்தரவாதம்',tools:'கருவிகள்',backup:'காப்புப்பிரதி',quick:'விரைவு செயல்கள்',adddoc:'ஆவணம் சேர்க்க',addexpense:'செலவு சேர்க்க',addtask:'பணி சேர்க்க',addwarranty:'உத்தரவாதம் சேர்க்க',recent:'சமீபத்திய செயல்கள்',nothing:'இன்னும் எதுவும் இல்லை. முதல் பதிவைச் சேர்க்கவும்.',privacy:'உங்கள் தகவல்கள் இந்தச் சாதனத்திலேயே இருக்கும். காப்புப்பிரதி எடுக்கவும்.',upload:'கோப்பு சேர்க்க',docHint:'கோப்புகள் இந்தச் சாதனத்தில் சேமிக்கப்படும்.',saveExpense:'செலவைச் சேமி',addTaskBtn:'பணியைச் சேர்',saveWarranty:'சேமி',currency:'செலவு பிரிப்பு',calculate:'கணக்கிடு',qr:'QR உருவாக்கி',makeQR:'QR உருவாக்கு',unit:'அலகு மாற்றி',convert:'மைல்களாக மாற்று',backupHint:'உங்கள் பதிவுகள் மற்றும் ஆவணங்களை காப்புப்பிரதியாக ஏற்றுமதி செய்யவும்.',export:'காப்புப்பிரதி ஏற்றுமதி',import:'காப்புப்பிரதியை மீட்டமை',restoreWarning:'மீட்டமைத்தால் தற்போதைய DAYKIT தகவல்கள் மாற்றப்படும்.'}};
let lang='en';

function openDB(){return new Promise((res,rej)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function save(){
  const snapshot=JSON.parse(JSON.stringify(data));
  saveQueue=saveQueue.catch(()=>{}).then(()=>new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(snapshot,'all');
    tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('Database save aborted'));
  }));
  return saveQueue;
}
function load(){return new Promise((res,rej)=>{let r=db.transaction(STORE).objectStore(STORE).get('all');r.onsuccess=()=>{if(r.result&&typeof r.result==='object')data={...data,...r.result};res()};r.onerror=()=>rej(r.error)})}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(n){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n||0)}
function dateNow(){return new Date().toISOString().slice(0,10)}
function showPage(p){$$('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+p));$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.page===p))}
function list(sel,arr,fn){let el=$(sel);el.className='list'+(arr.length?'':' empty');el.innerHTML=arr.length?arr.map(fn).join(''):'Nothing saved yet.'}
function render(){
  $('#taskCount').textContent=data.tasks.filter(x=>!x.done).length;
  let m=new Date().toISOString().slice(0,7);
  $('#spendCount').textContent=money(data.expenses.filter(x=>x.date?.startsWith(m)).reduce((a,x)=>a+Number(x.amount),0));
  $('#docCount').textContent=data.docs.length;
  list('#docList',data.docs,x=>`<div class="item"><div><b>${esc(x.name)}</b><small>${esc(x.type)} · ${new Date(x.created).toLocaleDateString()}</small></div><button class="delete" data-del="docs" data-id="${esc(x.id)}">Delete</button></div>`);
  list('#expenseList',data.expenses.slice().reverse(),x=>`<div class="item"><div><b>${esc(x.title)} · ${money(x.amount)}</b><small>${esc(x.category)} · ${esc(x.date)}</small></div><button class="delete" data-del="expenses" data-id="${esc(x.id)}">Delete</button></div>`);
  list('#taskList',data.tasks.slice().reverse(),x=>`<div class="item"><div><label><input type="checkbox" data-done="${esc(x.id)}" ${x.done?'checked':''}> <span style="${x.done?'text-decoration:line-through;opacity:.6':''}">${esc(x.title)}</span></label><small>${esc(x.date||'No due date')}</small></div><button class="delete" data-del="tasks" data-id="${esc(x.id)}">Delete</button></div>`);
  list('#warrantyList',data.warranties.slice().reverse(),x=>`<div class="item"><div><b>${esc(x.title)}</b><small>Expiry: ${esc(x.date)} · ${esc(x.notes)}</small></div><button class="delete" data-del="warranties" data-id="${esc(x.id)}">Delete</button></div>`);
  let recent=[...data.expenses.map(x=>({label:'Expense: '+x.title,date:x.date})),...data.tasks.map(x=>({label:'Task: '+x.title,date:x.date})),...data.docs.map(x=>({label:'Document: '+x.name,date:(x.created||'').slice(0,10)}))].slice(-5).reverse();
  $('#recentList').className='list'+(recent.length?'':' empty');
  $('#recentList').innerHTML=recent.length?recent.map(x=>`<div class="item"><div>${esc(x.label)}<small>${esc(x.date||'')}</small></div></div>`).join(''):translations[lang].nothing;
}
function add(arr,obj){data[arr].push({id:id(),...obj});save().then(render).catch(e=>alert('Could not save record: '+e.message))}
function setBackupStatus(message){const el=$('#backupStatus');if(el)el.textContent=message}

$('#tabs').addEventListener('click',e=>{let b=e.target.closest('[data-page]');if(b)showPage(b.dataset.page)});
$$('[data-go]').forEach(b=>b.onclick=()=>showPage(b.dataset.go));
$('#expenseDate').value=dateNow();$('#taskDate').value=dateNow();$('#warrantyDate').value=dateNow();
$('#today').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
$('#expenseForm').onsubmit=e=>{e.preventDefault();add('expenses',{title:$('#expenseTitle').value,amount:Number($('#expenseAmount').value),category:$('#expenseCategory').value,date:$('#expenseDate').value});e.target.reset();$('#expenseDate').value=dateNow()};
$('#taskForm').onsubmit=e=>{e.preventDefault();add('tasks',{title:$('#taskTitle').value,date:$('#taskDate').value,done:false});e.target.reset();$('#taskDate').value=dateNow()};
$('#warrantyForm').onsubmit=e=>{e.preventDefault();add('warranties',{title:$('#warrantyTitle').value,date:$('#warrantyDate').value,notes:$('#warrantyNotes').value});e.target.reset();$('#warrantyDate').value=dateNow()};
$('#docFile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  if(f.size>15*1024*1024){alert('Please choose a file smaller than 15 MB.');e.target.value='';return}
  try{const dataUrl=await new Promise((r,j)=>{let fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>j(fr.error);fr.readAsDataURL(f)});add('docs',{name:f.name,type:f.type||'File',created:new Date().toISOString(),data:dataUrl})}
  catch(err){alert('Could not read this file: '+err.message)}
  e.target.value='';
};
document.addEventListener('click',e=>{let b=e.target.closest('[data-del]');if(b&&confirm('Delete this item?')){data[b.dataset.del]=data[b.dataset.del].filter(x=>x.id!==b.dataset.id);save().then(render).catch(err=>alert('Delete failed: '+err.message))}});
document.addEventListener('change',e=>{if(e.target.dataset.done){let x=data.tasks.find(x=>x.id===e.target.dataset.done);if(x)x.done=e.target.checked;save().then(render).catch(err=>alert('Update failed: '+err.message))}});
$('#splitBtn').onclick=()=>{let a=Number($('#bill').value),p=Number($('#people').value);$('#splitResult').textContent=a>0&&p>0?'Each person pays '+money(a/p):'Enter a valid bill and number of people.'};
$('#unitBtn').onclick=()=>$('#unitResult').textContent=Number($('#km').value)>=0?(Number($('#km').value)*.621371).toFixed(2)+' miles':'Enter kilometres';
$('#qrBtn').onclick=()=>{let t=$('#qrText').value.trim();if(!t)return;$('#qrResult').textContent='Offline QR generation will be added in a later release.'};

function validateBackup(obj){
  if(!obj||obj.app!=='DAYKIT'||!obj.data||typeof obj.data!=='object')throw new Error('This is not a valid DAYKIT backup.');
  for(const key of ['docs','expenses','tasks','warranties'])if(!Array.isArray(obj.data[key]))throw new Error('Backup is missing '+key+'.');
  for(const doc of obj.data.docs)if(!doc||typeof doc!=='object'||typeof doc.name!=='string')throw new Error('Backup contains an invalid document record.');
  return {docs:obj.data.docs,expenses:obj.data.expenses,tasks:obj.data.tasks,warranties:obj.data.warranties};
}
$('#exportBtn').onclick=async()=>{
  const btn=$('#exportBtn');btn.disabled=true;setBackupStatus('Preparing backup…');
  try{
    await save(); // wait for all queued writes to finish before exporting
    const payload={app:'DAYKIT',version:1,exported:new Date().toISOString(),data:JSON.parse(JSON.stringify(data))};
    const json=JSON.stringify(payload,null,2);
    const filename='DAYKIT-backup-'+dateNow()+'.json';
    if(Capacitor.isNativePlatform()){
      const written=await Filesystem.writeFile({path:filename,data:json,directory:Directory.Cache,encoding:'utf8'});
      await Share.share({title:'DAYKIT backup',text:'DAYKIT backup file',files:[written.uri],dialogTitle:'Save or share your DAYKIT backup'});
      setBackupStatus('Backup file prepared. Choose a destination in the sharing panel.');
    }else{
      const blob=new Blob([json],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      setBackupStatus('Backup download started.');
    }
  }catch(err){
    console.error('DAYKIT export failed',err);
    setBackupStatus('Backup failed: '+(err.message||'Unknown error'));
    alert('Could not export backup. '+(err.message||'Please try again.'));
  }finally{btn.disabled=false}
};
$('#importFile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const obj=JSON.parse(await f.text());
    const restored=validateBackup(obj);
    if(!confirm('Replace current DAYKIT data with this backup?'))return;
    const previous=data;
    data=restored;
    try{await save();render();alert('Backup restored successfully.')}
    catch(err){data=previous;throw err}
  }catch(err){alert('Restore failed: '+(err.message||'Invalid backup file.'))}
  finally{e.target.value=''}
};
$('#themeBtn').onclick=()=>{let d=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=d?'dark':'light';localStorage.setItem('daykit-theme',d?'dark':'light');$('#themeBtn').textContent=d?'☀':'☾'};
if(localStorage.getItem('daykit-theme')==='dark'){document.documentElement.dataset.theme='dark';$('#themeBtn').textContent='☀'}
$('#langBtn').onclick=()=>{lang=lang==='en'?'ta':'en';document.documentElement.lang=lang;$$('[data-i18n]').forEach(el=>{let k=el.dataset.i18n;if(translations[lang][k])el.textContent=translations[lang][k]});$('#langBtn').textContent=lang==='en'?'தமிழ்':'English';render()};

(async()=>{
  try{db=await openDB();await load();render()}
  catch(e){console.error(e);alert('Local database is unavailable. Please check device storage permissions and try again.')}
})();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker registration failed',err)));

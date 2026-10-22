/* Filo · task manager without login, deployable on GitHub Pages.
   With Supabase enabled, this is a PUBLIC shared board: never use for sensitive data.
   Local mode is provided for evaluation and backwards compatibility with Piano.
*/
const $ = (id) => document.getElementById(id);
const GLYPHS = {
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  clip: '<path d="m21 11.5-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"/>',
  checklist: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1.4 1.4L12 8m2 2h3M8 16h9"/>',
  edit: '<path d="m16 5 3 3M4 20l4-.5L20 7a2.1 2.1 0 0 0-3-3L4.5 16.5Z"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93L11.3 4.6M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.7-1.67"/>',
  trash: '<path d="M4 7h16M10 3h4m-8 4 1 14h10l1-14M10 11v6m4-6v6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>'
};
const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name] || GLYPHS.check}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function todayISO() { return localISO(new Date()); }
function localISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fromISO(s) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const [y,m,d] = s.split('-').map(Number);
  const result = new Date(y,m-1,d,12);
  return localISO(result) === s ? result : null;
}
function plusDays(iso, days) {
  const date = fromISO(iso); if(!date) return iso;
  date.setDate(date.getDate() + Math.max(0,Number(days)||0));
  return localISO(date);
}
// Business days are Monday to Friday; public holidays vary by region and can be set from the calendar.
function plusWorkingDays(iso, days) {
  const date=fromISO(iso);
  if(!date)return iso;
  let remaining=Math.max(0,Math.floor(Number(days)||0));
  while(remaining>0){
    date.setDate(date.getDate()+1);
    if(date.getDay()!==0 && date.getDay()!==6)remaining--;
  }
  return localISO(date);
}
function deltaDays(iso) {
  if(!fromISO(iso)) return null;
  const a = iso.split('-').map(Number), b = todayISO().split('-').map(Number);
  return Math.round((Date.UTC(a[0],a[1]-1,a[2]) - Date.UTC(b[0],b[1]-1,b[2])) / 86400000);
}
const absoluteDate = s => fromISO(s)?.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}) || 'Senza scadenza';
function shortDate(s) {
  const date=fromISO(s);
  if(!date)return '—';
  const days=deltaDays(s);
  if(days===-1)return 'Ieri';
  if(days===0)return 'Oggi';
  if(days===1)return 'Domani';
  // "Prossimo lunedì" significa sempre la settimana CALENDARIA successiva, non i prossimi sette giorni.
  const nextMonday=fromISO(todayISO());
  nextMonday.setDate(nextMonday.getDate()-((nextMonday.getDay()+6)%7)+7);
  const first=localISO(nextMonday);
  nextMonday.setDate(nextMonday.getDate()+6);
  const last=localISO(nextMonday);
  if(s>=first && s<=last) {
    const weekday=date.toLocaleDateString('it-IT',{weekday:'long'});
    return `${date.getDay()===0?'Prossima':'Prossimo'} ${weekday}`;
  }
  return date.toLocaleDateString('it-IT',{day:'numeric',month:'short'});
}
function dueState(t) {
  if(t.status==='done')return 'completed';
  if(!t.due_date)return 'none';
  const d=deltaDays(t.due_date);
  return d<0?'overdue':d===0?'today':'future';
}
function cleanTask(raw={}) {
  return {
    id: raw.id || uuid(),
    title: String(raw.title || 'Senza titolo'),
    description: String(raw.description || ''),
    due_date: fromISO(raw.due_date) ? raw.due_date : null,
    project: String(raw.project || ''),
    status: ['todo','doing','done'].includes(raw.status) ? raw.status : 'todo',
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    subtasks: Array.isArray(raw.subtasks) ? raw.subtasks : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    created_at: raw.created_at || now(),
    updated_at: raw.updated_at || now()
  };
}

// Preserve locally saved tasks and file Blobs from the previous Piano prototype.
const LOCAL_TASKS_KEY = 'filo:voice-lab:tasks:v1';
const LOCAL_DB_NAME = 'filo:voice-lab:files';
let tasks = [];
let supa = null;
let cloud = false;
let working = false;
let openMenuId = null;
let calendarTaskId = null;
let calendarMonth = null;
let expandedIds = new Set();
let inlineEditor = null; // Un'unica riga modificabile alla volta; i nuovi draft non sono ancora sul cloud.
let editingSubtask = null; // {taskId, subId, title}: editing in place, never delete via pencil.
const deletingIds = new Set();
let toastTimer = null;
let undoCallback = null;
let writeQueue = Promise.resolve();
let pendingWrites = 0;
let refreshInProgress = false;
let cloudReady = false;
let cloudError = null;
let connecting = false;

const byDueDate = (a,b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31') || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
function localRead() {
  try {
    const saved=JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || '[]');
    return Array.isArray(saved) ? saved.map(cleanTask) : [];
  } catch(e) { showToast('Impossibile leggere le attività locali: '+e.message); return []; }
}
function localWrite() { localStorage.setItem(LOCAL_TASKS_KEY,JSON.stringify(tasks)); }
function storageLabel(label) { $('storageStatus').textContent=label; }
function toastDismiss() { $('toast').classList.add('hidden'); undoCallback=null; clearTimeout(toastTimer); }
function showToast(message,undo=null) {
  const el=$('toast'); undoCallback=undo;
  el.innerHTML=`<span>${esc(message)}</span>${undo?'<button type="button" id="undoToast">Annulla</button>':''}`;
  el.classList.remove('hidden'); clearTimeout(toastTimer);
  toastTimer=setTimeout(toastDismiss,8500);
}
async function loadCloud() {
  if(!supa) throw new Error('Il collegamento a Supabase non è inizializzato.');
  if(pendingWrites) await writeQueue;
  const {data,error}=await supa.from('filo_tasks').select('*').limit(5000);
  if(error)throw error;
  // Never replace the existing list after a failed request.
  tasks=(data || []).map(cleanTask);
  if(editingSubtask && !tasks.some(t=>t.id===editingSubtask.taskId && t.subtasks.some(s=>s.id===editingSubtask.subId && !s.done)))editingSubtask=null;
  cloudReady=true;
  cloudError=null;
  render();
  storageLabel('Online · modifiche salvate automaticamente');
}
function reportCloudError(error) {
  console.error('Filo: errore caricamento cloud',error);
  cloudError=String(error?.message || error || 'Errore di connessione');
  cloudReady=false;
  storageLabel('Errore connessione Supabase · nessuna attività eliminata');
  render();
}
function cloudErrorCard() {
  return `<div class="cloud-error" role="alert"><strong>Non riesco a caricare le attività da Supabase.</strong>
    <p>I dati non sono stati eliminati: la lista è temporaneamente non disponibile.</p>
    <details><summary>Dettagli tecnici</summary><code>${esc(cloudError || 'Connessione non disponibile')}</code></details>
    <button type="button" data-action="retry-cloud">Riprova connessione</button></div>`;
}
async function connectCloud() {
  if(connecting)return;
  connecting=true;
  storageLabel('Connessione al cloud…');
  try {
    if(!supa) {
      let module;
      try {module=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');}
      catch(firstError) {
        console.warn('Filo: CDN principale non disponibile, provo alternativa',firstError);
        module=await import('https://esm.sh/@supabase/supabase-js@2');
      }
      const {createClient}=module;
      const c=window.FILO_CONFIG || {};
      supa=createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    }
    await loadCloud();
    handleHash();
  } catch(error) {reportCloudError(error);}
  finally {connecting=false;}
}
async function refresh(showMessage=false) {
  if(refreshInProgress || pendingWrites) return;
  refreshInProgress=true;
  try {
    if(cloud) await loadCloud(); else {tasks=localRead();render();}
    if(showMessage) showToast('Attività aggiornate.');
  } catch(e) {
    if(cloud) {
      console.error('Filo: errore aggiornamento',e);
      storageLabel('Connessione instabile · aggiornamento non riuscito');
      if(!cloudReady)reportCloudError(e);
    }
    if(showMessage) showToast('Impossibile aggiornare: '+e.message);
  } finally {refreshInProgress=false;}
}
async function queueOperation(op) {
  pendingWrites++;
  if(cloud)storageLabel('Salvataggio online in corso…');
  const start=writeQueue.catch(()=>{}).then(op);
  writeQueue=start.catch(()=>{});
  try {return await start;}
  finally {
    pendingWrites--;
    if(cloud && pendingWrites===0 && cloudReady)storageLabel('Online · modifiche salvate automaticamente');
  }
}
async function saveTask(value) {
  const item=cleanTask({...value,updated_at:now()});
  const previous=tasks.find(t=>t.id===item.id) || null;
  const index=tasks.findIndex(t=>t.id===item.id);
  if(index===-1)tasks.unshift(item); else tasks[index]=item;
  render();
  try {
    await queueOperation(async()=>{
      if(cloud){const {error}=await supa.from('filo_tasks').upsert(item,{onConflict:'id'});if(error)throw error;}
      else localWrite();
    });
    return true;
  } catch(e) {
    // Roll back only if this version has not already been replaced by a newer edit.
    const current=tasks.find(t=>t.id===item.id);
    if(current?.updated_at===item.updated_at){
      tasks=tasks.filter(t=>t.id!==item.id);
      if(previous)tasks.push(previous);
      render();
    }
    if(cloud)storageLabel('Errore di salvataggio online');
    showToast('Salvataggio non riuscito: '+e.message);
    return false;
  }
}
async function deleteTask(taskId, fromCompletion=false) {
  const item=tasks.find(t=>t.id===taskId);if(!item||deletingIds.has(taskId))return;
  if(!fromCompletion && !confirm(`Eliminare definitivamente "${item.title}" e i suoi allegati?`))return;
  deletingIds.add(taskId);
  try {
    await queueOperation(async()=>{
      if(cloud){const {error}=await supa.from('filo_tasks').delete().eq('id',item.id);if(error)throw error;}
      else {tasks=tasks.filter(t=>t.id!==item.id);localWrite();}
    });
    tasks=tasks.filter(t=>t.id!==item.id);
    expandedIds.delete(taskId);openMenuId=null;if(calendarTaskId===taskId)calendarTaskId=null;
    if(editingSubtask?.taskId===taskId)editingSubtask=null;
    render();
    for(const a of item.attachments){try{await removeBlob(a);}catch(e){console.warn('Pulizia allegato:',e);}}
    showToast(fromCompletion?'Attività completata e rimossa definitivamente.':'Attività eliminata.');
  }catch(e){storageLabel('Errore durante l’eliminazione');showToast('Eliminazione non riuscita: '+e.message);}
  finally {deletingIds.delete(taskId);}
}
async function changeDone(taskId) {
  // Su richiesta, il segno di spunta completa E cancella il record (inclusi gli allegati).
  // Nessuna sezione "completate"; non è reversibile dopo la cancellazione.
  await deleteTask(taskId,true);
}
async function postpone(taskId,days) {
  const t=tasks.find(t=>t.id===taskId);
  if(!t||t.status==='done'||!Number.isInteger(days)||days<1||days>7)return;
  const before=t.due_date;
  const start=(!before||before<todayISO())?todayISO():before;
  const after=plusWorkingDays(start,days);
  if(await saveTask({...t,due_date:after})) {
    showToast(`Scadenza spostata al ${absoluteDate(after)} (+${days} ${days===1?'giorno lavorativo':'giorni lavorativi'}).`,async()=>{
      const current=tasks.find(v=>v.id===taskId);
      if(current?.due_date===after){await saveTask({...current,due_date:before});showToast('Rinvio annullato.');}
    });
  }
}

function shiftCalendarMonth(ym, offset) {
  const [year, month]=ym.split('-').map(Number);
  const date=new Date(year,month-1+offset,1,12);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function calendarPopover(t) {
  const base=calendarMonth || (t.due_date||todayISO()).slice(0,7);
  const [year, month]=base.split('-').map(Number);
  const first=new Date(year,month-1,1,12);
  const offset=(first.getDay()+6)%7;
  const count=new Date(year,month,0,12).getDate();
  const cells=Math.ceil((offset+count)/7)*7;
  const monthName=first.toLocaleDateString('it-IT',{month:'long',year:'numeric'});
  const weekdays=['L','M','M','G','V','S','D'].map((v,i)=>`<span title="${['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][i]}">${v}</span>`).join('');
  let days='';
  for(let i=0;i<cells;i++){
    const date=new Date(year,month-1,i-offset+1,12);
    const iso=localISO(date),outside=date.getMonth()!==month-1;
    const selected=iso===t.due_date, today=iso===todayISO();
    const text=date.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    days+=`<button type="button" class="calendar-day${outside?' outside':''}${selected?' selected':''}${today?' is-today':''}" data-action="cal-day" data-id="${t.id}" data-date="${iso}" aria-label="Imposta scadenza: ${esc(text)}" aria-pressed="${selected}" title="${esc(text)}">${date.getDate()}</button>`;
  }
  return `<div class="calendar-popover" role="dialog" aria-label="Cambia la scadenza di ${esc(t.title)}">
    <div class="calendar-head">
      <button type="button" data-action="cal-prev" data-id="${t.id}" class="calendar-nav" aria-label="Mese precedente">${ico('prev')}</button>
      <strong>${esc(monthName)}</strong>
      <button type="button" data-action="cal-next" data-id="${t.id}" class="calendar-nav" aria-label="Mese successivo">${ico('next')}</button>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">${weekdays}</div>
    <div class="calendar-days">${days}</div>
    <div class="calendar-footer"><button type="button" data-action="cal-today" data-id="${t.id}">Vai a oggi</button><button type="button" data-action="cal-close" data-id="${t.id}">Chiudi</button></div>
  </div>`;
}

function render() {
  if(cloud && !cloudReady) {
    $('tasks').innerHTML=cloudError ? cloudErrorCard() : '<div class="loading-state" role="status">Caricamento attività…</div>';
    return;
  }
  const open=tasks.filter(t=>t.status!=='done').sort(byDueDate);
  const draft=inlineEditor?.isNew?inlineTaskRow(inlineEditor):'';
  const empty=`<div class="empty-state"><h2>Una cosa alla volta.</h2><p>Nessuna attività. Premi il pulsante + in alto per iniziare.</p></div>`;
  $('tasks').innerHTML=draft+(open.length?open.map(taskCard).join(''):draft?'':empty);
}
function taskCard(t) {
  if(inlineEditor?.id===t.id)return inlineTaskRow(inlineEditor);
  const state=dueState(t),active=expandedIds.has(t.id),menu=openMenuId===t.id;
  const due=t.due_date?shortDate(t.due_date):'Senza data';
  const full=t.due_date?absoluteDate(t.due_date):'Nessuna scadenza impostata';
  const subcount=t.subtasks.filter(s=>!s.done).length,attcount=t.attachments.length;
  const attachmentCount=attcount?`<span class="count-unit" title="${attcount} allegati">${ico('clip')}<strong>${attcount}</strong></span>`:'';
  const dateOpen=calendarTaskId===t.id;
  const calendar=`<div class="date-control"><button type="button" class="due-date ${state}" data-action="date-open" data-id="${t.id}" aria-haspopup="dialog" aria-expanded="${dateOpen}" aria-label="Cambia scadenza: ${esc(full)}" title="Clicca per cambiare la scadenza">${esc(due)}</button>${dateOpen?calendarPopover(t):''}</div>`;
  const segments=Array.from({length:7},()=>'<i class="delay-segment"></i>').join('');
  const delay=`<div class="delay-control" data-task-id="${t.id}">
    <button type="button" class="delay-trigger" title="Aggiungi da 1 a 7 giorni lavorativi" aria-label="Posticipa ${esc(t.title)}" data-action="slider-toggle" data-id="${t.id}">+0g</button>
    <div class="delay-panel" role="group" aria-label="Rinvio in giorni lavorativi">
      <div class="delay-panel-top"><span>Giorni lavorativi</span><strong class="delay-count" data-count="${t.id}">+0</strong></div>
      <div class="delay-scale">
        <div class="delay-segments" aria-hidden="true">${segments}</div>
        <input class="delay-range" type="range" min="0" max="7" step="1" value="0" data-id="${t.id}" aria-label="Giorni lavorativi da aggiungere, da zero a sette" aria-valuetext="Nessun rinvio">
      </div>
      <div class="delay-ends"><span>0</span><span>7</span></div>
      <div class="delay-preview" data-preview="${t.id}"></div>
    </div></div>`;
  return `<article class="task-card ${state}${dateOpen?' has-calendar':''}" id="task-${t.id}" data-task-id="${t.id}">
    <div class="task-row">
      <button type="button" class="check-button" data-action="done" data-id="${t.id}" aria-label="Completa ed elimina: ${esc(t.title)}" title="Completa e rimuovi definitivamente">${ico('check')}</button>
      <div class="task-heading"><button type="button" class="title-button" data-action="toggle" data-id="${t.id}">${esc(t.title)}</button></div>
      ${calendar}
      ${delay}
      <div class="task-count">${attachmentCount}</div>
      <div class="menu-control"><button class="round-action" type="button" data-action="menu" data-id="${t.id}" aria-label="Altre opzioni per ${esc(t.title)}" aria-haspopup="menu" aria-expanded="${menu}">${ico('dots')}</button>${menu?moreMenu(t):''}</div>
      <button type="button" class="expand-action" data-action="toggle" data-id="${t.id}" aria-label="${active?'Chiudi':'Apri'} sotto-attività e allegati di ${esc(t.title)}" aria-expanded="${active}">${subcount?`<span class="subtask-number">${subcount}</span>`:''}${ico('chevron')}</button>
    </div>
    ${active?expandedContent(t):''}
  </article>`;
}
function inlineTaskRow(editor) {
  const id=esc(editor.id);
  return `<article class="task-card inline-task-card" id="task-${id}">
    <form class="inline-task-form" data-form="inline" data-id="${id}">
      <span class="inline-circle" aria-hidden="true"></span>
      <label class="visually-hidden" for="inline-title-${id}">Titolo dell'attività</label>
      <input id="inline-title-${id}" class="inline-title" type="text" name="title" required maxlength="180" autocomplete="off" placeholder="Scrivi il titolo..." value="${esc(editor.title)}">
      <label class="visually-hidden" for="inline-date-${id}">Data di scadenza</label>
      <input id="inline-date-${id}" class="inline-date" type="date" name="due_date" value="${esc(editor.due_date)}" aria-label="Data di scadenza; se vuota viene usata la data di oggi" title="Se lasci vuota la scadenza, verrà impostata a oggi">
      <div class="inline-actions">
        <button type="submit" class="inline-save" title="Salva attività" aria-label="Salva attività">${ico('check')}</button>
        <button type="button" class="inline-cancel" data-action="cancel-inline" data-id="${id}" title="Annulla" aria-label="Annulla modifica">×</button>
      </div>
    </form>
  </article>`;
}
function moreMenu(t) {
  return `<div class="more-menu" role="menu" aria-label="Opzioni attività">
    <button type="button" role="menuitem" data-action="edit" data-id="${t.id}">${ico('edit')}Modifica</button>
    <button type="button" role="menuitem" data-action="duplicate" data-id="${t.id}">${ico('duplicate')}Duplica</button>
    <button type="button" role="menuitem" data-action="copy" data-id="${t.id}">${ico('link')}Copia link</button>
    <button type="button" role="menuitem" data-action="attach" data-id="${t.id}">${ico('clip')}Aggiungi allegato</button>
    <button type="button" role="menuitem" class="danger" data-action="delete" data-id="${t.id}">${ico('trash')}Elimina</button>
  </div>`;
}
function expandedContent(t) {
  const subtasks=t.subtasks.filter(s=>!s.done).map(s=>{
    const isEditing=editingSubtask?.taskId===t.id && editingSubtask.subId===s.id;
    if(isEditing)return `<div class="subtask-item editing">
      <form class="subtask-edit-form" data-form="edit-sub" data-id="${t.id}" data-sub-id="${esc(s.id)}">
        <input class="subtask-edit-input" type="text" name="title" maxlength="180" required autocomplete="off" value="${esc(editingSubtask.title)}" aria-label="Modifica sotto-attività">
        <button type="submit" class="subtask-edit-save" title="Salva sotto-attività" aria-label="Salva sotto-attività">${ico('check')}</button>
        <button type="button" class="subtask-edit-cancel" data-action="cancel-sub-edit" data-id="${t.id}" title="Annulla modifica" aria-label="Annulla modifica">×</button>
      </form>
    </div>`;
    return `<div class="subtask-item">
      <input class="subtask-check" type="checkbox" data-action="subtoggle" data-id="${t.id}" data-sub-id="${esc(s.id)}" aria-label="Completa e rimuovi: ${esc(s.title)}">
      <span class="subtask-label">${esc(s.title)}</span>
      <button type="button" class="subtask-edit-trigger" data-action="edit-sub" data-id="${t.id}" data-sub-id="${esc(s.id)}" title="Modifica sotto-attività" aria-label="Modifica sotto-attività: ${esc(s.title)}">${ico('edit')}</button>
    </div>`;
  }).join('');
  const files=t.attachments.map(a=>`<div class="file-pill" title="${esc(a.name)} · ${formatBytes(a.size||0)}">
    <button type="button" data-action="download" data-id="${t.id}" data-file-id="${esc(a.id)}" title="Scarica allegato ${esc(a.name)}" aria-label="Scarica ${esc(a.name)}">${ico('clip')}</button>
    <span class="file-name">${esc(a.name)}</span>
    <button type="button" class="light-delete" data-action="del-file" data-id="${t.id}" data-file-id="${esc(a.id)}" title="Rimuovi allegato" aria-label="Rimuovi ${esc(a.name)}">${ico('trash')}</button>
  </div>`).join('');
  return `<div class="task-expanded">
    <div class="detail-column subtask-column">
      <section class="detail-section">
        <div class="subtask-list">${subtasks}</div>
        <form class="add-inline" data-form="sub" data-id="${t.id}"><input name="title" maxlength="180" placeholder="Nuova sotto-attività…" required aria-label="Titolo della nuova sotto-attività"><button type="submit">+ Aggiungi</button></form>
      </section>
    </div>
    <div class="detail-column attachments-column">
      <section class="detail-section">
        <div class="detail-head attachments-head"><span>Allegati <small>${t.attachments.length||''}</small></span>
        <label class="attach-select" title="Aggiungi allegati" aria-label="Aggiungi allegati">${ico('plus')}<input type="file" multiple data-upload="${t.id}" id="upload-${t.id}" aria-label="Carica allegati"></label></div>
        <div class="attachment-list">${files}</div>
      </section>
    </div>
  </div>`;
}
function formatBytes(bytes) {return bytes<1024?`${bytes} B`:bytes<1024**2?`${(bytes/1024).toFixed(0)} KB`:`${(bytes/(1024**2)).toFixed(1)} MB`;}

function openInline(taskId=null) {
  if(editingSubtask){
    document.querySelector('.subtask-edit-input')?.focus();
    showToast('Prima salva o annulla la modifica della sotto-attività.');
    return;
  }
  if(cloud && !cloudReady) {
    showToast('La connessione online non è disponibile. Riprova prima di creare attività.');
    return;
  }
  if(inlineEditor) {
    // Impedisce di perdere input ancora non salvati quando si preme di nuovo "+".
    document.getElementById(`inline-title-${inlineEditor.id}`)?.focus();
    showToast('Prima salva o annulla la riga che stai modificando.');
    return;
  }
  const t=tasks.find(v=>v.id===taskId);
  if(taskId&&!t)return;
  inlineEditor={id:t?.id||uuid(),isNew:!t,title:t?.title||'',due_date:t?.due_date||''};
  openMenuId=null;calendarTaskId=null;
  render();
  requestAnimationFrame(()=>{
    const field=document.getElementById(`inline-title-${inlineEditor?.id}`);
    field?.focus();
    if(t)field?.select();
  });
}
function cancelInline() {inlineEditor=null;render();}
function openSubtaskEdit(taskId, subId) {
  if(inlineEditor){showToast('Prima salva o annulla la riga dell’attività.');return;}
  if(editingSubtask){
    document.querySelector('.subtask-edit-input')?.focus();
    showToast('Prima salva o annulla la modifica della sotto-attività.');
    return;
  }
  const s=tasks.find(t=>t.id===taskId)?.subtasks.find(s=>s.id===subId && !s.done);
  if(!s)return;
  editingSubtask={taskId,subId,title:s.title};
  render();
  requestAnimationFrame(()=>{const field=document.querySelector('.subtask-edit-input');field?.focus();field?.select();});
}
function cancelSubtaskEdit(){editingSubtask=null;render();}
async function submitInlineForm(e) {
  e.preventDefault();
  const form=e.currentTarget,editor=inlineEditor;
  if(!editor||editor.id!==form.dataset.id)return;
  const fields=new FormData(form);
  const title=String(fields.get('title')||'').trim();
  const due_date=String(fields.get('due_date')||'').trim() || todayISO();
  if(!title){form.elements.title.focus();return;}
  if(!fromISO(due_date)){form.elements.due_date.focus();showToast('La data di scadenza non è valida.');return;}
  const old=tasks.find(t=>t.id===editor.id);
  if(!editor.isNew&&!old){showToast('Questa attività non è più disponibile.');cancelInline();return;}
  const item=cleanTask({...old,id:editor.id,title,due_date});
  inlineEditor=null;
  const ok=await saveTask(item); // upsert nel cloud come avveniva nel vecchio modulo.
  if(ok)showToast(old?'Attività modificata.':'Attività creata.');
  else {inlineEditor={...editor,title,due_date};render();}
}

async function duplicateTask(taskId) {
  const t=tasks.find(t=>t.id===taskId);if(!t)return;
  const copy=cleanTask({...t,id:uuid(),title:`${t.title} (copia)`,status:'todo',
    subtasks:t.subtasks.map(s=>({...s,id:uuid()})),
    notes:[], // Non riprodurre note storiche non più visibili nell'interfaccia.
    attachments:[],created_at:now()});
  if(await saveTask(copy)){expandedIds.add(copy.id);openMenuId=null;render();showToast('Attività duplicata senza allegati.');}
}
async function copyTaskLink(taskId) {
  const url=location.href.split('#')[0]+`#task=${taskId}`;
  try{await navigator.clipboard.writeText(url);showToast('Link all’attività copiato.');}
  catch(e){prompt('Copia il link:',url);}
}
function handleHash() {
  const match=location.hash.match(/^#task=([a-f0-9-]{36})$/i);
  if(match && tasks.some(t=>t.id===match[1])){
    const t=tasks.find(t=>t.id===match[1]);
    if(t?.status==='done')return; // Le completate storiche restano solo nei backup/database.
    expandedIds.add(match[1]);render();
    setTimeout(()=>document.getElementById(`task-${match[1]}`)?.scrollIntoView({block:'center',behavior:'smooth'}),80);
  }
}

// Blobs use IndexedDB in local mode; Supabase Storage when cloud is configured.
let dbPromise=null;
function localDB() {
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(LOCAL_DB_NAME,1);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains('files'))req.result.createObjectStore('files',{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function putBlobLocal(fileId,blob) {
  const db=await localDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id:fileId,blob});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function getBlobLocal(fileId) {
  const db=await localDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readonly'),req=tx.objectStore('files').get(fileId);
    req.onsuccess=()=>resolve(req.result?.blob||null);req.onerror=()=>reject(req.error);
  });
}
async function removeBlobLocal(fileId) {
  const db=await localDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(fileId);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
const MAX_SIZE=20*1024*1024;
const safeName=(s)=>String(s).replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'file';
async function storeBlob(task,blob,name) {
  if(blob.size>MAX_SIZE)throw new Error('Dimensione massima di ogni allegato: 20 MB.');
  const blobId=uuid();let path=null;
  if(cloud) {
    path=`${task.id}/${blobId}-${safeName(name)}`;
    const {error}=await supa.storage.from('filo-files').upload(path,blob,{contentType:blob.type||'application/octet-stream',upsert:false});
    if(error)throw error;
  }else await putBlobLocal(blobId,blob);
  return {id:blobId,name,size:blob.size,type:blob.type||'application/octet-stream',path,created_at:now()};
}
async function loadBlob(meta) {
  if(cloud) {
    if(!meta.path)throw new Error('Allegato locale non disponibile sul cloud. Reimporta un backup con il file.');
    const {data,error}=await supa.storage.from('filo-files').download(meta.path);
    if(error)throw error;
    return data;
  }
  const blob=await getBlobLocal(meta.id);
  if(!blob)throw new Error('File non trovato in questo browser. Importa un backup per recuperarlo.');
  return blob;
}
async function removeBlob(meta) {
  if(cloud) {
    if(!meta.path)return;
    const {error}=await supa.storage.from('filo-files').remove([meta.path]);
    if(error)throw error;
  } else await removeBlobLocal(meta.id);
}
async function uploadFiles(taskId, files) {
  if(working)return;
  working=true;let count=0;
  try{
    for(const file of files) {
      const task=tasks.find(t=>t.id===taskId);if(!task)break;
      showToast(`Caricamento di ${file.name}...`);
      const meta=await storeBlob(task,file,file.name);
      const ok=await saveTask({...task,attachments:[...task.attachments,meta]});
      if(!ok){await removeBlob(meta).catch(console.warn);break;}
      count++;
    }
    if(count)showToast(`${count} allegat${count===1?'o aggiunto':'i aggiunti'}.`);
  }catch(e){showToast('Errore allegato: '+e.message);}
  finally{working=false;}
}
async function downloadFile(taskId,fileId) {
  const a=tasks.find(t=>t.id===taskId)?.attachments.find(a=>a.id===fileId);
  if(!a)return;
  try {
    const blob=await loadBlob(a);const url=URL.createObjectURL(blob);const el=document.createElement('a');
    el.href=url;el.download=a.name;document.body.appendChild(el);el.click();el.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){showToast('Download non riuscito: '+e.message);}
}
async function deleteFile(taskId,fileId) {
  const t=tasks.find(t=>t.id===taskId),a=t?.attachments.find(a=>a.id===fileId);
  if(!a||!confirm(`Eliminare l’allegato "${a.name}"?`))return;
  const ok=await saveTask({...t,attachments:t.attachments.filter(v=>v.id!==fileId)});
  if(ok){try{await removeBlob(a);}catch(e){showToast('Allegato tolto dalla lista, ma il file non è stato rimosso dallo storage: '+e.message);}}
}
const blobToDataUrl=(blob)=>new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
});
function dataUrlToBlob(data) {
  if(typeof data!=='string'||!/^data:[^,]*;base64,[A-Za-z0-9+/=\s]+$/.test(data))throw new Error('Formato allegato nel backup non valido.');
  const [head,body]=data.split(',',2);
  const mime=(head.match(/^data:([^;]*)/)||[])[1]||'application/octet-stream';
  const bytes=atob(body.replace(/\s/g,''));const buffer=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++)buffer[i]=bytes.charCodeAt(i);
  return new Blob([buffer],{type:mime});
}
async function exportBackup() {
  if(working)return;working=true;
  try{
    showToast('Preparazione backup (incluse copie degli allegati)...');
    const files={};
    for(const t of tasks)for(const a of t.attachments){
      try{files[a.id]=await blobToDataUrl(await loadBlob(a));}
      catch(e){if(!confirm(`Non riesco a leggere "${a.name}". Procedere senza questo file?`))throw e;}
    }
    const backup={app:'filo',version:2,exported_at:now(),tasks,files};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`filo-backup-${todayISO()}.json`;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    showToast('Backup esportato. Conserva il file in un posto sicuro.');
  }catch(e){showToast('Backup non riuscito: '+e.message);}
  finally{working=false;}
}
async function importBackup(file) {
  if(working)return;working=true;let count=0;
  try{
    if(file.size>200*1024*1024)throw new Error('Backup troppo grande (massimo 200 MB).');
    const backup=JSON.parse(await file.text());
    if(!(['piano','filo'].includes(backup.app))||![1,2].includes(backup.version)||!Array.isArray(backup.tasks))throw new Error('Formato di backup non riconosciuto.');
    if(backup.tasks.length>5000)throw new Error('Troppi elementi nel backup.');
    if(!confirm(`Importare ${backup.tasks.length} attività? Saranno aggiunte, senza sostituire quelle esistenti.`))return;
    for(const original of backup.tasks){
      if(!original||typeof original!=='object')continue;
      const t=cleanTask({...original,id:uuid(),attachments:[]});
      if(!await saveTask(t))throw new Error('Impossibile salvare l’attività importata.');
      for(const oldMeta of Array.isArray(original.attachments)?original.attachments:[]){
        const data=backup.files?.[oldMeta.id];if(!data)continue;
        const blob=dataUrlToBlob(data);
        const current=tasks.find(v=>v.id===t.id),meta=await storeBlob(current,blob,oldMeta.name||'allegato');
        if(!await saveTask({...current,attachments:[...current.attachments,meta]}))throw new Error('Impossibile salvare un allegato importato.');
      }
      count++;
    }
    showToast(`${count} attività importate.`);
  }catch(e){showToast(`Importazione interrotta (${count} attività importate): ${e.message}`);}
  finally{working=false;$('importFile').value='';}
}

async function handleAction(action,taskId,button) {
  if(action==='retry-cloud')return connectCloud();
  const t=tasks.find(t=>t.id===taskId);
  if(action==='new')return openInline();
  if(action==='cancel-inline')return cancelInline();
  if(action==='cancel-sub-edit')return cancelSubtaskEdit();
  if(!t)return;
  if(action==='edit-sub')return openSubtaskEdit(taskId,button.dataset.subId);
  if(action==='date-open'){
    const alreadyOpen=calendarTaskId===taskId;
    calendarTaskId=alreadyOpen?null:taskId;
    if(!alreadyOpen)calendarMonth=(t.due_date||todayISO()).slice(0,7);
    openMenuId=null;render();
    if(!alreadyOpen)requestAnimationFrame(()=>document.querySelector('.calendar-day.selected, .calendar-day.is-today')?.focus());
    return;
  }
  if(action==='cal-close'){calendarTaskId=null;render();return;}
  if(action==='cal-prev'||action==='cal-next'){
    calendarMonth=shiftCalendarMonth(calendarMonth,action==='cal-prev'?-1:1);
    render();
    requestAnimationFrame(()=>document.querySelector(`[data-action="${action}"]`)?.focus());
    return;
  }
  if(action==='cal-day'||action==='cal-today'){
    const selected=action==='cal-today'?todayISO():button.dataset.date;
    if(!fromISO(selected))return;
    const before=t.due_date;
    calendarTaskId=null;
    if(selected===before){render();return;}
    if(await saveTask({...t,due_date:selected})){
      showToast(`Scadenza modificata: ${absoluteDate(selected)}.`,async()=>{
        const current=tasks.find(v=>v.id===taskId);
        if(current?.due_date===selected){await saveTask({...current,due_date:before});showToast('Modifica scadenza annullata.');}
      });
    }
    return;
  }
  if(action==='done')return changeDone(taskId);
  if(action==='toggle'){
    if(expandedIds.has(taskId)) {
      expandedIds.delete(taskId);
      if(editingSubtask?.taskId===taskId)editingSubtask=null;
    }else expandedIds.add(taskId);
    openMenuId=null;calendarTaskId=null;render();return;
  }
  if(action==='slider-toggle'){
    const el=button.closest('.delay-control');
    document.querySelectorAll('.delay-control.is-open').forEach(n=>{if(n!==el)n.classList.remove('is-open');});
    el?.classList.toggle('is-open');
    el?.querySelector('.delay-range')?.focus();return;
  }
  if(action==='menu') {openMenuId=openMenuId===taskId?null:taskId;calendarTaskId=null;render();return;}
  if(action==='edit'){openMenuId=null;return openInline(taskId);}
  if(action==='duplicate')return duplicateTask(taskId);
  if(action==='copy'){openMenuId=null;render();return copyTaskLink(taskId);}
  if(action==='attach'){
    expandedIds.add(taskId);openMenuId=null;calendarTaskId=null;render();
    $('upload-'+taskId)?.click();return;
  }
  if(action==='delete')return deleteTask(taskId);
  if(action==='download')return downloadFile(taskId,button.dataset.fileId);
  if(action==='del-file')return deleteFile(taskId,button.dataset.fileId);
}
function updatingForm() {
  const el=document.activeElement;
  return !!(inlineEditor || editingSubtask || el?.matches('input:not([type=range]),textarea'));
}
function wireEvents() {
  $('newTask').addEventListener('click',()=>openInline());
  $('exportBackup').addEventListener('click',exportBackup);
  $('importBackup').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',e=>{if(e.target.files?.length)importBackup(e.target.files[0]);});
  $('refreshTasks').addEventListener('click',()=>refresh(true));
  $('toast').addEventListener('click',async e=>{
    if(e.target.id==='undoToast'&&undoCallback){const fn=undoCallback;toastDismiss();await fn();}
  });
  document.addEventListener('keydown',e=>{
    const focusedDay=e.target.closest?.('.calendar-day');
    if(focusedDay){
      const movement={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
      if(movement){
        e.preventDefault();
        const date=fromISO(focusedDay.dataset.date);
        date.setDate(date.getDate()+movement);
        const target=localISO(date);
        if(target.slice(0,7)!==calendarMonth){calendarMonth=target.slice(0,7);render();}
        requestAnimationFrame(()=>document.querySelector(`.calendar-day[data-date="${target}"]`)?.focus());
        return;
      }
    }
    if(e.key==='Escape') {
      if(inlineEditor)cancelInline();
      else if(editingSubtask)cancelSubtaskEdit();
      else {openMenuId=null;calendarTaskId=null;document.querySelectorAll('.delay-control.is-open').forEach(n=>n.classList.remove('is-open'));render();}
    }
    if((e.key==='n'||e.key==='N')&&!e.altKey&&!e.metaKey&&!e.ctrlKey&&!updatingForm()&&!document.activeElement?.closest('button')){
      e.preventDefault();openInline();
    }
  });
  const root=$('tasks');
  root.addEventListener('click',async e=>{
    const btn=e.target.closest('button[data-action]');if(!btn)return;
    e.preventDefault();e.stopPropagation();
    await handleAction(btn.dataset.action,btn.dataset.id,btn);
  });
  root.addEventListener('submit',async e=>{
    const form=e.target.closest('form[data-form]');if(!form)return;
    e.preventDefault();
    if(form.dataset.form==='inline')return submitInlineForm({currentTarget:form,preventDefault(){}});
    const taskId=form.dataset.id,t=tasks.find(t=>t.id===taskId),f=new FormData(form);
    if(!t)return;
    if(form.dataset.form==='edit-sub') {
      const subId=form.dataset.subId;
      if(editingSubtask?.taskId!==taskId || editingSubtask?.subId!==subId)return;
      const title=String(f.get('title')||'').trim();
      if(!title){form.elements.title.focus();return;}
      const current=t.subtasks.find(s=>s.id===subId && !s.done);
      if(!current){cancelSubtaskEdit();return;}
      if(title===current.title){cancelSubtaskEdit();return;}
      editingSubtask=null;
      const ok=await saveTask({...t,subtasks:t.subtasks.map(s=>s.id===subId?{...s,title}:s)});
      if(ok)showToast('Sotto-attività modificata.');
      else {
        editingSubtask={taskId,subId,title};render();
        requestAnimationFrame(()=>document.querySelector('.subtask-edit-input')?.focus());
      }
      return;
    }
    if(form.dataset.form==='sub'){
      const title=String(f.get('title')||'').trim();if(!title)return;
      await saveTask({...t,subtasks:[...t.subtasks,{id:uuid(),title,done:false}]});
    }
  });
  root.addEventListener('change',async e=>{
    const target=e.target;
    if(target.matches('input[data-action="subtoggle"]') && target.checked){
      const t=tasks.find(t=>t.id===target.dataset.id);if(!t)return;
      const index=t.subtasks.findIndex(s=>s.id===target.dataset.subId);
      if(index<0)return;
      const completed=t.subtasks[index];
      const remaining=t.subtasks.filter(s=>s.id!==completed.id && !s.done);
      if(await saveTask({...t,subtasks:remaining})){
        showToast('Sotto-attività completata e rimossa.',async()=>{
          const current=tasks.find(v=>v.id===t.id);
          if(!current||current.subtasks.some(s=>s.id===completed.id))return;
          const restored=[...current.subtasks];restored.splice(Math.min(index,restored.length),0,{...completed,done:false});
          if(await saveTask({...current,subtasks:restored}))showToast('Sotto-attività ripristinata.');
        });
      }
    }
    if(target.matches('input[data-upload]')){
      const files=Array.from(target.files||[]);if(files.length)await uploadFiles(target.dataset.upload,files);
    }
    if(target.matches('.delay-range')){
      const days=Number(target.value);
      if(days>0)await postpone(target.dataset.id,days);
    }
  });
  root.addEventListener('input',e=>{
    const target=e.target;
    if(inlineEditor && target.closest('.inline-task-form')?.dataset.id===inlineEditor.id){
      if(target.name==='title')inlineEditor.title=target.value;
      if(target.name==='due_date')inlineEditor.due_date=target.value;
      return;
    }
    if(editingSubtask && target.matches('.subtask-edit-input')){
      editingSubtask.title=target.value;
      return;
    }
    if(!target.matches('.delay-range'))return;
    const days=Number(target.value),slider=target.closest('.delay-control');
    const t=tasks.find(t=>t.id===target.dataset.id);
    const start=(!t?.due_date||t.due_date<todayISO())?todayISO():t.due_date;
    const next=days?plusWorkingDays(start,days):start;
    slider.querySelector('.delay-count').textContent=`+${days}`;
    slider.querySelector('.delay-trigger').textContent=`+${days}g`;
    slider.querySelector('.delay-preview').textContent=days?`→ ${shortDate(next)} · ${fromISO(next)?.toLocaleDateString('it-IT',{day:'numeric',month:'long'})}`:' '; 
    slider.querySelectorAll('.delay-segment').forEach((segment,i)=>segment.classList.toggle('active',i<days));
    target.setAttribute('aria-valuetext',days?`${days} giorni lavorativi, nuova scadenza ${absoluteDate(next)}`:'Nessun rinvio');
  });
  document.addEventListener('click',e=>{
    if((openMenuId && !e.target.closest('.menu-control')) || (calendarTaskId && !e.target.closest('.date-control'))){openMenuId=null;calendarTaskId=null;render();}
    if(!e.target.closest('.delay-control')){
      document.querySelectorAll('.delay-control.is-open').forEach(n=>n.classList.remove('is-open'));
      if(document.activeElement?.matches('.delay-range'))document.activeElement.blur();
    }
  });
  window.addEventListener('hashchange',handleHash);
  window.addEventListener('storage',e=>{if(!cloud && e.key===LOCAL_TASKS_KEY){tasks=localRead();render();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && cloud && !updatingForm() && !pendingWrites)refresh();});
  setInterval(()=>{
    if(document.hidden||updatingForm()||pendingWrites)return;
    if(cloud)refresh();else render();
  },30000);
}
async function init() {
  wireEvents();
  const c=window.FILO_CONFIG||{};
  cloud=!!(c.supabaseUrl && c.supabasePublishableKey && !c.labLocalOnly);
  if(!cloud){
    tasks=localRead();render();handleHash();
    storageLabel('Modalità locale · Supabase non configurato in config.js');
    return;
  }
  render(); // Display an explicit loading state during import/initial SELECT.
  await connectCloud();
}
init().catch(reportCloudError);

// Interfaccia strettamente limitata per il laboratorio vocale. Mai eval/codice AI eseguibile.
window.FILO_VOICE_LAB_ADAPTER={
  list:()=>tasks.filter(t=>t.status!=='done').map(t=>({id:t.id,title:t.title,due_date:t.due_date,subtasks:t.subtasks.filter(s=>!s.done).map(s=>({id:s.id,title:s.title}))})),
  async apply(actions){
    if(!Array.isArray(actions)||!actions.length||actions.length>5)throw new Error('Piano di modifiche non valido.');
    if(cloud && (!cloudReady||cloudError))throw new Error('Connessione dati non disponibile.');
    const ids=new Set(tasks.map(t=>t.id));
    let newTaskId=null;
    // Primo controllo: nessuna esecuzione parziale per destinatari sconosciuti.
    let sawCreate=false;
    for(const a of actions){
      if(!['create_task','set_due_date','postpone_working','add_subtask'].includes(a.type))throw new Error('Operazione non autorizzata.');
      const target=a.task_id;
      if(a.type==='create_task'){
        if(!a.title||String(a.title).length>180)throw new Error('Titolo dell’attività non valido.');
        if(a.due_date&&!fromISO(a.due_date))throw new Error('Data non valida.');
        sawCreate=true;
      } else {
        if(target==='new'){
          if(!sawCreate||a.type!=='add_subtask')throw new Error('Riferimento a una nuova attività non valido.');
        } else if(!ids.has(target))throw new Error('L’attività indicata non esiste più.');
        if(a.type==='set_due_date'&&!fromISO(a.due_date))throw new Error('Scadenza non valida.');
        if(a.type==='postpone_working'&&(!Number.isInteger(a.days)||a.days<1||a.days>30))throw new Error('Rinvio non valido.');
        if(a.type==='add_subtask'&&(!a.title||String(a.title).length>180))throw new Error('Sotto-attività non valida.');
      }
    }
    let completed=0;
    for(const a of actions){
      if(a.type==='create_task'){
        const record=cleanTask({title:a.title.trim(),due_date:a.due_date||todayISO()});
        if(!await saveTask(record))throw new Error(`Salvate ${completed} modifiche, poi errore nel salvataggio.`);
        newTaskId=record.id;
      } else {
        const id=a.task_id==='new'?newTaskId:a.task_id;
        const record=tasks.find(t=>t.id===id);
        if(!record)throw new Error('Attività non più disponibile.');
        let updated;
        if(a.type==='set_due_date')updated={...record,due_date:a.due_date};
        if(a.type==='postpone_working'){
          const start=!record.due_date||record.due_date<todayISO()?todayISO():record.due_date;
          updated={...record,due_date:plusWorkingDays(start,a.days)};
        }
        if(a.type==='add_subtask')updated={...record,subtasks:[...record.subtasks,{id:uuid(),title:a.title.trim(),done:false}]};
        if(!updated||!await saveTask(updated))throw new Error(`Salvate ${completed} modifiche, poi errore nel salvataggio.`);
      }
      completed++;
    }
    showToast(`${completed} ${completed===1?'modifica eseguita':'modifiche eseguite'} in Filo Lab.`);
    return completed;
  }
};

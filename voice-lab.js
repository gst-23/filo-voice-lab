/* Filo Voice Lab - browser UI only. Calls the local Filo adapter for allowlisted operations.
   Groq secrets are held in a Supabase Edge Function, NEVER inside this script. */
const $=id=>document.getElementById(id);
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateText=iso=>{if(!iso)return 'oggi';const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d,12).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});};
let recorder=null,streams=null,chunks=[],audioBlob=null,actions=[],busy=false,recordStopTimer=null;
const $state=$('voiceState');
const $record=$('voiceRecord');
const $text=$('voiceTranscript');
const $plan=$('voicePlan');
const $confirm=$('voiceConfirmRow');
const $analyze=$('voiceAnalyze');
const $overlay=$('voiceOverlay');
function lab(){return window.FILO_VOICE_LAB_ADAPTER;}
function setState(s){$state.textContent=s;}
function clearPlan(){actions=[];$plan.innerHTML='';$plan.classList.add('hidden');$confirm.classList.add('hidden');}
function showMessage(message,isError=false){$plan.classList.remove('hidden');$plan.innerHTML=`<p class="${isError?'voice-error':''}">${html(message)}</p>`;$confirm.classList.add('hidden');}
function setBusy(value){busy=value;$analyze.disabled=value;$record.disabled=value;$('voiceConfirm').disabled=value;}
function releaseMicrophone(){if(recordStopTimer)clearTimeout(recordStopTimer);recordStopTimer=null;streams?.getTracks().forEach(t=>t.stop());streams=null;}
function stopRecorder(){if(!recorder||recorder.state!=='recording')return;recorder.stop();$record.classList.remove('recording');$record.querySelector('span').textContent='Registra';setState('Sto preparando la registrazione…');}
async function startRecorder(){
  if(busy)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
    setState('Microfono non disponibile in questo browser. Usa il campo di testo.');return;
  }
  if(recorder?.state==='recording'){stopRecorder();return;}
  clearPlan();audioBlob=null;chunks=[];
  try{
    streams=await navigator.mediaDevices.getUserMedia({audio:true});
    if($overlay.classList.contains('hidden')){releaseMicrophone();return;}
    let mime='';
    for(const candidate of ['audio/webm;codecs=opus','audio/mp4','audio/webm']){if(MediaRecorder.isTypeSupported(candidate)){mime=candidate;break;}}
    recorder=new MediaRecorder(streams,mime?{mimeType:mime}:{});
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    recorder.onstop=()=>{
      const type=recorder?.mimeType||mime||'audio/webm';
      audioBlob=new Blob(chunks,{type});chunks=[];releaseMicrophone();
      if($overlay.classList.contains('hidden'))return;
      setState(audioBlob.size?`Registrazione pronta (${Math.round(audioBlob.size/1024)} KB). Premi “Interpreta comando”.`:'Registrazione vuota. Riprova.');
    };
    recorder.onerror=()=>{releaseMicrophone();setState('Errore di registrazione. Puoi scrivere il comando.');};
    recorder.start(300);
    $record.classList.add('recording');$record.querySelector('span').textContent='Ferma';
    setState('Registrazione in corso… premi Ferma per terminare.');
    recordStopTimer=setTimeout(()=>{if(recorder?.state==='recording'){stopRecorder();setState('Limite di 45 secondi raggiunto.');}},45000);
  }catch(error){releaseMicrophone();setState('Microfono non disponibile o permesso negato. Scrivi il comando.');}
}
function openVoice(){
  $overlay.classList.remove('hidden');
  clearPlan();
  if(!$text.value.trim())setState('Puoi dettare o scrivere il comando.');
  // Intentional: requested user gesture triggers getUserMedia right away.
  startRecorder();
}
function closeVoice(){
  if(recorder?.state==='recording'){
    try{recorder.onstop=null;recorder.stop();}catch(_){}
  }
  releaseMicrophone();audioBlob=null;clearPlan();$overlay.classList.add('hidden');
  $record.classList.remove('recording');$record.querySelector('span').textContent='Registra';
}
function makeSummary(){const a=lab();if(!a)throw new Error('Filo non ha ancora caricato le attività.');return a.list().slice(0,120);}
function describe(a,byId){
  const label=id=>id==='new'?'nuova attività':byId.get(id)||'attività non trovata';
  switch(a.type){
    case 'create_task':return `Crea “${a.title}” con scadenza ${dateText(a.due_date)}`;
    case 'set_due_date':return `Imposta la scadenza di “${label(a.task_id)}” al ${dateText(a.due_date)}`;
    case 'postpone_working':return `Posticipa “${label(a.task_id)}” di ${a.days} giorni lavorativi`;
    case 'add_subtask':return `Aggiungi a “${label(a.task_id)}” la sotto-attività “${a.title}”`;
    default:return 'Operazione non riconosciuta';
  }
}
function displayPlan(result){
  actions=result.actions;
  const records=lab().list(),names=new Map(records.map(t=>[t.id,t.title]));
  $plan.classList.remove('hidden');
  $plan.innerHTML=`<h3>Prima di salvare, verifica le modifiche</h3>${result.note?`<p>${html(result.note)}</p>`:''}<ol>${actions.map(a=>`<li>${html(describe(a,names))}</li>`).join('')}</ol>`;
  $confirm.classList.remove('hidden');
}
function validatedPlan(list){
  if(!Array.isArray(list)||list.length>5)throw new Error('Il servizio ha restituito troppe operazioni.');
  const ids=new Set(lab().list().map(t=>t.id));
  const types=new Set(['create_task','set_due_date','postpone_working','add_subtask']);
  let sawNew=false;
  const out=[];
  for(const raw of list){
    if(!raw||!types.has(raw.type))throw new Error('Il servizio ha richiesto una funzione non permessa.');
    const a={type:raw.type,task_id:String(raw.task_id||''),title:String(raw.title||'').trim(),due_date:String(raw.due_date||'').trim(),days:Number(raw.days||0)};
    if(a.type==='create_task'){
      if(!a.title||a.title.length>180)throw new Error('Titolo mancante.');
      if(a.due_date&&!/^\d{4}-\d{2}-\d{2}$/.test(a.due_date))throw new Error('Data non valida.');
      sawNew=true;
    }else{
      if(a.task_id==='new'){if(a.type!=='add_subtask'||!sawNew)throw new Error('Riferimento a nuova attività non valido.');}
      else if(!ids.has(a.task_id))throw new Error('Non trovo la voce da modificare. Riprova aggiornando Filo.');
      if(a.type==='set_due_date'&&!/^\d{4}-\d{2}-\d{2}$/.test(a.due_date))throw new Error('Scadenza non valida.');
      if(a.type==='postpone_working'&&(!Number.isInteger(a.days)||a.days<1||a.days>30))throw new Error('Giorni lavorativi non validi.');
      if(a.type==='add_subtask'&&(!a.title||a.title.length>180))throw new Error('Sotto-attività non valida.');
    }
    out.push(a);
  }
  return out;
}
async function analyze(){
  if(busy)return;
  if(recorder?.state==='recording'){stopRecorder();setState('Ferma la registrazione, poi riprova.');return;}
  if(!audioBlob?.size&&!$text.value.trim()){showMessage('Registra o scrivi qualcosa prima di interpretare.',true);return;}
  const endpoint=(window.FILO_VOICE_SETTINGS?.functionUrl||'').trim();
  if(!endpoint){showMessage('Il servizio AI non è ancora configurato. Usa “Esempio” per vedere il flusso senza modificare Filo stabile.',true);return;}
  if(!/^https:\/\/[\w.-]+\.supabase\.co\/functions\/v1\/filo-voice\/?$/.test(endpoint)){
    showMessage('L’URL della funzione in config.js non è valido.',true);return;
  }
  let access=sessionStorage.getItem('filo-voice-lab-access');
  if(!access){access=prompt('Inserisci il codice di accesso al servizio vocale (non la chiave API Groq):')||'';if(!access.trim())return;sessionStorage.setItem('filo-voice-lab-access',access);}
  setBusy(true);clearPlan();setState('L’AI sta preparando l’anteprima, senza modificare alcun dato…');
  try{
    const body=new FormData();
    const summary=makeSummary();
    body.set('tasks',JSON.stringify(summary));body.set('today',isoToday());
    if(audioBlob?.size){
      const extension=audioBlob.type.includes('mp4')?'m4a':'webm';
      body.set('audio',audioBlob,`filo-comando.${extension}`);
    }else body.set('text',$text.value.trim());
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),55000);
    let response;
    try{response=await fetch(endpoint,{method:'POST',headers:{'X-Voice-Code':access},body,signal:controller.signal});}
    finally{clearTimeout(timeout);}
    const payload=await response.json().catch(()=>({error:'Risposta non valida dal servizio AI.'}));
    if(!response.ok){if(response.status===401)sessionStorage.removeItem('filo-voice-lab-access');throw new Error(payload.error||`Errore ${response.status}`);}
    if(payload.transcript){$text.value=payload.transcript;audioBlob=null;}
    const safe=validatedPlan(payload.actions||[]);
    if(!safe.length){showMessage(payload.note||'Nessuna modifica proposta. Prova a essere più specifico.',false);setState('Nessuna modifica applicata.');return;}
    displayPlan({actions:safe,note:payload.note||''});
    setState('Anteprima pronta. Conferma solo se è corretta.');
  }catch(e){showMessage(e.name==='AbortError'?'Il servizio non ha risposto in tempo.':e.message,true);setState('Nessuna modifica eseguita.');}
  finally{setBusy(false);}
}
async function confirmPlan(){
  if(!actions.length||busy)return;
  setBusy(true);setState('Sto salvando le operazioni nel laboratorio…');
  try{const count=await lab().apply(validatedPlan(actions));clearPlan();audioBlob=null;$text.value='';setState(`${count} operazioni completate nel laboratorio.`);}
  catch(e){showMessage(`Non è stato possibile completare tutte le operazioni: ${e.message}`,true);setState('Controlla l’elenco delle attività.');}
  finally{setBusy(false);}
}
function example(){
  if(busy)return;
  audioBlob=null;
  $text.value='Crea l’attività Controllare la prova del microfono per oggi';
  const preview={actions:[{type:'create_task',task_id:'',title:'Controllare la prova del microfono',due_date:isoToday(),days:0}],note:'Dimostrazione locale, senza modello AI. Le attività create qui NON compaiono nel Filo stabile.'};
  actions=validatedPlan(preview.actions);
  displayPlan(preview);
  setState('Esempio locale pronto. Nessun servizio AI è stato chiamato.');
}
$('voiceTask').addEventListener('click',openVoice);
$('voiceClose').addEventListener('click',closeVoice);
$('voiceRecord').addEventListener('click',startRecorder);
$('voiceAnalyze').addEventListener('click',analyze);
$('voiceExample').addEventListener('click',example);
$('voiceConfirm').addEventListener('click',confirmPlan);
$('voiceDiscard').addEventListener('click',()=>{clearPlan();setState('Modifiche annullate: nulla è stato salvato.');});
$overlay.addEventListener('click',e=>{if(e.target===$overlay)closeVoice();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$overlay.classList.contains('hidden')){e.preventDefault();e.stopPropagation();closeVoice();}},true);

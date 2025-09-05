// ===== Helpers & State =====
const S = (k, v) => (v===undefined? JSON.parse(localStorage.getItem(k)||'null') : (localStorage.setItem(k,JSON.stringify(v)), v));
const el = id => document.getElementById(id);
const fmtDate = d => new Date(d).toLocaleDateString('ru-RU');
const fmtTime = m => { const h=Math.floor(m/60), mm=m%60; return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; };
const parseTime = t => { if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
const toMoney = v => (Number(v||0)).toFixed(2);

// ===== Default Data =====
const defaultTariffs = { base: 358.46, region: 20, north: 50, klass: 0, zone: 0, bam: 0, comm: 0, monthNorm: 176 };
if(!S('tariffs')) S('tariffs', defaultTariffs);
if(!S('sections')) S('sections', []/*
  {id:1, name:'Малошуйка — Обозерская', from:'Малошуйка', to:'Обозерская', len:167, normWeight:5200, normLen:59, stations:['Малошуйка','Обозерская']},
  {id:2, name:'Обозерская — Малошуйка', from:'Обозерская', to:'Малошуйка', len:167, normWeight:5200, normLen:59, stations:['Обозерская','Малошуйка']}
]);*/
if(!S('trips')) S('trips', []);*/
if(!S('refsText')) S('refsText','');
if(!S('goState')) S('goState', null);
if(!S('normBasis')) S('normBasis','calendar');

// ===== UI: Drawer & Views =====
function toast(text='Сохранено'){
  const t = document.getElementById('toast'); if(!t) return;
  t.textContent = text; t.hidden=false; t.classList.remove('show');
  // force reflow
  void t.offsetWidth; 
  t.classList.add('show');
  setTimeout(()=>{ t.hidden=true; t.classList.remove('show'); }, 2400);
}

const drawer = el('drawer'), scrim = el('scrim');
el('menuBtn').addEventListener('click', ()=>{ drawer.setAttribute('aria-hidden','false'); scrim.hidden=false; });
scrim.addEventListener('click', ()=>{ drawer.setAttribute('aria-hidden','true'); scrim.hidden=true; });

document.querySelectorAll('.navitem').forEach(b=>b.addEventListener('click', ()=>{
  document.querySelectorAll('.navitem').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  const view = b.getAttribute('data-view');
  document.querySelectorAll('.view').forEach(v=>v.hidden = !v.id.endsWith(view));
  drawer.setAttribute('aria-hidden','true'); scrim.hidden=true;
  if(view==='dashboard'){ renderDashboard(); }
  if(view==='sections'){ renderSections(); }
  if(view==='tariffs'){ renderTariffs(); }
  if(view==='calc'){ /* nothing extra */ }
  if(view==='db'){ /* nothing extra */ }
  if(view==='refs'){ renderRefs(); }
  if(view==='settings'){ /* nothing extra */ }
}));

// ===== Quick Go (timer) =====
const goBtn = el('goBtn'); const quickGo = el('quickGo'); const goStart = el('goStart');
function refreshGo(){
  const st = S('goState', null);
  quickGo.hidden = !st;
  if(st){ goStart.textContent = new Date(st.startTs).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}); goBtn.textContent='■ Идёт смена'; }
  else{ goBtn.textContent='▶︎ Поехали'; }
}
goBtn.addEventListener('click', ()=>{
  const st = S('goState', null);
  if(st){ alert('Смена уже идёт. Нажмите «Завершить» в панели.'); return; }
  const now = Date.now();
  S('goState', {startTs: now, stops: []});
  refreshGo(); renderDashboard();
});
el('goAddStop').addEventListener('click', ()=>{
  const st = S('goState', null); if(!st){ return; }
  st.stops.push({startTs: Date.now(), endTs: null}); S('goState', st); refreshGo();
  alert('Стоянка начата. Остановите её позже в редакторе поездки.');
});
el('goFinish').addEventListener('click', ()=>{
  const st = S('goState', null); if(!st) return;
  const start = new Date(st.startTs);
  const end = new Date();
  S('goState', null); refreshGo();
  openTripModal({
    date: new Date().toISOString().slice(0,10),
    start: start.toTimeString().slice(0,5),
    end: end.toTimeString().slice(0,5),
    stops: (st.stops||[]).map(s=>{
      const stM = s.startTs? new Date(s.startTs).toTimeString().slice(0,5) : '';
      const enM = s.endTs? new Date(s.endTs).toTimeString().slice(0,5) : '';
      let m = 0; if(s.startTs && s.endTs){ const stmm = (new Date(s.startTs).getHours()*60+new Date(s.startTs).getMinutes()); const enmm=(new Date(s.endTs).getHours()*60+new Date(s.endTs).getMinutes()); m = enmm-stmm; if(m<0) m+=1440; }
      return {start: stM, end: enM, minutes: m, note:''};
    })
  });
});

// ===== Segments: days/months/payroll =====
document.querySelectorAll('.seg').forEach(s=>s.addEventListener('click', ()=>{
  document.querySelectorAll('.seg').forEach(z=>z.classList.remove('active')); s.classList.add('active');
  const seg = s.getAttribute('data-seg');
  el('daysView').hidden = seg!=='days'; el('monthsView').hidden = seg!=='months'; el('payrollView').hidden = seg!=='payroll';
}));

// ===== Filters =====
el('clearFiltersBtn').addEventListener('click', ()=>{
  el('searchQuery').value=''; el('filterMonth').value=''; el('filterMode').value=''; renderDashboard();
});
['searchQuery','filterMonth','filterMode'].forEach(id=> el(id).addEventListener('input', renderDashboard));
function populateMonthsSelect(){
  const trips = S('trips',[]);*/
  const months = Array.from(new Set(trips.map(t=> t.date?.slice(0,7)).filter(Boolean))).sort().reverse();
  const sel = el('filterMonth'); const cur = sel.value;
  sel.innerHTML = '<option value=\"\">Текущий месяц</option>' + months.map(m=> `<option>${m}</option>`).join('');
  if(months.includes(cur)) sel.value=cur;
}

// ===== Month widget logic =====
function workingDaysInMonth(year, month){ let c=0; const end=new Date(year,month+1,0).getDate(); for(let d=1; d<=end; d++){ const wd=new Date(year,month,d).getDay(); if(wd>=1&&wd<=5) c++; } return c; }
function workingDaysElapsed(year, month, today){ let c=0; for(let d=1; d<=today; d++){ const wd=new Date(year,month,d).getDay(); if(wd>=1&&wd<=5) c++; } return c; }

function renderMonthWidget(monthKey){
  const t = S('tariffs', defaultTariffs);
  const tripsAll = S('trips',[]);*/
  const trips = tripsAll.filter(tr=> tr.date && tr.date.slice(0,7) === monthKey);
  const workedMin = trips.reduce((acc,x)=> acc + (x.workedMin||0), 0);
  const normMin = (t.monthNorm||0) * 60;

  const percent = normMin? Math.round(workedMin / normMin * 100) : 0;
  const remain = normMin - workedMin;

  const basis = S('normBasis','calendar');
  const [y,m] = monthKey.split('-').map(Number);
  const now = new Date();
  const isCurrentMonth = (now.getFullYear()===y && (now.getMonth()+1)===m);
  const daysInMonth = new Date(y, m, 0).getDate();
  let denomDays = daysInMonth, elapsedDays = daysInMonth;
  if(basis==='calendar'){
    denomDays = daysInMonth; elapsedDays = isCurrentMonth? now.getDate() : daysInMonth;
  }else{
    denomDays = workingDaysInMonth(y, m-1);
    elapsedDays = isCurrentMonth? workingDaysElapsed(y, m-1, now.getDate()) : denomDays;
  }
  const planToDateMin = Math.round(normMin * (elapsedDays/denomDays));
  const planPercent = planToDateMin? Math.round(workedMin / planToDateMin * 100) : 0;

  el('mwNorm').textContent = (t.monthNorm||0) + ' ч';
  el('mwWorked').textContent = fmtTime(workedMin);
  el('mwPercent').textContent = percent + '%';
  el('mwRemaining').textContent = remain>=0 ? ('Осталось: ' + fmtTime(remain)) : ('Переработка: ' + fmtTime(-remain));
  el('mwBar').style.width = Math.min(100, Math.max(0, percent)) + '%';
  el('planBar').style.width = Math.min(100, Math.max(0, planPercent)) + '%';
  el('planHours').textContent = fmtTime(planToDateMin);
  el('planPercent').textContent = planPercent + '%';

  const sel = el('normBasis'); sel.value = basis; sel.onchange = ()=>{ S('normBasis', sel.value); renderMonthWidget(monthKey); };

  el('monthWidget').style.display = 'block';

  if(isCurrentMonth){
    const diff = planToDateMin - workedMin;
    const sign = diff>=0? '' : '−';
    el('todayNorm').textContent = `${sign}${fmtTime(Math.abs(diff))}`;
  }
}

// ===== Trips =====
const tripModal = el('tripModal'); let editingTripId = null; let tempStops = [];
function openTripModal(trip=null){
  editingTripId = trip? trip.id : null;
  el('tripModalTitle').textContent = editingTripId? 'Редактирование поездки' : 'Новая поездка';
  el('tripDeleteBtn').style.display = editingTripId? 'inline-flex' : 'none';
  const secs = S('sections',[]);*/
  const sel = el('tripSection'); sel.innerHTML=''; secs.forEach(s=>{ const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o); });
  el('tripDate').value = trip?.date || new Date().toISOString().slice(0,10);
  el('tripSection').value = trip?.sectionId || (secs[0]?.id || '');
  const secObj = secs.find(s=> s.id==el('tripSection').value);
  el('tripFrom').value = trip?.from || secObj?.from || '';
  el('tripTo').value = trip?.to || secObj?.to || '';
  el('tripLen').value = trip?.len ?? (secObj?.len || '');
  el('tripType').value = trip?.type || 'Грузовой';
  el('tripMode').value = trip?.mode || 'electro';
  el('tripNumber').value = trip?.number || '';
  el('tripLoco').value = trip?.loco || '';
  el('tripWeight').value = trip?.weight || '';
  el('tripAxles').value = trip?.axles || '';
  el('tripCondLen').value = trip?.condLen || '';
  el('tripStart').value = trip?.start || '';
  el('tripEnd').value = trip?.end || '';
  el('excludeStops').checked = !!trip?.excludeStops;
  tempStops = (trip?.stops || []).slice();
  renderStops();
  el('tripEnergy').value = trip?.energy || 0;
  el('tripFuel').value = trip?.fuel || 0;
  el('tripNotes').value = trip?.notes || '';
  updateModeVisibility();
  updateTripSummary();
  updateNormsBox();
  tripModal.hidden=false;
}
function closeTripModal(){ tripModal.hidden=true; }
el('tripCloseBtn').addEventListener('click', closeTripModal);
el('fabAddTrip').addEventListener('click', ()=> openTripModal());
el('tripSection').addEventListener('change', ()=>{
  const s = S('sections',[]).find(x=> x.id==el('tripSection').value);
  if(!s) return;
  if(!editingTripId){ el('tripFrom').value=s.from; el('tripTo').value=s.to; el('tripLen').value=s.len; }
  updateNormsBox();
});
['tripStart','tripEnd','excludeStops'].forEach(id=> el(id).addEventListener('input', ()=>{ updateTripSummary(); }));
['tripDate','tripSection','tripFrom','tripTo','tripLen','tripType','tripNumber','tripLoco','tripWeight','tripAxles','tripCondLen','tripEnergy','tripFuel','tripMode']
.forEach(id=> el(id).addEventListener('input', ()=>{ updateTripSummary(); updateNormsBox(); if(id==='tripMode'){ updateModeVisibility(); } }));

function calcWorkedMin(start, end){ const s=parseTime(start), e=parseTime(end); if(s==null||e==null) return 0; let m=e-s; if(m<0) m+=1440; return m; }
function totalStopsMin(){ return tempStops.reduce((a,x)=> a + (x.minutes||0), 0); }
function moneyForTrip(workMin){
  const t = S('tariffs', defaultTariffs);
  const factor = 1 + (Number(t.region||0)+Number(t.north||0)+Number(t.klass||0)+Number(t.zone||0)+Number(t.bam||0))/100;
  return (Number(t.base||0) * (workMin/60) * factor) + Number(t.comm||0);
}
function updateTripSummary(){
  const base = calcWorkedMin(el('tripStart').value, el('tripEnd').value);
  const m = el('excludeStops').checked ? Math.max(0, base - totalStopsMin()) : base;
  el('tripWorked').textContent = fmtTime(m);
  el('tripMoney').textContent = toMoney(moneyForTrip(m)) + ' ₽';
  el('stopsTotal').textContent = `${totalStopsMin()} мин`;
}
function updateModeVisibility(){
  const mode = el('tripMode').value;
  document.querySelector('.mode-electro').hidden = (mode!=='electro');
  document.querySelector('.mode-diesel').hidden = (mode!=='diesel');
}
function updateNormsBox(){
  const s = S('sections',[]).find(x=> x.id==el('tripSection').value);
  const w = Number(el('tripWeight').value||0), cl = Number(el('tripCondLen').value||0);
  const nw = s?.normWeight ?? 0, nl = s?.normLen ?? 0;
  const ow = w>nw? ((w-nw)/nw*100).toFixed(1)+'% сверх' : 'в норме';
  const ol = cl>nl? ((cl-nl)/nl*100).toFixed(1)+'% сверх' : 'в норме';
  el('normsBox').innerHTML = `
    <div>Норма веса</div><div><b>${nw||'—'}</b></div>
    <div>Вес поезда</div><div><b>${w||'—'} (${ow})</b></div>
    <div>Норма длины</div><div><b>${nl||'—'}</b></div>
    <div>Условная длина</div><div><b>${cl||'—'} (${ol})</b></div>
  `;
}

// Stops UI
el('addStopBtn').addEventListener('click', ()=>{ tempStops.push({start:'', end:'', minutes:0, note:''}); renderStops(); });
function renderStops(){
  const wrap = el('stopList'); wrap.innerHTML='';
  tempStops.forEach((s,idx)=>{
    const row = document.createElement('div'); row.className='card subtle';
    row.innerHTML = `<div class="grid3">
      <div class="row"><label>Начало</label><input type="time" data-s="${idx}" data-k="start" value="${s.start||''}"></div>
      <div class="row"><label>Окончание</label><input type="time" data-s="${idx}" data-k="end" value="${s.end||''}"></div>
      <div class="row"><label>Минуты</label><input type="number" inputmode="numeric" data-s="${idx}" data-k="minutes" value="${s.minutes||0}"></div>
    </div>
    <div class="row"><label>Примечание</label><input type="text" data-s="${idx}" data-k="note" value="${s.note||''}"></div>
    <div><button class="btn ghost" data-del="${idx}">Удалить</button></div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('input').forEach(inp=> inp.addEventListener('input', e=>{
    const i = Number(e.target.getAttribute('data-s')); const k = e.target.getAttribute('data-k'); let v = e.target.value;
    if(k==='minutes'){ v = Number(v||0); }
    tempStops[i][k] = v;
    if(k==='start' || k==='end'){
      const st=tempStops[i].start, en=tempStops[i].end;
      if(st && en){ let m = calcWorkedMin(st,en); tempStops[i].minutes = m; 
        const minutesInput = wrap.querySelector(`input[data-s="${i}"][data-k="minutes"]`); if(minutesInput) minutesInput.value = m;
      }
    }
    updateTripSummary();
  }));
  wrap.querySelectorAll('button[data-del]').forEach(b=> b.addEventListener('click', e=>{
    const i = Number(b.getAttribute('data-del')); tempStops.splice(i,1); renderStops(); updateTripSummary();
  }));
}

el('tripSaveBtn').addEventListener('click', ()=>{
  const base = calcWorkedMin(el('tripStart').value, el('tripEnd').value);
  const worked = el('excludeStops').checked ? Math.max(0, base - totalStopsMin()) : base;
  const trip = {
    id: editingTripId || Date.now(),
    date: el('tripDate').value,
    sectionId: Number(el('tripSection').value)||null,
    from: el('tripFrom').value.trim(),
    to: el('tripTo').value.trim(),
    len: Number(el('tripLen').value)||0,
    type: el('tripType').value,
    mode: el('tripMode').value,
    number: el('tripNumber').value.trim(),
    loco: el('tripLoco').value.trim(),
    weight: Number(el('tripWeight').value)||0,
    axles: Number(el('tripAxles').value)||0,
    condLen: Number(el('tripCondLen').value)||0,
    start: el('tripStart').value,
    end: el('tripEnd').value,
    excludeStops: el('excludeStops').checked,
    stops: tempStops.slice(),
    stopsMin: totalStopsMin(),
    workedMin: worked,
    energy: Number(el('tripEnergy').value)||0,
    fuel: Number(el('tripFuel').value)||0,
    notes: el('tripNotes').value.trim(),
    money: moneyForTrip(worked)
  };
  const trips = S('trips',[]);*/
  const idx = trips.findIndex(x=>x.id===trip.id);
  if(idx>=0) trips[idx]=trip; else trips.unshift(trip);
  S('trips', trips);
  renderDashboard();
  closeTripModal();
});
el('tripDeleteBtn').addEventListener('click', ()=>{
  if(!editingTripId) return;
  if(!confirm('Удалить поездку?')) return;
  S('trips', S('trips',[]).filter(x=>x.id!==editingTripId));
  renderDashboard(); closeTripModal();
});

// ===== Sections (with stations list) =====
const sectionModal = el('sectionModal'); let editingSectionId = null;
// Close on outside click
sectionModal.addEventListener('click', (e)=>{
  if(e.target === sectionModal){ closeSectionModal(); }
});
// Close on ESC
document.addEventListener('keydown', (e)=>{
  if(!sectionModal.hidden && e.key === 'Escape'){ closeSectionModal(); }
});

el('addSectionBtn')?.addEventListener('click', ()=> openSectionModal());
function openSectionModal(sec=null){
  editingSectionId = sec? sec.id : null;
  el('sectionModalTitle').textContent = editingSectionId? 'Редактирование участка' : 'Новый участок';
  el('sectionDeleteBtn').style.display = editingSectionId? 'inline-flex' : 'none';
  el('secName').value = sec?.name || '';
  el('secFrom').value = sec?.from || '';
  el('secTo').value = sec?.to || '';
  el('secLen').value = sec?.len || '';
  el('secNormWeight').value = sec?.normWeight || '';
  el('secNormLen').value = sec?.normLen || '';
  el('secStations').value = (sec?.stations||[]).join(', ');
  sectionModal.hidden=false;
}
function closeSectionModal(){ 
  sectionModal.hidden=true; 
  editingSectionId = null;
}
el('sectionCloseBtn').addEventListener('click', closeSectionModal);
el('sectionSaveBtn').addEventListener('click', ()=>{
  const s = {
    id: editingSectionId || Date.now(),
    name: el('secName').value.trim() || `${el('secFrom').value.trim()} — ${el('secTo').value.trim()}`,
    from: el('secFrom').value.trim(),
    to: el('secTo').value.trim(),
    len: Number(el('secLen').value)||0,
    normWeight: Number(el('secNormWeight').value)||0,
    normLen: Number(el('secNormLen').value)||0,
    stations: (el('secStations').value||'').split(',').map(x=>x.trim()).filter(Boolean)
  };
  const arr = S('sections',[]); const idx=arr.findIndex(x=>x.id===s.id);
  if(idx>=0) arr[idx]=s; else arr.push(s);
  S('sections', arr); renderSections(); toast('Участок сохранён'); closeSectionModal(); renderDashboard();
});
el('sectionDeleteBtn').addEventListener('click', ()=>{
  if(!editingSectionId) return;
  if(!confirm('Удалить участок?')) return;
  S('sections', S('sections',[]).filter(x=>x.id!==editingSectionId)); renderSections(); closeSectionModal();
});

function renderSections(){
  const wrap = el('sectionList'); wrap.innerHTML='';
  const sections = S('sections',[]);*/
  if(!sections.length){ wrap.innerHTML='<div class="muted small">Нет участков.</div>'; return; }
  sections.forEach(s=>{
    const d=document.createElement('div'); d.className='card';
    d.innerHTML = `<div class="list-row"><div class="title">${s.name}</div></div>
      <div class="kv">
        <div>Отправление</div><div><b>${s.from||'—'}</b></div>
        <div>Прибытие</div><div><b>${s.to||'—'}</b></div>
        <div>Длина</div><div><b>${s.len||0} км</b></div>
        <div>Норма веса</div><div><b>${s.normWeight||0}</b></div>
        <div>Норма длины</div><div><b>${s.normLen||0}</b></div>
        <div>Станции</div><div><b>${(s.stations||[]).join(' · ')||'—'}</b></div>
      </div>
      <div style="margin-top:8px"><button class="btn" data-edit="${s.id}">Редактировать</button></div>`;
    wrap.appendChild(d);
  });
  wrap.querySelectorAll('button[data-edit]').forEach(b=>b.addEventListener('click', ()=>{
    const id=Number(b.getAttribute('data-edit')); openSectionModal(S('sections',[]).find(x=>x.id===id));
  }));
}

// ===== Tariffs =====
function renderTariffs(){
  const t = S('tariffs', defaultTariffs);
  el('tar_base').value = t.base ?? '';
  el('tar_region').value = t.region ?? '';
  el('tar_north').value = t.north ?? '';
  el('tar_class').value = t.klass ?? '';
  el('tar_zone').value = t.zone ?? '';
  el('tar_bam').value = t.bam ?? '';
  el('tar_comm').value = t.comm ?? '';
  el('tar_month_norm').value = t.monthNorm ?? '';
}
el('saveTariffsBtn').addEventListener('click', ()=>{
  const t = {
    base: Number(el('tar_base').value||0),
    region: Number(el('tar_region').value||0),
    north: Number(el('tar_north').value||0),
    klass: Number(el('tar_class').value||0),
    zone: Number(el('tar_zone').value||0),
    bam: Number(el('tar_bam').value||0),
    comm: Number(el('tar_comm').value||0),
    monthNorm: Number(el('tar_month_norm').value||176)
  };
  S('tariffs', t); alert('Сохранено'); renderDashboard();
});
el('resetTariffsBtn').addEventListener('click', ()=>{ S('tariffs', defaultTariffs); renderTariffs(); renderDashboard(); });

// ===== Refs =====
function renderRefs(){ el('refText').value = S('refsText','') || ''; }
el('saveRefsBtn').addEventListener('click', ()=>{ S('refsText', el('refText').value); alert('Сохранено'); });
el('clearRefsBtn').addEventListener('click', ()=>{ el('refText').value=''; S('refsText',''); });

// ===== Settings / DB Tools =====
document.getElementById('exportBtn').addEventListener('click', ()=>{
  const data = {trips:S('trips',[]), sections:S('sections',[]), tariffs:S('tariffs',defaultTariffs), refsText:S('refsText',''), goState:S('goState',null), normBasis:S('normBasis','calendar')};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='bloknot_2025_backup.json'; a.click(); URL.revokeObjectURL(url);
});
document.getElementById('importFile').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return; const r=new FileReader();
  r.onload = ev=>{ try{ const data = JSON.parse(ev.target.result); Object.entries(data).forEach(([k,v])=> S(k,v)); init(); alert('Импортировано'); }catch(err){ alert('Ошибка импорта: '+err.message); } };
  r.readAsText(file);
});
document.getElementById('backupBtn')?.addEventListener('click', ()=>{
  const data = {trips:S('trips',[]), sections:S('sections',[]), tariffs:S('tariffs',defaultTariffs), refsText:S('refsText',''), goState:S('goState',null), normBasis:S('normBasis','calendar')};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='bloknot_2025_full_backup.json'; a.click(); URL.revokeObjectURL(url);
});
document.getElementById('restoreFile')?.addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return; const r=new FileReader();
  r.onload = ev=>{ try{ const data = JSON.parse(ev.target.result); Object.entries(data).forEach(([k,v])=> S(k,v)); init(); alert('Восстановлено'); }catch(err){ alert('Ошибка восстановления: '+err.message); } };
  r.readAsText(file);
});
document.getElementById('clearDbBtn')?.addEventListener('click', ()=>{
  if(!confirm('Полностью очистить данные?')) return;
  localStorage.clear(); init(); alert('Готово. Данные стерты.');
});
document.getElementById('themeSelect').addEventListener('change', e=> applyTheme(e.target.value));
function applyTheme(v){
  if(v==='light'){
    document.documentElement.style.setProperty('--bg','#ffffff'); document.documentElement.style.setProperty('--fg','#0b0f14');
    document.documentElement.style.setProperty('--muted','#4c5566'); document.documentElement.style.setProperty('--card','#ffffffde'); document.documentElement.style.setProperty('--card2','#f6f7fb');
    document.documentElement.style.setProperty('--border','#e5e9f0'); document.documentElement.style.setProperty('--red','#c62828'); document.documentElement.style.setProperty('--red2','#ef5350');
  }else{
    document.documentElement.style.cssText=''; // reset to dark vars
  }
  S('theme', v);
}

// ===== Dashboard (days/months/payroll) =====
function renderDashboard(){
  refreshGo(); populateMonthsSelect();
  const q = (el('searchQuery').value||'').toLowerCase();
  const mf = el('filterMonth').value||'';
  const mode = el('filterMode').value||'';
  let trips = S('trips',[]).slice().sort((a,b)=> (b.date+a.start).localeCompare(a.date+b.start));
  if(q){
    trips = trips.filter(tr=> [tr.number,tr.loco,tr.from,tr.to,tr.notes].join(' ').toLowerCase().includes(q)
      || (S('sections',[]).find(s=>s.id===tr.sectionId)?.name||'').toLowerCase().includes(q));
  }
  if(mf){ trips = trips.filter(tr=> tr.date?.slice(0,7)===mf); }

  // Month widget (top of dashboard)
  const month = el('filterMonth').value || new Date().toISOString().slice(0,7);
  renderMonthWidget(month);

  if(mode){ trips = trips.filter(tr=> tr.mode===mode); }

  // Days
  const byDay = {}; trips.forEach(tr=>{ if(!byDay[tr.date]) byDay[tr.date]=[]; byDay[tr.date].push(tr); });
  const daysWrap = el('daysView'); daysWrap.innerHTML='';
  const dayKeys = Object.keys(byDay).sort((a,b)=> b.localeCompare(a));
  if(!dayKeys.length){ daysWrap.innerHTML = '<div class="muted">Нет поездок. Нажмите «+» чтобы добавить.</div>'; }
  dayKeys.forEach(d=>{
    const dayTrips = byDay[d];
    const worked = dayTrips.reduce((acc,x)=> acc + (x.workedMin||0), 0);
    const money = dayTrips.reduce((acc,x)=> acc + (x.money||0), 0);
    const energy = dayTrips.reduce((a,x)=> a + (x.energy||0), 0);
    const fuel = dayTrips.reduce((a,x)=> a + (x.fuel||0), 0);
    const card = document.createElement('div'); card.className='card';
    const title = `<div class="title">${fmtDate(d)} <span class="badge">Часы: ${fmtTime(worked)}</span> <span class="badge">ЗП: <b>${toMoney(money)} ₽</b></span></div>`;
    let list = '';
    dayTrips.forEach(tr=>{
      const sec = S('sections',[]).find(s=>s.id===tr.sectionId);
      const modeIcon = tr.mode==='electro' ? '⚡' : '⛽️';
      list += `<div class="list-row">
        <div style="flex:1">
          <div class="section-title">${modeIcon} ${sec?.name || (tr.from+' — '+tr.to)}</div>
          <div class="meta">Рабочее: ${tr.start||'—'} — ${tr.end||'—'} • ${fmtTime(tr.workedMin||0)}${tr.stopsMin? ' (− стоянки '+tr.stopsMin+' мин)':''}</div>
          <div class="meta">Э/э: ${tr.energy||0} • Топливо: ${tr.fuel||0}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px">
          <div class="money">${toMoney(tr.money||0)} ₽</div>
          <div><button class="btn" data-edit-trip="${tr.id}">Ред.</button></div>
        </div>
      </div><hr style="border:0;border-top:1px solid #1f2530">`;
    });
    card.innerHTML = title + list + `<div class="meta">За день: ⚡ ${energy} • ⛽ ${fuel}</div>`;
    daysWrap.appendChild(card);
  });

  
// Months
  const byMonth = {}; trips.forEach(tr=>{ const m = tr.date.slice(0,7); if(!byMonth[m]) byMonth[m]=[]; byMonth[m].push(tr); });
  const monthsWrap = el('monthsView'); monthsWrap.innerHTML='';
  const mKeys = Object.keys(byMonth).sort((a,b)=> b.localeCompare(a));
  mKeys.forEach(m=>{
    const arr = byMonth[m];
    const worked = arr.reduce((acc,x)=> acc + (x.workedMin||0), 0);
    const money = arr.reduce((acc,x)=> acc + (x.money||0), 0);
    const energy = arr.reduce((a,x)=> a + (x.energy||0), 0);
    const fuel = arr.reduce((a,x)=> a + (x.fuel||0), 0);
    const tarrLocal = S('tariffs',defaultTariffs);
    const normMin = (tarrLocal.monthNorm||0)*60;
    const percent = normMin? Math.round(worked / normMin * 100) : 0;
    const remain = normMin - worked;
    const remainText = remain>=0 ? ('Осталось: ' + fmtTime(remain)) : ('Переработка: ' + fmtTime(-remain));
    const card = document.createElement('div'); card.className='card';
    const mm = new Date(m+'-01'); const monthName = mm.toLocaleDateString('ru-RU',{month:'long', year:'numeric'});
    card.innerHTML = `<div class="title" style="margin-bottom:6px">${monthName} — ${fmtTime(worked)} / ${tarrLocal.monthNorm*1} ч</div>
      <div class="kv">
        <div>Месячная норма</div><div><b>${tarrLocal.monthNorm} ч</b></div>
        <div>Отработано часов</div><div><b>${fmtTime(worked)}</b></div>
        <div>Выполнено</div><div><b>${percent}%</b></div>
        <div>Осталось / Переработка</div><div><b>${remainText}</b></div>
        <div>Э/э (сумма)</div><div><b>${energy}</b></div>
        <div>Топливо (сумма)</div><div><b>${fuel}</b></div>
        <div>ЗП</div><div><b>${toMoney(money)} ₽</b></div>
      </div>`;
    monthsWrap.appendChild(card);
  });


  // Payroll (расчёт справки)
  const payWrap = el('payrollView'); payWrap.innerHTML='';
  const arr = trips.filter(t=> true); // already filtered by month/mode/search
  const bySec = {}; arr.forEach(t=>{ const name=(S('sections',[]).find(s=>s.id===t.sectionId)?.name) || (t.from+' — '+t.to); if(!bySec[name]) bySec[name]=[]; bySec[name].push(t); });
  const tarr = S('tariffs', defaultTariffs);
  const ksum = tarr.region + tarr.north + tarr.klass + tarr.zone + tarr.bam;
  const head = document.createElement('div'); head.className='card';
  const curMonth = (el('filterMonth').value || new Date().toISOString().slice(0,7));
  head.innerHTML = `<div class="title">Справка за ${curMonth} • Надбавки: ${ksum}% • Тариф: ${tarr.base} ₽/ч</div>`;
  payWrap.appendChild(head);
  Object.entries(bySec).sort((a,b)=> a[0].localeCompare(b[0])).forEach(([name,list])=>{
    const worked = list.reduce((acc,x)=> acc + (x.workedMin||0), 0);
    const money = list.reduce((acc,x)=> acc + (x.money||0), 0);
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<div class="title">${name}</div>
      <div class="kv">
        <div>Рейсов</div><div><b>${list.length}</b></div>
        <div>Часы</div><div><b>${fmtTime(worked)}</b></div>
        <div>Выплата</div><div><b>${toMoney(money)} ₽</b></div>
      </div>`;
    payWrap.appendChild(card);
  });

  daysWrap.querySelectorAll('button[data-edit-trip]').forEach(b=>b.addEventListener('click', ()=>{
    const id=Number(b.getAttribute('data-edit-trip')); openTripModal(S('trips',[]).find(x=>x.id===id));
  }));
}

// ===== Init =====
function init(){
  document.getElementById('themeSelect').value = S('theme','dark'); 
  applyTheme(S('theme','dark'));
  renderTariffs(); 
  renderSections(); 
  renderDashboard(); 
  renderRefs();
  console.log('Init 2025.9 — no auto-open section modal');
}
init();



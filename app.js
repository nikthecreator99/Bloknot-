// Простая логика приложения — хранение в localStorage
const STORAGE_KEY = "masnotebook.trips.v1";
const SETTINGS_KEY = "masnotebook.settings.v1";

function qs(sel){return document.querySelector(sel)}
function qsa(sel){return Array.from(document.querySelectorAll(sel))}

let trips = [];
let settings = {
  baseRate: 500,
  nightMultiplier: 1.5,
  overtimeThreshold: 8,
  overtimeMultiplier: 2
};

// UI elements
const form = qs("#trip-form");
const list = qs("#trip-list");
const tpl = qs("#trip-item-tpl");
const totalHoursEl = qs("#total-hours");
const totalPayEl = qs("#total-pay");

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(trips)); }
function load(){ const raw = localStorage.getItem(STORAGE_KEY); trips = raw? JSON.parse(raw): []; }
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function loadSettings(){ const raw = localStorage.getItem(SETTINGS_KEY); if(raw) settings = Object.assign(settings, JSON.parse(raw)); }

function formatRub(n){ return Math.round(n).toLocaleString("ru-RU") + " ₽"; }

function computePayForTrip(trip){
  // compute hours if times provided
  let hours = 0;
  if(trip.hours && trip.hours > 0) hours = +trip.hours;
  else if(trip.start && trip.end){
    // compute difference in hours; allow crossing midnight
    const [sh, sm] = trip.start.split(":").map(Number);
    const [eh, em] = trip.end.split(":").map(Number);
    let s = new Date(0,0,0,sh,sm,0), e = new Date(0,0,0,eh,em,0);
    let diff = (e - s) / 3600000;
    if(diff < 0) diff += 24;
    hours = Math.round(diff * 100) / 100;
  }
  trip.computedHours = hours;
  let rate = settings.baseRate || 0;
  let pay = 0;
  // simple rules:
  if(trip.shiftType === "night"){
    pay = hours * rate * (settings.nightMultiplier || 1);
  } else if(trip.shiftType === "overtime"){
    pay = hours * rate * (settings.overtimeMultiplier || 1);
  } else {
    // normal shift: split overtime if hours > threshold
    if(hours > (settings.overtimeThreshold || 8)){
      const regular = settings.overtimeThreshold || 8;
      pay = regular * rate + (hours - regular) * rate * (settings.overtimeMultiplier || 1);
    } else {
      pay = hours * rate;
    }
  }
  pay += Number(trip.bonus || 0);
  trip.computedPay = Math.round(pay*100)/100;
  return trip.computedPay;
}

function render(){
  list.innerHTML = "";
  let totalHours = 0, totalPay = 0;
  trips.forEach((t, idx) => {
    computePayForTrip(t);
    totalHours += Number(t.computedHours || 0);
    totalPay += Number(t.computedPay || 0);
    const node = tpl.content.cloneNode(true);
    const li = node.querySelector("li");
    li.dataset.index = idx;
    node.querySelector(".date").textContent = t.date || "";
    node.querySelector(".route").textContent = t.route || "";
    node.querySelector(".hours-val").textContent = (t.computedHours || 0) + " ч";
    node.querySelector(".pay-val").textContent = Number(t.computedPay || 0).toFixed(2);
    node.querySelector(".trip-note").textContent = t.note || "";
    node.querySelector(".edit").addEventListener("click", ()=> editTrip(idx));
    node.querySelector(".del").addEventListener("click", ()=> { if(confirm("Удалить запись?")){ trips.splice(idx,1); save(); render(); } });
    list.appendChild(node);
  });
  totalHoursEl.textContent = Math.round(totalHours*100)/100;
  totalPayEl.textContent = formatRub(totalPay);
  save();
}

function addTrip(obj){
  trips.unshift(obj);
  save();
  render();
}

form.addEventListener("submit", e=>{
  e.preventDefault();
  const data = {
    date: qs("#date").value,
    route: qs("#route").value,
    start: qs("#start").value,
    end: qs("#end").value,
    hours: qs("#hours").value,
    note: qs("#note").value,
    shiftType: qs("#shiftType").value,
    bonus: Number(qs("#bonus").value || 0)
  };
  addTrip(data);
  form.reset();
});

qs("#clear-form").addEventListener("click", ()=> form.reset());

// edit function: fill form with values and remove original
function editTrip(idx){
  const t = trips[idx];
  if(!t) return;
  qs("#date").value = t.date || "";
  qs("#route").value = t.route || "";
  qs("#start").value = t.start || "";
  qs("#end").value = t.end || "";
  qs("#hours").value = t.hours || "";
  qs("#note").value = t.note || "";
  qs("#shiftType").value = t.shiftType || "normal";
  qs("#bonus").value = t.bonus || 0;
  // remove original
  trips.splice(idx,1);
  save();
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}

// export CSV
function tripsToCSV(items){
  const header = ["date","route","start","end","hours","shiftType","bonus","note","computedHours","computedPay"];
  const rows = items.map(t => header.map(h => JSON.stringify(t[h] ?? "") ).join(","));
  return header.join(",") + "\n" + rows.join("\n");
}

qs("#export-csv").addEventListener("click", ()=>{
  const csv = tripsToCSV(trips);
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "masnotebook_trips.csv"; a.click();
  URL.revokeObjectURL(url);
});

// JSON export/import
qs("#export-json").addEventListener("click", ()=>{
  const payload = { trips, settings, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "masnotebook_backup.json"; a.click();
  URL.revokeObjectURL(url);
});

qs("#import-json").addEventListener("click", ()=> qs("#json-file").click());
qs("#json-file").addEventListener("change", e=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      if(Array.isArray(obj.trips)) trips = obj.trips.concat(trips);
      else if(Array.isArray(obj)) trips = obj.concat(trips);
      if(obj.settings) settings = Object.assign(settings, obj.settings);
      save(); saveSettings(); render(); alert("Импортировано");
    }catch(err){ alert("Ошибка при разборе файла"); }
  };
  reader.readAsText(f);
});

qs("#reset-all").addEventListener("click", ()=>{
  if(confirm("Удалить все записи и настройки?")){ trips=[]; settings = {baseRate:500,nightMultiplier:1.5,overtimeThreshold:8,overtimeMultiplier:2}; save(); saveSettings(); render(); alert("Удалено"); }
});

// settings modal
const settingsModal = qs("#settings-modal");
qs("#btn-settings").addEventListener("click", ()=>{
  qs("#baseRate").value = settings.baseRate;
  qs("#nightMultiplier").value = settings.nightMultiplier;
  qs("#overtimeThreshold").value = settings.overtimeThreshold;
  qs("#overtimeMultiplier").value = settings.overtimeMultiplier;
  settingsModal.showModal();
});
qs("#close-settings").addEventListener("click", ()=> settingsModal.close());
qs("#save-settings").addEventListener("click", ()=>{
  settings.baseRate = Number(qs("#baseRate").value) || settings.baseRate;
  settings.nightMultiplier = Number(qs("#nightMultiplier").value) || settings.nightMultiplier;
  settings.overtimeThreshold = Number(qs("#overtimeThreshold").value) || settings.overtimeThreshold;
  settings.overtimeMultiplier = Number(qs("#overtimeMultiplier").value) || settings.overtimeMultiplier;
  saveSettings();
  settingsModal.close();
  render();
});

// init
loadSettings();
load();
render();

// register basic service worker for offline (if available)
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{/*ignore*/});
}

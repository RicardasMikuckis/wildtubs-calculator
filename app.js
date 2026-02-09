
async function loadJson(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Nepavyko užkrauti ${url}: ${res.status}`);
  return await res.json();
}

function eur(x){
  return new Intl.NumberFormat('lt-LT', { style:'currency', currency:'EUR' }).format(x || 0);
}

function groupBy(arr, keyFn){
  const m = new Map();
  for(const it of arr){
    const k = keyFn(it);
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

function normalizeCode(code){ return String(code||'').trim(); }

function buildMaterialsMap(materials){
  const m = new Map();
  for(const it of materials){
    m.set(normalizeCode(it.code), it);
  }
  return m;
}

function sumItems(items){
  const m = new Map();
  for(const it of items){
    const code = normalizeCode(it.code);
    const prev = m.get(code) || { code, qty: 0, unit: it.unit || "" };
    prev.qty += Number(it.qty||0);
    m.set(code, prev);
  }
  return Array.from(m.values());
}

async function init(productKind){
  const base = './data/';
  const materialsDb = await loadJson(base + 'materials.json');
  const assembliesDb = await loadJson(base + (productKind === 'kubilai' ? 'assemblies_kubilai.json' : 'assemblies_pirtys.json'));

  const materialsMap = buildMaterialsMap(materialsDb.materials || []);
  const assemblies = assembliesDb.assemblies || [];

  const sectionsMap = groupBy(assemblies, a => a.section);
  const sections = Array.from(sectionsMap.keys());

  const optionsRoot = document.getElementById('options');
  const selects = [];
  for(const section of sections){
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML = '<div class="card-title">'+section+'</div>';
    const sel = document.createElement('select');
    sel.dataset.section = section;
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— pasirinkti —';
    sel.appendChild(empty);

    sectionsMap.get(section).forEach(o=>{
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);
    optionsRoot.appendChild(wrap);
    selects.push(sel);
  }

  document.getElementById('laborRate').value = materialsDb.defaults?.labor_rate_eur_per_hour ?? 0;

  function recompute(){
    const chosen = selects.map(s=>s.value).filter(Boolean);
    const chosenAssemblies = chosen.map(id => assemblies.find(a=>a.id===id)).filter(Boolean);
    const allItems = chosenAssemblies.flatMap(a=>a.items || []);
    const summed = sumItems(allItems);

    let laborHours = 0;
    let materialsCost = 0;

    for(const line of summed){
      if(line.code.toUpperCase().startsWith('DU')){
        laborHours += line.qty;
      }else{
        const mat = materialsMap.get(line.code);
        const unitCost = mat ? Number(mat.cost_eur||0) : 0;
        materialsCost += unitCost * Number(line.qty||0);
      }
    }

    const laborRate = Number(document.getElementById('laborRate').value || 0);
    const laborCost = laborHours * laborRate;
    const totalCost = materialsCost + laborCost;

    document.getElementById('materialsCost').textContent = eur(materialsCost);
    document.getElementById('laborHours').textContent = laborHours.toFixed(2);
    document.getElementById('laborCost').textContent = eur(laborCost);
    document.getElementById('totalCost').textContent = eur(totalCost);
  }

  selects.forEach(s=>s.addEventListener('change', recompute));
  document.getElementById('laborRate').addEventListener('input', recompute);
  recompute();

  function getState(){
    return {
      laborRate: document.getElementById('laborRate').value,
      selections: selects.map(s => ({ section: s.dataset.section, value: s.value }))
    };
  }

  function setState(state){
    if(!state) return;
    if(state.laborRate != null) document.getElementById('laborRate').value = state.laborRate;
    const bySection = new Map((state.selections || []).map(x => [x.section, x.value]));
    selects.forEach(s => {
      const v = bySection.get(s.dataset.section);
      if(v != null) s.value = v;
    });
    recompute();
  }

  return { getState, setState };
}

window.WILDTUBS_INIT_SINGLE = async function(){
  const kindSelect = document.getElementById('productKind');
  const stateByKind = { kubilai:null, pirtys:null };
  let currentKind = kindSelect.value;
  let controller = null;

  async function load(kind){
    if(controller && currentKind){
      stateByKind[currentKind] = controller.getState();
    }
    document.getElementById('options').innerHTML = '';
    controller = await init(kind);
    controller.setState(stateByKind[kind]);
    currentKind = kind;
  }

  kindSelect.addEventListener('change', () => load(kindSelect.value));
  await load(currentKind);
};

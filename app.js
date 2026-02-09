
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
    if(!prev.unit && it.unit) prev.unit = it.unit;
    m.set(code, prev);
  }
  return Array.from(m.values());
}

function makeOptionGroup(section, options){
  const wrap = document.createElement('div');
  wrap.className = 'card';
  const h = document.createElement('div');
  h.className = 'card-title';
  h.textContent = section;
  wrap.appendChild(h);

  const sel = document.createElement('select');
  sel.dataset.section = section;
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '— pasirinkti —';
  sel.appendChild(empty);

  options.forEach(o=>{
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.name;
    sel.appendChild(opt);
  });
  wrap.appendChild(sel);
  return { wrap, sel };
}

async function init(productKind){
  const base = '../data/';
  const [materialsDb, assembliesDb] = await Promise.all([
    loadJson(base + 'materials.json'),
    loadJson(base + (productKind === 'kubilai' ? 'assemblies_kubilai.json' : 'assemblies_pirtys.json'))
  ]);

  const materialsMap = buildMaterialsMap(materialsDb.materials || []);
  const assemblies = assembliesDb.assemblies || [];

  // group by section
  const sectionsMap = groupBy(assemblies, a => a.section);
  const sections = Array.from(sectionsMap.keys()).sort((a,b)=>a.localeCompare(b,'lt'));

  const optionsRoot = document.getElementById('options');
  const selects = [];
  for(const section of sections){
    const opts = sectionsMap.get(section).slice().sort((a,b)=>a.name.localeCompare(b.name,'lt'));
    const { wrap, sel } = makeOptionGroup(section, opts);
    optionsRoot.appendChild(wrap);
    selects.push(sel);
  }

  // defaults
  const laborRateInput = document.getElementById('laborRate');
  laborRateInput.value = (materialsDb.defaults?.labor_rate_eur_per_hour ?? 0).toString();

  function recompute(){
    const chosen = selects.map(s=>s.value).filter(Boolean);
    const chosenAssemblies = chosen.map(id => assemblies.find(a=>a.id===id)).filter(Boolean);

    // combine all items
    const allItems = chosenAssemblies.flatMap(a=>a.items || []);
    const summed = sumItems(allItems);

    // split labor (DU...) and materials
    let laborHours = 0;
    const matLines = [];
    const laborLines = [];

    for(const line of summed){
      if(line.code.toUpperCase().startsWith('DU')){
        laborHours += line.qty;
        laborLines.push(line);
      }else{
        matLines.push(line);
      }
    }

    // cost calc
    let materialsCost = 0;
    const detailed = matLines.map(line=>{
      const mat = materialsMap.get(line.code);
      const unitCost = mat ? Number(mat.cost_eur||0) : 0;
      const lineCost = unitCost * Number(line.qty||0);
      materialsCost += lineCost;
      return { ...line, name: mat?.name || '— nerasta žaliavų DB —', unit_cost: unitCost, line_cost: lineCost };
    });

    const laborRate = Number(laborRateInput.value || 0);
    const laborCost = laborHours * laborRate;
    const totalCost = materialsCost + laborCost;

    // render
    document.getElementById('summaryChosen').textContent = chosenAssemblies.length ? chosenAssemblies.map(a=>a.name).join(', ') : '—';
    document.getElementById('materialsCost').textContent = eur(materialsCost);
    document.getElementById('laborHours').textContent = (Math.round(laborHours*100)/100).toString();
    document.getElementById('laborCost').textContent = eur(laborCost);
    document.getElementById('totalCost').textContent = eur(totalCost);

    const tbody = document.querySelector('#bom tbody');
    tbody.innerHTML = '';
    detailed.sort((a,b)=>a.code.localeCompare(b.code)).forEach(d=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.code}</td>
        <td>${d.name}</td>
        <td class="num">${d.qty}</td>
        <td>${d.unit||''}</td>
        <td class="num">${eur(d.unit_cost)}</td>
        <td class="num">${eur(d.line_cost)}</td>
      `;
      tbody.appendChild(tr);
    });

    const laborTbody = document.querySelector('#labor tbody');
    laborTbody.innerHTML = '';
    laborLines.sort((a,b)=>a.code.localeCompare(b.code)).forEach(l=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${l.code}</td>
        <td class="num">${l.qty}</td>
        <td>${l.unit||'val'}</td>
      `;
      laborTbody.appendChild(tr);
    });

    // offer preview block
    document.getElementById('offerPreview').value =
`PASIŪLYMAS (juodraštis)
Produktas: ${productKind.toUpperCase()}
Pasirinkimai: ${chosenAssemblies.map(a=>a.name).join(', ')}

Savikaina:
- Žaliavos: ${eur(materialsCost)}
- Darbas (${Math.round(laborHours*100)/100} val x ${eur(laborRate)}): ${eur(laborCost)}
Bendra savikaina: ${eur(totalCost)}
`;
  }

  selects.forEach(s=>s.addEventListener('change', recompute));
  laborRateInput.addEventListener('input', recompute);

  document.getElementById('printBtn').addEventListener('click', ()=>window.print());

  recompute();
}

window.WILDTUBS_INIT = init;

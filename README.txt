# Wildtubs HTML skaičiuoklės prototipas

## Kas yra viduje
- data/materials.json – žaliavos DB iš „Medžiagos“ lapo (žaliavų kainos)
- data/assemblies_kubilai.json – kubilų komplektacijos iš komponentų lapų
- data/assemblies_pirtys.json – pirčių komplektacijos iš komponentų lapų
- kubilai/index.html – kubilų konfigūratorius (prototipas)
- pirtys/index.html – pirčių konfigūratorius (prototipas)

## Kaip paleisti
Reikia paprasto HTTP serverio (nes `fetch()` neleidžia atidaryti JSON per file://).

Pavyzdys su Python:
python -m http.server 8000

Tada atidaryk:
http://localhost:8000/wildtubs_html_calc/kubilai/
http://localhost:8000/wildtubs_html_calc/pirtys/

## Pastabos
- Darbo valandos skaičiuojamos iš DUxxxx kodų, jei jie yra BOM.
- Darbo įkainis paimtas iš „Darbas“ lapo (per valanda -> bendra su sodra = 8.77 EUR/val) kaip default.

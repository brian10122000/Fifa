const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
let data = null, timer = null;

async function load(force = false) {
  $("#ico").classList.add("spin");
  const b = Number($("#budget").value) || 0;
  try {
    const r = await fetch(`/api/market?budget=${b}${force ? "&refresh=1" : ""}`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    data = await r.json();
    render();
  } catch (e) {
    $("#meta").textContent = "Impossible de joindre le serveur. Vérifie qu'il tourne (npm start).";
  } finally {
    $("#ico").classList.remove("spin");
  }
}

function liqBadge(d) {
  const c = d.liquidityScore >= 85 ? "var(--gain)" : d.liquidityScore >= 70 ? "var(--gold)" : "var(--muted)";
  return `<span class="inline-flex items-center gap-2"><span class="w-16 h-1.5 rounded-full inline-block" style="background:var(--line)"><span class="block h-full rounded-full" style="width:${d.liquidityScore}%;background:${c}"></span></span>${d.liquidity}</span>`;
}

function render() {
  const t = new Date(data.updatedAt).toLocaleTimeString("fr-FR");
  $("#meta").textContent = `${data.platform} · données ${data.source} · maj ${t}`;

  const rows = data.deals.map((d) => `
    <tr class="border-t" style="border-color:var(--line)">
      <td class="px-4 py-3"><div class="font-semibold">${d.name}</div><div class="text-xs" style="color:var(--muted)">${d.pos} · ${d.style}</div></td>
      <td class="px-3 py-3 head text-2xl" style="color:var(--gold)">${d.rating}</td>
      <td class="px-3 py-3 num text-right">${fmt(d.buyNow)}</td>
      <td class="px-3 py-3 num text-right" style="color:var(--muted)">${fmt(d.maxBuy)}</td>
      <td class="px-3 py-3 num text-right">${fmt(d.resale)}</td>
      <td class="px-3 py-3 num text-right font-semibold" style="color:var(--gain)">+${fmt(d.net)}</td>
      <td class="px-3 py-3 num text-right">${d.roi.toFixed(1)} %</td>
      <td class="px-4 py-3 text-sm">${liqBadge(d)}</td>
    </tr>`).join("");

  $("#deals").innerHTML = rows ? `
    <table class="w-full text-sm min-w-[820px]">
      <thead><tr class="text-left" style="color:var(--muted)">
        <th class="px-4 py-3 font-medium">Joueur</th><th class="px-3 font-medium">Note</th>
        <th class="px-3 font-medium text-right">Prix actuel</th><th class="px-3 font-medium text-right">Achat max conseillé</th>
        <th class="px-3 font-medium text-right">Revente estimée</th><th class="px-3 font-medium text-right">Marge nette</th>
        <th class="px-3 font-medium text-right">ROI</th><th class="px-4 font-medium">Liquidité</th>
      </tr></thead><tbody>${rows}</tbody></table>`
    : `<p class="p-6" style="color:var(--muted)">Aucune carte rentable dans ce budget. Augmente le budget ou actualise.</p>`;

  const spark = (h) => {
    const min = Math.min(...h), max = Math.max(...h), w = 120, hgt = 32;
    const pts = h.map((v, i) => `${(i / (h.length - 1 || 1)) * w},${hgt - ((v - min) / (max - min || 1)) * hgt}`).join(" ");
    return `<svg width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}"><polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="2"/></svg>`;
  };
  $("#fodder").innerHTML = data.fodder.length ? data.fodder.map((f) => `
    <article class="panel rounded-lg p-4" style="${f.alert ? "border-color:var(--gain)" : ""}">
      <div class="flex justify-between items-start">
        <h3 class="head text-2xl">${f.label}</h3>
        ${f.alert ? `<span class="text-xs font-semibold px-2 py-1 rounded" style="background:var(--gain);color:#06210f">Sous le plancher</span>` : ""}
      </div>
      <p class="num text-3xl head mt-2">${fmt(f.price)} <span class="text-sm" style="color:var(--muted)">coins</span></p>
      <p class="text-sm mt-1" style="color:var(--muted)">Plancher habituel ${fmt(f.floor)} · <span style="color:${f.vsFloor <= 3 ? "var(--gain)" : "var(--text)"}">${f.vsFloor > 0 ? "+" : ""}${f.vsFloor} %</span></p>
      <div class="flex items-end justify-between mt-3">${spark(f.history)}
        <p class="text-sm text-right num" style="color:var(--muted)">Si retour à la moyenne<br><b style="color:${f.potentialNet > 0 ? "var(--gain)" : "var(--loss)"}">${f.potentialNet > 0 ? "+" : ""}${fmt(f.potentialNet)} (${f.potentialRoi} %)</b></p>
      </div>
    </article>`).join("") : `<p style="color:var(--muted)">Aucune note fodder dans ce budget.</p>`;
}

function tab(name) {
  for (const k of ["deals", "fodder"]) {
    $("#" + k).classList.toggle("hidden", k !== name); if (k === "fodder") $("#fodder").classList.toggle("grid", name === "fodder");
    $("#t-" + k).setAttribute("aria-selected", k === name);
  }
}
$("#t-deals").onclick = () => tab("deals");
$("#t-fodder").onclick = () => tab("fodder");
$("#refresh").onclick = () => load(true);
$("#budget").oninput = () => { clearTimeout(timer); timer = setTimeout(() => load(false), 300); };
setInterval(() => load(false), 30000);
tab("deals"); load();

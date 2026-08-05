// src/handleiding.ts
var searchEl = document.getElementById("manual-search");
var metaEl = document.getElementById("manual-search-meta");
var emptyEl = document.getElementById("manual-empty");
var tocEl = document.getElementById("manual-toc");
var sections = [...document.querySelectorAll("[data-manual-section]")];
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
}
function clearMarks(root) {
  for (const mark of root.querySelectorAll("mark.manual-hit")) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
    parent.normalize();
  }
}
function highlightTextNodes(root, query) {
  if (!query) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") return NodeFilter.FILTER_REJECT;
      if (!node.textContent || !normalize(node.textContent).includes(query)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let n = walker.nextNode();
  while (n) {
    nodes.push(n);
    n = walker.nextNode();
  }
  let hits = 0;
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  for (const textNode of nodes) {
    const text = textNode.textContent || "";
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while (m = re.exec(text)) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const mark = document.createElement("mark");
      mark.className = "manual-hit";
      mark.textContent = m[0];
      frag.appendChild(mark);
      hits += 1;
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
  return hits;
}
function applySearch(raw) {
  const q = normalize(raw);
  let visible = 0;
  let hits = 0;
  for (const section of sections) {
    clearMarks(section);
    const hay = normalize(section.textContent || "");
    const match = !q || hay.includes(q);
    section.classList.toggle("manual-section-hidden", !match);
    section.classList.toggle("manual-section-match", Boolean(q && match));
    if (match) {
      visible += 1;
      if (q) hits += highlightTextNodes(section, q);
    }
  }
  if (tocEl) {
    for (const a of tocEl.querySelectorAll("a[href^='#']")) {
      const id = a.getAttribute("href")?.slice(1);
      const sec = id ? document.getElementById(id) : null;
      const show = !sec || !sec.classList.contains("manual-section-hidden");
      a.parentElement?.classList.toggle("manual-toc-hidden", !show);
    }
  }
  if (metaEl) {
    if (!q) metaEl.textContent = "";
    else if (visible === 0) metaEl.textContent = "0 onderdelen";
    else metaEl.textContent = `${visible} onderde${visible === 1 ? "el" : "len"} \xB7 ${hits} treffe${hits === 1 ? "r" : "rs"}`;
  }
  emptyEl?.classList.toggle("hidden", !(q && visible === 0));
}
function setActiveToc() {
  if (!tocEl) return;
  const links = [...tocEl.querySelectorAll("a[href^='#']")];
  let current = "";
  for (const section of sections) {
    if (section.classList.contains("manual-section-hidden")) continue;
    const top = section.getBoundingClientRect().top;
    if (top <= 96) current = section.id;
  }
  for (const a of links) {
    const id = a.getAttribute("href")?.slice(1);
    a.classList.toggle("manual-toc-active", Boolean(current && id === current));
  }
}
searchEl?.addEventListener("input", () => applySearch(searchEl.value));
searchEl?.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    searchEl.value = "";
    applySearch("");
    searchEl.blur();
  }
});
window.addEventListener("scroll", () => setActiveToc(), { passive: true });
tocEl?.addEventListener("click", (ev) => {
  const a = ev.target.closest("a[href^='#']");
  if (!a) return;
  setTimeout(setActiveToc, 50);
});
var params = new URLSearchParams(location.search);
var qParam = params.get("q");
if (qParam && searchEl) {
  searchEl.value = qParam;
  applySearch(qParam);
} else {
  applySearch("");
}
setActiveToc();
var hash = location.hash.slice(1);
if (hash) {
  document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

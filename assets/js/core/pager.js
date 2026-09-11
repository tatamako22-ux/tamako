export function renderPager(container, page, total, pageSize, onPage) {
  container.hidden = false;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  container.replaceChildren();
  container.style.cssText = "display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;padding:20px;color:#ddd";
  const previous = document.createElement("button");
  const next = document.createElement("button");
  const label = document.createElement("span");
  previous.textContent = "Anterior";
  next.textContent = "Siguiente";
  for (const button of [previous, next]) {
    button.type = "button";
    button.style.cssText = "min-height:44px;padding:10px 18px;background:#161616;color:#ffd277;border:1px solid #777;border-radius:8px;cursor:pointer";
  }
  previous.disabled = page === 0;
  next.disabled = page + 1 >= pages;
  previous.addEventListener("click", () => onPage(page - 1));
  next.addEventListener("click", () => onPage(page + 1));
  label.textContent = `${total} resultados · Página ${page + 1} de ${pages}`;
  label.setAttribute("aria-live", "polite");
  container.append(previous, label, next);
}

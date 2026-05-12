export function toggleModal(id, estado) {
  const el = document.getElementById(id);
  el.style.display = estado ? "flex" : "none";
}

(() => {
  const byId = id => document.getElementById(id);
  const notices = byId('notices-panel'), panel = byId('tasks-panel');
  const noticesButton = byId('view-notices'), tasksButton = byId('view-tasks');
  function switchView(tasks) {
    notices.hidden = tasks; panel.hidden = !tasks;
    noticesButton.setAttribute('aria-pressed',String(!tasks));
    tasksButton.setAttribute('aria-pressed',String(tasks));
  }
  noticesButton.addEventListener('click',() => switchView(false));
  tasksButton.addEventListener('click',() => switchView(true));
  const key = 'macarena.ventas.tasks.v1';
  let tasks = [], filter = 'all', storageReady = true;
  const feedback = text => {byId('task-status').textContent = text;};
  function readTasks(raw) {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed) || parsed.length > 1000 || parsed.some(t => !t || typeof t.id !== 'string' || typeof t.text !== 'string' || !t.text.trim() || t.text.length > 300 || typeof t.done !== 'boolean') || new Set(parsed.map(t=>t.id)).size !== parsed.length) throw new Error('Formato inválido');
    return parsed;
  }
  try { tasks = readTasks(localStorage.getItem(key)); }
  catch (_) {storageReady = false; feedback('No se pudieron leer las tareas guardadas. Puedes usar la repisa durante esta sesión; los datos anteriores no se sobrescribirán.');}
  function save(next) {
    if (storageReady) {
      try {localStorage.setItem(key,JSON.stringify(next)); feedback('Guardado en este navegador.');}
      catch (_) {feedback('No se pudo guardar. Este cambio se conservará solo mientras la página esté abierta.');}
    }
    tasks = next; render();
  }
  function render() {
    const list = byId('task-list'); list.replaceChildren();
    const completed = tasks.filter(t=>t.done).length;
    byId('task-summary').textContent = `${completed} de ${tasks.length} completadas · ${tasks.length-completed} pendientes`;
    byId('task-progress').max = Math.max(tasks.length,1); byId('task-progress').value = completed;
    const visible = tasks.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
    visible.forEach(task => {
      const li = document.createElement('li'); li.className = 'task-note' + (task.done ? ' is-done' : '');
      const label = document.createElement('label');
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = task.done;
      check.setAttribute('aria-label',(task.done ? 'Marcar pendiente: ' : 'Completar: ') + task.text);
      const text = document.createElement('span'); text.textContent = task.text;
      const state = document.createElement('small'); state.textContent = task.done ? '✓ Completada' : 'POR HACER';
      check.addEventListener('change',() => {
        const checked = check.checked;
        save(tasks.map(t=>t.id === task.id ? {...t,done:checked} : t));
        const remaining = [...list.querySelectorAll('input')];
        const current = remaining.find(input=>input.dataset.taskId === task.id);
        (current || remaining[0] || byId('task-input')).focus();
      });
      check.dataset.taskId = task.id;
      label.append(check,text); li.append(state,label); list.append(li);
    });
    byId('task-empty').hidden = visible.length > 0;
    byId('task-empty').textContent = tasks.length === 0 ? 'Tu repisa está lista. Agrega tu primera tarea.' : filter === 'pending' ? '¡Todo al día! No tienes pendientes.' : 'No hay tareas en esta vista.';
  }
  byId('task-form').addEventListener('submit',event => {
    event.preventDefault(); const input = byId('task-input'), text = input.value.trim();
    if (!text) {input.setCustomValidity('Escribe una tarea.'); input.reportValidity(); return;}
    if (tasks.length >= 1000) {feedback('La repisa alcanzó el límite de 1.000 tareas.'); return;}
    const id = globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    filter = 'all'; updateFilters(); save([...tasks,{id,text,done:false}]); input.value = ''; input.focus();
  });
  byId('task-input').addEventListener('input',event=>event.target.setCustomValidity(''));
  function updateFilters() {document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter === filter)));}
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter = button.dataset.filter; updateFilters(); render();}));
  window.addEventListener('storage',event=>{
    if (event.key !== key && event.key !== null) return;
    try {tasks = readTasks(event.key === null ? null : event.newValue); render(); feedback('Tareas actualizadas desde otra pestaña.');}
    catch (_) {feedback('No se pudo leer el cambio de otra pestaña.');}
  });
  render();
})();

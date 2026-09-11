(() => {
  if (window.TamakuUI?.version === 2) return;
  const icons = { success: '✓', error: '×', warning: '!', info: 'i' };
  const titles = { success: 'Todo listo', error: 'No pudimos completar la acción', warning: 'Revisa esta información', info: 'Información' };
  const inferType = message => /error|no se pud|no pud|incorrect|inválid|problema|falló/i.test(message) ? 'error'
    : /éxito|correctamente|guardad|cread|copiad|actualizad|enviado/i.test(message) ? 'success'
    : /por favor|selecciona|completa|debe|primero|ya existe/i.test(message) ? 'warning' : 'info';
  const ready = () => document.body ? Promise.resolve() : new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  let dialogQueue = Promise.resolve();
  let sequence = 0;

  function notify(message, type = inferType(String(message)), options = {}) {
    if (!document.body) {
      let result, cancelled = false;
      ready().then(() => { if (!cancelled) result = notify(message, type, options); });
      return { cerrar() { cancelled = true; result?.cerrar(); } };
    }
    if (!icons[type]) type = 'info';
    let stack = document.getElementById('tamakuToastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'tamakuToastStack'; stack.className = 'tamaku-toast-stack';
      stack.setAttribute('aria-label', 'Notificaciones de Tamaku');
      document.body.append(stack);
    }
    while (stack.children.length >= 4) stack.firstElementChild.dismiss();
    const toast = document.createElement('div');
    toast.className = `tamaku-toast tamaku-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = '<div class="tamaku-toast-icon" aria-hidden="true"><span></span></div><div class="tamaku-toast-copy"><strong></strong><p></p></div><button type="button" class="tamaku-toast-close" aria-label="Cerrar notificación">×</button><span class="tamaku-toast-progress" aria-hidden="true"></span>';
    toast.querySelector('.tamaku-toast-icon span').textContent = icons[type];
    toast.querySelector('strong').textContent = options.titulo || titles[type];
    toast.querySelector('p').textContent = String(message ?? '');
    const duration = options.duracion ?? (type === 'error' ? 8500 : 5500);
    let remaining = duration, started, timer, closed = false;
    const bar = toast.querySelector('.tamaku-toast-progress');
    bar.style.animationDuration = `${duration}ms`;
    const close = () => {
      if (closed) return;
      closed = true; clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
      toast.remove();
    };
    const pause = () => {
      if (timer) remaining = Math.max(0, remaining - (Date.now() - started));
      clearTimeout(timer); timer = null; bar.style.animationPlayState = 'paused';
    };
    let hovered = false;
    const resume = () => {
      if (closed || duration <= 0 || document.hidden || hovered || toast.contains(document.activeElement)) return;
      clearTimeout(timer); started = Date.now(); timer = setTimeout(close, remaining);
      bar.style.animationPlayState = 'running';
    };
    const visibility = () => document.hidden ? pause() : resume();
    toast.dismiss = close;
    toast.querySelector('button').addEventListener('click', close);
    toast.addEventListener('mouseenter', () => { hovered = true; pause(); });
    toast.addEventListener('mouseleave', () => { hovered = false; resume(); });
    toast.addEventListener('focusin', pause);
    toast.addEventListener('focusout', () => setTimeout(resume, 0));
    document.addEventListener('visibilitychange', visibility);
    if (duration <= 0) bar.hidden = true;
    stack.append(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    resume();
    return { cerrar: close, elemento: toast };
  }

  function dialog(mode, value = {}, initialValue = '') {
    const options = typeof value === 'string' ? { mensaje: value, valorInicial: initialValue } : value || {};
    const run = async () => {
      await ready();
      return new Promise(resolve => {
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const id = `tamaku-dialog-${++sequence}`;
        const danger = options.peligro ?? /eliminar|borrar|suspender|apagar/i.test(options.mensaje || '');
        const overlay = document.createElement('div');
        overlay.className = 'tamaku-confirm-overlay';
        overlay.innerHTML = `<form class="tamaku-confirm-card" novalidate role="dialog" aria-modal="true" aria-labelledby="${id}-title" aria-describedby="${id}-message">
          <div class="tamaku-confirm-icon ${danger ? 'danger' : ''}" aria-hidden="true">${mode === 'prompt' ? '✎' : danger ? '!' : '✦'}</div>
          <span class="tamaku-confirm-eyebrow">TAMAKU</span><h2 id="${id}-title"></h2><p id="${id}-message"></p>
          <div class="tamaku-confirm-field" hidden><label></label><input><p class="tamaku-confirm-error" role="alert" hidden></p></div>
          <div class="tamaku-confirm-actions"><button type="button" class="tamaku-confirm-cancel"></button><button type="submit" class="tamaku-confirm-accept ${danger ? 'danger' : ''}"></button></div>
        </form>`;
        const form = overlay.querySelector('form'), cancel = overlay.querySelector('.tamaku-confirm-cancel'), accept = overlay.querySelector('.tamaku-confirm-accept');
        overlay.querySelector('h2').textContent = options.titulo || (mode === 'prompt' ? 'Completa la información' : mode === 'alert' ? 'Información importante' : '¿Confirmar acción?');
        overlay.querySelector(`#${id}-message`).textContent = options.mensaje || '';
        cancel.textContent = options.textoCancelar || 'Cancelar';
        accept.textContent = options.textoConfirmar || (mode === 'alert' ? 'Entendido' : mode === 'prompt' ? 'Guardar' : 'Confirmar');
        let input = overlay.querySelector('input');
        const field = overlay.querySelector('.tamaku-confirm-field');
        const error = overlay.querySelector('.tamaku-confirm-error');
        if (mode === 'prompt') {
          field.hidden = false;
          input.id = `${id}-input`;
          field.querySelector('label').textContent = options.etiqueta || 'Tu respuesta';
          field.querySelector('label').htmlFor = input.id;
          input.type = options.tipo === 'number' ? 'number' : 'text';
          input.value = options.valorInicial ?? '';
          input.autocomplete = 'off';
          if (options.min !== undefined) input.min = options.min;
          if (options.max !== undefined) input.max = options.max;
          if (options.paso !== undefined) input.step = options.paso;
          input.setAttribute('aria-describedby', `${id}-error`); error.id = `${id}-error`;
        }
        if (mode === 'alert') { cancel.hidden = true; form.classList.add('is-acknowledgement'); }
        const background = [...document.body.children].map(element => ({ element, inert: element.inert }));
        background.forEach(({ element }) => { element.inert = true; });
        document.body.style.overflow = 'hidden';
        let resolved = false;
        const finish = result => {
          if (resolved) return;
          resolved = true;
          document.removeEventListener('keydown', keyboard, true);
          document.removeEventListener('focusin', focusGuard, true);
          overlay.remove();
          background.forEach(({ element, inert }) => { element.inert = inert; });
          document.body.style.overflow = previousOverflow;
          if (previousFocus?.isConnected) previousFocus.focus();
          resolve(result);
        };
        const dismiss = () => finish(mode === 'prompt' ? null : mode === 'alert');
        const submit = () => {
          if (mode !== 'prompt') return finish(true);
          let issue = '';
          if (options.requerido && !input.value.trim()) issue = 'Completa este campo para continuar.';
          else if (options.tipo === 'number' && (!input.value.trim() || !Number.isFinite(Number(input.value)))) issue = 'Escribe un número válido.';
          else if (options.min !== undefined && Number(input.value) < options.min) issue = `El valor mínimo es ${options.min}.`;
          else if (options.max !== undefined && Number(input.value) > options.max) issue = `El valor máximo es ${options.max}.`;
          else if (options.paso === 1 && !Number.isInteger(Number(input.value))) issue = 'Escribe un número entero.';
          else if (options.validar) issue = options.validar(input.value) || '';
          error.textContent = issue; error.hidden = !issue;
          input.setAttribute('aria-invalid', String(Boolean(issue)));
          if (issue) return input.focus();
          finish(input.value);
        };
        const focusables = () => [...form.querySelectorAll('input,button')].filter(el => !el.hidden && !el.disabled && (el !== input || mode === 'prompt'));
        const keyboard = event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); dismiss(); }
          if (event.key === 'Tab') {
            const list = focusables(), first = list[0], last = list[list.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            event.stopPropagation();
          }
          if (event.key === 'Enter') {
            event.stopImmediatePropagation();
            if (event.target === input && mode === 'prompt' && !event.isComposing) { event.preventDefault(); submit(); }
          }
        };
        const firstFocus = mode === 'prompt' ? input : mode === 'alert' ? accept : cancel;
        const focusGuard = event => { if (!overlay.contains(event.target)) firstFocus.focus(); };
        form.addEventListener('submit', event => { event.preventDefault(); submit(); });
        cancel.addEventListener('click', dismiss);
        overlay.addEventListener('click', event => { if (event.target === overlay) dismiss(); });
        document.body.append(overlay);
        document.addEventListener('keydown', keyboard, true);
        document.addEventListener('focusin', focusGuard, true);
        requestAnimationFrame(() => {
          if (resolved) return;
          overlay.classList.add('is-visible'); firstFocus.focus();
          if (mode === 'prompt' && input.type !== 'number') input.select();
        });
      });
    };
    const result = dialogQueue.then(run);
    dialogQueue = result.catch(() => {});
    return result;
  }

  window.TamakuUI = {
    version: 2, notify, toast: notify,
    success: (message, options) => notify(message, 'success', options),
    error: (message, options) => notify(message, 'error', options),
    warning: (message, options) => notify(message, 'warning', options),
    info: (message, options) => notify(message, 'info', options),
    confirm: options => dialog('confirm', options),
    prompt: (options, initial) => dialog('prompt', options, initial),
    alert: options => dialog('alert', options),
  };

  // Conserva la validacion del formulario; sustituye solo su globo nativo.
  let validationNotice = false;
  const invalidFields = new WeakSet();
  document.addEventListener('invalid', event => {
    event.preventDefault();
    const field = event.target;
    field.setAttribute('aria-invalid', 'true'); invalidFields.add(field);
    if (validationNotice) return;
    validationNotice = true;
    const label = field.labels?.[0]?.textContent?.trim() || field.getAttribute('placeholder') || 'este campo';
    notify(`${label}: ${field.validationMessage || 'Revisa el valor ingresado.'}`, 'warning');
    field.focus();
    setTimeout(() => { validationNotice = false; }, 0);
  }, true);
  document.addEventListener('input', event => {
    if (invalidFields.has(event.target)) {
      event.target.removeAttribute('aria-invalid'); invalidFields.delete(event.target);
    }
  });
})();

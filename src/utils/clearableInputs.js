// Agrega una cruz (×) dentro de cualquier campo de texto, búsqueda, correo, teléfono o número
// para borrar lo escrito de un toque. Funciona para toda la app sin tocar cada formulario.
// Para excluir un campo puntual: data-no-clear en el input.
const TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'number', '']);
const SIZE = 22;
const GAP = 8;

export function initClearableInputs() {
  if (typeof document === 'undefined' || window.__clearableInputs) return;
  window.__clearableInputs = true;

  const style = document.createElement('style');
  style.textContent = `
    .ci-btn{position:fixed;z-index:2147483000;width:${SIZE}px;height:${SIZE}px;border-radius:50%;border:0;padding:0;
      display:none;align-items:center;justify-content:center;cursor:pointer;line-height:1;font-size:16px;font-family:Arial,sans-serif;
      background:rgba(128,128,128,.55);color:#fff;-webkit-tap-highlight-color:transparent}
    .ci-btn:hover{background:rgba(128,128,128,.85)}
    input[type=search]::-webkit-search-cancel-button,input[type=search]::-webkit-search-decoration{-webkit-appearance:none;display:none}
    input[type=number]{-moz-appearance:textfield;appearance:textfield}
    input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ci-btn';
  btn.tabIndex = -1;
  btn.setAttribute('aria-label', 'Borrar');
  btn.textContent = '×';
  document.body.appendChild(btn);

  let current = null;
  let raf = 0;
  const padded = new WeakMap();

  const eligible = (el) => {
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return !el.readOnly && !el.disabled && !el.hasAttribute('data-no-clear');
    if (tag !== 'INPUT') return false;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return TYPES.has(type) && !el.readOnly && !el.disabled && !el.hasAttribute('data-no-clear');
  };

  const hide = () => { btn.style.display = 'none'; };

  const place = () => {
    raf = 0;
    if (!current || !document.contains(current) || !current.value) { hide(); return; }
    const r = current.getBoundingClientRect();
    if (r.width < 60 || r.bottom < 0 || r.top > window.innerHeight) { hide(); return; }
    const isArea = current.tagName === 'TEXTAREA';
    btn.style.display = 'flex';
    btn.style.left = `${Math.round(r.right - SIZE - GAP)}px`;
    btn.style.top = `${Math.round(isArea ? r.top + GAP : r.top + (r.height - SIZE) / 2)}px`;
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };

  const reserveSpace = (el) => {
    if (padded.has(el)) return;
    const cs = getComputedStyle(el);
    const pr = parseFloat(cs.paddingRight) || 0;
    const need = SIZE + GAP * 2;
    if (pr < need) {
      padded.set(el, el.style.paddingRight);
      el.style.paddingRight = `${need}px`;
    }
  };
  const restoreSpace = (el) => {
    if (!padded.has(el)) return;
    el.style.paddingRight = padded.get(el);
    padded.delete(el);
  };

  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (current && current !== el) restoreSpace(current);
    if (eligible(el)) { current = el; reserveSpace(el); schedule(); } else if (el !== btn) { current = null; hide(); }
  });
  document.addEventListener('focusout', (e) => {
    if (e.relatedTarget === btn) return;
    const el = e.target;
    setTimeout(() => {
      if (document.activeElement === btn) return;
      if (current === el) { restoreSpace(el); current = null; hide(); }
    }, 120);
  });
  document.addEventListener('input', schedule, true);
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);

  // No le sacamos el foco al campo cuando se toca la cruz
  btn.addEventListener('pointerdown', (e) => e.preventDefault());
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => {
    const el = current;
    if (!el) return;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    schedule();
  });
}

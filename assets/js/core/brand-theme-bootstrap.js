(function () {
  try {
    const STORAGE_KEY = 'tamaku_tienda';
    const raw = localStorage.getItem(STORAGE_KEY);
    const tienda = raw ? JSON.parse(raw) : null;
    const HEX = /^#[0-9a-f]{6}$/i;
    const rgb = (hex) => {
      const value = hex.replace('#', '');
      return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
      };
    };

    if (!document.getElementById('tamakuBrandThemeCss')) {
      const link = document.createElement('link');
      link.id = 'tamakuBrandThemeCss';
      link.rel = 'stylesheet';
      link.href = '../assets/css/brand-theme.css?v=4';
      document.head.appendChild(link);
    }

    const principal = HEX.test(tienda?.color_primario || '') ? tienda.color_primario : '#D1A13A';
    const secundario = HEX.test(tienda?.color_secundario || '') ? tienda.color_secundario : '#F0CF79';
    const { r, g, b } = rgb(principal);
    const claro = (tienda?.tema_panel || tienda?.tema_base) === 'claro';
    const root = document.documentElement;

    root.style.setProperty('--gold', principal);
    root.style.setProperty('--gold-light', secundario);
    root.style.setProperty('--accent', principal);
    root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},.12)`);
    root.style.setProperty('--gold-border', `rgba(${r},${g},${b},.34)`);
    root.style.setProperty('--bg', claro ? '#f4f3ef' : '#050505');
    root.style.setProperty('--panel', claro ? '#ffffff' : '#101010');
    root.style.setProperty('--surface', claro ? '#ffffff' : '#121212');
    root.style.setProperty('--surface-2', claro ? '#ecebe7' : '#1b1b1b');
    root.style.setProperty('--text', claro ? '#171717' : '#f5f5f2');
    root.style.setProperty('--muted', claro ? '#656565' : '#818181');
    root.style.setProperty('--line', claro ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.1)');
    root.style.setProperty('--dash-bg', claro ? '#f4f3ef' : '#050505');
    root.style.setProperty('--dash-panel', claro ? '#ffffff' : '#0c0c0c');
    root.style.setProperty('--dash-card', claro ? '#ffffff' : '#111111');
    root.style.setProperty('--dash-text', claro ? '#171717' : '#f7f7f7');
    root.style.setProperty('--dash-muted', claro ? '#666666' : '#858585');
    root.style.setProperty('--dash-border', `rgba(${r},${g},${b},${claro ? '.28' : '.2'})`);
    root.style.setProperty('--dash-gold', principal);
    root.style.setProperty('--dash-gold-light', secundario);
    root.style.colorScheme = claro ? 'light' : 'dark';

    if (document.body) {
      document.body.dataset.brandTheme = claro ? 'claro' : 'oscuro';
      document.body.classList.toggle('tamaku-brand-light', claro);
    }
  } catch (error) {
    console.debug('Tema de marca no disponible al cargar:', error);
  }
})();

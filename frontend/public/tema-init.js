(function () {
  try {
    var temaGuardado = localStorage.getItem('tema');
    var tema = temaGuardado;
    if (tema !== 'oscuro' && tema !== 'claro') {
      var prefiereOscuro =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      tema = prefiereOscuro ? 'oscuro' : 'claro';
    }
    var modo = tema === 'oscuro' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', modo);
    document.documentElement.setAttribute('data-tema', tema);
  } catch {
    // Si localStorage o matchMedia no están disponibles o están bloqueados, continuar
  }
})();

/* Configuração do app — IGREJA BATISTA EM NOVA METRÓPOLE */
window.IBNM = window.IBNM || {};

IBNM.CFG = {
  SUPABASE: 'https://whtbzermbyuxicswyvsy.supabase.co',
  KEY: 'sb_publishable_LJNCmi7jUYP9AIAtlMwsnw_q1Wjex5h',
  VERSAO: '1.0.0',
  NOME: 'Igreja Batista em Nova Metrópole',
  SIGLA: 'IBNM',
  PASTA_APP: (function () {
    var p = location.pathname.replace(/index\.html?$/i, '');
    if (p.charAt(p.length - 1) !== '/') p += '/';
    return p;
  })(),
  URL_APP: (function () {
    var p = location.pathname.replace(/index\.html?$/i, '');
    if (p.charAt(p.length - 1) !== '/') p += '/';
    return location.origin + p;
  })()
};

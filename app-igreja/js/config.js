/* Configuração do app — IGREJA BATISTA EM NOVA METRÓPOLE */
window.IBNM = window.IBNM || {};

IBNM.CFG = {
  SUPABASE: 'https://whtbzermbyuxicswyvsy.supabase.co',
  KEY: 'sb_publishable_LJNCmi7jUYP9AIAtlMwsnw_q1Wjex5h',
  VERSAO: '1.1.0',
  NOME: 'Igreja Batista em Nova Metrópole',
  SIGLA: 'IBNM',
  /* Clima da barra de cima: serviço gratuito Open-Meteo (não precisa de cadastro).
     lat/lon = onde fica a igreja (Nova Metrópole, Caucaia/CE). */
  CLIMA: {
    api: 'https://api.open-meteo.com/v1/forecast',
    lat: -3.736,
    lon: -38.653,
    cidade: 'Caucaia',
    fuso: 'America/Fortaleza'
  },
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

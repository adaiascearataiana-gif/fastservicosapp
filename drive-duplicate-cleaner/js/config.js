/* ============ Configuração ============
 * Você pode deixar GOOGLE_CLIENT_ID vazio e informar o Client ID
 * diretamente na tela do app (ele fica salvo apenas no navegador).
 */
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: "",
  // Escopo completo: precisa de permissão de escrita para enviar arquivos à lixeira.
  SCOPES: "https://www.googleapis.com/auth/drive",
  // Quantidade de operações de exclusão/lixeira em paralelo.
  DELETE_CONCURRENCY: 4,
};

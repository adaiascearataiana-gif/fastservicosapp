package br.com.fastservicos.app;

import android.Manifest;
import android.app.Activity;
import android.app.KeyguardManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.CancellationSignal;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.provider.MediaStore;
import android.provider.ContactsContract;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.util.ArrayList;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    // 5.0.1: foto pela câmera do próprio celular (o WebView ignorava o "capture")
    private Uri cameraUri;
    private WebChromeClient.FileChooserParams pendingChooserParams;
    private static final int CAMERA_FILE_REQUEST = 405;
    // 5.3.7: escolher um contato da agenda (telefone de contato no pedido do Cliente)
    private static final int CONTACT_REQUEST = 406;
    private String contatoId = null;
    private static final int FILE_REQUEST = 401;
    private static final int VOICE_REQUEST = 403;
    private static final int CAMERA_REQUEST = 404;
    private PermissionRequest pendingCameraRequest;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);

        // ------------------------------------------------------------------
        // Correcao "tela estourando" (Android 15 / targetSdk 35):
        // A partir do Android 15 o sistema FORCA edge-to-edge e ignora
        // statusBarColor/navigationBarColor. Sem tratar os insets, o conteudo
        // do WebView fica POR BAIXO da barra de status e da barra de navegacao
        // (cabecalho sobreposto + rodape cortado).
        //
        // Solucao: manter o layout "fitsSystemWindows" (conteudo dentro da area
        // segura) e, quando o edge-to-edge for inevitavel, aplicar os insets do
        // sistema como padding no container do WebView.
        // ------------------------------------------------------------------
        if (Build.VERSION.SDK_INT >= 30) {
            // A Activity ocupa a tela; o container aplica os insets uma unica vez.
            getWindow().setDecorFitsSystemWindows(false);
        }

        // Container que recebe os insets como padding (evita sobreposicao).
        final FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0F172A"));
        root.setFitsSystemWindows(false);

        webView = new WebView(this);
        // 5.2.4: a página do FAST continua "importante" mesmo com o app em segundo plano —
        // o Android deixa de encerrá-la primeiro quando você troca de app.
        if (Build.VERSION.SDK_INT >= 26) {
            try { webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false); } catch (Exception e) {}
        }
        webView.setBackgroundColor(Color.parseColor("#0F172A"));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Aplica os insets do sistema (status bar / nav bar / gesto) como padding.
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int top, bottom, left, right;
                if (Build.VERSION.SDK_INT >= 30) {
                    android.graphics.Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    top = bars.top; bottom = bars.bottom; left = bars.left; right = bars.right;
                } else {
                    top = insets.getSystemWindowInsetTop();
                    bottom = insets.getSystemWindowInsetBottom();
                    left = insets.getSystemWindowInsetLeft();
                    right = insets.getSystemWindowInsetRight();
                }
                v.setPadding(left, top, right, bottom);
                return insets;
            }
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // Respeitar o viewport meta (width=device-width) e ajustar o conteudo a tela.
        // Sem isto o WebView usa ~980px de largura e o conteudo estoura os limites da tela.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " FASTAndroid/5.3.7");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new VoiceBridge(), "FASTVoice");
        // 4.0.65: biometria nativa do Android (digital / rosto / PIN do aparelho) para o app web.
        webView.addJavascriptInterface(new BioBridge(), "FASTBiometria");
        webView.addJavascriptInterface(new NotifBridge(), "FASTNotificacao");
        // 5.0.2: compartilhar fotos (WhatsApp etc.) — o WebView não tem o "compartilhar" do navegador.
        webView.addJavascriptInterface(new ShareBridge(), "FASTCompartilhar");
        // 5.3.7: agenda do celular (sem pedir permissão: o Android só entrega o contato escolhido)
        webView.addJavascriptInterface(new ContactBridge(), "FASTContatos");
        // 5.3.7: arquivos para baixar (ex.: APK novo) abrem no navegador, que baixa e oferece instalar
        webView.setDownloadListener((url, ua, cd, mime, len) -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (ActivityNotFoundException ignored) {}
        });
        webView.setWebViewClient(new WebViewClient() {
            // 5.2.3: se o Android encerrar só a parte que desenha a página (pouca memória),
            // o app NÃO fecha mais com erro: reabre a tela e o FAST volta para onde você estava.
            @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                try {
                    android.view.ViewParent pai = view.getParent();
                    if (pai instanceof ViewGroup) ((ViewGroup) pai).removeView(view);
                    view.destroy();
                } catch (Exception e) {}
                runOnUiThread(() -> { try { recreate(); } catch (Exception e) {} });
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() == null ? "" : uri.getHost();
                if (host.endsWith("github.io") || host.endsWith("supabase.co") || host.endsWith("googleapis.com")) return false;
                if (abrirWhatsApp(uri)) return true;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (ActivityNotFoundException ignored) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    Uri origin = request.getOrigin();
                    if (origin == null || !"https".equals(origin.getScheme()) ||
                        !"adaiascearataiana-gif.github.io".equals(origin.getHost())) {
                        request.deny(); return;
                    }
                    boolean video = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video = true;
                    }
                    if (!video) { request.deny(); return; }
                    if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        pendingCameraRequest = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
                        return;
                    }
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingCameraRequest == request) pendingCameraRequest = null;
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                // Câmera: o Android exige a permissão CAMERA antes de abrir a câmera do celular.
                if (aceitaImagem(params) && Build.VERSION.SDK_INT >= 29 &&
                    checkSelfPermission(Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    pendingChooserParams = params;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_FILE_REQUEST);
                    return true;
                }
                return abrirSeletor(params);
            }
        });
        // 5.1.6: sempre abre o FAST pelo endereço (os dados ficam no próprio site).
        // Guardar o "estado" do WebView ao sair do app podia passar do limite do Android
        // e fechar o app com "apresenta falhas continuamente".
        webView.loadUrl(BuildConfig.APP_URL);
        if (state != null) { String cu = state.getString("fast_camera_uri"); if (cu != null) { try { cameraUri = Uri.parse(cu); } catch (Exception e) {} } }
        requestPermissionsIfNeeded();
        webView.postDelayed(this::pedirSemEconomiaDeBateria, 6000);
        getOnBackPressedDispatcherCompat();
    }

    // 5.2.4: o "economizar bateria" de muitos celulares (Motorola, Samsung, Xiaomi…) fecha
    // apps em segundo plano. Pergunta UMA vez se pode deixar o FAST de fora disso.
    private void pedirSemEconomiaDeBateria() {
        try {
            if (Build.VERSION.SDK_INT < 23) return;
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null || pm.isIgnoringBatteryOptimizations(getPackageName())) return;
            android.content.SharedPreferences sp = getSharedPreferences("fast_app", MODE_PRIVATE);
            if (sp.getBoolean("perguntou_bateria", false)) return;
            sp.edit().putBoolean("perguntou_bateria", true).apply();
            new android.app.AlertDialog.Builder(this)
                .setTitle("Manter o FAST aberto")
                .setMessage("Para o FAST continuar aberto na mesma tela quando você troca de app, permita que ele funcione sem a economia de bateria do celular.")
                .setPositiveButton("Permitir", (d, w) -> {
                    try {
                        Intent i = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        i.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(i);
                    } catch (Exception e) {
                        try { startActivity(new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception e2) {}
                    }
                })
                .setNegativeButton("Agora não", null)
                .show();
        } catch (Exception e) {}
    }

    private boolean aceitaImagem(WebChromeClient.FileChooserParams p) {
        String[] t = p == null ? null : p.getAcceptTypes();
        if (t == null || t.length == 0) return true;
        for (String s : t) { if (s == null || s.trim().isEmpty() || s.startsWith("image") || "*/*".equals(s)) return true; }
        return false;
    }

    // Câmera do próprio celular, gravando a foto em Imagens/FAST (Android 10+ não precisa de permissão de armazenamento).
    private Intent criarIntentCamera() {
        if (Build.VERSION.SDK_INT < 29) return null;
        if (checkSelfPermission(Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) return null;
        try {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Images.Media.DISPLAY_NAME, "FAST_" + System.currentTimeMillis() + ".jpg");
            cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/FAST");
            cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
            if (cameraUri == null) return null;
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return i;
        } catch (Exception e) { apagarFotoVazia(); return null; }
    }

    private void apagarFotoVazia() {
        if (cameraUri == null) return;
        try { getContentResolver().delete(cameraUri, null, null); } catch (Exception e) {}
        cameraUri = null;
    }

    // "Câmera" (capture) abre direto a câmera; "Galeria" abre a escolha com a opção Câmera junto.
    private boolean abrirSeletor(WebChromeClient.FileChooserParams params) {
        Intent camera = aceitaImagem(params) ? criarIntentCamera() : null;
        Intent destino;
        if (params != null && params.isCaptureEnabled() && camera != null) destino = camera;
        else {
            Intent galeria = params != null ? params.createIntent() : new Intent(Intent.ACTION_GET_CONTENT).setType("image/*");
            galeria.addCategory(Intent.CATEGORY_OPENABLE);
            destino = Intent.createChooser(galeria, "Escolher foto");
            if (camera != null) destino.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        }
        try { startActivityForResult(destino, FILE_REQUEST); return true; }
        catch (Exception e) {
            apagarFotoVazia();
            try { startActivityForResult(params.createIntent(), FILE_REQUEST); return true; }
            catch (Exception e2) { if (fileCallback != null) fileCallback.onReceiveValue(null); fileCallback = null; return false; }
        }
    }

    // ---------------- 5.0.2: compartilhamento de fotos ----------------
    private final ArrayList<Uri> ultimosEnvios = new ArrayList<>();

    private class ShareBridge {
        @JavascriptInterface public boolean disponivel() { return Build.VERSION.SDK_INT >= 29; }
        @JavascriptInterface public void compartilhar(final String json, final String id) {
            new Thread(() -> {
                try {
                    JSONObject o = new JSONObject(json);
                    String texto = o.optString("texto", "");
                    org.json.JSONArray arr = o.optJSONArray("arquivos");
                    limparEnviosAnteriores();
                    ArrayList<Uri> uris = new ArrayList<>();
                    if (arr != null) for (int i = 0; i < arr.length(); i++) {
                        JSONObject f = arr.getJSONObject(i);
                        byte[] bytes = android.util.Base64.decode(f.optString("base64", ""), android.util.Base64.DEFAULT);
                        Uri u = salvarParaEnvio(bytes, f.optString("nome", "foto_" + (i + 1) + ".jpg"), f.optString("tipo", "image/jpeg"));
                        if (u != null) uris.add(u);
                    }
                    synchronized (ultimosEnvios) { ultimosEnvios.addAll(uris); }
                    runOnUiThread(() -> abrirCompartilhamento(uris, texto, id));
                } catch (Throwable e) { responderCompartilhar(id, false, String.valueOf(e.getMessage())); }
            }).start();
        }
    }

    private void limparEnviosAnteriores() {
        ArrayList<Uri> antigos;
        synchronized (ultimosEnvios) { antigos = new ArrayList<>(ultimosEnvios); ultimosEnvios.clear(); }
        for (Uri u : antigos) { try { getContentResolver().delete(u, null, null); } catch (Exception e) {} }
    }

    private Uri salvarParaEnvio(byte[] bytes, String nome, String tipo) {
        if (Build.VERSION.SDK_INT < 29 || bytes == null || bytes.length == 0) return null;
        Uri u = null;
        try {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Images.Media.DISPLAY_NAME, nome);
            cv.put(MediaStore.Images.Media.MIME_TYPE, tipo);
            cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/FAST/Envios");
            u = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
            if (u == null) return null;
            java.io.OutputStream os = getContentResolver().openOutputStream(u);
            if (os == null) return null;
            try { os.write(bytes); } finally { os.close(); }
            return u;
        } catch (Exception e) {
            if (u != null) { try { getContentResolver().delete(u, null, null); } catch (Exception ignored) {} }
            return null;
        }
    }

    private void abrirCompartilhamento(ArrayList<Uri> uris, String texto, String id) {
        if (uris.isEmpty()) {
            if (texto == null || texto.isEmpty()) { responderCompartilhar(id, false, "sem_arquivos"); return; }
            // só texto (links das fotos): também abre a lista de apps para escolher
            Intent t = new Intent(Intent.ACTION_SEND);
            t.setType("text/plain");
            t.putExtra(Intent.EXTRA_TEXT, texto);
            try { startActivity(Intent.createChooser(t, "Compartilhar")); responderCompartilhar(id, true, ""); }
            catch (Exception e) { responderCompartilhar(id, false, String.valueOf(e.getMessage())); }
            return;
        }
        Intent it;
        if (uris.size() == 1) { it = new Intent(Intent.ACTION_SEND); it.putExtra(Intent.EXTRA_STREAM, uris.get(0)); }
        else { it = new Intent(Intent.ACTION_SEND_MULTIPLE); it.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris); }
        it.setType("image/*");
        if (texto != null && !texto.isEmpty()) it.putExtra(Intent.EXTRA_TEXT, texto);
        ClipData clip = ClipData.newRawUri("fotos", uris.get(0));
        for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
        it.setClipData(clip);
        it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent escolha = Intent.createChooser(it, "Compartilhar");
        escolha.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivity(escolha); responderCompartilhar(id, true, ""); }
        catch (Exception e) { responderCompartilhar(id, false, String.valueOf(e.getMessage())); }
    }

    private void responderCompartilhar(String id, boolean ok, String msg) {
        runOnUiThread(() -> {
            if (webView == null) return;
            webView.evaluateJavascript("window.fastCompartilharResultado&&window.fastCompartilharResultado(" +
                JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(msg == null ? "" : msg) + ")", null);
        });
    }

    private void getOnBackPressedDispatcherCompat() {
        // Activity classica: o callback e tratado em onBackPressed para manter compatibilidade ampla.
    }

    private void requestPermissionsIfNeeded() {
        // A camera pede autorização quando o motorista toca em Câmera.
        // Pedir tudo no início não libera automaticamente o acesso do WebView.
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.RECORD_AUDIO, "android.permission.POST_NOTIFICATIONS"}, 402);
        else if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.RECORD_AUDIO}, 402);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_FILE_REQUEST) {
            WebChromeClient.FileChooserParams p = pendingChooserParams;
            pendingChooserParams = null;
            if (fileCallback != null && !abrirSeletor(p)) { /* sem seletor disponível */ }
            return;
        }
        if (requestCode == CAMERA_REQUEST && pendingCameraRequest != null) {
            PermissionRequest request = pendingCameraRequest;
            pendingCameraRequest = null;
            if (grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED)
                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else request.deny();
        }
        if (requestCode == 404) {
            if (grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED)
                new VoiceBridge().startSpeech();
            else voiceError("permission");
        }
    }

    // 5.3.3: links do WhatsApp abrem a gaveta para escolher WhatsApp ou WhatsApp Business
    private boolean instalado(String pkg) {
        try { getPackageManager().getPackageInfo(pkg, 0); return true; } catch (Exception e) { return false; }
    }
    private boolean abrirWhatsApp(Uri uri) {
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        String esquema = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        boolean wa = host.equals("wa.me") || host.endsWith("whatsapp.com") || esquema.equals("whatsapp");
        if (!wa) return false;
        // sem número (só texto): abre a gaveta de apps com TODOS os apps para compartilhar
        String fone = "";
        try {
            if (host.equals("wa.me")) { String pth = uri.getPath() == null ? "" : uri.getPath(); fone = pth.replaceAll("\\D", ""); }
            else { String q = uri.getQueryParameter("phone"); fone = q == null ? "" : q.replaceAll("\\D", ""); }
        } catch (Exception ignored) {}
        if (fone.isEmpty()) {
            String txt = ""; try { String q = uri.getQueryParameter("text"); txt = q == null ? "" : q; } catch (Exception ignored) {}
            Intent t = new Intent(Intent.ACTION_SEND); t.setType("text/plain"); t.putExtra(Intent.EXTRA_TEXT, txt);
            try { startActivity(Intent.createChooser(t, "Compartilhar")); } catch (Exception ignored) {}
            return true;
        }
        ArrayList<Intent> alvos = new ArrayList<>();
        for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
            if (!instalado(pkg)) continue;
            Intent i = new Intent(Intent.ACTION_VIEW, uri); i.setPackage(pkg); alvos.add(i);
        }
        try {
            if (alvos.isEmpty()) startActivity(new Intent(Intent.ACTION_VIEW, uri));
            else if (alvos.size() == 1) startActivity(alvos.get(0));
            else {
                Intent escolha = Intent.createChooser(alvos.remove(0), "Abrir com");
                escolha.putExtra(Intent.EXTRA_INITIAL_INTENTS, alvos.toArray(new android.os.Parcelable[0]));
                startActivity(escolha);
            }
        } catch (ActivityNotFoundException ignored) {}
        return true;
    }

    private class ContactBridge {
        @JavascriptInterface public boolean disponivel() { return true; }
        @JavascriptInterface public void escolher(final String id) {
            runOnUiThread(() -> {
                contatoId = id;
                Intent pick = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
                try { startActivityForResult(pick, CONTACT_REQUEST); }
                catch (ActivityNotFoundException e) { contatoId = null; contatoResultado(id, "", "", "unavailable"); }
            });
        }
    }

    private void contatoResultado(String id, String nome, String tel, String erro) {
        if (webView == null || id == null) return;
        webView.evaluateJavascript("window.fastContatoResultado&&window.fastContatoResultado(" + JSONObject.quote(id) + ","
            + JSONObject.quote(nome == null ? "" : nome) + "," + JSONObject.quote(tel == null ? "" : tel) + "," + JSONObject.quote(erro) + ")", null);
    }

    private class VoiceBridge {
        @JavascriptInterface public void startSpeech() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 404);
                    return;
                }
                Intent voice = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                voice.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                voice.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
                voice.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR");
                voice.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                voice.putExtra(RecognizerIntent.EXTRA_PROMPT, "Fale os dados para o FAST");
                try { startActivityForResult(voice, VOICE_REQUEST); }
                catch (ActivityNotFoundException e) { voiceError("unavailable"); }
            });
        }
    }

    // ------------------------------------------------------------------
    // 4.0.65: BIOMETRIA NATIVA. O WebView do Android nao oferece WebAuthn, entao
    // o app web chama window.FASTBiometria.autenticar(id, titulo) e recebe o
    // resultado em window.fastNativeBioResult(id, ok, codigo).
    // ------------------------------------------------------------------
    // 5.2.8: avisos do celular (fora do app) — pedidos e cadastros de clientes
    private class NotifBridge {
        @JavascriptInterface public boolean disponivel() { return true; }
        @JavascriptInterface public boolean permitido() {
            if (Build.VERSION.SDK_INT >= 33) return checkSelfPermission("android.permission.POST_NOTIFICATIONS") == android.content.pm.PackageManager.PERMISSION_GRANTED;
            return true;
        }
        @JavascriptInterface public void pedirPermissao() {
            if (Build.VERSION.SDK_INT >= 33) runOnUiThread(() -> { try { requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 433); } catch (Exception e) {} });
        }
        @JavascriptInterface public void mostrar(String titulo, String texto, int id, boolean som) {
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm == null) return;
                String canal = som ? "fast_pedidos" : "fast_pedidos_mudo";
                if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(canal) == null) {
                    android.app.NotificationChannel ch = new android.app.NotificationChannel(canal, som ? "Pedidos e cadastros" : "Pedidos e cadastros (sem som)",
                        som ? android.app.NotificationManager.IMPORTANCE_HIGH : android.app.NotificationManager.IMPORTANCE_LOW);
                    ch.setDescription("Avisos de novos pedidos e cadastros de clientes");
                    if (!som) ch.setSound(null, null);
                    nm.createNotificationChannel(ch);
                }
                Intent abrir = new Intent(MainActivity.this, MainActivity.class);
                abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                android.app.PendingIntent pi = android.app.PendingIntent.getActivity(MainActivity.this, 0, abrir,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? android.app.PendingIntent.FLAG_IMMUTABLE : 0));
                android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(MainActivity.this, canal) : new android.app.Notification.Builder(MainActivity.this);
                b.setSmallIcon(getApplicationInfo().icon).setContentTitle(titulo).setContentText(texto)
                 .setStyle(new android.app.Notification.BigTextStyle().bigText(texto)).setAutoCancel(true).setContentIntent(pi);
                if (Build.VERSION.SDK_INT < 26 && som) b.setDefaults(android.app.Notification.DEFAULT_ALL);
                nm.notify(id, b.build());
            } catch (Exception e) {}
        }
    }

    private class BioBridge {
        @JavascriptInterface public boolean disponivel() {
            try {
                if (Build.VERSION.SDK_INT < 28) return false;
                if (Build.VERSION.SDK_INT >= 30) {
                    BiometricManager bm = getSystemService(BiometricManager.class);
                    if (bm != null && bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK
                            | BiometricManager.Authenticators.DEVICE_CREDENTIAL) == BiometricManager.BIOMETRIC_SUCCESS) return true;
                } else if (Build.VERSION.SDK_INT == 29) {
                    BiometricManager bm = getSystemService(BiometricManager.class);
                    if (bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS) return true;
                }
                KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
                return km != null && km.isDeviceSecure();
            } catch (Exception e) { return false; }
        }
        @JavascriptInterface public void autenticar(final String id, final String titulo) {
            runOnUiThread(() -> bioAutenticar(id, titulo));
        }
    }

    private void bioAutenticar(final String id, String titulo) {
        if (Build.VERSION.SDK_INT < 28) { bioResultado(id, false, "unsupported"); return; }
        try {
            BiometricPrompt.Builder b = new BiometricPrompt.Builder(this)
                    .setTitle(titulo == null || titulo.isEmpty() ? "Entrar no FAST" : titulo)
                    .setSubtitle("Use a digital, o rosto ou o bloqueio de tela do aparelho");
            if (Build.VERSION.SDK_INT >= 30) {
                b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            } else if (Build.VERSION.SDK_INT == 29) {
                b.setDeviceCredentialAllowed(true);
            } else {
                b.setNegativeButton("Cancelar", getMainExecutor(), (dialog, which) -> bioResultado(id, false, "cancelled"));
            }
            b.build().authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    bioResultado(id, true, "ok");
                }
                @Override public void onAuthenticationError(int errorCode, CharSequence errString) {
                    bioResultado(id, false, "error:" + errorCode);
                }
            });
        } catch (Exception e) {
            bioResultado(id, false, "exception");
        }
    }

    private void bioResultado(final String id, final boolean ok, final String codigo) {
        runOnUiThread(() -> {
            if (webView == null) return;
            webView.evaluateJavascript("window.fastNativeBioResult&&window.fastNativeBioResult("
                    + JSONObject.quote(id) + "," + (ok ? "true" : "false") + "," + JSONObject.quote(codigo) + ")", null);
        });
    }

    private void voiceError(String code) {
        if (webView == null) return;
        webView.evaluateJavascript("window.fastNativeSpeechError&&window.fastNativeSpeechError(" + JSONObject.quote(code) + ")", null);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CONTACT_REQUEST) {
            String id = contatoId; contatoId = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                String nome = "", tel = "";
                Cursor c = null;
                try {
                    c = getContentResolver().query(data.getData(), new String[]{
                        ContactsContract.CommonDataKinds.Phone.NUMBER,
                        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME}, null, null, null);
                    if (c != null && c.moveToFirst()) { tel = c.getString(0); nome = c.getString(1); }
                } catch (Exception e) {
                } finally { if (c != null) c.close(); }
                contatoResultado(id, nome, tel, "");
            } else contatoResultado(id, "", "", "cancelled");
            return;
        }
        if (requestCode == VOICE_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                String text = results != null && !results.isEmpty() ? results.get(0) : "";
                webView.evaluateJavascript("window.fastNativeSpeechResult&&window.fastNativeSpeechResult(" + JSONObject.quote(text) + ")", null);
            } else voiceError("cancelled");
            return;
        }
        if (requestCode == FILE_REQUEST) {
            Uri[] res = null;
            boolean temDados = data != null && (data.getData() != null || data.getClipData() != null);
            if (resultCode == RESULT_OK) {
                if (temDados) res = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                else if (cameraUri != null) res = new Uri[]{cameraUri};
            }
            // foto da câmera não usada (cancelou ou escolheu da galeria): apaga o arquivo vazio
            if (cameraUri != null && (res == null || res.length == 0 || !cameraUri.equals(res[0]))) apagarFotoVazia();
            cameraUri = null;
            if (fileCallback != null) fileCallback.onReceiveValue(res);
            fileCallback = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        // não guarda o WebView inteiro (podia ficar grande demais e derrubar o app em segundo plano)
        super.onSaveInstanceState(state);
        try { if (cameraUri != null) state.putString("fast_camera_uri", cameraUri.toString()); } catch (Exception e) {}
    }
    @Override public void onBackPressed() { if (webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}

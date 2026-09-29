package br.com.fastservicos.app;

import android.Manifest;
import android.app.Activity;
import android.app.KeyguardManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.CancellationSignal;
import android.content.ActivityNotFoundException;
import android.content.Intent;
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
        settings.setUserAgentString(settings.getUserAgentString() + " FASTAndroid/4.0.65");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new VoiceBridge(), "FASTVoice");
        // 4.0.65: biometria nativa do Android (digital / rosto / PIN do aparelho) para o app web.
        webView.addJavascriptInterface(new BioBridge(), "FASTBiometria");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() == null ? "" : uri.getHost();
                if (host.endsWith("github.io") || host.endsWith("supabase.co") || host.endsWith("googleapis.com")) return false;
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
                try { startActivityForResult(params.createIntent(), FILE_REQUEST); }
                catch (ActivityNotFoundException e) { fileCallback = null; return false; }
                return true;
            }
        });
        if (state == null) webView.loadUrl(BuildConfig.APP_URL); else webView.restoreState(state);
        requestPermissionsIfNeeded();
        getOnBackPressedDispatcherCompat();
    }

    private void getOnBackPressedDispatcherCompat() {
        // Activity classica: o callback e tratado em onBackPressed para manter compatibilidade ampla.
    }

    private void requestPermissionsIfNeeded() {
        // A camera pede autorização quando o motorista toca em Câmera.
        // Pedir tudo no início não libera automaticamente o acesso do WebView.
        if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.RECORD_AUDIO}, 402);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
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
        if (requestCode == VOICE_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                String text = results != null && !results.isEmpty() ? results.get(0) : "";
                webView.evaluateJavascript("window.fastNativeSpeechResult&&window.fastNativeSpeechResult(" + JSONObject.quote(text) + ")", null);
            } else voiceError("cancelled");
            return;
        }
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle state) { webView.saveState(state); super.onSaveInstanceState(state); }
    @Override public void onBackPressed() { if (webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}

package vn.io.vivutrade

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorContainer: LinearLayout
    private lateinit var btnRetry: Button
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout

    // In-Window Popup views
    private lateinit var popupContainer: FrameLayout
    private lateinit var popupWebViewHolder: FrameLayout
    private lateinit var popupProgressBar: ProgressBar
    private lateinit var btnClosePopup: ImageView
    private var currentPopupWebView: WebView? = null
    private var isAuthenticating: Boolean = false

    // Google's Sign-In flow sometimes performs a top-level form POST redirect
    // straight to accounts.google.com instead of opening a real popup (Android
    // WebView never calls shouldOverrideUrlLoading for POST navigations, so it
    // cannot be intercepted). When that happens the main WebView navigates away
    // from vivutrade.io.vn; once auth completes we reload the app and run this
    // pending script once vivutrade.io.vn finishes loading again.
    private var pendingAuthScript: String? = null

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var backPressedTime: Long = 0L

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data: Intent? = result.data
            val results = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
            fileUploadCallback?.onReceiveValue(results)
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen awake for continuous trading chart monitoring
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Dark theme status bar and navigation bar
        window.statusBarColor = ContextCompat.getColor(this, R.color.brand_background)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.brand_background)

        setContentView(R.layout.activity_main)

        // Enable Chrome DevTools remote debugging
        WebView.setWebContentsDebuggingEnabled(((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0))

        initViews()
        setupWebView()
        setupSwipeRefresh()
        setupBackNavigation()

        loadVivutrade()
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        errorContainer = findViewById(R.id.errorContainer)
        btnRetry = findViewById(R.id.btnRetry)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)

        popupContainer = findViewById(R.id.popupContainer)
        popupWebViewHolder = findViewById(R.id.popupWebViewHolder)
        popupProgressBar = findViewById(R.id.popupProgressBar)
        btnClosePopup = findViewById(R.id.btnClosePopup)

        btnRetry.setOnClickListener {
            errorContainer.visibility = View.GONE
            webView.visibility = View.VISIBLE
            webView.reload()
        }

        btnClosePopup.setOnClickListener {
            dismissPopup()
        }
    }

    private fun cleanWebViewUserAgent(): String {
        val raw = webView.settings.userAgentString
        return raw
            .replace("; wv", "")
            .replace(Regex("Version/\\d+\\.\\d+\\s*"), "")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildPopupWebView(): WebView {
        dismissPopup()

        val popupWebView = WebView(this@MainActivity).apply {
            this.settings.javaScriptEnabled = true
            this.settings.domStorageEnabled = true
            this.settings.databaseEnabled = true
            this.settings.setSupportMultipleWindows(true)
            this.settings.javaScriptCanOpenWindowsAutomatically = true
            this.settings.userAgentString = cleanWebViewUserAgent()

            val popupCookieManager = CookieManager.getInstance()
            popupCookieManager.setAcceptCookie(true)
            popupCookieManager.setAcceptThirdPartyCookies(this, true)

            if (WebViewFeature.isFeatureSupported(WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST)) {
                try {
                    WebSettingsCompat.setRequestedWithHeaderOriginAllowList(this.settings, setOf("vivutrade.io.vn"))
                } catch (_: Exception) {}
            }

            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        currentPopupWebView = popupWebView

        // Expose Android bridge to receive Google Auth message from popup
        popupWebView.addJavascriptInterface(object {
            @JavascriptInterface
            fun postGoogleMessage(messageData: String) {
                runOnUiThread {
                    handleGoogleAuthMessage(messageData)
                }
            }

            @JavascriptInterface
            fun closePopup() {
                runOnUiThread {
                    dismissPopup()
                }
            }
        }, "AndroidBridge")

        // Inject polyfill at document start if supported
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(
                    popupWebView,
                    POPUP_POLYFILL_SCRIPT,
                    setOf("*")
                )
            } catch (_: Exception) {}
        }

        popupWebView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    popupProgressBar.visibility = View.VISIBLE
                    popupProgressBar.progress = newProgress
                } else {
                    popupProgressBar.visibility = View.GONE
                }
                // Re-inject polyfill early in loading
                view?.evaluateJavascript(POPUP_POLYFILL_SCRIPT, null)
                if (newProgress >= 30) {
                    tryExtractToken(view, view?.url)
                }
            }

            override fun onCloseWindow(window: WebView?) {
                dismissPopup()
            }
        }

        popupWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val urlString = url.toString()
                val scheme = url.scheme ?: ""

                if (scheme != "http" && scheme != "https") {
                    return handleExternalIntent(urlString)
                }

                val host = url.host ?: ""
                if (host.contains("google") ||
                    host.contains("gstatic.com") ||
                    host.endsWith("vivutrade.io.vn") ||
                    host.contains("supabase.co")
                ) {
                    return false
                }

                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (e: Exception) {
                    false
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                view?.evaluateJavascript(POPUP_POLYFILL_SCRIPT, null)
                tryExtractToken(view, url)

                // If auth redirected back to vivutrade
                if (url != null && url.contains("vivutrade.io.vn") && !url.contains("/api/auth/google")) {
                    dismissPopup()
                    webView.loadUrl(url)
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                popupProgressBar.visibility = View.GONE
                view?.evaluateJavascript(POPUP_POLYFILL_SCRIPT, null)
                tryExtractToken(view, url)

                // Check if URL has token
                if (url != null && (url.contains("id_token=") || url.contains("credential="))) {
                    val uri = Uri.parse(url)
                    val token = uri.getQueryParameter("id_token")
                        ?: uri.getQueryParameter("credential")
                        ?: uri.fragment?.split("&")?.find { it.startsWith("id_token=") }?.substringAfter("id_token=")
                    if (!token.isNullOrEmpty()) {
                        handleGoogleAuthMessage("{\"credential\":\"$token\"}")
                    }
                }
            }
        }

        popupWebViewHolder.addView(popupWebView)
        popupContainer.visibility = View.VISIBLE
        popupContainer.bringToFront()
        return popupWebView
    }

    private fun openUrlInPopup(url: String) {
        val popupWebView = buildPopupWebView()
        popupWebView.loadUrl(url)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings

        // Enable JavaScript and Canvas Hardware Acceleration
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true

        // Multi-window and popup support (essential for Google Identity Services / OAuth popups)
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true

        // Viewport and performance optimizations
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = if (((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)) WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE else WebSettings.MIXED_CONTENT_NEVER_ALLOW

        // Disable standard zoom controls to preserve responsive UI
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        // File access for chart export / imports
        settings.allowFileAccess = true
        settings.allowContentAccess = true

        // Sanitize User-Agent to match standard mobile Chrome (removes '; wv' and 'Version/4.0'
        // which cause Google to reject OAuth with 403 disallowed_useragent or 400 malformed request)
        val cleanUserAgent = cleanWebViewUserAgent()
        settings.userAgentString = cleanUserAgent

        // Cookie management
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        if (WebViewFeature.isFeatureSupported(WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST)) {
            try {
                WebSettingsCompat.setRequestedWithHeaderOriginAllowList(settings, setOf("vivutrade.io.vn"))
            } catch (_: Exception) {}
        }

        // Expose the same Android bridge + fake window.opener polyfill used for
        // real popups on the main WebView too. Google's Sign-In flow can hijack
        // the top-level frame via a POST redirect we cannot intercept (see
        // pendingAuthScript above); without this, its script crashes calling
        // window.opener.postMessage on a null opener, leaving a blank page.
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun postGoogleMessage(messageData: String) {
                runOnUiThread {
                    handleGoogleAuthMessage(messageData)
                }
            }

            @JavascriptInterface
            fun closePopup() {
                // No-op on the main WebView: there is no popup to close here.
            }
        }, "AndroidBridge")

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(webView, ERROR_TRAP_SCRIPT, setOf("*"))
                WebViewCompat.addDocumentStartJavaScript(webView, POPUP_POLYFILL_SCRIPT, setOf("*"))
            } catch (_: Exception) {}
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: android.webkit.ConsoleMessage?): Boolean {
                android.util.Log.d("VivuWebConsole", "${message?.messageLevel()} ${message?.sourceId()}:${message?.lineNumber()} ${message?.message()}")
                return true
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
                // If Google's Sign-In flow hijacked the top-level frame (see
                // pendingAuthScript), fall back to scraping the credential
                // straight out of the page in case postMessage still fails.
                val currentUrl = view?.url
                if (currentUrl != null && !currentUrl.startsWith(TARGET_URL) && newProgress >= 30) {
                    tryExtractToken(view, currentUrl)
                }
            }

            override fun onShowFileChooser(
                mWebView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    filePickerLauncher.launch(intent)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    return false
                }
                return true
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val popupWebView = buildPopupWebView()
                val transport = resultMsg?.obj as? WebView.WebViewTransport
                transport?.webView = popupWebView
                resultMsg?.sendToTarget()
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val urlString = url.toString()
                val scheme = url.scheme ?: ""

                // Handle external protocols (Telegram, WhatsApp, tel, mailto, etc.)
                if (scheme != "http" && scheme != "https") {
                    return handleExternalIntent(urlString)
                }

                val host = url.host ?: ""

                // Google Identity Services sometimes breaks out of its iframe and
                // navigates the TOP-LEVEL window straight to accounts.google.com
                // instead of opening a real popup (no onCreateWindow call happens).
                // If we let that happen in place, it replaces the vivutrade page
                // (destroying the pending GSI callback) and Google's script then
                // crashes trying to call window.opener.postMessage on a null
                // opener, stranding the user on a blank screen with no way back.
                // Route it into the same popup WebView used for real popups so the
                // vivutrade page survives underneath and our existing token
                // extraction / AndroidBridge opener polyfill can complete the flow.
                if (host.contains("accounts.google.com")) {
                    openUrlInPopup(urlString)
                    return true
                }

                // Internal domains: vivutrade.io.vn and Google OAuth endpoints
                if (host.endsWith("vivutrade.io.vn") ||
                    host.contains("google.com") ||
                    host.contains("supabase.co")
                ) {
                    return false
                }

                // External websites: open in system browser
                return try {
                    val browserIntent = Intent(Intent.ACTION_VIEW, url)
                    startActivity(browserIntent)
                    true
                } catch (e: Exception) {
                    false
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                errorContainer.visibility = View.GONE
                webView.visibility = View.VISIBLE
                tryExtractToken(view, url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
                progressBar.visibility = View.GONE
                tryExtractToken(view, url)

                // Check if Google's redirect landed with a token in the URL
                if (url != null && (url.contains("id_token=") || url.contains("credential="))) {
                    val uri = Uri.parse(url)
                    val token = uri.getQueryParameter("id_token")
                        ?: uri.getQueryParameter("credential")
                        ?: uri.fragment?.split("&")?.find { it.startsWith("id_token=") }?.substringAfter("id_token=")
                    if (!token.isNullOrEmpty()) {
                        handleGoogleAuthMessage("{\"credential\":\"$token\"}")
                    }
                }

                // Once we're back on vivutrade.io.vn, run any auth script that was
                // deferred while Google's flow had hijacked the top-level frame.
                val pending = pendingAuthScript
                if (pending != null && url != null && url.startsWith(TARGET_URL)) {
                    pendingAuthScript = null
                    webView.evaluateJavascript(pending, null)
                }

                // Remember the page the user is on so the app resumes here next
                // launch instead of always reopening the landing page.
                if (url != null) saveLastPath(url)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    webView.visibility = View.GONE
                    errorContainer.visibility = View.VISIBLE
                    swipeRefreshLayout.isRefreshing = false
                }
            }
        }
    }

    private fun tryExtractToken(view: WebView?, url: String?) {
        val currentUrl = url ?: view?.url ?: ""
        if (currentUrl.contains("accounts.google.com") || currentUrl.contains("gsi/")) {
            val script = """
                (function() {
                    function extract() {
                        try {
                            var html = document.documentElement ? document.documentElement.outerHTML : '';
                            var idx = html.indexOf('ZXlKa');
                            if (idx !== -1) {
                                var sub = html.substring(idx);
                                var end = sub.search(/[^A-Za-z0-9_-]/);
                                var b64 = end !== -1 ? sub.substring(0, end) : sub;
                                var b64Clean = b64.replace(/-/g, '+').replace(/_/g, '/');
                                while (b64Clean.length % 4 !== 0) b64Clean += '=';
                                var decoded = atob(b64Clean);
                                var m = decoded.match(/ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
                                if (m && m[0] && window.AndroidBridge && window.AndroidBridge.postGoogleMessage) {
                                    window.AndroidBridge.postGoogleMessage(JSON.stringify({ credential: m[0] }));
                                    return true;
                                }
                            }
                            var m2 = html.match(/ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
                            if (m2 && m2[0] && window.AndroidBridge && window.AndroidBridge.postGoogleMessage) {
                                window.AndroidBridge.postGoogleMessage(JSON.stringify({ credential: m2[0] }));
                                return true;
                            }
                        } catch(e) {}
                        return false;
                    }
                    if (!extract()) {
                        var count = 0;
                        var t = setInterval(function() {
                            count++;
                            if (extract() || count > 30) clearInterval(t);
                        }, 150);
                    }
                })();
            """.trimIndent()
            view?.evaluateJavascript(script, null)
        }
    }

    private fun handleGoogleAuthMessage(messageData: String) {
        if (isAuthenticating) return

        var idToken: String? = null
        try {
            val json = JSONObject(messageData)
            if (json.has("credential")) {
                idToken = json.optString("credential")
            } else if (json.has("id_token")) {
                idToken = json.optString("id_token")
            } else if (json.has("data")) {
                val nested = json.optJSONObject("data")
                idToken = nested?.optString("credential") ?: nested?.optString("id_token")
            }
        } catch (_: Exception) {}

        if (idToken.isNullOrEmpty()) {
            val jwtRegex = Regex("""ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}""")
            idToken = jwtRegex.find(messageData)?.value
        }

        if (idToken.isNullOrEmpty()) {
            return
        }

        isAuthenticating = true
        dismissPopup()
        Toast.makeText(this, "Đang đăng nhập tài khoản...", Toast.LENGTH_SHORT).show()
        webView.postDelayed({ isAuthenticating = false }, 6000L)

        // Inject authentication script into main webView
        val safeData = JSONObject.quote(messageData)
        val safeToken = JSONObject.quote(idToken)

        val authScript = """
            (function() {
                try {
                    var rawData;
                    try {
                        rawData = JSON.parse($safeData);
                        if (typeof rawData === 'string') {
                            try { rawData = JSON.parse(rawData); } catch(_) {}
                        }
                    } catch(_) {
                        rawData = $safeData;
                    }
                    window.dispatchEvent(new MessageEvent('message', {
                        data: rawData,
                        origin: 'https://accounts.google.com'
                    }));
                } catch(e) {}

                var token = $safeToken;
                if (token && token.length > 20) {
                    fetch('/api/auth/google', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ id_token: token })
                    })
                    .then(function(res) {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.json();
                    })
                    .then(function(data) {
                        if (data && data.access_token) {
                            localStorage.setItem('auth_access_token', String(data.access_token));
                            if (data.user) {
                                localStorage.setItem('auth_user', JSON.stringify(data.user));
                            }
                            window.dispatchEvent(new Event('auth-changed'));
                            var loc = window.location.pathname;
                            if (loc.indexOf('/chart') !== -1) {
                                window.location.reload();
                            } else {
                                var match = loc.match(/^\/(vi|en)(?:\/|$)/i);
                                var prefix = match ? match[1] : 'vi';
                                window.location.href = '/' + prefix + '/chart';
                            }
                        }
                    })
                    .catch(function(err) {
                        console.error('Google auth error', err);
                    });
                }
            })();
        """.trimIndent()

        val currentUrl = webView.url
        if (currentUrl != null && currentUrl.startsWith(TARGET_URL)) {
            webView.evaluateJavascript(authScript, null)
        } else {
            // Google's flow hijacked the top-level frame and navigated the main
            // WebView away from vivutrade.io.vn (see pendingAuthScript). Running
            // the script here would fetch/redirect against the wrong origin, so
            // reload the app first and run it once vivutrade.io.vn is back.
            pendingAuthScript = authScript
            webView.loadUrl(TARGET_URL)
        }
    }

    private fun dismissPopup() {
        popupContainer.visibility = View.GONE
        popupProgressBar.visibility = View.GONE
        popupWebViewHolder.removeAllViews()
        currentPopupWebView?.destroy()
        currentPopupWebView = null
    }

    private fun handleExternalIntent(urlString: String): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(urlString))
            startActivity(intent)
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun setupSwipeRefresh() {
        // Pull-to-refresh is disabled entirely: the chart's own pan/drag gestures
        // don't scroll the WebView itself (webView.scrollY stays 0), so the old
        // setOnChildScrollUpCallback check could never tell a chart swipe apart
        // from an intentional pull-to-refresh, causing frequent accidental
        // reloads while trading.
        swipeRefreshLayout.isEnabled = false
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (popupContainer.visibility == View.VISIBLE) {
                    if (currentPopupWebView?.canGoBack() == true) {
                        currentPopupWebView?.goBack()
                    } else {
                        dismissPopup()
                    }
                    return
                }

                if (errorContainer.visibility == View.VISIBLE) {
                    errorContainer.visibility = View.GONE
                    webView.visibility = View.VISIBLE
                    webView.reload()
                    return
                }

                if (webView.canGoBack()) {
                    webView.goBack()
                    return
                }

                // Double press back to exit to prevent accidental app close while trading
                val currentTime = System.currentTimeMillis()
                if (currentTime - backPressedTime < 2000L) {
                    finish()
                } else {
                    backPressedTime = currentTime
                    Toast.makeText(
                        this@MainActivity,
                        getString(R.string.exit_prompt),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        })
    }

    private fun getLastPathPrefs() = getSharedPreferences("vivutrade_nav", MODE_PRIVATE)

    private fun saveLastPath(url: String) {
        if (!url.startsWith(TARGET_URL)) return
        val path = url.removePrefix(TARGET_URL)
        // Never persist a URL still carrying an auth token/credential fragment —
        // resuming into one of those on next launch would just replay a stale login.
        if (path.contains("id_token=") || path.contains("credential=") || path.contains("code=")) return
        getLastPathPrefs().edit().putString(KEY_LAST_PATH, path).apply()
    }

    private fun loadVivutrade() {
        val lastPath = getLastPathPrefs().getString(KEY_LAST_PATH, "") ?: ""
        webView.loadUrl(TARGET_URL + lastPath)
    }

    override fun onDestroy() {
        dismissPopup()
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        const val TARGET_URL = "https://vivutrade.io.vn"
        private const val KEY_LAST_PATH = "last_path"

        private const val ERROR_TRAP_SCRIPT = """
            (function() {
                window.addEventListener('error', function(e) {
                    console.error('[UncaughtError]', e.message, e.filename, e.lineno + ':' + e.colno, e.error && e.error.stack);
                });
                window.addEventListener('unhandledrejection', function(e) {
                    var reason = e.reason;
                    console.error('[UnhandledRejection]', reason && (reason.stack || reason.message || reason));
                });
            })();
        """

        private const val POPUP_POLYFILL_SCRIPT = """
            (function() {
                function forwardMessage(data) {
                    try {
                        var str = (typeof data === 'string') ? data : JSON.stringify(data);
                        if (window.AndroidBridge && window.AndroidBridge.postGoogleMessage) {
                            window.AndroidBridge.postGoogleMessage(str);
                        }
                    } catch(e) {
                        try {
                            if (window.AndroidBridge && window.AndroidBridge.postGoogleMessage) {
                                window.AndroidBridge.postGoogleMessage(String(data));
                            }
                        } catch(e2) {}
                    }
                }

                var fakeOpener = {
                    postMessage: function(data, targetOrigin) {
                        forwardMessage(data);
                    }
                };

                try {
                    Object.defineProperty(window, 'opener', {
                        get: function() { return fakeOpener; },
                        set: function() {},
                        configurable: true
                    });
                } catch(e) {
                    try { window.opener = fakeOpener; } catch(e2) {}
                }

                try {
                    var origClose = window.close;
                    window.close = function() {
                        if (window.AndroidBridge && window.AndroidBridge.closePopup) {
                            window.AndroidBridge.closePopup();
                        }
                        if (typeof origClose === 'function') {
                            try { origClose.call(window); } catch(e) {}
                        }
                    };
                } catch(e) {}

                try {
                    window.addEventListener('message', function(event) {
                        if (event && event.data) {
                            forwardMessage(event.data);
                        }
                    });
                } catch(e) {}
            })();
        """
    }
}

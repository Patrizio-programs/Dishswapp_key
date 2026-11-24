package com.pgmja.dishswapp;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The site (dishswapp.pgmja.com) and Clerk's API (clerk.dishswapp.pgmja.com) are
        // different origins, so Clerk's sign-in handshake needs third-party cookies,
        // which Android WebView blocks by default.
        CookieManager.getInstance().setAcceptThirdPartyCookies(bridge.getWebView(), true);
    }
}

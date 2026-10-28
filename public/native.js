// The iPhone app (Capacitor) puts real ads where the web page has placeholders. On the web this file does nothing.
// While the app is tested, every ad is one of Google's own test ads (TEST below).
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  window.WB_NATIVE = true;
  document.documentElement.classList.add("native");
  // The app view reports the notch and home-bar insets a moment after the page starts; measure the screen again then.
  window.addEventListener("load", function () { [150, 600, 1500].forEach(function (ms) { setTimeout(function () { window.dispatchEvent(new Event("resize")); }, ms); }); });
  // Premium is one purchase in the App Store (non-consumable app.wordbelow.premium). StoreKit keeps it, so
  // checking the purchases at start gives it back on a new phone or after a reinstall.
  var IAP = C.Plugins && C.Plugins.NativePurchases, PREMIUM_ID = "app.wordbelow.premium";
  if (IAP) {
    var owns = function (r) { return ((r && r.purchases) || []).some(function (p) { return p.productIdentifier === PREMIUM_ID; }); };
    window.WB_IAP = {
      price: function () { return IAP.getProducts({ productIdentifiers: [PREMIUM_ID] }).then(function (r) { var p = r && r.products && r.products[0]; return p ? p.priceString : null; }); },
      owned: function () { return IAP.getPurchases().then(owns); },
      buy: function () { return IAP.purchaseProduct({ productIdentifier: PREMIUM_ID, quantity: 1 }).then(function (t) { return !!t; }); },
      restore: function () { return IAP.restorePurchases().then(function () { return IAP.getPurchases(); }).then(owns); }
    };
  }
  var AdMob = C.Plugins && C.Plugins.AdMob;
  if (!AdMob) return;
  // The ad units are wordbelow's own in AdMob. While TEST is true the plugin swaps them for Google's test ads;
  // TEST goes false only for the build that is sent to App Review.
  var TEST = false, IDS = { banner: "ca-app-pub-6230023114953568/8226377247", interstitial: "ca-app-pub-6230023114953568/6119088651" };
  var ready = false, wantBanner = false, bannerOn = false, fullReady = false;
  function prepFull() {
    fullReady = false;
    AdMob.prepareInterstitial({ adId: IDS.interstitial, isTesting: TEST }).then(function () { fullReady = true; }, function () {});
  }
  // The banner waits until the opening animation (#splash) has gone.
  function syncBanner() {
    if (!ready || wantBanner === bannerOn) return;
    if (wantBanner && document.getElementById("splash")) { setTimeout(syncBanner, 300); return; }
    bannerOn = wantBanner;
    if (wantBanner) AdMob.showBanner({ adId: IDS.banner, adSize: "BANNER", position: "BOTTOM_CENTER", margin: 3, isTesting: TEST }).catch(function () { bannerOn = false; });
    else AdMob.hideBanner().catch(function () {});
  }
  // In the EEA, the UK and Switzerland, Google's consent form (UMP) comes first; it is the message set up in AdMob,
  // and outside those places it does not show. Then Apple asks before any tracking. Neither answer changes the game.
  // privacy says whether Settings must offer a way back to the form.
  var privacy = false;
  AdMob.requestConsentInfo({}).then(function (c) {
    privacy = c && c.privacyOptionsRequirementStatus === "REQUIRED";
    return c && c.status === "REQUIRED" && c.isConsentFormAvailable ? AdMob.showConsentForm() : c;
  }).catch(function () {}).then(function () {
    return AdMob.trackingAuthorizationStatus();
  }).then(function (s) {
    return s && s.status === "notDetermined" ? AdMob.requestTrackingAuthorization() : null;
  }).catch(function () {}).then(function () {
    return AdMob.initialize({ initializeForTesting: TEST });
  }).then(function () { ready = true; prepFull(); syncBanner(); }, function () {});
  if (AdMob.addListener) AdMob.addListener("interstitialAdDismissed", prepFull);
  window.WB_ADS = {
    // The web page keeps its banner strip as the room the native banner sits in.
    bannerShow: function (on) { wantBanner = !!on; syncBanner(); },
    // Shown at once if one has loaded; a move never waits for an ad.
    interstitialNative: function () { if (ready && fullReady) { fullReady = false; AdMob.showInterstitial().catch(prepFull); } },
    // Where the law asks for it, the player can open the consent form again from Settings.
    privacyNeeded: function () { return privacy; },
    privacyForm: function () { return AdMob.showPrivacyOptionsForm(); }
  };
})();

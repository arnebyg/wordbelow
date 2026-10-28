// The iPhone app (Capacitor) puts real ads where the web page has placeholders. On the web this file does nothing.
// While the app is tested, every ad is one of Google's own test ads (the ids below are Google's published test ids);
// the real ids replace them, and isTesting goes false, only when the app is about to be released.
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  window.WB_NATIVE = true;
  document.documentElement.classList.add("native");
  // The app view reports the notch and home-bar insets a moment after the page starts; measure the screen again then.
  window.addEventListener("load", function () { [150, 600, 1500].forEach(function (ms) { setTimeout(function () { window.dispatchEvent(new Event("resize")); }, ms); }); });
  var AdMob = C.Plugins && C.Plugins.AdMob;
  if (!AdMob) return;
  var TEST = true, IDS = { banner: "ca-app-pub-3940256099942544/2934735716", interstitial: "ca-app-pub-3940256099942544/4411468910" };
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
  // Apple asks before any tracking; the answer only changes which ads are shown, never the game.
  AdMob.trackingAuthorizationStatus().then(function (s) {
    return s && s.status === "notDetermined" ? AdMob.requestTrackingAuthorization() : null;
  }).catch(function () {}).then(function () {
    return AdMob.initialize({ initializeForTesting: TEST });
  }).then(function () { ready = true; prepFull(); syncBanner(); }, function () {});
  if (AdMob.addListener) AdMob.addListener("interstitialAdDismissed", prepFull);
  window.WB_ADS = {
    // The web page keeps its banner strip as the room the native banner sits in.
    bannerShow: function (on) { wantBanner = !!on; syncBanner(); },
    // Shown at once if one has loaded; a move never waits for an ad.
    interstitialNative: function () { if (ready && fullReady) { fullReady = false; AdMob.showInterstitial().catch(prepFull); } }
  };
})();

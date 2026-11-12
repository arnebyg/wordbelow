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
  // One person from the contacts, with Apple's own picker: the app sees only the person picked, and keeps nothing.
  var Contacts = C.Plugins && C.Plugins.Contacts;
  // Only on the iPhone: on Android the plugin asks for the whole contact list (READ_CONTACTS), so the share sheet does it.
  if (Contacts && Contacts.pickContact && C.getPlatform && C.getPlatform() === "ios") window.WB_CONTACT = {
    pick: function () {
      return Contacts.pickContact({ projection: { name: true, emails: true, phones: true } }).then(function (r) {
        var c = r && r.contact; if (!c) return Promise.reject();
        var em = (c.emails || [])[0], ph = (c.phones || [])[0];
        return em && em.address ? { email: em.address } : ph && ph.number ? { tel: ph.number } : null;
      });
    }
  };
  // Push when it is your turn: Apple's own service on the iPhone, Firebase Cloud Messaging on Android (the project
  // wordbelow, android/app/google-services.json). enable() asks the phone and resolves to the token, which logic.js gives
  // the server (/push/native) with the platform.
  var PN = C.Plugins && C.Plugins.PushNotifications;
  if (PN) {
    var tokenWait = null, opened = null, openedGame = null;
    PN.addListener("registration", function (t) { if (tokenWait) { tokenWait.ok(t.value); tokenWait = null; } });
    PN.addListener("registrationError", function (e) { if (tokenWait) { tokenWait.no(new Error((e && e.error) || "registration")); tokenWait = null; } });
    // A tap on a message opens its game; one tapped before the game had started is kept until it asks.
    PN.addListener("pushNotificationActionPerformed", function (a) {
      var g = a && a.notification && a.notification.data && a.notification.data.game;
      if (!g) return; if (opened) opened(g); else openedGame = g;
    });
    var register = function () { return new Promise(function (ok, no) { tokenWait = { ok: ok, no: no }; PN.register().catch(no); }); };
    window.WB_PUSH = {
      // "granted", "denied" or "prompt".
      state: function () { return PN.checkPermissions().then(function (p) { return p.receive; }); },
      enable: function () {
        return PN.requestPermissions().then(function (p) { if (p.receive !== "granted") throw new Error(p.receive); return register(); });
      },
      // At start, when already allowed: the token again (it can change), so the server has the current one.
      again: function () { return PN.checkPermissions().then(function (p) { return p.receive === "granted" ? register() : null; }); },
      onOpen: function (fn) { opened = fn; if (openedGame) { var g = openedGame; openedGame = null; fn(g); } },
      platform: C.getPlatform ? C.getPlatform() : "ios",
      // Android: the channel the server names for turn messages (src/fcm.js, "turns"), with sound and vibration on.
      // Made once the app's texts are loaded, so its name in the phone's settings is in the app's language.
      channel: function (name) {
        if (!PN.createChannel || C.getPlatform() !== "android") return Promise.resolve();
        return PN.createChannel({ id: "turns", name: name, importance: 4, visibility: 1, vibration: true, sound: "default" }).catch(function () {});
      }
    };
  }
  // The reminder about today's board is made by the phone itself (no server): one message a day for the week ahead,
  // each naming that day's board, and none on a day the board has been played.
  var LN = C.Plugins && C.Plugins.LocalNotifications;
  if (LN) {
    var REMIND_IDS = [9101, 9102, 9103, 9104, 9105, 9106, 9107, 9108];
    var remindTap = null, remindTapped = false;
    LN.addListener("localNotificationActionPerformed", function (a) {
      if (!(a && a.notification && REMIND_IDS.indexOf(a.notification.id) >= 0)) return;
      if (remindTap) remindTap(); else remindTapped = true;
    });
    window.WB_REMIND = {
      state: function () { return LN.checkPermissions().then(function (p) { return p.display; }); },
      allow: function () { return LN.requestPermissions().then(function (p) { return p.display; }); },
      // list: [{ at: Date, title, body }]; replaces whatever was set before.
      set: function (list) {
        return LN.cancel({ notifications: REMIND_IDS.map(function (id) { return { id: id }; }) }).catch(function () {}).then(function () {
          if (!list.length) return;
          return LN.schedule({ notifications: list.slice(0, REMIND_IDS.length).map(function (n, i) {
            return { id: REMIND_IDS[i], title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } };
          }) });
        });
      },
      onTap: function (fn) { remindTap = fn; if (remindTapped) { remindTapped = false; fn(); } }
    };
  }
  var AdMob = C.Plugins && C.Plugins.AdMob;
  if (!AdMob) return;
  // The ad units are wordbelow's own in AdMob. While TEST is true the plugin swaps them for Google's test ads;
  // TEST goes false only for the build that is sent to App Review.
  var ANDROID = C.getPlatform && C.getPlatform() === "android";
  var TEST = false, IDS = ANDROID ? { banner: "ca-app-pub-6230023114953568/3609610859", interstitial: "ca-app-pub-6230023114953568/4444180375" } : { banner: "ca-app-pub-6230023114953568/8226377247", interstitial: "ca-app-pub-6230023114953568/6119088651" };
  var ready = false, wantBanner = false, bannerOn = false, fullReady = false;
  // A load that fails (no ad to give, no network) is tried again after 30 s, then 60, 120 … up to 10 min.
  var fullWait = 30e3, fullTimer = null;
  function prepFull() {
    fullReady = false; clearTimeout(fullTimer);
    AdMob.prepareInterstitial({ adId: IDS.interstitial, isTesting: TEST }).then(function () { fullReady = true; fullWait = 30e3; }, function () {
      fullTimer = setTimeout(prepFull, fullWait); fullWait = Math.min(fullWait * 2, 600e3);
    });
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
    // Says whether one was shown, so a turn without a loaded ad can pass it on to the next.
    interstitialNative: function () { if (!(ready && fullReady)) return false; fullReady = false; AdMob.showInterstitial().catch(prepFull); return true; },
    // Where the law asks for it, the player can open the consent form again from Settings.
    privacyNeeded: function () { return privacy; },
    privacyForm: function () { return AdMob.showPrivacyOptionsForm(); }
  };
})();

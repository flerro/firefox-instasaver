var instasaver = (function(){

	function Instasaver(){	

		var me = this;

		var alertService = Components.classes['@mozilla.org/alerts-service;1']
	              				.getService(Components.interfaces.nsIAlertsService);
	              				
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		
		var consoleService = Components.classes['@mozilla.org/consoleservice;1']
								.getService(Components.interfaces.nsIConsoleService);

		var prefsService = Components.classes['@mozilla.org/preferences-service;1']
								.getService(Components.interfaces.nsIPrefBranch);

		// ------------------------------------------------------------  Utils
		
		var Alert = {
			OK: "notify-ok.png",
			ERROR: "notify-error.png"
		};

		var notifyErrorsOnly = function() {
			var defaultPropValue = false;
			try {
				return prefsService.getBoolPref("extensions.instasaver.notifyErrorsOnly");
			} catch (err) {
				return defaultPropValue;
			}
		};

		var minimalSkin = function() {
			var defaultPropValue = true;
			try {
				return  prefsService.getBoolPref("extensions.instasaver.minimalSkin");
			} catch (err) {
				return defaultPropValue;
			}
		};

		var hideUrlbarButton = function() {
			var defaultPropValue = false;
			try {
				return prefsService.getBoolPref("extensions.instasaver.hideUrlbarButton");
			} catch (err) {
				return false;
			}
		};

		var findBookmark = function() {
			var url = content.document.URL;
			var title = content.document.title;

			if (!url) {	 	
				notify(fromBundle("invalid_url"), Alert.ERROR);						
				return;
			}

			if (url.toString().indexOf('http://') != 0 && url.toString().indexOf('https://') != 0){
				notify(fromBundle("invalid_url"), Alert.ERROR);						
				return;
			}

			return { title: title, url: url };
		};

		var log = function(msg) {
			try {
				// about:config  -- Set devtools.errorconsole.enabled to true
				consoleService.logStringMessage(msg);
			} catch(err) {
				// ignore error 
			}
		};

		var fromBundle = function(msg){
			try {
				return document.getElementById("instasaver-strings").getString(msg);
			} catch (e) {
				return msg
			}
		};
	
		var notify = function(msg, icon, clickable) {
			var title = "Instasaver";
			var image = 'chrome://instasaver/skin/' + icon;
			var listener = (clickable) ? me : null;
			try {
				alertService.showAlertNotification(image, title, msg, clickable, '', listener);
			} catch(e) {
				log(e.toString());
				// prevents runtime error on platforms that don't implement nsIAlertsService
				var win = Components.classes['@mozilla.org/embedcomp/window-watcher;1'].
                      getService(Components.interfaces.nsIWindowWatcher).
                      openWindow(null, 'chrome://global/content/alerts/alert.xul',
                                  '_blank', 'chrome,titlebar=no,popup=yes', null);
  				win.arguments = [image, title, msg, clickable, '', listener];
			}
		};

		var openOrReuseTab = function (url) {
			  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								 .getService(Components.interfaces.nsIWindowMediator);
			  var browserEnumerator = wm.getEnumerator("navigator:browser");

			  // Check each browser instance for our URL
			  var found = false;
			  while (!found && browserEnumerator.hasMoreElements()) {
				var browserWin = browserEnumerator.getNext();
				var tabbrowser = browserWin.gBrowser;

				// Check each tab of this browser instance
				var numTabs = tabbrowser.browsers.length;
				for (var index = 0; index < numTabs; index++) {
				  var currentBrowser = tabbrowser.getBrowserAtIndex(index);
				  if (url == currentBrowser.currentURI.spec) {
					tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];
					browserWin.focus();
					found = true;
					break;
				  }
				}
			  }

			  // Our URL isn't open. Open it now.
			  if (!found) {
				var recentWindow = wm.getMostRecentWindow("navigator:browser");
				if (recentWindow) {
				  recentWindow.delayedOpenTab(url, null, null, null, null);
				}
				else {
				  window.open(url);
				}
			  }
		};



		var urlbarNotifier = {
			submitting: false,
			idle: function(){
				this.submitting = false;
				if (hideUrlbarButton()) {
					this.update("");
				} else {
					var suffix = minimalSkin() ? "" : "-old";
					this.update("urlbar-button" + suffix + ".png");
				}
			},
			running: function(){
				this.submitting = true;
				this.update("urlbar-loading.gif");
			},
			success: function(){
				this.submitting = true;
				this.update("urlbar-check.png");
			},
			done: function(){
				this.submitting = true;
				var obj = this;
				this.success();
				setTimeout(function(){ obj.idle() }, 1500);
			},
			update: function(image) {
				var path = 'chrome://instasaver/skin/';
				document.getElementById("instasaver-submit-button").src = path + image
			}
		};

		// ------------------------------------------------------------ Privileged 

		this.observe = function(subject, topic, data) {
			if (topic == "alertclickcallback") {
				this.prefs();
			}
		};
		
		this.findLogin = function() {
			var logins;
			try {
				logins = loginManager.findLogins({}, 'chrome://instasaver', null, 'Instapaper Registration');
				return logins[0];
			} catch (err) {
				log("No login found");
				return logins;
			}
		};

		this.storePrefs = function(notifyErrors, minimalSkin, hideButton) {
			prefsService.setBoolPref("extensions.instasaver.notifyErrorsOnly", notifyErrors);
			prefsService.setBoolPref("extensions.instasaver.minimalSkin", minimalSkin);
			prefsService.setBoolPref("extensions.instasaver.hideUrlbarButton", hideButton);
		};

		this.storeLogin = function(username, password) {
			try {
				var login = this.findLogin();
				if (login) {
					loginManager.removeLogin(login);
				}

				if (username && username != "") {
					var LoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
						                            	Components.interfaces.nsILoginInfo, "init");
					var instapaperLogin = new LoginInfo('chrome://instasaver', 
														null, 'Instapaper Registration',
														username, password, "","");	
					loginManager.addLogin(instapaperLogin);
				} 

				if (!notifyErrorsOnly()) {
					notify(fromBundle("login_stored"), Alert.OK);
				}
				
			} catch (err) {
				var msg = fromBundle("problem_storing_login") + ": " + err.message;
				notify(msg, Alert.ERROR, true);
				log("Problem storing [" + username + "]: " + err.toString());
			}
		};

		this.validateLogin = function(username, password) {	
			var dest =  "https://www.instapaper.com/api/authenticate?"
							+ 'username=' + encodeURIComponent(username)
							+ '&password=' + encodeURIComponent(password);
						
			try {				
				var req = new XMLHttpRequest(); 
				req.onreadystatechange = function (aEvt) { 
				   if (req.readyState == 4) {
						if(req.status == 200) {
							notify(fromBundle("valid_user"), Alert.OK, false);
						} else {
						  	notify(fromBundle(req.status), Alert.ERROR, (req.status == 403));
						} 
				 	}  
				};

				req.open('POST', dest, true);
				req.send();
			} catch (err) {
				var msg = fromBundle("problem_checking_login") + ": " + err.message;
				notify(msg, Alert.ERROR, true);
				log("Problem checking credentials " + err.toString());
			}
		};
		
		this.readLater = function(){
			var bookmark = findBookmark();
			if (!bookmark) {
				log("No bookmark found...");	
			 	return;
			}

			var login;
			try {
				login = this.findLogin();
			} catch (err){
				log(err.toString());
			}

			// one more chance to input user / password
			if (!login){
				this.prefs();
				try {
					login = this.findLogin();
				} catch (err){
					log(err.toString());
				}
			}
		
			if (!login) {				
				log("Unable to find credentials...");	
			 	return;
			}
		
			var dest =  "https://www.instapaper.com/api/add?"
							+ 'username=' + encodeURIComponent(login.username)
							+ '&password=' + encodeURIComponent(login.password)
							+ '&url=' + encodeURIComponent(bookmark.url)
							+ '&title=' + encodeURIComponent(bookmark.title);

			urlbarNotifier.running()

 			var req = new XMLHttpRequest();
			req.onreadystatechange = function (aEvt) {  
				if (req.readyState == 4) {
					switch (req.status) {
						case 201:
								urlbarNotifier.done();
								if (!notifyErrorsOnly()) {
									var what = (bookmark.title) ? bookmark.title : bookmark.url;
									var msg = fromBundle('saved') + ' "' + what.substring(0, 30) + '"...';
									notify(msg, Alert.OK, false);
								}
								break;
						default: 
								urlbarNotifier.idle();
								var shouldChangeCredentials = req.status == 403;
								notify(fromBundle(req.status), Alert.ERROR, shouldChangeCredentials);
								break;
					}

				}
			};

			req.open('POST', dest, true);
			req.send();
		};

		this.prefs = function(){
			window.openDialog("chrome://instasaver/content/options.xul", "", "resizable=no,chrome,centerscreen,modal");
		};

		this.visit = function(){
			openOrReuseTab("http://www.instapaper.com/u");
		};

		this.about = function(){
			window.open("chrome://instasaver/content/about.xul", "", "resizable=no,chrome,centerscreen,modal");
		};

		this.readIt = function(){
			var bookmark = findBookmark();
			if (!bookmark) {
				log("No bookmark found...");	
			 	return;
			}

			openOrReuseTab("http://www.instapaper.com/text?u=" + encodeURIComponent(bookmark.url));
		};

		this.initUrlbarIcon = function() {
			if (!urlbarNotifier.submitting) {
				urlbarNotifier.idle();
			}
		};

	} // end constructor

	return new Instasaver();	
})();
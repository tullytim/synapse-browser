/**
 * MIT License
 *
 * Copyright (c) 2025 Tim Tully <tim@menlovc.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const { app, BrowserWindow, ipcMain, globalShortcut, dialog, Menu, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const CONFIG = require('./config.js');

// Global bookmarks array for menu
let currentBookmarks = [];
let bookmarksBarVisible = true;

// Set up file logging for Windows debugging
const logFile = path.join(app.getPath('userData'), 'debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(...args) {
  const message = args.join(' ');
  console.log(...args);
  logStream.write(`[${new Date().toISOString()}] ${message}\n`);
}

// Override console.log and console.error
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  originalLog(...args);
  logStream.write(`[${new Date().toISOString()}] LOG: ${args.join(' ')}\n`);
};
console.error = (...args) => {
  originalError(...args);
  logStream.write(`[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`);
};

log('App starting...', 'Platform:', process.platform, 'Version:', app.getVersion());

// Determine remote debugging port once and share across modules
const chooseRemoteDebugPort = () => {
  const explicitPort = process.env.DEBUG_PORT || process.env.REMOTE_DEBUG_PORT;
  if (explicitPort) {
    const parsed = parseInt(explicitPort, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      process.env.DEBUG_PORT = String(parsed);
      process.env.REMOTE_DEBUG_PORT = String(parsed);
      return parsed;
    }
  }

  // Pick a high, less common port to avoid bot detection scanners (default 9222)
  const min = 30000;
  const max = 50000;
  const randomPort = Math.floor(Math.random() * (max - min + 1)) + min;
  process.env.DEBUG_PORT = String(randomPort);
  process.env.REMOTE_DEBUG_PORT = String(randomPort);
  return randomPort;
};

const remoteDebugPort = chooseRemoteDebugPort();
log('Remote debugging port set to', remoteDebugPort);

const CHROME_FULL_VERSION = '142.0.7444.52';
const USER_AGENT_VERSION = '142.0.0.0';
const CHROME_MAJOR_VERSION = CHROME_FULL_VERSION.split('.')[0];
const NOT_A_BRAND_VERSION = '8';
const DEFAULT_USER_AGENT = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${USER_AGENT_VERSION} Safari/537.36`;
const SEC_CH_UA = `"Google Chrome";v="${CHROME_MAJOR_VERSION}", "Not?A_Brand";v="${NOT_A_BRAND_VERSION}", "Chromium";v="${CHROME_MAJOR_VERSION}"`;
const SEC_CH_UA_FULL_VERSION = `"Google Chrome";v="${CHROME_FULL_VERSION}", "Not?A_Brand";v="${NOT_A_BRAND_VERSION}.0.0.0", "Chromium";v="${CHROME_FULL_VERSION}"`;
const SEC_CH_UA_PLATFORM_VERSION = '"15.7.0"';
const DEFAULT_ACCEPT_HEADER = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
const DEFAULT_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';
const DEFAULT_ACCEPT_ENCODING = 'gzip, deflate, br';

function buildChromeRequestHeaders(oldHeaders, resourceType) {
  const headers = { ...oldHeaders };
  headers['sec-ch-ua'] = SEC_CH_UA;
  headers['sec-ch-ua-mobile'] = '?0';
  headers['sec-ch-ua-platform'] = '"macOS"';

  if (resourceType === 'mainFrame' || resourceType === 'subFrame') {
    headers['Upgrade-Insecure-Requests'] = '1';
  } else if (!headers['Upgrade-Insecure-Requests']) {
    delete headers['Upgrade-Insecure-Requests'];
  }

  headers['User-Agent'] = DEFAULT_USER_AGENT;
  headers['Accept'] = headers['Accept'] || DEFAULT_ACCEPT_HEADER;
  headers['Accept-Encoding'] = DEFAULT_ACCEPT_ENCODING;
  headers['Accept-Language'] = DEFAULT_ACCEPT_LANGUAGE;

  return headers;
}

const AD_BLOCK_RULES = require('./ad-blocker-rules.js');
const TRACKER_BLOCK_RULES = require('./tracker-blocker-rules.js');
const ComputerUseController = require('./computer-use.js');
const AutomationManager = require('./automation-manager.js');

// Configure auto-updater
autoUpdater.logger = {
  info: (...args) => log('AutoUpdater:', ...args),
  warn: (...args) => log('AutoUpdater WARN:', ...args),
  error: (...args) => log('AutoUpdater ERROR:', ...args)
};

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  log('Checking for updates...');
  notifyAllWindows('update-checking');
});

autoUpdater.on('update-available', (info) => {
  log('Update available:', info.version);
  notifyAllWindows('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  log('Update not available. Current version:', info.version);
  notifyAllWindows('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  log('Error in auto-updater:', err);
  notifyAllWindows('update-error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  log(`Download progress: ${progressObj.percent}%`);
  notifyAllWindows('update-download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  log('Update downloaded:', info.version);
  notifyAllWindows('update-downloaded', info);
});

// Helper function to notify all windows
function notifyAllWindows(channel, data) {
  windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

// Set the application name (must be before app.ready)
app.name = CONFIG.BROWSER_NAME;

let windows = new Set();
let apiKey = process.env.ANTHROPIC_API_KEY || '';
let inceptionApiKey = '';
let gpuAccelerationEnabled = true; // Force enabled for WebGL support (critical for bot detection)
let adBlockerEnabled = true; // Default to enabled
let trackerBlockerEnabled = true; // Default to enabled

// Settings file path
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Function to set up ad blocking
function setupAdBlocker(ses) {
  // Block requests to ad domains
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (!adBlockerEnabled) {
      callback({});
      return;
    }

    // Check if the URL matches any blocked domain
    const url = new URL(details.url);

    // Comprehensive whitelist for YouTube to prevent any playback issues
    const youtubeWhitelist = [
      'youtube.com',
      'youtubei.com',
      'youtube-nocookie.com',
      'googlevideo.com',
      'ytimg.com',
      'ggpht.com',
      'googleusercontent.com',
      'gstatic.com',
      'youtube.googleapis.com',
      'googleapis.com',
      'google.com'
    ];

    // Whitelist for LinkedIn to prevent breaking messaging and core features
    const linkedinWhitelist = [
      'linkedin.com',
      'licdn.com',
      'linkedin-ei.com',
      'lnkd.in'
    ];

    // Check if this is a YouTube-related request
    const isYouTube = youtubeWhitelist.some(domain =>
      url.hostname === domain ||
      url.hostname.endsWith('.' + domain)
    );

    // Check if this is a LinkedIn-related request
    const isLinkedIn = linkedinWhitelist.some(domain =>
      url.hostname === domain ||
      url.hostname.endsWith('.' + domain)
    );

    // If it's YouTube or LinkedIn, don't block anything
    if (isYouTube || isLinkedIn) {
      callback({});
      return;
    }

    // Check if it should be blocked
    const shouldBlock = AD_BLOCK_RULES.domains.some(domain =>
      url.hostname.includes(domain)
    ) || AD_BLOCK_RULES.urlPatterns.some(pattern => {
      // Simple pattern matching for URLs
      const regex = pattern.replace(/\*/g, '.*').replace(/[?+.()[\]{}|^$]/g, '\\$&');
      return new RegExp(regex).test(details.url);
    });

    if (shouldBlock) {
      callback({ cancel: true });
    } else {
      callback({});
    }
  });
}

// Function to set up tracker blocking
function setupTrackerBlocker(ses) {
  // Block requests to tracking pixels, beacons, and analytics
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (!trackerBlockerEnabled) {
      callback({});
      return;
    }

    // NEVER block main frame navigations (when user visits a site directly)
    if (details.resourceType === 'mainFrame') {
      callback({});
      return;
    }

    // Check if the URL matches any blocked domain
    const url = new URL(details.url);

    // Whitelist for CAPTCHA services and bot detection (critical - never block these)
    const captchaWhitelist = TRACKER_BLOCK_RULES.whitelist;

    // Check if this is a CAPTCHA or bot detection request
    const isCaptcha = captchaWhitelist.some(domain =>
      url.hostname.includes(domain) || details.url.includes(domain)
    );

    // If it's a CAPTCHA, don't block it
    if (isCaptcha) {
      callback({});
      return;
    }

    // Comprehensive whitelist for YouTube to prevent any playback issues
    const youtubeWhitelist = [
      'youtube.com',
      'youtubei.com',
      'youtube-nocookie.com',
      'googlevideo.com',
      'ytimg.com',
      'ggpht.com',
      'googleusercontent.com',
      'gstatic.com',
      'youtube.googleapis.com',
      'googleapis.com',
      'google.com'
    ];

    // Check if this is a YouTube-related request
    const isYouTube = youtubeWhitelist.some(domain =>
      url.hostname === domain ||
      url.hostname.endsWith('.' + domain)
    );

    // If it's YouTube, don't block anything
    if (isYouTube) {
      callback({});
      return;
    }

    // Check if this is a third-party request
    // For subresources, we want to block only third-party trackers
    let isThirdParty = false;
    if (details.referrer) {
      try {
        const referrerUrl = new URL(details.referrer);
        // Extract base domain (e.g., "example.com" from "www.example.com")
        const getBaseDomain = (hostname) => {
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            return parts.slice(-2).join('.');
          }
          return hostname;
        };

        const requestBaseDomain = getBaseDomain(url.hostname);
        const referrerBaseDomain = getBaseDomain(referrerUrl.hostname);

        isThirdParty = requestBaseDomain !== referrerBaseDomain;
      } catch (e) {
        // If we can't parse referrer, assume it might be third-party
        isThirdParty = true;
      }
    } else {
      // No referrer - could be direct navigation or stripped referrer
      // For tracking endpoints, still block if no referrer
      isThirdParty = true;
    }

    // Only check domain blocking for third-party requests
    let shouldBlock = false;

    // Check specific tracking endpoints first (these are always suspicious)
    const matchesTrackingPattern = TRACKER_BLOCK_RULES.urlPatterns.some(pattern => {
      // Simple pattern matching for URLs
      const regex = pattern.replace(/\*/g, '.*').replace(/[?+.()[\]{}|^$]/g, '\\$&');
      return new RegExp(regex).test(details.url);
    });

    // Block if it matches a tracking pattern OR if it's a third-party request to a tracking domain
    if (matchesTrackingPattern) {
      shouldBlock = true;
    } else if (isThirdParty) {
      // Only check domain blocking for third-party requests
      shouldBlock = TRACKER_BLOCK_RULES.domains.some(domain =>
        url.hostname.includes(domain)
      );
    }

    // Also block ping/beacon resource types (these are always tracking)
    if (TRACKER_BLOCK_RULES.resourceTypes.includes(details.resourceType)) {
      shouldBlock = true;
    }

    if (shouldBlock) {
      callback({ cancel: true });
    } else {
      callback({});
    }
  });
}

// Window bounds settings
let savedWindowBounds = null;

// Load settings
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.apiKey) {
        apiKey = settings.apiKey;
      }
      if (settings.inceptionApiKey) {
        inceptionApiKey = settings.inceptionApiKey;
      }
      // Force GPU acceleration to always be enabled (critical for WebGL/bot detection)
      // if (settings.gpuAccelerationEnabled !== undefined) {
      //   gpuAccelerationEnabled = settings.gpuAccelerationEnabled;
      // }
      gpuAccelerationEnabled = true;
      if (settings.windowBounds) {
        savedWindowBounds = settings.windowBounds;
      }
      if (settings.adBlockerEnabled !== undefined) {
        adBlockerEnabled = settings.adBlockerEnabled;
      }
      if (settings.trackerBlockerEnabled !== undefined) {
        trackerBlockerEnabled = settings.trackerBlockerEnabled;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings
function saveSettings() {
  try {
    const settings = {
      apiKey,
      inceptionApiKey,
      gpuAccelerationEnabled,
      adBlockerEnabled,
      trackerBlockerEnabled,
      windowBounds: savedWindowBounds
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}


function createWindow(isIncognito = false) {
  // Use saved window bounds or defaults
  const windowConfig = {
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      nativeWindowOpen: true,
      partition: isIncognito ? 'incognito-' + Date.now() : 'persist:main',
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  };

  // macOS-specific window styling
  if (process.platform === 'darwin') {
    windowConfig.titleBarStyle = 'hiddenInset';
    windowConfig.trafficLightPosition = { x: 12, y: 12 };
  }

  // Apply saved bounds if available (only for non-incognito windows)
  if (!isIncognito && savedWindowBounds) {
    windowConfig.width = savedWindowBounds.width;
    windowConfig.height = savedWindowBounds.height;
    if (savedWindowBounds.x !== undefined && savedWindowBounds.y !== undefined) {
      windowConfig.x = savedWindowBounds.x;
      windowConfig.y = savedWindowBounds.y;
    }
    if (savedWindowBounds.isMaximized) {
      // Will maximize after creation
    }
  }

  const newWindow = new BrowserWindow(windowConfig);

  windows.add(newWindow);

  // Set Content Security Policy headers only for main frame
  newWindow.webContents.session.webRequest.onHeadersReceived({ urls: ['file://*'], resourceType: ['mainFrame'] }, (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.anthropic.com wss: ws:; font-src 'self'; frame-src *;"]
      }
    });
  });

  newWindow.loadFile('index.html');

  // Log renderer errors
  newWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Renderer console [${level}]: ${message}`);
  });

  newWindow.webContents.on('crashed', () => {
    console.error('Window crashed!');
    dialog.showErrorBox('Renderer Crashed', 'The renderer process has crashed');
  });

  // Maximize if it was maximized before
  if (!isIncognito && savedWindowBounds && savedWindowBounds.isMaximized) {
    newWindow.maximize();
  }

  // Save window bounds on resize/move (only for non-incognito windows)
  if (!isIncognito) {
    let saveTimer;
    const saveBounds = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const bounds = newWindow.getBounds();
        savedWindowBounds = {
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: newWindow.isMaximized()
        };
        saveSettings();
      }, 500); // Debounce saving
    };

    newWindow.on('resize', saveBounds);
    newWindow.on('move', saveBounds);
    newWindow.on('maximize', () => {
      savedWindowBounds = {
        ...savedWindowBounds,
        isMaximized: true
      };
      saveSettings();
    });
    newWindow.on('unmaximize', () => {
      savedWindowBounds = {
        ...savedWindowBounds,
        isMaximized: false
      };
      saveSettings();
    });
  }

  // Store incognito state
  newWindow.isIncognito = isIncognito;

  // Once the window is ready, send incognito state to renderer and focus
  newWindow.webContents.once('did-finish-load', () => {
    newWindow.webContents.send('set-incognito-mode', isIncognito);
    // Focus the window to ensure address bar gets focus
    newWindow.focus();
  });

  // Don't auto-open DevTools for browser chrome
  // if (process.argv.includes('--dev')) {
  //   newWindow.webContents.openDevTools();
  // }

  // Intercept new window creation from webviews
  newWindow.webContents.on('did-attach-webview', (_, webContents) => {
    webContents.setWindowOpenHandler((details) => {
      // Allow popup windows to open (for OAuth)
      if (details.disposition === 'new-window') {
        return { action: 'allow' };
      }

      // For other types, send to renderer to open in a new tab
      newWindow.webContents.send('open-in-new-tab', details.url);
      return { action: 'deny' };
    });
  });

  // Handle window close to save tab state
  newWindow.on('close', (event) => {
    if (!isIncognito) {
      // Send request to renderer to check if tabs should be saved
      newWindow.webContents.send('window-closing');
    }
  });

  newWindow.on('closed', () => {
    windows.delete(newWindow);
  });

  // Rebuild menu when full screen state changes to update the label
  newWindow.on('enter-full-screen', () => {
    createApplicationMenu();
  });

  newWindow.on('leave-full-screen', () => {
    createApplicationMenu();
  });

  return newWindow;
}

function confirmQuit() {
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Cancel', 'Quit'],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirm Quit',
    message: `Are you sure you want to quit ${CONFIG.BROWSER_NAME}?`,
    detail: 'All open tabs and windows will be closed.'
  });

  if (choice === 1) {
    app.quit();
  }
}

function createApplicationMenu() {
  const template = [
    {
      label: 'Claude',
      submenu: [
        {
          label: `About ${CONFIG.BROWSER_NAME}`,
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            confirmQuit();
          }
        }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: process.platform === 'darwin' ? 'Cmd+N' : 'Ctrl+N',
          click: () => {
            createWindow();
          }
        },
        {
          label: 'New Incognito Window',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+N' : 'Ctrl+Shift+N',
          click: () => {
            createWindow(true);
          }
        },
        {
          label: 'New Tab',
          accelerator: process.platform === 'darwin' ? 'Cmd+T' : 'Ctrl+T',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('new-tab');
            }
          }
        },
        {
          label: 'New Incognito Tab',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('new-incognito-tab');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save Page As...',
          accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('save-page-as');
            }
          }
        },
        {
          label: 'Print...',
          accelerator: process.platform === 'darwin' ? 'Cmd+P' : 'Ctrl+P',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('print-page');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('close-current-tab');
            }
          }
        },
        {
          label: 'Close Window',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Focus Address Bar',
          accelerator: 'CmdOrCtrl+L',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('focus-address-bar');
            }
          }
        },
        { type: 'separator' },
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find in Page',
          accelerator: 'CmdOrCtrl+F',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('find-in-page');
            }
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Go Back',
          accelerator: process.platform === 'darwin' ? 'Cmd+Left' : 'Alt+Left',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('go-back');
            }
          }
        },
        {
          label: 'Go Forward',
          accelerator: process.platform === 'darwin' ? 'Cmd+Right' : 'Alt+Right',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('go-forward');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Bookmarks Bar',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+B' : 'Ctrl+Shift+B',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              bookmarksBarVisible = !bookmarksBarVisible;
              browserWindow.webContents.send('toggle-bookmarks-bar');
              createApplicationMenu();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('reload-page');
            }
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('force-reload-page');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('reset-zoom');
            }
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('zoom-in');
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('zoom-out');
            }
          }
        },
        { type: 'separator' },
        {
          label: (() => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            return (focusedWindow && focusedWindow.isFullScreen()) ? 'Exit Full Screen' : 'Enter Full Screen';
          })(),
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              const isFullScreen = browserWindow.isFullScreen();
              browserWindow.setFullScreen(!isFullScreen);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Webview Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              // Send event to renderer to toggle webview DevTools
              browserWindow.webContents.send('toggle-webview-devtools');
            }
          }
        },
        {
          label: 'Toggle App Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+J' : 'Ctrl+Shift+J',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              // Toggle the main browser window DevTools
              browserWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'View Page Source',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+U' : 'Ctrl+Alt+U',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              // Send event to renderer to view page source
              browserWindow.webContents.send('view-page-source');
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        { label: 'Close', role: 'close' }
      ]
    },
    {
      label: 'Tab',
      submenu: [
        {
          label: 'Select Next Tab',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Tab' : 'Ctrl+Tab',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('next-tab');
            }
          }
        },
        {
          label: 'Select Previous Tab',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Shift+Tab' : 'Ctrl+Shift+Tab',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('previous-tab');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Move Tab Right',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+]' : 'Ctrl+Shift+]',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('move-tab-right');
            }
          }
        },
        {
          label: 'Move Tab Left',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+[' : 'Ctrl+Shift+[',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('move-tab-left');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Duplicate Tab',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+D' : 'Ctrl+Shift+D',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('duplicate-tab');
            }
          }
        }
      ]
    },
    {
      label: 'Bookmarks',
      submenu: (() => {
        const submenu = [
          {
            label: 'Bookmark This Page',
            accelerator: process.platform === 'darwin' ? 'Cmd+D' : 'Ctrl+D',
            click: (menuItem, browserWindow) => {
              if (browserWindow) {
                browserWindow.webContents.send('bookmark-current-page');
              }
            }
          },
          {
            label: 'Show All Bookmarks',
            accelerator: process.platform === 'darwin' ? 'Cmd+Alt+B' : 'Ctrl+Alt+B',
            click: (menuItem, browserWindow) => {
              if (browserWindow) {
                browserWindow.webContents.send('show-all-bookmarks');
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Show Bookmarks Bar',
            type: 'checkbox',
            checked: bookmarksBarVisible,
            click: (menuItem, browserWindow) => {
              if (browserWindow) {
                bookmarksBarVisible = !bookmarksBarVisible;
                browserWindow.webContents.send('toggle-bookmarks-bar');
                createApplicationMenu();
              }
            }
          },
          { type: 'separator' }
        ];

        // Add bookmarks dynamically
        if (currentBookmarks && currentBookmarks.length > 0) {
          currentBookmarks.forEach(bookmark => {
            submenu.push({
              label: bookmark.title || bookmark.url,
              click: (menuItem, browserWindow) => {
                if (browserWindow) {
                  browserWindow.webContents.send('open-bookmark', bookmark.url);
                }
              }
            });
          });
        } else {
          submenu.push({
            label: 'No bookmarks yet',
            enabled: false
          });
        }

        return submenu;
      })()
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Show All History',
          accelerator: process.platform === 'darwin' ? 'Cmd+Y' : 'Ctrl+H',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('show-history');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Clear Browsing Data...',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('clear-browsing-data');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Recently Closed',
          enabled: false
        },
        {
          label: 'Reopen Closed Tab',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+T' : 'Ctrl+Shift+T',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('reopen-closed-tab');
            }
          }
        }
      ]
    }
  ];

  // On macOS, the first menu item is the app menu
  if (process.platform === 'darwin') {
    template[0] = {
      label: CONFIG.BROWSER_NAME,
      submenu: [
        { label: `About ${CONFIG.BROWSER_NAME}`, role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'Cmd+,',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('show-settings');
            }
          }
        },
        { type: 'separator' },
        { label: 'Services', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: `Hide ${CONFIG.BROWSER_NAME}`, accelerator: 'Cmd+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Cmd+Shift+H', role: 'hideothers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Cmd+Q', click: () => confirmQuit() }
      ]
    };
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Load settings early to get GPU preference before setting command line switches
loadSettings();

// Apply GPU acceleration settings
if (gpuAccelerationEnabled) {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu');
  app.commandLine.appendSwitch('enable-webgl');
  app.commandLine.appendSwitch('enable-webgl2-compute-context');
  app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

  app.commandLine.appendSwitch('enable-unsafe-webgpu');

  if (process.platform === 'darwin') {
    app.commandLine.appendSwitch('use-angle', 'metal');
    app.commandLine.appendSwitch('use-gl', 'angle');
  } else if (process.platform === 'linux') {
    app.commandLine.appendSwitch('use-gl', 'egl');
  } else {
    app.commandLine.appendSwitch('use-gl', 'any');
  }

  app.commandLine.appendSwitch('ignore-gpu-sandbox');
} else {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
  app.commandLine.appendSwitch('enable-webgl');
  app.commandLine.appendSwitch('enable-software-rasterizer');
}

app.commandLine.appendSwitch('proprietary-codec-support');
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('enable-webrtc-pipewire-capturer');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('allow-http-screen-capture');
app.commandLine.appendSwitch('enable-webrtc-srtp-aes-gcm');
app.commandLine.appendSwitch('enable-webrtc-stun-origin');

app.commandLine.appendSwitch('enable-quic');
app.commandLine.appendSwitch('enable-spdy-proxy-auth');
app.commandLine.appendSwitch('remote-debugging-port', String(remoteDebugPort));
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

if (gpuAccelerationEnabled) {
  app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess,VaapiVideoDecoder,VaapiVideoEncoder,WebGL2ComputeContext,Canvas2DImageChromium,WebGL,WebGL2');
} else {
  app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess,WebGL,WebGL2');
}

app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('user-agent', DEFAULT_USER_AGENT);

// Disable HTTP/2 to avoid header order fingerprinting
// HTTP/1.1 has less strict header ordering requirements
app.commandLine.appendSwitch('disable-http2');

app.commandLine.appendSwitch('window-size', '1200,800');
app.commandLine.appendSwitch('window-position', '0,0');

// Minimal command line configuration to reduce fingerprinting
app.commandLine.appendSwitch('remote-debugging-port', String(remoteDebugPort));
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
app.commandLine.appendSwitch('user-agent', DEFAULT_USER_AGENT);
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// CRITICAL: Attach webview preload handler at APP level (not window level)
// This ensures it catches ALL webviews across ALL windows
app.on('web-contents-created', (event, contents) => {
  // Handle webview attachment
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    // Set the preload script for anti-bot detection bypass
    const preloadPath = path.join(__dirname, 'webview-preload.js');

    webPreferences.preload = preloadPath;
    // Ensure proper settings for the preload script
    webPreferences.contextIsolation = false;
    webPreferences.nodeIntegration = false;
    // Keep webSecurity enabled - disabling breaks WebSockets on many sites (like Figma)
    webPreferences.webSecurity = true;
    // Enable hardware acceleration for WebGL (must be enabled, not disabled)
    webPreferences.disableHardwareAcceleration = false;
    // REMOVED: experimentalFeatures - detectable by bot detection systems
    // REMOVED: enableBlinkFeatures - WebGL is enabled by default in Chromium 142
    // Don't use offscreen rendering (breaks WebGL)
    webPreferences.offscreen = false;
    // Allow insecure WebSocket from HTTPS pages (some sites need this)
    webPreferences.allowRunningInsecureContent = false;
  });
});

// Add uncaught exception handlers for debugging
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  console.error('Stack:', error.stack);
  dialog.showErrorBox('Error', `An error occurred: ${error.message}\n\nLog file: ${logFile}`);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

app.whenReady().then(() => {
  // Set up permission handler for media devices (camera, microphone)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Auto-grant permissions for camera, microphone, and other media
    const allowed = [
      'media',
      'mediaKeySystem',
      'geolocation',
      'notifications',
      'camera',
      'microphone',
      'clipboard-read',
      'clipboard-write',
      'fullscreen',
      'pointerLock'
    ];

    if (allowed.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Set permission check handler to always return granted for media
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    // Always grant media permissions for Google Meet and similar services
    if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
      return true;
    }
    return false;
  });
  // Try to enable Widevine for DRM content (YouTube TV, Netflix, etc.)
  const { app } = require('electron');
  if (app.verifyWidevineCdm) {
    app.verifyWidevineCdm((isVerified) => {
    });
  }

  // Configure session to add proper headers to prevent access denied errors
  const defaultSession = session.defaultSession;

  // Enable HTTP/2 and configure session for better compatibility
  // Use Chrome 140 to match Electron version
  defaultSession.setUserAgent(DEFAULT_USER_AGENT);

  // Additional session configuration to mimic Chrome better
  defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow permissions that Chrome would normally allow
    const allowedPermissions = ['media', 'geolocation', 'notifications', 'midiSysex', 'pointerLock', 'fullscreen', 'openExternal'];
    callback(allowedPermissions.includes(permission));
  });

  // Set up request headers for the default session to match Chrome exactly
  defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = buildChromeRequestHeaders(details.requestHeaders, details.resourceType);
    callback({ requestHeaders: headers });
  });

  // Also configure for persist:browser partition (used by webviews)
  const browserSession = session.fromPartition('persist:browser');
  // Spoof as Chrome 141 (Electron 38 is based on Chromium 130, but we pretend to be newer)
  browserSession.setUserAgent(DEFAULT_USER_AGENT);

  // Enable WebGL and graphics features for this session
  browserSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    // Always allow all permissions to enable WebGL
    return true;
  });

  browserSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Grant all permissions including WebGL
    callback(true);
  });

  // Set up ad blocker for browser session
  if (adBlockerEnabled) {
    setupAdBlocker(browserSession);
  }

  // Set up tracker blocker for browser session
  if (trackerBlockerEnabled) {
    setupTrackerBlocker(browserSession);
  }

  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const oldHeaders = details.requestHeaders;

    if (oldHeaders['Upgrade'] && oldHeaders['Upgrade'].toLowerCase() === 'websocket') {
      const wsHeaders = { ...oldHeaders };
      wsHeaders['User-Agent'] = DEFAULT_USER_AGENT;
      callback({ requestHeaders: wsHeaders });
      return;
    }

    callback({ requestHeaders: buildChromeRequestHeaders(oldHeaders, details.resourceType) });
  });

  // Set the dock icon for macOS
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'assets', 'icons/icon-mac-512x512.png'));
  }

  // Set up download tracking
  const downloads = new Map();

  // Helper function to handle downloads
  const handleDownload = (event, item, webContents) => {
    const downloadId = Date.now() + Math.random();
    const fileName = item.getFilename();
    const totalBytes = item.getTotalBytes();
    const startTime = Date.now();

    downloads.set(downloadId, {
      id: downloadId,
      fileName,
      totalBytes,
      receivedBytes: 0,
      state: 'progressing',
      startTime,
      path: null
    });

    // Send initial download started event to all windows
    BrowserWindow.getAllWindows().forEach(window => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('download-started', {
          id: downloadId,
          fileName,
          totalBytes,
          receivedBytes: 0,
          state: 'progressing'
        });
      }
    });

    // Update progress
    item.on('updated', (event, state) => {
      const download = downloads.get(downloadId);
      if (download) {
        download.receivedBytes = item.getReceivedBytes();
        download.state = state;

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? download.receivedBytes / elapsed : 0;
        const remaining = totalBytes > 0 && speed > 0 ? (totalBytes - download.receivedBytes) / speed : 0;

        BrowserWindow.getAllWindows().forEach(window => {
          if (window && !window.isDestroyed()) {
            window.webContents.send('download-progress', {
              id: downloadId,
              fileName,
              totalBytes,
              receivedBytes: download.receivedBytes,
              state,
              speed,
              timeRemaining: remaining
            });
          }
        });
      }
    });

    // Download completed
    item.once('done', (event, state) => {
      const download = downloads.get(downloadId);
      if (download) {
        download.state = state;
        download.path = state === 'completed' ? item.getSavePath() : null;

        BrowserWindow.getAllWindows().forEach(window => {
          if (window && !window.isDestroyed()) {
            window.webContents.send('download-done', {
              id: downloadId,
              fileName,
              state,
              path: download.path
            });
          }
        });
      }
    });
  };

  // Listen for downloads on default session
  session.defaultSession.on('will-download', handleDownload);

  // Listen for downloads on browser session (used by webviews)
  browserSession.on('will-download', handleDownload);

  // Create application menu
  createApplicationMenu();

  try {
    createWindow();
  } catch (error) {
    console.error('Error creating window:', error);
    dialog.showErrorBox('Startup Error', `Failed to create window: ${error.message}`);
  }

  // Check for updates on app startup (wait 3 seconds for app to fully initialize)
  if (!process.env.DEVELOPMENT) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        log('Auto-update check failed:', err);
      });
    }, 3000);
  }
}).catch(error => {
  console.error('App ready error:', error);
  dialog.showErrorBox('Startup Error', `Failed to initialize app: ${error.message}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Track if we're already quitting to prevent infinite loops
let isQuitting = false;

// Force cleanup before quit (helps with Windows installer)
app.on('before-quit', (event) => {
  if (isQuitting) {
    return; // Already handling quit
  }

  event.preventDefault();
  isQuitting = true;

  // Perform cleanup synchronously
  const cleanup = () => {
    // Disconnect automation and close Chrome/Puppeteer processes
    if (automationManager) {
      try {
        automationManager.disconnect();
      } catch (e) {
        // Ignore errors during shutdown
      }
    }

    // Close all windows forcefully
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(window => {
      try {
        if (!window.isDestroyed()) {
          window.destroy();
        }
      } catch (e) {
        // Ignore
      }
    });

    // On Windows, kill any lingering Chrome/Puppeteer processes
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');
        // Kill any Chrome processes spawned by this app
        execSync('taskkill /F /IM chrome.exe /T 2>nul', { windowsHide: true });
      } catch (e) {
        // Ignore - process might not exist
      }
    }

    // Force exit immediately
    process.exit(0);
  };

  // Give a brief moment for cleanup, then force exit
  setTimeout(cleanup, 100);
});

// Handle Windows close/logout/shutdown
app.on('will-quit', (event) => {
  if (isQuitting) {
    return;
  }
  event.preventDefault();
  isQuitting = true;

  // Force kill everything
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      execSync('taskkill /F /IM chrome.exe /T 2>nul', { windowsHide: true });
    } catch (e) {
      // Ignore
    }
  }

  process.exit(0);
});

app.on('activate', () => {
  if (windows.size === 0) {
    createWindow();
  }
});

// Track active Claude streams per window
const activeClaudeStreams = new Map();

// Handle Inception Labs API requests from renderer with streaming
ipcMain.handle('inception-search-stream', async (event, query, model) => {
  if (!inceptionApiKey) {
    event.sender.send('inception-stream-error', { error: 'Please set Inception Labs API key in Settings' });
    return;
  }

  try {
    const https = require('https');

    const postData = JSON.stringify({
      model: 'mercury',
      messages: [
        { role: 'user', content: query }
      ],
      max_tokens: 16384,
      stream: true
    });

    const options = {
      hostname: 'api.inceptionlabs.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inceptionApiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let fullContent = '';

      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              event.sender.send('inception-stream-end', { fullContent });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                event.sender.send('inception-stream-chunk', { text: content });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      });

      res.on('end', () => {
        event.sender.send('inception-stream-end', { fullContent });
      });
    });

    req.on('error', (error) => {
      event.sender.send('inception-stream-error', { error: error.message });
    });

    req.write(postData);
    req.end();
  } catch (error) {
    event.sender.send('inception-stream-error', { error: error.message });
  }
});

// Handle Claude API requests from renderer with streaming
ipcMain.handle('claude-search-stream', async (event, query, model) => {
  if (!apiKey) {
    event.sender.send('claude-stream-error', { error: 'Please set ANTHROPIC_API_KEY environment variable' });
    return;
  }

  // Cancel any existing stream for this sender
  const senderId = event.sender.id;
  if (activeClaudeStreams.has(senderId)) {
    const previousController = activeClaudeStreams.get(senderId);
    previousController.abort = true;  // Set abort flag
    activeClaudeStreams.delete(senderId);
  }

  // Create a control object for this stream
  const streamController = { abort: false, streamId: Date.now() };
  activeClaudeStreams.set(senderId, streamController);

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const stream = await anthropic.messages.create({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Please provide a helpful response to this search query: "${query}". Format your response in HTML for display in a browser. Provide ONLY the HTML content without any markdown code blocks or backticks. Do not wrap the HTML in \`\`\`html tags.`
      }],
      stream: true
    });

    let fullContent = '';

    for await (const chunk of stream) {
      // Check if this stream has been aborted
      if (streamController.abort) {
        break;
      }

      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullContent += chunk.delta.text;

        // Only send if not aborted
        if (!streamController.abort) {
          event.sender.send('claude-stream-chunk', { text: chunk.delta.text });
        }
      }
    }

    // Only send end event if not aborted
    if (!streamController.abort) {
      event.sender.send('claude-stream-end', { fullContent });
    }

    // Clean up
    if (activeClaudeStreams.get(senderId) === streamController) {
      activeClaudeStreams.delete(senderId);
    }

  } catch (error) {
    // Clean up on error
    if (activeClaudeStreams.get(senderId) === streamController) {
      activeClaudeStreams.delete(senderId);
    }

    event.sender.send('claude-stream-error', { error: error.message });
  }
});

// Handle page summarization requests with streaming
ipcMain.handle('summarize-page-stream', async (event, pageText, model, customPrompt = null) => {
  const isInception = model === 'mercury';

  if (isInception) {
    // Use Inception Labs API
    if (!inceptionApiKey) {
      event.sender.send('summary-stream-error', { error: 'Please set Inception Labs API key in Settings' });
      return;
    }

    try {
      const https = require('https');

      let prompt;
      if (customPrompt) {
        prompt = `${customPrompt}\n\nWebpage content:\n${pageText.substring(0, 10000)}`;
      } else {
        prompt = `Please provide a concise summary of the following webpage content. Focus on the main points and key information. Format your response in clear, well-structured markdown:\n\n${pageText.substring(0, 10000)}`;
      }

      const requestBody = JSON.stringify({
        model: 'mercury',
        messages: [{
          role: 'user',
          content: prompt
        }],
        stream: true
      });

      const options = {
        hostname: 'api.inceptionlabs.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${inceptionApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      let fullContent = '';

      const req = https.request(options, (res) => {
        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data === '[DONE]') {
                event.sender.send('summary-stream-end', { fullContent });
                return;
              }
              try {
                const parsed = JSON.parse(data);
                // Inception Labs uses OpenAI-compatible streaming format
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  event.sender.send('summary-stream-chunk', { text: content });
                }
              } catch (e) {
                // Ignore parse errors for non-JSON lines
              }
            }
          }
        });

        res.on('end', () => {
          event.sender.send('summary-stream-end', { fullContent });
        });
      });

      req.on('error', (error) => {
        event.sender.send('summary-stream-error', { error: error.message });
      });

      req.write(requestBody);
      req.end();

    } catch (error) {
      event.sender.send('summary-stream-error', { error: error.message });
    }
  } else {
    // Use Anthropic API
    if (!apiKey) {
      event.sender.send('summary-stream-error', { error: 'Please set ANTHROPIC_API_KEY environment variable' });
      return;
    }

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: apiKey,
      });

      let prompt;
      if (customPrompt) {
        prompt = `${customPrompt}\n\nWebpage content:\n${pageText.substring(0, 10000)}`;
      } else {
        prompt = `Please provide a concise summary of the following webpage content. Focus on the main points and key information. Format your response in clear, well-structured HTML suitable for display:\n\n${pageText.substring(0, 10000)}`;
      }

      const stream = await anthropic.messages.create({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }],
        stream: true
      });

      let fullContent = '';

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          event.sender.send('summary-stream-chunk', { text: chunk.delta.text });
        }
      }

      event.sender.send('summary-stream-end', { fullContent });

    } catch (error) {
      event.sender.send('summary-stream-error', { error: error.message });
    }
  }
});

// Handle API key setting
ipcMain.handle('set-api-key', async (event, key) => {
  apiKey = key;
  saveSettings();
  return { success: true };
});

ipcMain.handle('get-api-key-status', async () => {
  return { hasKey: !!apiKey };
});

ipcMain.handle('get-inception-api-key-status', async () => {
  return { hasKey: !!inceptionApiKey };
});

// Handle getting current API key (for settings page)
ipcMain.handle('get-api-key', async () => {
  return { apiKey: apiKey };
});

// Handle Inception Labs API key
ipcMain.handle('get-inception-api-key', async () => {
  return { apiKey: inceptionApiKey };
});

ipcMain.handle('set-inception-api-key', async (event, key) => {
  inceptionApiKey = key;
  saveSettings();
  return { success: true };
});

// Handle new window request
ipcMain.handle('new-window', async () => {
  createWindow();
  return { success: true };
});

// Handle new incognito window request
ipcMain.handle('new-incognito-window', async () => {
  createWindow(true);
  return { success: true };
});

// Handle new incognito window with URL request
ipcMain.handle('new-incognito-window-with-url', async (event, url) => {
  const newWindow = createWindow(true); // true for incognito

  // Wait for window to be ready, then send URL to load
  newWindow.webContents.once('did-finish-load', () => {
    newWindow.webContents.executeJavaScript(`
      setTimeout(() => {
        if (window.tabManager) {
          window.tabManager.addressBar.value = '${url.replace(/'/g, "\\'")}';
          window.tabManager.navigate();
        }
      }, 500);
    `);
  });

  return { success: true };
});

// Handle new window with URL request
ipcMain.handle('new-window-with-url', async (event, url) => {
  const newWindow = createWindow();
  
  // Wait for window to be ready, then send URL to load
  newWindow.webContents.once('did-finish-load', () => {
    newWindow.webContents.executeJavaScript(`
      setTimeout(() => {
        if (window.tabManager) {
          window.tabManager.addressBar.value = '${url.replace(/'/g, "\\'")}';
          window.tabManager.navigate();
        }
      }, 500);
    `);
  });
  
  return { success: true };
});

// Handle Chromecast functionality
ipcMain.handle('start-cast', async (event, url, title) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { desktopCapturer, systemPreferences } = require('electron');
    
    // First try to use the webview's built-in casting if available
    // This checks if the webview (not the page) supports casting
    const webview = await event.sender.executeJavaScript(`
      const activeWebview = document.querySelector('.tab-content.active .tab-webview');
      if (activeWebview) {
        // Try to access media devices to trigger system cast
        activeWebview.executeJavaScript(\`
          // Check for presentation API
          if (navigator.presentation && navigator.presentation.defaultRequest) {
            navigator.presentation.defaultRequest.start()
              .then(connection => {})
              .catch(err => console.error('Presentation error:', err));
          }
          // Check for remote playback API (for video elements)
          const videos = document.querySelectorAll('video');
          if (videos.length > 0 && videos[0].remote) {
            videos[0].remote.prompt()
              .then(() => {})
              .catch(err => console.error('Remote playback error:', err));
          }
        \`).catch(err => false);
        true;
      } else {
        false;
      }
    `).catch(() => false);
    
    // Try to trigger system screen sharing which can be cast on some systems
    if (process.platform === 'darwin') {
      // On macOS, try to use AirPlay
      const sources = await desktopCapturer.getSources({ 
        types: ['window'], 
        fetchWindowIcons: true 
      });
      
      const currentWindow = sources.find(source => 
        source.id === 'window:' + window.id + ':0'
      );
      
      if (currentWindow) {
        // Create a dialog with cast options
        const { clipboard, shell } = require('electron');
        
        const choice = dialog.showMessageBoxSync(window, {
          type: 'info',
          title: 'Cast to Device',
          message: 'Cast ' + (title || 'this page'),
          detail: 'Choose how to cast this content:',
          buttons: [
            'Open in Browser to Cast',
            'Copy URL to Clipboard', 
            'Use System AirPlay',
            'Cancel'
          ],
          defaultId: 0,
          cancelId: 3
        });
        
        switch(choice) {
          case 0:
            // Open in default browser which likely has cast support
            shell.openExternal(url);
            return { 
              success: true, 
              method: 'browser',
              message: 'Opening in default browser for casting'
            };
          case 1:
            // Copy URL to clipboard
            clipboard.writeText(url);
            return { 
              success: true, 
              method: 'clipboard',
              deviceName: 'clipboard',
              message: 'URL copied. Paste in a browser with cast support.'
            };
          case 2:
            // Guide user to use system AirPlay
            dialog.showMessageBoxSync(window, {
              type: 'info',
              title: 'Use System AirPlay',
              message: 'To use AirPlay:',
              detail: '1. Click the Control Center icon in your menu bar\n2. Click Screen Mirroring\n3. Select your Apple TV or AirPlay device\n\nOr:\n\n1. Open System Preferences > Displays\n2. Click the AirPlay Display dropdown\n3. Select your device',
              buttons: ['OK']
            });
            return { 
              success: true, 
              method: 'airplay',
              message: 'Use system AirPlay controls to cast'
            };
          default:
            return { error: 'USER_CANCELLED' };
        }
      }
    } else {
      // For Windows/Linux, provide options
      const { clipboard, shell } = require('electron');
      
      const choice = dialog.showMessageBoxSync(window, {
        type: 'info',
        title: 'Cast to Device',
        message: 'Cast ' + (title || 'this page'),
        detail: 'Choose how to cast this content:',
        buttons: [
          'Open in Browser to Cast',
          'Copy URL to Clipboard',
          'Cancel'
        ],
        defaultId: 0,
        cancelId: 2
      });
      
      switch(choice) {
        case 0:
          // Open in default browser
          shell.openExternal(url);
          return { 
            success: true, 
            method: 'browser',
            message: 'Opening in default browser for casting'
          };
        case 1:
          // Copy URL to clipboard
          clipboard.writeText(url);
          return { 
            success: true, 
            method: 'clipboard',
            deviceName: 'clipboard',
            message: 'URL copied. Paste in a browser with cast support.'
          };
        default:
          return { error: 'USER_CANCELLED' };
      }
    }
  } catch (error) {
    console.error('Cast error:', error);
    return { error: error.message };
  }
});

// Handle bookmark analysis with Claude
ipcMain.handle('analyze-bookmark', async (event, url, title, description, keywords, content, model) => {
  const isInception = model === 'mercury';

  if (isInception) {
    // Use Inception Labs API
    if (!inceptionApiKey) {
      return { error: 'Please set Inception Labs API key in Settings' };
    }

    try {
      const https = require('https');

      const prompt = `Analyze this webpage and provide tags and a description for bookmarking:
URL: ${url}
Title: ${title}
${description ? `Meta Description: ${description}` : ''}
${keywords ? `Meta Keywords: ${keywords}` : ''}

Page Content (first 5000 chars):
${content.substring(0, 5000)}

Provide a JSON response with:
1. "tags": An array of 3-5 relevant tags (lowercase, single words or short phrases)
2. "description": A concise 1-2 sentence description of what this page is about

Return ONLY valid JSON without any markdown formatting or explanation.`;

      const requestBody = JSON.stringify({
        model: 'mercury',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 256,
        stream: false
      });

      const options = {
        hostname: 'api.inceptionlabs.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${inceptionApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);

              let text = '';
              // Inception Labs uses OpenAI-compatible format
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                text = parsed.choices[0].message.content;
              } else {
                console.error('Unexpected response structure:', parsed);
                resolve({ error: 'Unexpected response structure from Inception Labs API' });
                return;
              }

              try {
                const result = JSON.parse(text);
                resolve({ success: true, ...result });
              } catch (parseError) {
                // If parsing fails, try to extract JSON from the response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const result = JSON.parse(jsonMatch[0]);
                  resolve({ success: true, ...result });
                }
                resolve({ error: 'Failed to parse Mercury response' });
              }
            } catch (error) {
              console.error('Error in bookmark analysis:', error, 'Raw data:', data);
              resolve({ error: error.message });
            }
          });
        });

        req.on('error', (error) => {
          resolve({ error: error.message });
        });

        req.write(requestBody);
        req.end();
      });

    } catch (error) {
      console.error('Bookmark analysis error:', error);
      return { error: error.message };
    }
  } else {
    // Use Anthropic API
    if (!apiKey) {
      return { error: 'Please set ANTHROPIC_API_KEY environment variable' };
    }

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: apiKey,
      });

      const prompt = `Analyze this webpage and provide tags and a description for bookmarking:
URL: ${url}
Title: ${title}
${description ? `Meta Description: ${description}` : ''}
${keywords ? `Meta Keywords: ${keywords}` : ''}

Page Content (first 5000 chars):
${content.substring(0, 5000)}

Provide a JSON response with:
1. "tags": An array of 3-5 relevant tags (lowercase, single words or short phrases)
2. "description": A concise 1-2 sentence description of what this page is about

Return ONLY valid JSON without any markdown formatting or explanation.`;

      const response = await anthropic.messages.create({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      try {
        const result = JSON.parse(response.content[0].text);
        return { success: true, ...result };
      } catch (parseError) {
        // If parsing fails, try to extract JSON from the response
        const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return { success: true, ...result };
        }
        return { error: 'Failed to parse Claude response' };
      }
    } catch (error) {
      console.error('Bookmark analysis error:', error);
      return { error: error.message };
    }
  }
});

// Handle opening external URLs
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
  return { success: true };
});

// Handle volume control
ipcMain.handle('control-volume', async (event, direction) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    if (process.platform === 'darwin') {
      // macOS - use osascript
      const cmd = direction === 'up'
        ? 'osascript -e "set volume output volume ((output volume of (get volume settings)) + 10)"'
        : 'osascript -e "set volume output volume ((output volume of (get volume settings)) - 10)"';
      await execAsync(cmd);
    } else if (process.platform === 'win32') {
      // Windows - use nircmd if available, fallback to PowerShell
      const cmd = direction === 'up'
        ? 'powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"'
        : 'powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"';
      await execAsync(cmd);
    } else {
      // Linux - use amixer
      const cmd = direction === 'up'
        ? 'amixer -D pulse sset Master 10%+'
        : 'amixer -D pulse sset Master 10%-';
      await execAsync(cmd);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle save page dialog
ipcMain.handle('show-save-dialog', async (event, defaultFileName) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  // Determine filters based on file extension
  let filters = [];
  const ext = path.extname(defaultFileName).toLowerCase();

  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp' || ext === '.svg' || ext === '.ico' || ext === '.bmp') {
    // Image file - use image filters
    filters = [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'] },
      { name: 'All Files', extensions: ['*'] }
    ];
  } else {
    // Default to HTML filters for other files
    filters = [
      { name: 'HTML Files', extensions: ['html', 'htm'] },
      { name: 'All Files', extensions: ['*'] }
    ];
  }

  const result = await dialog.showSaveDialog(window, {
    defaultPath: defaultFileName,
    filters: filters
  });
  return result;
});

// Handle getting a safe temp file path
ipcMain.handle('get-temp-path', async (event, filename) => {
  try {
    const tempDir = app.getPath('temp');
    const safePath = path.join(tempDir, filename);
    return { success: true, path: safePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle writing file to disk
ipcMain.handle('write-file', async (event, filePath, content) => {
  const fsPromises = require('fs').promises;
  const fsSync = require('fs');

  try {
    // SECURITY: Validate and sanitize the file path
    const resolvedPath = path.resolve(filePath);

    // Get safe directories and resolve them to handle symlinks
    const tempDir = fsSync.realpathSync(app.getPath('temp'));
    const homeDir = fsSync.realpathSync(app.getPath('home'));
    const downloadsDir = fsSync.realpathSync(app.getPath('downloads'));
    const documentsDir = fsSync.realpathSync(app.getPath('documents'));
    const desktopDir = fsSync.realpathSync(app.getPath('desktop'));
    const appDir = fsSync.realpathSync(app.getAppPath());

    // Resolve the target path to handle symlinks
    const targetDir = path.dirname(resolvedPath);
    let realTargetDir;
    try {
      // Try to get real path if directory exists
      realTargetDir = fsSync.realpathSync(targetDir);
    } catch (e) {
      // If directory doesn't exist yet, use parent that exists
      let checkDir = targetDir;
      while (!fsSync.existsSync(checkDir) && checkDir !== path.dirname(checkDir)) {
        checkDir = path.dirname(checkDir);
      }
      if (fsSync.existsSync(checkDir)) {
        realTargetDir = fsSync.realpathSync(checkDir);
      } else {
        realTargetDir = targetDir;
      }
    }

    // Prevent directory traversal attacks
    if (filePath.includes('..') || filePath.includes('~')) {
      return { success: false, error: 'Invalid path: directory traversal not allowed' };
    }

    // Check if path is in an allowed directory
    const isInTemp = realTargetDir.startsWith(tempDir);
    const isInHome = realTargetDir.startsWith(homeDir);
    const isInDownloads = realTargetDir.startsWith(downloadsDir);
    const isInDocuments = realTargetDir.startsWith(documentsDir);
    const isInDesktop = realTargetDir.startsWith(desktopDir);
    const isInApp = realTargetDir.startsWith(appDir);

    // Block writes to application directory (prevent code modification)
    if (isInApp) {
      return { success: false, error: 'Cannot write to application directory' };
    }

    // Only allow writes to temp or user directories
    if (!isInTemp && !isInHome && !isInDownloads && !isInDocuments && !isInDesktop) {
      return { success: false, error: `Path not in allowed directory. Target: ${realTargetDir}` };
    }

    // Additional check: prevent writing to system folders (only check root-level system folders)
    // Don't block user's Library folder (~/Library), only system /Library
    if (process.platform === 'darwin') {
      // macOS - block /System, /Library (but not ~/Library), /usr, /bin, /sbin, /etc
      const systemPrefixes = ['/System', '/Library', '/usr', '/bin', '/sbin', '/etc', '/var/root'];
      if (systemPrefixes.some(prefix => resolvedPath.startsWith(prefix))) {
        return { success: false, error: 'Cannot write to system directories' };
      }
    } else if (process.platform === 'win32') {
      // Windows - block C:\Windows, C:\Program Files
      const lowerPath = resolvedPath.toLowerCase();
      if (lowerPath.includes('\\windows\\') || lowerPath.includes('\\program files\\')) {
        return { success: false, error: 'Cannot write to system directories' };
      }
    } else {
      // Linux - block /usr, /bin, /sbin, /etc, /sys, /proc
      const systemPrefixes = ['/usr', '/bin', '/sbin', '/etc', '/sys', '/proc', '/boot'];
      if (systemPrefixes.some(prefix => resolvedPath.startsWith(prefix))) {
        return { success: false, error: 'Cannot write to system directories' };
      }
    }

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(resolvedPath, content, 'utf8');
    return { success: true, path: resolvedPath };
  } catch (error) {
    console.error('Write file error:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to download images
async function downloadImageHelper(imageUrl, filePath, redirectCount = 0) {
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const { URL } = require('url');

  // Prevent infinite redirects
  if (redirectCount > 5) {
    return { success: false, error: 'Too many redirects' };
  }


  return new Promise((resolve) => {
    try {
      // Validate URL
      let urlObj;
      try {
        urlObj = new URL(imageUrl);
      } catch (urlError) {
        console.error('Invalid URL:', imageUrl, urlError);
        resolve({ success: false, error: 'Invalid URL: ' + imageUrl });
        return;
      }

      // Ensure the directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const protocol = urlObj.protocol === 'https:' ? https : http;

      // Set up options with headers to avoid being blocked
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Connection': 'keep-alive',
        }
      };

      const request = protocol.request(options, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirectUrl = response.headers.location;

          // Handle relative redirects
          if (!redirectUrl.startsWith('http')) {
            try {
              redirectUrl = new URL(redirectUrl, imageUrl).href;
            } catch (e) {
              console.error('Failed to parse redirect URL:', redirectUrl, e);
              resolve({ success: false, error: 'Invalid redirect URL' });
              return;
            }
          }

          // Recursively download from redirect URL
          downloadImageHelper(redirectUrl, filePath, redirectCount + 1).then(resolve);
          return;
        }

        if (response.statusCode !== 200) {
          console.error('Failed to download image, status:', response.statusCode);
          resolve({ success: false, error: `HTTP ${response.statusCode}` });
          return;
        }

        // Create write stream
        const writeStream = fs.createWriteStream(filePath);

        // Handle compression
        if (response.headers['content-encoding'] === 'gzip') {
          const zlib = require('zlib');
          response.pipe(zlib.createGunzip()).pipe(writeStream);
        } else if (response.headers['content-encoding'] === 'deflate') {
          const zlib = require('zlib');
          response.pipe(zlib.createInflate()).pipe(writeStream);
        } else if (response.headers['content-encoding'] === 'br') {
          const zlib = require('zlib');
          response.pipe(zlib.createBrotliDecompress()).pipe(writeStream);
        } else {
          response.pipe(writeStream);
        }

        writeStream.on('finish', () => {
          writeStream.close();
          resolve({ success: true });
        });

        writeStream.on('error', (error) => {
          console.error('Write stream error:', error);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          resolve({ success: false, error: error.message });
        });
      });

      request.on('error', (error) => {
        console.error('Request error:', error);
        resolve({ success: false, error: error.message });
      });

      request.setTimeout(30000, () => {
        request.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      request.end();
    } catch (error) {
      console.error('Download error:', error);
      resolve({ success: false, error: error.message });
    }
  });
}

// Handle downloading and saving images
ipcMain.handle('download-image', async (event, imageUrl, filePath) => {
  return downloadImageHelper(imageUrl, filePath);
});

// Handle saving a web page
ipcMain.handle('save-page', async (event, params) => {
  const { url, title } = params;

  try {
    // Create default filename from title
    const defaultFileName = (title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';

    // Show save dialog
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Page As',
      defaultPath: defaultFileName,
      filters: [
        { name: 'Web Page, Complete', extensions: ['html'] },
        { name: 'Web Page, HTML Only', extensions: ['html'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { cancelled: true };
    }

    // Download the page content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    let html = await response.text();

    // Add a base tag to ensure relative URLs work
    if (!html.includes('<base')) {
      const baseUrl = new URL(url).origin;
      html = html.replace('<head>', `<head>\n<base href="${baseUrl}/">`);
    }

    // Add a comment indicating the page was saved
    const savedComment = `\n<!-- Saved from ${url} on ${new Date().toISOString()} -->\n`;
    html = html.replace('<html', savedComment + '<html');

    // Write the file
    await fs.promises.writeFile(filePath, html, 'utf8');

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving page:', error);
    return { success: false, error: error.message };
  }
});

// Handle clearing cookies
ipcMain.handle('clear-cookies', async (event) => {
  try {
    const ses = session.fromPartition('persist:browser');
    await ses.clearStorageData({
      storages: ['cookies']
    });
    return { success: true };
  } catch (error) {
    console.error('Error clearing cookies:', error);
    return { success: false, error: error.message };
  }
});

// Handle clearing all browsing data
ipcMain.handle('clear-all-browsing-data', async (event) => {
  try {
    const ses = session.fromPartition('persist:browser');
    await ses.clearStorageData();
    return { success: true };
  } catch (error) {
    console.error('Error clearing browsing data:', error);
    return { success: false, error: error.message };
  }
});

// Handle GPU acceleration settings
ipcMain.handle('get-gpu-acceleration', async (event) => {
  return { enabled: gpuAccelerationEnabled };
});

ipcMain.handle('set-gpu-acceleration', async (event, enabled) => {
  gpuAccelerationEnabled = enabled;
  saveSettings();
  return { success: true };
});

// Update handlers
ipcMain.handle('check-for-updates', async () => {
  try {
    log('Manually checking for updates...');
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result };
  } catch (error) {
    log('Error checking for updates:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('quit-and-install', async () => {
  autoUpdater.quitAndInstall();
});

// Computer Use handlers
ipcMain.handle('computer-use-action', async (event, action, webviewId) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // Execute the action and return result
    const computerUse = new ComputerUseController();

    // Get webview from renderer
    const webview = event.sender;

    computerUse.init(webview, apiKey);
    const result = await computerUse.executeAction(action);

    return result;
  } catch (error) {
    console.error('Computer use action error:', error);
    return { success: false, error: error.message };
  }
});

// Handle computer use Claude API call with vision
ipcMain.handle('computer-use-claude', async (event, { screenshot, task, pageContext, model }) => {
  if (!apiKey) {
    return { error: 'No API key set' };
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: apiKey,
      defaultHeaders: {
        'anthropic-beta': 'computer-use-2025-01-24'
      }
    });

    // Prepare the message with screenshot
    const messages = [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Task: ${task}

You are using computer control to interact with a web browser. The screenshot shows the current state of the page.

Current context:
- Page: ${pageContext.title}
- URL: ${pageContext.url}
- Viewport: ${pageContext.viewport.width}x${pageContext.viewport.height}

Available actions (respond with ONE as JSON):
{"type": "click", "x": 100, "y": 200} - Click at coordinates
{"type": "type", "text": "text to type"} - Type text
{"type": "key", "key": "Enter"} - Press key
{"type": "scroll", "direction": "down", "amount": 300} - Scroll
{"type": "complete", "message": "Task done"} - Finish

Analyze the screenshot and choose your next action.`
        }
      ]
    }];

    // Add screenshot if provided
    if (screenshot) {
      messages[0].content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: screenshot.replace(/^data:image\/\w+;base64,/, '')
        }
      });
    }

    const response = await anthropic.messages.create({
      model: model || 'claude-3-5-sonnet-20241022',  // Use selected model from UI
      max_tokens: 1024,
      messages: messages
    });

    // Extract JSON action from response
    const responseText = response.content[0].text;

    // Try multiple patterns to find JSON in the response
    const jsonPatterns = [
      /\{[^{}]*\}/,  // Simple single-level JSON
      /\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/,  // Nested JSON
      /\{.*?"type".*?:.*?".*?".*?\}/s,  // JSON with "type" field
      /\{[^}]+\}/  // Greedy but simple
    ];

    let jsonMatch = null;
    for (const pattern of jsonPatterns) {
      const match = responseText.match(pattern);
      if (match) {
        try {
          const testParse = JSON.parse(match[0]);
          if (testParse.type) {  // Valid action should have a type
            jsonMatch = match[0];
            break;
          }
        } catch (e) {
          // Try next pattern
          continue;
        }
      }
    }

    // Also try to extract JSON from code blocks
    if (!jsonMatch) {
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[^`]+\})\s*```/);
      if (codeBlockMatch) {
        try {
          const testParse = JSON.parse(codeBlockMatch[1]);
          if (testParse.type) {
            jsonMatch = codeBlockMatch[1];
          }
        } catch (e) {
          console.error('Failed to parse JSON from code block:', e);
        }
      }
    }

    if (jsonMatch) {
      try {
        const action = JSON.parse(jsonMatch);
        return { success: true, action, explanation: responseText };
      } catch (parseError) {
        console.error('Failed to parse JSON:', jsonMatch);
        console.error('Parse error:', parseError);
        return { success: false, error: 'Invalid JSON in response', response: responseText };
      }
    } else {
      // Check if Claude said the task is complete without JSON
      if (responseText.toLowerCase().includes('complete') ||
          responseText.toLowerCase().includes('finished') ||
          responseText.toLowerCase().includes('done')) {
        return { success: true, action: { type: 'complete', message: responseText }, explanation: responseText };
      }

      // Log the full response for debugging
      return { success: false, error: 'No valid action found in response', response: responseText };
    }
  } catch (error) {
    console.error('Claude API error:', error);
    return { success: false, error: error.message };
  }
});

// Handle ad blocker settings
ipcMain.handle('get-ad-blocker', async (event) => {
  return { enabled: adBlockerEnabled };
});

ipcMain.handle('set-ad-blocker', async (event, enabled) => {
  adBlockerEnabled = enabled;
  saveSettings();

  // Update ad blocker for all sessions
  const browserSession = session.fromPartition('persist:browser');
  if (enabled) {
    setupAdBlocker(browserSession);
  }

  // Notify all windows about the change
  windows.forEach(window => {
    window.webContents.send('ad-blocker-changed', enabled);
  });

  return { success: true };
});

// Handle tracker blocker settings
ipcMain.handle('get-tracker-blocker', async (event) => {
  return { enabled: trackerBlockerEnabled };
});

ipcMain.handle('set-tracker-blocker', async (event, enabled) => {
  trackerBlockerEnabled = enabled;
  saveSettings();

  // Update tracker blocker for all sessions
  const browserSession = session.fromPartition('persist:browser');
  if (enabled) {
    setupTrackerBlocker(browserSession);
  }

  // Notify all windows about the change
  windows.forEach(window => {
    window.webContents.send('tracker-blocker-changed', enabled);
  });

  return { success: true };
});

// Handle close window request (when last tab is closed)
ipcMain.handle('close-window', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
  return { success: true };
});

// Puppeteer Automation IPC Handlers
let automationManager = null;

ipcMain.handle('automation-init', async (event, mode = 'playback', viewport = null) => {
  try {
    // Get the sender window (the window that initiated the automation)
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    // Clean up any existing automation session first
    if (automationManager && automationManager.isConnected) {
      await automationManager.disconnect();
    }

    // Close any existing automation window
    if (global.automationWindow && !global.automationWindow.isDestroyed()) {
      global.automationWindow.close();
      global.automationWindow = null;
      // Wait for window to close
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Only create a new window for playback, not for recording
    if (mode === 'playback') {
      // Close any existing automation window first
      if (global.automationWindow && !global.automationWindow.isDestroyed()) {
        global.automationWindow.close();
        global.automationWindow = null;

        // Disconnect automation manager to clean up
        if (automationManager) {
          await automationManager.disconnect();
        }

        // Wait for window to close completely
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Use viewport dimensions from recording, or default values
      const windowWidth = viewport ? viewport.width : 1280;
      const windowHeight = viewport ? viewport.height : 800;


      // Create a new window specifically for automation playback
      // Use useContentSize to match the viewport exactly (excluding window chrome)
      // NEW APPROACH: No webview - direct BrowserWindow that Puppeteer controls
      // This avoids the complexity of webview CDP registration and contextIsolation issues
      const automationWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        useContentSize: true,
        title: '🤖 Automation Running...',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: false,  // CRITICAL: Allow sessionStorage access
          webSecurity: true,
          partition: 'persist:browser',  // Share cookies with main browser
          preload: path.join(__dirname, 'webview-preload.js')  // Apply preload directly!
        }
      });

      // Load a blank page
      await automationWindow.loadURL('about:blank');

      // Set initial page styling
      await automationWindow.webContents.executeJavaScript(`
        document.title = '🤖 Automation Running...';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        document.body.style.background = '#000';
      `);

      // Store reference to the automation window
      global.automationWindow = automationWindow;

      // Handle window close to clean up
      automationWindow.on('closed', () => {
        global.automationWindow = null;
        if (automationManager) {
          automationManager.disconnect();
        }
      });
    }

    // Wait a moment for the window to be registered with CDP if we created one
    if (mode === 'playback') {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const AutomationManager = require('./automation-manager');

    if (!automationManager) {
      // Pass a callback that sends messages to the renderer
      automationManager = new AutomationManager((message) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('automation-message', message);
        }
      });
    }

    // Try to connect to the browser's debug port
    const success = await automationManager.connectToPort(remoteDebugPort);

    if (success) {
      // For playback mode, find the automation window
      if (mode === 'playback' && global.automationWindow) {
        // Wait for the window to be fully registered with CDP
        console.log('[Automation] Waiting for window to register with CDP...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          const pages = await automationManager.controller.browser.pages();
          console.log(`[Automation] Found ${pages.length} CDP pages total`);

          // NEW SIMPLE APPROACH: Just find the automation window
          // No more webview - the BrowserWindow itself is what we control
          // It has the preload script applied directly + Puppeteer will add more
          let automationPage = null;

          // List all pages for debugging
          for (const page of pages) {
            try {
              const url = await page.url();
              const title = await page.title();

              console.log(`[Automation]   - Page: title="${title}", url="${url}"`);

              // Find our automation window by title
              if (title === '🤖 Automation Running...') {
                automationPage = page;
                console.log('[Automation]     ✓ AUTOMATION WINDOW (this is it!)');
                break;
              }
            } catch (e) {
              console.log(`[Automation]   - Error checking page: ${e.message}`);
            }
          }

          const targetPage = automationPage;

          if (targetPage) {
            console.log('[Automation] ✓ Using automation window for control');
            // Use setPage() to ensure anti-detection measures are applied
            await automationManager.controller.setPage(targetPage);

            // Also set the viewport on the Puppeteer page
            if (viewport) {
              await targetPage.setViewport({
                width: viewport.width,
                height: viewport.height,
                deviceScaleFactor: viewport.devicePixelRatio || 1
              });
            }
          } else {
            console.warn('[Automation] ⚠️ Could not find any automation page!');
            if (pages.length > 0) {
              console.log('[Automation] Falling back to last available page');
              const fallbackPage = pages[pages.length - 1];
              // Use setPage() to ensure anti-detection measures are applied
              await automationManager.controller.setPage(fallbackPage);
              // Set viewport on fallback page
              if (viewport) {
                await fallbackPage.setViewport({
                  width: viewport.width,
                  height: viewport.height,
                  deviceScaleFactor: viewport.devicePixelRatio || 1
                });
              }
            }
          }
        } catch (error) {
          console.error('Error setting up automation page:', error);
        }
      }
      // For recording mode, we'll use the current tab (handled by the recorder)
    }

    return {
      success,
      message: success ?
        (mode === 'playback' ? `Automation window created and connected via ${CONFIG.BROWSER_NAME}` : `Connected to ${CONFIG.BROWSER_NAME} for recording`) :
        `Failed to connect to ${CONFIG.BROWSER_NAME} debug port`
    };
  } catch (error) {
    console.error('Automation init error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation-play', async (event, data) => {
  try {
    const forceNewWindow = data && data.forceNewWindow;

    // Check if automation window exists and is valid
    let needsInit = true;
    let windowValid = false;

    // If forceNewWindow is true, we skip the window check
    // The window should have already been created by automationInit
    if (forceNewWindow) {
      // Don't close anything - the window was just created by automationInit
      // Just ensure we find and use the newly created window
      needsInit = false; // Manager should already be initialized
      windowValid = true; // Assume window is valid (just created)
    } else {
      // Check if the automation window still exists
      if (global.automationWindow && !global.automationWindow.isDestroyed()) {
        windowValid = true;
      }

      // If window is gone, we need to reinit
      if (!windowValid) {
        if (automationManager) {
          await automationManager.disconnect();
        }
        needsInit = true;
      } else if (automationManager && automationManager.isConnected && automationManager.controller && automationManager.controller.page) {
        try {
          // Test if the page is still valid
          await automationManager.controller.page.evaluate(() => true);
          needsInit = false;
        } catch (e) {
          await automationManager.disconnect();
          needsInit = true;
        }
      }
    }

    // Initialize if needed
    if (needsInit) {
      if (!automationManager) {
        automationManager = new AutomationManager();
      }

      const initSuccess = await automationManager.init(remoteDebugPort);
      if (!initSuccess) {
        return { success: false, error: 'Failed to initialize automation' };
      }
    }

    // Find and set the automation page explicitly (not just any page) - only if not already set
    if (!automationManager.controller.page || needsInit || forceNewWindow) {
      try {
        // Check if browser is connected
        if (!automationManager.controller || !automationManager.controller.browser) {
          console.error('Browser not connected after init');
          return { success: false, error: 'Browser connection failed' };
        }

      const pages = await automationManager.controller.browser.pages();

      let automationPage = null;

      // First, look for the automation window that should have been created by automation-init
      if (global.automationWindow && !global.automationWindow.isDestroyed()) {

        for (const page of pages) {
          try {
            const title = await page.title();
            const url = await page.url();

            // Only use the page with our specific automation title
            if (title === '🤖 Automation Running...') {
              automationPage = page;
              break;
            }
          } catch (e) {
          }
        }
      }

      if (!automationPage) {
        // The automation window should exist, but if not, create a new page

        // Create a new browser window for automation if one doesn't exist
        if (!global.automationWindow || global.automationWindow.isDestroyed()) {
          // Use viewport from data if available, otherwise default
          const viewport = (data && data.viewport) || { width: 1280, height: 720 };

          // NEW APPROACH: No webview - direct BrowserWindow that Puppeteer controls
          const automationWindow = new BrowserWindow({
            width: viewport.width,
            height: viewport.height,
            useContentSize: true,
            title: '🤖 Automation Running...',
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: false,  // CRITICAL: Allow sessionStorage access
              webSecurity: true,
              partition: 'persist:browser',  // Share cookies with main browser
              preload: path.join(__dirname, 'webview-preload.js')  // Apply preload directly!
            }
          });

          await automationWindow.loadURL('about:blank');
          await automationWindow.webContents.executeJavaScript(`
            document.title = '🤖 Automation Running...';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            document.body.style.background = '#000';
          `);

          global.automationWindow = automationWindow;

          // Wait for the window to register with CDP
          console.log('[Automation] Waiting for window to register with CDP...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Get pages again after creating the window
          const updatedPages = await automationManager.controller.browser.pages();
          for (const page of updatedPages) {
            try {
              const title = await page.title();
              if (title === '🤖 Automation Running...') {
                automationPage = page;
                break;
              }
            } catch (e) {
              // Continue
            }
          }
        }
      }

      if (!automationPage) {
        console.error('Failed to find or create automation page');
        return { success: false, error: 'Could not create automation page' };
      }

        // Use setPage() to ensure anti-detection measures are applied
        await automationManager.controller.setPage(automationPage);
      } catch (error) {
        console.error('Error setting automation page:', error);
        console.error('Stack trace:', error.stack);
        return { success: false, error: `Failed to set automation page: ${error.message}` };
      }
    } else {
    }

    // Handle both old format (array of actions) and new format (object with actions and viewport)
    let actions;
    let viewport = null;

    if (Array.isArray(data)) {
      // Old format - just actions array
      actions = data;
    } else if (data && data.actions) {
      // New format - object with actions and viewport
      actions = data.actions;
      viewport = data.viewport;
    } else {
      return { success: false, error: 'Invalid automation data format' };
    }

    // ALWAYS apply viewport if provided, even when reusing session
    if (viewport && automationManager && automationManager.controller && automationManager.controller.page) {

      // First, resize the browser window if it exists
      if (global.automationWindow && !global.automationWindow.isDestroyed()) {
        global.automationWindow.setContentSize(viewport.width, viewport.height);

        // Wait for window resize to take effect
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Then set the viewport on the page
      try {
        await automationManager.controller.page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.devicePixelRatio || 1
        });
        console.log(`[Automation] ✓ Viewport set to ${viewport.width}x${viewport.height}`);
      } catch (viewportError) {
        console.warn('[Automation] ⚠️ Could not set viewport:', viewportError.message);
      }

    }

    // Copy cookies from persist:browser session to puppeteer page before playback
    if (automationManager && automationManager.controller && automationManager.controller.page) {
      try {
        const browserSession = session.fromPartition('persist:browser');
        const cookies = await browserSession.cookies.get({});

        // Clear existing cookies first
        const currentCookies = await automationManager.controller.page.cookies();
        for (const cookie of currentCookies) {
          try {
            await automationManager.controller.page.deleteCookie(cookie);
          } catch (e) {
            // Ignore errors when deleting
          }
        }

      // Set each cookie in the puppeteer page
      for (const cookie of cookies) {
        try {
          await automationManager.controller.page.setCookie({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            expires: cookie.expirationDate,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite || 'Lax'
          });
        } catch (e) {
          // Some cookies might fail due to domain restrictions, that's ok
          console.warn(`Could not set cookie ${cookie.name} for ${cookie.domain}:`, e.message);
        }
      }
      } catch (error) {
        console.warn('⚠️ Failed to copy cookies:', error.message);
      }
    }

    await automationManager.playAutomation(actions);

    // Don't disconnect after playback - keep the window ready for next run
    // Note: Not disconnecting to keep session ready for next playback

    return { success: true };
  } catch (error) {
    // Only disconnect on critical errors where the session is broken
    console.error('Automation error:', error);
    if (error.message && error.message.includes('Session closed')) {
      if (automationManager) {
        await automationManager.disconnect();
      }
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation-navigate', async (event, url) => {
  try {
    if (!automationManager || !automationManager.isConnected) {
      return { success: false, error: 'Automation not initialized' };
    }
    await automationManager.navigate(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation-click', async (event, selector) => {
  try {
    if (!automationManager || !automationManager.isConnected) {
      return { success: false, error: 'Automation not initialized' };
    }
    await automationManager.click(selector);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation-type', async (event, selector, text) => {
  try {
    if (!automationManager || !automationManager.isConnected) {
      return { success: false, error: 'Automation not initialized' };
    }
    await automationManager.type(selector, text);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation-status', async () => {
  try {
    const isConnected = automationManager && automationManager.isConnected;
    return { connected: !!isConnected };
  } catch (error) {
    return { connected: false, error: error.message };
  }
});

ipcMain.handle('automation-start-recording', async (event, url) => {
  try {

    // Get the current window
    const currentWindow = BrowserWindow.fromWebContents(event.sender);
    if (currentWindow) {
      global.recordingWindow = currentWindow;
    }

    if (!automationManager) {
      // Pass a callback that sends messages to the renderer
      automationManager = new AutomationManager((message) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('automation-message', message);
        }
      });
    }

    // Start recording in the current browser using the configured debug port
    const success = await automationManager.startRecording(debugPort, url);
    if (success) {
      return { success: true };
    } else {
      throw new Error('Failed to start Puppeteer recording');
    }
  } catch (error) {
    console.error('Failed to start recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation-stop-recording', async (event) => {
  try {
    if (!automationManager) {
      throw new Error('No recording in progress');
    }

    const actions = await automationManager.stopRecording();

    global.recordingWindow = null;

    return { success: true, actions: actions };
  } catch (error) {
    console.error('Failed to stop recording:', error);
    return { success: false, error: error.message };
  }
});

// Handle recording actions from ElectronRecorder
ipcMain.on('recording-action', async (event, action) => {
  if (automationManager && automationManager.electronRecorder) {
    automationManager.electronRecorder.addAction(action);
  }
});

// Handle updating bookmarks menu
ipcMain.on('update-bookmarks-menu', (event, bookmarks) => {
  updateBookmarksMenu(bookmarks);
});

// Handle bookmarks bar visibility state
ipcMain.on('set-bookmarks-bar-visible', (event, visible) => {
  bookmarksBarVisible = visible;
  createApplicationMenu();
});

function updateBookmarksMenu(bookmarks) {
  currentBookmarks = bookmarks || [];
  // Rebuild the entire menu
  createApplicationMenu();
}

// Handle search suggestions generation
ipcMain.handle('generate-search-suggestions', async (event, url, title, content, model) => {
  const isInception = model === 'mercury';

  if (isInception && !inceptionApiKey) {
    return { error: 'Please set Inception Labs API key in Settings' };
  }

  if (!isInception && !apiKey) {
    return { error: 'Please set ANTHROPIC_API_KEY environment variable' };
  }

  const prompt = `Based on this webpage, generate 5-7 contextually relevant search queries that the user might want to explore next:

URL: ${url}
Title: ${title}
Content (first 5000 chars):
${content.substring(0, 5000)}

Generate search suggestions that:
1. Explore related topics in more depth
2. Answer natural follow-up questions
3. Find similar or competing content
4. Investigate mentioned concepts, people, or technologies
5. Provide different perspectives on the topic

Return a JSON array of objects with:
- "query": The search query text
- "context": A brief explanation (1 sentence) of why this search is relevant

Return ONLY valid JSON without any markdown formatting or explanation.`;

  try {
    let responseText;

    if (isInception) {
      // Use Inception Labs API
      const https = require('https');

      const requestBody = JSON.stringify({
        model: 'mercury',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 512,
        stream: false
      });

      const options = {
        hostname: 'api.inceptionlabs.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${inceptionApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      responseText = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);

              // Inception Labs uses OpenAI-compatible format
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                resolve(parsed.choices[0].message.content);
              } else {
                console.error('Unexpected response structure:', parsed);
                reject(new Error('Unexpected response structure from Inception Labs API'));
              }
            } catch (error) {
              console.error('Error parsing response:', error, 'Raw data:', data);
              reject(error);
            }
          });
        });
        req.on('error', (error) => reject(error));
        req.write(requestBody);
        req.end();
      });
    } else {
      // Use Anthropic API
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: apiKey });

      const response = await anthropic.messages.create({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      });

      responseText = response.content[0].text;
    }

    try {
      const suggestions = JSON.parse(responseText);
      return { success: true, suggestions };
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        return { success: true, suggestions };
      }
      return { error: 'Failed to parse AI response' };
    }
  } catch (error) {
    console.error('Search suggestions error:', error);
    return { error: error.message };
  }
});

// Handle semantic search across tabs
ipcMain.handle('semantic-search-tabs', async (event, query, tabsData, model) => {
  const isInception = model === 'mercury';

  if (isInception && !inceptionApiKey) {
    return { error: 'Please set Inception Labs API key in Settings' };
  }

  if (!isInception && !apiKey) {
    return { error: 'Please set ANTHROPIC_API_KEY environment variable' };
  }


  // Prepare tab content for search
  const tabSummaries = tabsData.map((tab, index) =>
    `Tab ${index + 1}: ${tab.title}
URL: ${tab.url}
Description: ${tab.description || 'No description'}
Keywords: ${tab.keywords || 'None'}
Content:
${tab.content}`
  ).join('\n\n---\n\n');

  const prompt = `You are helping a user find information across their open browser tabs.
The user is searching for: "${query}"

Below are summaries of each open tab, including title, metadata, and the first few paragraphs of content:

${tabSummaries}

---

Analyze each tab and determine which ones contain information semantically related to the user's search query.
Consider not just exact keyword matches, but conceptual relevance, related topics, and contextual meaning.

Return a JSON array of relevant tabs, sorted by relevance (highest first):
[
  {
    "tabIndex": <tab index starting from 0>,
    "title": "<tab title>",
    "url": "<tab URL>",
    "score": <relevance score 0.0-1.0>,
    "snippet": "<most relevant text excerpt from the content, max 200 chars>",
    "matchContext": "<1-2 sentence explanation of why this tab is relevant to the search>"
  }
]

Only include tabs with a relevance score > 0.3. If no tabs are relevant, return an empty array [].
Return ONLY valid JSON without any markdown formatting or explanation.`;

  try {
    let responseText;

    if (isInception) {
      // Use Inception Labs API
      const https = require('https');

      const requestBody = JSON.stringify({
        model: 'mercury',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 2000,
        temperature: 0,
        stream: false
      });

      const options = {
        hostname: 'api.inceptionlabs.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${inceptionApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      responseText = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);

              // Inception Labs uses OpenAI-compatible format
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                resolve(parsed.choices[0].message.content);
              } else {
                console.error('Unexpected response structure:', parsed);
                reject(new Error('Unexpected response structure from Inception Labs API'));
              }
            } catch (error) {
              console.error('Error parsing response:', error, 'Raw data:', data);
              reject(error);
            }
          });
        });
        req.on('error', (error) => reject(error));
        req.write(requestBody);
        req.end();
      });
    } else {
      // Use Anthropic API
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: apiKey });

      const response = await anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      responseText = response.content[0].text;
    }

    try {
      const results = JSON.parse(responseText);
      return { success: true, results };
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        return { success: true, results };
      }
      console.error('Failed to parse AI response:', responseText);
      return { error: 'Failed to parse AI response' };
    }
  } catch (error) {
    console.error('Semantic search error:', error);
    return { error: error.message };
  }
});

// Handle tab state persistence
ipcMain.handle('save-tab-state', async (event, tabState) => {
  try {
    const tabStatePath = path.join(app.getPath('userData'), 'tabState.json');
    fs.writeFileSync(tabStatePath, JSON.stringify(tabState, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to save tab state:', error);
    return { error: error.message };
  }
});

ipcMain.handle('load-tab-state', async () => {
  try {
    const tabStatePath = path.join(app.getPath('userData'), 'tabState.json');
    if (fs.existsSync(tabStatePath)) {
      const data = fs.readFileSync(tabStatePath, 'utf8');
      return { success: true, tabState: JSON.parse(data) };
    }
    return { success: true, tabState: null };
  } catch (error) {
    console.error('Failed to load tab state:', error);
    return { error: error.message };
  }
});

ipcMain.handle('get-browser-settings', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'browserSettings.json');
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return { success: true, settings: JSON.parse(data) };
    }
    return { success: true, settings: null };
  } catch (error) {
    console.error('Failed to load browser settings:', error);
    return { error: error.message };
  }
});

ipcMain.handle('save-browser-settings', async (event, settings) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'browserSettings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to save browser settings:', error);
    return { error: error.message };
  }
});

// Handle third-party cookie blocking
ipcMain.handle('set-third-party-cookie-blocking', async (event, block) => {
  try {
    const { session } = require('electron');
    const defaultSession = session.defaultSession;

    if (block) {
      // Block third-party cookies
      await defaultSession.cookies.set({
        url: 'http://*',
        name: '__third_party_block',
        value: '1',
        sameSite: 'strict'
      });

      // Set up a filter to block third-party cookies
      defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const url = new URL(details.url);
        const referrer = details.referrer ? new URL(details.referrer) : null;

        // If there's a referrer and the domains don't match, it's a third-party request
        if (referrer && url.hostname !== referrer.hostname) {
          // Remove cookie headers from third-party requests
          if (details.requestHeaders['Cookie']) {
            delete details.requestHeaders['Cookie'];
          }
        }

        callback({ requestHeaders: details.requestHeaders });
      });

      // Block setting cookies from third-party domains
      defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const url = new URL(details.url);
        const referrer = details.referrer ? new URL(details.referrer) : null;

        // If there's a referrer and the domains don't match, it's a third-party request
        if (referrer && url.hostname !== referrer.hostname) {
          // Remove Set-Cookie headers from third-party responses
          if (details.responseHeaders) {
            delete details.responseHeaders['set-cookie'];
            delete details.responseHeaders['Set-Cookie'];
          }
        }

        callback({ responseHeaders: details.responseHeaders });
      });

    } else {
      // Allow third-party cookies by removing the filters
      // Note: We can't easily remove webRequest listeners, so we'll just clear the filter logic
      // The listeners will remain but won't block anything
      defaultSession.webRequest.onBeforeSendHeaders(null);
      defaultSession.webRequest.onHeadersReceived(null);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to set third-party cookie blocking:', error);
    return { error: error.message };
  }
});

// Handle intelligent tab grouping with Claude
ipcMain.handle('group-tabs-with-claude', async (event, tabsData, model) => {
  const isInception = model === 'mercury';

  // Check for appropriate API key
  if (isInception) {
    if (!inceptionApiKey) {
      return { error: 'Please set Inception Labs API key in Settings' };
    }
  } else {
    if (!apiKey) {
      return { error: 'Please set ANTHROPIC_API_KEY environment variable' };
    }
  }

  try {
    const prompt = `Analyze these browser tabs and group them intelligently based on their content, purpose, and relationships. Consider the page titles, URLs, descriptions, and content snippets.

Tabs to analyze:
${JSON.stringify(tabsData, null, 2)}

Return a JSON response with this exact structure:
{
  "groups": [
    {
      "name": "Group name (e.g., 'Technology News', 'Social Media', 'Development Tools')",
      "description": "Brief description of what unites these tabs",
      "tabIndices": [0, 2, 5], // Array of tab indices that belong to this group
      "suggestedColor": "#hexcolor" // Optional color for visual grouping
    }
  ],
  "reasoning": "Brief explanation of the grouping logic"
}

Important:
- Every tab index must appear in exactly one group
- Groups should be meaningful and intuitive
- Single-tab groups are acceptable if a tab doesn't fit with others
- Order groups by size (largest first)
- Use descriptive, user-friendly group names`;

    let responseText;

    if (isInception) {
      // Use Inception Labs API
      const response = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${inceptionApiKey}`
        },
        body: JSON.stringify({
          model: 'mercury',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024
        })
      });

      const data = await response.json();
      if (data.error) {
        return { error: data.error.message || 'Inception API error' };
      }
      responseText = data.choices[0].message.content;
    } else {
      // Use Anthropic API
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: apiKey,
      });

      const response = await anthropic.messages.create({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      responseText = response.content[0].text;
    }

    // Parse the response
    try {
      const result = JSON.parse(responseText);
      return { success: true, ...result };
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return { success: true, ...result };
      }
      return { error: 'Failed to parse AI response' };
    }
  } catch (error) {
    console.error('Tab grouping error:', error);
    return { error: error.message };
  }
});

// Download manager IPC handlers
ipcMain.handle('open-download', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('show-download-in-folder', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// Set as default browser
ipcMain.handle('set-as-default-browser', async () => {
  try {
    // Set as default protocol client for HTTP and HTTPS
    const isDefaultHTTP = app.setAsDefaultProtocolClient('http');
    const isDefaultHTTPS = app.setAsDefaultProtocolClient('https');

    log('Set as default browser - HTTP:', isDefaultHTTP, 'HTTPS:', isDefaultHTTPS);

    return {
      success: isDefaultHTTP && isDefaultHTTPS,
      http: isDefaultHTTP,
      https: isDefaultHTTPS
    };
  } catch (error) {
    log('Error setting as default browser:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Import bookmarks from other browsers
ipcMain.handle('import-bookmarks', async (event, browser) => {
  try {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const homeDir = os.homedir();

    let bookmarkPath = '';

    // Determine bookmark file path based on browser and OS
    if (browser === 'chrome') {
      if (process.platform === 'darwin') {
        bookmarkPath = path.join(homeDir, 'Library/Application Support/Google/Chrome/Default/Bookmarks');
      } else if (process.platform === 'win32') {
        bookmarkPath = path.join(homeDir, 'AppData/Local/Google/Chrome/User Data/Default/Bookmarks');
      } else {
        bookmarkPath = path.join(homeDir, '.config/google-chrome/Default/Bookmarks');
      }
    } else if (browser === 'firefox') {
      // Firefox stores bookmarks in places.sqlite (more complex to parse)
      return { success: false, error: 'Firefox bookmark import not yet supported' };
    } else if (browser === 'safari') {
      if (process.platform === 'darwin') {
        bookmarkPath = path.join(homeDir, 'Library/Safari/Bookmarks.plist');
      } else {
        return { success: false, error: 'Safari is only available on macOS' };
      }
    } else if (browser === 'edge') {
      if (process.platform === 'darwin') {
        bookmarkPath = path.join(homeDir, 'Library/Application Support/Microsoft Edge/Default/Bookmarks');
      } else if (process.platform === 'win32') {
        bookmarkPath = path.join(homeDir, 'AppData/Local/Microsoft/Edge/User Data/Default/Bookmarks');
      } else {
        bookmarkPath = path.join(homeDir, '.config/microsoft-edge/Default/Bookmarks');
      }
    }

    if (!fs.existsSync(bookmarkPath)) {
      return { success: false, error: `Could not find ${browser} bookmarks. Make sure ${browser} is installed.` };
    }

    // Parse bookmarks based on browser
    let bookmarks = [];

    if (browser === 'chrome' || browser === 'edge') {
      // Chrome/Edge use JSON format
      const data = fs.readFileSync(bookmarkPath, 'utf8');
      const bookmarkData = JSON.parse(data);

      const extractBookmarks = (node) => {
        if (node.type === 'url') {
          bookmarks.push({
            url: node.url,
            title: node.name || node.url
          });
        } else if (node.type === 'folder' && node.children) {
          node.children.forEach(child => extractBookmarks(child));
        }
      };

      // Extract from bookmark bar and other folders
      if (bookmarkData.roots) {
        if (bookmarkData.roots.bookmark_bar) extractBookmarks(bookmarkData.roots.bookmark_bar);
        if (bookmarkData.roots.other) extractBookmarks(bookmarkData.roots.other);
        if (bookmarkData.roots.synced) extractBookmarks(bookmarkData.roots.synced);
      }
    } else if (browser === 'safari') {
      // Safari uses plist format
      const { execSync } = require('child_process');
      try {
        const plistJson = execSync(`plutil -convert json -o - "${bookmarkPath}"`).toString();
        const plistData = JSON.parse(plistJson);

        const extractSafariBookmarks = (node) => {
          if (node.URIDictionary && node.URIDictionary.title) {
            bookmarks.push({
              url: node.URLString,
              title: node.URIDictionary.title
            });
          } else if (node.Children) {
            node.Children.forEach(child => extractSafariBookmarks(child));
          }
        };

        if (plistData.Children) {
          plistData.Children.forEach(child => extractSafariBookmarks(child));
        }
      } catch (plistError) {
        log('Error parsing Safari bookmarks:', plistError);
        return { success: false, error: 'Failed to parse Safari bookmarks' };
      }
    }

    log(`Imported ${bookmarks.length} bookmarks from ${browser}`);

    return {
      success: true,
      bookmarks: bookmarks,
      count: bookmarks.length
    };
  } catch (error) {
    log('Error importing bookmarks:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle graceful shutdown for process termination signals
const gracefulShutdown = () => {

  // Send window-closing event to all windows to trigger tab saving
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('window-closing');
    }
  });

  // Give the renderer process time to save tab state
  setTimeout(() => {
    app.quit();
  }, 500);
};

// Handle various termination signals
process.on('SIGINT', () => {
  gracefulShutdown();
});

process.on('SIGTERM', () => {
  gracefulShutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejections, just log them
});

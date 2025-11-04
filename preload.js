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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    claudeSearchStream: (query, model) => ipcRenderer.invoke('claude-search-stream', query, model),
    inceptionSearchStream: (query, model) => ipcRenderer.invoke('inception-search-stream', query, model),
    summarizePageStream: (pageText, model, customPrompt) => ipcRenderer.invoke('summarize-page-stream', pageText, model, customPrompt),

    // Stream event listeners
    onClaudeStreamChunk: (callback) => {
        ipcRenderer.on('claude-stream-chunk', (event, data) => callback(data));
    },
    onClaudeStreamEnd: (callback) => {
        ipcRenderer.on('claude-stream-end', (event, data) => callback(data));
    },
    onClaudeStreamError: (callback) => {
        ipcRenderer.on('claude-stream-error', (event, data) => callback(data));
    },
    onInceptionStreamChunk: (callback) => {
        ipcRenderer.on('inception-stream-chunk', (event, data) => callback(data));
    },
    onInceptionStreamEnd: (callback) => {
        ipcRenderer.on('inception-stream-end', (event, data) => callback(data));
    },
    onInceptionStreamError: (callback) => {
        ipcRenderer.on('inception-stream-error', (event, data) => callback(data));
    },
    onSummaryStreamChunk: (callback) => {
        ipcRenderer.on('summary-stream-chunk', (event, data) => callback(data));
    },
    onSummaryStreamEnd: (callback) => {
        ipcRenderer.on('summary-stream-end', (event, data) => callback(data));
    },
    onSummaryStreamError: (callback) => {
        ipcRenderer.on('summary-stream-error', (event, data) => callback(data));
    },

    // Remove stream listeners
    removeClaudeStreamListeners: () => {
        ipcRenderer.removeAllListeners('claude-stream-chunk');
        ipcRenderer.removeAllListeners('claude-stream-end');
        ipcRenderer.removeAllListeners('claude-stream-error');
    },
    removeInceptionStreamListeners: () => {
        ipcRenderer.removeAllListeners('inception-stream-chunk');
        ipcRenderer.removeAllListeners('inception-stream-end');
        ipcRenderer.removeAllListeners('inception-stream-error');
    },
    removeSummaryStreamListeners: () => {
        ipcRenderer.removeAllListeners('summary-stream-chunk');
        ipcRenderer.removeAllListeners('summary-stream-end');
        ipcRenderer.removeAllListeners('summary-stream-error');
    },
    
    setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
    getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
    getApiKey: () => ipcRenderer.invoke('get-api-key'),
    getInceptionApiKey: () => ipcRenderer.invoke('get-inception-api-key'),
    setInceptionApiKey: (key) => ipcRenderer.invoke('set-inception-api-key', key),
    getInceptionApiKeyStatus: () => ipcRenderer.invoke('get-inception-api-key-status'),
    newWindow: () => ipcRenderer.invoke('new-window'),
    newIncognitoWindow: () => ipcRenderer.invoke('new-incognito-window'),
    newWindowWithUrl: (url) => ipcRenderer.invoke('new-window-with-url', url),
    newIncognitoWindowWithUrl: (url) => ipcRenderer.invoke('new-incognito-window-with-url', url),
    onOpenInNewTab: (callback) => ipcRenderer.on('open-in-new-tab', (event, url) => callback(url)),
    startCast: (url, title) => ipcRenderer.invoke('start-cast', url, title),
    analyzeBookmark: (url, title, description, keywords, content, model) => 
        ipcRenderer.invoke('analyze-bookmark', url, title, description, keywords, content, model),
    generateSearchSuggestions: (url, title, content, model) =>
        ipcRenderer.invoke('generate-search-suggestions', url, title, content, model),
    semanticSearchTabs: (query, tabsData, model) =>
        ipcRenderer.invoke('semantic-search-tabs', query, tabsData, model),
    computerUseClaude: (params) => ipcRenderer.invoke('computer-use-claude', params),
    computerUseAction: (action, webviewId) => ipcRenderer.invoke('computer-use-action', action, webviewId),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    controlVolume: (direction) => ipcRenderer.invoke('control-volume', direction),
    showSaveDialog: (defaultFileName) => ipcRenderer.invoke('show-save-dialog', defaultFileName),
    getTempPath: (filename) => ipcRenderer.invoke('get-temp-path', filename),
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
    downloadImage: (imageUrl, filePath) => ipcRenderer.invoke('download-image', imageUrl, filePath),
    savePage: (params) => ipcRenderer.invoke('save-page', params),
    clearCookies: () => ipcRenderer.invoke('clear-cookies'),
    clearAllBrowsingData: () => ipcRenderer.invoke('clear-all-browsing-data'),
    getGpuAcceleration: () => ipcRenderer.invoke('get-gpu-acceleration'),
    setGpuAcceleration: (enabled) => ipcRenderer.invoke('set-gpu-acceleration', enabled),
    getAdBlocker: () => ipcRenderer.invoke('get-ad-blocker'),
    setAdBlocker: (enabled) => ipcRenderer.invoke('set-ad-blocker', enabled),
    onAdBlockerChanged: (callback) => ipcRenderer.on('ad-blocker-changed', (event, enabled) => callback(enabled)),
    getTrackerBlocker: () => ipcRenderer.invoke('get-tracker-blocker'),
    setTrackerBlocker: (enabled) => ipcRenderer.invoke('set-tracker-blocker', enabled),
    onTrackerBlockerChanged: (callback) => ipcRenderer.on('tracker-blocker-changed', (event, enabled) => callback(enabled)),
    closeWindow: () => ipcRenderer.invoke('close-window'),

    // Puppeteer Automation APIs
    automationInit: (mode, viewport) => ipcRenderer.invoke('automation-init', mode, viewport),
    automationPlay: (actions) => ipcRenderer.invoke('automation-play', actions),
    automationNavigate: (url) => ipcRenderer.invoke('automation-navigate', url),
    automationClick: (selector) => ipcRenderer.invoke('automation-click', selector),
    automationType: (selector, text) => ipcRenderer.invoke('automation-type', selector, text),
    automationStatus: () => ipcRenderer.invoke('automation-status'),
    automationStartRecording: (url) => ipcRenderer.invoke('automation-start-recording', url),
    automationStopRecording: () => ipcRenderer.invoke('automation-stop-recording'),
    sendRecordingAction: (action) => ipcRenderer.send('recording-action', action),
    onAutomationMessage: (callback) => ipcRenderer.on('automation-message', (event, message) => callback(message)),

    // Menu event listeners
    onToggleBookmarksBar: (callback) => ipcRenderer.on('toggle-bookmarks-bar', callback),
    onBookmarkCurrentPage: (callback) => ipcRenderer.on('bookmark-current-page', callback),
    onShowAllBookmarks: (callback) => ipcRenderer.on('show-all-bookmarks', callback),
    onOpenBookmark: (callback) => ipcRenderer.on('open-bookmark', (event, url) => callback(url)),
    updateBookmarksMenu: (bookmarks) => ipcRenderer.send('update-bookmarks-menu', bookmarks),
    setBookmarksBarVisible: (visible) => ipcRenderer.send('set-bookmarks-bar-visible', visible),
    onFocusAddressBar: (callback) => ipcRenderer.on('focus-address-bar', callback),
    onNewTab: (callback) => ipcRenderer.on('new-tab', callback),
    onNewIncognitoTab: (callback) => ipcRenderer.on('new-incognito-tab', callback),
    onReopenClosedTab: (callback) => ipcRenderer.on('reopen-closed-tab', callback),
    onSavePageAs: (callback) => ipcRenderer.on('save-page-as', callback),
    onPrintPage: (callback) => ipcRenderer.on('print-page', callback),
    onShowHistory: (callback) => ipcRenderer.on('show-history', callback),
    onClearBrowsingData: (callback) => ipcRenderer.on('clear-browsing-data', callback),
    onNextTab: (callback) => ipcRenderer.on('next-tab', callback),
    onPreviousTab: (callback) => ipcRenderer.on('previous-tab', callback),
    onMoveTabRight: (callback) => ipcRenderer.on('move-tab-right', callback),
    onMoveTabLeft: (callback) => ipcRenderer.on('move-tab-left', callback),
    onDuplicateTab: (callback) => ipcRenderer.on('duplicate-tab', callback),
    onReloadPage: (callback) => ipcRenderer.on('reload-page', callback),
    onForceReloadPage: (callback) => ipcRenderer.on('force-reload-page', callback),
    onFindInPage: (callback) => ipcRenderer.on('find-in-page', callback),
    onResetZoom: (callback) => ipcRenderer.on('reset-zoom', callback),
    onZoomIn: (callback) => ipcRenderer.on('zoom-in', callback),
    onZoomOut: (callback) => ipcRenderer.on('zoom-out', callback),
    onSetIncognitoMode: (callback) => ipcRenderer.on('set-incognito-mode', (event, isIncognito) => callback(isIncognito)),
    onShowSettings: (callback) => ipcRenderer.on('show-settings', callback),
    onCloseCurrentTab: (callback) => ipcRenderer.on('close-current-tab', callback),
    onGoBack: (callback) => ipcRenderer.on('go-back', callback),
    onGoForward: (callback) => ipcRenderer.on('go-forward', callback),
    onToggleWebviewDevTools: (callback) => ipcRenderer.on('toggle-webview-devtools', callback),
    onViewPageSource: (callback) => ipcRenderer.on('view-page-source', callback),

    // Tab state persistence
    saveTabState: (tabState) => ipcRenderer.invoke('save-tab-state', tabState),
    loadTabState: () => ipcRenderer.invoke('load-tab-state'),
    getBrowserSettings: () => ipcRenderer.invoke('get-browser-settings'),
    saveBrowserSettings: (settings) => ipcRenderer.invoke('save-browser-settings', settings),
    setThirdPartyCookieBlocking: (block) => ipcRenderer.invoke('set-third-party-cookie-blocking', block),
    onWindowClosing: (callback) => ipcRenderer.on('window-closing', callback),

    // Intelligent tab grouping with Claude
    groupTabsWithClaude: (tabsData, model) => ipcRenderer.invoke('group-tabs-with-claude', tabsData, model),

    // Auto-updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, info) => callback(info)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, message) => callback(message)),
    onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),

    // Download manager
    openDownload: (filePath) => ipcRenderer.invoke('open-download', filePath),
    showDownloadInFolder: (filePath) => ipcRenderer.invoke('show-download-in-folder', filePath),
    onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    onDownloadDone: (callback) => ipcRenderer.on('download-done', (event, data) => callback(data)),

    // Default browser
    setAsDefaultBrowser: () => ipcRenderer.invoke('set-as-default-browser'),

    // Bookmark import
    importBookmarks: (browser) => ipcRenderer.invoke('import-bookmarks', browser)
});
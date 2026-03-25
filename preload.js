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

// SECURITY (finding 13): Track ALL ipcRenderer listeners by channel to prevent
// accumulation when onXxx functions are called multiple times. Each channel stores
// exactly one listener at a time; calling onXxx again replaces the previous listener.
const _listeners = new Map();

function _registerListener(channel, callback) {
    const prev = _listeners.get(channel);
    if (prev) ipcRenderer.removeListener(channel, prev);
    _listeners.set(channel, callback);
    ipcRenderer.on(channel, callback);
}

function _removeListeners(channels) {
    for (const channel of channels) {
        const handler = _listeners.get(channel);
        if (handler) {
            ipcRenderer.removeListener(channel, handler);
            _listeners.delete(channel);
        }
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    claudeSearchStream: (query, model) => ipcRenderer.invoke('claude-search-stream', query, model),
    inceptionSearchStream: (query, model) => ipcRenderer.invoke('inception-search-stream', query, model),
    summarizePageStream: (pageText, model, customPrompt) => ipcRenderer.invoke('summarize-page-stream', pageText, model, customPrompt),

    // Stream event listeners
    onClaudeStreamChunk: (callback) => { _registerListener('claude-stream-chunk', (_e, data) => callback(data)); },
    onClaudeStreamEnd: (callback) => { _registerListener('claude-stream-end', (_e, data) => callback(data)); },
    onClaudeStreamError: (callback) => { _registerListener('claude-stream-error', (_e, data) => callback(data)); },
    onInceptionStreamChunk: (callback) => { _registerListener('inception-stream-chunk', (_e, data) => callback(data)); },
    onInceptionStreamEnd: (callback) => { _registerListener('inception-stream-end', (_e, data) => callback(data)); },
    onInceptionStreamError: (callback) => { _registerListener('inception-stream-error', (_e, data) => callback(data)); },
    onSummaryStreamChunk: (callback) => { _registerListener('summary-stream-chunk', (_e, data) => callback(data)); },
    onSummaryStreamEnd: (callback) => { _registerListener('summary-stream-end', (_e, data) => callback(data)); },
    onSummaryStreamError: (callback) => { _registerListener('summary-stream-error', (_e, data) => callback(data)); },

    // Remove stream listeners — removes only the specific handlers registered above,
    // not all listeners on the channel.
    removeClaudeStreamListeners: () => {
        _removeListeners(['claude-stream-chunk', 'claude-stream-end', 'claude-stream-error']);
    },
    removeInceptionStreamListeners: () => {
        _removeListeners(['inception-stream-chunk', 'inception-stream-end', 'inception-stream-error']);
    },
    removeSummaryStreamListeners: () => {
        _removeListeners(['summary-stream-chunk', 'summary-stream-end', 'summary-stream-error']);
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
    onOpenInNewTab: (callback) => _registerListener('open-in-new-tab', (_e, url) => callback(url)),
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
    // SECURITY (finding 10): Separate channel for OS custom-scheme URLs (spotify:, mailto:, etc.)
    // so the main process can enforce a strict scheme allowlist independently of openExternal.
    openExternalApp: (url) => ipcRenderer.invoke('open-external-app', url),
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
    onAdBlockerChanged: (callback) => _registerListener('ad-blocker-changed', (_e, enabled) => callback(enabled)),
    getTrackerBlocker: () => ipcRenderer.invoke('get-tracker-blocker'),
    setTrackerBlocker: (enabled) => ipcRenderer.invoke('set-tracker-blocker', enabled),
    onTrackerBlockerChanged: (callback) => _registerListener('tracker-blocker-changed', (_e, enabled) => callback(enabled)),
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
    // SECURITY (finding 14): Use invoke (request/response) instead of fire-and-forget send.
    // This ensures errors are surfaced and the main-process handler can validate the action
    // schema and return a result.
    sendRecordingAction: (action) => ipcRenderer.invoke('recording-action', action),
    onAutomationMessage: (callback) => _registerListener('automation-message', (_e, message) => callback(message)),
    getWebviewAutomationToken: (webviewId) => ipcRenderer.invoke('get-webview-automation-token', webviewId),

    // SECURITY (finding 15): IPC-backed file storage for automation recordings to keep
    // recording data (which may contain typed text) out of the renderer's JS-accessible storage.
    loadAutomations: () => ipcRenderer.invoke('load-automations'),
    saveAutomations: (data) => ipcRenderer.invoke('save-automations', data),

    // Menu event listeners
    onToggleBookmarksBar: (callback) => _registerListener('toggle-bookmarks-bar', callback),
    onBookmarkCurrentPage: (callback) => _registerListener('bookmark-current-page', callback),
    onShowAllBookmarks: (callback) => _registerListener('show-all-bookmarks', callback),
    onOpenBookmark: (callback) => _registerListener('open-bookmark', (_e, url) => callback(url)),
    updateBookmarksMenu: (bookmarks) => ipcRenderer.send('update-bookmarks-menu', bookmarks),
    setBookmarksBarVisible: (visible) => ipcRenderer.send('set-bookmarks-bar-visible', visible),
    onFocusAddressBar: (callback) => _registerListener('focus-address-bar', callback),
    onNewTab: (callback) => _registerListener('new-tab', callback),
    onNewIncognitoTab: (callback) => _registerListener('new-incognito-tab', callback),
    onReopenClosedTab: (callback) => _registerListener('reopen-closed-tab', callback),
    onSavePageAs: (callback) => _registerListener('save-page-as', callback),
    onPrintPage: (callback) => _registerListener('print-page', callback),
    onShowHistory: (callback) => _registerListener('show-history', callback),
    onClearBrowsingData: (callback) => _registerListener('clear-browsing-data', callback),
    onNextTab: (callback) => _registerListener('next-tab', callback),
    onPreviousTab: (callback) => _registerListener('previous-tab', callback),
    onMoveTabRight: (callback) => _registerListener('move-tab-right', callback),
    onMoveTabLeft: (callback) => _registerListener('move-tab-left', callback),
    onDuplicateTab: (callback) => _registerListener('duplicate-tab', callback),
    onReloadPage: (callback) => _registerListener('reload-page', callback),
    onForceReloadPage: (callback) => _registerListener('force-reload-page', callback),
    onFindInPage: (callback) => _registerListener('find-in-page', callback),
    onResetZoom: (callback) => _registerListener('reset-zoom', callback),
    onZoomIn: (callback) => _registerListener('zoom-in', callback),
    onZoomOut: (callback) => _registerListener('zoom-out', callback),
    onSetIncognitoMode: (callback) => _registerListener('set-incognito-mode', (_e, isIncognito) => callback(isIncognito)),
    onShowSettings: (callback) => _registerListener('show-settings', callback),
    onCloseCurrentTab: (callback) => _registerListener('close-current-tab', callback),
    onGoBack: (callback) => _registerListener('go-back', callback),
    onGoForward: (callback) => _registerListener('go-forward', callback),
    onToggleWebviewDevTools: (callback) => _registerListener('toggle-webview-devtools', callback),
    onViewPageSource: (callback) => _registerListener('view-page-source', callback),

    // Tab state persistence
    saveTabState: (tabState) => ipcRenderer.invoke('save-tab-state', tabState),
    loadTabState: () => ipcRenderer.invoke('load-tab-state'),
    getBrowserSettings: () => ipcRenderer.invoke('get-browser-settings'),
    saveBrowserSettings: (settings) => ipcRenderer.invoke('save-browser-settings', settings),
    setThirdPartyCookieBlocking: (block) => ipcRenderer.invoke('set-third-party-cookie-blocking', block),
    setHttpProxy: (config) => ipcRenderer.invoke('set-http-proxy', config),
    onWindowClosing: (callback) => _registerListener('window-closing', callback),

    // Intelligent tab grouping with Claude
    groupTabsWithClaude: (tabsData, model) => ipcRenderer.invoke('group-tabs-with-claude', tabsData, model),

    // Auto-updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    onUpdateChecking: (callback) => _registerListener('update-checking', callback),
    onUpdateAvailable: (callback) => _registerListener('update-available', (_e, info) => callback(info)),
    onUpdateNotAvailable: (callback) => _registerListener('update-not-available', (_e, info) => callback(info)),
    onUpdateError: (callback) => _registerListener('update-error', (_e, message) => callback(message)),
    onUpdateDownloadProgress: (callback) => _registerListener('update-download-progress', (_e, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => _registerListener('update-downloaded', (_e, info) => callback(info)),

    // Download manager
    openDownload: (filePath) => ipcRenderer.invoke('open-download', filePath),
    showDownloadInFolder: (filePath) => ipcRenderer.invoke('show-download-in-folder', filePath),
    onDownloadStarted: (callback) => _registerListener('download-started', (_e, data) => callback(data)),
    onDownloadProgress: (callback) => _registerListener('download-progress', (_e, data) => callback(data)),
    onDownloadDone: (callback) => _registerListener('download-done', (_e, data) => callback(data)),

    // Default browser
    setAsDefaultBrowser: () => ipcRenderer.invoke('set-as-default-browser'),

    // Bookmark import
    importBookmarks: (browser) => ipcRenderer.invoke('import-bookmarks', browser),

    // Onboarding state
    getOnboardingState: () => ipcRenderer.invoke('get-onboarding-state'),
    setOnboardingComplete: () => ipcRenderer.invoke('set-onboarding-complete'),
    resetOnboarding: () => ipcRenderer.invoke('reset-onboarding')
});

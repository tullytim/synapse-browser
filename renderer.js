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

// RPA Engine will be loaded globally from rpa-engine.js

// Configuration
const BROWSER_NAME = 'Synapse';

// Tab management
class TabManager {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.tabIdCounter = 0;
        this.bookmarks = [];
        this.currentTagFilter = '';
        this.isIncognito = false;
        this.closedTabs = []; // Stack of recently closed tabs
        this.maxClosedTabs = 10; // Keep last 10 closed tabs
        this.browsingHistory = []; // Global browsing history
        this.maxHistoryItems = 10000; // Keep last 10000 history items
        // Anti-bot measures now handled by webview preload script
        this.autocompleteResults = []; // Store current autocomplete results
        this.selectedAutocompleteIndex = -1; // Currently selected autocomplete item
        this.tabsContainer = document.getElementById('tabs-container');
        this.tabsContent = document.getElementById('tabs-content');
        this.debugMode = localStorage.getItem('automationDebugMode') === 'true';

        // Auto-save tab state configuration
        this.autoSaveDebounceTime = 2000; // Save 2 seconds after last change
        this.autoSaveTimer = null;
        this.isRestoreEnabled = false; // Will be set during init

        // Add debug command to check localStorage
        const tabManager = this;
        window.debugAutomations = () => {
            const saved = localStorage.getItem('webAutomations');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    parsed.forEach((a, i) => {
                    });
                } catch (e) {
                    console.error('Parse error:', e);
                }
            } else {
            }
        };

        // Debug command to show history URLs
        window.debugHistory = (searchTerm = '') => {
            console.log(`Total history items: ${tabManager.browsingHistory.length}`);
            const filtered = searchTerm
                ? tabManager.browsingHistory.filter(h => h.url.toLowerCase().includes(searchTerm.toLowerCase()))
                : tabManager.browsingHistory.slice(0, 50); // Show first 50 if no search

            console.table(filtered.map(h => ({
                url: h.url,
                title: h.title,
                lastVisited: new Date(h.lastVisited).toLocaleString(),
                isInterstitial: h.isInterstitial || false
            })));

            return filtered;
        };

        // Debug command to remove specific URLs
        window.removeFromHistory = (urlPattern) => {
            const before = tabManager.browsingHistory.length;
            tabManager.browsingHistory = tabManager.browsingHistory.filter(h => !h.url.includes(urlPattern));
            const after = tabManager.browsingHistory.length;
            tabManager.saveHistory();
            console.log(`Removed ${before - after} items matching "${urlPattern}"`);
        };

        // Debug command to remove entries by title pattern
        window.removeFromHistoryByTitle = (titlePattern) => {
            const before = tabManager.browsingHistory.length;
            tabManager.browsingHistory = tabManager.browsingHistory.filter(h =>
                !h.title || !h.title.toLowerCase().includes(titlePattern.toLowerCase())
            );
            const after = tabManager.browsingHistory.length;
            tabManager.saveHistory();
            console.log(`Removed ${before - after} items with titles matching "${titlePattern}"`);
        };

        // Debug command to show what would appear in autocomplete
        window.testAutocomplete = (query) => {
            const results = tabManager.searchHistoryAndBookmarks(query);
            console.log(`Autocomplete results for "${query}":`);
            console.table(results.map(r => ({
                url: r.url,
                title: r.title,
                type: r.type,
                score: r.score
            })));
            return results;
        };

        // Debug command to show bookmarks
        window.debugBookmarks = () => {
            console.log(`Total bookmarks: ${tabManager.bookmarks.length}`);
            console.table(tabManager.bookmarks.map(b => ({
                title: b.title,
                url: b.url,
                isAutomation: b.isAutomation || false,
                automationId: b.automationId || 'N/A'
            })));
            return tabManager.bookmarks;
        };

        // Debug command to remove automation bookmarks
        window.removeAutomationBookmarks = () => {
            const before = tabManager.bookmarks.length;
            tabManager.bookmarks = tabManager.bookmarks.filter(b => !b.isAutomation);
            const after = tabManager.bookmarks.length;
            tabManager.saveBookmarks();
            console.log(`Removed ${before - after} automation bookmarks`);
        };
        this.bookmarksContainer = document.getElementById('bookmarks-container');
        this.bookmarksBar = document.getElementById('bookmarks-bar');
        this.tagFilter = document.getElementById('tag-filter');
        this.bookmarksScrollLeft = document.getElementById('bookmarks-scroll-left');
        this.bookmarksScrollRight = document.getElementById('bookmarks-scroll-right');
        this.addressBar = document.getElementById('address-bar');
        this.autocompleteDropdown = document.getElementById('autocomplete-dropdown');
        this.googleSearchBar = document.getElementById('google-search-bar');
        this.backBtn = document.getElementById('back-btn');
        this.forwardBtn = document.getElementById('forward-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        // Go button removed - no longer needed
        this.newTabBtn = document.getElementById('new-tab-btn');
        this.apiKeyWarning = document.getElementById('api-key-warning');
        this.apiKeyInput = document.getElementById('api-key-input');
        this.setApiKeyBtn = document.getElementById('set-api-key-btn');
        this.inceptionApiKeyWarning = document.getElementById('inception-api-key-warning');
        this.inceptionApiKeyInput = document.getElementById('inception-api-key-input');
        this.setInceptionApiKeyBtn = document.getElementById('set-inception-api-key-btn');
        this.offlineWarning = document.getElementById('offline-warning');

        // Automation elements
        this.automationBtn = document.getElementById('automation-btn');
        this.automationMenu = document.getElementById('automation-menu');
        this.savedAutomationsMenu = document.getElementById('saved-automations-menu');
        this.saveAutomationDialog = document.getElementById('save-automation-dialog');

        // Bookmarks menu elements (removed - now using top-level menu)
        this.bookmarksMenuBtn = null;
        this.bookmarksMenu = null;
        this.bookmarksMenuList = null;

        // Group tabs button
        this.groupTabsBtn = document.getElementById('group-tabs-btn');

        // Automation state
        this.isRecording = false;
        this.currentRecording = null;
        this.recordedActions = [];
        this.savedAutomations = [];
        this.automationObserver = null;
        this.cdpRecorder = null; // CDP-based recorder
        // Always use Puppeteer for recording and playback
        this.puppeteerInitialized = false;

        // Onboarding elements
        this.onboardingOverlay = document.getElementById('onboarding-overlay');
        this.onboardingSteps = [];
        this.currentOnboardingStep = 0;
        this.onboardingPrevBtn = null;
        this.onboardingNextBtn = null;
        this.onboardingSkipBtn = null;
        this.onboardingDots = [];

        // Download manager elements
        this.downloadsBtn = document.getElementById('downloads-btn');
        this.downloadsPanel = document.getElementById('downloads-panel');
        this.downloadsList = document.getElementById('downloads-list');
        this.downloadsBadge = document.getElementById('downloads-badge');
        this.clearDownloadsBtn = document.getElementById('clear-downloads-btn');
        this.downloads = []; // Array of download items

        this.init();
    }
    
    async init() {
        // Anti-bot measures are now handled by webview-preload.js

        // Set up address bar favicon drag listeners
        const addressBarFavicon = document.getElementById('address-bar-favicon');
        if (addressBarFavicon) {
            addressBarFavicon.addEventListener('dragstart', (e) => {
                const tab = this.getCurrentTab();
                if (tab && tab.url) {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        url: tab.url,
                        title: tab.title,
                        favicon: tab.favicon
                    }));
                    addressBarFavicon.style.opacity = '0.5';
                }
            });

            addressBarFavicon.addEventListener('dragend', (e) => {
                addressBarFavicon.style.opacity = '1';
            });
        }

        // Set up listener for DevTools toggle from menu
        window.electronAPI.onToggleWebviewDevTools(() => {
            this.toggleWebviewDevTools();
        });

        window.electronAPI.onViewPageSource(() => {
            this.viewPageSource().catch(err => {
                console.error('View source error:', err);
            });
        });

        // Set up listener for incognito mode
        window.electronAPI.onSetIncognitoMode((isIncognito) => {
            this.isIncognito = isIncognito;
            this.applyIncognitoStyling();
        });

        // Set up listener for popups intercepted by main process
        window.electronAPI.onOpenInNewTab((url) => {
            const newTabId = this.createTab(url);
            setTimeout(() => {
                this.switchToTab(newTabId);
            }, 100);
        });
        
        // Set up menu event listeners
        window.electronAPI.onToggleBookmarksBar(() => {
            this.toggleBookmarksBar();
        });

        window.electronAPI.onBookmarkCurrentPage(() => {
            this.bookmarkCurrentPage();
        });

        window.electronAPI.onShowAllBookmarks(() => {
            this.showAllBookmarksDialog();
        });

        window.electronAPI.onOpenBookmark((url) => {
            // Check if this is an automation bookmark
            const bookmark = this.bookmarks.find(b => b.url === url);

            if (bookmark && bookmark.isAutomation && bookmark.automationId) {
                const automation = this.savedAutomations.find(a => a.id === bookmark.automationId);
                if (automation) {
                    this.playAutomationInNewWindow(automation);
                } else {
                    this.showNotification('Automation not found', 'error');
                }
            } else {
                // Regular bookmark - navigate
                this.addressBar.value = url;
                this.navigate();
            }
        });

        window.electronAPI.onFocusAddressBar(() => {
            // Handle Command+L from main process menu
            // Find and blur any active webview first
            if (this.activeTabId) {
                const activeWebview = document.querySelector(`#tab-content-${this.activeTabId} webview`);
                if (activeWebview) {
                    activeWebview.blur();
                }
            }

            // Remove focus from any active element
            if (document.activeElement && document.activeElement !== this.addressBar) {
                document.activeElement.blur();
            }

            // Force focus to window first
            window.focus();

            // Focus and select the address bar
            this.addressBar.focus();
            this.addressBar.select();
            this.addressBar.setSelectionRange(0, this.addressBar.value.length);

            // Ensure it sticks
            setTimeout(() => {
                this.addressBar.focus();
                this.addressBar.select();
                this.addressBar.setSelectionRange(0, this.addressBar.value.length);
            }, 50);
        });

        window.electronAPI.onNewTab(() => {
            this.createTab();
        });

        window.electronAPI.onNewIncognitoTab(() => {
            this.createTab('', true);
        });

        window.electronAPI.onReopenClosedTab(() => {
            this.reopenClosedTab();
        });

        window.electronAPI.onSavePageAs(() => {
            this.savePageAs();
        });

        window.electronAPI.onPrintPage(() => {
            this.printPage();
        });

        window.electronAPI.onNextTab(() => {
            this.nextTab();
        });

        window.electronAPI.onPreviousTab(() => {
            this.previousTab();
        });

        window.electronAPI.onMoveTabRight(() => {
            this.moveTabRight();
        });

        window.electronAPI.onMoveTabLeft(() => {
            this.moveTabLeft();
        });

        window.electronAPI.onDuplicateTab(() => {
            this.duplicateTab();
        });

        window.electronAPI.onShowHistory(() => {
            this.showHistory();
        });

        window.electronAPI.onClearBrowsingData(() => {
            this.showClearBrowsingDataDialog();
        });

        window.electronAPI.onShowSettings(() => {
            this.showSettings();
        });

        window.electronAPI.onCloseCurrentTab(() => {
            if (this.activeTabId !== null) {
                this.closeTab(this.activeTabId);
            }
        });

        window.electronAPI.onGoBack(() => {
            this.goBack();
        });

        window.electronAPI.onGoForward(() => {
            this.goForward();
        });

        window.electronAPI.onReloadPage(() => {
            const tab = this.getCurrentTab();
            if (tab && tab.webview) {
                tab.webview.reload();
            }
        });
        
        window.electronAPI.onForceReloadPage(() => {
            const tab = this.getCurrentTab();
            if (tab && tab.webview) {
                tab.webview.reloadIgnoringCache();
            }
        });

        window.electronAPI.onFindInPage(() => {
            this.showSearchBar();
        });

        window.electronAPI.onResetZoom(() => {
            const tab = this.getCurrentTab();
            if (tab && tab.mode === 'web') {
                const webview = this.getOrCreateWebview(this.activeTabId);
                if (webview) {
                    webview.setZoomLevel(0);
                }
            }
        });

        window.electronAPI.onZoomIn(() => {
            const tab = this.getCurrentTab();
            if (tab && tab.mode === 'web') {
                const webview = this.getOrCreateWebview(this.activeTabId);
                if (webview) {
                    webview.setZoomLevel(webview.getZoomLevel() + 1);
                }
            }
        });

        window.electronAPI.onZoomOut(() => {
            const tab = this.getCurrentTab();
            if (tab && tab.mode === 'web') {
                const webview = this.getOrCreateWebview(this.activeTabId);
                if (webview) {
                    webview.setZoomLevel(webview.getZoomLevel() - 1);
                }
            }
        });
        
        // Set up event listeners FIRST (before creating any tabs)
        this.setupEventListeners();
        this.setupSearchBar();
        this.setupPageContextMenu();
        this.setupModelSelector();
        this.setupAdBlockerToggle();
        this.setupTrackerBlockerToggle();
        this.setupDarkModeEnforcer();
        this.setupAutomationFeature();
        this.setupDownloadManager();
        this.setupNetworkDetection();
        this.setupOnboarding();

        // Set up bookmarks bar drag and drop
        this.setupBookmarksBarDragDrop();
        
        // Load bookmarks from localStorage after a small delay to ensure proper initialization
        setTimeout(() => {
            this.loadBookmarksBarVisibility();
            this.loadBookmarks();
            this.loadHistory();
        }, 100);

        // Check API key status
        this.checkApiKeyStatus();
        this.checkInceptionApiKeyStatus();

        // Load pinned tabs first
        this.loadPinnedTabs();

        // Check if tab restoration is enabled
        const settings = await this.loadSettings();
        this.isRestoreEnabled = settings.restoreTabsOnStartup;

        // Apply third-party cookie blocking if enabled
        if (settings.blockThirdPartyCookies) {
            await window.electronAPI.setThirdPartyCookieBlocking(true);
        }

        // Try to load saved tab state if enabled
        try {
            const tabsRestored = await this.loadTabState();
        } catch (err) {
            console.error('Error loading tab state:', err);
        }

        // ALWAYS ensure at least one tab exists
        // Check after a short delay to ensure pinned tabs have loaded
        setTimeout(() => {
            if (this.tabs.length === 0) {
                console.log('No tabs found, creating initial tab');
                this.createTab();
            }
        }, 100);

        // Set up periodic backup (every 30 seconds)
        if (this.isRestoreEnabled) {
            setInterval(() => {
                this.saveTabState();
            }, 30000);
        }

        // Focus address bar on initial load
        setTimeout(() => {
            this.addressBar.focus();
            this.addressBar.select();
        }, 100);

        // Check if onboarding should be shown
        setTimeout(() => {
            this.checkAndShowOnboarding();
        }, 500);
    }
    
    async checkApiKeyStatus() {
        const status = await window.electronAPI.getApiKeyStatus();
        const warningDismissed = localStorage.getItem('apiKeyWarningDismissed') === 'true';

        if (!status.hasKey && !warningDismissed) {
            this.apiKeyWarning.classList.remove('hidden');
        }
    }

    async checkInceptionApiKeyStatus() {
        // Only check if the warning element exists
        if (!this.inceptionApiKeyWarning) return;

        const status = await window.electronAPI.getInceptionApiKeyStatus();
        const warningDismissed = localStorage.getItem('inceptionApiKeyWarningDismissed') === 'true';

        if (!status.hasKey && !warningDismissed) {
            this.inceptionApiKeyWarning.classList.remove('hidden');
        }
    }

    // Safe wrapper for executeJavaScript that handles destroyed webviews
    async safeExecuteJS(webview, script) {
        if (!webview || !document.body.contains(webview)) {
            return null;
        }
        try {
            return await webview.executeJavaScript(script);
        } catch (err) {
            if (!err.message || !err.message.includes('Invalid guestInstanceId')) {
                console.error('JS execution error:', err);
            }
            return null;
        }
    }

    setupEventListeners() {
        // Auto-resize textarea
        this.addressBar.addEventListener('input', () => this.autoResize());

        // Select all text when clicking the address bar (like Chrome)
        this.addressBar.addEventListener('click', () => {
            this.addressBar.select();
        });

        // Setup autocomplete functionality
        this.setupAutocomplete();

        // Handle Enter key in address bar
        this.addressBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // If an autocomplete item is selected, use it
                if (this.selectedAutocompleteIndex >= 0 && this.autocompleteResults.length > 0) {
                    const selected = this.autocompleteResults[this.selectedAutocompleteIndex];
                    this.addressBar.value = selected.url;
                }
                this.hideAutocomplete(); // Always hide autocomplete when Enter is pressed
                this.navigate();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectNextAutocomplete();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectPreviousAutocomplete();
            } else if (e.key === 'Escape') {
                this.hideAutocomplete();
            }
        });
        
        // Define a function to handle Command+L (arrow function automatically binds this)
        const handleCommandL = (e) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Find and blur any active webview first
                if (this.activeTabId) {
                    const activeWebview = document.querySelector(`#tab-content-${this.activeTabId} webview`);
                    if (activeWebview) {
                        activeWebview.blur();
                    }
                }

                // Remove focus from any active element
                if (document.activeElement && document.activeElement !== this.addressBar) {
                    document.activeElement.blur();
                }

                // Force focus even if something else has focus
                this.addressBar.focus();

                // Immediately select text
                this.addressBar.select();
                this.addressBar.setSelectionRange(0, this.addressBar.value.length);

                // Also retry with setTimeout to ensure it sticks
                setTimeout(() => {
                    if (document.activeElement === this.addressBar) {
                        this.addressBar.select();
                        this.addressBar.setSelectionRange(0, this.addressBar.value.length);
                    } else {
                        // If still not focused, force it again
                        this.addressBar.focus();
                        this.addressBar.select();
                        this.addressBar.setSelectionRange(0, this.addressBar.value.length);
                    }
                }, 50);

                return false;
            }
        }; // Arrow function already has correct this binding

        // Handle F12 with highest priority to prevent default DevTools
        const handleF12 = (e) => {
            if (e.key === 'F12' || ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'i' || e.key === 'I'))) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.toggleWebviewDevTools();
                return false;
            }
        };

        // Handle stop recording shortcut with highest priority
        const handleStopRecording = async (e) => {
            if (this.isRecording && (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r'))) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                await this.stopRecording();
                this.showNotification('⏹️ Recording stopped via keyboard shortcut', 'info');
                return false;
            }
        };

        // Add F12 handler with highest priority (capture phase)
        document.addEventListener('keydown', handleF12, true);
        window.addEventListener('keydown', handleF12, true);

        // Add stop recording handler with highest priority
        document.addEventListener('keydown', handleStopRecording, true);
        window.addEventListener('keydown', handleStopRecording, true);

        // Handle keyboard shortcuts - use capture phase for higher priority
        document.addEventListener('keydown', handleCommandL, true);

        // Also add to window to catch events that might not bubble to document
        window.addEventListener('keydown', handleCommandL, true);

        // Periodically ensure our keyboard handler stays active
        // This handles cases where webviews or page scripts might interfere
        setInterval(() => {
            // Always re-register to ensure they're at the top of the handler stack
            document.removeEventListener('keydown', handleCommandL, true);
            window.removeEventListener('keydown', handleCommandL, true);
            document.removeEventListener('keydown', handleStopRecording, true);
            window.removeEventListener('keydown', handleStopRecording, true);

            document.addEventListener('keydown', handleStopRecording, true);
            window.addEventListener('keydown', handleStopRecording, true);
            document.addEventListener('keydown', handleCommandL, true);
            window.addEventListener('keydown', handleCommandL, true);
        }, 2000); // Check every 2 seconds

        // Continue with other keyboard shortcuts
        document.addEventListener('keydown', async (e) => {
            // Skip all shortcuts if an input field has focus (including address bar)
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.contentEditable === 'true' ||
                activeElement === this.addressBar
            );

            // Stop recording shortcut (Escape or Cmd/Ctrl+Shift+R) - works even with input focus
            if (this.isRecording) {
                if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r')) {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.stopRecording();
                    this.showNotification('⏹️ Recording stopped via keyboard shortcut', 'info');
                    return false;
                }
            }

            // Already handled Command+L above, skip it
            if ((e.metaKey || e.ctrlKey) && (e.key === 'l' || e.key === 'L')) {
                return false;
            }

            // DevTools shortcut (Cmd/Ctrl+Option/Alt+I or F12)
            if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'i' || e.key === 'I')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.toggleWebviewDevTools();
                return false;
            }
            if (e.key === 'F12') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.toggleWebviewDevTools();
                return false;
            }

            // Command+Option+U / Ctrl+Alt+U to view page source
            // This is now handled by the application menu in main.js
            // Keeping this as a fallback in case the menu shortcut doesn't work
            if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'u' || e.key === 'U' || e.code === 'KeyU')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.viewPageSource().catch(err => {
                    console.error('View source error:', err);
                    this.showNotification('Error viewing page source', 'error');
                });
                return false;
            }

            // Command+F / Ctrl+F to find in page - works even with input focus
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.showSearchBar();
                return false;
            }

            // Don't handle other shortcuts if input is focused
            if (isInputFocused) {
                return; // Let the input field handle the event normally
            }
            
            // Command+Shift+B / Ctrl+Shift+B to toggle bookmarks bar
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
                e.preventDefault();
                this.toggleBookmarksBar();
            }
            
            // Command+N / Ctrl+N to open new window
            if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
                e.preventDefault();
                window.electronAPI.newWindow();
            }

            // Command+Shift+N / Ctrl+Shift+N to open new incognito window
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                window.electronAPI.newIncognitoWindow();
            }
            
            // Command+T / Ctrl+T to open new tab
            if ((e.metaKey || e.ctrlKey) && e.key === 't' && !e.shiftKey) {
                e.preventDefault();
                this.createTab();
            }

            // Command+Shift+T / Ctrl+Shift+T to reopen closed tab
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.reopenClosedTab();
            }

            // Command+Shift+N / Ctrl+Shift+N to open new incognito window (moved from tab)
            // Now using window instead of tab for incognito

            // Command+P / Ctrl+P to print
            if ((e.metaKey || e.ctrlKey) && e.key === 'p' && !e.shiftKey) {
                e.preventDefault();
                this.printPage();
            }

            // Command+Y / Ctrl+H to show history
            if ((e.metaKey && e.key === 'y') || (e.ctrlKey && e.key === 'h')) {
                e.preventDefault();
                this.showHistory();
            }

            // Ctrl+Tab to go to next tab
            if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                this.nextTab();
            }

            // Ctrl+Shift+Tab to go to previous tab
            if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
                e.preventDefault();
                this.previousTab();
            }

            // Command+Shift+] / Ctrl+Shift+] to move tab right
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ']') {
                e.preventDefault();
                this.moveTabRight();
            }

            // Command+Shift+[ / Ctrl+Shift+[ to move tab left
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '[') {
                e.preventDefault();
                this.moveTabLeft();
            }

            // Command+Shift+D / Ctrl+Shift+D to duplicate tab
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
                e.preventDefault();
                this.duplicateTab();
            }

            // Command+W / Ctrl+W to close current tab
            if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
                e.preventDefault();
                if (this.activeTabId !== null) {
                    this.closeTab(this.activeTabId);
                }
            }
            
            // Command+Option+Left Arrow / Ctrl+Alt+Left Arrow to select previous tab
            if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.selectPreviousTab();
            }
            
            // Command+Option+Right Arrow / Ctrl+Alt+Right Arrow to select next tab
            if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.selectNextTab();
            }
            
            // Command+Left Arrow / Ctrl+Left Arrow to go back (not with Alt key)
            if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.goBack();
            }
            
            // Command+Right Arrow / Ctrl+Right Arrow to go forward (not with Alt key)
            if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.goForward();
            }
            
            // Command+R / Ctrl+R to refresh current page
            if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
                e.preventDefault();
                this.refresh();
            }

            // Command++ / Ctrl++ to zoom in
            if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                const tab = this.getCurrentTab();
                if (tab && tab.mode === 'web') {
                    const webview = this.getOrCreateWebview(this.activeTabId);
                    if (webview) {
                        webview.setZoomLevel(webview.getZoomLevel() + 1);
                    }
                }
            }

            // Command+- / Ctrl+- to zoom out
            if ((e.metaKey || e.ctrlKey) && e.key === '-') {
                e.preventDefault();
                const tab = this.getCurrentTab();
                if (tab && tab.mode === 'web') {
                    const webview = this.getOrCreateWebview(this.activeTabId);
                    if (webview) {
                        webview.setZoomLevel(webview.getZoomLevel() - 1);
                    }
                }
            }

            // Command+0 / Ctrl+0 to reset zoom
            if ((e.metaKey || e.ctrlKey) && e.key === '0') {
                e.preventDefault();
                const tab = this.getCurrentTab();
                if (tab && tab.mode === 'web') {
                    const webview = this.getOrCreateWebview(this.activeTabId);
                    if (webview) {
                        webview.setZoomLevel(0);
                    }
                }
            }

            // Command+D / Ctrl+D to bookmark current page
            if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
                e.preventDefault();
                const tab = this.getCurrentTab();
                if (tab && tab.url && tab.mode === 'web') {
                    this.addBookmark(tab.url, tab.title, tab.favicon);
                }
            }

            // Command+S / Ctrl+S to save page
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                this.savePageAs();
            }
            
            // Note: Main app DevTools is Cmd+Option+I (handled by main process menu)
            // Webview DevTools is F12 (handled below)
            
            // Command+Tab number to switch tabs
            if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                if (index < this.tabs.length) {
                    this.switchToTab(this.tabs[index].id);
                }
            }
        }, true); // Use capture phase for higher priority on all keyboard shortcuts
        
        // Navigation buttons
        // Go button removed - navigation happens on Enter key
        this.backBtn.addEventListener('click', () => this.goBack());
        this.forwardBtn.addEventListener('click', () => this.goForward());
        this.refreshBtn.addEventListener('click', () => this.refresh());
        this.newTabBtn.addEventListener('click', () => this.createTab());

        // Bookmark scroll buttons
        if (this.bookmarksScrollLeft) {
            this.bookmarksScrollLeft.addEventListener('click', () => {
                this.bookmarksContainer.scrollBy({
                    left: -200,
                    behavior: 'smooth'
                });
            });
        }

        if (this.bookmarksScrollRight) {
            this.bookmarksScrollRight.addEventListener('click', () => {
                this.bookmarksContainer.scrollBy({
                    left: 200,
                    behavior: 'smooth'
                });
            });
        }

        // Update scroll button visibility when scrolling
        if (this.bookmarksContainer) {
            this.bookmarksContainer.addEventListener('scroll', () => {
                this.updateBookmarkScrollButtons();
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }
        
        // Summary dropdown setup
        const summaryBtn = document.getElementById('summary-btn');
        const summaryMenu = document.getElementById('summary-menu');
        const summaryOverlay = document.getElementById('summary-overlay');
        const summaryClose = summaryOverlay.querySelector('.summary-close');
        const summaryBody = summaryOverlay.querySelector('.summary-body');

        // Toggle summary dropdown menu
        summaryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            summaryMenu.classList.toggle('hidden');

            // Hide other dropdowns
            const automationMenu = document.getElementById('automation-menu');
            if (automationMenu) automationMenu.classList.add('hidden');
        });

        // Handle summary menu item clicks
        summaryMenu.addEventListener('click', async (e) => {
            const item = e.target.closest('.summary-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            summaryMenu.classList.add('hidden');

            if (action === 'single-page') {
                await this.summarizeCurrentPage();
            } else if (action === 'multi-page') {
                this.showMultiPageSummaryDialog();
            } else if (action === 'ask-page') {
                this.showAskPageDialog();
            } else if (action === 'search-suggestions') {
                await this.generateSearchSuggestions();
            }
        });

        summaryClose.addEventListener('click', () => {
            summaryOverlay.classList.add('hidden');
        });

        // Extract overlay setup
        const extractOverlay = document.getElementById('extract-overlay');
        const extractClose = extractOverlay.querySelector('.extract-close');

        extractClose.addEventListener('click', () => {
            extractOverlay.classList.add('hidden');
        });

        // Multi-page summary dialog setup
        const multiPageDialog = document.getElementById('multi-page-summary-dialog');
        const tabCountSlider = document.getElementById('tab-count-slider');
        const tabCountDisplay = document.getElementById('tab-count-display');
        const tabPreviewList = document.getElementById('tab-preview-list');
        const multiSummaryStartBtn = document.getElementById('multi-summary-start-btn');
        const multiSummaryCancelBtn = document.getElementById('multi-summary-cancel-btn');

        // Update tab count display when slider changes
        tabCountSlider.addEventListener('input', () => {
            const count = tabCountSlider.value;
            tabCountDisplay.textContent = `${count} tabs`;
            this.updateTabPreviewList(parseInt(count));
        });

        // Handle multi-page summary start
        multiSummaryStartBtn.addEventListener('click', async () => {
            const tabCount = parseInt(tabCountSlider.value);
            multiPageDialog.classList.add('hidden');
            await this.summarizeMultipleTabs(tabCount);
        });

        // Handle cancel
        multiSummaryCancelBtn.addEventListener('click', () => {
            multiPageDialog.classList.add('hidden');
        });

        // Close dialog when clicking close button
        multiPageDialog.querySelector('.dialog-close').addEventListener('click', () => {
            multiPageDialog.classList.add('hidden');
        });
        
        // Smart Bookmark button
        const smartBookmarkBtn = document.getElementById('smart-bookmark-btn');
        smartBookmarkBtn.addEventListener('click', async () => {
            await this.createSmartBookmark();
        });
        
        // Tag filter
        this.tagFilter.addEventListener('change', (e) => {
            this.currentTagFilter = e.target.value;
            this.renderBookmarks();
        });

        // Semantic search button
        const semanticSearchBtn = document.getElementById('semantic-search-btn');
        if (semanticSearchBtn) {
            semanticSearchBtn.addEventListener('click', () => {
                this.showSemanticSearchDialog();
            });
        }

        // Screenshot button
        const screenshotBtn = document.getElementById('screenshot-btn');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', async () => {
                await this.takeScreenshot();
            });
        }

        // Semantic search dialog elements
        const semanticSearchDialog = document.getElementById('semantic-search-dialog');
        const semanticSearchInput = document.getElementById('semantic-search-input');
        const semanticSearchBtnConfirm = document.getElementById('semantic-search-btn-confirm');
        const semanticSearchBtnCancel = document.getElementById('semantic-search-btn-cancel');
        const semanticSearchDialogClose = semanticSearchDialog?.querySelector('.dialog-close');

        if (semanticSearchBtnConfirm) {
            semanticSearchBtnConfirm.addEventListener('click', async () => {
                const query = semanticSearchInput.value.trim();
                if (query) {
                    await this.performSemanticSearch(query);
                }
            });
        }

        if (semanticSearchBtnCancel) {
            semanticSearchBtnCancel.addEventListener('click', () => {
                this.hideSemanticSearchDialog();
            });
        }

        if (semanticSearchDialogClose) {
            semanticSearchDialogClose.addEventListener('click', () => {
                this.hideSemanticSearchDialog();
            });
        }

        if (semanticSearchInput) {
            semanticSearchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        await this.performSemanticSearch(query);
                    }
                }
            });
        }

        // Ask Page dialog setup
        const askPageDialog = document.getElementById('ask-page-dialog');
        const askPageInput = document.getElementById('ask-page-input');
        const askPageBtnConfirm = document.getElementById('ask-page-btn-confirm');
        const askPageBtnCancel = document.getElementById('ask-page-btn-cancel');
        const askPageDialogClose = askPageDialog?.querySelector('.dialog-close');

        if (askPageBtnConfirm) {
            askPageBtnConfirm.addEventListener('click', async () => {
                const question = askPageInput.value.trim();
                if (question) {
                    await this.askAboutPage(question);
                }
            });
        }

        if (askPageBtnCancel) {
            askPageBtnCancel.addEventListener('click', () => {
                this.hideAskPageDialog();
            });
        }

        if (askPageDialogClose) {
            askPageDialogClose.addEventListener('click', () => {
                this.hideAskPageDialog();
            });
        }

        if (askPageInput) {
            askPageInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const question = e.target.value.trim();
                    if (question) {
                        await this.askAboutPage(question);
                    }
                }
            });
        }

        // Computer Use button and sidebar
        const computerUseBtn = document.getElementById('computer-use-btn');
        const computerUseSidebar = document.getElementById('computer-use-sidebar');
        const computerUseSidebarClose = document.getElementById('computer-use-sidebar-close');
        const computerUseTask = document.getElementById('computer-use-task');
        const computerUseStart = document.getElementById('computer-use-start');
        const computerUseStop = document.getElementById('computer-use-stop');
        const computerUseLog = document.getElementById('computer-use-log');
        const computerUseStatus = computerUseSidebar?.querySelector('.computer-use-status');

        let computerUseActive = false;
        let computerUseAbort = false;

        if (computerUseBtn && computerUseSidebar) {
            computerUseBtn.addEventListener('click', () => {
                const tab = this.getCurrentTab();
                if (!tab || tab.mode !== 'web') {
                    this.showNotification('Computer Use only works on web pages', 'error');
                    return;
                }
                // Toggle sidebar
                if (computerUseSidebar.classList.contains('hidden')) {
                    computerUseSidebar.classList.remove('hidden');
                    computerUseTask.focus();
                } else {
                    computerUseSidebar.classList.add('hidden');
                }
            });

            computerUseSidebarClose.addEventListener('click', () => {
                computerUseSidebar.classList.add('hidden');
                computerUseAbort = true;
                computerUseActive = false;
                // Reset UI
                document.querySelector('.computer-use-input').style.display = 'block';
                computerUseStatus.classList.add('hidden');
                computerUseLog.innerHTML = '';
                computerUseTask.value = '';
            });

            computerUseStart.addEventListener('click', async () => {
                const task = computerUseTask.value.trim();
                if (!task) {
                    this.showNotification('Please enter a task for Claude', 'error');
                    return;
                }

                // Show status and hide input
                document.querySelector('.computer-use-input').style.display = 'none';
                computerUseStatus.classList.remove('hidden');
                computerUseLog.innerHTML = '';
                computerUseActive = true;
                computerUseAbort = false;

                // Add initial log entry
                this.addComputerUseLog('Starting task: ' + task, 'info');

                // Test mode for debugging
                if (task.toLowerCase() === 'test' || task.toLowerCase().startsWith('test click')) {
                    this.addComputerUseLog('Running in test mode', 'info');
                    try {
                        const webview = this.getOrCreateWebview(this.activeTabId);
                        this.addComputerUseLog('Webview found', 'success');

                        // Test click functionality
                        if (task.toLowerCase().startsWith('test click')) {
                            const coords = task.match(/(\d+),?\s*(\d+)/);
                            const x = coords ? parseInt(coords[1]) : 100;
                            const y = coords ? parseInt(coords[2]) : 100;

                            this.addComputerUseLog(`Testing click at (${x}, ${y})`, 'info');

                            // Test sendInputEvent
                            try {
                                webview.sendInputEvent({
                                    type: 'mouseDown',
                                    x: x,
                                    y: y,
                                    button: 'left',
                                    clickCount: 1
                                });
                                webview.sendInputEvent({
                                    type: 'mouseUp',
                                    x: x,
                                    y: y,
                                    button: 'left',
                                    clickCount: 1
                                });
                                this.addComputerUseLog('sendInputEvent executed successfully', 'success');
                            } catch (e) {
                                this.addComputerUseLog(`sendInputEvent error: ${e.message}`, 'error');
                            }

                            // Test element detection
                            const elementInfo = await webview.executeJavaScript(`
                                document.elementFromPoint(${x}, ${y})?.tagName || 'No element found'
                            `);
                            this.addComputerUseLog(`Element at position: ${elementInfo}`, 'info');
                        } else {
                            const testScreenshot = await webview.capturePage();
                            this.addComputerUseLog('Screenshot captured', 'success');

                            const pageInfo = await webview.executeJavaScript('document.title');
                            this.addComputerUseLog(`Page title: ${pageInfo}`, 'info');
                        }

                        this.addComputerUseLog('Test completed successfully!', 'success');
                    } catch (testError) {
                        this.addComputerUseLog(`Test error: ${testError.message}`, 'error');
                    }
                    computerUseActive = false;
                    computerUseStop.textContent = 'Done';
                    return;
                }

                try {
                    const webview = this.getOrCreateWebview(this.activeTabId);
                    if (!webview) {
                        throw new Error('No webview available');
                    }

                    let iterations = 0;
                    const maxIterations = 20;

                    while (computerUseActive && !computerUseAbort && iterations < maxIterations) {
                        iterations++;
                        this.addComputerUseLog(`Step ${iterations}: Taking screenshot...`, 'info');

                        // Capture screenshot
                        let screenshotData;
                        try {
                            const nativeImage = await webview.capturePage();
                            screenshotData = nativeImage.toDataURL();
                            this.addComputerUseLog('Screenshot captured successfully', 'info');
                        } catch (screenshotError) {
                            this.addComputerUseLog(`Screenshot error: ${screenshotError.message}`, 'error');
                            throw screenshotError;
                        }

                        // Get page context
                        const pageContext = await webview.executeJavaScript(`
                            (function() {
                                return {
                                    url: window.location.href,
                                    title: document.title,
                                    viewport: {
                                        width: window.innerWidth,
                                        height: window.innerHeight
                                    },
                                    scroll: {
                                        x: window.scrollX,
                                        y: window.scrollY,
                                        maxX: document.body.scrollWidth - window.innerWidth,
                                        maxY: document.body.scrollHeight - window.innerHeight
                                    }
                                };
                            })();
                        `);

                        this.addComputerUseLog('Analyzing page with Claude...', 'info');

                        // Call Claude with vision
                        let response;
                        try {
                            response = await window.electronAPI.computerUseClaude({
                                screenshot: screenshotData,
                                task: task,
                                pageContext: pageContext,
                                model: this.modelSelect.value  // Pass selected model from UI
                            });
                        } catch (apiError) {
                            this.addComputerUseLog(`API Error: ${apiError.message}`, 'error');
                            throw apiError;
                        }

                        if (!response || response.error) {
                            const errorMsg = response?.error || 'Failed to get Claude response';
                            this.addComputerUseLog(`Claude Error: ${errorMsg}`, 'error');

                            // If there's a response text, show it for debugging
                            if (response?.response) {
                                this.addComputerUseLog('Claude said: ' + response.response.substring(0, 200) + '...', 'info');
                            }
                            throw new Error(errorMsg);
                        }

                        if (!response.success) {
                            // Show what Claude actually said for debugging
                            if (response.response) {
                                this.addComputerUseLog('Claude response: ' + response.response.substring(0, 200) + '...', 'info');
                            }
                            throw new Error(response.error || 'Failed to get Claude response');
                        }

                        const action = response.action;
                        this.addComputerUseLog(`Claude: ${response.explanation}`, 'info');

                        // Check if task is complete
                        if (action.type === 'complete') {
                            this.addComputerUseLog(`Task completed: ${action.message}`, 'success');
                            computerUseActive = false;
                            break;
                        }

                        // Execute the action
                        this.addComputerUseLog(`Executing: ${JSON.stringify(action)}`, 'info');

                        if (action.type === 'click') {
                            this.addComputerUseLog(`Clicking at (${action.x}, ${action.y})`, 'info');

                                // Standard clicking for all sites
                                // Method 1: Try using sendInputEvent for most reliable clicking
                                try {
                                    // Move mouse to position
                                    webview.sendInputEvent({
                                    type: 'mouseMove',
                                    x: action.x,
                                    y: action.y
                                });

                                // Mouse down
                                webview.sendInputEvent({
                                    type: 'mouseDown',
                                    x: action.x,
                                    y: action.y,
                                    button: 'left',
                                    clickCount: 1
                                });

                                // Mouse up
                                webview.sendInputEvent({
                                    type: 'mouseUp',
                                    x: action.x,
                                    y: action.y,
                                    button: 'left',
                                    clickCount: 1
                                });

                                this.addComputerUseLog('Click sent via sendInputEvent', 'info');
                            } catch (err) {
                                this.addComputerUseLog('sendInputEvent failed, using JavaScript fallback', 'info');
                            }

                            // Method 2: JavaScript fallback
                            await webview.executeJavaScript(`
                                (function() {
                                    const x = ${action.x};
                                    const y = ${action.y};

                                    // Find element at coordinates
                                    const element = document.elementFromPoint(x, y);

                                    if (element) {

                                        // Create and dispatch mouse events
                                        const mousedownEvent = new MouseEvent('mousedown', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: x,
                                            clientY: y,
                                            button: 0,
                                            buttons: 1
                                        });
                                        element.dispatchEvent(mousedownEvent);

                                        const mouseupEvent = new MouseEvent('mouseup', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: x,
                                            clientY: y,
                                            button: 0,
                                            buttons: 0
                                        });
                                        element.dispatchEvent(mouseupEvent);

                                        const clickEvent = new MouseEvent('click', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: x,
                                            clientY: y,
                                            button: 0
                                        });
                                        element.dispatchEvent(clickEvent);

                                        // Special handling for links
                                        if (element.tagName === 'A' && element.href) {
                                            window.location.href = element.href;
                                        }

                                        // Focus input elements
                                        if (element.tagName === 'INPUT' ||
                                            element.tagName === 'TEXTAREA' ||
                                            element.tagName === 'SELECT') {
                                            element.focus();
                                            element.click(); // Some inputs need both
                                        }

                                        // For buttons, try click method directly
                                        if (element.tagName === 'BUTTON' ||
                                            (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit'))) {
                                            element.click();
                                        }

                                        // Visual feedback (after click to not interfere)
                                        const indicator = document.createElement('div');
                                        indicator.style.cssText = \`
                                            position: fixed;
                                            left: \${x}px;
                                            top: \${y}px;
                                            width: 20px;
                                            height: 20px;
                                            margin-left: -10px;
                                            margin-top: -10px;
                                            border: 2px solid #667eea;
                                            border-radius: 50%;
                                            background: rgba(102, 126, 234, 0.3);
                                            pointer-events: none;
                                            z-index: 999999;
                                            animation: clickPulse 0.5s ease-out;
                                        \`;

                                        // Add animation style if not exists
                                        if (!document.getElementById('claude-click-style')) {
                                            const style = document.createElement('style');
                                            style.id = 'claude-click-style';
                                            style.textContent = \`
                                                @keyframes clickPulse {
                                                    0% { transform: scale(1); opacity: 1; }
                                                    100% { transform: scale(2); opacity: 0; }
                                                }
                                            \`;
                                            document.head.appendChild(style);
                                        }

                                        document.body.appendChild(indicator);
                                        setTimeout(() => indicator.remove(), 500);

                                        return {
                                            success: true,
                                            element: {
                                                tag: element.tagName,
                                                class: element.className,
                                                id: element.id,
                                                text: element.textContent?.substring(0, 50)
                                            }
                                        };
                                    } else {
                                        return { success: false, error: 'No element at coordinates' };
                                    }
                                })();
                            `).then(result => {
                                if (result?.success) {
                                    this.addComputerUseLog(`Clicked on: ${result.element.tag} "${result.element.text || result.element.class || ''}"`, 'success');
                                } else {
                                    this.addComputerUseLog('No element found at click position', 'error');
                                }
                            }).catch(err => {
                                this.addComputerUseLog(`Click error: ${err.message}`, 'error');
                            });

                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } else if (action.type === 'type') {
                            this.addComputerUseLog('Typing text', 'info');

                            // Universal typing for all sites
                            await webview.executeJavaScript(`
                                (function() {
                                    const activeElement = document.activeElement;
                                    const text = '${action.text.replace(/'/g, "\\'")}';

                                    if (activeElement && (activeElement.tagName === 'INPUT' ||
                                        activeElement.tagName === 'TEXTAREA')) {
                                        activeElement.value += text;
                                        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                                    } else if (activeElement && activeElement.contentEditable === 'true') {
                                        document.execCommand('insertText', false, text);
                                    }
                                })();
                            `);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } else if (action.type === 'key') {
                            // For Enter key, try using sendInputEvent as well
                            if (action.key === 'Enter') {
                                try {
                                    // Try webview's sendInputEvent for more reliable Enter key
                                    webview.sendInputEvent({
                                        type: 'keyDown',
                                        keyCode: 'Return'
                                    });
                                    webview.sendInputEvent({
                                        type: 'char',
                                        keyCode: '\r'
                                    });
                                    webview.sendInputEvent({
                                        type: 'keyUp',
                                        keyCode: 'Return'
                                    });
                                    this.addComputerUseLog('Sent Enter key via sendInputEvent', 'info');
                                } catch (err) {
                                    this.addComputerUseLog('sendInputEvent failed, using JavaScript fallback', 'info');
                                }
                            }

                            await webview.executeJavaScript(`
                                (function() {
                                    const activeElement = document.activeElement;
                                    const key = '${action.key}';

                                    // Special handling for Enter key
                                    if (key === 'Enter') {
                                        // Check for Google search or similar
                                        if (window.location.hostname.includes('google')) {
                                            // Find Google search button
                                            const searchButton = document.querySelector('input[name="btnK"], input[name="btnI"], button[aria-label*="Search"]');
                                            if (searchButton) {
                                                searchButton.click();
                                                return { success: true, message: 'Clicked Google search button' };
                                            }
                                        }

                                        // For forms, try to submit
                                        if (activeElement && activeElement.form) {
                                            // Check if there's a submit button to click
                                            const submitButton = activeElement.form.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
                                            if (submitButton) {
                                                submitButton.click();
                                                return { success: true, message: 'Clicked submit button' };
                                            }
                                            // Otherwise try to submit the form
                                            activeElement.form.submit();
                                            return { success: true, message: 'Submitted form' };
                                        }

                                        // For input elements, trigger change and blur
                                        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                                            // Trigger change event
                                            activeElement.dispatchEvent(new Event('change', { bubbles: true }));

                                            // For search inputs, trigger input and search events
                                            if (activeElement.type === 'search' || activeElement.type === 'text') {
                                                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                                                activeElement.dispatchEvent(new Event('search', { bubbles: true }));
                                            }
                                        }
                                    }

                                    // Create proper keyboard events with all necessary properties
                                    const keyCode = key === 'Enter' ? 13 :
                                                   key === 'Tab' ? 9 :
                                                   key === 'Escape' ? 27 :
                                                   key === 'Backspace' ? 8 :
                                                   key === 'Space' ? 32 : 0;

                                    // Dispatch keydown
                                    const keydownEvent = new KeyboardEvent('keydown', {
                                        key: key,
                                        code: key === 'Enter' ? 'Enter' : 'Key' + key.toUpperCase(),
                                        keyCode: keyCode,
                                        which: keyCode,
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    activeElement.dispatchEvent(keydownEvent);

                                    // Dispatch keypress for Enter (needed by some sites)
                                    if (key === 'Enter') {
                                        const keypressEvent = new KeyboardEvent('keypress', {
                                            key: key,
                                            code: 'Enter',
                                            keyCode: 13,
                                            which: 13,
                                            bubbles: true,
                                            cancelable: true
                                        });
                                        activeElement.dispatchEvent(keypressEvent);
                                    }

                                    // Dispatch keyup
                                    const keyupEvent = new KeyboardEvent('keyup', {
                                        key: key,
                                        code: key === 'Enter' ? 'Enter' : 'Key' + key.toUpperCase(),
                                        keyCode: keyCode,
                                        which: keyCode,
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    activeElement.dispatchEvent(keyupEvent);

                                    return { success: true };
                                })();
                            `);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } else if (action.type === 'scroll') {
                            await webview.executeJavaScript(`
                                window.scrollBy(0, ${action.direction === 'down' ? action.amount || 100 : -(action.amount || 100)});
                            `);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } else if (action.type === 'navigate') {
                            webview.loadURL(action.url);
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }

                        // Wait a bit before next iteration
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    if (iterations >= maxIterations) {
                        this.addComputerUseLog('Maximum iterations reached', 'error');
                    }

                } catch (error) {
                    this.addComputerUseLog(`Error: ${error.message}`, 'error');
                    console.error('Computer use error:', error);
                } finally {
                    computerUseActive = false;
                    computerUseStop.textContent = 'Close';
                }
            });

            computerUseStop.addEventListener('click', () => {
                if (computerUseActive) {
                    computerUseAbort = true;
                    computerUseActive = false;
                    this.addComputerUseLog('Task stopped by user', 'info');
                    computerUseStop.textContent = 'Done';
                } else {
                    // Reset UI but keep sidebar open
                    document.querySelector('.computer-use-input').style.display = 'block';
                    computerUseStatus.classList.add('hidden');
                    computerUseLog.innerHTML = '';
                    computerUseTask.value = '';
                    computerUseStop.textContent = 'Stop';
                }
            });
        }

        // Helper function to add log entries
        this.addComputerUseLog = (message, type = 'info') => {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            if (type === 'error') {
                logEntry.classList.add('log-error');
            } else if (type === 'success') {
                logEntry.classList.add('log-success');
            }
            const timestamp = new Date().toLocaleTimeString();
            logEntry.textContent = `[${timestamp}] ${message}`;
            computerUseLog.appendChild(logEntry);
            computerUseLog.scrollTop = computerUseLog.scrollHeight;
        };
        
        summaryOverlay.addEventListener('click', (e) => {
            if (e.target === summaryOverlay) {
                summaryOverlay.classList.add('hidden');
            }
        });
        
        // API key setting
        this.setApiKeyBtn.addEventListener('click', async () => {
            const key = this.apiKeyInput.value.trim();
            if (key) {
                const result = await window.electronAPI.setApiKey(key);
                if (result.success) {
                    this.apiKeyWarning.classList.add('hidden');
                    this.apiKeyInput.value = '';
                    // Clear the dismissed flag since user now has an API key
                    localStorage.removeItem('apiKeyWarningDismissed');
                }
            }
        });

        // Get API key link
        const getApiKeyLink = document.getElementById('get-api-key-link');
        if (getApiKeyLink) {
            getApiKeyLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Show API key instructions in a new tab
                const newTabId = this.createTab();
                setTimeout(() => {
                    this.showApiKeyInstructions(newTabId);
                }, 100);
            });
        }

        // API key warning close button
        const apiKeyWarningClose = document.getElementById('api-key-warning-close');
        if (apiKeyWarningClose) {
            apiKeyWarningClose.addEventListener('click', () => {
                this.apiKeyWarning.classList.add('hidden');
                localStorage.setItem('apiKeyWarningDismissed', 'true');
            });
        }

        // Inception Labs API key setting (only if elements exist)
        if (this.setInceptionApiKeyBtn) {
            this.setInceptionApiKeyBtn.addEventListener('click', async () => {
                const key = this.inceptionApiKeyInput.value.trim();
                if (key) {
                    const result = await window.electronAPI.setInceptionApiKey(key);
                    if (result.success) {
                        this.inceptionApiKeyWarning.classList.add('hidden');
                        this.inceptionApiKeyInput.value = '';
                        // Clear the dismissed flag since user now has an API key
                        localStorage.removeItem('inceptionApiKeyWarningDismissed');
                        this.showNotification('Inception Labs API key saved successfully', 'success');
                    }
                }
            });
        }

        // Allow pressing Enter to save Inception API key (only if elements exist)
        if (this.inceptionApiKeyInput && this.setInceptionApiKeyBtn) {
            this.inceptionApiKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.setInceptionApiKeyBtn.click();
                }
            });
        }

        // Get Inception API key link
        const getInceptionApiKeyLink = document.getElementById('get-inception-api-key-link');
        if (getInceptionApiKeyLink) {
            getInceptionApiKeyLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Show Inception API key instructions in a new tab
                const newTabId = this.createTab();
                setTimeout(() => {
                    this.showInceptionApiKeyInstructions(newTabId);
                }, 100);
            });
        }

        // Inception API key warning close button
        const inceptionApiKeyWarningClose = document.getElementById('inception-api-key-warning-close');
        if (inceptionApiKeyWarningClose) {
            inceptionApiKeyWarningClose.addEventListener('click', () => {
                this.inceptionApiKeyWarning.classList.add('hidden');
                localStorage.setItem('inceptionApiKeyWarningDismissed', 'true');
            });
        }
    }
    
    autoResize() {
        this.addressBar.style.height = 'auto';
        this.addressBar.style.height = this.addressBar.scrollHeight + 'px';
    }
    
    createTab(url = '', isIncognito = false) {
        const tabId = ++this.tabIdCounter;

        // Create tab data
        const tab = {
            id: tabId,
            title: 'New Tab',
            url: url,
            favicon: null,
            history: [],
            historyIndex: -1,
            mode: 'welcome', // 'welcome', 'web', 'claude'
            isIncognito: isIncognito,
            isPinned: false,
            isMuted: false
        };
        
        this.tabs.push(tab);
        
        // Create tab UI element
        const tabElement = document.createElement('div');
        tabElement.className = isIncognito ? 'tab incognito-tab' : 'tab';
        tabElement.dataset.tabId = tabId;
        tabElement.draggable = true;
        tabElement.innerHTML = `
            ${isIncognito ? '<span class="incognito-icon">🕵️</span>' : ''}
            <img class="tab-favicon" style="display: none;" width="16" height="16">
            <span class="tab-title">${tab.title}</span>
            <span class="tab-audio-indicator" style="display: none;" title="Tab is playing audio - Click to mute"></span>
            <button class="tab-close" title="Close tab (Cmd+W / Ctrl+W)">×</button>
        `;

        // Create tooltip for tab
        const tooltip = document.createElement('div');
        tooltip.className = 'tab-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-title">${tab.title}</div>
            <div class="tooltip-memory">Memory: calculating...</div>
        `;
        tabElement.appendChild(tooltip);

        // Add hover handlers for tooltip
        let tooltipTimeout;
        tabElement.addEventListener('mouseenter', (e) => {
            tooltipTimeout = setTimeout(async () => {
                // Update memory usage if webview exists
                if (tab.webview && tab.webview.executeJavaScript) {
                    try {
                        // First check if performance.memory is available with proper flags
                        const hasMemoryAPI = await tab.webview.executeJavaScript(`
                            !!(window.performance && window.performance.memory && window.performance.memory.usedJSHeapSize)
                        `);

                        let memoryText = 'Memory: calculating...';

                        if (hasMemoryAPI) {
                            // Use the actual memory API if available
                            const memoryMB = await tab.webview.executeJavaScript(`
                                Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024)
                            `);
                            memoryText = `Memory: ${memoryMB} MB`;
                        } else {
                            // Fallback: count DOM nodes and estimate
                            const stats = await tab.webview.executeJavaScript(`
                                ({
                                    nodes: document.getElementsByTagName('*').length,
                                    images: document.images.length,
                                    scripts: document.scripts.length,
                                    styles: document.styleSheets.length,
                                    href: window.location.href
                                })
                            `);

                            // Check if we got valid stats
                            if (stats && stats.nodes > 0) {
                                // Rough estimation
                                const memoryMB = Math.round(
                                    20 + // Base overhead
                                    (stats.nodes * 0.002) + // ~2KB per DOM node
                                    (stats.images * 1) + // ~1MB per image
                                    (stats.scripts * 0.2) + // ~200KB per script
                                    (stats.styles * 0.1) // ~100KB per stylesheet
                                );
                                memoryText = `Memory: ~${memoryMB} MB (est.)`;
                            } else {
                                // Page not fully loaded or about:blank
                                memoryText = 'Memory: < 1 MB';
                            }
                        }

                        tooltip.querySelector('.tooltip-memory').textContent = memoryText;
                    } catch (err) {
                        console.error('Memory calculation error:', err);
                        // If webview is not ready or page is loading
                        tooltip.querySelector('.tooltip-memory').textContent = 'Memory: Loading...';
                    }
                } else {
                    // No webview (welcome tab or claude tab)
                    tooltip.querySelector('.tooltip-memory').textContent = 'Memory: < 1 MB';
                }

                tooltip.querySelector('.tooltip-title').textContent = tab.title || 'New Tab';

                // Position tooltip below the tab
                const rect = tabElement.getBoundingClientRect();
                tooltip.style.left = Math.min(rect.left, window.innerWidth - 410) + 'px'; // Keep within viewport
                tooltip.style.top = (rect.bottom + 8) + 'px';

                tooltip.classList.add('visible');
            }, 500); // Show after 500ms hover
        });

        tabElement.addEventListener('mouseleave', () => {
            clearTimeout(tooltipTimeout);
            tooltip.classList.remove('visible');
        });
        
        // Add click listeners
        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close') && !e.target.classList.contains('tab-audio-indicator')) {
                this.switchToTab(tabId);
            }
        });

        // Add right-click context menu
        tabElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showTabContextMenu(e, tabId);
        });
        
        tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });

        // Audio indicator click handler
        const audioIndicator = tabElement.querySelector('.tab-audio-indicator');
        audioIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTabMute(tabId);
        });
        
        // Add drag and drop listeners for reordering
        this.setupTabDragAndDrop(tabElement, tabId);
        
        this.tabsContainer.appendChild(tabElement);
        
        // Create content container
        const contentElement = document.createElement('div');
        contentElement.className = isIncognito ? 'tab-content incognito-content' : 'tab-content';
        contentElement.dataset.tabId = tabId;
        contentElement.innerHTML = `
            <div class="tab-claude-results" style="display: none;"></div>
            <div class="tab-welcome-screen">
                <h1>${isIncognito ? '🕵️ Incognito Mode' : `Welcome to ${BROWSER_NAME}`}</h1>
                <p>${isIncognito ? 'Your browsing in this tab is private. History and cookies will not be saved.' : 'Enter a URL to browse the web or ask Claude/Mercury'}</p>
            </div>
            <div class="tab-suggestions-overlay hidden">
                <div class="suggestions-content">
                    <div class="suggestions-header">
                        <h2>🔍 Context-Aware Search Suggestions</h2>
                        <button class="suggestions-close" title="Close suggestions">×</button>
                    </div>
                    <div class="suggestions-body">
                        <div class="suggestions-loading">Analyzing page context...</div>
                        <div class="suggestions-list"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.tabsContent.appendChild(contentElement);
        
        // Switch to new tab
        this.switchToTab(tabId);

        // Navigate if URL provided
        if (url) {
            this.addressBar.value = url;
            this.navigate();
        }

        // Focus the address bar for new tabs
        setTimeout(() => {
            this.addressBar.focus();
            this.addressBar.select();
        }, 50);

        // Schedule auto-save after creating a tab
        this.scheduleAutoSave();

        return tabId;
    }
    
    closeTab(tabId) {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        // Close window if it's the last tab
        if (this.tabs.length === 1) {
            const tab = this.tabs[0];

            // Save to closed tabs before closing (if it had content)
            if (!tab.isIncognito && tab.url) {
                const closedTabData = {
                    url: tab.url,
                    title: tab.title,
                    favicon: tab.favicon,
                    history: [...tab.history],
                    historyIndex: tab.historyIndex,
                    mode: tab.mode,
                    timestamp: Date.now()
                };
                this.closedTabs.unshift(closedTabData);
                if (this.closedTabs.length > this.maxClosedTabs) {
                    this.closedTabs = this.closedTabs.slice(0, this.maxClosedTabs);
                }
            }

            // Close the window
            window.electronAPI.closeWindow();
            return;
        }

        const tab = this.tabs[tabIndex];

        // Save closed tab data (but not incognito tabs)
        if (!tab.isIncognito && tab.url) {
            const closedTabData = {
                url: tab.url,
                title: tab.title,
                favicon: tab.favicon,
                history: [...tab.history],
                historyIndex: tab.historyIndex,
                mode: tab.mode,
                timestamp: Date.now()
            };

            // Add to closed tabs stack
            this.closedTabs.unshift(closedTabData);

            // Keep only the last N closed tabs
            if (this.closedTabs.length > this.maxClosedTabs) {
                this.closedTabs = this.closedTabs.slice(0, this.maxClosedTabs);
            }
        }

        // Remove tab from array
        this.tabs.splice(tabIndex, 1);

        // Remove UI elements
        const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
        const contentElement = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) tabElement.remove();
        if (contentElement) contentElement.remove();

        // Switch to another tab if this was active
        if (this.activeTabId === tabId) {
            const newActiveTab = this.tabs[Math.min(tabIndex, this.tabs.length - 1)];
            if (newActiveTab) {
                this.switchToTab(newActiveTab.id);
            }
        }

        // Schedule auto-save after closing a tab
        this.scheduleAutoSave();
    }
    
    switchToTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) {
            console.error('Tab not found:', tabId);
            return;
        }
        
        
        // Update active states
        this.activeTabId = tabId;
        
        // Update tab UI
        this.tabsContainer.querySelectorAll('.tab').forEach(el => {
            const isActive = el.dataset.tabId === String(tabId);
            el.classList.toggle('active', isActive);
        });
        
        // Update content visibility
        this.tabsContent.querySelectorAll('.tab-content').forEach(el => {
            const isActive = el.dataset.tabId === String(tabId);
            el.classList.toggle('active', isActive);
        });
        
        // Update address bar
        this.addressBar.value = tab.url || '';
        this.autoResize();
        
        // Update address bar favicon
        this.updateAddressBarFavicon(tab.favicon);

        // Update navigation buttons
        this.updateNavigationButtons();

        // Focus address bar when switching tabs (if it's a new/welcome tab)
        if (tab.mode === 'welcome' && !tab.url) {
            setTimeout(() => {
                this.addressBar.focus();
                this.addressBar.select();
            }, 50);
        } else if (tab.mode === 'web' && tab.webview) {
            // Focus the webview for web pages so keyboard navigation works
            setTimeout(() => {
                tab.webview.focus();
            }, 50);
        }
    }
    
    updateTabTitle(tabId, title) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        // Clean HTML entities and fragments from title
        if (title) {
            const originalTitle = title;

            // First, strip any leading/trailing whitespace and common HTML artifacts
            title = title.trim();

            // Remove leading > or < or &gt; that might be from broken HTML
            title = title.replace(/^(&gt;|&lt;|[<>])+/, '');

            // Decode HTML entities without interpreting as HTML
            const textarea = document.createElement('textarea');
            textarea.innerHTML = title;
            title = textarea.value;

            // Remove any leading > or < after decoding
            title = title.replace(/^[<>]+/, '');

            // Final cleanup - remove any remaining HTML tags
            title = title.replace(/<[^>]*>/g, '');

            // Trim again after all processing
            title = title.trim();

            if (originalTitle.startsWith('>') || originalTitle.includes('&gt;')) {
            }
        }

        tab.title = title || 'New Tab';

        const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            const titleElement = tabElement.querySelector('.tab-title');
            if (titleElement) {
                titleElement.textContent = tab.title;
            }

            // Update tooltip if it exists
            const tooltip = tabElement.querySelector('.tab-tooltip .tooltip-title');
            if (tooltip) {
                tooltip.textContent = tab.title;
            }
        }

        // Update history entry if it exists (but not for automation tabs)
        if (tab.url && tabId !== this.recordingTabId) {
            const historyItem = this.browsingHistory.find(item => item.url === tab.url);
            if (historyItem) {
                historyItem.title = tab.title;
                this.saveHistory();
            }
        }
    }
    
    updateTabFavicon(tabId, faviconUrl) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        // Debug all favicon updates to track issues
        // Add cache-busting to favicon URL to force reload
        if (faviconUrl && !faviconUrl.startsWith('data:') && !faviconUrl.includes('_cb=')) {
            const separator = faviconUrl.includes('?') ? '&' : '?';
            faviconUrl = `${faviconUrl}${separator}_cb=${Date.now()}`;
        }

        // Don't store default/placeholder favicons
        if (faviconUrl &&
            !faviconUrl.includes('data:image/svg+xml,<svg') &&
            !faviconUrl.includes('PHN2ZyB4bWxucz0i')) {
            tab.favicon = faviconUrl;

            // Update the favicon in history for ALL entries with this URL
            // IMPORTANT: Only update if this is still the correct URL for this tab
            // AND this is not an automation recording tab
            if (tab.url && tabId !== this.recordingTabId) {
                // Double-check the tab still has the same URL (prevent race conditions)
                const currentTab = this.tabs.find(t => t.id === tabId);
                if (!currentTab || currentTab.url !== tab.url) {
                    console.warn('Tab URL changed during favicon update, skipping history update');
                    return;
                }

                let historyUpdated = false;
                const urlToUpdate = tab.url;  // Capture the URL to avoid race conditions


                // Only update if favicon actually changed
                this.browsingHistory.forEach(item => {
                    if (item.url === urlToUpdate && item.favicon !== faviconUrl) {
                        item.favicon = faviconUrl;
                        historyUpdated = true;
                    }
                });

                if (historyUpdated) {
                    this.saveHistory();
                }

                // Also update bookmark favicon if this URL is bookmarked and favicon changed
                const bookmark = this.bookmarks.find(b => b.url === urlToUpdate);
                if (bookmark && bookmark.favicon !== faviconUrl) {
                    bookmark.favicon = faviconUrl;
                    this.saveBookmarks();
                }
            }
        } else {
            tab.favicon = null;
        }

        // Update tab favicon
        const tabFavicon = this.tabsContainer.querySelector(`[data-tab-id="${tabId}"] .tab-favicon`);
        if (tabFavicon) {
            if (faviconUrl) {
                tabFavicon.src = faviconUrl;
                tabFavicon.style.display = 'inline-block';
                tabFavicon.onerror = () => {
                    // Show globe icon on error
                    tabFavicon.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiIvPjxwYXRoIGQ9Ik0xMiAyYTUuNSA3LjUgMCAwIDEgMCAyMCA1LjUgNy41IDAgMCAxIDAtMjAiLz48L3N2Zz4=';
                };
            } else {
                // No favicon URL, show globe icon
                tabFavicon.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiIvPjxwYXRoIGQ9Ik0xMiAyYTUuNSA3LjUgMCAwIDEgMCAyMCA1LjUgNy41IDAgMCAxIDAtMjAiLz48L3N2Zz4=';
                tabFavicon.style.display = 'inline-block';
            }
        }

        // Update address bar favicon if this is the active tab
        if (this.activeTabId === tabId) {
            this.updateAddressBarFavicon(faviconUrl);
        }
    }
    
    updateAddressBarFavicon(faviconUrl) {
        const favicon = document.getElementById('address-bar-favicon');
        if (!favicon) return; // Favicon element should exist in HTML

        if (faviconUrl) {
            favicon.src = faviconUrl;
            favicon.style.display = 'inline-block';
            favicon.style.cursor = 'grab';
            favicon.onerror = () => {
                // Show globe icon on error
                favicon.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiIvPjxwYXRoIGQ9Ik0xMiAyYTUuNSA3LjUgMCAwIDEgMCAyMCA1LjUgNy41IDAgMCAxIDAtMjAiLz48L3N2Zz4=';
            };
        } else {
            // No favicon URL, show globe icon
            favicon.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiIvPjxwYXRoIGQ9Ik0xMiAyYTUuNSA3LjUgMCAwIDEgMCAyMCA1LjUgNy41IDAgMCAxIDAtMjAiLz48L3N2Zz4=';
            favicon.style.display = 'inline-block';
            favicon.style.cursor = 'grab';
        }
    }
    
    getTitleFromURL(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname || url;
        } catch {
            return url || 'New Tab';
        }
    }
    
    getCurrentTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }
    
    getCurrentContent() {
        return this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
    }
    
    isURL(str) {
        if (/^https?:\/\//i.test(str)) {
            return true;
        }

        // Check for file URLs
        if (/^file:\/\//i.test(str)) {
            return true;
        }

        // Check for data URLs
        if (/^data:/i.test(str)) {
            return true;
        }

        // Check for external protocol schemes
        if (/^(spotify|mailto|tel|sms|facetime|zoom|slack|discord|steam|vscode|notion|obsidian):/i.test(str)) {
            return true;
        }

        const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
        if (domainPattern.test(str)) {
            return true;
        }

        if (/^localhost(:\d+)?(\/.*)?$/i.test(str)) {
            return true;
        }

        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
        if (ipPattern.test(str)) {
            return true;
        }

        return false;
    }
    
    formatURL(str) {
        str = str.trim();

        if (/^https?:\/\//i.test(str)) {
            return str;
        }

        // Check for file URLs - return as-is
        if (/^file:\/\//i.test(str)) {
            return str;
        }

        // Check for data URLs - return as-is
        if (/^data:/i.test(str)) {
            return str;
        }

        // Check for external protocol schemes - return as-is
        if (/^(spotify|mailto|tel|sms|facetime|zoom|slack|discord|steam|vscode|notion|obsidian):/i.test(str)) {
            return str;
        }

        // For sites that might redirect, try HTTP first if no protocol specified
        // This allows the server to handle its own redirect to HTTPS/www subdomain
        if (str.includes('birkenstock.com') || str.includes('nike.com')) {
            return 'http://' + str;
        }

        // Default to HTTPS for most sites
        return 'https://' + str;
    }
    
    async navigate(fromHistory = false) {
        const tab = this.getCurrentTab();
        if (!tab) {
            console.error('No current tab found');
            return;
        }

        const input = this.addressBar.value.trim();
        if (!input) {
            return;
        }

        // Add to history only if not navigating from history
        if (!fromHistory) {
            if (tab.historyIndex === -1 || tab.history[tab.historyIndex] !== input) {
                tab.history = tab.history.slice(0, tab.historyIndex + 1);
                tab.history.push(input);
                tab.historyIndex = tab.history.length - 1;
            }
        }

        this.updateNavigationButtons();

        // Check for commands starting with '/'
        if (input.startsWith('/')) {
            const command = input.substring(1).toLowerCase().trim();

            if (command === 'summary' || command.startsWith('summary ')) {
                // Summarize current page
                await this.handleSummaryCommand();
                return;
            } else if (command === 'simplify' || command.startsWith('simplify ')) {
                // Simplify current page content
                await this.handleSimplifyCommand();
                return;
            } else if (command === 'help') {
                // Show help dropdown - show all commands
                this.showCommandHelper('/');
                return;
            } else if (command.startsWith('extract ')) {
                // Extract media from current page
                const mediaType = command.substring(8).trim();
                await this.handleExtractCommand(mediaType);
                return;
            } else if (command === 'tldr' || command.startsWith('tldr ')) {
                // TLDR (concise 2-3 sentence summary)
                await this.handleTldrCommand();
                return;
            } else if (command === 'calendar' || command.startsWith('calendar ')) {
                // Create Google Calendar event
                const args = command === 'calendar' ? '' : command.substring(9).trim();
                this.handleCalendarCommand(args);
                return;
            } else if (command === 'watch' || command.startsWith('watch ')) {
                // Watch page for changes
                await this.handleWatchCommand();
                return;
            } else if (command === 'zoom' || command.startsWith('zoom ')) {
                // Schedule Zoom meeting
                const args = command === 'zoom' ? '' : command.substring(5).trim();
                this.handleZoomCommand(args);
                return;
            } else if (command === 'meet' || command.startsWith('meet ')) {
                // Create Google Meet
                const args = command === 'meet' ? '' : command.substring(5).trim();
                await this.handleMeetCommand(args);
                return;
            } else if (command.startsWith('spotify ')) {
                // Search Spotify
                const query = command.substring(8).trim();
                await this.handleSpotifyCommand(query);
                return;
            } else if (command === 'weather' || command.startsWith('weather ')) {
                // Get weather for location
                const location = command === 'weather' ? '' : command.substring(8).trim();
                await this.handleWeatherCommand(location);
                return;
            } else if (command === 'volume up' || command === 'volume down') {
                // Control system volume
                const direction = command === 'volume up' ? 'up' : 'down';
                await this.handleVolumeCommand(direction);
                return;
            } else if (command === 'score' || command.startsWith('score ')) {
                // Look up sports score
                const searchTerm = command === 'score' ? '' : command.substring(6).trim();
                await this.handleScoreCommand(searchTerm);
                return;
            } else if (command === 'stock' || command.startsWith('stock ')) {
                // Get stock price
                const symbol = command === 'stock' ? '' : command.substring(6).trim();
                await this.handleStockCommand(symbol);
                return;
            } else if (command === 'print') {
                // Print the current page
                this.printPage();
                return;
            } else {
                // Unknown command - show error
                this.showNotification(`Unknown command: ${input}. Type /help for available commands.`, 'error');
                return;
            }
        }

        if (this.isURL(input)) {
            // It's a URL - show webview
            this.showWebView(this.activeTabId);
            const url = this.formatURL(input);

            // Check for external protocol schemes (spotify, mailto, etc.)
            if (url.match(/^(spotify|mailto|tel|sms|facetime|zoom|slack|discord|steam|vscode|notion|obsidian):/i)) {
                // Open in external application
                window.electronAPI.openExternal(url);
                this.showNotification(`Opening in external app: ${url.split(':')[0]}`, 'info');
                return;
            }

            // Check if it's the Anthropic Console URL
            if (url.includes('console.anthropic.com')) {
                // Show a helpful message instead of trying to load it
                this.showAnthropicConsoleMessage(this.activeTabId, url);
                return;
            }

            const webview = this.getOrCreateWebview(this.activeTabId);
            if (webview) {
                // Store the URL we're trying to load
                tab.attemptedURL = url;

                // Mark this as a user-initiated navigation from the address bar
                tab.userInitiatedNavigation = true;

                // Just set src directly for simplicity
                webview.src = url;
                this.addressBar.value = url;
                tab.url = url;
            } else {
                console.error('Failed to get or create webview');
            }
        } else {
            // It's a search query - use Claude API
            await this.searchWithClaude(input);
        }
    }

    async handleSummaryCommand() {
        const tab = this.getCurrentTab();
        if (!tab || tab.mode !== 'web') {
            alert('Summary command only works on web pages. Navigate to a page first.');
            return;
        }

        // Trigger the existing summary functionality
        await this.summarizeCurrentPage();
    }

    async handleSimplifyCommand() {
        const tab = this.getCurrentTab();
        if (!tab || tab.mode !== 'web') {
            alert('Simplify command only works on web pages. Navigate to a page first.');
            return;
        }

        const webviewContent = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!webviewContent) return;

        const webview = webviewContent.querySelector('.tab-webview');
        if (!webview) return;

        // Extract page content
        const pageText = await webview.executeJavaScript(`
            (function() {
                const getText = (node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        return node.textContent.trim();
                    }
                    if (node.nodeType !== Node.ELEMENT_NODE) return '';
                    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'NOSCRIPT') return '';
                    return Array.from(node.childNodes).map(getText).join(' ');
                };
                return getText(document.body).replace(/\\s+/g, ' ').trim();
            })()
        `);

        // Get selected model
        const modelSelect = document.getElementById('model-select');
        const model = modelSelect.value;

        // Show results in new tab
        const newTabId = this.createTab();
        this.showClaudeResults(newTabId);

        const content = this.tabsContent.querySelector(`[data-tab-id="${newTabId}"]`);
        if (!content) return;

        const claudeResults = content.querySelector('.tab-claude-results');
        if (!claudeResults) return;

        // Show loading state
        claudeResults.innerHTML = '<div class="loading">Creating simplified summary...</div>';
        this.updateTabTitle(newTabId, '🔄 Simplifying...');

        // Remove any existing listeners
        window.electronAPI.removeSummaryStreamListeners();

        // Set up container for streamed content
        let streamedContent = '';

        // Set up streaming listeners
        window.electronAPI.onSummaryStreamChunk((data) => {
            streamedContent += data.text;
            claudeResults.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(streamedContent));
        });

        window.electronAPI.onSummaryStreamEnd((data) => {
            claudeResults.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(data.fullContent));
            this.updateTabTitle(newTabId, '📝 Simplified Summary');
            window.electronAPI.removeSummaryStreamListeners();
        });

        window.electronAPI.onSummaryStreamError((data) => {
            claudeResults.innerHTML = DOMPurify.sanitize(`
                <div class="error">
                    <h3>Error generating simplified summary</h3>
                    <p>${data.error}</p>
                </div>
            `);
            this.updateTabTitle(newTabId, '❌ Error');
            window.electronAPI.removeSummaryStreamListeners();
        });

        // Stream the simplified summary (ELI5 style)
        const prompt = `Please provide a simplified summary of the following webpage, explaining it like I'm 5 years old (ELI5). Use simple words, short sentences, and relatable examples. Break down complex ideas into easy-to-understand concepts:\n\n${pageText.substring(0, 50000)}`;

        await window.electronAPI.summarizePageStream(prompt, model);
    }

    async handleTldrCommand() {
        const tab = this.getCurrentTab();
        if (!tab || tab.mode !== 'web') {
            alert('TLDR command only works on web pages. Navigate to a page first.');
            return;
        }

        const webviewContent = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!webviewContent) return;

        const webview = webviewContent.querySelector('.tab-webview');
        if (!webview) return;

        // Extract page content
        const pageText = await webview.executeJavaScript(`
            (function() {
                const getText = (node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        return node.textContent.trim();
                    }
                    if (node.nodeType !== Node.ELEMENT_NODE) return '';
                    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'NOSCRIPT') return '';
                    return Array.from(node.childNodes).map(getText).join(' ');
                };
                return getText(document.body).replace(/\\s+/g, ' ').trim();
            })()
        `);

        // Get selected model
        const modelSelect = document.getElementById('model-select');
        const model = modelSelect.value;

        // Show results in new tab
        const newTabId = this.createTab();
        this.showClaudeResults(newTabId);

        const content = this.tabsContent.querySelector(`[data-tab-id="${newTabId}"]`);
        if (!content) return;

        const claudeResults = content.querySelector('.tab-claude-results');
        if (!claudeResults) return;

        // Show loading state
        claudeResults.innerHTML = '<div class="loading">Creating TLDR summary...</div>';
        this.updateTabTitle(newTabId, '🔄 Creating TLDR...');

        // Remove any existing listeners
        window.electronAPI.removeSummaryStreamListeners();

        // Set up container for streamed content
        let streamedContent = '';

        // Set up streaming listeners
        window.electronAPI.onSummaryStreamChunk((data) => {
            streamedContent += data.text;
            claudeResults.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(streamedContent));
        });

        window.electronAPI.onSummaryStreamEnd((data) => {
            claudeResults.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(data.fullContent));
            this.updateTabTitle(newTabId, '📄 TLDR');
            window.electronAPI.removeSummaryStreamListeners();
        });

        window.electronAPI.onSummaryStreamError((data) => {
            claudeResults.innerHTML = DOMPurify.sanitize(`
                <div class="error">
                    <h3>Error generating TLDR</h3>
                    <p>${data.error}</p>
                </div>
            `);
            this.updateTabTitle(newTabId, '❌ Error');
            window.electronAPI.removeSummaryStreamListeners();
        });

        // Stream the TLDR summary with strict 2-3 sentence limit
        const prompt = `Please provide a TLDR (Too Long; Didn't Read) summary of the following webpage. Your summary MUST be exactly 2-3 sentences maximum. Focus only on the most critical information:\n\n${pageText.substring(0, 50000)}`;

        await window.electronAPI.summarizePageStream(prompt, model);
    }

    handleCalendarCommand(args) {
        // Parse: "Meeting Title | email1@example.com, email2@example.com | 2pm"
        // Or: "Meeting Title | guests"
        // Or just: "Meeting Title"
        if (!args) {
            alert('Usage: /calendar Meeting Title | guests@example.com | time (e.g., 2pm, tomorrow 3pm)');
            return;
        }

        const parts = args.split('|').map(p => p.trim());
        const title = parts[0] || 'New Meeting';
        const guests = parts[1] || '';
        const timeStr = parts[2] || '';

        // Build Google Calendar URL with pre-filled data using the new format
        const baseUrl = 'https://calendar.google.com/calendar/u/0/r/eventedit';

        // Build URL manually to ensure proper encoding
        let calendarUrl = `${baseUrl}?text=${encodeURIComponent(title)}`;

        // Parse time if provided, otherwise use default (1 hour from now)
        const dates = timeStr ? this.parseEventTime(timeStr) : this.getDefaultEventDates();
        calendarUrl += `&dates=${dates}`;

        if (guests) {
            // Google Calendar expects guests as comma-separated in a single 'add' parameter
            calendarUrl += `&add=${encodeURIComponent(guests)}`;
        }

        // Navigate to the calendar URL in a new tab
        this.createTab();
        this.showWebView(this.activeTabId);
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (webview) {
            webview.src = calendarUrl;
            this.addressBar.value = calendarUrl;

            const tab = this.getCurrentTab();
            if (tab) {
                tab.url = calendarUrl;
                tab.title = `Create Calendar Event: ${title}`;
            }
        }
    }

    parseEventTime(timeStr) {
        // Parse natural language time strings like "2pm", "tomorrow 3pm", "next monday 10am"
        const now = new Date();
        let start = new Date();

        // Normalize the input
        const input = timeStr.toLowerCase().trim();

        // Check for "tomorrow"
        if (input.includes('tomorrow')) {
            start.setDate(start.getDate() + 1);
        }

        // Check for "next week" or day names
        const dayMatch = input.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
        if (dayMatch) {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDay = days.indexOf(dayMatch[0].toLowerCase());
            const currentDay = start.getDay();
            let daysToAdd = targetDay - currentDay;
            if (daysToAdd <= 0) daysToAdd += 7; // Next week
            start.setDate(start.getDate() + daysToAdd);
        }

        // Parse time (supports formats: 2pm, 14:00, 2:30pm)
        const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

            // Convert to 24-hour format
            if (meridiem === 'pm' && hours !== 12) {
                hours += 12;
            } else if (meridiem === 'am' && hours === 12) {
                hours = 0;
            }

            start.setHours(hours, minutes, 0, 0);
        } else {
            // No time specified, default to next hour
            start.setHours(start.getHours() + 1);
            start.setMinutes(0, 0, 0);
        }

        // End time is 1 hour after start
        const end = new Date(start);
        end.setHours(end.getHours() + 1);

        // Format: YYYYMMDDTHHmmssZ
        const formatDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        return `${formatDate(start)}/${formatDate(end)}`;
    }

    getDefaultEventDates() {
        // Create event starting 1 hour from now, duration 1 hour
        const start = new Date();
        start.setHours(start.getHours() + 1);
        start.setMinutes(0, 0, 0); // Round to the hour

        const end = new Date(start);
        end.setHours(end.getHours() + 1);

        // Format: YYYYMMDDTHHmmssZ
        const formatDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        return `${formatDate(start)}/${formatDate(end)}`;
    }

    async handleZoomCommand(args) {
        // Parse: "Meeting Topic | email1@example.com, email2@example.com"
        if (!args) {
            alert('Usage: /zoom <topic> | <emails>');
            return;
        }

        const parts = args.split('|').map(p => p.trim());
        const topic = parts[0] || 'New Zoom Meeting';
        const emails = parts[1] || '';

        // Schedule meeting - open schedule page
        const zoomScheduleUrl = 'https://zoom.us/meeting/schedule';

        this.showWebView(this.activeTabId);
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;

        webview.src = zoomScheduleUrl;
        this.addressBar.value = zoomScheduleUrl;

        const tab = this.getCurrentTab();
        if (tab) {
            tab.url = zoomScheduleUrl;
            tab.title = `Schedule Zoom: ${topic}`;
        }

        // Wait for page to load, then inject the meeting details
        const handleLoad = async () => {
            try {
                // Wait a bit for page to fully render
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Try to fill in the meeting topic and set to start now
                await webview.executeJavaScript(`
                    (function() {
                        try {
                            // Find the topic input field
                            const topicInput = document.querySelector('input[placeholder*="Topic" i], input[name*="topic" i], input[id*="topic" i]');
                            if (topicInput) {
                                topicInput.value = ${JSON.stringify(topic)};
                                topicInput.dispatchEvent(new Event('input', { bubbles: true }));
                                topicInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            // Set meeting to start now
                            const now = new Date();
                            const dateInput = document.querySelector('input[type="date"], input[name*="date" i]');
                            if (dateInput) {
                                const dateStr = now.toISOString().split('T')[0];
                                dateInput.value = dateStr;
                                dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                                dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            const timeInput = document.querySelector('input[type="time"], input[name*="time" i]');
                            if (timeInput) {
                                const hours = String(now.getHours()).padStart(2, '0');
                                const minutes = String(now.getMinutes()).padStart(2, '0');
                                const timeStr = hours + ':' + minutes;
                                timeInput.value = timeStr;
                                timeInput.dispatchEvent(new Event('input', { bubbles: true }));
                                timeInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            ${emails ? `
                            // Find invitee/email field
                            const inviteInput = document.querySelector('input[placeholder*="invite" i], input[placeholder*="email" i], input[name*="invite" i]');
                            if (inviteInput) {
                                inviteInput.value = ${JSON.stringify(emails)};
                                inviteInput.dispatchEvent(new Event('input', { bubbles: true }));
                                inviteInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            ` : ''}

                            return 'Fields populated';
                        } catch (e) {
                            return 'Error: ' + e.message;
                        }
                    })()
                `);
            } catch (error) {
                console.error('Error filling Zoom form:', error);
            }
        };

        // Listen for page load
        webview.addEventListener('did-finish-load', handleLoad, { once: true });
    }

    async handleMeetCommand(args) {
        // Google Meet can be created instantly via https://meet.google.com/new
        // We can then share the link via email

        const emails = args.trim();

        // Create new Google Meet
        const meetUrl = 'https://meet.google.com/new';

        this.showWebView(this.activeTabId);
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;

        webview.src = meetUrl;
        this.addressBar.value = meetUrl;

        const tab = this.getCurrentTab();
        if (tab) {
            tab.url = meetUrl;
            tab.title = 'Creating Google Meet';
        }

        // Wait for the meeting to be created and extract the meeting link
        const handleLoad = async () => {
            try {
                // Wait for Google Meet to create the room
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Get the meeting URL from the page
                const meetingUrl = await webview.executeJavaScript(`
                    (function() {
                        try {
                            // The meeting URL is usually in the address bar or a share button
                            return window.location.href;
                        } catch (e) {
                            return null;
                        }
                    })()
                `);

                if (meetingUrl && meetingUrl.includes('meet.google.com') && emails) {
                    // Open Gmail compose window with pre-filled invite
                    const emailSubject = encodeURIComponent('Join Google Meet');
                    const emailBody = encodeURIComponent(
                        `You're invited to a Google Meet.\n\n` +
                        `Join the meeting:\n${meetingUrl}\n\n` +
                        `Click the link above to join the video call.`
                    );

                    // Use Gmail compose URL instead of mailto
                    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emails)}&su=${emailSubject}&body=${emailBody}`;

                    // Open Gmail compose in a new tab
                    setTimeout(() => {
                        const newTabId = this.createTab();
                        this.showWebView(newTabId);
                        const newWebview = this.getOrCreateWebview(newTabId);
                        if (newWebview) {
                            newWebview.src = gmailComposeUrl;
                            this.addressBar.value = gmailComposeUrl;
                            const newTab = this.tabs.find(t => t.id === newTabId);
                            if (newTab) {
                                newTab.url = gmailComposeUrl;
                                newTab.title = 'Send Meet Invite';
                            }
                        }
                    }, 500);
                } else if (emails) {
                    // Fallback if we couldn't get the URL
                    alert(`Google Meet created. Copy the URL from the address bar and share it with: ${emails}`);
                }
            } catch (error) {
                console.error('Error creating Google Meet:', error);
            }
        };

        // Listen for page load
        webview.addEventListener('did-finish-load', handleLoad, { once: true });
    }

    async handleSpotifyCommand(query) {
        if (!query) {
            // Try to open Spotify app search, fallback to web
            try {
                await window.electronAPI.openExternal('spotify:search');
                this.showNotification('Opening Spotify app...', 'info');
            } catch (error) {
                // Fallback to web player
                const spotifyUrl = 'https://open.spotify.com/search';
                this.showWebView(this.activeTabId);
                const webview = this.getOrCreateWebview(this.activeTabId);
                if (!webview) return;

                webview.src = spotifyUrl;
                this.addressBar.value = spotifyUrl;

                const tab = this.getCurrentTab();
                if (tab) {
                    tab.url = spotifyUrl;
                    tab.title = 'Spotify Search';
                }
            }
            return;
        }

        // Try to open in native Spotify app first using spotify:search URI
        const spotifyUri = `spotify:search:${encodeURIComponent(query)}`;
        try {
            await window.electronAPI.openExternal(spotifyUri);
            this.showNotification(`Opening "${query}" in Spotify app...`, 'info');
        } catch (error) {
            // Fallback to web player if native app not available
            const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;

            this.showWebView(this.activeTabId);
            const webview = this.getOrCreateWebview(this.activeTabId);
            if (!webview) return;

            webview.src = searchUrl;
            this.addressBar.value = searchUrl;

            const tab = this.getCurrentTab();
            if (tab) {
                tab.url = searchUrl;
                tab.title = `Spotify: ${query}`;
            }

            this.showNotification(`Searching Spotify for "${query}"`, 'info');
        }
    }

    async handleWeatherCommand(location) {
        // Use Google Weather search for specific locations, Yahoo Weather for auto-detect
        const weatherUrl = location
            ? `https://www.google.com/search?q=weather+${encodeURIComponent(location)}`
            : `https://weather.yahoo.com/`;

        this.showWebView(this.activeTabId);
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;

        webview.src = weatherUrl;
        this.addressBar.value = weatherUrl;

        const tab = this.getCurrentTab();
        if (tab) {
            tab.url = weatherUrl;
            tab.title = location ? `Weather: ${location}` : 'Weather';
        }

        this.showNotification(location ? `Getting weather for ${location}` : 'Getting weather for your location', 'info');
    }

    async handleVolumeCommand(direction) {
        try {
            const result = await window.electronAPI.controlVolume(direction);
            if (result.success) {
                this.showNotification(`Volume ${direction}`, 'info');
            } else {
                this.showNotification(`Failed to control volume: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Error controlling volume: ${error.message}`, 'error');
        }
    }

    async handleScoreCommand(searchTerm) {
        // Use Google search for sports scores
        const scoreUrl = searchTerm
            ? `https://www.google.com/search?q=${encodeURIComponent(searchTerm + ' score')}`
            : `https://www.google.com/search?q=sports+scores`;

        this.showWebView(this.activeTabId);
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;

        webview.src = scoreUrl;
        this.addressBar.value = scoreUrl;

        const tab = this.getCurrentTab();
        if (tab) {
            tab.url = scoreUrl;
            tab.title = searchTerm ? `Score: ${searchTerm}` : 'Sports Scores';
        }

        this.showNotification(searchTerm ? `Looking up score for ${searchTerm}` : 'Showing sports scores', 'info');
    }

    async handleStockCommand(symbol) {
        if (!symbol) {
            this.showNotification('Please provide a stock symbol. Example: /stock AAPL', 'error');
            return;
        }

        // Normalize symbol to uppercase
        symbol = symbol.toUpperCase().trim();

        // Navigate to Yahoo Finance for the stock
        const stockUrl = `https://finance.yahoo.com/quote/${symbol}`;

        this.showWebView(this.activeTabId);
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;

        webview.src = stockUrl;
        this.addressBar.value = stockUrl;

        const tab = this.getCurrentTab();
        if (tab) {
            tab.url = stockUrl;
            tab.title = `Stock: ${symbol}`;
        }

        this.showNotification(`Loading stock information for ${symbol}`, 'info');
    }

    async handleWatchCommand() {
        const tab = this.getCurrentTab();
        if (!tab || tab.mode !== 'web') {
            alert('Watch command only works on web pages. Navigate to a page first.');
            return;
        }

        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) return;

        const webview = content.querySelector('.tab-webview');
        if (!webview) return;

        // Check if already watching this page
        if (tab.isWatching) {
            // Stop watching
            if (tab.watchInterval) {
                clearInterval(tab.watchInterval);
                tab.watchInterval = null;
            }
            tab.isWatching = false;
            tab.lastPageContent = null;
            alert('Stopped watching page for changes');
            return;
        }

        // Request notification permission
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('Notification permission denied. Cannot watch page.');
                return;
            }
        }

        if (Notification.permission !== 'granted') {
            alert('Notification permission required to watch page for changes.');
            return;
        }

        // Get initial page content
        try {
            const initialContent = await webview.executeJavaScript(`
                (function() {
                    return document.body.innerText;
                })()
            `);

            tab.lastPageContent = initialContent;
            tab.isWatching = true;

            // Check for changes every 30 seconds
            tab.watchInterval = setInterval(async () => {
                try {
                    const currentContent = await webview.executeJavaScript(`
                        (function() {
                            return document.body.innerText;
                        })()
                    `);

                    // Compare content
                    if (currentContent !== tab.lastPageContent) {
                        // Find what changed
                        const oldLines = tab.lastPageContent.split('\n').filter(l => l.trim());
                        const newLines = currentContent.split('\n').filter(l => l.trim());

                        // Find new content (lines that appear in new but not in old)
                        const addedLines = newLines.filter(line => !oldLines.includes(line));
                        const removedLines = oldLines.filter(line => !newLines.includes(line));

                        let changeDescription = '';
                        if (addedLines.length > 0) {
                            const preview = addedLines.slice(0, 3).join(' ').substring(0, 100);
                            changeDescription = `Added: ${preview}${addedLines.length > 3 ? '...' : ''}`;
                        } else if (removedLines.length > 0) {
                            const preview = removedLines.slice(0, 3).join(' ').substring(0, 100);
                            changeDescription = `Removed: ${preview}${removedLines.length > 3 ? '...' : ''}`;
                        } else {
                            changeDescription = 'Content modified';
                        }

                        // Page changed! Send notification with details
                        new Notification('Page Changed', {
                            body: `${tab.title || tab.url}\n${changeDescription}`,
                            icon: tab.favicon || ''
                        });

                        // Update stored content
                        tab.lastPageContent = currentContent;
                    }
                } catch (error) {
                    console.error('Error checking page for changes:', error);
                }
            }, 30000); // Check every 30 seconds

            alert('Now watching page for changes. Desktop notifications will be sent when content updates. Run /watch again to stop.');
        } catch (error) {
            console.error('Error starting page watch:', error);
            alert('Failed to start watching page: ' + error.message);
        }
    }

    async handleExtractCommand(mediaType) {
        const tab = this.getCurrentTab();
        if (!tab || tab.mode !== 'web') {
            alert('Extract command only works on web pages. Navigate to a page first.');
            return;
        }

        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) return;

        const webview = content.querySelector('.tab-webview');
        if (!webview) return;

        // Show extraction overlay
        const extractOverlay = document.getElementById('extract-overlay');
        const extractBody = extractOverlay.querySelector('.extract-body');
        extractBody.innerHTML = `<div class="loading">Extracting ${mediaType} files from page...</div>`;
        extractOverlay.classList.remove('hidden');

        try {
            // Extract media URLs from the page
            const mediaData = await webview.executeJavaScript(`
                (function() {
                    const mediaType = '${mediaType}'.toLowerCase();
                    const results = [];

                    // Define media type mappings
                    const mediaTypes = {
                        'jpg': ['jpg', 'jpeg'],
                        'jpeg': ['jpg', 'jpeg'],
                        'png': ['png'],
                        'gif': ['gif'],
                        'webp': ['webp'],
                        'svg': ['svg'],
                        'mp4': ['mp4'],
                        'webm': ['webm'],
                        'mov': ['mov'],
                        'avi': ['avi'],
                        'mp3': ['mp3'],
                        'wav': ['wav'],
                        'ogg': ['ogg'],
                        'm4a': ['m4a'],
                        'pdf': ['pdf']
                    };

                    const extensions = mediaTypes[mediaType] || [mediaType];

                    // Helper to check if URL matches media type
                    const matchesType = (url) => {
                        if (!url) return false;
                        const lowerUrl = url.toLowerCase();
                        return extensions.some(ext => {
                            return lowerUrl.includes('.' + ext) ||
                                   lowerUrl.match(new RegExp('\\\\.' + ext + '[?#]', 'i'));
                        });
                    };

                    // Extract images
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(mediaType)) {
                        document.querySelectorAll('img').forEach(img => {
                            if (img.src && matchesType(img.src)) {
                                results.push({
                                    type: 'image',
                                    url: img.src,
                                    alt: img.alt || 'Image',
                                    width: img.naturalWidth,
                                    height: img.naturalHeight
                                });
                            }
                        });

                        // Check background images
                        document.querySelectorAll('*').forEach(el => {
                            const bg = window.getComputedStyle(el).backgroundImage;
                            if (bg && bg !== 'none') {
                                const matches = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
                                if (matches && matches[1] && matchesType(matches[1])) {
                                    results.push({
                                        type: 'image',
                                        url: matches[1],
                                        alt: 'Background image',
                                        width: 0,
                                        height: 0
                                    });
                                }
                            }
                        });
                    }

                    // Extract videos
                    if (['mp4', 'webm', 'mov', 'avi'].includes(mediaType)) {
                        document.querySelectorAll('video').forEach(video => {
                            if (video.src && matchesType(video.src)) {
                                results.push({
                                    type: 'video',
                                    url: video.src,
                                    alt: video.title || 'Video',
                                    duration: video.duration || 0
                                });
                            }
                            video.querySelectorAll('source').forEach(source => {
                                if (source.src && matchesType(source.src)) {
                                    results.push({
                                        type: 'video',
                                        url: source.src,
                                        alt: video.title || 'Video',
                                        duration: video.duration || 0
                                    });
                                }
                            });
                        });
                    }

                    // Extract audio
                    if (['mp3', 'wav', 'ogg', 'm4a'].includes(mediaType)) {
                        document.querySelectorAll('audio').forEach(audio => {
                            if (audio.src && matchesType(audio.src)) {
                                results.push({
                                    type: 'audio',
                                    url: audio.src,
                                    alt: audio.title || 'Audio',
                                    duration: audio.duration || 0
                                });
                            }
                            audio.querySelectorAll('source').forEach(source => {
                                if (source.src && matchesType(source.src)) {
                                    results.push({
                                        type: 'audio',
                                        url: source.src,
                                        alt: audio.title || 'Audio',
                                        duration: audio.duration || 0
                                    });
                                }
                            });
                        });
                    }

                    // Extract links to media files
                    document.querySelectorAll('a[href]').forEach(link => {
                        if (matchesType(link.href)) {
                            const linkMediaType = (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(mediaType)) ? 'image' :
                                                 (['mp4', 'webm', 'mov', 'avi'].includes(mediaType)) ? 'video' :
                                                 (['mp3', 'wav', 'ogg', 'm4a'].includes(mediaType)) ? 'audio' : 'file';
                            results.push({
                                type: linkMediaType,
                                url: link.href,
                                alt: link.textContent.trim() || link.title || 'Link',
                                width: 0,
                                height: 0
                            });
                        }
                    });

                    // Remove duplicates
                    const seen = new Set();
                    return results.filter(item => {
                        if (seen.has(item.url)) return false;
                        seen.add(item.url);
                        return true;
                    });
                })();
            `);

            if (!mediaData || mediaData.length === 0) {
                extractBody.innerHTML = `<p>No ${mediaType} files found on this page.</p>`;
                return;
            }

            // Display extracted media
            let html = `<h3>Found ${mediaData.length} ${mediaType} file(s)</h3><div class="media-grid">`;

            mediaData.forEach((item, index) => {
                const filename = item.url.split('/').pop().split('?')[0] || `${mediaType}_${index + 1}`;

                if (item.type === 'image') {
                    html += `
                        <div class="media-item">
                            <img src="${item.url}" alt="${item.alt}" loading="lazy" />
                            <div class="media-info">
                                <div class="media-filename">${filename}</div>
                                ${item.width && item.height ? `<div class="media-meta">${item.width}x${item.height}</div>` : ''}
                                <a href="${item.url}" download="${filename}" class="download-btn">Download</a>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'video') {
                    html += `
                        <div class="media-item">
                            <video src="${item.url}" controls></video>
                            <div class="media-info">
                                <div class="media-filename">${filename}</div>
                                ${item.duration ? `<div class="media-meta">${Math.round(item.duration)}s</div>` : ''}
                                <a href="${item.url}" download="${filename}" class="download-btn">Download</a>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'audio') {
                    html += `
                        <div class="media-item">
                            <audio src="${item.url}" controls></audio>
                            <div class="media-info">
                                <div class="media-filename">${filename}</div>
                                ${item.duration ? `<div class="media-meta">${Math.round(item.duration)}s</div>` : ''}
                                <a href="${item.url}" download="${filename}" class="download-btn">Download</a>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="media-item">
                            <div class="file-icon">📄</div>
                            <div class="media-info">
                                <div class="media-filename">${filename}</div>
                                <a href="${item.url}" download="${filename}" class="download-btn">Download</a>
                            </div>
                        </div>
                    `;
                }
            });

            html += '</div>';
            extractBody.innerHTML = html;

        } catch (error) {
            extractBody.innerHTML = `
                <div class="error">
                    <h3>Error extracting media</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }


    showCommandHelper(query) {
        const commandMap = {
            '/summary': { syntax: '/summary', args: '', desc: 'Summarize the current page', example: '/summary' },
            '/simplify': { syntax: '/simplify', args: '', desc: 'Explain the page content in simple terms', example: '/simplify' },
            '/tldr': { syntax: '/tldr', args: '', desc: 'Get a 2-3 sentence summary of the page', example: '/tldr' },
            '/calendar': {
                syntax: '/calendar <title> | <emails> | <time>',
                args: '<title> | <email1@example.com> | <2pm, tomorrow 3pm>',
                desc: 'Create Google Calendar event with invitees and time',
                example: '/calendar Team Meeting | alice@co.com | tomorrow 2pm'
            },
            '/extract': {
                syntax: '/extract <type>',
                args: '<jpg|png|mp4|mp3|pdf>',
                desc: 'Extract media files from page',
                example: '/extract jpg'
            },
            '/watch': { syntax: '/watch', args: '', desc: 'Monitor page for changes and notify', example: '/watch' },
            '/zoom': {
                syntax: '/zoom <topic> | <emails>',
                args: '<topic> | <email1@example.com, email2@example.com>',
                desc: 'Schedule Zoom meeting with invitees',
                example: '/zoom Team Standup | alice@co.com, bob@co.com'
            },
            '/meet': {
                syntax: '/meet <emails>',
                args: '<email1@example.com, email2@example.com>',
                desc: 'Create instant Google Meet and invite',
                example: '/meet alice@co.com, bob@co.com'
            },
            '/spotify': {
                syntax: '/spotify <artist song>',
                args: '<search query>',
                desc: 'Search Spotify for music',
                example: '/spotify Taylor Swift Shake It Off'
            },
            '/weather': {
                syntax: '/weather [city]',
                args: '[optional city name]',
                desc: 'Get weather for your location or specified city',
                example: '/weather Tokyo'
            },
            '/volume': {
                syntax: '/volume up|down',
                args: 'up or down',
                desc: 'Control system volume',
                example: '/volume up'
            },
            '/score': {
                syntax: '/score [team/game]',
                args: '[optional team or game]',
                desc: 'Look up sports scores',
                example: '/score Lakers'
            },
            '/stock': {
                syntax: '/stock <symbol>',
                args: '<stock symbol>',
                desc: 'Get current stock price and key information',
                example: '/stock AAPL'
            },
            '/print': { syntax: '/print', args: '', desc: 'Print the current page', example: '/print' },
            '/help': { syntax: '/help', args: '', desc: 'Show this help menu', example: '/help' }
        };

        const command = query.toLowerCase().split(' ')[0];
        const matchingCommands = [];

        // If query is just '/', show all commands
        if (query === '/') {
            for (const [cmd, info] of Object.entries(commandMap)) {
                matchingCommands.push({ cmd, ...info });
            }
        } else {
            // Find exact command match first
            let exactMatch = null;
            for (const [cmd, info] of Object.entries(commandMap)) {
                if (query.toLowerCase().startsWith(cmd + ' ') || query.toLowerCase() === cmd) {
                    exactMatch = { cmd, ...info };
                    break;
                }
            }

            // If exact match found and user is typing arguments, show only that command
            if (exactMatch) {
                matchingCommands.push(exactMatch);
            } else {
                // Otherwise, find commands that match the prefix
                for (const [cmd, info] of Object.entries(commandMap)) {
                    if (cmd.startsWith(query.toLowerCase())) {
                        matchingCommands.push({ cmd, ...info });
                    }
                }
            }

            // If no matches, show all commands
            if (matchingCommands.length === 0) {
                for (const [cmd, info] of Object.entries(commandMap)) {
                    matchingCommands.push({ cmd, ...info });
                }
            }
        }

        // Sort commands alphabetically
        matchingCommands.sort((a, b) => a.cmd.localeCompare(b.cmd));

        // Build dropdown HTML with prominent argument display
        const helperHTML = matchingCommands.map(({ cmd, syntax, args, desc, example }) => {
            // If user is typing this specific command, highlight it
            const isActiveCommand = query.toLowerCase() === cmd || query.toLowerCase().startsWith(cmd + ' ');

            return `<div class="autocomplete-item command-helper-item" style="cursor: default; padding: 8px 10px; border-left: 3px solid ${isActiveCommand ? '#4CAF50' : '#2196F3'}; display: block !important; visibility: visible !important;"><div style="font-weight: 600; color: #4CAF50; font-size: 13px;">${syntax}</div><div style="font-size: 11px; color: #666; margin-top: 2px;">${desc}</div></div>`;
        }).join('');

        // Clear dropdown first
        this.autocompleteDropdown.innerHTML = '';

        // Manually create and append each command item
        matchingCommands.forEach(({ cmd, syntax, args, desc, example }) => {
            const isActiveCommand = query.toLowerCase() === cmd || query.toLowerCase().startsWith(cmd + ' ');

            const itemDiv = document.createElement('div');
            itemDiv.className = 'autocomplete-item command-helper-item';
            itemDiv.style.cssText = `cursor: pointer; padding: 8px 10px; border-left: 3px solid ${isActiveCommand ? '#4CAF50' : '#2196F3'}; display: block;`;

            const syntaxDiv = document.createElement('div');
            syntaxDiv.style.cssText = 'font-weight: 600; color: #4CAF50; font-size: 13px;';
            syntaxDiv.textContent = syntax;

            const descDiv = document.createElement('div');
            descDiv.style.cssText = 'font-size: 11px; color: #666; margin-top: 2px;';
            descDiv.textContent = desc;

            itemDiv.appendChild(syntaxDiv);
            itemDiv.appendChild(descDiv);

            // Add click handler to populate address bar with the command
            itemDiv.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.addressBar.value = cmd + ' ';
                this.addressBar.focus();
                // Move cursor to end of text
                this.addressBar.setSelectionRange(this.addressBar.value.length, this.addressBar.value.length);
                // Hide the dropdown
                this.autocompleteDropdown.classList.add('hidden');
            });

            this.autocompleteDropdown.appendChild(itemDiv);
        });

        this.autocompleteDropdown.classList.remove('hidden');
    }

    getOrCreateWebview(tabId) {
        const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (!content) {
            console.error('No content element found for tab:', tabId);
            return null;
        }

        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) {
            console.error('No tab found with id:', tabId);
            return null;
        }

        let webview = content.querySelector('.tab-webview');

        // Store webview reference in tab (whether existing or new)
        if (webview) {
            tab.webview = webview;
        }

        if (!webview) {

            // Create webview element
            webview = document.createElement('webview');
            webview.className = 'tab-webview';
            webview.style.width = '100%';
            webview.style.height = '100%';
            webview.style.position = 'absolute';
            webview.style.top = '0';
            webview.style.left = '0';
            webview.style.background = 'white';

            // Remove attributes that might trigger detection
            // webview.setAttribute('disablewebsecurity', 'false'); // Don't set this

            // Basic webpreferences without revealing automation
            // Match the settings from main.js for consistency
            // Note: WebGL is enabled via will-attach-webview handler in main.js
            webview.setAttribute('webpreferences', 'contextIsolation=false, nodeIntegration=false');

            // IMPORTANT: Don't set preload here - it's set in will-attach-webview handler in main.js
            // Setting it here with a relative path causes the preload script to not load!

            // Use Chrome 142 to match current CDP version
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
            webview.setAttribute('useragent', userAgent);

            // Set partition for cookies
            webview.setAttribute('partition', tab.isIncognito ? `incognito-${tabId}` : 'persist:browser');

            // Allow popups for OAuth flows
            webview.setAttribute('allowpopups', 'true');

            // Remove redundant settings that might trigger detection

            // Add to DOM
            content.appendChild(webview);

            // Flag to track if we should inject dark mode
            let shouldInjectDarkMode = false;
            let darkModeUrl = '';

            // Check dark mode in did-start-loading (early, but can't execute JS yet)
            webview.addEventListener('did-start-loading', () => {
                // Reset flag on every navigation
                shouldInjectDarkMode = false;

                if (this.darkModeEnforcerToggle && this.darkModeEnforcerToggle.checked) {
                    // Whitelist: Don't apply dark mode to these domains
                    let url = '';
                    try {
                        url = webview.getURL();
                    } catch (e) {
                        // Webview might not be fully ready yet, skip whitelist check
                        console.log('WebView not ready for getURL(), proceeding without whitelist check');
                    }

                    const darkModeWhitelist = [
                        'docs.google.com',
                        'slides.google.com'
                    ];

                    const isWhitelisted = url && darkModeWhitelist.some(domain => url.includes(domain));

                    if (!isWhitelisted) {
                        shouldInjectDarkMode = true;
                        darkModeUrl = url;
                    }
                }
            });

            // Actually inject dark mode in dom-ready (earliest safe point for executeJavaScript)
            webview.addEventListener('dom-ready', () => {
                if (shouldInjectDarkMode) {
                    webview.executeJavaScript(`
                        window.__darkModeEnabled = true;
                        // Trigger dark mode if preload script is loaded
                        if (typeof window.__activateDarkMode === 'function') {
                            window.__activateDarkMode();
                        }
                    `).catch(err => {
                        console.log('Failed to inject dark mode:', err.message);
                    });
                    shouldInjectDarkMode = false; // Reset flag
                }
            });

            // Wrap executeJavaScript to handle destroyed webviews
            const originalExecuteJS = webview.executeJavaScript.bind(webview);
            webview.executeJavaScript = async function(script) {
                if (!document.body.contains(webview)) {
                    return Promise.resolve(null);
                }
                try {
                    return await originalExecuteJS(script);
                } catch (err) {
                    if (!err.message || !err.message.includes('Invalid guestInstanceId')) {
                        console.error('executeJavaScript error:', err);
                    }
                    return null;
                }
            };

            // Store webview reference in tab for memory calculation
            tab.webview = webview;

            // Add immediate event listener to debug
            webview.addEventListener('dom-ready', () => {
            });

            // Track user clicks to detect link navigation
            let lastUserInteraction = 0;

            // Track mouse clicks on the webview element (indicates user is clicking a link)
            webview.addEventListener('mousedown', () => {
                lastUserInteraction = Date.now();
            });

            // Also track Enter key (user might be clicking a link with keyboard)
            webview.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    lastUserInteraction = Date.now();
                }
            });

            // When navigation starts, check if it was recently after user interaction
            webview.addEventListener('did-start-loading', () => {
                const now = Date.now();
                const timeSinceInteraction = now - lastUserInteraction;

                // If navigation started within 1 second of user interaction, consider it user-initiated
                // This catches link clicks but avoids automatic redirects/JS navigations
                if (timeSinceInteraction < 1000) {
                    tab.userInitiatedNavigation = true;
                }
            });

            // Add load event listeners
            webview.addEventListener('did-stop-loading', () => {
            });

            webview.addEventListener('did-fail-load', (e) => {
                // Ignore aborted navigations (-3) and redirects (-30)
                if (e.errorCode === -3 || e.errorCode === -30) {
                    return;
                }

                // Only show custom error page for user-initiated navigations from address bar
                // Link clicks, redirects, and JavaScript navigations should fail silently
                if (!tab.userInitiatedNavigation) {
                    return;
                }

                // Clear the flag after checking
                tab.userInitiatedNavigation = false;

                // Map error codes to user-friendly messages
                let errorTitle = 'Unable to connect';
                let errorMessage = 'An error occurred while loading this page.';
                let errorIcon = '⚠️';
                let errorSuggestions = '';

                switch (e.errorCode) {
                    case -105: // NAME_NOT_RESOLVED
                        errorTitle = 'Site Not Found';
                        errorMessage = 'DNS lookup failed. The domain name could not be resolved to an IP address.';
                        errorIcon = '🔍';
                        errorSuggestions = `
                            <ul>
                                <li>Check the URL for typos or misspellings</li>
                                <li>Verify your internet connection is working</li>
                                <li>Try flushing your DNS cache</li>
                                <li>The domain may not exist or may have expired</li>
                            </ul>
                        `;
                        break;
                    case -106: // INTERNET_DISCONNECTED
                        errorTitle = 'No Internet Connection';
                        errorMessage = 'Your computer appears to be offline.';
                        errorIcon = '📡';
                        errorSuggestions = `
                            <ul>
                                <li>Check your WiFi or ethernet cable connection</li>
                                <li>Restart your router or modem</li>
                                <li>Verify network settings on your computer</li>
                            </ul>
                        `;
                        break;
                    case -118: // CONNECTION_TIMED_OUT
                        errorTitle = 'Connection Timed Out';
                        errorMessage = 'The server took too long to respond.';
                        errorIcon = '⏱️';
                        errorSuggestions = `
                            <ul>
                                <li>Check your internet connection speed</li>
                                <li>The website might be experiencing high traffic</li>
                                <li>Try again in a few moments</li>
                                <li>Check if the site is down for everyone</li>
                            </ul>
                        `;
                        break;
                    case -102: // CONNECTION_REFUSED
                        errorTitle = 'Connection Refused';
                        errorMessage = 'The server actively refused the connection.';
                        errorIcon = '🚫';
                        errorSuggestions = `
                            <ul>
                                <li>The website may be temporarily down for maintenance</li>
                                <li>Your IP might be blocked by the server</li>
                                <li>Try accessing from a different network</li>
                                <li>Contact the website administrator if the problem persists</li>
                            </ul>
                        `;
                        break;
                    case -109: // ADDRESS_UNREACHABLE
                        errorTitle = 'Address Unreachable';
                        errorMessage = 'The network path to the server could not be established.';
                        errorIcon = '🌐';
                        errorSuggestions = `
                            <ul>
                                <li>Check your network configuration and firewall settings</li>
                                <li>Verify the server is online and accepting connections</li>
                                <li>Try using a VPN if the site is geographically restricted</li>
                            </ul>
                        `;
                        break;
                    case -200: // CERT_COMMON_NAME_INVALID
                        errorTitle = 'SSL Certificate Error';
                        errorMessage = 'The site\'s security certificate is not trusted.';
                        errorIcon = '🔒';
                        errorSuggestions = `
                            <ul>
                                <li>The website may be improperly configured</li>
                                <li>Check if you typed the URL correctly</li>
                                <li>Your computer\'s date and time may be incorrect</li>
                                <li>Avoid entering sensitive information</li>
                            </ul>
                        `;
                        break;
                    case -201: // CERT_DATE_INVALID
                        errorTitle = 'Certificate Expired';
                        errorMessage = 'The site\'s security certificate has expired or is not yet valid.';
                        errorIcon = '📅';
                        errorSuggestions = `
                            <ul>
                                <li>Check your computer\'s date and time settings</li>
                                <li>The website\'s SSL certificate may have expired</li>
                                <li>Contact the website administrator</li>
                            </ul>
                        `;
                        break;
                    default:
                        errorTitle = 'Unable to Connect';
                        errorMessage = 'An unexpected error occurred while trying to load the page.';
                        errorSuggestions = `
                            <ul>
                                <li>Try refreshing the page</li>
                                <li>Check your internet connection</li>
                                <li>Clear your browser cache</li>
                            </ul>
                        `;
                }

                // Show error page in webview
                const errorHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }

                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                                background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                min-height: 100vh;
                                padding: 20px;
                                color: #2c3e50;
                                transition: background 0.3s ease, color 0.3s ease;
                            }

                            @media (prefers-color-scheme: dark) {
                                body {
                                    background: linear-gradient(135deg, #1a1d23 0%, #0f1115 100%);
                                    color: #e8ecf1;
                                }
                            }

                            .error-container {
                                background: white;
                                border-radius: 16px;
                                box-shadow: 0 10px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
                                max-width: 650px;
                                width: 100%;
                                padding: 48px;
                                text-align: center;
                                animation: slideUp 0.4s ease-out;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-container {
                                    background: #1e2329;
                                    box-shadow: 0 10px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
                                }
                            }

                            @keyframes slideUp {
                                from {
                                    opacity: 0;
                                    transform: translateY(20px);
                                }
                                to {
                                    opacity: 1;
                                    transform: translateY(0);
                                }
                            }

                            .error-icon {
                                font-size: 72px;
                                margin-bottom: 24px;
                                animation: fadeIn 0.5s ease-out 0.2s both;
                            }

                            @keyframes fadeIn {
                                from {
                                    opacity: 0;
                                    transform: scale(0.8);
                                }
                                to {
                                    opacity: 1;
                                    transform: scale(1);
                                }
                            }

                            .error-title {
                                font-size: 28px;
                                font-weight: 700;
                                color: #2c3e50;
                                margin-bottom: 16px;
                                letter-spacing: -0.5px;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-title {
                                    color: #e8ecf1;
                                }
                            }

                            .error-message {
                                font-size: 16px;
                                color: #64748b;
                                margin-bottom: 32px;
                                line-height: 1.6;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-message {
                                    color: #94a3b8;
                                }
                            }

                            .error-url {
                                background: #f1f5f9;
                                border-radius: 8px;
                                padding: 12px 16px;
                                font-family: 'SF Mono', Monaco, 'Courier New', monospace;
                                font-size: 13px;
                                color: #475569;
                                margin: 20px 0;
                                word-break: break-all;
                                border: 1px solid #e2e8f0;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-url {
                                    background: #0f1115;
                                    color: #94a3b8;
                                    border-color: #2d3748;
                                }
                            }

                            .action-buttons {
                                display: flex;
                                gap: 12px;
                                justify-content: center;
                                margin: 32px 0 24px 0;
                                flex-wrap: wrap;
                            }

                            .btn {
                                padding: 12px 24px;
                                border-radius: 10px;
                                border: none;
                                font-size: 15px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                font-family: inherit;
                                display: inline-flex;
                                align-items: center;
                                gap: 8px;
                            }

                            .btn-primary {
                                background: #3b82f6;
                                color: white;
                                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                            }

                            .btn-primary:hover {
                                background: #2563eb;
                                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                                transform: translateY(-1px);
                            }

                            .btn-secondary {
                                background: #f1f5f9;
                                color: #475569;
                                border: 1px solid #e2e8f0;
                            }

                            .btn-secondary:hover {
                                background: #e2e8f0;
                                transform: translateY(-1px);
                            }

                            @media (prefers-color-scheme: dark) {
                                .btn-secondary {
                                    background: #2d3748;
                                    color: #e2e8f0;
                                    border-color: #4a5568;
                                }

                                .btn-secondary:hover {
                                    background: #374151;
                                }
                            }

                            .error-suggestions {
                                text-align: left;
                                background: #f8fafc;
                                border-radius: 12px;
                                padding: 24px;
                                margin-top: 28px;
                                border: 1px solid #e2e8f0;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-suggestions {
                                    background: #0f1115;
                                    border-color: #2d3748;
                                }
                            }

                            .error-suggestions h3 {
                                font-size: 15px;
                                font-weight: 700;
                                color: #334155;
                                margin-bottom: 16px;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-suggestions h3 {
                                    color: #e2e8f0;
                                }
                            }

                            .error-suggestions ul {
                                list-style: none;
                                padding: 0;
                            }

                            .error-suggestions li {
                                font-size: 14px;
                                color: #64748b;
                                padding: 10px 0;
                                padding-left: 28px;
                                position: relative;
                                line-height: 1.5;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-suggestions li {
                                    color: #94a3b8;
                                }
                            }

                            .error-suggestions li:before {
                                content: "→";
                                position: absolute;
                                left: 8px;
                                color: #3b82f6;
                                font-weight: bold;
                                font-size: 16px;
                            }

                            .error-code {
                                font-size: 13px;
                                color: #94a3b8;
                                margin-top: 24px;
                                font-family: 'SF Mono', Monaco, 'Courier New', monospace;
                                padding: 8px 12px;
                                background: #f8fafc;
                                border-radius: 6px;
                                display: inline-block;
                            }

                            @media (prefers-color-scheme: dark) {
                                .error-code {
                                    color: #64748b;
                                    background: #0f1115;
                                }
                            }

                            .divider {
                                height: 1px;
                                background: #e2e8f0;
                                margin: 24px 0;
                            }

                            @media (prefers-color-scheme: dark) {
                                .divider {
                                    background: #2d3748;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="error-container">
                            <div class="error-icon">${errorIcon}</div>
                            <div class="error-title">${errorTitle}</div>
                            <div class="error-message">${errorMessage}</div>

                            <div class="error-url">${e.validatedURL}</div>

                            <div class="action-buttons">
                                <button class="btn btn-primary" onclick="location.reload()">
                                    <span>↻</span> Try Again
                                </button>
                                <button class="btn btn-secondary" onclick="history.back()">
                                    <span>←</span> Go Back
                                </button>
                            </div>

                            ${errorSuggestions ? `
                                <div class="divider"></div>
                                <div class="error-suggestions">
                                    <h3><span>💡</span> Suggestions</h3>
                                    ${errorSuggestions}
                                </div>
                            ` : ''}

                            <div class="error-code">Error Code: ${e.errorCode}</div>
                        </div>
                    </body>
                    </html>
                `;

                // Set a flag to prevent auto-search on error
                tab.loadingError = true;

                // Load the error page
                webview.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHTML));

                // Update address bar to show the failed URL (not the data URL)
                if (this.activeTabId === tabId) {
                    this.addressBar.value = e.validatedURL;
                }

                console.error('Page load failed:', {
                    url: e.validatedURL,
                    errorCode: e.errorCode,
                    errorDescription: e.errorDescription
                });
            });

            webview.addEventListener('did-start-loading', () => {
                // Dark mode CSS will be injected in dom-ready event instead
            });

            // DevTools event listeners
            webview.addEventListener('devtools-opened', () => {
            });

            webview.addEventListener('devtools-closed', () => {
            });

            // Handle new window requests
            webview.addEventListener('new-window', (e) => {
                // For popup windows, allow them to open naturally (don't prevent default)
                // This allows OAuth popups to work with proper window.opener support
                if (e.disposition === 'new-window') {
                    // Don't call e.preventDefault() - let it open as a real window
                    return;
                }

                // For other dispositions (foreground-tab, background-tab, etc), open in new tab
                e.preventDefault();
                const newTabId = this.createTab(e.url);
                this.switchToTab(newTabId);
            });

            // Handle redirects and navigation
            webview.addEventListener('will-redirect', (e) => {

                // Store the original URL if this is the first redirect
                if (!tab.originalUrl) {
                    tab.originalUrl = e.url;
                }

                // Also track redirect chain
                if (!tab.redirectChain) {
                    tab.redirectChain = [e.url];
                }
                tab.redirectChain.push(e.newURL);

                // Update address bar immediately with redirect target
                this.addressBar.value = e.newURL;
                tab.url = e.newURL;
            });

            // Handle navigation
            webview.addEventListener('did-navigate', (e) => {
                this.addressBar.value = e.url;

                // Detect Google OAuth flow completion (even without popup)
                const url = e.url;
                if (url.includes('accounts.google.com')) {
                    // Store that we're in an OAuth flow
                    tab.inOAuthFlow = true;
                    tab.oauthStartUrl = tab.oauthStartUrl || tab.url;
                } else if (tab.inOAuthFlow && !url.includes('accounts.google.com')) {
                    // We've left Google accounts - OAuth likely completed
                    tab.inOAuthFlow = false;
                }

                // Check if this is an OAuth popup that completed
                if (tab.isOAuthPopup) {
                    if (tab.openerTabId && tab.openerUrl) {
                        const url = e.url;
                        let openerDomain;
                        try {
                            openerDomain = new URL(tab.openerUrl).origin;
                        } catch (err) {
                            console.error('[OAUTH] Invalid opener URL:', tab.openerUrl);
                            return;
                        }

                        // Check if we've returned to the opener domain or a completion URL
                        const isComplete = (
                            url.startsWith(openerDomain) ||
                            url.includes('oauth2callback') ||
                            url.includes('oauth/callback') ||
                            url.includes('/callback') ||
                            url.includes('approved') ||
                            url === 'about:blank'
                        );

                        if (isComplete) {
                            const openerTab = this.tabs.find(t => t.id === tab.openerTabId);

                            if (openerTab && openerTab.webview) {
                                // Navigate opener to the callback URL if it's on the same domain
                                if (url.startsWith(openerDomain) && url !== tab.openerUrl) {
                                    openerTab.webview.src = url;
                                } else {
                                    openerTab.webview.reload();
                                }

                                this.switchToTab(tab.openerTabId);
                            } else {
                                console.warn('[OAUTH] Opener tab not found or has no webview');
                            }

                            // Close OAuth tab after a delay
                            setTimeout(() => {
                                this.closeTab(tabId);
                            }, 1000);
                        }
                    }
                }

                // Clear the favicon when navigating to a new page
                // to avoid carrying over the previous page's favicon
                const previousUrl = tab.url;
                tab.url = e.url;
                tab.favicon = null;
                tab.title = null;

                // Clear redirect info if this is a new navigation (not part of a redirect chain)
                if (!tab.redirectChain || !tab.redirectChain.includes(e.url)) {
                    tab.originalUrl = null;
                    tab.redirectChain = null;
                }

                // Immediately clear favicon from UI
                this.updateTabFavicon(tabId, null);
                this.updateAddressBarFavicon(null);

                // Don't add to history here - will be properly added in did-finish-load
                // with correct title and favicon
            });


            webview.addEventListener('did-navigate-in-page', (e) => {
                if (e.isMainFrame) {
                    this.addressBar.value = e.url;
                    tab.url = e.url;
                }
            });

            // Update title
            webview.addEventListener('page-title-updated', (e) => {
                this.updateTabTitle(tabId, e.title);
            });

            // Update favicon
            webview.addEventListener('page-favicon-updated', (e) => {
                if (e.favicons && e.favicons.length > 0) {
                    this.updateTabFavicon(tabId, e.favicons[0]);
                }
            });

            // Also try to extract favicon from the page DOM as fallback
            webview.addEventListener('dom-ready', () => {
                if (tab && tab.url && !tab.url.startsWith('about:')) {
                    // Try immediately and after a delay for dynamic content
                    const extractFavicon = () => {
                        // Verify webview and tab still exist before executing
                        const currentTab = this.tabs.find(t => t.id === tabId);
                        if (!currentTab || !document.body.contains(webview)) {
                            return;
                        }

                        try {
                            webview.executeJavaScript(`
                                (function() {
                                    // Try multiple ways to find the favicon
                                    const favicons = [];

                                    // Collect all possible favicon links
                                    // Priority order: specific sizes, then generic icons

                                    // Method 1: Look for sized icons (32x32 or 16x16 preferred)
                                    document.querySelectorAll('link[rel*="icon"][sizes]').forEach(link => {
                                        if (link.href) {
                                            const sizes = link.getAttribute('sizes');
                                            favicons.push({
                                                url: link.href,
                                                priority: sizes === '32x32' ? 10 : sizes === '16x16' ? 9 : 5
                                            });
                                        }
                                    });

                                    // Method 2: Standard icon/shortcut icon
                                    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({
                                                url: link.href,
                                                priority: 8
                                            });
                                        }
                                    });

                                    // Method 3: Any rel containing "icon"
                                    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({
                                                url: link.href,
                                                priority: link.rel.includes('apple') ? 3 : 4
                                            });
                                        }
                                    });

                                    // Method 4: Open Graph image as last resort
                                    const ogImage = document.querySelector('meta[property="og:image"]');
                                    if (ogImage && ogImage.content) {
                                        favicons.push({
                                            url: ogImage.content,
                                            priority: 2
                                        });
                                    }

                                    // Method 5: Default favicon.ico
                                    favicons.push({
                                        url: window.location.origin + '/favicon.ico',
                                        priority: 1
                                    });

                                    // Sort by priority and return best match
                                    favicons.sort((a, b) => b.priority - a.priority);

                                    return favicons.length > 0 ? favicons[0].url : null;
                                })();
                            `).then(faviconUrl => {
                                if (faviconUrl && tab.url) {
                                    // Verify the tab still exists and has the same URL
                                    const currentTab = this.tabs.find(t => t.id === tabId);
                                    if (!currentTab || currentTab.url !== tab.url) {
                                        return;
                                    }

                                    const currentFavicon = tab.favicon;

                                    // Update favicon if:
                                    // 1. We don't have one yet
                                    // 2. Current is a default/placeholder and we found a better one
                                    // 3. Current is different (allows updating to better quality)
                                    const isPlaceholder = !currentFavicon ||
                                                         currentFavicon.includes('data:image/svg+xml') ||
                                                         currentFavicon.endsWith('/favicon.ico');
                                    const foundBetterFavicon = faviconUrl && !faviconUrl.endsWith('/favicon.ico');

                                    if (!currentFavicon ||
                                        (isPlaceholder && foundBetterFavicon) ||
                                        (currentFavicon !== faviconUrl && foundBetterFavicon)) {
                                        this.updateTabFavicon(tabId, faviconUrl);
                                    }
                                }
                            }).catch(err => {
                                // Silently ignore errors for invalid/destroyed webviews
                                if (!err.message.includes('Invalid guestInstanceId')) {
                                    console.error('Error extracting favicon:', err);
                                }
                            });
                        } catch (err) {
                            // Silently ignore if webview is already destroyed
                        }
                    };

                    // Try immediately
                    extractFavicon();

                    // Try again after delay for dynamic content
                    setTimeout(extractFavicon, 2000);
                }
            });

            // Focus webview when DOM is ready for spacebar scrolling
            webview.addEventListener('dom-ready', () => {
                if (this.activeTabId === tabId) {
                    // Simple approach - just focus the webview element
                    setTimeout(() => {
                        webview.focus();
                    }, 100);
                }
            });

            // Try extracting favicon again after page fully loads (for dynamically injected favicons)
            webview.addEventListener('did-finish-load', () => {
                if (tab && tab.url && !tab.url.startsWith('about:')) {
                    // Use the same extractFavicon logic as above
                    const extractFavicon = () => {
                        const currentTab = this.tabs.find(t => t.id === tabId);
                        if (!currentTab || !document.body.contains(webview)) {
                            return;
                        }

                        try {
                            webview.executeJavaScript(`
                                (function() {
                                    const favicons = [];
                                    document.querySelectorAll('link[rel*="icon"][sizes]').forEach(link => {
                                        if (link.href) {
                                            const sizes = link.getAttribute('sizes');
                                            favicons.push({
                                                url: link.href,
                                                priority: sizes === '32x32' ? 10 : sizes === '16x16' ? 9 : 5
                                            });
                                        }
                                    });
                                    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({ url: link.href, priority: 8 });
                                        }
                                    });
                                    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({
                                                url: link.href,
                                                priority: link.rel.includes('apple') ? 3 : 4
                                            });
                                        }
                                    });
                                    const ogImage = document.querySelector('meta[property="og:image"]');
                                    if (ogImage && ogImage.content) {
                                        favicons.push({ url: ogImage.content, priority: 2 });
                                    }
                                    favicons.push({ url: window.location.origin + '/favicon.ico', priority: 1 });
                                    favicons.sort((a, b) => b.priority - a.priority);
                                    return favicons.length > 0 ? favicons[0].url : null;
                                })();
                            `).then(faviconUrl => {
                                if (faviconUrl && tab.url) {
                                    const currentTab = this.tabs.find(t => t.id === tabId);
                                    if (!currentTab || currentTab.url !== tab.url) {
                                        return;
                                    }
                                    const currentFavicon = tab.favicon;
                                    const isPlaceholder = !currentFavicon ||
                                                         currentFavicon.includes('data:image/svg+xml') ||
                                                         currentFavicon.endsWith('/favicon.ico');
                                    const foundBetterFavicon = faviconUrl && !faviconUrl.endsWith('/favicon.ico');
                                    if (!currentFavicon ||
                                        (isPlaceholder && foundBetterFavicon) ||
                                        (currentFavicon !== faviconUrl && foundBetterFavicon)) {
                                        this.updateTabFavicon(tabId, faviconUrl);
                                    }
                                }
                            }).catch(err => {
                                if (!err.message.includes('Invalid guestInstanceId')) {
                                    console.error('Error extracting favicon on load:', err);
                                }
                            });
                        } catch (err) {
                            // Silently ignore
                        }
                    };

                    // Extract after a short delay to let dynamic content settle
                    setTimeout(extractFavicon, 500);
                }
            });

            // Anti-bot measures are now handled by webview-preload.js which runs before page load

            // Add audio state detection
            webview.addEventListener('media-started-playing', () => {
                this.updateTabAudioState(tabId, true);
            });

            webview.addEventListener('media-paused', () => {
                // Check if any media is still playing
                webview.executeJavaScript(`
                    Array.from(document.querySelectorAll('audio, video')).some(el => !el.paused)
                `).then(stillPlaying => {
                    if (!stillPlaying) {
                        this.updateTabAudioState(tabId, false);
                    }
                }).catch(() => {});
            });

            // Inject WebGL check for debugging
            webview.addEventListener('did-finish-load', () => {
                const currentUrl = webview.getURL();

                // Focus the webview when page finishes loading if this is the active tab
                if (this.activeTabId === tabId) {
                    // Simple focus - just focus the webview element itself
                    setTimeout(() => {
                        webview.focus();
                    }, 200);
                }

                // Skip ad blocker for Google Docs/Sheets to prevent coordinate issues
                const isGoogleDocs = currentUrl && (currentUrl.includes('docs.google.com') || currentUrl.includes('sheets.google.com'));

                // Apply ad blocker if enabled, but skip for Google Docs/Sheets
                if (this.adBlockerToggle && this.adBlockerToggle.checked && !isGoogleDocs) {
                    this.updateAdBlockerInWebview(webview, true);
                }

                // Apply dark mode if enabled
                // NOTE: Dark mode is now handled by the preload script in did-start-loading/dom-ready
                // This old CSS injection approach is commented out to avoid conflicts
                // Whitelist: Don't apply dark mode to these domains
                const darkModeWhitelist = [
                    'docs.google.com',
                    'slides.google.com'
                ];
                const isDarkModeWhitelisted = darkModeWhitelist.some(domain => currentUrl && currentUrl.includes(domain));

                // DISABLED - Dark mode now handled by preload script
                if (false && this.darkModeEnforcerToggle && this.darkModeEnforcerToggle.checked && !isDarkModeWhitelisted) {
                    webview.insertCSS(`
                        html {
                            background-color: #1a1a1a !important;
                            color-scheme: dark !important;
                        }
                        body {
                            background-color: #1a1a1a !important;
                            color: #e0e0e0 !important;
                        }
                        /* Generic approach: override common CSS variable naming patterns */
                        /* This catches variables from any framework (Material, Bootstrap, etc.) */
                        :root {
                            /* Text/foreground colors - common patterns */
                            --color-text: #e0e0e0 !important;
                            --text-color: #e0e0e0 !important;
                            --color-foreground: #e0e0e0 !important;
                            --foreground: #e0e0e0 !important;
                            --fg-color: #e0e0e0 !important;

                            /* Background colors - common patterns */
                            --color-background: #1a1a1a !important;
                            --background-color: #1a1a1a !important;
                            --bg-color: #1a1a1a !important;
                            --surface-color: #1a1a1a !important;

                            /* Force color-scheme */
                            color-scheme: dark !important;
                        }
                        /* Only target common containers and elements, not everything */
                        div, section, article, main, aside, header, footer, nav {
                            background-color: #1a1a1a;
                            color: #e0e0e0;
                        }
                        /* Force header elements to have opaque backgrounds - only target semantic headers */
                        header,
                        [role="banner"] {
                            background-color: #1a1a1a !important;
                        }
                        header[style*="background"],
                        [role="banner"][style*="background"] {
                            background-color: #2a2a2a !important;
                        }
                        /* Catch sticky/fixed positioned elements via common class patterns */
                        [class*="sticky"][style*="top"],
                        [class*="fixed"][style*="top"],
                        .s[class*="top"],
                        .fixed,
                        .sticky {
                            background-color: #1a1a1a !important;
                        }
                        /* Override white/light backgrounds specifically */
                        [style*="background-color: #fff"],
                        [style*="background-color: white"],
                        [style*="background-color: #ffffff"],
                        [style*="background: #fff"],
                        [style*="background: white"],
                        [style*="background: #ffffff"] {
                            background-color: #1a1a1a !important;
                        }
                        /* Catch light gray and off-white backgrounds */
                        /* BUT DON'T touch RGB colors - they might be colored events */
                        [style*="background-color: #f"]:not([style*="rgb"]),
                        [style*="background: #f"]:not([style*="rgb"]),
                        [style*="background-color: #e"]:not([style*="rgb"]),
                        [style*="background: #e"]:not([style*="rgb"]),
                        [style*="background-color: #d"]:not([style*="rgb"]),
                        [style*="background: #d"]:not([style*="rgb"]),
                        [style*="background-color: #c"]:not([style*="rgb"]),
                        [style*="background: #c"]:not([style*="rgb"]),
                        [style*="background-color: #b"]:not([style*="rgb"]),
                        [style*="background: #b"]:not([style*="rgb"]),
                        [style*="background-color: #a"]:not([style*="rgb"]),
                        [style*="background: #a"]:not([style*="rgb"]) {
                            background-color: #2a2a2a !important;
                        }
                        /* Divs and headings with any background color get white text (no brightness filter) */
                        div[style*="background-color"],
                        div[style*="background:"],
                        section[style*="background-color"],
                        section[style*="background:"],
                        article[style*="background-color"],
                        article[style*="background:"],
                        h1[style*="background"],
                        h2[style*="background"],
                        h3[style*="background"],
                        h4[style*="background"],
                        h5[style*="background"],
                        h6[style*="background"] {
                            color: #ffffff !important;
                        }
                        /* Ensure all children of these elements also have white text */
                        div[style*="background"] *,
                        section[style*="background"] *,
                        article[style*="background"] * {
                            color: #ffffff !important;
                        }
                        /* Headings with white/light backgrounds - darken explicitly */
                        h1[style*="background-color: #fff"],
                        h1[style*="background: #fff"],
                        h2[style*="background-color: #fff"],
                        h2[style*="background: #fff"],
                        h3[style*="background-color: #fff"],
                        h3[style*="background: #fff"],
                        h4[style*="background-color: #fff"],
                        h4[style*="background: #fff"],
                        h5[style*="background-color: #fff"],
                        h5[style*="background: #fff"],
                        h6[style*="background-color: #fff"],
                        h6[style*="background: #fff"],
                        h1[style*="background-color: white"],
                        h2[style*="background-color: white"],
                        h3[style*="background-color: white"],
                        h4[style*="background-color: white"],
                        h5[style*="background-color: white"],
                        h6[style*="background-color: white"] {
                            background-color: #2a2a2a !important;
                        }
                        /* ALL elements with ANY background color must have light text */
                        [style*="background-color"],
                        [style*="background:"],
                        [style*="background-image"] {
                            color: #ffffff !important;
                        }
                        /* Spans and divs with backgrounds need light text */
                        span[style*="background"],
                        div[style*="background"],
                        p[style*="background"] {
                            color: #ffffff !important;
                        }
                        /* All children of colored backgrounds also need light text */
                        [style*="background-color"] *,
                        [style*="background:"] * {
                            color: #ffffff !important;
                        }
                        /* Override dark inline styles specifically */
                        *:not(a)[style*="color: #000"],
                        *:not(a)[style*="color: black"],
                        *:not(a)[style*="color: #000000"],
                        *:not(a)[style*="color:#000"],
                        *:not(a)[style*="color:black"],
                        *:not(a)[style*="color:#000000"],
                        *:not(a)[style*="color:rgb(0, 0, 0)"],
                        *:not(a)[style*="color:rgb(0,0,0)"],
                        *:not(a)[style*="color: rgb(0, 0, 0)"],
                        *:not(a)[style*="color: rgb(0,0,0)"],
                        *:not(a)[style*="color:#1"],
                        *:not(a)[style*="color:#2"],
                        *:not(a)[style*="color:#3"],
                        *:not(a)[style*="color:#4"] {
                            color: #e0e0e0 !important;
                        }
                        /* Target all text elements explicitly */
                        p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, label, b, strong, em, i,
                        article, section, aside, header, footer, nav, main,
                        blockquote, pre, code, kbd, samp, var, mark, small, sub, sup,
                        dd, dt, figcaption, caption, legend, address, time {
                            color: #e0e0e0 !important;
                        }
                        /* Specifically target bold elements and headings with important */
                        b, strong {
                            color: #e0e0e0 !important;
                        }
                        h1, h2, h3, h4, h5, h6 {
                            color: #e0e0e0 !important;
                        }
                        /* Extra specificity for stubborn headings */
                        body h1, body h2, body h3, body h4, body h5, body h6 {
                            color: #e0e0e0 !important;
                            background-color: transparent !important;
                        }
                        article h1, article h2, article h3, article h4, article h5, article h6,
                        section h1, section h2, section h3, section h4, section h5, section h6,
                        div h1, div h2, div h3, div h4, div h5, div h6 {
                            color: #e0e0e0 !important;
                            background-color: transparent !important;
                        }
                        /* Override any background on headings to be dark */
                        h1, h2, h3, h4, h5, h6 {
                            background-color: transparent !important;
                        }
                        /* Links must be bright blue and override inheritance */
                        a, a:link, a:visited, a:hover, a:active {
                            color: #88c0ff !important;
                            pointer-events: auto !important;
                            cursor: pointer !important;
                        }
                        /* Text inside links should also be blue */
                        a span, a div, a p, a b, a strong, a i, a em {
                            color: inherit !important;
                            pointer-events: auto !important;
                        }
                        /* Ensure pseudo-elements on links don't block clicks */
                        a::before, a::after {
                            pointer-events: none !important;
                        }
                        /* Prevent common overlay patterns from blocking links */
                        [class*="overlay"]:not([class*="link"]):not(a),
                        [id*="overlay"]:not([id*="link"]):not(a),
                        [class*="modal"]:not([class*="link"]):not(a),
                        [id*="modal"]:not([id*="link"]):not(a),
                        [class*="backdrop"]:not(a),
                        [class*="mask"]:not(a),
                        [class*="scrim"]:not(a),
                        [class*="curtain"]:not(a),
                        [style*="position: fixed"]:not(a):not(button):not(input):not([role="button"]),
                        [style*="position:fixed"]:not(a):not(button):not(input):not([role="button"]) {
                            pointer-events: none !important;
                        }
                        /* But allow clicks on content inside overlays/modals */
                        [class*="overlay"] a, [id*="overlay"] a,
                        [class*="modal"] a, [id*="modal"] a,
                        [class*="overlay"] button, [id*="overlay"] button,
                        [class*="modal"] button, [id*="modal"] button,
                        [class*="backdrop"] a, [class*="backdrop"] button,
                        [class*="mask"] a, [class*="mask"] button {
                            pointer-events: auto !important;
                        }
                        /* FINAL OVERRIDE - catches everything that slipped through */
                        body *, html * {
                            color: #e0e0e0 !important;
                        }
                        /* Re-apply link colors after universal selector */
                        body a, body a *, html a, html a * {
                            color: #88c0ff !important;
                        }
                        /* ABSOLUTE FINAL TEXT COLOR - comes last to override everything */
                        *, *::before, *::after {
                            color: #e0e0e0 !important;
                        }
                        /* Links must stay blue even after absolute override */
                        a, a *, a::before, a::after {
                            color: #88c0ff !important;
                        }
                        /* Keep media elements normal */
                        body img, body video, body canvas, body picture,
                        html img, html video, html canvas, html picture {
                            color: unset !important;
                        }
                        /* Ensure input fields are readable */
                        input, textarea, select {
                            background-color: #2a2a2a !important;
                            color: #e0e0e0 !important;
                            border-color: #444 !important;
                        }
                        /* FINAL SVG OVERRIDE - must come late in cascade */
                        body svg *, html svg * {
                            fill: #e0e0e0 !important;
                            stroke: #e0e0e0 !important;
                        }
                        body svg path, body svg circle, body svg rect, body svg polygon,
                        body svg ellipse, body svg line, body svg polyline,
                        html svg path, html svg circle, html svg rect, html svg polygon,
                        html svg ellipse, html svg line, html svg polyline {
                            fill: #e0e0e0 !important;
                            stroke: #e0e0e0 !important;
                        }
                        /* Preserve none values after override */
                        body svg [fill="none"], html svg [fill="none"] {
                            fill: none !important;
                        }
                        body svg [stroke="none"], html svg [stroke="none"] {
                            stroke: none !important;
                        }
                        /* SVG RULES - ABSOLUTE FINAL OVERRIDE WITH MAXIMUM SPECIFICITY */
                        body svg path, body svg circle, body svg rect, body svg polygon,
                        body svg ellipse, body svg line, body svg polyline, body svg g,
                        html svg path, html svg circle, html svg rect, html svg polygon,
                        html svg ellipse, html svg line, html svg polyline, html svg g {
                            fill: #e0e0e0 !important;
                            stroke: #e0e0e0 !important;
                        }
                        /* Override any inherited or computed SVG colors */
                        body svg *, html svg * {
                            fill: #e0e0e0 !important;
                            stroke: #e0e0e0 !important;
                        }
                        /* Preserve explicit none values */
                        body svg *[fill="none"], html svg *[fill="none"] {
                            fill: none !important;
                        }
                        body svg *[stroke="none"], html svg *[stroke="none"] {
                            stroke: none !important;
                        }
                        /* Remove any stroke-width: 0 that might hide elements */
                        body svg *, html svg * {
                            stroke-width: inherit !important;
                        }
                        /* ULTRA FINAL - colored backgrounds MUST have white text */
                        /* These come AFTER the universal selector to win the cascade */
                        [style*="background-color"]:not(body):not(html) {
                            color: #ffffff !important;
                        }
                        [style*="background:"]:not(body):not(html) {
                            color: #ffffff !important;
                        }
                        [style*="background-image"]:not(body):not(html) {
                            color: #ffffff !important;
                        }
                        [style*="background: rgb"]:not(body):not(html) {
                            color: #ffffff !important;
                        }
                        /* PRESERVE MASK ATTRIBUTES - don't interfere with masking */
                        *[class*="mask"], *[style*="mask"] {
                            -webkit-mask: revert !important;
                            mask: revert !important;
                            -webkit-mask-image: revert !important;
                            mask-image: revert !important;
                        }
                        /* Make transparent backgrounds dark in dark mode */
                        div[style*="transparent"], span[style*="transparent"],
                        div[style*="rgba(0, 0, 0, 0)"], span[style*="rgba(0, 0, 0, 0)"],
                        div[style*="rgba(0,0,0,0)"], span[style*="rgba(0,0,0,0)"] {
                            background-color: #1a1a1a !important;
                        }
                        /* ALL children of elements with backgrounds MUST be white */
                        [style*="background-color"]:not(body):not(html) *,
                        [style*="background:"]:not(body):not(html) *,
                        [style*="background-image"]:not(body):not(html) * {
                            color: #ffffff !important;
                        }
                        /* Extra specificity for divs and spans with backgrounds */
                        div[style*="background"] {
                            color: #ffffff !important;
                        }
                        div[style*="background"] * {
                            color: #ffffff !important;
                        }
                        span[style*="background"] {
                            color: #ffffff !important;
                        }
                        span[style*="background"] * {
                            color: #ffffff !important;
                        }
                        /* FINAL EXCEPTION - Don't touch children of picture, img, or figure tags */
                        picture *, picture *::before, picture *::after,
                        img *, img *::before, img *::after,
                        figure *, figure *::before, figure *::after {
                            all: revert !important;
                        }
                        picture span, picture div,
                        img span, img div,
                        figure span, figure div {
                            all: revert !important;
                        }
                    `);

                    // Also inject JavaScript to force white text using MutationObserver
                    webview.executeJavaScript(`
                        (function() {
                            // Process a single element
                            const processElement = (el) => {
                                try {
                                    const computed = window.getComputedStyle(el);

                                    // Skip spans/divs that are children of img, picture, or figure tags
                                    if ((el.tagName === 'SPAN' || el.tagName === 'DIV')) {
                                        let parent = el.parentElement;
                                        while (parent) {
                                            if (parent.tagName === 'IMG' || parent.tagName === 'PICTURE' || parent.tagName === 'FIGURE') {
                                                return; // Skip processing, don't touch image children
                                            }
                                            parent = parent.parentElement;
                                        }

                                        // Skip transparent spans and divs - let them inherit naturally
                                        const ownBgColor = computed.backgroundColor;
                                        if (!ownBgColor || ownBgColor === 'transparent' || ownBgColor === 'rgba(0, 0, 0, 0)') {
                                            return; // Skip processing, let it inherit
                                        }
                                    }

                                    // Get background color (checking element and parents)
                                    let bgColor = computed.backgroundColor;
                                    let currentEl = el;

                                    // Walk up the tree to find a non-transparent background
                                    while ((!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') && currentEl.parentElement) {
                                        currentEl = currentEl.parentElement;
                                        bgColor = window.getComputedStyle(currentEl).backgroundColor;
                                    }

                                    // Parse background color to determine brightness
                                    let brightness = 0;
                                    const rgbMatch = bgColor ? bgColor.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/) : null;
                                    if (rgbMatch) {
                                        const r = parseInt(rgbMatch[1]);
                                        const g = parseInt(rgbMatch[2]);
                                        const b = parseInt(rgbMatch[3]);
                                        brightness = (r * 299 + g * 587 + b * 114) / 1000;
                                    }

                                    // Only force white text on dark backgrounds (brightness < 128)
                                    // Keep dark text on light backgrounds
                                    if (el.tagName === 'A') {
                                        el.style.setProperty('color', '#88c0ff', 'important');
                                        el.style.setProperty('pointer-events', 'auto', 'important');
                                        el.style.setProperty('cursor', 'pointer', 'important');
                                    } else if (brightness < 128) {
                                        el.style.setProperty('color', '#ffffff', 'important');
                                    } else if (brightness >= 128) {
                                        // Light background - keep text dark
                                        el.style.setProperty('color', '#1a1a1a', 'important');
                                    }
                                } catch (e) {
                                    // If we can't determine, default to white
                                    if (el.tagName !== 'A') {
                                        el.style.setProperty('color', '#ffffff', 'important');
                                    }
                                }
                            };

                            // Process all current elements
                            const processAllElements = () => {
                                const allElements = document.querySelectorAll('*');
                                allElements.forEach(processElement);
                            };

                            // Run immediately on all existing elements
                            processAllElements();

                            // Set up MutationObserver to watch for DOM changes
                            const observer = new MutationObserver((mutations) => {
                                mutations.forEach((mutation) => {
                                    // Process added nodes
                                    mutation.addedNodes.forEach((node) => {
                                        if (node.nodeType === 1) { // Element node
                                            processElement(node);
                                            // Also process children of added nodes
                                            if (node.querySelectorAll) {
                                                node.querySelectorAll('*').forEach(processElement);
                                            }
                                        }
                                    });

                                    // Process attribute changes (like style changes)
                                    if (mutation.type === 'attributes' && mutation.target.nodeType === 1) {
                                        processElement(mutation.target);
                                    }
                                });
                            });

                            // Start observing the document
                            observer.observe(document.documentElement, {
                                childList: true,
                                subtree: true,
                                attributes: true,
                                attributeFilter: ['style', 'class']
                            });

                            // Store observer reference for cleanup if needed
                            window.__darkModeObserver = observer;
                        })();
                    `);
                }

                // Fix for Google Docs - ensure clean state
                if (isGoogleDocs) {

                    // Ensure zoom is at default to prevent any scaling issues
                    webview.setZoomFactor(1);
                    webview.setZoomLevel(0);
                }

                // Add/update history with the correct title after page loads
                // Skip if: incognito, recording automation, or special URL
                if (tab && tab.url && !tab.isIncognito && tab.id !== this.recordingTabId && !tab.url.startsWith('about:')) {
                    const currentUrl = tab.url;

                    // Wait a bit for title to be set
                    setTimeout(() => {
                        // Only update if this is still the current URL (not navigated away)
                        if (tab.url === currentUrl) {
                            // Add to history or update existing entry
                            // This ensures we have proper title and will get favicon when it loads
                            const redirectInfo = tab.originalUrl || tab.redirectChain ? {
                                originalUrl: tab.originalUrl,
                                redirectChain: tab.redirectChain
                            } : null;
                            const isAutomation = (tab.id === this.recordingTabId);
                            this.addToHistory(tab.url, tab.title || tab.url, tab.favicon, redirectInfo, isAutomation);

                            // Clear redirect info after adding to history
                            tab.originalUrl = null;
                            tab.redirectChain = null;
                        }
                    }, 200);
                }

                // Re-ensure keyboard shortcuts work after page load
                setTimeout(() => {
                    // Force window to regain keyboard event priority
                    window.focus();

                    // If webview has focus, we need to ensure our handlers still work
                    if (document.activeElement === webview) {
                        // Don't blur the webview, but ensure window can still capture events
                        webview.setAudioMuted(false); // Dummy operation to ensure webview processes events
                    }
                }, 100);

                // Check WebGL support
                webview.executeJavaScript(`
                    (function() {
                        const canvas = document.createElement('canvas');
                        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                        const gl2 = canvas.getContext('webgl2');

                        if (gl2) {
                        } else if (gl) {
                        } else {
                            console.error('❌ WebGL is NOT supported');
                        }

                        // Also check WebGPU (experimental)
                        if ('gpu' in navigator) {
                        }
                    })();
                `).catch(() => {});
            });

            // Anti-bot measures are now handled by webview-preload.js which runs before page load

            // Listen for console messages from the webview preload script
            webview.addEventListener('console-message', (e) => {
                // Check for our special focus request message
                if (e.message === 'FOCUS_ADDRESS_BAR_REQUEST') {
                    // Blur the webview
                    webview.blur();

                    // Force focus to window first
                    window.focus();

                    // Focus and select the address bar
                    this.addressBar.focus();
                    this.addressBar.select();
                    this.addressBar.setSelectionRange(0, this.addressBar.value.length);

                    // Ensure it sticks
                    setTimeout(() => {
                        this.addressBar.focus();
                        this.addressBar.select();
                        this.addressBar.setSelectionRange(0, this.addressBar.value.length);
                    }, 10);
                }
            });

            // Intercept keyboard events before they reach webview content
            // This is our last line of defense for Command+L
            const interceptKeyboard = (e) => {
                // Check for Command+L / Ctrl+L
                if (e.input.type === 'keyDown' &&
                    (e.input.control || e.input.meta) &&
                    (e.input.key === 'l' || e.input.key === 'L')) {
                    // Prevent the webview from handling this key
                    e.preventDefault();

                    // Blur the webview to release focus
                    webview.blur();

                    // Force focus to window first, then address bar
                    window.focus();

                    // Focus and select the address bar
                    this.addressBar.focus();
                    this.addressBar.select();
                    this.addressBar.setSelectionRange(0, this.addressBar.value.length);

                    // Ensure it sticks
                    setTimeout(() => {
                        this.addressBar.focus();
                        this.addressBar.select();
                        this.addressBar.setSelectionRange(0, this.addressBar.value.length);
                    }, 10);

                    // Also dispatch a synthetic event to ensure our global handler runs
                    const syntheticEvent = new KeyboardEvent('keydown', {
                        key: 'l',
                        code: 'KeyL',
                        ctrlKey: e.input.control,
                        metaKey: e.input.meta,
                        bubbles: true,
                        cancelable: true
                    });
                    window.dispatchEvent(syntheticEvent);
                }
            };

            webview.addEventListener('before-input-event', interceptKeyboard);

            // Re-add the listener after navigation in case it gets removed
            webview.addEventListener('did-navigate', () => {
                // Remove and re-add to ensure it's fresh
                webview.removeEventListener('before-input-event', interceptKeyboard);
                webview.addEventListener('before-input-event', interceptKeyboard);
            });

            // Helper function to handle navigation updates
            const handleNavigation = (url, isInPageNavigation = false) => {
                // Ignore data URLs (error pages)
                if (url.startsWith('data:')) {
                    return;
                }

                // Clear any loading error flag on successful navigation
                if (tab.loadingError) {
                    tab.loadingError = false;
                }

                // Clear user-initiated navigation flag on successful load
                if (tab.userInitiatedNavigation) {
                    tab.userInitiatedNavigation = false;
                }

                if (this.activeTabId === tabId) {
                    this.addressBar.value = url;
                    this.autoResize();
                    // Update navigation buttons after any navigation
                    this.updateNavigationButtons();
                }
                if (tab) {
                    // Check if this is a new navigation (not in our history at current position)
                    const isNewNavigation = !tab.history[tab.historyIndex] || tab.history[tab.historyIndex] !== url;

                    if (isNewNavigation && tab.url !== url) {
                        // This is a new navigation (link click, redirect, etc.)

                        // Don't add to history here - will be added in did-finish-load
                        // to ensure we have the correct title and favicon
                        // Remove any forward history when navigating to a new page
                        if (tab.historyIndex >= 0 && tab.historyIndex < tab.history.length - 1) {
                            tab.history = tab.history.slice(0, tab.historyIndex + 1);
                        }

                        // Add the new URL to history
                        tab.history.push(url);
                        tab.historyIndex = tab.history.length - 1;

                    }

                    tab.url = url;
                    // Only clear favicon for full page navigations
                    if (!isInPageNavigation) {
                        tab.favicon = null;
                        this.updateTabTitle(tabId, this.getTitleFromURL(url));
                    }
                    if (this.activeTabId === tabId) {
                        if (!isInPageNavigation) {
                            this.updateAddressBarFavicon(null);
                        }
                        this.updateNavigationButtons();
                    }

                    // Schedule auto-save after navigation
                    this.scheduleAutoSave();
                }
            };
            
            // Standard navigation (full page loads)
            webview.addEventListener('did-navigate', (e) => {
                handleNavigation(e.url, false);
            });
            
            // In-page navigation (SPAs, hash changes, History API)
            webview.addEventListener('did-navigate-in-page', (e) => {
                if (e.isMainFrame) {
                    handleNavigation(e.url, true);
                }
            });
            
            webview.addEventListener('page-title-updated', (e) => {
                this.updateTabTitle(tabId, e.title);
            });
            
            webview.addEventListener('page-favicon-updated', (e) => {
                if (e.favicons && e.favicons.length > 0) {
                    this.updateTabFavicon(tabId, e.favicons[0]);
                }
            });

            // Also try to extract favicon from the page DOM as fallback
            webview.addEventListener('dom-ready', () => {
                if (tab && tab.url && !tab.url.startsWith('about:')) {
                    // Try immediately and after a delay for dynamic content
                    const extractFavicon = () => {
                        // Verify webview and tab still exist before executing
                        const currentTab = this.tabs.find(t => t.id === tabId);
                        if (!currentTab || !document.body.contains(webview)) {
                            return;
                        }

                        try {
                            webview.executeJavaScript(`
                                (function() {
                                    // Try multiple ways to find the favicon
                                    const favicons = [];

                                    // Collect all possible favicon links
                                    // Priority order: specific sizes, then generic icons

                                    // Method 1: Look for sized icons (32x32 or 16x16 preferred)
                                    document.querySelectorAll('link[rel*="icon"][sizes]').forEach(link => {
                                        if (link.href) {
                                            const sizes = link.getAttribute('sizes');
                                            favicons.push({
                                                url: link.href,
                                                priority: sizes === '32x32' ? 10 : sizes === '16x16' ? 9 : 5
                                            });
                                        }
                                    });

                                    // Method 2: Standard icon/shortcut icon
                                    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({
                                                url: link.href,
                                                priority: 8
                                            });
                                        }
                                    });

                                    // Method 3: Any rel containing "icon"
                                    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({
                                                url: link.href,
                                                priority: link.rel.includes('apple') ? 3 : 4
                                            });
                                        }
                                    });

                                    // Method 4: Open Graph image as last resort
                                    const ogImage = document.querySelector('meta[property="og:image"]');
                                    if (ogImage && ogImage.content) {
                                        favicons.push({
                                            url: ogImage.content,
                                            priority: 2
                                        });
                                    }

                                    // Method 5: Default favicon.ico
                                    favicons.push({
                                        url: window.location.origin + '/favicon.ico',
                                        priority: 1
                                    });

                                    // Sort by priority and return best match
                                    favicons.sort((a, b) => b.priority - a.priority);

                                    return favicons.length > 0 ? favicons[0].url : null;
                                })();
                            `).then(faviconUrl => {
                                if (faviconUrl && tab.url) {
                                    // Verify the tab still exists and has the same URL
                                    const currentTab = this.tabs.find(t => t.id === tabId);
                                    if (!currentTab || currentTab.url !== tab.url) {
                                        return;
                                    }

                                    const currentFavicon = tab.favicon;

                                    // Update favicon if:
                                    // 1. We don't have one yet
                                    // 2. Current is a default/placeholder and we found a better one
                                    // 3. Current is different (allows updating to better quality)
                                    const isPlaceholder = !currentFavicon ||
                                                         currentFavicon.includes('data:image/svg+xml') ||
                                                         currentFavicon.endsWith('/favicon.ico');
                                    const foundBetterFavicon = faviconUrl && !faviconUrl.endsWith('/favicon.ico');

                                    if (!currentFavicon ||
                                        (isPlaceholder && foundBetterFavicon) ||
                                        (currentFavicon !== faviconUrl && foundBetterFavicon)) {
                                        this.updateTabFavicon(tabId, faviconUrl);
                                    }
                                }
                            }).catch(err => {
                                // Silently ignore errors for invalid/destroyed webviews
                                if (!err.message.includes('Invalid guestInstanceId')) {
                                    console.error('Error extracting favicon:', err);
                                }
                            });
                        } catch (err) {
                            // Silently ignore if webview is already destroyed
                        }
                    };

                    // Try immediately
                    extractFavicon();

                    // Try again after delay for dynamic content
                    setTimeout(extractFavicon, 2000);
                }
            });

            // Try extracting favicon again after page fully loads (for dynamically injected favicons)
            webview.addEventListener('did-finish-load', () => {
                if (tab && tab.url && !tab.url.startsWith('about:')) {
                    const extractFavicon = () => {
                        const currentTab = this.tabs.find(t => t.id === tabId);
                        if (!currentTab || !document.body.contains(webview)) {
                            return;
                        }

                        try {
                            webview.executeJavaScript(`
                                (function() {
                                    const favicons = [];
                                    document.querySelectorAll('link[rel*="icon"][sizes]').forEach(link => {
                                        if (link.href) {
                                            const sizes = link.getAttribute('sizes');
                                            favicons.push({
                                                url: link.href,
                                                priority: sizes === '32x32' ? 10 : sizes === '16x16' ? 9 : 5
                                            });
                                        }
                                    });
                                    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({ url: link.href, priority: 8 });
                                        }
                                    });
                                    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
                                        if (link.href && !favicons.find(f => f.url === link.href)) {
                                            favicons.push({
                                                url: link.href,
                                                priority: link.rel.includes('apple') ? 3 : 4
                                            });
                                        }
                                    });
                                    const ogImage = document.querySelector('meta[property="og:image"]');
                                    if (ogImage && ogImage.content) {
                                        favicons.push({ url: ogImage.content, priority: 2 });
                                    }
                                    favicons.push({ url: window.location.origin + '/favicon.ico', priority: 1 });
                                    favicons.sort((a, b) => b.priority - a.priority);
                                    return favicons.length > 0 ? favicons[0].url : null;
                                })();
                            `).then(faviconUrl => {
                                if (faviconUrl && tab.url) {
                                    const currentTab = this.tabs.find(t => t.id === tabId);
                                    if (!currentTab || currentTab.url !== tab.url) {
                                        return;
                                    }
                                    const currentFavicon = tab.favicon;
                                    const isPlaceholder = !currentFavicon ||
                                                         currentFavicon.includes('data:image/svg+xml') ||
                                                         currentFavicon.endsWith('/favicon.ico');
                                    const foundBetterFavicon = faviconUrl && !faviconUrl.endsWith('/favicon.ico');
                                    if (!currentFavicon ||
                                        (isPlaceholder && foundBetterFavicon) ||
                                        (currentFavicon !== faviconUrl && foundBetterFavicon)) {
                                        this.updateTabFavicon(tabId, faviconUrl);
                                    }
                                }
                            }).catch(err => {
                                if (!err.message.includes('Invalid guestInstanceId')) {
                                    console.error('Error extracting favicon on load:', err);
                                }
                            });
                        } catch (err) {
                            // Silently ignore
                        }
                    };

                    // Extract after a short delay to let dynamic content settle
                    setTimeout(extractFavicon, 500);
                }
            });

            // Handle right-click context menu
            webview.addEventListener('context-menu', async (e) => {
                e.preventDefault();

                const params = e.params;

                // Try to detect links more accurately by checking the element at click position
                let linkUrl = params.linkURL;

                // Try to find a parent anchor element or clickable element if no direct linkURL
                // Run this even if text is selected (text might be inside a link)
                if (!linkUrl) {
                    try {
                        // Execute JavaScript in the webview to find any anchor element at the click position
                        const result = await webview.executeJavaScript(`
                            (() => {
                                const x = ${params.x};
                                const y = ${params.y};

                                // Get all elements at this point (in case of overlapping elements)
                                const elements = document.elementsFromPoint(x, y);

                                // Check each element and its parents
                                for (let element of elements) {
                                    let current = element;
                                    let depth = 0;
                                    const maxDepth = 20; // Look up to 20 levels

                                    while (current && current !== document.documentElement && depth < maxDepth) {
                                        // Check for anchor tags
                                        if (current.tagName === 'A' && current.href) {
                                            return current.href;
                                        }

                                        // Check for clickable elements with various attributes
                                        if (current.href) {
                                            return current.href;
                                        }

                                        // Check data attributes commonly used for links
                                        if (current.dataset) {
                                            if (current.dataset.href) {
                                                return current.dataset.href;
                                            }
                                            if (current.dataset.url) {
                                                return current.dataset.url;
                                            }
                                            if (current.dataset.link) {
                                                return current.dataset.link;
                                            }
                                        }

                                        // Check for role="link" elements
                                        if (current.getAttribute && current.getAttribute('role') === 'link') {
                                            const ariaLabel = current.getAttribute('aria-label');
                                            if (ariaLabel && ariaLabel.startsWith('http')) {
                                                return ariaLabel;
                                            }
                                        }

                                        // Check for onclick handlers that might contain URLs
                                        const onclick = current.getAttribute ? current.getAttribute('onclick') : null;
                                        if (onclick) {
                                            const urlMatch = onclick.match(/(?:window\\.location|location\\.href|window\\.open)\\s*=\\s*["']([^"']+)["']/);
                                            if (urlMatch && urlMatch[1]) {
                                                return urlMatch[1];
                                            }
                                        }

                                        current = current.parentElement || current.parentNode;
                                        depth++;
                                    }
                                }

                                return null;
                            })()
                        `);
                        if (result) {
                            linkUrl = result;
                        }
                    } catch (err) {
                    }
                }

                // Priority order: link > image > text > page
                // Check for links first (unless text is selected)
                if (linkUrl && !params.selectionText) {
                    this.showLinkContextMenu(params.x, params.y, linkUrl);
                }
                // Show text context menu if text is selected
                else if (params.selectionText) {
                    // Check if the selected text is also a link
                    if (linkUrl) {
                        this.showLinkContextMenu(params.x, params.y, linkUrl);
                    } else {
                        this.showTextContextMenu(params.x, params.y, params.selectionText);
                    }
                }
                // Show image context menu if clicking on an image
                else if (params.hasImageContents || params.srcURL || params.mediaType === 'image') {
                    // params.srcURL is the image URL, linkUrl might exist if image is also a link
                    const imageUrl = params.srcURL || params.pageURL;

                    if (imageUrl) {
                        this.showImageContextMenu(params.x, params.y, imageUrl, linkUrl);
                    } else {
                        console.warn('No image URL found in context menu params');
                        this.showPageContextMenu(params.x, params.y);
                    }
                }
                // Show page context menu for non-text/non-image content
                else if (!params.isEditable) {
                    this.showPageContextMenu(params.x, params.y);
                }
            });
            
            webview.addEventListener('did-fail-load', async (e) => {
                // Common error codes to ignore:
                // -3: ERR_ABORTED - User cancelled or navigation was aborted
                // -21: ERR_NETWORK_CHANGED - Network configuration changed
                const ignoredErrors = [-3, -21];

                // Only show error for main frame failures, not subresources
                if (!e.isMainFrame) {
                    return;
                }

                if (ignoredErrors.includes(e.errorCode)) {
                    return;
                }

                // DNS lookup failures (ERR_NAME_NOT_RESOLVED) are now handled by the error page
                // No longer automatically searching - let the error page show instead
                if (e.errorCode === -105) {
                    return; // Error page was already shown
                }

                // Only show error page for other main frame load failures
                if (this.activeTabId === tabId && e.isMainFrame) {
                    const claudeResults = content.querySelector('.tab-claude-results');
                    let errorMessage = 'Unable to load the page.';

                    claudeResults.innerHTML = `
                        <div class="error">
                            <h2>Unable to load page</h2>
                            <p>${e.errorDescription || errorMessage}</p>
                            <p class="error-url">${e.validatedURL}</p>
                        </div>
                    `;
                    this.showClaudeResults(tabId);
                }
            });
        }
        
        return webview;
    }
    
    showWebView(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        tab.mode = 'web';
        const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (content) {
            // Get or create webview
            const webview = this.getOrCreateWebview(tabId);
            if (webview) {
                content.querySelector('.tab-welcome-screen').style.display = 'none';
                content.querySelector('.tab-claude-results').style.display = 'none';
                // Ensure webview is visible - use empty string to reset to default display
                webview.style.display = '';
            }
        }
    }
    
    showClaudeResults(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;
        
        tab.mode = 'claude';
        const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (content) {
            content.querySelector('.tab-welcome-screen').style.display = 'none';
            const webview = content.querySelector('.tab-webview');
            if (webview) {
                webview.style.display = 'none';
            }
            content.querySelector('.tab-claude-results').style.display = 'block';
        }
    }
    
    showWelcomeScreen(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        tab.mode = 'welcome';
        tab.favicon = null;
        const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (content) {
            // Don't touch webview - let it stay in DOM naturally
            content.querySelector('.tab-claude-results').style.display = 'none';
            content.querySelector('.tab-welcome-screen').style.display = 'flex';
        }

        // Clear favicon for welcome screen
        if (this.activeTabId === tabId) {
            this.updateAddressBarFavicon(null);
        }
        this.updateTabFavicon(tabId, null);
    }

    showApiKeyInstructions(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        tab.mode = 'claude';
        const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (content) {
            content.querySelector('.tab-welcome-screen').style.display = 'none';
            const webview = content.querySelector('.tab-webview');
            if (webview) {
                webview.style.display = 'none';
            }

            const claudeResults = content.querySelector('.tab-claude-results');
            claudeResults.style.display = 'block';
            claudeResults.innerHTML = `
                <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #333; margin-bottom: 30px; text-align: center;">🔑 Getting Your Anthropic API Key</h2>

                    <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 30px; border: 1px solid #e0e0e0;">
                        <h3 style="color: #444; margin-bottom: 20px;">📋 Step-by-Step Instructions:</h3>
                        <ol style="color: #555; line-height: 2; font-size: 16px;">
                            <li style="margin-bottom: 15px;">
                                <strong>Copy this URL:</strong><br>
                                <div style="background: white; padding: 10px; border-radius: 6px; margin-top: 8px; font-family: monospace; font-size: 14px; color: #0066cc; word-break: break-all; user-select: all; cursor: text; border: 1px solid #ddd;">
                                    https://console.anthropic.com/settings/keys
                                </div>
                            </li>
                            <li style="margin-bottom: 15px;">Open your regular web browser (Chrome, Safari, Firefox, etc.)</li>
                            <li style="margin-bottom: 15px;">Paste the URL and press Enter</li>
                            <li style="margin-bottom: 15px;">Sign in to your Anthropic account (or create one if you don't have one)</li>
                            <li style="margin-bottom: 15px;">Click "Create Key" button</li>
                            <li style="margin-bottom: 15px;">Give your key a name (e.g., "${BROWSER_NAME}")</li>
                            <li style="margin-bottom: 15px;">Copy the generated API key</li>
                            <li style="margin-bottom: 15px;">Come back to ${BROWSER_NAME} and paste it in the yellow warning bar at the top</li>
                        </ol>
                    </div>

                    <div style="background: #fff9e6; border-radius: 12px; padding: 20px; border: 1px solid #ffeb99;">
                        <h4 style="color: #666; margin-bottom: 15px;">⚠️ Important Notes:</h4>
                        <ul style="color: #666; line-height: 1.8; list-style-type: none; padding-left: 0;">
                            <li style="margin-bottom: 10px;">✓ The API key will start with "sk-ant-api03-"</li>
                            <li style="margin-bottom: 10px;">✓ Keep your API key secret and secure</li>
                            <li style="margin-bottom: 10px;">✓ You can set usage limits in the Anthropic Console</li>
                            <li style="margin-bottom: 10px;">✓ Free tier includes $5 of credits to get started</li>
                        </ul>
                    </div>

                    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px; border: 1px solid #667eea30;">
                        <p style="color: #555; text-align: center; margin: 0; font-size: 15px;">
                            💡 <strong>Tip:</strong> After entering your API key, it will be saved for future sessions.<br>
                            You only need to do this once!
                        </p>
                    </div>
                </div>
            `;
        }

        this.updateTabTitle(tabId, 'Get API Key');
    }

    showInceptionApiKeyInstructions(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        tab.mode = 'claude';
        const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (content) {
            content.querySelector('.tab-welcome-screen').style.display = 'none';
            const webview = content.querySelector('.tab-webview');
            if (webview) {
                webview.style.display = 'none';
            }

            const claudeResults = content.querySelector('.tab-claude-results');
            claudeResults.style.display = 'block';
            claudeResults.innerHTML = `
                <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #333; margin-bottom: 30px; text-align: center;">🔑 Getting Your Inception Labs API Key</h2>

                    <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 30px; border: 1px solid #e0e0e0;">
                        <h3 style="color: #444; margin-bottom: 20px;">📋 Step-by-Step Instructions:</h3>
                        <ol style="color: #555; line-height: 2; font-size: 16px;">
                            <li style="margin-bottom: 15px;">
                                <strong>Copy this URL:</strong><br>
                                <div style="background: white; padding: 10px; border-radius: 6px; margin-top: 8px; font-family: monospace; font-size: 14px; color: #0066cc; word-break: break-all; user-select: all; cursor: text; border: 1px solid #ddd;">
                                    https://platform.inceptionlabs.ai/auth/login
                                </div>
                            </li>
                            <li style="margin-bottom: 15px;">Open your regular web browser (Chrome, Safari, Firefox, etc.)</li>
                            <li style="margin-bottom: 15px;">Paste the URL and press Enter</li>
                            <li style="margin-bottom: 15px;">Sign in to your Inception Labs account (or create one if you don't have one)</li>
                            <li style="margin-bottom: 15px;">Navigate to your API Keys settings</li>
                            <li style="margin-bottom: 15px;">Click "Create New Key" or similar button</li>
                            <li style="margin-bottom: 15px;">Give your key a name (e.g., "${BROWSER_NAME}")</li>
                            <li style="margin-bottom: 15px;">Copy the generated API key</li>
                            <li style="margin-bottom: 15px;">Come back to ${BROWSER_NAME} and paste it in the yellow warning bar at the top</li>
                        </ol>
                    </div>

                    <div style="background: #fff9e6; border-radius: 12px; padding: 20px; border: 1px solid #ffeb99;">
                        <h4 style="color: #666; margin-bottom: 15px;">⚠️ Important Notes:</h4>
                        <ul style="color: #666; line-height: 1.8; list-style-type: none; padding-left: 0;">
                            <li style="margin-bottom: 10px;">✓ Keep your API key secret and secure</li>
                            <li style="margin-bottom: 10px;">✓ The Mercury model provides fast, accurate AI responses</li>
                            <li style="margin-bottom: 10px;">✓ Check Inception Labs documentation for usage limits and pricing</li>
                            <li style="margin-bottom: 10px;">✓ You can manage your keys in the Inception Labs console</li>
                        </ul>
                    </div>

                    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px; border: 1px solid #667eea30;">
                        <p style="color: #555; text-align: center; margin: 0; font-size: 15px;">
                            💡 <strong>Tip:</strong> After entering your API key, it will be saved for future sessions.<br>
                            You only need to do this once!
                        </p>
                    </div>
                </div>
            `;
        }

        this.updateTabTitle(tabId, 'Get Inception Labs API Key');
    }

    showAnthropicConsoleMessage(tabId, url) {
        // Just redirect to the API key instructions instead
        this.showApiKeyInstructions(tabId);
    }
    
    processMarkdownContent(content) {
        if (!content) return '';

        // If the content is already HTML (starts with < and contains HTML tags)
        if (content.trim().startsWith('<') && /<\/\w+>/.test(content)) {
            return content;
        }

        // Configure marked for better rendering
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,        // Convert \n to <br>
                gfm: true,          // Use GitHub Flavored Markdown
                headerIds: false,   // Don't add IDs to headers
                mangle: false,      // Don't escape autolinked email addresses
                pedantic: false,    // Don't conform to obscure markdown.pl bugs
                sanitize: false,    // Don't sanitize HTML (we use DOMPurify for this)
                smartypants: false, // Don't use smart punctuation
            });

            try {
                // Use marked to convert markdown to HTML
                return marked.parse(content);
            } catch (error) {
                console.error('Error parsing markdown:', error);
                // Fallback to returning the original content
                return content.replace(/\n/g, '<br>');
            }
        }

        // Fallback if marked is not loaded (shouldn't happen)
        console.warn('Marked library not loaded, using fallback markdown processing');
        return content.replace(/\n/g, '<br>');
    }

    async summarizeCurrentPage() {
        const tab = this.getCurrentTab();
        if (!tab) {
            alert('No active tab');
            return;
        }
        
        // Try to get the webview from the current tab content
        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) {
            alert('No content area found');
            return;
        }
        
        const webview = content.querySelector('.tab-webview');
        if (!webview || !webview.src || webview.src === 'about:blank' || webview.src === '') {
            alert('Please navigate to a webpage first');
            return;
        }
        
        const summaryOverlay = document.getElementById('summary-overlay');
        const summaryBody = summaryOverlay.querySelector('.summary-body');
        
        // Show overlay with loading state
        summaryOverlay.classList.remove('hidden');
        summaryBody.className = 'summary-body loading';
        summaryBody.innerHTML = 'Extracting page content and generating summary...';
        
        try {
            // Extract text content from the webview without modifying the page
            const pageText = await webview.executeJavaScript(`
                (function() {
                    // Clone the body to avoid modifying the actual page
                    const bodyClone = document.body ? document.body.cloneNode(true) : null;

                    if (bodyClone) {
                        // Remove script and style elements from the clone only
                        const scripts = bodyClone.querySelectorAll('script, style, noscript');
                        scripts.forEach(el => el.remove());

                        // Get the text content from the clone
                        const bodyText = bodyClone.innerText || bodyClone.textContent || '';
                        const titleText = document.title || '';

                        return titleText + '\\n\\n' + bodyText;
                    } else {
                        // Fallback if cloning fails
                        return document.title + '\\n\\n' + document.body.innerText;
                    }
                })();
            `);
            
            if (!pageText || pageText.trim().length < 50) {
                summaryBody.className = 'summary-body';
                summaryBody.innerHTML = '<p>Unable to extract meaningful content from this page.</p>';
                return;
            }
            
            // Remove any existing listeners
            window.electronAPI.removeSummaryStreamListeners();
            
            // Set up container for streamed content
            summaryBody.className = 'summary-body';
            summaryBody.innerHTML = '';
            let streamedContent = '';
            
            // Set up streaming listeners
            window.electronAPI.onSummaryStreamChunk((data) => {
                streamedContent += data.text;
                // Convert markdown code blocks to HTML
                summaryBody.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(streamedContent));
            });

            window.electronAPI.onSummaryStreamEnd((data) => {
                // Final update with complete content
                summaryBody.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(data.fullContent));
                window.electronAPI.removeSummaryStreamListeners();
            });
            
            window.electronAPI.onSummaryStreamError((data) => {
                summaryBody.innerHTML = DOMPurify.sanitize(`
                    <div class="error">
                        <h3>Error generating summary</h3>
                        <p>${data.error}</p>
                    </div>
                `);
                window.electronAPI.removeSummaryStreamListeners();
            });
            
            // Start the stream
            const model = this.getSelectedModel();
            await window.electronAPI.summarizePageStream(pageText, model);
        } catch (error) {
            summaryBody.className = 'summary-body';
            summaryBody.innerHTML = DOMPurify.sanitize(`
                <div class="error">
                    <h3>Error extracting page content</h3>
                    <p>${error.message}</p>
                </div>
            `);
        }
    }

    showMultiPageSummaryDialog() {
        const dialog = document.getElementById('multi-page-summary-dialog');
        const slider = document.getElementById('tab-count-slider');

        // Reset slider to default
        slider.value = 5;
        document.getElementById('tab-count-display').textContent = '5 tabs';

        // Show dialog
        dialog.classList.remove('hidden');

        // Update preview list
        this.updateTabPreviewList(5);
    }

    updateTabPreviewList(count) {
        const previewList = document.getElementById('tab-preview-list');
        previewList.innerHTML = '';

        // Get tabs with web content (skip welcome pages)
        const webTabs = this.tabs.filter(tab =>
            tab.url &&
            tab.url !== '' &&
            tab.url !== 'about:blank' &&
            tab.mode === 'web'
        );

        // Get the most recent tabs
        const selectedTabs = webTabs.slice(-count);

        if (selectedTabs.length === 0) {
            previewList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No web pages available to summarize</div>';
            return;
        }

        // Show selected tabs
        selectedTabs.forEach((tab, index) => {
            const item = document.createElement('div');
            item.className = 'tab-preview-item';

            const favicon = tab.favicon ? `<img src="${tab.favicon}" alt="">` : '<img src="assets/default-favicon.png" alt="">';

            item.innerHTML = `
                ${favicon}
                <div style="flex: 1; min-width: 0;">
                    <div class="tab-title">${tab.title || 'Untitled'}</div>
                    <div class="tab-url">${tab.url}</div>
                </div>
            `;

            previewList.appendChild(item);
        });

        // Update button text if fewer tabs available
        const startBtn = document.getElementById('multi-summary-start-btn');
        if (selectedTabs.length < count) {
            startBtn.textContent = `Generate Summary (${selectedTabs.length} tabs available)`;
        } else {
            startBtn.textContent = 'Generate Summary';
        }
    }

    async summarizeMultipleTabs(count) {
        // Get tabs with web content
        const webTabs = this.tabs.filter(tab =>
            tab.url &&
            tab.url !== '' &&
            tab.url !== 'about:blank' &&
            tab.mode === 'web'
        );

        const selectedTabs = webTabs.slice(-count);

        if (selectedTabs.length === 0) {
            this.showNotification('No web pages available to summarize', 'error');
            return;
        }

        const summaryOverlay = document.getElementById('summary-overlay');
        const summaryBody = summaryOverlay.querySelector('.summary-body');

        // Show overlay with loading state
        summaryOverlay.classList.remove('hidden');
        summaryBody.className = 'summary-body loading';
        summaryBody.innerHTML = `Extracting content from ${selectedTabs.length} tabs and generating summary...`;

        try {
            // Extract content from each tab
            const tabContents = [];

            for (const tab of selectedTabs) {
                const content = this.tabsContent.querySelector(`[data-tab-id="${tab.id}"]`);
                if (!content) continue;

                const webview = content.querySelector('.tab-webview');
                if (!webview || !webview.src) continue;

                try {
                    // Extract text content from the webview
                    const pageText = await webview.executeJavaScript(`
                        (function() {
                            const bodyClone = document.body ? document.body.cloneNode(true) : null;
                            if (bodyClone) {
                                const scripts = bodyClone.querySelectorAll('script, style, noscript');
                                scripts.forEach(el => el.remove());
                                const bodyText = bodyClone.innerText || bodyClone.textContent || '';
                                const titleText = document.title || '';
                                return titleText + '\\n\\n' + bodyText;
                            } else {
                                return document.title + '\\n\\n' + document.body.innerText;
                            }
                        })();
                    `);

                    if (pageText && pageText.trim().length > 50) {
                        tabContents.push({
                            title: tab.title,
                            url: tab.url,
                            content: pageText.substring(0, 3000) // Limit content per page
                        });
                    }
                } catch (error) {
                    console.error(`Failed to extract content from tab ${tab.id}:`, error);
                }
            }

            if (tabContents.length === 0) {
                summaryBody.className = 'summary-body';
                summaryBody.innerHTML = '<p>Unable to extract content from the selected tabs.</p>';
                return;
            }

            // Prepare combined content for summary
            const combinedContent = tabContents.map((tab, index) =>
                `=== Page ${index + 1}: ${tab.title} ===\nURL: ${tab.url}\n\n${tab.content}`
            ).join('\n\n---\n\n');

            // Remove any existing listeners
            window.electronAPI.removeSummaryStreamListeners();

            // Set up container for streamed content
            summaryBody.className = 'summary-body';
            summaryBody.innerHTML = '';
            let streamedContent = '';

            // Set up streaming listeners
            window.electronAPI.onSummaryStreamChunk((data) => {
                streamedContent += data.text;
                summaryBody.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(streamedContent));
            });

            window.electronAPI.onSummaryStreamEnd((data) => {
                summaryBody.innerHTML = DOMPurify.sanitize(this.processMarkdownContent(data.fullContent));
                window.electronAPI.removeSummaryStreamListeners();
            });

            window.electronAPI.onSummaryStreamError((data) => {
                summaryBody.innerHTML = DOMPurify.sanitize(`
                    <div class="error">
                        <h3>Error generating summary</h3>
                        <p>${data.error}</p>
                    </div>
                `);
                window.electronAPI.removeSummaryStreamListeners();
            });

            // Start the stream with a multi-page prompt
            const model = this.getSelectedModel();
            const prompt = `Please provide a comprehensive summary of these ${tabContents.length} web pages. Identify common themes, key information, and relationships between the pages:\n\n${combinedContent}`;
            await window.electronAPI.summarizePageStream(prompt, model);

        } catch (error) {
            summaryBody.className = 'summary-body';
            summaryBody.innerHTML = `
                <div class="error">
                    <h3>Error during multi-page summary</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    processMarkdownHTML(text) {
        // Remove markdown code block markers for HTML
        let processed = text;

        // Remove ```html opening markers
        processed = processed.replace(/```html\s*\n?/gi, '');

        // Remove ``` closing markers
        processed = processed.replace(/```\s*$/g, '');
        processed = processed.replace(/```\s*\n/g, '\n');

        // Also handle other code block types that might contain HTML
        processed = processed.replace(/```xml\s*\n?/gi, '');
        processed = processed.replace(/```jsx\s*\n?/gi, '');

        return processed;
    }

    attachLinkHandlersToClaudeResults(tabId) {
        const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
        if (!content) return;

        const claudeResults = content.querySelector('.tab-claude-results');
        if (!claudeResults) return;

        // Find all links in the Claude results
        const links = claudeResults.querySelectorAll('a[href]');

        links.forEach(link => {
            // Remove any existing click handlers first
            link.removeEventListener('click', this.handleClaudeLinkClick);

            // Add our custom click handler
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const url = link.getAttribute('href');

                if (url) {
                    // Check if it's an external link or relative link
                    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
                        // Navigate to the URL in the current tab
                        this.addressBar.value = url;
                        this.navigate();
                    } else if (url.startsWith('#')) {
                        // Handle anchor links if needed
                    } else {
                        // Handle relative URLs
                        this.addressBar.value = url;
                        this.navigate();
                    }
                }
            });
        });
    }
    
    async searchWithClaude(query) {
        const tab = this.getCurrentTab();
        if (!tab) {
            console.error('No current tab found');
            return;
        }

        // Store the tab ID that initiated this search
        const searchTabId = this.activeTabId;

        this.showClaudeResults(searchTabId);

        const content = this.tabsContent.querySelector(`[data-tab-id="${searchTabId}"]`);
        if (!content) {
            console.error('No content found for tab:', searchTabId);
            return;
        }

        const claudeResults = content.querySelector('.tab-claude-results');
        if (!claudeResults) {
            console.error('No claude results element found');
            return;
        }

        // Get selected model to determine which API to use
        const model = this.getSelectedModel();
        const isInception = model === 'mercury';

        // Check if Inception Labs API key is set when using Mercury
        if (isInception) {
            const inceptionKeyResult = await window.electronAPI.getInceptionApiKey();
            if (!inceptionKeyResult.apiKey || inceptionKeyResult.apiKey.trim() === '') {
                claudeResults.innerHTML = `
                    <div class="error">
                        <h2>Inception Labs API Key Required</h2>
                        <p>You need to set your Inception Labs API key to use the Mercury model.</p>
                        <p>Please go to Settings (⚙️) and add your Inception Labs API key.</p>
                        <button onclick="document.getElementById('settings-btn').click()" style="margin-top: 12px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Open Settings</button>
                    </div>
                `;
                this.updateTabTitle(searchTabId, 'Error: API Key Required');
                return;
            }
        }

        // Show loading state initially
        const aiName = isInception ? 'Inception Labs Mercury' : 'Claude AI';
        claudeResults.innerHTML = `<div class="loading">Searching with ${aiName}...</div>`;

        // Update tab title
        const titlePrefix = isInception ? 'Mercury' : 'Claude';
        this.updateTabTitle(searchTabId, `${titlePrefix}: ${query.substring(0, 30)}...`);

        // Remove any existing listeners first
        if (isInception) {
            window.electronAPI.removeInceptionStreamListeners();
        } else {
            window.electronAPI.removeClaudeStreamListeners();
        }

        // Create a unique ID for this search to prevent mixing streams
        const searchId = Date.now();
        if (!this.activeClaudeSearches) {
            this.activeClaudeSearches = new Map();
        }

        // Cancel any existing search for this tab
        if (this.activeClaudeSearches.has(searchTabId)) {
            this.activeClaudeSearches.delete(searchTabId);
        }

        // Mark this search as active
        this.activeClaudeSearches.set(searchTabId, searchId);

        // Clear previous content and create containers for the response
        const searchLabel = isInception ? 'Inception Labs Mercury Search' : 'Claude AI Search';
        claudeResults.innerHTML = `
            <div class="claude-response">
                <div class="query-header">${searchLabel}: "${query}"</div>
                <div class="response-content"></div>
            </div>
        `;
        let streamedContent = '';

        if (isInception) {
            // Set up Inception Labs streaming listeners
            window.electronAPI.onInceptionStreamChunk((data) => {
                // Check if this is still the active search for this tab
                if (this.activeClaudeSearches.get(searchTabId) !== searchId) {
                    return;
                }

                const targetContent = this.tabsContent.querySelector(`[data-tab-id="${searchTabId}"] .response-content`);
                if (targetContent) {
                    streamedContent += data.text;
                    const processedContent = this.processMarkdownContent(streamedContent);
                    targetContent.innerHTML = DOMPurify.sanitize(processedContent);
                    this.attachLinkHandlersToClaudeResults(searchTabId);
                }
            });

            window.electronAPI.onInceptionStreamEnd((data) => {
                if (this.activeClaudeSearches.get(searchTabId) !== searchId) {
                    return;
                }

                const targetContent = this.tabsContent.querySelector(`[data-tab-id="${searchTabId}"] .response-content`);
                if (targetContent) {
                    const processedContent = this.processMarkdownContent(data.fullContent);
                    targetContent.innerHTML = DOMPurify.sanitize(processedContent);
                    this.attachLinkHandlersToClaudeResults(searchTabId);
                }

                if (this.activeClaudeSearches.get(searchTabId) === searchId) {
                    this.activeClaudeSearches.delete(searchTabId);
                }

                window.electronAPI.removeInceptionStreamListeners();
            });

            window.electronAPI.onInceptionStreamError((data) => {
                if (this.activeClaudeSearches.get(searchTabId) !== searchId) {
                    return;
                }

                console.error('Inception stream error:', data);
                const targetResults = this.tabsContent.querySelector(`[data-tab-id="${searchTabId}"] .tab-claude-results`);
                if (targetResults) {
                    targetResults.innerHTML = DOMPurify.sanitize(`
                        <div class="error">
                            <h2>Error</h2>
                            <p>${data.error}</p>
                            <p>Please check your Inception Labs API key in Settings.</p>
                        </div>
                    `);
                }

                if (this.activeClaudeSearches.get(searchTabId) === searchId) {
                    this.activeClaudeSearches.delete(searchTabId);
                }

                window.electronAPI.removeInceptionStreamListeners();
            });
        } else {
            // Set up Claude streaming listeners
            window.electronAPI.onClaudeStreamChunk((data) => {
                // Check if this is still the active search for this tab
                if (this.activeClaudeSearches.get(searchTabId) !== searchId) {
                    return;
                }

                // Stream chunk received
                // Always target the specific tab that initiated the search
                const targetContent = this.tabsContent.querySelector(`[data-tab-id="${searchTabId}"] .response-content`);
                if (targetContent) {
                    streamedContent += data.text;
                    // Process markdown content
                    const processedContent = this.processMarkdownContent(streamedContent);
                    targetContent.innerHTML = DOMPurify.sanitize(processedContent);

                    // Add click handlers to any new links
                    this.attachLinkHandlersToClaudeResults(searchTabId);
                } else {
                    console.error('Could not find response content element for tab:', searchTabId);
                }
            });

            window.electronAPI.onClaudeStreamEnd((data) => {
                // Check if this is still the active search for this tab
                if (this.activeClaudeSearches.get(searchTabId) !== searchId) {
                    return;
                }

                // Always target the specific tab that initiated the search
                const targetContent = this.tabsContent.querySelector(`[data-tab-id="${searchTabId}"] .response-content`);
                if (targetContent) {
                    // Final update with complete content
                    const processedContent = this.processMarkdownContent(data.fullContent);
                    targetContent.innerHTML = DOMPurify.sanitize(processedContent);

                    // Add click handlers to all links in the Claude results
                    this.attachLinkHandlersToClaudeResults(searchTabId);
                }

                // Clean up the active search tracking
                if (this.activeClaudeSearches.get(searchTabId) === searchId) {
                    this.activeClaudeSearches.delete(searchTabId);
                }

                window.electronAPI.removeClaudeStreamListeners();
            });

            window.electronAPI.onClaudeStreamError((data) => {
                // Check if this is still the active search for this tab
                if (this.activeClaudeSearches.get(searchTabId) !== searchId) {
                    return;
                }

                console.error('Claude stream error:', data);
                const targetResults = this.tabsContent.querySelector(`[data-tab-id="${searchTabId}"] .tab-claude-results`);
                if (targetResults) {
                    targetResults.innerHTML = `
                        <div class="error">
                            <h2>Error</h2>
                            <p>${data.error}</p>
                            ${data.error.includes('API') ? '<p>Please set your ANTHROPIC_API_KEY environment variable.</p>' : ''}
                        </div>
                    `;
                }

                // Clean up the active search tracking
                if (this.activeClaudeSearches.get(searchTabId) === searchId) {
                    this.activeClaudeSearches.delete(searchTabId);
                }

                window.electronAPI.removeClaudeStreamListeners();
            });
        }

        // Start the stream
        try {
            if (isInception) {
                await window.electronAPI.inceptionSearchStream(query, model);
            } else {
                await window.electronAPI.claudeSearchStream(query, model);
            }
        } catch (error) {
            console.error('Error calling search stream:', error);
            claudeResults.innerHTML = `
                <div class="error">
                    <h2>Error</h2>
                    <p>Failed to start search: ${error.message}</p>
                </div>
            `;
        }
    }
    
    goBack() {
        const tab = this.getCurrentTab();
        if (!tab) return;

        // Get the webview for the current tab
        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) return;

        const webview = content.querySelector('.tab-webview');
        if (webview) {
            // Try to use the webview's native back navigation
            try {
                webview.goBack();
                // Update navigation buttons after a short delay to let webview update
                setTimeout(() => this.updateNavigationButtons(), 100);
            } catch (error) {
                console.error('Error going back:', error);
                // Fallback to history if webview.goBack fails
                if (tab.historyIndex > 0) {
                    tab.historyIndex--;
                    const item = tab.history[tab.historyIndex];
                    this.addressBar.value = item;
                    this.navigate(true);
                }
            }
        } else if (tab.historyIndex > 0) {
            // No webview, use our history
            tab.historyIndex--;
            const item = tab.history[tab.historyIndex];
            this.addressBar.value = item;
            this.navigate(true);
        }
        this.updateNavigationButtons();
    }

    goForward() {
        const tab = this.getCurrentTab();
        if (!tab) return;

        // Get the webview for the current tab
        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) return;

        const webview = content.querySelector('.tab-webview');
        if (webview) {
            // Try to use the webview's native forward navigation
            try {
                webview.goForward();
                // Update navigation buttons after a short delay to let webview update
                setTimeout(() => this.updateNavigationButtons(), 100);
            } catch (error) {
                console.error('Error going forward:', error);
                // Fallback to history if webview.goForward fails
                if (tab.historyIndex < tab.history.length - 1) {
                    tab.historyIndex++;
                    const item = tab.history[tab.historyIndex];
                    this.addressBar.value = item;
                    this.navigate(true);
                }
            }
        } else if (tab.historyIndex < tab.history.length - 1) {
            // No webview, use our history
            tab.historyIndex++;
            const item = tab.history[tab.historyIndex];
            this.addressBar.value = item;
            this.navigate(true);
        }
        this.updateNavigationButtons();
    }
    
    selectNextTab() {
        if (this.tabs.length <= 1) return;
        
        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        const nextIndex = (currentIndex + 1) % this.tabs.length;
        this.switchToTab(this.tabs[nextIndex].id);
    }
    
    selectPreviousTab() {
        if (this.tabs.length <= 1) return;
        
        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        const prevIndex = currentIndex === 0 ? this.tabs.length - 1 : currentIndex - 1;
        this.switchToTab(this.tabs[prevIndex].id);
    }
    
    refresh() {
        const tab = this.getCurrentTab();
        if (!tab) return;
        
        if (tab.mode === 'web') {
            const content = this.getCurrentContent();
            const webview = content.querySelector('.tab-webview');
            webview.reload();
        } else if (tab.mode === 'claude' && this.addressBar.value) {
            this.navigate();
        }
    }
    
    updateNavigationButtons() {
        const tab = this.getCurrentTab();
        if (!tab) {
            this.backBtn.disabled = true;
            this.forwardBtn.disabled = true;
            return;
        }

        // Get the webview for the current tab
        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (content) {
            const webview = content.querySelector('.tab-webview');
            if (webview) {
                // Use webview's native navigation state if available
                try {
                    // Check if webview can go back
                    if (typeof webview.canGoBack === 'function') {
                        this.backBtn.disabled = !webview.canGoBack();
                    } else {
                        this.backBtn.disabled = tab.historyIndex <= 0;
                    }

                    // Check if webview can go forward
                    if (typeof webview.canGoForward === 'function') {
                        this.forwardBtn.disabled = !webview.canGoForward();
                    } else {
                        this.forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
                    }
                } catch (error) {
                    // Fallback to tab history
                    this.backBtn.disabled = tab.historyIndex <= 0;
                    this.forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
                }
            } else {
                // No webview, use tab history
                this.backBtn.disabled = tab.historyIndex <= 0;
                this.forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
            }
        } else {
            // No content, disable both buttons
            this.backBtn.disabled = true;
            this.forwardBtn.disabled = true;
        }
    }
    
    // Bookmark management methods
    toggleBookmarksBar() {
        const isHidden = this.bookmarksBar.classList.toggle('hidden');

        // Save preference to localStorage
        localStorage.setItem('bookmarksBarHidden', isHidden ? 'true' : 'false');

        // Sync state with main process
        window.electronAPI.setBookmarksBarVisible(!isHidden);

        // Show notification
        this.showNotification(
            isHidden ? 'Bookmarks bar hidden' : 'Bookmarks bar shown',
            'info'
        );
    }
    
    loadBookmarksBarVisibility() {
        // Load saved visibility preference
        const isHidden = localStorage.getItem('bookmarksBarHidden') === 'true';
        if (isHidden) {
            this.bookmarksBar.classList.add('hidden');
        } else {
            this.bookmarksBar.classList.remove('hidden');
        }

        // Sync state with main process
        window.electronAPI.setBookmarksBarVisible(!isHidden);
    }
    
    loadBookmarks() {
        try {
            const saved = localStorage.getItem('bookmarks');
            if (saved) {
                this.bookmarks = JSON.parse(saved);
                this.renderBookmarks();
            } else {
                this.bookmarks = [];
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.bookmarks = [];
        }
    }
    
    saveBookmarks() {
        try {
            const bookmarksJson = JSON.stringify(this.bookmarks);
            localStorage.setItem('bookmarks', bookmarksJson);
            
            // Verify the save
            const saved = localStorage.getItem('bookmarks');
            if (saved !== bookmarksJson) {
                console.error('Bookmark save verification failed!');
            }
        } catch (error) {
            console.error('Error saving bookmarks:', error);
        }
    }
    
    addBookmark(url, title, favicon, tags = [], description = '') {
        // Check if bookmark already exists
        if (this.bookmarks.find(b => b.url === url)) {
            // Update existing bookmark with new data
            const existingIndex = this.bookmarks.findIndex(b => b.url === url);
            const existing = this.bookmarks[existingIndex];

            // Update tags and description if provided
            if (tags.length > 0) {
                existing.tags = tags;
            }
            if (description) {
                existing.description = description;
            }

            // Update favicon if provided and different
            if (favicon && favicon !== existing.favicon) {
                existing.favicon = favicon;
            }

            // Update title if it was generic before
            if (title && (existing.title === url || existing.title.startsWith('http'))) {
                existing.title = title;
            }

            this.saveBookmarks();
            this.renderBookmarks();
            return;
        }
        
        const bookmark = {
            url: url,
            title: title || this.getTitleFromURL(url),
            favicon: favicon || null,
            tags: tags,
            description: description,
            id: Date.now()
        };
        
        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.renderBookmarks();
    }
    
    removeBookmark(id) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        this.saveBookmarks();
        this.renderBookmarks();
    }
    
    updateTagFilter() {
        // Collect all unique tags from bookmarks
        const allTags = new Set();
        this.bookmarks.forEach(bookmark => {
            if (bookmark.tags && Array.isArray(bookmark.tags)) {
                bookmark.tags.forEach(tag => allTags.add(tag));
            }
        });
        
        // Sort tags alphabetically
        const sortedTags = Array.from(allTags).sort();
        
        // Preserve current selection
        const currentValue = this.tagFilter.value;
        
        // Rebuild options
        this.tagFilter.innerHTML = '<option value="">All bookmarks</option>';
        sortedTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            if (tag === currentValue) {
                option.selected = true;
            }
            this.tagFilter.appendChild(option);
        });
        
        // Add count to "All bookmarks" option
        const allOption = this.tagFilter.querySelector('option[value=""]');
        allOption.textContent = `All bookmarks (${this.bookmarks.length})`;
        
        // Add counts to tag options
        this.tagFilter.querySelectorAll('option').forEach(option => {
            if (option.value) {
                const count = this.bookmarks.filter(b => 
                    b.tags && b.tags.includes(option.value)
                ).length;
                option.textContent = `${option.value} (${count})`;
            }
        });
    }
    
    renameBookmark(bookmark) {
        // Find the bookmark element
        const bookmarkEl = this.bookmarksContainer.querySelector(`[data-bookmark-id="${bookmark.id}"]`);
        if (!bookmarkEl) return;
        
        // Replace the bookmark content with an input field
        const originalHTML = bookmarkEl.innerHTML;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = bookmark.title;
        input.style.width = '100%';
        input.style.padding = '2px 4px';
        input.style.fontSize = '13px';
        input.style.border = '1px solid #4CAF50';
        input.style.borderRadius = '3px';
        
        bookmarkEl.innerHTML = '';
        bookmarkEl.appendChild(input);
        input.focus();
        input.select();
        
        const saveRename = () => {
            const newName = input.value.trim();
            if (newName && newName !== bookmark.title) {
                const bookmarkIndex = this.bookmarks.findIndex(b => b.id === bookmark.id);
                if (bookmarkIndex !== -1) {
                    this.bookmarks[bookmarkIndex].title = newName;
                    this.saveBookmarks();
                    this.renderBookmarks();
                }
            } else {
                bookmarkEl.innerHTML = originalHTML;
            }
        };
        
        const cancelRename = () => {
            bookmarkEl.innerHTML = originalHTML;
        };
        
        input.addEventListener('blur', saveRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveRename();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
            }
        });
    }
    
    renderBookmarks() {
        this.bookmarksContainer.innerHTML = '';

        // Create context menu if it doesn't exist
        if (!this.contextMenu) {
            this.createContextMenu();
        }

        // Update tag filter dropdown
        this.updateTagFilter();

        // Update the application menu with bookmarks
        if (window.electronAPI && window.electronAPI.updateBookmarksMenu) {
            window.electronAPI.updateBookmarksMenu(this.bookmarks);
        }
        
        // Filter bookmarks based on selected tag
        const bookmarksToShow = this.currentTagFilter 
            ? this.bookmarks.filter(b => b.tags && b.tags.includes(this.currentTagFilter))
            : this.bookmarks;
        
        bookmarksToShow.forEach(bookmark => {
            const bookmarkEl = document.createElement('div');
            bookmarkEl.className = 'bookmark';
            bookmarkEl.dataset.bookmarkId = bookmark.id;
            
            const faviconHtml = bookmark.favicon 
                ? `<img class="bookmark-favicon" src="${bookmark.favicon}" onerror="this.style.display='none'">`
                : '';
            
            // Build tooltip content if tags or description exist
            let tooltipContent = bookmark.title;
            if (bookmark.description) {
                tooltipContent += '\n\n' + bookmark.description;
            }
            if (bookmark.tags && bookmark.tags.length > 0) {
                tooltipContent += '\n\nTags: ' + bookmark.tags.join(', ');
            }
            
            // Build tag chips HTML (show first 2 tags inline)
            let tagChipsHtml = '';
            if (bookmark.tags && bookmark.tags.length > 0) {
                const tagsToShow = bookmark.tags.slice(0, 2);
                tagChipsHtml = tagsToShow.map(tag => 
                    `<span class="bookmark-tag">${tag}</span>`
                ).join('');
                if (bookmark.tags.length > 2) {
                    tagChipsHtml += `<span class="bookmark-tag-more">+${bookmark.tags.length - 2}</span>`;
                }
            }
            
            bookmarkEl.innerHTML = `
                ${faviconHtml}
                <span class="bookmark-title">${bookmark.title}</span>
                ${tagChipsHtml ? `<div class="bookmark-tags">${tagChipsHtml}</div>` : ''}
            `;
            
            // Add enhanced tooltip
            bookmarkEl.title = tooltipContent;
            
            // Add visual indicator if bookmark has tags/description
            if ((bookmark.tags && bookmark.tags.length > 0) || bookmark.description) {
                bookmarkEl.classList.add('has-metadata');
            }
            
            // Regular click to navigate
            bookmarkEl.addEventListener('click', async (e) => {
                // Check if this is an automation bookmark
                if (bookmark.isAutomation && bookmark.automationId) {
                    e.preventDefault();

                    const automation = this.savedAutomations.find(a => a.id === bookmark.automationId);
                    if (automation) {
                        // Always create a fresh automation window for bookmarks
                        await this.playAutomationInNewWindow(automation);
                    } else {
                        console.error('Automation not found. Available IDs:', this.savedAutomations.map(a => a.id));
                        this.showNotification('Automation not found', 'error');
                    }
                    return;
                }

                // Check if shift is held for context menu
                if (e.shiftKey) {
                    e.preventDefault();
                    this.showContextMenu(e, bookmark);
                }
                // Check if Command/Ctrl is held to open in new tab
                else if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    this.createTab(bookmark.url);
                }
                // Regular click navigates in current tab
                else {
                    this.addressBar.value = bookmark.url;
                    this.navigate();
                }
            });
            
            // Right-click for context menu
            bookmarkEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, bookmark);
            });
            
            this.bookmarksContainer.appendChild(bookmarkEl);
        });

        // Update scroll button visibility after rendering
        this.updateBookmarkScrollButtons();
    }

    updateBookmarkScrollButtons() {
        if (!this.bookmarksContainer || !this.bookmarksScrollLeft || !this.bookmarksScrollRight) return;

        const { scrollLeft, scrollWidth, clientWidth } = this.bookmarksContainer;

        // Hide left button if at the start
        if (scrollLeft <= 0) {
            this.bookmarksScrollLeft.classList.add('hidden');
        } else {
            this.bookmarksScrollLeft.classList.remove('hidden');
        }

        // Hide right button if at the end
        if (scrollLeft + clientWidth >= scrollWidth - 1) {
            this.bookmarksScrollRight.classList.add('hidden');
        } else {
            this.bookmarksScrollRight.classList.remove('hidden');
        }
    }

    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'bookmark-context-menu';
        document.body.appendChild(this.contextMenu);
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    }
    
    showContextMenu(e, bookmark) {
        this.contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="new-tab">Open in New Tab</div>
            <div class="context-menu-item" data-action="new-window">Open in New Window</div>
            <div class="context-menu-item" data-action="rename">Rename</div>
            <div class="context-menu-item delete" data-action="delete">Delete Bookmark</div>
        `;
        
        // Position menu at cursor
        this.contextMenu.style.left = e.pageX + 'px';
        this.contextMenu.style.top = e.pageY + 'px';
        this.contextMenu.classList.add('visible');
        
        // Add click handlers
        this.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.dataset.action;
                
                switch(action) {
                    case 'new-tab':
                        // Create new tab and navigate to the bookmark URL
                        const newTabId = this.createTab();
                        // Wait a moment for tab to be ready, then navigate
                        setTimeout(() => {
                            this.switchToTab(newTabId);
                            this.addressBar.value = bookmark.url;
                            this.navigate();
                        }, 100);
                        break;
                    case 'new-window':
                        // Pass URL to new window
                        await window.electronAPI.newWindowWithUrl(bookmark.url);
                        break;
                    case 'rename':
                        this.renameBookmark(bookmark);
                        break;
                    case 'delete':
                        this.removeBookmark(bookmark.id);
                        break;
                }
                
                this.hideContextMenu();
            });
        });
    }
    
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.remove('visible');
        }
    }
    
    setupTabDragAndDrop(tabElement, tabId) {
        let dragStartX = 0;
        let dragStartY = 0;
        
        tabElement.addEventListener('dragstart', (e) => {
            this.draggedTab = tabElement;
            this.draggedTabId = tabId;
            tabElement.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', tabElement.innerHTML);
            
            // Store the starting position
            dragStartX = e.screenX;
            dragStartY = e.screenY;
        });
        
        tabElement.addEventListener('dragend', async (e) => {
            tabElement.style.opacity = '';
            
            // Check if the tab was dragged far from its starting position (indicating drag out of window)
            const dragDistance = Math.sqrt(Math.pow(e.screenX - dragStartX, 2) + Math.pow(e.screenY - dragStartY, 2));
            
            // If dragged more than 100 pixels and we have more than one tab, create new window
            if (dragDistance > 100 && this.tabs.length > 1 && this.draggedTab) {
                const tab = this.tabs.find(t => t.id === this.draggedTabId);
                if (tab && tab.url) {
                    // Check if the drag ended outside the window bounds
                    const windowBounds = document.body.getBoundingClientRect();
                    const isOutsideWindow = e.clientX < 0 || e.clientY < 0 || 
                                           e.clientX > windowBounds.width || 
                                           e.clientY > windowBounds.height;
                    
                    if (isOutsideWindow) {
                        // Create new window with the tab's URL
                        await window.electronAPI.newWindowWithUrl(tab.url);
                        // Close the tab in this window
                        this.closeTab(this.draggedTabId);
                    }
                }
            }
            
            this.draggedTab = null;
            this.draggedTabId = null;
            
            // Remove any drag-over classes
            this.tabsContainer.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('drag-over');
            });
        });
        
        tabElement.addEventListener('dragover', (e) => {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = this.getDragAfterElement(this.tabsContainer, e.clientX);
            if (afterElement == null) {
                tabElement.classList.add('drag-over');
            }
            
            return false;
        });
        
        tabElement.addEventListener('dragleave', (e) => {
            tabElement.classList.remove('drag-over');
        });
        
        tabElement.addEventListener('drop', (e) => {
            if (e.stopPropagation) {
                e.stopPropagation();
            }

            if (this.draggedTab && this.draggedTab !== tabElement) {
                // Get the tab IDs
                const draggedTabId = this.draggedTabId;
                const targetTabId = parseInt(tabElement.dataset.tabId);

                // Find tabs
                const draggedTab = this.tabs.find(t => t.id === draggedTabId);
                const targetTab = this.tabs.find(t => t.id === targetTabId);

                // Check pinned tab restrictions
                if (draggedTab && targetTab) {
                    // Can't move pinned tab after non-pinned tab
                    if (draggedTab.isPinned && !targetTab.isPinned) {
                        tabElement.classList.remove('drag-over');
                        return false;
                    }
                    // Can't move non-pinned tab before pinned tab
                    if (!draggedTab.isPinned && targetTab.isPinned) {
                        // Find the last pinned tab and place after it
                        let lastPinnedIndex = -1;
                        for (let i = 0; i < this.tabs.length; i++) {
                            if (this.tabs[i].isPinned) {
                                lastPinnedIndex = i;
                            }
                        }

                        if (lastPinnedIndex >= 0) {
                            const draggedIndex = this.tabs.findIndex(t => t.id === draggedTabId);
                            if (draggedIndex !== -1) {
                                // Move after last pinned tab
                                const [draggedTabData] = this.tabs.splice(draggedIndex, 1);
                                this.tabs.splice(lastPinnedIndex, 0, draggedTabData);

                                // Move DOM element after last pinned tab
                                const lastPinnedElement = this.tabsContainer.querySelectorAll('.tab')[lastPinnedIndex];
                                if (lastPinnedElement) {
                                    lastPinnedElement.parentNode.insertBefore(this.draggedTab, lastPinnedElement.nextSibling);
                                }
                            }
                        }
                        tabElement.classList.remove('drag-over');
                        return false;
                    }
                }

                // Find indices in the tabs array
                const draggedIndex = this.tabs.findIndex(t => t.id === draggedTabId);
                const targetIndex = this.tabs.findIndex(t => t.id === targetTabId);

                if (draggedIndex !== -1 && targetIndex !== -1) {
                    // Reorder tabs array
                    const [draggedTabData] = this.tabs.splice(draggedIndex, 1);
                    this.tabs.splice(targetIndex, 0, draggedTabData);

                    // Reorder DOM elements
                    if (draggedIndex < targetIndex) {
                        tabElement.parentNode.insertBefore(this.draggedTab, tabElement.nextSibling);
                    } else {
                        tabElement.parentNode.insertBefore(this.draggedTab, tabElement);
                    }
                }
            }

            tabElement.classList.remove('drag-over');
            return false;
        });
    }
    
    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.tab:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async groupSimilarTabs() {
        if (this.tabs.length < 2) {
            this.showNotification('Not enough tabs to group', 'info');
            return;
        }

        // Get the selected model
        const modelSelect = document.getElementById('model-select');
        const selectedModel = modelSelect ? modelSelect.value : 'claude-3-5-haiku-20241022';
        const isInception = selectedModel === 'mercury';
        const aiName = isInception ? 'Inception Labs Mercury' : 'Claude AI';

        this.showNotification(`Using ${aiName} to intelligently group your tabs...`, 'info');

        try {
            // First extract content from all tabs
            const tabsWithContent = await this.extractTabContent();

            // Prepare data for AI - include title, URL, and content snippets
            const tabsData = tabsWithContent.map((tabInfo, index) => ({
                index: index,
                title: tabInfo.tab.title || 'Untitled',
                url: tabInfo.tab.url || '',
                description: tabInfo.meta.description || '',
                keywords: tabInfo.keywords.slice(0, 10), // Top 10 keywords
                contentSnippet: tabInfo.content.substring(0, 500), // First 500 chars of content
                headings: tabInfo.headings.slice(0, 5) // First 5 headings
            }));

            // Call AI API for intelligent grouping
            const result = await window.electronAPI.groupTabsWithClaude(tabsData, selectedModel);

            if (result.error) {
                this.showNotification(`Error: ${result.error}`, 'error');
                console.error('AI grouping error:', result.error);
                // Fall back to local grouping
                this.fallbackToLocalGrouping(tabsWithContent);
                return;
            }

            if (result.groups && result.groups.length > 0) {
                // Convert AI's groups format to our internal format
                const tabGroups = result.groups.map(group => ({
                    members: group.tabIndices,
                    name: group.name,
                    description: group.description,
                    color: group.suggestedColor
                }));


                // Animate the tab reorganization
                this.animateTabGrouping(tabGroups);

                // Update notification with grouping info
                setTimeout(() => {
                    const groupNames = result.groups.map(g => `${g.name} (${g.tabIndices.length})`).join(', ');
                    this.showNotification(`Grouped into: ${groupNames}`, 'success');
                }, 1000);
            } else {
                this.showNotification('No groups could be created', 'info');
            }
        } catch (error) {
            console.error('Tab grouping error:', error);
            this.showNotification('Error grouping tabs. Trying local method...', 'error');
            // Fall back to local grouping
            const tabsWithContent = await this.extractTabContent();
            this.fallbackToLocalGrouping(tabsWithContent);
        }
    }

    fallbackToLocalGrouping(tabsWithContent) {
        // Use the original local grouping method as fallback
        const tabGroups = this.calculateTabSimilaritiesWithContent(tabsWithContent);
        this.animateTabGrouping(tabGroups);

        setTimeout(() => {
            const categoryCount = {};
            tabsWithContent.forEach(tabInfo => {
                if (tabInfo.category) {
                    categoryCount[tabInfo.category] = (categoryCount[tabInfo.category] || 0) + 1;
                }
            });

            const categoryInfo = Object.entries(categoryCount)
                .map(([cat, count]) => `${count} ${cat}`)
                .join(', ');

            const message = categoryInfo
                ? `Grouped ${this.tabs.length} tabs into ${tabGroups.length} groups (${categoryInfo})`
                : `Grouped ${this.tabs.length} tabs into ${tabGroups.length} groups`;

            this.showNotification(message + ' (local fallback)', 'success');
        }, 1000);
    }

    async extractTabContent() {
        const tabsWithContent = [];

        for (let i = 0; i < this.tabs.length; i++) {
            const tab = this.tabs[i];
            const tabInfo = {
                index: i,
                tab: tab,
                content: '',
                keywords: [],
                headings: [],
                meta: {},
                category: null,
                topics: []
            };

            // Only extract content from web tabs with webviews
            if (tab.mode === 'web' && tab.url && !tab.url.startsWith('claude://')) {
                const content = this.tabsContent.querySelector(`[data-tab-id="${tab.id}"]`);
                const webview = content?.querySelector('.tab-webview');

                if (webview) {
                    try {
                        // Extract page content
                        const extractedData = await webview.executeJavaScript(`
                            (() => {
                                const data = {
                                    title: document.title,
                                    description: document.querySelector('meta[name="description"]')?.content || '',
                                    keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                                    headings: [],
                                    text: '',
                                    links: []
                                };

                                // Get all headings
                                const headings = document.querySelectorAll('h1, h2, h3');
                                headings.forEach(h => {
                                    const text = h.textContent.trim();
                                    if (text) data.headings.push(text);
                                });

                                // Get main text content (limit to prevent memory issues)
                                const textElements = document.querySelectorAll('p, li, span, div');
                                let textContent = '';
                                for (let i = 0; i < Math.min(textElements.length, 100); i++) {
                                    const text = textElements[i].textContent.trim();
                                    if (text.length > 20 && text.length < 200) {
                                        textContent += text + ' ';
                                        if (textContent.length > 2000) break;
                                    }
                                }
                                data.text = textContent;

                                // Get some links for context
                                const links = document.querySelectorAll('a[href]');
                                for (let i = 0; i < Math.min(links.length, 20); i++) {
                                    const text = links[i].textContent.trim();
                                    if (text) data.links.push(text);
                                }

                                return data;
                            })()
                        `);

                        tabInfo.content = extractedData.text || '';
                        tabInfo.headings = extractedData.headings || [];
                        tabInfo.meta = {
                            description: extractedData.description || '',
                            keywords: extractedData.keywords || ''
                        };

                        // Extract keywords from content
                        tabInfo.keywords = this.extractContentKeywords(
                            tabInfo.content + ' ' +
                            tabInfo.headings.join(' ') + ' ' +
                            tabInfo.meta.description
                        );

                        // Detect category and topics
                        tabInfo.category = this.detectCategory(tab.url, tab.title, tabInfo.keywords, tabInfo.content);
                        tabInfo.topics = this.detectTopics(tabInfo.keywords, tabInfo.headings, tabInfo.content);

                    } catch (error) {
                        console.error('Could not extract content from tab:', tab.url, error);
                    }
                }
            }

            // Even for tabs without content, try to detect category from URL/title
            if (!tabInfo.category && tab.url) {
                tabInfo.category = this.detectCategory(tab.url, tab.title, [], '');
            }

            tabsWithContent.push(tabInfo);
        }

        return tabsWithContent;
    }

    detectCategory(url, title, keywords, content) {
        const lowerUrl = (url || '').toLowerCase();
        const lowerTitle = (title || '').toLowerCase();
        const keywordString = keywords.join(' ').toLowerCase();
        const lowerContent = (content || '').toLowerCase();

        // Define category patterns
        const categoryPatterns = {
            'sports': {
                domains: ['espn', 'sports.yahoo', 'nfl', 'nba', 'mlb', 'nhl', 'fifa', 'uefa', 'bleacherreport', 'thescore', 'sportsillustrated', 'theathletic'],
                keywords: ['sports', 'game', 'score', 'player', 'team', 'match', 'league', 'championship', 'tournament', 'football', 'basketball', 'baseball', 'soccer', 'hockey', 'tennis', 'golf', 'athlete', 'coach', 'stadium'],
                titlePatterns: ['scores', 'game', 'vs', 'defeats', 'wins', 'championship', 'cup', 'league']
            },
            'news': {
                domains: ['cnn', 'bbc', 'reuters', 'bloomberg', 'wsj', 'nytimes', 'washingtonpost', 'theguardian', 'apnews', 'npr', 'foxnews', 'msnbc', 'politico'],
                keywords: ['news', 'breaking', 'latest', 'report', 'analysis', 'politics', 'election', 'government', 'president', 'minister', 'policy', 'economy', 'market'],
                titlePatterns: ['breaking', 'news', 'report', 'analysis', 'latest']
            },
            'technology': {
                domains: ['github', 'gitlab', 'bitbucket', 'stackoverflow', 'techcrunch', 'verge', 'wired', 'arstechnica', 'engadget', 'gizmodo', 'hackernews', 'ycombinator', 'reddit.com/r/programming', 'dev.to', 'medium.com/@', 'npmjs', 'pypi', 'rubygems', 'packagist', 'crates.io', 'nuget', 'maven', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'digitalocean', 'heroku', 'netlify', 'vercel', 'cloudflare', 'mozilla', 'webkit', 'chromium', 'w3.org', 'whatwg', 'tech', 'zdnet', 'cnet', 'macrumors', '9to5mac', 'androidauthority', 'xda-developers', 'developer', 'developers', 'docs', 'documentation', 'api', 'sdk', 'framework', 'library', '.dev', '.io', 'code', 'coding', 'programming', 'software', 'hardware', 'gadget', 'android', 'ios', 'linux', 'windows', 'mac', 'ubuntu', 'fedora', 'debian', 'arch', 'opensource', 'react', 'angular', 'vue', 'svelte', 'nextjs', 'nodejs', 'django', 'flask', 'rails', 'laravel', 'spring'],
                keywords: ['code', 'programming', 'software', 'developer', 'development', 'api', 'framework', 'javascript', 'typescript', 'python', 'java', 'rust', 'go', 'ruby', 'php', 'swift', 'kotlin', 'react', 'angular', 'vue', 'node', 'deno', 'git', 'tech', 'technology', 'startup', 'app', 'application', 'digital', 'ai', 'machine learning', 'ml', 'deep learning', 'neural', 'algorithm', 'data', 'database', 'cloud', 'server', 'frontend', 'backend', 'fullstack', 'devops', 'cicd', 'docker', 'kubernetes', 'microservices', 'web', 'mobile', 'desktop', 'open source', 'library', 'package', 'module', 'function', 'class', 'method', 'variable', 'debug', 'test', 'deploy', 'build', 'compile'],
                titlePatterns: ['api', 'sdk', 'tutorial', 'guide', 'documentation', 'docs', 'release', 'update', 'v[0-9]', 'beta', 'alpha', 'rc', 'changelog', 'roadmap', 'getting started', 'how to', 'introduction', 'reference', 'examples', 'quickstart', 'install', 'setup', 'configure', 'blog', 'engineering']
            },
            'shopping': {
                domains: ['amazon', 'ebay', 'walmart', 'target', 'bestbuy', 'newegg', 'alibaba', 'etsy', 'wayfair', 'shopify', 'store'],
                keywords: ['buy', 'price', 'cart', 'checkout', 'shipping', 'product', 'shop', 'sale', 'discount', 'deal', 'order', 'purchase', 'review', 'rating'],
                titlePatterns: ['buy', 'shop', 'sale', 'deal', 'price', '$']
            },
            'social': {
                domains: ['facebook', 'twitter', 'instagram', 'linkedin', 'reddit', 'pinterest', 'tiktok', 'snapchat', 'discord', 'slack'],
                keywords: ['post', 'share', 'like', 'comment', 'follow', 'friend', 'social', 'profile', 'status', 'tweet', 'message'],
                titlePatterns: ['profile', 'posts', 'timeline', 'feed']
            },
            'entertainment': {
                domains: ['youtube', 'netflix', 'hulu', 'spotify', 'twitch', 'imdb', 'rottentomatoes', 'metacritic', 'soundcloud', 'vimeo'],
                keywords: ['video', 'movie', 'show', 'series', 'episode', 'music', 'song', 'album', 'artist', 'watch', 'stream', 'entertainment', 'film', 'trailer'],
                titlePatterns: ['watch', 'episode', 'season', 'trailer', 'official']
            },
            'education': {
                domains: ['edu', 'coursera', 'udemy', 'khanacademy', 'edx', 'wikipedia', 'britannica', 'scholar.google', 'jstor', 'pubmed'],
                keywords: ['learn', 'course', 'tutorial', 'education', 'study', 'research', 'academic', 'university', 'school', 'lecture', 'lesson', 'knowledge', 'theory'],
                titlePatterns: ['course', 'tutorial', 'learn', 'guide', 'education', 'lesson']
            },
            'finance': {
                domains: ['bank', 'chase', 'wellsfargo', 'paypal', 'venmo', 'coinbase', 'robinhood', 'etrade', 'fidelity', 'schwab', 'mint', 'quicken'],
                keywords: ['money', 'finance', 'bank', 'investment', 'stock', 'crypto', 'bitcoin', 'trading', 'portfolio', 'account', 'payment', 'transaction', 'budget'],
                titlePatterns: ['bank', 'investment', 'trading', 'finance', 'stock', 'crypto']
            }
        };

        // Score each category
        let bestCategory = null;
        let bestScore = 0;

        for (const [category, patterns] of Object.entries(categoryPatterns)) {
            let score = 0;

            // Check domain patterns
            for (const domain of patterns.domains) {
                if (lowerUrl.includes(domain)) {
                    score += 3; // Strong signal
                }
            }

            // Check keyword patterns
            for (const keyword of patterns.keywords) {
                if (keywordString.includes(keyword) || lowerContent.includes(keyword)) {
                    score += 1;
                }
            }

            // Check title patterns
            for (const pattern of patterns.titlePatterns) {
                if (pattern.startsWith('v[0-9]')) {
                    // Special case for version patterns
                    if (/v\d+/.test(lowerTitle)) {
                        score += 2;
                    }
                } else if (lowerTitle.includes(pattern)) {
                    score += 2;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestCategory = category;
            }
        }

        // Only return category if score is significant (lowered threshold for better detection)
        return bestScore >= 2 ? bestCategory : null;
    }

    detectTopics(keywords, headings, content) {
        const topics = new Set();

        // Common topic patterns
        const topicPatterns = {
            'football': ['nfl', 'football', 'quarterback', 'touchdown', 'superbowl'],
            'basketball': ['nba', 'basketball', 'lakers', 'celtics', 'lebron', 'curry'],
            'baseball': ['mlb', 'baseball', 'yankees', 'pitcher', 'homerun'],
            'soccer': ['soccer', 'fifa', 'world cup', 'premier league', 'champions league'],
            'politics': ['election', 'president', 'congress', 'senate', 'democrat', 'republican'],
            'business': ['company', 'ceo', 'earnings', 'revenue', 'market', 'ipo'],
            'health': ['health', 'medical', 'doctor', 'treatment', 'disease', 'vaccine'],
            'climate': ['climate', 'environment', 'carbon', 'renewable', 'sustainability'],
            'ai': ['artificial intelligence', 'machine learning', 'neural', 'gpt', 'llm'],
            'crypto': ['bitcoin', 'ethereum', 'blockchain', 'defi', 'nft', 'cryptocurrency'],
            'gaming': ['game', 'playstation', 'xbox', 'nintendo', 'steam', 'esports']
        };

        const allText = [...keywords, ...headings].join(' ').toLowerCase();

        for (const [topic, patterns] of Object.entries(topicPatterns)) {
            for (const pattern of patterns) {
                if (allText.includes(pattern)) {
                    topics.add(topic);
                    break;
                }
            }
        }

        return Array.from(topics);
    }

    extractContentKeywords(text) {
        if (!text) return [];

        // Convert to lowercase and split into words
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);

        // Count word frequency
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        // Get top keywords (words that appear multiple times)
        return Object.entries(wordFreq)
            .filter(([word, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([word]) => word);
    }

    calculateTabSimilaritiesWithContent(tabsWithContent) {
        const groups = [];
        const processedTabs = new Set();

        for (let i = 0; i < tabsWithContent.length; i++) {
            if (processedTabs.has(i)) continue;

            const currentTabInfo = tabsWithContent[i];
            const group = {
                primary: i,
                members: [i],
                domain: this.extractDomain(currentTabInfo.tab.url),
                title: currentTabInfo.tab.title,
                commonKeywords: currentTabInfo.keywords
            };

            // Find similar tabs
            for (let j = i + 1; j < tabsWithContent.length; j++) {
                if (processedTabs.has(j)) continue;

                const otherTabInfo = tabsWithContent[j];
                const similarity = this.calculateEnhancedSimilarity(currentTabInfo, otherTabInfo);

                // Debug: Log similarity scores for debugging
                if (similarity > 0.2) {
                }

                if (similarity > 0.3) { // Lower threshold to group more tabs with same category
                    group.members.push(j);
                    processedTabs.add(j);

                    // Update common keywords
                    group.commonKeywords = group.commonKeywords.filter(k =>
                        otherTabInfo.keywords.includes(k)
                    );
                }
            }

            processedTabs.add(i);
            groups.push(group);
        }

        // Sort groups by size (larger groups first)
        groups.sort((a, b) => b.members.length - a.members.length);

        return groups;
    }

    calculateEnhancedSimilarity(tabInfo1, tabInfo2) {
        let score = 0;
        const tab1 = tabInfo1.tab;
        const tab2 = tabInfo2.tab;

        // Same category = very high similarity (e.g., ESPN and Yahoo Sports)
        if (tabInfo1.category && tabInfo2.category && tabInfo1.category === tabInfo2.category) {
            score += 0.5; // Strong base score for same category
        }

        // Same domain = high similarity
        const domain1 = this.extractDomain(tab1.url);
        const domain2 = this.extractDomain(tab2.url);

        if (domain1 && domain2 && domain1 === domain2) {
            score += 0.3; // Reduced since category is more important
        }

        // Common topics
        if (tabInfo1.topics.length > 0 && tabInfo2.topics.length > 0) {
            const commonTopics = tabInfo1.topics.filter(t => tabInfo2.topics.includes(t));
            if (commonTopics.length > 0) {
                score += 0.2 * (commonTopics.length / Math.max(tabInfo1.topics.length, tabInfo2.topics.length));
            }
        }

        // Similar titles
        if (tab1.title && tab2.title) {
            const titleSimilarity = this.calculateStringSimilarity(
                tab1.title.toLowerCase(),
                tab2.title.toLowerCase()
            );
            score += titleSimilarity * 0.15;
        }

        // Content keyword similarity
        if (tabInfo1.keywords.length > 0 && tabInfo2.keywords.length > 0) {
            const commonKeywords = tabInfo1.keywords.filter(k => tabInfo2.keywords.includes(k));
            const keywordSimilarity = commonKeywords.length /
                Math.min(tabInfo1.keywords.length, tabInfo2.keywords.length);
            score += keywordSimilarity * 0.15;
        }

        // Heading similarity
        if (tabInfo1.headings.length > 0 && tabInfo2.headings.length > 0) {
            const headingSimilarity = this.calculateArraySimilarity(
                tabInfo1.headings,
                tabInfo2.headings
            );
            score += headingSimilarity * 0.05;
        }

        // URL path similarity
        const urlKeywords1 = this.extractKeywords(tab1.url);
        const urlKeywords2 = this.extractKeywords(tab2.url);
        const commonUrlKeywords = urlKeywords1.filter(k => urlKeywords2.includes(k));
        if (commonUrlKeywords.length > 0) {
            score += 0.05 * Math.min(commonUrlKeywords.length / Math.max(urlKeywords1.length, urlKeywords2.length), 1);
        }

        return Math.min(score, 1); // Cap at 1
    }

    calculateArraySimilarity(arr1, arr2) {
        const set1 = new Set(arr1.map(s => s.toLowerCase()));
        const set2 = new Set(arr2.map(s => s.toLowerCase()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    calculateTabSimilarities() {
        const groups = [];
        const processedTabs = new Set();

        for (let i = 0; i < this.tabs.length; i++) {
            if (processedTabs.has(i)) continue;

            const currentTab = this.tabs[i];
            const group = {
                primary: i,
                members: [i],
                domain: this.extractDomain(currentTab.url),
                title: currentTab.title
            };

            // Find similar tabs
            for (let j = i + 1; j < this.tabs.length; j++) {
                if (processedTabs.has(j)) continue;

                const otherTab = this.tabs[j];
                const similarity = this.calculateSimilarity(currentTab, otherTab);

                if (similarity > 0.5) { // Threshold for similarity
                    group.members.push(j);
                    processedTabs.add(j);
                }
            }

            processedTabs.add(i);
            groups.push(group);
        }

        // Sort groups by size (larger groups first)
        groups.sort((a, b) => b.members.length - a.members.length);

        return groups;
    }

    calculateSimilarity(tab1, tab2) {
        let score = 0;

        // Same domain = high similarity
        const domain1 = this.extractDomain(tab1.url);
        const domain2 = this.extractDomain(tab2.url);

        if (domain1 && domain2 && domain1 === domain2) {
            score += 0.6;
        }

        // Similar titles
        if (tab1.title && tab2.title) {
            const titleSimilarity = this.calculateStringSimilarity(
                tab1.title.toLowerCase(),
                tab2.title.toLowerCase()
            );
            score += titleSimilarity * 0.3;
        }

        // Check for common keywords in URL
        const urlKeywords1 = this.extractKeywords(tab1.url);
        const urlKeywords2 = this.extractKeywords(tab2.url);
        const commonKeywords = urlKeywords1.filter(k => urlKeywords2.includes(k));
        if (commonKeywords.length > 0) {
            score += 0.1 * Math.min(commonKeywords.length / Math.max(urlKeywords1.length, urlKeywords2.length), 1);
        }

        return score;
    }

    extractDomain(url) {
        try {
            if (!url || url === 'about:blank' || url.startsWith('claude://')) {
                return null;
            }
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
            return null;
        }
    }

    extractKeywords(url) {
        if (!url) return [];

        // Extract path and query parts
        try {
            const urlObj = new URL(url);
            const pathAndQuery = urlObj.pathname + urlObj.search;

            // Split by common separators and filter
            const keywords = pathAndQuery
                .split(/[\/\-\_\?\&\=\.]/)
                .filter(k => k.length > 2 && !/^\d+$/.test(k))
                .map(k => k.toLowerCase());

            return [...new Set(keywords)]; // Remove duplicates
        } catch (e) {
            return [];
        }
    }

    calculateStringSimilarity(str1, str2) {
        // Simple Jaccard similarity based on words
        const words1 = new Set(str1.split(/\s+/));
        const words2 = new Set(str2.split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    animateTabGrouping(groups) {
        // Remember the current active tab
        const activeTabId = this.activeTab;

        // Build new tab order and track group membership
        const newTabOrder = [];
        const tabToGroup = new Map();
        const groupInfo = new Map(); // Store group names and colors

        groups.forEach((group, groupIndex) => {
            group.members.forEach(tabIndex => {
                const tab = this.tabs[tabIndex];
                newTabOrder.push(tab);
                tabToGroup.set(tab.id, groupIndex);
                // Store group info for later use
                if (group.name || group.color) {
                    groupInfo.set(groupIndex, {
                        name: group.name,
                        color: group.color
                    });
                }
            });
        });

        // Reorganize tabs array
        this.tabs = newTabOrder;

        // Also reorder the content divs to match the new tab order
        const contentContainer = this.tabsContent;
        newTabOrder.forEach((tab) => {
            const contentDiv = contentContainer.querySelector(`[data-tab-id="${tab.id}"]`);
            if (contentDiv) {
                contentContainer.appendChild(contentDiv);
            }
        });

        // Animate the visual reorganization
        const tabElements = this.tabsContainer.querySelectorAll('.tab');
        const positions = new Map();

        // Store current positions
        tabElements.forEach(tabEl => {
            const rect = tabEl.getBoundingClientRect();
            positions.set(parseInt(tabEl.dataset.tabId), {
                element: tabEl,
                startX: rect.left
            });
        });

        // Apply new order to DOM
        this.tabs.forEach((tab, newIndex) => {
            const tabData = positions.get(tab.id);
            if (tabData) {
                this.tabsContainer.appendChild(tabData.element);
            }
        });

        // Force reflow
        this.tabsContainer.offsetHeight;

        // Animate to new positions
        positions.forEach((data, tabId) => {
            const newRect = data.element.getBoundingClientRect();
            const deltaX = data.startX - newRect.left;

            if (Math.abs(deltaX) > 1) {
                data.element.style.transform = `translateX(${deltaX}px)`;
                data.element.style.transition = 'none';

                // Force reflow
                data.element.offsetHeight;

                // Animate
                data.element.style.transition = 'transform 0.5s ease-out';
                data.element.style.transform = 'translateX(0)';
            }
        });

        // Clean up after animation and add group indicators
        setTimeout(() => {
            tabElements.forEach(tabEl => {
                tabEl.style.transform = '';
                tabEl.style.transition = '';
            });

            // Add group color indicators with Claude's suggestions
            this.addGroupColorIndicators(tabToGroup, groups, groupInfo);
        }, 600);

        // Add visual separators between groups
        this.addGroupSeparators(groups);

        // Restore active tab state
        if (activeTabId) {
            const activeTabEl = this.tabsContainer.querySelector(`[data-tab-id="${activeTabId}"]`);
            if (activeTabEl && !activeTabEl.classList.contains('active')) {
                // Ensure the active tab is marked correctly
                this.tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                activeTabEl.classList.add('active');
            }
        }
    }

    addGroupSeparators(groups) {
        // Remove existing separators
        this.tabsContainer.querySelectorAll('.tab-group-separator').forEach(sep => sep.remove());

        let cumulativeIndex = 0;
        groups.forEach((group, groupIndex) => {
            if (groupIndex < groups.length - 1) { // Don't add separator after last group
                cumulativeIndex += group.members.length;

                // Find the tab element at this position
                const tabs = this.tabsContainer.querySelectorAll('.tab');
                if (cumulativeIndex < tabs.length) {
                    const separator = document.createElement('div');
                    separator.className = 'tab-group-separator';
                    separator.style.cssText = `
                        width: 2px;
                        height: 20px;
                        background: var(--border-color);
                        margin: 0 4px;
                        opacity: 0;
                        transition: opacity 0.3s ease-in;
                    `;

                    // Insert separator after the last tab in the group
                    tabs[cumulativeIndex - 1].after(separator);

                    // Fade in
                    setTimeout(() => {
                        separator.style.opacity = '1';
                    }, 100);
                }
            }
        });
    }

    addGroupColorIndicators(tabToGroup, groups, groupInfo) {
        // Define a set of distinct colors for groups (fallback if Claude doesn't suggest one)
        const groupColors = [
            '#FF6B6B', // Red
            '#4ECDC4', // Teal
            '#45B7D1', // Blue
            '#96CEB4', // Green
            '#FECA57', // Yellow
            '#DDA0DD', // Plum
            '#98D8C8', // Mint
            '#F7DC6F', // Light Yellow
            '#BB8FCE', // Purple
            '#85C1E2'  // Light Blue
        ];

        // Remove existing group indicators
        this.tabsContainer.querySelectorAll('.tab-group-indicator').forEach(indicator => indicator.remove());

        // Add color indicators to grouped tabs
        this.tabs.forEach(tab => {
            const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${tab.id}"]`);
            if (tabElement && tabToGroup.has(tab.id)) {
                const groupIndex = tabToGroup.get(tab.id);
                const group = groups[groupIndex];

                // Only add indicator if group has more than 1 member
                if (group.members.length > 1) {
                    let color = groupColors[groupIndex % groupColors.length];
                    let groupName = `Group ${groupIndex + 1}`;

                    // Use Claude's suggested color and name if available
                    if (groupInfo && groupInfo.has(groupIndex)) {
                        const info = groupInfo.get(groupIndex);
                        if (info.color) {
                            color = info.color;
                        }
                        if (info.name) {
                            groupName = info.name;
                        }
                    }

                    // Create a small colored dot indicator
                    const indicator = document.createElement('div');
                    indicator.className = 'tab-group-indicator';
                    indicator.style.cssText = `
                        position: absolute;
                        bottom: 2px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 6px;
                        height: 6px;
                        background: ${color};
                        border-radius: 50%;
                        opacity: 0;
                        transition: opacity 0.3s ease-in;
                        z-index: 1;
                    `;

                    tabElement.appendChild(indicator);

                    // Add tooltip with group info
                    indicator.title = `${groupName}: ${group.members.length} similar tabs`;

                    // Fade in the indicator
                    setTimeout(() => {
                        indicator.style.opacity = '0.8';
                    }, 100);
                }
            }
        });
    }

    setupBookmarksBarDragDrop() {
        this.bookmarksBar.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.bookmarksBar.classList.add('drag-over');
        });
        
        this.bookmarksBar.addEventListener('dragleave', (e) => {
            if (e.target === this.bookmarksBar || !this.bookmarksBar.contains(e.relatedTarget)) {
                this.bookmarksBar.classList.remove('drag-over');
            }
        });
        
        this.bookmarksBar.addEventListener('drop', (e) => {
            e.preventDefault();
            this.bookmarksBar.classList.remove('drag-over');
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.url) {
                    this.addBookmark(data.url, data.title, data.favicon);
                }
            } catch (err) {
                console.error('Failed to parse dropped data:', err);
            }
        });
    }

    setupAutomationFeature() {
        // Load saved automations
        this.loadAutomations();

        // Populate the dropdown menu
        this.populateAutomationList();

        // Set up dropdown toggle
        if (this.automationBtn) {
            this.automationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleAutomationMenu();
            });
        }

        // Set up group tabs button
        if (this.groupTabsBtn) {
            this.groupTabsBtn.addEventListener('click', () => {
                this.groupSimilarTabs();
            });
        }

        // Listen for window closing event from main process
        window.electronAPI.onWindowClosing(async () => {
            const settings = await this.loadSettings();
            if (settings.restoreTabsOnStartup) {
                await this.saveTabState();
            }
        });

        // Also use beforeunload as fallback
        window.addEventListener('beforeunload', async (e) => {
            const settings = await this.loadSettings();

            if (settings.restoreTabsOnStartup) {
                await this.saveTabState();
            }

            // Also try saving synchronously on unload
            window.addEventListener('unload', async () => {
                if (settings.restoreTabsOnStartup) {
                    await this.saveTabState();
                }
            }, { capture: true });
        });

        // Handle dropdown menu clicks
        this.automationMenu.addEventListener('click', async (e) => {
            const item = e.target.closest('.automation-menu-item');
            if (item) {
                const action = item.dataset.action;
                if (action === 'record') {
                    this.startRecording();
                } else if (action === 'stop') {
                    await this.stopRecording();
                }
                this.hideAutomationMenu();
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            // Close automation dropdown
            if (!e.target.closest('.automation-dropdown')) {
                this.hideAutomationMenu();
            }
            // Close summary dropdown
            if (!e.target.closest('.summary-dropdown')) {
                const summaryMenu = document.getElementById('summary-menu');
                if (summaryMenu) summaryMenu.classList.add('hidden');
            }
        });

        // Dialog event listeners
        const saveBtn = document.getElementById('automation-save-btn');
        const cancelBtn = document.getElementById('automation-cancel-btn');
        const dialogClose = this.saveAutomationDialog.querySelector('.dialog-close');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSaveAutomation());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                // Clear recorded actions when canceling
                this.recordedActions = [];

                // Ensure recording state is false when canceling
                this.isRecording = false;
                this.hideSaveDialog();
            });
        }
        if (dialogClose) {
            dialogClose.addEventListener('click', () => {
                // Clear recorded actions when closing dialog (same as cancel)
                this.recordedActions = [];

                // Ensure recording state is false when closing dialog
                this.isRecording = false;
                this.hideSaveDialog();
            });
        }
    }

    createTestAutomation() {
        const testAutomation = {
            id: 'test_' + Date.now(),
            name: 'Test Google Search',
            url: 'https://google.com',
            actions: [
                { type: 'input', selector: 'input[name="q"]', value: 'Claude AI', timestamp: Date.now() },
                { type: 'click', selector: 'input[type="submit"]', text: 'Search', timestamp: Date.now() + 1000 }
            ],
            created: new Date().toISOString()
        };

        this.savedAutomations.push(testAutomation);
        this.saveAutomationsToStorage();
        this.populateAutomationList();
        this.createAutomationBookmark(testAutomation);

        this.showNotification('Test automation created!', 'success');
    }

    enableRecordingMode() {
        // Add visual indicator that recording is active
        document.body.classList.add('recording-active');

        // Disable browser chrome interactions that could interfere
        this.disabledElements = [];

        // Disable tab switching during recording
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            if (tab.id !== `tab-${this.activeTabId}`) {
                tab.style.pointerEvents = 'none';
                tab.style.opacity = '0.5';
                this.disabledElements.push({element: tab, restore: () => {
                    tab.style.pointerEvents = '';
                    tab.style.opacity = '';
                }});
            }
        });

        // Disable new tab button
        const newTabBtn = document.getElementById('new-tab-btn');
        if (newTabBtn) {
            newTabBtn.disabled = true;
            newTabBtn.style.opacity = '0.5';
            this.disabledElements.push({element: newTabBtn, restore: () => {
                newTabBtn.disabled = false;
                newTabBtn.style.opacity = '';
            }});
        }

        // Disable address bar to prevent navigation
        const addressBar = document.getElementById('address-bar');
        if (addressBar) {
            addressBar.disabled = true;
            addressBar.style.opacity = '0.5';
            this.disabledElements.push({element: addressBar, restore: () => {
                addressBar.disabled = false;
                addressBar.style.opacity = '';
            }});
        }

        // Disable navigation buttons
        const navButtons = document.querySelectorAll('#back-btn, #forward-btn, #refresh-btn');
        navButtons.forEach(btn => {
            const wasDisabled = btn.disabled;
            btn.disabled = true;
            btn.style.opacity = '0.5';
            this.disabledElements.push({element: btn, restore: () => {
                btn.disabled = wasDisabled;
                btn.style.opacity = '';
            }});
        });

    }

    disableRecordingMode() {
        // Remove visual indicator
        document.body.classList.remove('recording-active');

        // Restore all disabled elements
        if (this.disabledElements) {
            this.disabledElements.forEach(item => item.restore());
            this.disabledElements = [];
        }

    }

    setupWebviewRecording(webview) {
        // Store current recording state
        this.currentRecording = {
            webview: webview,
            url: webview.src || webview.getURL?.() || '',
            title: '',
            actions: []  // Initialize actions array
        };

        // Set up listener for actions recorded in the webview
        // Use arrow function to preserve 'this' context
        this.automationConsoleHandler = (event) => {
            // Log ALL console messages to debug

            // Check if we're still recording
            if (!this.isRecording) {
                console.warn('⚠️ Received console message but recording is stopped');
                return;
            }

            // Extra debug for navigation
            if (event.message && event.message.includes('Automation recording started at')) {
            }

            if (event.message && typeof event.message === 'string') {
                try {
                    if (event.message.startsWith('AUTOMATION_ACTION:')) {
                        const actionData = JSON.parse(event.message.replace('AUTOMATION_ACTION:', ''));
                        this.recordedActions.push({
                            ...actionData,
                            timestamp: Date.now()
                        });

                        // Send to main process via IPC
                        if (window.electronAPI && window.electronAPI.sendRecordingAction) {
                            window.electronAPI.sendRecordingAction(actionData);
                        }

                        // Show detailed toast notification for each action type
                        let toastMessage = '';
                        let toastIcon = '';

                        switch(actionData.type) {
                            case 'click':
                                toastIcon = '🖱️';
                                toastMessage = `Click on ${actionData.selector}`;
                                if (actionData.text) {
                                    toastMessage += ` ("${actionData.text.substring(0, 20)}...")`;
                                }
                                break;
                            case 'type':
                                toastIcon = '⌨️';
                                toastMessage = `Type "${actionData.value}" in ${actionData.selector}`;
                                break;
                            case 'focus':
                                toastIcon = '🎯';
                                toastMessage = `Focus on ${actionData.selector}`;
                                break;
                            case 'keypress':
                                toastIcon = '🔑';
                                toastMessage = `Press ${actionData.key} on ${actionData.selector}`;
                                break;
                            case 'submit':
                                toastIcon = '📋';
                                toastMessage = `Submit form ${actionData.selector}`;
                                break;
                            case 'mousemove':
                                toastIcon = '🖱️';
                                toastMessage = `Mouse move to (${actionData.x}, ${actionData.y})`;
                                break;
                            case 'scroll':
                                toastIcon = '📜';
                                toastMessage = `Scroll to (${actionData.x}, ${actionData.y})`;
                                break;
                            case 'script-injected':
                            case 'script-verified':
                            case 'page-load-test':
                                toastIcon = '✅';
                                toastMessage = `Recording active on: ${(actionData.url || '').substring(0, 50)}`;
                                // Don't add this to recordedActions - it's just a status message
                                this.showRecordingToast(`${toastIcon} ${toastMessage}`);
                                return; // Exit early, don't add to actions
                            default:
                                toastIcon = '📝';
                                toastMessage = `${actionData.type} action`;
                        }

                        this.showRecordingToast(`${toastIcon} Action #${this.recordedActions.length}: ${toastMessage}`);
                    } else if (event.message.includes('Recorded input:') ||
                              event.message.includes('Recorded keypress:') ||
                              event.message.includes('Recorded focus:') ||
                              event.message.includes('Recording script is running!')) {
                        // Debug messages from the injected script
                    }
                } catch (e) {
                    console.error('Error parsing automation action:', e);
                }
            }
        };

        // Add console listener
        webview.addEventListener('console-message', this.automationConsoleHandler);
        this.consoleListenerAttached = true;

        // Also add a message listener for postMessage from webview
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'AUTOMATION_ACTION') {
                const actionData = event.data.action;
                this.recordedActions.push({
                    ...actionData,
                    timestamp: Date.now()
                });

                // Send to main process via IPC
                if (window.electronAPI && window.electronAPI.sendRecordingAction) {
                    window.electronAPI.sendRecordingAction(actionData);
                }

                // Show detailed toast notification
                let toastMessage = '';
                let toastIcon = '';

                switch(actionData.type) {
                    case 'click':
                        toastIcon = '🖱️';
                        toastMessage = `Click on ${actionData.selector}`;
                        if (actionData.text) {
                            toastMessage += ` ("${actionData.text.substring(0, 20)}...")`;
                        }
                        break;
                    case 'type':
                        toastIcon = '⌨️';
                        toastMessage = `Type "${actionData.value}" in ${actionData.selector}`;
                        break;
                    case 'focus':
                        toastIcon = '🎯';
                        toastMessage = `Focus on ${actionData.selector}`;
                        break;
                    case 'keypress':
                        toastIcon = '🔑';
                        toastMessage = `Press ${actionData.key} on ${actionData.selector}`;
                        break;
                    case 'submit':
                        toastIcon = '📋';
                        toastMessage = `Submit form ${actionData.selector}`;
                        break;
                    default:
                        toastIcon = '📝';
                        toastMessage = `${actionData.type} action`;
                }

                this.showRecordingToast(`${toastIcon} Action #${this.recordedActions.length}: ${toastMessage}`);
            }
        });

        // Get page title for recording context
        webview.executeJavaScript('document.title').then(title => {
            this.currentRecording.title = title || 'Unknown Page';
        }).catch(() => {
            this.currentRecording.title = 'Unknown Page';
        });

    }

    async startCDPRecording() {

        // Get current tab and webview
        const currentTab = this.getCurrentTab();
        if (!currentTab || !currentTab.webview) {
            console.error('No active webview found');
            return { success: false, error: 'No active webview' };
        }

        const webview = currentTab.webview;

        // Load CDP recorder if not already loaded
        if (!this.cdpRecorder) {
            try {
                const WebViewCDPRecorder = require('./webview-cdp-recorder.js');
                this.cdpRecorder = new WebViewCDPRecorder();
            } catch (error) {
                console.error('Failed to load CDP recorder:', error);
                return { success: false, error: 'Failed to load CDP recorder' };
            }
        }

        // Start CDP recording
        try {
            const result = await this.cdpRecorder.startRecording(webview);
            if (result.success) {
                this.isRecording = true;
                this.recordingTabId = this.activeTabId;

                // Update UI
                this.automationBtn.textContent = '🔴 Recording (CDP)...';
                this.automationBtn.style.color = '#e74c3c';
                this.populateAutomationList();
                this.showRecordingIndicator();
                this.showNotification('🔴 CDP Recording started', 'success');

                // Set up navigation listener to reinject CDP tracking
                this.setupCDPNavigationTracking(webview);

                return { success: true };
            } else {
                console.error('CDP recording failed:', result.error);
                return result;
            }
        } catch (error) {
            console.error('Error starting CDP recording:', error);
            return { success: false, error: error.message };
        }
    }

    setupCDPNavigationTracking(webview) {
        const self = this;

        // Listen for navigation to reinject CDP tracking
        if (!this.cdpNavigationHandler) {
            this.cdpNavigationHandler = function() {
                if (self.isRecording && self.cdpRecorder) {
                    setTimeout(() => {
                        self.cdpRecorder.reinjectAfterNavigation();
                    }, 500);
                }
            };
        }

        webview.addEventListener('did-navigate', this.cdpNavigationHandler);
        webview.addEventListener('dom-ready', this.cdpNavigationHandler);
    }

    async startRecording() {
        // Set recording state early to prevent double-starts
        this.isRecording = true;
        // Only clear if starting fresh, not if continuing
        if (!this.recordedActions || this.recordedActions.length === 0) {
            this.recordedActions = [];
        } else {
        }

        // Update button text to show recording state
        this.automationBtn.textContent = '🔴 Recording...';
        this.automationBtn.style.color = '#e74c3c';

        // Update the dropdown menu to show stop option
        this.populateAutomationList();

        try {
            // Use webview recording directly - it works better in Electron
            const currentTab = this.tabs.find(tab => tab.id === this.activeTabId);
            if (currentTab && currentTab.webview) {
                const currentUrl = currentTab.webview.src;

                // Set recording tab ID for navigation tracking
                this.recordingTabId = this.activeTabId;

                // Set up webview recording listeners
                this.setupWebviewRecording(currentTab.webview);

                // Set up navigation tracking to persist recording across page loads
                this.setupNavigationTracking(currentTab.webview);

                // Start recording in the webview
                this.injectRecordingScript(currentTab.webview);

                // Capture viewport size from webview
                currentTab.webview.executeJavaScript(`
                    JSON.stringify({
                        width: window.innerWidth,
                        height: window.innerHeight
                    });
                `).then(viewportJson => {
                    try {
                        this.recordingViewport = JSON.parse(viewportJson);
                    } catch (e) {
                        console.warn('Could not parse viewport size:', e);
                        this.recordingViewport = { width: 1280, height: 720 }; // default
                    }
                }).catch(() => {
                    this.recordingViewport = { width: 1280, height: 720 }; // default
                });

                // Add initial navigate action if on a real URL
                if (currentUrl && !currentUrl.startsWith('about:')) {
                    this.recordedActions.push({
                        type: 'navigate',
                        url: currentUrl,
                        timestamp: Date.now()
                    });
                }
            }


            // Show floating recording indicator after successful start
            this.showRecordingIndicator();

            this.showNotification('🔴 Recording started - Press ESC or Cmd/Ctrl+Shift+R to stop', 'success');
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.showNotification('Failed to start recording: ' + error.message, 'error');

            // Reset state on error
            this.isRecording = false;
            this.automationBtn.textContent = '🎯 Automations';
            this.automationBtn.style.color = '';
            this.hideRecordingIndicator();
            this.populateAutomationList();
        }
    }

    injectRecordingScript(webview) {
        if (!webview) {
            console.error('No webview provided to injectRecordingScript');
            return;
        }


        // Simply call the preload script's recording function
        // The preload script handles persistence across navigations via sessionStorage
        webview.executeJavaScript(`
            (function() {
                // Try to use the preload script's recording function
                if (typeof window.__startAutomationRecording === 'function') {
                    window.__startAutomationRecording();
                    return 'recording-started';
                } else {
                    console.error('❌ Preload recording function not found');
                    return 'preload-not-found';
                }
            })();
        `).then(result => {
            if (result === 'recording-started') {
                try {
                    this.showRecordingToast(`📍 Recording active on: ${webview.getURL()}`);
                } catch (e) {
                    this.showRecordingToast(`📍 Recording started`);
                }
            } else {
                console.warn('⚠️ Preload script not available, trying custom injection');
                this.injectCustomRecordingScript(webview);
            }
        }).catch(err => {
            console.error('Error injecting recording script:', err);
            // Fallback to custom script
            this.injectCustomRecordingScript(webview);
        });
    }

    injectCustomRecordingScript(webview) {

        // Inject inline script directly
        const inlineScript = `
                (function() {
                    // Always set recording to true - needed after page navigation
                    window.__automationRecording = true;

                    // Check if DOM is ready
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', function() {
                            setupRecording();
                        });
                    } else {
                        setupRecording();
                    }

                    function setupRecording() {
                        // Add visual indicator that recording is active
                        const indicator = document.createElement('div');
                        indicator.style.cssText = 'position:fixed;top:10px;right:10px;background:red;color:white;padding:5px 10px;border-radius:5px;z-index:999999;font-family:system-ui;font-size:12px;';
                        indicator.textContent = '🔴 RECORDING';
                        indicator.id = 'automation-recording-indicator';
                        if (!document.getElementById('automation-recording-indicator') && document.body) {
                            document.body.appendChild(indicator);
                        }

                    // Function to send actions to the host
                    function sendAction(action) {
                        // Try both console.log and postMessage

                        // Also try postMessage to parent window if available
                        if (window.parent && window.parent !== window) {
                            window.parent.postMessage({
                                type: 'AUTOMATION_ACTION',
                                action: action
                            }, '*');
                        }
                    }

                        // Simple click tracking
                        document.addEventListener('click', function(e) {
                            try {
                                const target = e.target;
                                let selector;

                            if (target.id) {
                                selector = '#' + CSS.escape(target.id);
                            } else if (target.getAttribute('aria-label')) {
                                selector = '[aria-label="' + CSS.escape(target.getAttribute('aria-label')) + '"]';
                            } else if (target.className && typeof target.className === 'string') {
                                const classes = target.className.trim().split(/\\s+/).filter(c => c);
                                selector = '.' + classes.map(c => CSS.escape(c)).join('.');
                            } else {
                                selector = target.tagName.toLowerCase();
                            }

                            const action = {
                                type: 'click',
                                selector: selector,
                                text: (target.innerText || '').substring(0, 30),
                                timestamp: Date.now()
                            };

                            sendAction(action);
                        } catch (err) {
                            console.error('Error tracking click:', err);
                        }
                        }, true);

                        // Track input with debouncing to avoid too many events
                        let inputTimeouts = new WeakMap();
                        document.addEventListener('input', function(e) {
                        try {
                            const target = e.target;
                            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                                // Clear any existing timeout for this element
                                if (inputTimeouts.has(target)) {
                                    clearTimeout(inputTimeouts.get(target));
                                }

                                // Set a new timeout to debounce input
                                const timeout = setTimeout(() => {
                                    let selector;

                                    if (target.id) {
                                        selector = '#' + CSS.escape(target.id);
                                    } else if (target.name) {
                                        selector = '[name="' + CSS.escape(target.name) + '"]';
                                    } else if (target.className && typeof target.className === 'string') {
                                        const classes = target.className.trim().split(/\\s+/).filter(c => c);
                                        selector = '.' + classes.map(c => CSS.escape(c)).join('.');
                                    } else {
                                        selector = target.tagName.toLowerCase();
                                    }

                                    const action = {
                                        type: 'type',
                                        selector: selector,
                                        value: target.value,
                                        timestamp: Date.now()
                                    };

                                    sendAction(action);

                                    inputTimeouts.delete(target);
                                }, 500); // Wait 500ms after user stops typing

                                inputTimeouts.set(target, timeout);
                            }
                        } catch (err) {
                            console.error('Error tracking input:', err);
                        }
                    }, true);

                    // Track focus events to capture when users click on form fields
                    document.addEventListener('focus', function(e) {
                        try {
                            const target = e.target;
                            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                                let selector;

                                if (target.id) {
                                    selector = '#' + CSS.escape(target.id);
                                } else if (target.name) {
                                    selector = '[name="' + CSS.escape(target.name) + '"]';
                                } else if (target.className && typeof target.className === 'string') {
                                    const classes = target.className.trim().split(/\\s+/).filter(c => c);
                                    selector = '.' + classes.map(c => CSS.escape(c)).join('.');
                                } else {
                                    selector = target.tagName.toLowerCase();
                                }

                                const action = {
                                    type: 'focus',
                                    selector: selector,
                                    timestamp: Date.now()
                                };

                                sendAction(action);
                            }
                        } catch (err) {
                            console.error('Error tracking focus:', err);
                        }
                    }, true);

                    // Keyboard tracking for special keys
                    document.addEventListener('keydown', function(e) {
                        try {
                            const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

                            // Only track special keys
                            if (!specialKeys.includes(e.key)) return;

                            const target = e.target;
                            let selector;

                            if (target.id) {
                                selector = '#' + CSS.escape(target.id);
                            } else if (target.name) {
                                selector = '[name="' + CSS.escape(target.name) + '"]';
                            } else if (target.className && typeof target.className === 'string') {
                                const classes = target.className.trim().split(/\\s+/).filter(c => c);
                                selector = '.' + classes.map(c => CSS.escape(c)).join('.');
                            } else {
                                selector = target.tagName.toLowerCase();
                            }

                            const action = {
                                type: 'keypress',
                                selector: selector,
                                key: e.key,
                                timestamp: Date.now()
                            };

                            sendAction(action);
                        } catch (err) {
                            console.error('Error tracking keypress:', err);
                        }
                    }, true);

                    // Also track form submissions triggered by Enter
                    document.addEventListener('submit', function(e) {
                        try {
                            const form = e.target;
                            let formSelector = '';

                            if (form.id) {
                                formSelector = '#' + CSS.escape(form.id);
                            } else if (form.name) {
                                formSelector = 'form[name="' + CSS.escape(form.name) + '"]';
                            } else if (form.className && typeof form.className === 'string') {
                                const classes = form.className.trim().split(/\\s+/).filter(c => c);
                                if (classes.length > 0) {
                                    formSelector = 'form.' + classes.map(c => CSS.escape(c)).join('.');
                                }
                            } else {
                                formSelector = 'form';
                            }

                            const action = {
                                type: 'submit',
                                selector: formSelector,
                                timestamp: Date.now()
                            };

                            sendAction(action);

                            // Note: Don't prevent default here as we want the form to actually submit
                        } catch (err) {
                            console.error('Error tracking form submit:', err);
                        }
                        }, true);

                    } // End of setupRecording function

                    return 'recording-started';
                })();
            `;

        // Use a Promise to track injection success
        const injectionPromise = webview.executeJavaScript(inlineScript);

        injectionPromise.then(result => {

            // Immediately verify the script is working
            return webview.executeJavaScript(`
                if (window.__automationRecording) {
                    'script-active';
                } else {
                    'script-not-active';
                }
            `);
        }).then(verifyResult => {

            // Show toast to confirm recording is active on this page
            const self = this;
            const currentUrl = webview.getURL();
            if (currentUrl && currentUrl !== 'about:blank' && verifyResult === 'script-active') {
                self.showRecordingToast(`📍 Recording verified active on: ${currentUrl.substring(0, 50)}...`);
            } else if (verifyResult !== 'script-active') {
                console.error('⚠️ Script injection failed - recording flag not set!');
                self.showNotification('Recording script injection failed on this page', 'error');
            }

            // Test if the script is working
            setTimeout(() => {
                webview.executeJavaScript('window.__automationRecording === true').then(isActive => {
                    if (isActive) {
                    } else {
                        console.warn('⚠️ Recording flag not set, reinjecting...');
                        self.injectCustomRecordingScript(webview);
                    }
                });
            }, 500);
        }).catch(err => {
            console.error('❌ Failed to inject recording script:', err);

            // Retry injection after a delay
            const self = this;
            setTimeout(() => {
                webview.executeJavaScript(inlineScript).then(result => {
                }).catch(retryErr => {
                    console.error('❌ Retry also failed:', retryErr);
                });
            }, 1000);
        });
    }

    // Webview-based recording method
    async startWebviewRecording() {

        // Get current tab and its webview
        const currentTab = this.tabs.find(tab => tab.id === this.activeTabId);
        if (!currentTab || !currentTab.webview) {
            this.showNotification('No active tab found for recording', 'error');
            return;
        }

        // Get current URL from the webview
        const currentUrl = currentTab.webview.src || currentTab.webview.getURL();

        if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
            this.showNotification('Please navigate to a webpage before recording', 'error');
            return;
        }

        // Set recording state
        this.isRecording = true;
        // Don't clear recorded actions - we want to accumulate across page loads
        if (!this.recordedActions) {
            this.recordedActions = [];
        }
        this.recordingTabId = this.activeTabId;

        // Update UI
        this.automationBtn.textContent = '🔴 Recording...';
        this.automationBtn.style.color = '#e74c3c';
        this.populateAutomationList();

        // Record initial viewport and navigation only if this is the first action
        if (this.recordedActions.length === 0) {
            // Capture viewport dimensions from the webview
            const webviewBounds = currentTab.webview.getBoundingClientRect();
            const viewportInfo = {
                width: Math.round(webviewBounds.width),
                height: Math.round(webviewBounds.height),
                devicePixelRatio: window.devicePixelRatio || 1
            };

            // Store viewport info in the recording
            this.recordingViewport = viewportInfo;

            // Add viewport action as first action
            this.recordedActions.push({
                type: 'viewport',
                width: viewportInfo.width,
                height: viewportInfo.height,
                devicePixelRatio: viewportInfo.devicePixelRatio,
                timestamp: Date.now()
            });

            // Then add navigation action
            this.recordedActions.push({
                type: 'navigate',
                url: currentUrl,
                timestamp: Date.now()
            });
        }

        // Set up webview recording listeners FIRST
        this.setupWebviewRecording(currentTab.webview);

        // SimplifiedAutomation not needed - we use webview injection instead

        // Inject recording script into webview - delay slightly to ensure webview is ready
        setTimeout(() => {
            this.injectRecordingScript(currentTab.webview);
        }, 500);

        this.showNotification('🔴 Recording started in current tab', 'success');
        this.showRecordingIndicator();

    }

    async stopWebviewRecording() {

        // Clean up webview recording listeners
        if (this.currentRecording && this.currentRecording.webview) {
            // Tell the preload script to stop recording
            try {
                await this.currentRecording.webview.executeJavaScript(`
                    if (window.__stopAutomationRecording) {
                        window.__stopAutomationRecording();
                    }
                    // Also clear sessionStorage to prevent auto-restart
                    sessionStorage.removeItem('__automationRecording');
                    true;
                `);
            } catch (err) {
                console.error('Error stopping preload recording:', err);
            }

            if (this.automationConsoleHandler) {
                this.currentRecording.webview.removeEventListener('console-message', this.automationConsoleHandler);
            }
            // Clean up navigation tracking
            this.cleanupNavigationTracking(this.currentRecording.webview);
        }

        // SimplifiedAutomation not used - actions are already recorded via console messages
        // Note: Don't call save dialog here - it's called by stopRecording()
    }

    // Puppeteer-based recording methods
    async startPuppeteerRecording() {

        // Get current tab and its webview
        const currentTab = this.tabs.find(tab => tab.id === this.activeTabId);
        if (!currentTab || !currentTab.webview) {
            this.showNotification('No active tab found for recording', 'error');
            return;
        }

        // Get current URL from the webview (more accurate than address bar)
        const currentUrl = currentTab.webview.src || currentTab.webview.getURL();

        if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
            this.showNotification('Please navigate to a webpage before recording', 'error');
            return;
        }

        // Initialize Puppeteer if needed
        if (!this.puppeteerInitialized) {
            this.showNotification('Initializing recording...', 'info');
            try {
                await window.electronAPI.automationInit('recording');
                this.puppeteerInitialized = true;
            } catch (error) {
                console.error('Failed to initialize Puppeteer:', error);
                this.showNotification('Failed to initialize automation.', 'error');
                return;
            }
        }

        // Set recording state
        this.isRecording = true;
        // Don't clear recorded actions - we want to accumulate across page loads
        if (!this.recordedActions) {
            this.recordedActions = [];
        }

        // Update UI
        this.automationBtn.textContent = '🔴 Recording...';
        this.automationBtn.style.color = '#e74c3c';
        this.populateAutomationList();

        try {
            // Start Puppeteer recording
            const result = await window.electronAPI.automationStartRecording(currentUrl);


            if (result.success) {
                this.showNotification('🔴 Recording started in current tab', 'success');
                this.showRecordingIndicator();

                // Listen for automation messages
                window.electronAPI.onAutomationMessage((message) => {
                    if (message.type === 'action' && message.action) {
                        this.recordedActions.push(message.action);
                        this.showNotification(`Recorded: ${message.action.type}`, 'info');
                    }
                });
            } else {
                console.error('Automation init failed:', result);
                throw new Error(result.error || result.message || 'Failed to start recording');
            }
        } catch (error) {
            console.error('Failed to start Puppeteer recording:', error);
            this.showNotification('Failed to start recording: ' + error.message, 'error');
            this.isRecording = false;
            this.automationBtn.textContent = '🎯 Automations';
            this.automationBtn.style.color = '';
            this.populateAutomationList();
        }
    }

    async stopPuppeteerRecording() {

        try {
            const result = await window.electronAPI.automationStopRecording();

            if (result.success && result.actions) {
                this.recordedActions = result.actions;
            }
        } catch (error) {
            console.error('Error stopping Puppeteer recording:', error);
        }

        // Update UI
        this.isRecording = false;
        this.automationBtn.textContent = '🎯 Automations';
        this.automationBtn.style.color = '';
        this.hideRecordingIndicator();
        this.populateAutomationList();

        // Show save dialog
        if (this.recordedActions.length > 0) {
            this.showSaveDialog();
        } else {
            this.showNotification('No actions were recorded', 'warning');
        }
    }

    async playPuppeteerAutomation(automation, forceNewWindow = false) {
        this.hideAutomationMenu();

        // Log viewport info if available
        if (automation.viewport) {
        }

        // Initialize Puppeteer if needed, passing viewport from recording
        if (!this.puppeteerInitialized || forceNewWindow) {
            this.showNotification('Initializing automation engine...', 'info');
            try {
                // Pass viewport info during initialization
                await window.electronAPI.automationInit('playback', automation.viewport);
                this.puppeteerInitialized = true;
            } catch (error) {
                console.error('Failed to initialize Puppeteer:', error);
                this.showNotification('Failed to initialize automation: ' + error.message, 'error');
                return;
            }
        } else if (automation.viewport) {
            // If already initialized, we still need to pass viewport info to the player
        }

        this.showNotification(`▶️ Playing automation "${automation.name}"...`, 'info');

        try {
            // Pass both actions and viewport info to the automation player
            const result = await window.electronAPI.automationPlay({
                actions: automation.actions,
                viewport: automation.viewport,
                forceNewWindow: forceNewWindow
            });

            if (result.success) {
                this.showNotification(`✅ Automation "${automation.name}" completed!`, 'success');
            } else {
                throw new Error(result.error || 'Automation failed');
            }
        } catch (error) {
            console.error('Puppeteer automation error:', error);
            this.showNotification(`❌ Automation failed: ${error.message}`, 'error');
        }
    }

    async stopRecording() {

        if (!this.isRecording) {
            console.warn('Recording is not active');
            return;
        }

        // Stop CDP recording if active
        if (this.cdpRecorder) {
            try {
                const actions = await this.cdpRecorder.stopRecording();
                this.recordedActions = actions;
            } catch (error) {
                console.error('Error stopping CDP recording:', error);
            }
        } else {
            // Stop webview recording
            await this.stopWebviewRecording();
        }

        // Update state and UI
        this.isRecording = false;
        this.recordingTabId = null;
        this.automationBtn.textContent = '🎯 Automations';
        this.automationBtn.style.color = '';
        this.hideRecordingIndicator();

        // Show save dialog if we have actions
        if (this.recordedActions.length > 0) {
            this.saveAutomation();
        } else {
            this.showNotification('No actions recorded', 'warning');
        }

        return;

        this.isRecording = false;

        // Clean up webview recording listeners
        if (this.currentRecording && this.currentRecording.webview && this.automationConsoleHandler) {
            this.currentRecording.webview.removeEventListener('console-message', this.automationConsoleHandler);
        }

        // Update button text back to normal
        this.automationBtn.textContent = '🎯 Automations';
        this.automationBtn.style.color = '';

        // Hide recording indicator
        this.hideRecordingIndicator();

        // Update dropdown menu
        this.populateAutomationList();


        // Always show the save dialog, even with 0 actions for debugging
        // if (this.recordedActions.length > 0) {
        if (true) {
            // Show custom save dialog instead of prompt
            this.showSaveDialog();
        } else {
            this.showNotification('No actions were recorded', 'warning');
        }

        // Don't clear recorded actions here - they should be cleared
        // after the save dialog is handled (either saved or cancelled)
        // this.recordedActions = [];
    }

    getSimplifiedAutomationClass() {
        // Return the SimplifiedAutomation class as a string for injection
        return `
// Simplified Automation System for ${BROWSER_NAME}
class SimplifiedAutomation {
    constructor() {
        this.recordedActions = [];
        this.isRecording = false;
        this.isPlaying = false;
        this.listeners = new Map();
    }

    // Start recording user actions
    startRecording(url = null) {
        this.isRecording = true;
        this.recordedActions = [];

        // Record initial navigation if URL provided
        if (url) {
            this.recordedActions.push({
                type: 'navigate',
                url: url,
                timestamp: Date.now()
            });
        }

        // Set up event listeners for recording
        this.setupRecordingListeners();

        return true;
    }

    // Stop recording
    stopRecording() {
        this.isRecording = false;

        // Clean up listeners
        this.removeRecordingListeners();

        return this.recordedActions;
    }

    // Set up recording listeners
    setupRecordingListeners() {
        // Click listener
        const clickHandler = (e) => {
            if (!this.isRecording) return;

            const selector = this.generateSelector(e.target);
            if (selector) {
                this.recordedActions.push({
                    type: 'click',
                    selector: selector,
                    text: e.target.textContent?.trim() || '',
                    timestamp: Date.now()
                });
            }
        };

        // Input listener
        const inputHandler = (e) => {
            if (!this.isRecording) return;

            const selector = this.generateSelector(e.target);
            if (selector) {
                // Debounce input recording
                clearTimeout(e.target._inputTimeout);
                e.target._inputTimeout = setTimeout(() => {
                    this.recordedActions.push({
                        type: 'input',
                        selector: selector,
                        value: e.target.value,
                        timestamp: Date.now()
                    });
                }, 500);
            }
        };

        // Keyboard listener
        const keyboardHandler = (e) => {
            if (!this.isRecording) return;

            // Only record special keys like Enter, Tab, Escape
            const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            if (!specialKeys.includes(e.key)) return;

            const selector = this.generateSelector(e.target);
            if (selector) {
                this.recordedActions.push({
                    type: 'keypress',
                    selector: selector,
                    key: e.key,
                    timestamp: Date.now()
                });
            }
        };

        // Navigation listener
        const navigationHandler = () => {
            if (!this.isRecording) return;

            setTimeout(() => {
                this.recordedActions.push({
                    type: 'navigate',
                    url: window.location.href,
                    timestamp: Date.now()
                });
            }, 100);
        };

        // Add listeners
        document.addEventListener('click', clickHandler, true);
        document.addEventListener('input', inputHandler, true);
        document.addEventListener('keydown', keyboardHandler, true);
        window.addEventListener('popstate', navigationHandler);

        // Store handlers for cleanup
        this.listeners.set('click', clickHandler);
        this.listeners.set('input', inputHandler);
        this.listeners.set('keydown', keyboardHandler);
        this.listeners.set('popstate', navigationHandler);
    }

    // Remove recording listeners
    removeRecordingListeners() {
        document.removeEventListener('click', this.listeners.get('click'), true);
        document.removeEventListener('input', this.listeners.get('input'), true);
        document.removeEventListener('keydown', this.listeners.get('keydown'), true);
        window.removeEventListener('popstate', this.listeners.get('popstate'));
        this.listeners.clear();
    }

    // Generate a reliable selector for an element
    generateSelector(element) {
        if (!element) return null;

        // Try ID first
        if (element.id) {
            return '#' + CSS.escape(element.id);
        }

        // Try unique class combination
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                const selector = '.' + classes.map(c => CSS.escape(c)).join('.');
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }

        // Try data attributes
        const dataAttrs = Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => '[' + attr.name + '="' + attr.value + '"]')
            .join('');
        if (dataAttrs && document.querySelectorAll(dataAttrs).length === 1) {
            return dataAttrs;
        }

        // Generate path-based selector
        return this.generatePathSelector(element);
    }

    // Generate a path-based selector
    generatePathSelector(element) {
        const path = [];
        let current = element;

        while (current && current.tagName !== 'BODY') {
            let selector = current.tagName.toLowerCase();

            // Add nth-child if needed
            const parent = current.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children)
                    .filter(child => child.tagName === current.tagName);
                if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += ':nth-of-type(' + index + ')';
                }
            }

            path.unshift(selector);
            current = parent;
        }

        return path.join(' > ');
    }

    // Play recorded automation
    async playAutomation(actions) {
        this.isPlaying = true;

        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            const actionStartTime = Date.now();

            try {
                await this.executeAction(action);
                const actionDuration = Date.now() - actionStartTime;
                await this.delay(500); // Small delay between actions
            } catch (error) {
                console.error('❌ Action ' + (i + 1) + ' failed after ' + (Date.now() - actionStartTime) + 'ms:', error);
                this.showError('Failed to execute ' + action.type + ': ' + error.message);
                break;
            }
        }

        this.isPlaying = false;
        const totalDuration = Date.now() - Date.parse(actions[0].timestamp);
    }

    // Execute a single action
    async executeAction(action) {

        switch (action.type) {
            case 'viewport':
                // For webview playback, we can try to resize the webview
                const currentWebview = this.getCurrentWebview();
                if (currentWebview) {
                    // Note: This might not work perfectly in all cases, but we log for debugging
                    // In Puppeteer mode, this will be handled by the main process
                }
                break;

            case 'navigate':
                window.location.href = action.url;
                // Wait for navigation to complete
                await this.waitForPageLoad();
                break;

            case 'click':
                // Prefer coordinates if available
                if (action.x !== undefined && action.y !== undefined) {

                    // Execute click in webview context using coordinates
                    const webview = this.getCurrentWebview();
                    if (webview) {
                        try {
                            await webview.executeJavaScript(`
                                (function() {
                                    // Create and dispatch mouse events at the coordinates
                                    const clickX = ` + action.x + `;
                                    const clickY = ` + action.y + `;

                                    // Find element at coordinates
                                    const element = document.elementFromPoint(clickX, clickY);
                                    if (element) {

                                        // Create mouse events
                                        const mousedownEvent = new MouseEvent('mousedown', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: clickX,
                                            clientY: clickY
                                        });

                                        const mouseupEvent = new MouseEvent('mouseup', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: clickX,
                                            clientY: clickY
                                        });

                                        const clickEvent = new MouseEvent('click', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: clickX,
                                            clientY: clickY
                                        });

                                        // Dispatch events
                                        element.dispatchEvent(mousedownEvent);
                                        element.dispatchEvent(mouseupEvent);
                                        element.dispatchEvent(clickEvent);

                                        // Visual feedback
                                        const indicator = document.createElement('div');
                                        indicator.style.cssText = 'position: fixed; left: ' + (clickX - 10) + 'px; top: ' + (clickY - 10) + 'px; width: 20px; height: 20px; border: 2px solid red; border-radius: 50%; pointer-events: none; z-index: 999999; animation: pulse 0.5s;';
                                        document.body.appendChild(indicator);
                                        setTimeout(() => indicator.remove(), 500);

                                        return true;
                                    } else {
                                        console.error('No element found at coordinates');
                                        return false;
                                    }
                                })();
                            `);
                        } catch (error) {
                            console.error('Error executing coordinate click:', error);
                            // Fall back to selector if available
                            if (action.selector) {
                                const clickElement = await this.waitForElement(action.selector);
                                if (clickElement) {
                                    clickElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    await this.delay(300);
                                    clickElement.click();
                                }
                            }
                        }
                    }
                } else if (action.selector) {
                    // Use selector if no coordinates
                    const clickElement = await this.waitForElement(action.selector);
                    if (clickElement) {
                        clickElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await this.delay(300);
                        clickElement.click();
                    } else {
                        throw new Error('Element not found: ' + action.selector);
                    }
                } else {
                    console.error('Click action has neither coordinates nor selector');
                    throw new Error('Click action requires coordinates or selector');
                }
                break;

            case 'input':
            case 'type':
                const inputElement = await this.waitForElement(action.selector);
                if (inputElement) {
                    inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.delay(300);
                    inputElement.focus();

                    // Clear existing value first
                    inputElement.value = '';
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));

                    // Type character by character for better compatibility

                    for (let i = 0; i < action.value.length; i++) {
                        const char = action.value[i];

                        // Simulate keydown
                        inputElement.dispatchEvent(new KeyboardEvent('keydown', {
                            key: char,
                            code: 'Key' + char.toUpperCase(),
                            keyCode: char.charCodeAt(0),
                            which: char.charCodeAt(0),
                            bubbles: true,
                            cancelable: true
                        }));

                        // Update value
                        const oldValue = inputElement.value;
                        inputElement.value += char;

                        // Simulate input event (most important for React/Vue/etc)
                        inputElement.dispatchEvent(new InputEvent('input', {
                            data: char,
                            inputType: 'insertText',
                            bubbles: true,
                            cancelable: true
                        }));

                        // Simulate keyup
                        inputElement.dispatchEvent(new KeyboardEvent('keyup', {
                            key: char,
                            code: 'Key' + char.toUpperCase(),
                            keyCode: char.charCodeAt(0),
                            which: char.charCodeAt(0),
                            bubbles: true,
                            cancelable: true
                        }));

                        // Small delay between characters for realism
                        await this.delay(30);
                    }


                    // Final change event
                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    throw new Error('Element not found: ' + action.selector);
                }
                break;

            case 'mousemove':
                if (action.selector) {
                }

                // For webview context, we need to inject and execute the hover
                const webview = this.getCurrentWebview();
                if (webview) {
                    try {
                        await webview.executeJavaScript(`
                            (function() {

                                // Find the target element
                                let targetElement = null;
                                if ('` + action.selector + `') {
                                    targetElement = document.querySelector('` + action.selector + `');
                                }

                                if (!targetElement && ` + (action.x || 0) + ` && ` + (action.y || 0) + `) {
                                    targetElement = document.elementFromPoint(` + (action.x || 0) + `, ` + (action.y || 0) + `);
                                }

                                if (targetElement) {

                                    // Get element position
                                    const rect = targetElement.getBoundingClientRect();
                                    const x = ` + (action.x || 0) + ` || (rect.left + rect.width / 2);
                                    const y = ` + (action.y || 0) + ` || (rect.top + rect.height / 2);

                                    // Show visual indicator
                                    const indicator = document.createElement('div');
                                    indicator.style.cssText = 'position: fixed; left: ' + (x - 5) + 'px; top: ' + (y - 5) + 'px; width: 10px; height: 10px; background: red; border-radius: 50%; pointer-events: none; z-index: 999999;';
                                    document.body.appendChild(indicator);
                                    setTimeout(() => indicator.remove(), 1000);

                                    // Trigger all mouse events in sequence
                                    const events = ['mouseenter', 'mouseover', 'mousemove'];
                                    events.forEach(eventType => {
                                        const event = new MouseEvent(eventType, {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: x,
                                            clientY: y,
                                            relatedTarget: document.body
                                        });
                                        targetElement.dispatchEvent(event);
                                    });

                                    // Also try focus for focus-triggered menus
                                    if (targetElement.focus) {
                                        targetElement.focus();
                                    }

                                    // Try jQuery hover if available
                                    if (window.jQuery && window.jQuery(targetElement).hover) {
                                        window.jQuery(targetElement).trigger('mouseenter');
                                    }

                                    return 'Mouse move simulated successfully';
                                } else {

                                    // Still dispatch to document at coordinates
                                    if (` + (action.x || 0) + ` && ` + (action.y || 0) + `) {
                                        const event = new MouseEvent('mousemove', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: ` + (action.x || 0) + `,
                                            clientY: ` + (action.y || 0) + `
                                        });
                                        document.dispatchEvent(event);
                                    }

                                    return 'No element found, dispatched to document';
                                }
                            })();
                        `);

                        await this.delay(300); // Wait for hover effects
                    } catch (error) {
                        console.error('Error executing mouse move in webview:', error);
                    }
                } else {
                }
                break;

            case 'scroll':

                // Execute scroll in webview context
                const scrollWebview = this.getCurrentWebview();
                if (scrollWebview) {
                    try {
                        await scrollWebview.executeJavaScript(`
                            (function() {

                                // Smooth scroll to the recorded position
                                window.scrollTo({
                                    left: ` + (action.x || 0) + `,
                                    top: ` + (action.y || 0) + `,
                                    behavior: 'smooth'
                                });

                                // Alternative for older browsers
                                if (!window.scrollTo) {
                                    window.pageXOffset = ` + (action.x || 0) + `;
                                    window.pageYOffset = ` + (action.y || 0) + `;
                                }

                                // Visual indicator
                                const indicator = document.createElement('div');
                                indicator.style.cssText = 'position: fixed; right: 20px; top: 20px; background: rgba(0, 123, 255, 0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 14px; z-index: 999999; animation: fadeOut 2s forwards;';
                                indicator.textContent = '📜 Scrolled to (` + (action.x || 0) + `, ` + (action.y || 0) + `)';

                                // Add fade out animation
                                const style = document.createElement('style');
                                style.textContent = '@keyframes fadeOut { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }';
                                document.head.appendChild(style);

                                document.body.appendChild(indicator);
                                setTimeout(() => {
                                    indicator.remove();
                                    style.remove();
                                }, 2000);

                                return 'Scrolled to position';
                            })();
                        `);


                        // Wait a bit for scroll to complete
                        await this.delay(500);
                    } catch (error) {
                        console.error('Error executing scroll in webview:', error);
                    }
                } else {
                }
                break;

            case 'hover':

                // Execute hover in webview context
                const hoverWebview = this.getCurrentWebview();
                if (hoverWebview) {
                    try {
                        await hoverWebview.executeJavaScript(`
                            (function() {

                                const element = document.querySelector('` + action.selector + `');
                                if (element) {

                                    // Scroll into view
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                    // Get element center position
                                    const rect = element.getBoundingClientRect();
                                    const x = rect.left + rect.width / 2;
                                    const y = rect.top + rect.height / 2;

                                    // Show visual indicator
                                    const indicator = document.createElement('div');
                                    indicator.style.cssText = 'position: fixed; left: ' + (x - 5) + 'px; top: ' + (y - 5) + 'px; width: 10px; height: 10px; background: blue; border-radius: 50%; pointer-events: none; z-index: 999999;';
                                    document.body.appendChild(indicator);
                                    setTimeout(() => indicator.remove(), 1500);

                                    // Trigger hover events in proper sequence
                                    ['mouseenter', 'mouseover', 'mousemove'].forEach(eventType => {
                                        const event = new MouseEvent(eventType, {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: x,
                                            clientY: y,
                                            relatedTarget: document.body
                                        });
                                        element.dispatchEvent(event);
                                    });

                                    // Try direct onmouseover handler
                                    if (element.onmouseover) {
                                        element.onmouseover();
                                    }

                                    // Focus for focus-triggered dropdowns
                                    if (element.focus) {
                                        element.focus();
                                    }

                                    // jQuery hover trigger
                                    if (window.jQuery) {
                                        window.jQuery(element).trigger('mouseenter').trigger('mouseover');
                                    }

                                    // Check for CSS :hover by adding a class
                                    element.classList.add('hover');
                                    setTimeout(() => element.classList.remove('hover'), 2000);

                                    return 'Hover simulated successfully';
                                } else {
                                    return 'Element not found: ` + action.selector + `';
                                }
                            })();
                        `);


                        // Wait for dynamic content
                        if (action.dynamicContent) {
                            await this.delay(500);
                        } else {
                            await this.delay(200);
                        }
                    } catch (error) {
                        console.error('Error executing hover in webview:', error);
                    }
                } else {
                }
                break;

            case 'checkbox':
            case 'check':
            case 'radio':

                const checkElement = await this.waitForElement(action.selector);
                if (checkElement) {

                    // Scroll into view
                    checkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.delay(300);

                    // Only click if the state needs to change
                    if (checkElement.checked !== action.checked) {

                        // Focus the element first
                        checkElement.focus();
                        await this.delay(100);

                        // Trigger the click
                        checkElement.click();

                        // Also trigger change event for compatibility
                        checkElement.dispatchEvent(new Event('change', { bubbles: true }));

                    } else {
                    }
                } else {
                    throw new Error('Checkbox/radio not found: ' + action.selector);
                }
                break;

            case 'keypress':
                const keypressElement = await this.waitForElement(action.selector);
                if (keypressElement) {
                    keypressElement.focus();
                    await this.delay(100);

                    // Create keyboard event
                    const keyCode = action.key === 'Enter' ? 13 :
                                   action.key === 'Tab' ? 9 :
                                   action.key === 'Escape' ? 27 : 0;

                    const keydownEvent = new KeyboardEvent('keydown', {
                        key: action.key,
                        code: action.key === 'Enter' ? 'Enter' : 'Key' + action.key.toUpperCase(),
                        keyCode: keyCode,
                        which: keyCode,
                        bubbles: true,
                        cancelable: true
                    });
                    keypressElement.dispatchEvent(keydownEvent);

                    // For Enter key, also dispatch keypress
                    if (action.key === 'Enter') {
                        const keypressEvent = new KeyboardEvent('keypress', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        keypressElement.dispatchEvent(keypressEvent);

                        // For Enter key, check if we're in a form and submit it
                        const form = keypressElement.closest('form');
                        if (form) {

                            // First try to find and click a submit button
                            const submitButton = form.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
                            if (submitButton) {
                                submitButton.click();
                            } else {
                                // If no submit button, try to submit the form directly
                                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

                                // Some forms use requestSubmit which is more reliable
                                if (form.requestSubmit) {
                                    form.requestSubmit();
                                } else {
                                    form.submit();
                                }
                            }
                        } else {
                        }
                    }

                    const keyupEvent = new KeyboardEvent('keyup', {
                        key: action.key,
                        code: action.key === 'Enter' ? 'Enter' : 'Key' + action.key.toUpperCase(),
                        keyCode: keyCode,
                        which: keyCode,
                        bubbles: true,
                        cancelable: true
                    });
                    keypressElement.dispatchEvent(keyupEvent);

                } else {
                    throw new Error('Element not found: ' + action.selector);
                }
                break;

            default:
                console.warn('Unknown action type: ' + action.type);
        }
    }

    // Wait for element to appear
    async waitForElement(selector, timeout = 5000) {
        const startTime = Date.now();
        let attempts = 0;

        while (Date.now() - startTime < timeout) {
            attempts++;
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
            await this.delay(100);
        }

        return null;
    }

    // Wait for page to load
    async waitForPageLoad() {
        const startTime = Date.now();

        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', () => {
                    resolve();
                }, { once: true });
                // Timeout after 10 seconds
                setTimeout(() => {
                    resolve();
                }, 10000);
            }
        });
    }

    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Show error message
    showError(message) {
        console.error(message);
        // Create a toast notification
        const toast = document.createElement('div');
        toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 16px 24px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 999999; font-family: Arial, sans-serif; font-size: 14px;';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

}

// Export to window
window.SimplifiedAutomation = SimplifiedAutomation;
        `;
    }

    getRobustAutomationCode() {
        // Return the complete RobustWebviewAutomation class as a string to inject into webview
        return `
// Robust automation class that works directly in webview context
class RobustWebviewAutomation {
    constructor() {
        this.debug = true;
    }

    log(...args) {
        if (this.debug) {
        }
    }

    // Wait for element with multiple selector strategies
    async waitForElement(selectorInfo, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = this.findElementNow(selectorInfo);
            if (element) return element;
            await this.sleep(100);
        }
        return null;
    }

    findElementNow(selectorInfo) {
        // Implementation would go here
        return null;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
`;
    }

    getRobustAutomationCode() {
        // Return the complete RobustWebviewAutomation class as a string to inject into webview
        return `
// Robust automation class that works directly in webview context
class RobustWebviewAutomation {
    constructor() {
        this.debug = true;
    }

    log(...args) {
        if (this.debug) {
        }
    }

    async waitForElement(selectorInfo, timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const element = this.findElementNow(selectorInfo);
            if (element) return element;
            await this.sleep(100);
        }
        return null;
    }

    findElementNow(selectorInfo) {
        // Implementation would go here
        return null;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
`;
    }
    ensureConsoleListenerActive(webview) {
        // Check if console listener needs to be attached
        // Note: We should NOT remove and re-add as this might break the connection
        if (!this.consoleListenerAttached) {
            webview.addEventListener('console-message', this.automationConsoleHandler);
            this.consoleListenerAttached = true;
        } else {
        }
    }

    setupNavigationTracking(webview) {
        // Store reference to this for use in handlers
        const self = this;

        // Create navigation handlers if they don't exist
        if (!this.automationNavigationHandler) {
            this.automationNavigationHandler = function(e) {
                // Only reinject if we're still recording and this is the recording tab
                if (self.isRecording && self.recordingTabId === self.activeTabId) {

                    // Don't record duplicate navigation to the same URL
                    const lastAction = self.recordedActions[self.recordedActions.length - 1];
                    if (lastAction && lastAction.type === 'navigate' && lastAction.url === e.url) {
                    } else {
                        // Record a navigation action
                        const navigationAction = {
                            type: 'navigate',
                            url: e.url,
                            timestamp: Date.now()
                        };
                        self.recordedActions.push(navigationAction);

                        // Send to main process via IPC
                        if (window.electronAPI && window.electronAPI.sendRecordingAction) {
                            window.electronAPI.sendRecordingAction(navigationAction);
                        }
                        if (self.currentRecording) {
                            self.currentRecording.actions.push(navigationAction);
                        }

                        // Show toast for navigation
                        self.showRecordingToast(`🧭 Action #${self.recordedActions.length}: Navigate to ${e.url}`);
                    }

                    // IMPORTANT: After navigation, the page context is completely new
                    // We MUST reinject the recording script regardless of previous state
                    const reinjectScript = (attempts = 0) => {
                        if (!self.isRecording || attempts > 5) return;


                        // Verify webview reference is still valid
                        const currentTab = self.getCurrentTab();
                        const activeWebview = currentTab?.webview;
                        if (activeWebview && activeWebview !== webview) {
                            console.warn('⚠️ Webview reference changed! Using new reference');
                            webview = activeWebview;
                        }

                        // Refresh console listener for new page context
                        self.ensureConsoleListenerActive(webview);

                        // Don't check if script exists - just inject it
                        // After navigation, the page context is new and needs the script
                        self.injectRecordingScript(webview);

                        // Verify injection was successful after a delay
                        setTimeout(() => {
                            webview.executeJavaScript(`
                                typeof window.__automationRecording !== 'undefined' && window.__automationRecording === true
                            `).then(success => {
                                if (success) {
                                } else if (self.isRecording) {
                                    reinjectScript(attempts + 1);
                                }
                            }).catch(err => {
                                if (self.isRecording) {
                                    reinjectScript(attempts + 1);
                                }
                            });
                        }, 300);
                    };

                    // Start reinjection immediately after navigation
                    // Use multiple delays to handle different page load speeds
                    setTimeout(() => reinjectScript(), 100);  // Fast pages
                    setTimeout(() => reinjectScript(), 500);  // Normal pages
                    setTimeout(() => reinjectScript(), 1000); // Slow pages
                }
            };
        }

        if (!this.automationDomReadyHandler) {
            this.automationDomReadyHandler = function() {
                // DOM ready means page has loaded - always ensure script is injected
                if (self.isRecording && self.recordingTabId === self.activeTabId) {

                    // Always inject on DOM ready - don't assume script persists
                    const ensureScriptInjected = () => {
                        // Refresh console listener
                        self.ensureConsoleListenerActive(webview);

                        // First try to inject
                        self.injectRecordingScript(webview);

                        // Then verify after a short delay
                        setTimeout(() => {
                            webview.executeJavaScript(`
                                typeof window.__automationRecording !== 'undefined' && window.__automationRecording === true
                            `).then(isActive => {
                                if (isActive) {
                                } else if (self.isRecording) {
                                    self.injectRecordingScript(webview);
                                }
                            }).catch(err => {
                                if (self.isRecording) {
                                    self.injectRecordingScript(webview);
                                }
                            });
                        }, 200);
                    };

                    // Small delay to let page settle, then inject
                    setTimeout(ensureScriptInjected, 100);
                }
            };
        }

        if (!this.automationInPageNavHandler) {
            this.automationInPageNavHandler = function(e) {
                // Handle SPA navigation
                if (self.isRecording && self.recordingTabId === self.activeTabId && e.isMainFrame) {

                    // Record in-page navigation
                    const navigationAction = {
                        type: 'navigate-spa',
                        url: e.url,
                        timestamp: Date.now()
                    };
                    self.recordedActions.push(navigationAction);
                    if (self.currentRecording) {
                        self.currentRecording.actions.push(navigationAction);
                    }

                    // Show toast for SPA navigation
                    self.showRecordingToast(`🧭 Action #${self.recordedActions.length}: SPA Navigate to ${e.url}`);

                    // For SPA navigation, verify script is still active with retries
                    const verifySPAScript = (attempts = 0) => {
                        if (!self.isRecording || attempts > 3) return;

                        setTimeout(() => {
                            webview.executeJavaScript(`
                                typeof window.__automationRecording !== 'undefined' && window.__automationRecording === true
                            `).then(isRecording => {
                                if (!isRecording) {
                                    self.injectRecordingScript(webview);

                                    // Verify reinjection
                                    setTimeout(() => {
                                        webview.executeJavaScript('window.__automationRecording === true').then(success => {
                                            if (!success && self.isRecording) {
                                                verifySPAScript(attempts + 1);
                                            } else {
                                            }
                                        });
                                    }, 200);
                                } else {
                                }
                            }).catch(() => {
                                if (self.isRecording) {
                                    self.injectRecordingScript(webview);
                                }
                            });
                        }, 200);
                    };

                    verifySPAScript();
                }
            };
        }

        // Add did-finish-load handler for when page is fully loaded
        if (!this.automationFinishLoadHandler) {
            this.automationFinishLoadHandler = function() {
                if (self.isRecording && self.recordingTabId === self.activeTabId) {

                    // Refresh console listener for the fully loaded page
                    self.ensureConsoleListenerActive(webview);

                    // Inject script when page is fully loaded
                    self.injectRecordingScript(webview);

                    // Test if console messages are still being received
                    setTimeout(() => {
                        // First, just test a simple console.log
                        webview.executeJavaScript(`
                            'test-executed';
                        `).then(result => {
                        }).catch(err => {
                            console.error('❌ Failed to execute simple test:', err);
                        });

                        // Then test our automation message
                        setTimeout(() => {
                            webview.executeJavaScript(`
                                'automation-test-sent';
                            `).then(result => {
                            }).catch(err => {
                                console.error('❌ Failed to send automation test:', err);
                            });
                        }, 500);
                    }, 1500);
                }
            };
        }

        // Add the navigation listeners
        webview.addEventListener('did-navigate', this.automationNavigationHandler);
        webview.addEventListener('dom-ready', this.automationDomReadyHandler);
        webview.addEventListener('did-navigate-in-page', this.automationInPageNavHandler);
        webview.addEventListener('did-finish-load', this.automationFinishLoadHandler);

        // Add a periodic check to ensure script stays active during recording
        if (!this.recordingHealthCheck) {
            this.recordingHealthCheck = setInterval(() => {
                if (self.isRecording && self.recordingTabId === self.activeTabId) {
                    webview.executeJavaScript(`
                        typeof window.__automationRecording !== 'undefined' && window.__automationRecording === true
                    `).then(isActive => {
                        if (!isActive) {
                            self.injectRecordingScript(webview);
                        }
                    }).catch(() => {
                        // Silent fail - page might be loading
                    });
                }
            }, 2000); // Check every 2 seconds
        }

    }

    cleanupNavigationTracking(webview) {
        // Remove navigation listeners
        if (this.automationNavigationHandler) {
            webview.removeEventListener('did-navigate', this.automationNavigationHandler);
        }
        if (this.automationDomReadyHandler) {
            webview.removeEventListener('dom-ready', this.automationDomReadyHandler);
        }
        if (this.automationInPageNavHandler) {
            webview.removeEventListener('did-navigate-in-page', this.automationInPageNavHandler);
        }
        if (this.automationFinishLoadHandler) {
            webview.removeEventListener('did-finish-load', this.automationFinishLoadHandler);
        }

        // Clear the health check interval
        if (this.recordingHealthCheck) {
            clearInterval(this.recordingHealthCheck);
            this.recordingHealthCheck = null;
        }

    }

    saveAutomation() {
        // Create a simple inline prompt dialog
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:white;padding:20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);min-width:300px;';
        dialog.innerHTML = `
            <h3 style="margin:0 0 15px 0;color:#333;">Save Automation</h3>
            <input type="text" id="automation-name-input-temp"
                   style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;box-sizing:border-box;"
                   placeholder="Enter automation name"
                   value="${this.currentRecording?.title || 'My Automation'}">
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="automation-cancel-temp" style="padding:8px 16px;background:#ccc;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
                <button id="automation-save-temp" style="padding:8px 16px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;">Save</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const input = document.getElementById('automation-name-input-temp');
        const saveBtn = document.getElementById('automation-save-temp');
        const cancelBtn = document.getElementById('automation-cancel-temp');

        input.focus();
        input.select();

        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        const save = () => {
            const name = input.value.trim();
            if (!name) {
                this.showNotification('Please enter a name', 'warning');
                return;
            }

            cleanup();

            const automation = {
                id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                name: name,
                url: this.currentRecording.url,
                actions: this.recordedActions,
                viewport: this.recordingViewport || { width: 1280, height: 720 },
                created: new Date().toISOString(),
                version: '1.1'
            };

            this.savedAutomations.push(automation);
            this.saveAutomationsToStorage();
            this.populateAutomationList();
            this.createAutomationBookmark(automation);

            this.showNotification(`Automation "${name}" saved with ${this.recordedActions.length} actions!`, 'success');
            this.recordedActions = [];
            this.currentRecording = null;
        };

        const cancel = () => {
            cleanup();
            this.showNotification('Automation not saved', 'warning');
            this.recordedActions = [];
            this.currentRecording = null;
        };

        saveBtn.addEventListener('click', save);
        cancelBtn.addEventListener('click', cancel);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
        });
    }


    saveAutomationAsBookmark() {
        const name = prompt('Enter a name for this bookmark:');
        if (!name) {
            this.recordedActions = [];
            this.currentRecording = null;
            return;
        }

        // Just create a regular bookmark
        const tab = this.getCurrentTab();
        this.addBookmark(tab.url, name, tab.favicon);

        this.recordedActions = [];
        this.currentRecording = null;
    }

    createAutomationBookmark(automation) {
        // Create a special bookmark for the automation
        const bookmark = {
            id: 'auto_' + automation.id,
            url: automation.url,
            title: '🎯 ' + automation.name,
            favicon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0Q0FGNTAiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJNMTIgNnY2bDQgMiIvPjwvc3ZnPg==',
            tags: ['automation', automation.name],
            description: `Automation with ${automation.actions.length} actions`,
            isAutomation: true,
            automationId: automation.id,
            aiAnalysis: {
                suggestedTags: ['automation'],
                summary: `Automated workflow for ${automation.url}`
            }
        };

        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.renderBookmarks();
    }

    loadAutomations() {
        const saved = localStorage.getItem('webAutomations');

        if (saved) {
            try {
                this.savedAutomations = JSON.parse(saved);

                // Log automation names for debugging
                this.savedAutomations.forEach((automation, index) => {
                });
            } catch (e) {
                console.error('❌ Failed to parse saved automations:', e);
                console.error('Raw data:', saved);
                this.savedAutomations = [];
            }
        } else {
            this.savedAutomations = [];
        }
        this.populateAutomationList();
    }

    saveAutomationsToStorage() {
        try {
            const data = JSON.stringify(this.savedAutomations);

            localStorage.setItem('webAutomations', data);

            // Verify save was successful
            const saved = localStorage.getItem('webAutomations');
            if (saved === data) {
            } else {
                console.error('⚠️ Save verification failed - data mismatch');
            }
        } catch (e) {
            console.error('❌ Failed to save automations:', e);
            if (e.name === 'QuotaExceededError') {
                console.error('💽 localStorage quota exceeded!');
                this.showNotification('Storage full - unable to save automation', 'error');
            }
        }
    }


    async playAutomationInNewWindow(automation) {
        // Play the automation with forceNewWindow flag
        return this.playPuppeteerAutomation(automation, true);
    }

    async playAutomation(automation) {

        // Display all actions in a formatted way
        automation.actions.forEach((action, index) => {
            console.log(`\n${index + 1}. ${action.type.toUpperCase()}`);

            switch(action.type) {
                case 'navigate':
                case 'navigate-spa':
                    break;
                case 'click':
                    break;
                case 'input':
                case 'type':
                    break;
                case 'keypress':
                    break;
                default:
            }
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Always use Puppeteer for playback
        return this.playPuppeteerAutomation(automation);

        // Use the simplified webview-based automation
        const tab = this.getCurrentTab();

        // Ensure we're in web mode for the tab
        if (!tab) {
            this.showNotification('No active tab to run automation', 'error');
            return;
        }

        // If tab is in welcome or claude mode, switch to web mode first
        if (tab.mode !== 'web') {
            tab.mode = 'web';
            this.showWebView(tab.id);
        }

        const webview = this.getOrCreateWebview(this.activeTabId);

        if (!webview) {
            this.showNotification('Failed to create webview for automation', 'error');
            return;
        }

        // Show notification
        this.showNotification(`▶️ Playing automation "${automation.name}"...`, 'info');

        try {
            // Use the SimplifiedAutomation class that's already defined in this file
            const simplifiedAutomationCode = this.getSimplifiedAutomationClass();

            await webview.executeJavaScript(`
                ${simplifiedAutomationCode}

                (async function() {
                    const automationInstance = new SimplifiedAutomation();
                    await automationInstance.playAutomation(${JSON.stringify(automation.actions)});
                })();
            `);

            this.showNotification(`✅ Automation "${automation.name}" completed!`, 'success');
        } catch (error) {
            console.error('❌ Automation playback error:', error);
            console.error('Stack trace:', error.stack);
            this.showNotification(`❌ Automation failed: ${error.message}`, 'error');
        }
    }

    // Automation dropdown helper methods
    toggleAutomationMenu() {
        if (this.automationMenu) {
            this.automationMenu.classList.toggle('hidden');
        }
    }

    hideAutomationMenu() {
        this.automationMenu.classList.add('hidden');
    }

    bookmarkCurrentPage() {
        // Use the existing smart bookmark functionality
        this.createSmartBookmark();
    }

    showAllBookmarksDialog() {
        // Show bookmarks bar if hidden
        if (this.bookmarksBar.classList.contains('hidden')) {
            this.toggleBookmarksBar();
        }
        // Flash the bookmarks bar to draw attention
        this.bookmarksBar.style.transition = 'background-color 0.3s';
        this.bookmarksBar.style.backgroundColor = '#fffde7';
        setTimeout(() => {
            this.bookmarksBar.style.backgroundColor = '';
        }, 600);
    }

    showSaveDialog() {

        const automationInfo = document.getElementById('automation-info');
        if (automationInfo) {
            automationInfo.textContent = `${this.recordedActions.length} actions recorded`;
        }
        this.saveAutomationDialog.classList.remove('hidden');

        // Focus the name input
        const nameInput = document.getElementById('automation-name-input');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }

    hideSaveDialog() {
        this.saveAutomationDialog.classList.add('hidden');

        // Clear the input
        const nameInput = document.getElementById('automation-name-input');
        if (nameInput) {
            nameInput.value = '';
        }

        // Note: recorded actions are cleared by the save/cancel handlers
        // Don't clear them here as this is called from multiple places

        // Ensure recording state is false and update UI
        this.isRecording = false;

        this.automationBtn.textContent = '🎯 Automations';
        this.automationBtn.style.color = '';
        this.hideRecordingIndicator();

        this.populateAutomationList();
    }

    handleSaveAutomation() {
        const nameInput = document.getElementById('automation-name-input');
        const name = nameInput?.value.trim();

        if (!name) {
            this.showNotification('Please enter a name for the automation', 'error');
            return;
        }

        if (this.recordedActions.length === 0) {
            this.showNotification('No actions to save', 'error');
            return;
        }

        // Save the automation with viewport info
        const automation = {
            id: Date.now().toString(),
            name: name,
            actions: this.recordedActions,
            viewport: this.recordingViewport || null, // Include viewport dimensions if available
            createdAt: new Date().toISOString()
        };

        this.savedAutomations.push(automation);
        this.saveAutomationsToStorage();

        this.showNotification(`Automation "${name}" saved successfully`, 'success');

        // Ensure recording state is false and clear actions
        this.isRecording = false;
        this.recordedActions = [];

        // Hide dialog and update UI
        this.hideSaveDialog();

        // Force a UI refresh after a short delay to ensure all async operations complete
        setTimeout(() => {
            this.isRecording = false;
            this.automationBtn.textContent = '🎯 Automations';
            this.automationBtn.style.color = '';
            this.populateAutomationList();
        }, 100);
    }

    populateAutomationList() {

        const savedAutomationsMenu = document.getElementById('saved-automations-menu');
        if (!savedAutomationsMenu) {
            console.warn('Saved automations menu element not found');
            return;
        }

        // Update the record button based on recording state
        const recordMenuItem = document.querySelector('[data-action="record"]') || document.querySelector('[data-action="stop"]');

        if (recordMenuItem) {
            if (this.isRecording) {
                recordMenuItem.innerHTML = '⏹ Stop Recording';
                recordMenuItem.dataset.action = 'stop';
            } else {
                recordMenuItem.innerHTML = '📹 Record New Automation';
                recordMenuItem.dataset.action = 'record';
            }
        } else {
            console.warn('🔍 Record menu item not found!');
        }

        // Clear existing items
        savedAutomationsMenu.innerHTML = '';

        if (!this.savedAutomations || this.savedAutomations.length === 0) {
            savedAutomationsMenu.innerHTML = '<div class="no-automations-menu">No saved automations</div>';
            return;
        }

        // Add automation items
        this.savedAutomations.forEach(automation => {
            const item = document.createElement('div');
            item.className = 'automation-menu-item';
            item.innerHTML = `
                <span class="automation-name">${automation.name}</span>
                <span class="automation-actions">(${automation.actions.length} actions)</span>
                <button class="automation-delete" data-id="${automation.id}" title="Delete automation">×</button>
            `;

            // Click to run automation
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('automation-delete')) {
                    this.playAutomation(automation);
                    this.hideAutomationMenu();
                }
            });

            // Delete automation
            const deleteBtn = item.querySelector('.automation-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteAutomation(automation.id);
            });

            savedAutomationsMenu.appendChild(item);
        });
    }

    deleteAutomation(automationId) {
        const automation = this.savedAutomations.find(a => a.id === automationId);
        if (!automation) return;

        if (confirm(`Delete automation "${automation.name}"?`)) {
            this.savedAutomations = this.savedAutomations.filter(a => a.id !== automationId);
            this.saveAutomationsToStorage();
            this.populateAutomationList();
            this.showNotification(`Automation "${automation.name}" deleted`, 'info');
        }
    }

    // Simplified playback - no longer needs webview injection
    async playAutomationLegacy(automation) {

        // ============= INJECTION METHOD (only if USE_PUPPETEER is false) =============
        // The code below should NEVER run when USE_PUPPETEER is true

        const tab = this.getCurrentTab();

        // Ensure we're in web mode for the tab
        if (!tab) {
            this.showNotification('No active tab to run automation', 'error');
            return;
        }
        // If tab is in welcome or claude mode, switch to web mode first
        if (tab.mode !== 'web') {
            tab.mode = 'web';
            this.showWebView(tab.id);
        }

        const webview = this.getOrCreateWebview(this.activeTabId);

        if (!webview) {
            this.showNotification('Failed to create webview for automation', 'error');
            return;
        }

        // Inject RobustWebviewAutomation before running automation
        const automationScript = `
            ${this.getRobustAutomationCode()}
        `;

        try {
            await webview.executeJavaScript(automationScript);

            // Verify it was injected
            const checkScript = `typeof window.PlaywrightAutomation !== 'undefined'`;
            const isAvailable = await webview.executeJavaScript(checkScript);
        } catch (error) {
            console.error('❌ Failed to inject RobustWebviewAutomation for playback:', error);
            // Continue anyway, will fallback to simpler selectors
        }

        // Check if the first action is a navigate action (it should be)
        const firstAction = automation.actions[0];
        const startingUrl = firstAction && firstAction.type === 'navigate' ? firstAction.url : automation.url;

        // Make sure we have a valid starting URL
        if (!startingUrl) {
            this.showNotification('Automation has no starting URL', 'error');
            return;
        }

        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 STARTING AUTOMATION: ${automation.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Starting URL: ${startingUrl}
Current URL: ${tab.url || 'none'}
Webview src: ${webview.src || 'none'}
Tab mode: ${tab.mode}
Total Steps: ${automation.actions.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // Determine if we need to navigate
        // Check both tab.url and webview.src to handle all cases
        const currentUrl = webview.src || tab.url || '';

        // Parse URLs to handle fragments properly
        let needsNavigation = false;
        if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
            needsNavigation = true;
        } else {
            try {
                const currentUrlObj = new URL(currentUrl);
                const startingUrlObj = new URL(startingUrl);

                // Check if it's the same page (ignoring hash)
                const samePage = (
                    currentUrlObj.origin === startingUrlObj.origin &&
                    currentUrlObj.pathname === startingUrlObj.pathname &&
                    currentUrlObj.search === startingUrlObj.search
                );

                if (samePage) {
                    // Same page, might just need to update hash
                    if (currentUrlObj.hash !== startingUrlObj.hash) {
                    }
                    needsNavigation = false;
                } else {
                    // Different page
                    needsNavigation = true;
                }
            } catch (e) {
                // If URL parsing fails, do a simple string comparison
                needsNavigation = !currentUrl.startsWith(startingUrl.split('#')[0]);
            }
        }

        if (needsNavigation) {

            // Update tab URL immediately
            tab.url = startingUrl;
            this.addressBar.value = startingUrl;

            // Load the URL in the webview
            webview.src = startingUrl;

            // Wait for page to load before running automation
            const loadHandler = () => {
                webview.__automationStarted = true; // Mark as started to prevent double execution
                setTimeout(() => {
                    // If first action is navigate (to the same URL), skip it since we just navigated
                    const actionsToRun = firstAction && firstAction.type === 'navigate' && firstAction.url === startingUrl
                        ? automation.actions.slice(1)  // Skip the first navigation
                        : automation.actions;

                    this.executeAutomationActions(webview, actionsToRun);
                }, 1500); // Give page time to fully load
            };

            // Use did-finish-load for Electron webviews
            webview.addEventListener('did-finish-load', loadHandler, { once: true });

            // Also add a timeout fallback in case did-finish-load doesn't fire
            setTimeout(() => {
                // Check if we already started executing
                if (!webview.__automationStarted) {
                    webview.removeEventListener('did-finish-load', loadHandler);
                    loadHandler();
                }
            }, 5000);
        } else {

            // Always navigate to ensure we start from a clean state
            tab.url = startingUrl;
            this.addressBar.value = startingUrl;
            webview.src = startingUrl;

            // Wait for page to load before running automation
            const loadHandler = () => {
                webview.__automationStarted = true;
                setTimeout(() => {
                    // If first action is navigate (to the same URL), skip it since we just navigated
                    const actionsToRun = firstAction && firstAction.type === 'navigate' && firstAction.url === startingUrl
                        ? automation.actions.slice(1)
                        : automation.actions;

                    this.executeAutomationActions(webview, actionsToRun);
                }, 1500);
            };

            webview.addEventListener('did-finish-load', loadHandler, { once: true });

            // Timeout fallback
            setTimeout(() => {
                if (!webview.__automationStarted) {
                    webview.removeEventListener('did-finish-load', loadHandler);
                    loadHandler();
                }
            }, 5000);
        }

        this.automationMenu.classList.add('hidden');
        this.showNotification(`Playing automation "${automation.name}"...`, 'info');
    }

    async executeAutomationActions(webview, actions) {
        if (actions.length > 0) {
        }

        // Helper function for safe script execution
        const safeExecuteScript = async (script, fallback = null) => {
            try {
                if (this.debugMode) {
                }

                // Check if webview is still valid
                if (!webview || !webview.getURL) {
                    throw new Error('Webview is no longer valid');
                }

                return await webview.executeJavaScript(script);
            } catch (error) {
                console.error('Script execution failed:', error);

                // Check for detached frame error
                if (error.message && error.message.includes('detached Frame')) {
                    console.warn('Frame was detached - this usually happens after navigation. Will retry after page loads.');
                    // Return fallback or wait for next action
                    if (fallback !== null) {
                        return fallback;
                    }
                    // Don't throw the error, let the automation continue
                    return null;
                }

                console.error('Failed script (first 500 chars):', script.substring(0, 500) + (script.length > 500 ? '...' : ''));
                if (this.debugMode) {
                    console.error('DEBUG: Full failed script:', script);
                }
                if (fallback !== null) {
                    return fallback;
                }
                throw error;
            }
        };

        // Initialize RPA Engine
        let rpa;
        try {
            if (typeof RPAEngine === 'undefined') {
                console.error('RPAEngine is not defined! Check if rpa-engine.js is loaded');
                this.showNotification('RPA Engine not loaded!', 'error');
                return;
            }
            rpa = new RPAEngine(webview);
            rpa.config.debugMode = true;
        } catch (error) {
            console.error('Failed to initialize RPA Engine:', error);
            this.showNotification('Failed to initialize automation engine', 'error');
            return;
        }

        let actionIndex = 0;
        let retryCount = 0;
        const maxRetries = 2;
        let successfulActions = 0;
        let failedActions = [];

        // Create progress overlay
        const progressOverlay = document.createElement('div');
        progressOverlay.id = 'automation-progress-overlay';
        progressOverlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            min-width: 300px;
            max-width: 400px;
            font-family: monospace;
            font-size: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(progressOverlay);

        // Track if automation is paused or should skip
        let isPaused = false;
        let shouldSkip = false;
        let shouldStop = false;

        const updateProgress = (message, type = 'info') => {
            const colors = {
                info: '#4CAF50',
                warning: '#FF9800',
                error: '#F44336',
                success: '#2196F3'
            };

            const timestamp = new Date().toLocaleTimeString();
            progressOverlay.innerHTML = `
                <div style="border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 10px;">
                    <strong style="color: ${colors[type]}">🤖 AUTOMATION PROGRESS</strong>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Step ${actionIndex + 1} of ${actions.length}</strong> (${Math.round((actionIndex / actions.length) * 100)}%)
                </div>
                <div style="margin-bottom: 10px;">
                    ✅ Successful: ${successfulActions} | ❌ Failed: ${failedActions.length}
                </div>
                <div style="color: ${colors[type]}; margin-bottom: 10px;">
                    [${timestamp}] ${message}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="skip-action-btn" style="
                        background: #FF9800;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">⏭️ Skip Step</button>
                    <button id="pause-automation-btn" style="
                        background: ${isPaused ? '#4CAF50' : '#2196F3'};
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">${isPaused ? '▶️ Resume' : '⏸️ Pause'}</button>
                    <button id="stop-automation-btn" style="
                        background: #F44336;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">⏹️ Stop</button>
                    <button id="debug-toggle-btn" style="
                        background: ${this.debugMode ? '#4CAF50' : '#666'};
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">🐛 Debug ${this.debugMode ? 'ON' : 'OFF'}</button>
                </div>
                ${this.debugMode ? `
                    <div id="debug-info" style="
                        background: rgba(255,255,255,0.1);
                        border-radius: 4px;
                        padding: 10px;
                        margin-top: 10px;
                        font-size: 10px;
                        max-height: 150px;
                        overflow-y: auto;
                        border: 1px solid #444;
                    ">
                        <strong>Debug Info:</strong><br>
                        <div id="debug-content">Ready for debugging...</div>
                    </div>
                ` : ''}
                ${failedActions.length > 0 ? `
                    <div style="color: #FF5252; font-size: 11px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px;">
                        <strong>Failed Actions:</strong><br>
                        ${failedActions.slice(-3).map(f => `Step ${f.step}: ${f.error}`).join('<br>')}
                    </div>
                ` : ''}
            `;

            // Add event listeners to buttons
            const skipBtn = document.getElementById('skip-action-btn');
            const pauseBtn = document.getElementById('pause-automation-btn');
            const stopBtn = document.getElementById('stop-automation-btn');

            if (skipBtn) {
                skipBtn.onclick = () => {
                    shouldSkip = true;
                    updateProgress('Skipping current step...', 'warning');
                };
            }

            if (pauseBtn) {
                pauseBtn.onclick = () => {
                    isPaused = !isPaused;
                    updateProgress(isPaused ? 'Automation paused' : 'Automation resumed', 'info');
                };
            }

            if (stopBtn) {
                stopBtn.onclick = () => {
                    shouldStop = true;
                    updateProgress('Stopping automation...', 'error');
                };
            }

            const debugBtn = document.getElementById('debug-toggle-btn');
            if (debugBtn) {
                debugBtn.onclick = () => {
                    this.debugMode = !this.debugMode;
                    localStorage.setItem('automationDebugMode', this.debugMode.toString());
                    updateProgress(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`, 'info');
                };
            }
        };

        // Helper function to update debug info
        const updateDebugInfo = (info) => {
            if (this.debugMode) {
                const debugContent = document.getElementById('debug-content');
                if (debugContent) {
                    const timestamp = new Date().toLocaleTimeString();
                    debugContent.innerHTML = `[${timestamp}] ${info}<br>` + debugContent.innerHTML;
                    // Keep only last 10 debug entries
                    const lines = debugContent.innerHTML.split('<br>');
                    if (lines.length > 10) {
                        debugContent.innerHTML = lines.slice(0, 10).join('<br>');
                    }
                }
            }
        };

        const executeNextAction = async () => {
            // Check for stop condition
            if (shouldStop) {
                updateProgress('Automation stopped by user', 'error');
                setTimeout(() => {
                    progressOverlay.remove();
                    this.showNotification('Automation stopped', 'warning');
                }, 1000);
                return;
            }

            // Check for pause condition
            while (isPaused) {
                await rpa.sleep(100);
                if (shouldStop) return;
            }

            try {
            } catch (e) {
                console.error('Error in executeNextAction logging:', e);
            }

            if (actionIndex >= actions.length) {
                updateProgress('AUTOMATION COMPLETED!', 'success');

                // Export RPA log
                const rpaLog = rpa.exportLog();

                setTimeout(() => {
                    progressOverlay.remove();
                    const summary = `
Automation Completed!
━━━━━━━━━━━━━━━━━━
✅ Successful: ${successfulActions}/${actions.length}
❌ Failed: ${failedActions.length}/${actions.length}
${failedActions.length > 0 ? '\nFailed steps:\n' + failedActions.map(f => `  • Step ${f.step}: ${f.action} - ${f.error}`).join('\n') : ''}
                    `;
                    this.showNotification(`Automation completed: ${successfulActions}/${actions.length} successful`,
                                         failedActions.length > 0 ? 'warning' : 'success');
                }, 2000);
                return;
            }

            const action = actions[actionIndex];


            // Check if user wants to skip this step
            if (shouldSkip) {
                updateProgress(`Skipped step ${actionIndex + 1}`, 'warning');
                failedActions.push({
                    step: actionIndex + 1,
                    action: action.type,
                    error: 'Skipped by user'
                });
                shouldSkip = false;
                actionIndex++;
                retryCount = 0;
                setTimeout(() => executeNextAction(), 500);
                return;
            }

            // Create timeout wrapper for each action
            const actionTimeout = action.type === 'navigate' ? 20000 : 15000; // Longer timeout for navigation
            let timeoutId;
            let actionCompleted = false;
            let skipCheckInterval;

            // Check periodically if user wants to skip
            skipCheckInterval = setInterval(() => {
                if (shouldSkip && !actionCompleted) {
                    actionCompleted = true;
                    clearTimeout(timeoutId);
                    clearInterval(skipCheckInterval);
                }
            }, 100);

            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    if (!actionCompleted && !shouldSkip) {
                        reject(new Error(`Action timeout after ${actionTimeout/1000} seconds`));
                    }
                }, actionTimeout);
            });

            const actionPromise = (async () => {
                try {
                    // Debug logging - emphasize selector usage
                    if (action.selector) {
                        updateDebugInfo(`Action ${actionIndex + 1}: ${action.type} using ${action.isXPath ? 'XPath' : 'CSS'} selector`);
                        updateDebugInfo(`Selector: ${action.selector.substring(0, 100)}${action.selector.length > 100 ? '...' : ''}`);
                    } else {
                        updateDebugInfo(`❌ Action ${actionIndex + 1}: ${action.type} - NO SELECTOR AVAILABLE`);
                        console.error('❌ Cannot execute action without selector:', action);
                        throw new Error('No selector available for action');
                    }

                    // Use RPA Engine for action execution
                    let success = false;

                    switch (action.type) {
                    case 'navigate':
                    case 'navigate-spa':
                        updateProgress(`Navigating to: ${action.url}`, 'info');

                        // Check if this is a SPA navigation (same origin/path, different hash)
                        try {
                            const currentUrl = await safeExecuteScript('window.location.href', '');

                            if (currentUrl && action.url) {
                                const currentUrlObj = new URL(currentUrl);
                                const targetUrlObj = new URL(action.url);

                                // Check if it's the same base page (origin, pathname, search params before hash)
                                // This handles both standard fragment navigation and SPAs with params after hash
                                const isSameBasePage = (
                                    currentUrlObj.origin === targetUrlObj.origin &&
                                    currentUrlObj.pathname === targetUrlObj.pathname &&
                                    currentUrlObj.search === targetUrlObj.search
                                );

                                if (isSameBasePage) {
                                    // This is a SPA/fragment navigation - don't reload the page
                                    updateDebugInfo(`SPA navigation detected: ${currentUrlObj.hash || '(root)'} -> ${targetUrlObj.hash || '(root)'}`);

                                    // Use location.href to handle all hash changes including those with params
                                    // This works for standard fragments (#section) and complex ones (#page?param=value)
                                    await safeExecuteScript(`
                                        (function() {
                                            // Store current scroll position
                                            const scrollPos = { x: window.scrollX, y: window.scrollY };

                                            // Update the URL - this handles all hash formats
                                            window.location.href = ${JSON.stringify(action.url)};

                                            // Some SPAs need a small delay to process the hash change
                                            setTimeout(() => {
                                                // Restore scroll if the SPA reset it
                                                if (window.scrollX === 0 && window.scrollY === 0 &&
                                                    (scrollPos.x !== 0 || scrollPos.y !== 0)) {
                                                    window.scrollTo(scrollPos.x, scrollPos.y);
                                                }
                                            }, 100);

                                            return true;
                                        })()
                                    `, true);

                                    // Wait for SPA to process the navigation
                                    await rpa.sleep(2000);
                                    success = true;
                                } else {
                                    // Different page - do a full navigation
                                    webview.loadURL(action.url);
                                    await rpa.waitForNavigation({ timeout: 10000 });

                                    // Wait a bit for the page to stabilize
                                    await rpa.sleep(1500);

                                    // Re-inject PlaywrightAutomation after navigation
                                    const playwrightScript = `
                                        (function() {
                                            ${self.getRobustAutomationCode()}
                                            if (typeof window.PlaywrightAutomation !== 'undefined') {
                                                return true;
                                            } else {
                                                console.error('❌ PlaywrightAutomation NOT available in webview');
                                                return false;
                                            }
                                        })();
                                    `;
                                    try {
                                        const injected = await webview.executeJavaScript(playwrightScript);

                                        // Verify it's actually there
                                        const checkScript = `typeof window.PlaywrightAutomation !== 'undefined'`;
                                        const isAvailable = await webview.executeJavaScript(checkScript);

                                        // Additional wait for dynamic content to load
                                        await rpa.sleep(500);
                                    } catch (e) {
                                        console.error('Failed to re-inject PlaywrightAutomation:', e);
                                    }

                                    success = true;
                                }
                            } else {
                                // Fallback to full navigation if we can't get current URL
                                webview.loadURL(action.url);
                                await rpa.waitForNavigation({ timeout: 10000 });

                                // Wait a bit for the page to stabilize
                                await rpa.sleep(1500);

                                // Re-inject PlaywrightAutomation after navigation
                                const playwrightScript = `
                                    ${self.getRobustAutomationCode()}
                                `;
                                try {
                                    await webview.executeJavaScript(playwrightScript);

                                    // Additional wait for dynamic content to load
                                    await rpa.sleep(500);
                                } catch (e) {
                                    console.error('Failed to re-inject PlaywrightAutomation:', e);
                                }

                                success = true;
                            }
                        } catch (error) {
                            console.error('Navigation error:', error);
                            // Fallback to full navigation on error
                            webview.loadURL(action.url);
                            await rpa.waitForNavigation({ timeout: 10000 });

                            // Wait a bit for the page to stabilize
                            await rpa.sleep(1500);

                            // Re-inject PlaywrightAutomation after navigation
                            const playwrightScript = `
                                ${self.getRobustAutomationCode()}
                            `;
                            try {
                                await webview.executeJavaScript(playwrightScript);

                                // Additional wait for dynamic content to load
                                await rpa.sleep(500);
                            } catch (e) {
                                console.error('Failed to re-inject PlaywrightAutomation:', e);
                            }

                            success = true;
                        }
                        break;

                    case 'click':
                    case 'form-click':
                        // Use Playwright automation for clicking
                        if (action.selector || action.allSelectors) {
                            updateProgress(`Clicking element: ${action.selector ? action.selector.substring(0, 50) : 'with Playwright'}...`, 'info');

                            try {
                                // Try Playwright automation first
                                const clickResult = await safeExecuteScript(`
                                    (async function() {

                                        // Debug: Check what elements exist on the page
                                        const debugInfo = {
                                            hasTextarea: document.querySelector('textarea[name="q"]') !== null,
                                            hasInput: document.querySelector('input[name="q"]') !== null,
                                            hasAnyQ: document.querySelector('[name="q"]') !== null,
                                            totalTextareas: document.querySelectorAll('textarea').length,
                                            totalInputs: document.querySelectorAll('input').length
                                        };

                                        // Try direct element finding
                                        const searchBox = document.querySelector('[name="q"]');
                                        if (searchBox) {
                                                tagName: searchBox.tagName,
                                                name: searchBox.name,
                                                id: searchBox.id,
                                                visible: searchBox.offsetParent !== null
                                            });
                                        } else {
                                        }

                                        // Use Playwright automation if available
                                        if (typeof PlaywrightAutomation !== 'undefined') {
                                            const automation = new PlaywrightAutomation();
                                            const actionData = ${JSON.stringify(action)};

                                                selector: actionData.selector,
                                                hasAllSelectors: !!actionData.allSelectors,
                                                selectorsCount: actionData.allSelectors ? actionData.allSelectors.length : 0
                                            });

                                            // Try with all selectors if available
                                            if (actionData.allSelectors) {
                                                for (const selectorInfo of actionData.allSelectors) {
                                                    const success = await automation.click(selectorInfo);
                                                    if (success) {
                                                        return {
                                                            success: true,
                                                            tagName: 'element',
                                                            text: 'Clicked with Playwright'
                                                        };
                                                    }
                                                }
                                            } else if (actionData.selector) {
                                                // Try with single selector
                                                const selectorInfo = {
                                                    selector: actionData.selector,
                                                    type: actionData.type || 'css'
                                                };
                                                const success = await automation.click(selectorInfo);
                                                if (success) {
                                                    return {
                                                        success: true,
                                                        tagName: 'element',
                                                        text: 'Clicked with Playwright'
                                                    };
                                                }
                                            }
                                        }

                                        // Fallback to original wait mechanism if Playwright not available
                                        const waitForElement = async (selector, isXPath, timeout = 3000) => {
                                            const startTime = Date.now();
                                            while (Date.now() - startTime < timeout) {
                                                let element = null;

                                                try {
                                                    if (isXPath) {
                                                        const result = document.evaluate(selector, document, null,
                                                            XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                                        element = result.singleNodeValue;
                                                    } else {
                                                        try {
                                                            element = document.querySelector(selector);
                                                        } catch(e) {
                                                            // Try as XPath if CSS fails
                                                            const result = document.evaluate(selector, document, null,
                                                                XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                                            element = result.singleNodeValue;
                                                        }
                                                    }

                                                    // Check if visible
                                                    if (element && element.offsetParent !== null) {
                                                        return element;
                                                    }
                                                } catch(e) {
                                                    // Continue waiting
                                                }

                                                await new Promise(resolve => setTimeout(resolve, 100));
                                            }
                                            return null;
                                        };

                                        const selector = ${JSON.stringify(action.selector)};
                                        const isXPath = ${action.isXPath ? 'true' : 'false'};

                                        const element = await waitForElement(selector, isXPath);

                                            if (element) {
                                                // Ensure element is visible and in viewport
                                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                                // Wait a bit for scroll to complete
                                                setTimeout(() => {
                                                    // Focus the element if it's focusable
                                                    if (typeof element.focus === 'function') {
                                                        element.focus();
                                                    }

                                                    // Trigger click event
                                                    element.click();

                                                    // Also dispatch a synthetic click event for better compatibility
                                                    const clickEvent = new MouseEvent('click', {
                                                        view: window,
                                                        bubbles: true,
                                                        cancelable: true,
                                                        buttons: 1
                                                    });
                                                    element.dispatchEvent(clickEvent);
                                                }, 300);

                                                return {
                                                    success: true,
                                                    tagName: element.tagName,
                                                    text: element.textContent ? element.textContent.substring(0, 50) : ''
                                                };
                                            } else {
                                                return { success: false, error: 'Element not found' };
                                            }
                                        } catch (e) {
                                            return { success: false, error: e.message };
                                        }
                                    })()
                                `, { success: false });

                                // Wait for the click to process
                                await rpa.sleep(600);

                                if (clickResult && clickResult.success) {
                                    success = true;
                                    updateDebugInfo(`✓ Clicked element via ${action.isXPath ? 'XPath' : 'CSS'}: ${action.selector}`);
                                } else {
                                    // Element not found - fail the action
                                    throw new Error(`Element not found with selector: ${action.selector}`);
                                }
                            } catch (err) {
                                throw new Error(`Failed to click element: ${err.message}`);
                            }
                        } else {
                            throw new Error('No selector available for click action');
                        }
                        break;

                    case 'hover':
                        // Use Playwright automation for hover
                        if (action.selector || action.allSelectors) {
                            updateProgress(`Hovering over element: ${action.selector ? action.selector.substring(0, 50) : 'with Playwright'}...`, 'info');

                            try {
                                const hoverResult = await safeExecuteScript(`
                                    (async function() {
                                        // Use Playwright automation if available
                                        if (typeof PlaywrightAutomation !== 'undefined') {
                                            const automation = new PlaywrightAutomation();
                                            const actionData = ${JSON.stringify(action)};

                                            // Try with all selectors if available
                                            if (actionData.allSelectors) {
                                                for (const selectorInfo of actionData.allSelectors) {
                                                    const success = await automation.hover(selectorInfo);
                                                    if (success) {
                                                        return {
                                                            success: true,
                                                            tagName: 'element',
                                                            hasDropdown: true
                                                        };
                                                    }
                                                }
                                            } else if (actionData.selector) {
                                                const selectorInfo = {
                                                    selector: actionData.selector,
                                                    type: actionData.type || 'css'
                                                };
                                                const success = await automation.hover(selectorInfo);
                                                if (success) {
                                                    return {
                                                        success: true,
                                                        tagName: 'element',
                                                        hasDropdown: true
                                                    };
                                                }
                                            }
                                        }

                                        // Fallback to original mechanism
                                        let element = null;
                                        const selector = ${JSON.stringify(action.selector)};
                                        const isXPath = ${action.isXPath ? 'true' : 'false'};

                                        try {
                                            if (isXPath) {
                                                const result = document.evaluate(selector, document, null,
                                                    XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                                element = result.singleNodeValue;
                                            } else {
                                                // CSS selector with fallback
                                                try {
                                                    element = document.querySelector(selector);
                                                } catch(e) {
                                                    // Try as XPath if CSS fails
                                                    const result = document.evaluate(selector, document, null,
                                                        XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                                    element = result.singleNodeValue;
                                                }
                                            }

                                            // Check visibility
                                            if (element && element.offsetParent === null) {
                                                element = null;
                                            }

                                            if (element) {
                                                // Scroll element into view
                                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                                // Capture initial DOM state for dynamic content detection
                                                const initialChildCount = document.body.querySelectorAll('*').length;
                                                const initialDropdowns = document.querySelectorAll('[role="menu"], .dropdown-menu, .submenu, .popup, .tooltip').length;

                                                // Wait for scroll then trigger hover events
                                                setTimeout(() => {
                                                    // Trigger multiple hover-related events for maximum compatibility
                                                    const events = ['mouseenter', 'mouseover', 'mousemove'];
                                                    events.forEach(eventType => {
                                                        const event = new MouseEvent(eventType, {
                                                            view: window,
                                                            bubbles: true,
                                                            cancelable: true
                                                        });
                                                        element.dispatchEvent(event);
                                                    });

                                                    // Focus the element if focusable
                                                    if (typeof element.focus === 'function') {
                                                        element.focus();
                                                    }

                                                    // Check for dynamic content after a delay
                                                    setTimeout(() => {
                                                        const newChildCount = document.body.querySelectorAll('*').length;
                                                        const newDropdowns = document.querySelectorAll('[role="menu"], .dropdown-menu, .submenu, .popup, .tooltip').length;
                                                        const dynamicContentAppeared = (newChildCount > initialChildCount) || (newDropdowns > initialDropdowns);

                                                        if (dynamicContentAppeared) {
                                                        }
                                                    }, 1000);
                                                }, 300);

                                                return {
                                                    success: true,
                                                    tagName: element.tagName,
                                                    hasDropdown: element.getAttribute('data-toggle') || element.getAttribute('aria-haspopup')
                                                };
                                            } else {
                                                return { success: false, error: 'Element not found' };
                                            }
                                        } catch (e) {
                                            return { success: false, error: e.message };
                                        }
                                    })()
                                `, { success: false });

                                // Wait for hover effects and dynamic content
                                await rpa.sleep(1800);

                                if (hoverResult && hoverResult.success) {
                                    updateDebugInfo(`✓ Hovered over element and waited for dynamic content`);
                                    success = true;
                                } else {
                                    throw new Error(`Element not found with selector: ${action.selector}`);
                                }
                            } catch (err) {
                                throw new Error(`Failed to hover over element: ${err.message}`);
                            }
                        } else {
                            throw new Error('No selector available for hover action');
                        }
                        break;

                    case 'form-input':
                    case 'input':
                        updateProgress(`Typing: ${action.value?.substring(0, 30)}...`, 'info');

                        // Use Playwright automation for input
                        if (action.selector || action.allSelectors) {
                            try {
                                const inputResult = await safeExecuteScript(`
                                    (async function() {
                                        // Use Playwright automation if available
                                        if (typeof PlaywrightAutomation !== 'undefined') {
                                            const automation = new PlaywrightAutomation();
                                            const actionData = ${JSON.stringify(action)};
                                            const value = actionData.value || '';

                                            // Try with all selectors if available
                                            if (actionData.allSelectors) {
                                                for (const selectorInfo of actionData.allSelectors) {
                                                    const success = await automation.type(selectorInfo, value);
                                                    if (success) {
                                                        return {
                                                            success: true,
                                                            tagName: 'INPUT',
                                                            isContentEditable: false
                                                        };
                                                    }
                                                }
                                            } else if (actionData.selector) {
                                                const selectorInfo = {
                                                    selector: actionData.selector,
                                                    type: actionData.type || 'css'
                                                };
                                                const success = await automation.type(selectorInfo, value);
                                                if (success) {
                                                    return {
                                                        success: true,
                                                        tagName: 'INPUT',
                                                        isContentEditable: false
                                                    };
                                                }
                                            }
                                        }

                                        // Fallback to original mechanism
                                        let element = null;
                                        const selector = ${JSON.stringify(action.selector)};
                                        const isXPath = ${action.isXPath ? 'true' : 'false'};
                                        const value = ${JSON.stringify(action.value || '')};

                                        try {
                                            if (isXPath) {
                                                const result = document.evaluate(selector, document, null,
                                                    XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                                element = result.singleNodeValue;
                                            } else {
                                                // CSS selector with fallback
                                                try {
                                                    element = document.querySelector(selector);
                                                } catch(e) {
                                                    // Try as XPath if CSS fails
                                                    const result = document.evaluate(selector, document, null,
                                                        XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                                    element = result.singleNodeValue;
                                                }
                                            }

                                            // Check visibility
                                            if (element && element.offsetParent === null) {
                                                element = null;
                                            }

                                            if (element) {
                                                // Scroll element into view
                                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                                // Wait for scroll then input text
                                                setTimeout(() => {
                                                    // Focus the element
                                                    element.focus();

                                                    // Clear existing value
                                                    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                                                        element.value = '';
                                                        // Trigger input event for clearing
                                                        element.dispatchEvent(new Event('input', { bubbles: true }));
                                                    } else if (element.contentEditable === 'true') {
                                                        element.textContent = '';
                                                    }

                                                    // Type the new value
                                                    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                                                        // Set value directly for input/textarea
                                                        element.value = value;

                                                        // Trigger events for React/Vue/Angular compatibility
                                                        element.dispatchEvent(new Event('input', { bubbles: true }));
                                                        element.dispatchEvent(new Event('change', { bubbles: true }));
                                                        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                                                    } else if (element.contentEditable === 'true') {
                                                        // For contenteditable elements
                                                        element.textContent = value;

                                                        // Trigger input event
                                                        element.dispatchEvent(new Event('input', { bubbles: true }));
                                                    }
                                                }, 300);

                                                return {
                                                    success: true,
                                                    tagName: element.tagName,
                                                    isContentEditable: element.contentEditable === 'true'
                                                };
                                            } else {
                                                return { success: false, error: 'Element not found' };
                                            }
                                        } catch (e) {
                                            return { success: false, error: e.message };
                                        }
                                    })()
                                `, { success: false });

                                // Wait for the input to process
                                await rpa.sleep(600);

                                if (inputResult && inputResult.success) {
                                    success = true;
                                    updateDebugInfo(`✓ Typed into element via ${action.isXPath ? 'XPath' : 'CSS'}`);
                                } else {
                                    throw new Error(`Element not found with selector: ${action.selector}`);
                                }
                            } catch (err) {
                                throw new Error(`Failed to type into element: ${err.message}`);
                            }
                        } else {
                            throw new Error('No selector available for input action');
                        }
                        break;

                    case 'form-tab':
                        updateProgress(`Tab navigation`, 'info');
                        await rpa.keyPress('Tab');
                        await rpa.sleep(500);
                        success = true;
                        break;

                    case 'scroll':
                        updateProgress(`Scrolling`, 'info');
                        // Use selector-based scrolling if available
                        if (action.selector) {
                            const scrollResult = await safeExecuteScript(`
                                (function() {
                                    let element = null;
                                    const selector = ${JSON.stringify(action.selector)};
                                    const isXPath = ${action.isXPath ? 'true' : 'false'};

                                    try {
                                        if (isXPath) {
                                            const result = document.evaluate(selector, document, null,
                                                XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                                            element = result.singleNodeValue;
                                        } else {
                                            element = document.querySelector(selector);
                                        }

                                        if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            return { success: true };
                                        } else {
                                            // If no element, just scroll the page
                                            window.scrollBy(0, 300);
                                            return { success: true };
                                        }
                                    } catch (e) {
                                        return { success: false, error: e.message };
                                    }
                                })()
                            `, { success: false });
                            success = scrollResult && scrollResult.success;
                        } else {
                            // General page scroll
                            await safeExecuteScript(`window.scrollBy(0, 300)`, null);
                            success = true;
                        }
                        await rpa.sleep(500);
                        break;

                    case 'checkbox':
                    case 'check':
                    case 'radio':
                        updateProgress(`${action.inputType === 'radio' ? 'Radio' : 'Checkbox'} toggle`, 'info');

                        // Execute checkbox/radio toggle in webview
                        const checkResult = await safeExecuteScript(`
                            (function() {
                                const selector = ${JSON.stringify(action.selector || '')};
                                const shouldCheck = ${action.checked ? 'true' : 'false'};

                                const element = document.querySelector(selector);
                                if (element && (element.type === 'checkbox' || element.type === 'radio')) {
                                    // Scroll into view
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                    // Only click if state needs to change
                                    if (element.checked !== shouldCheck) {
                                        element.focus();
                                        element.click();

                                        // Also dispatch change event
                                        element.dispatchEvent(new Event('change', { bubbles: true }));
                                    }

                                    return { success: true, checked: element.checked };
                                } else {
                                    return { success: false, error: 'Checkbox/radio not found' };
                                }
                            })()
                        `, { success: false });

                        success = checkResult && checkResult.success;
                        if (success) {
                            updateDebugInfo(`✓ ${action.inputType || 'Checkbox'} toggled to: ${checkResult.checked}`);
                        }
                        await rpa.sleep(300);
                        break;

                    case 'mousemove':
                    case 'hover':
                        updateProgress(`Mouse ${action.type === 'hover' ? 'hovering' : 'moving'}`, 'info');

                        // Execute hover/mousemove in webview
                        const mouseResult = await safeExecuteScript(`
                            (function() {
                                const selector = ${JSON.stringify(action.selector || '')};
                                const x = ${action.x || 0};
                                const y = ${action.y || 0};

                                let element = null;
                                if (selector) {
                                    element = document.querySelector(selector);
                                }

                                if (!element && x && y) {
                                    element = document.elementFromPoint(x, y);
                                }

                                if (element) {
                                    // Scroll into view
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                    // Get position
                                    const rect = element.getBoundingClientRect();
                                    const targetX = x || (rect.left + rect.width / 2);
                                    const targetY = y || (rect.top + rect.height / 2);

                                    // Trigger hover events
                                    ['mouseenter', 'mouseover', 'mousemove'].forEach(eventType => {
                                        const event = new MouseEvent(eventType, {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: targetX,
                                            clientY: targetY
                                        });
                                        element.dispatchEvent(event);
                                    });

                                    // Focus if possible
                                    if (element.focus) {
                                        element.focus();
                                    }

                                    // jQuery trigger
                                    if (window.jQuery) {
                                        window.jQuery(element).trigger('mouseenter').trigger('mouseover');
                                    }

                                    return { success: true };
                                } else {
                                    // Just dispatch to document if no element
                                    if (x && y) {
                                        const event = new MouseEvent('mousemove', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: x,
                                            clientY: y
                                        });
                                        document.dispatchEvent(event);
                                    }
                                    return { success: true };
                                }
                            })()
                        `, { success: false });

                        success = mouseResult && mouseResult.success;

                        // Wait for any dynamic content
                        await rpa.sleep(action.dynamicContent ? 500 : 200);
                        break;

                    case 'keypress':
                        updateProgress(`Pressing key: ${action.key}`, 'info');
                        const modifiers = [];
                        if (action.ctrlKey) modifiers.push('ctrl');
                        if (action.shiftKey) modifiers.push('shift');
                        if (action.altKey) modifiers.push('alt');
                        if (action.metaKey) modifiers.push('meta');

                        // For Tab key, add a small delay before and after to ensure focus changes properly
                        if (action.key === 'Tab') {
                            await rpa.sleep(200);
                        }

                        await rpa.keyPress(action.key, modifiers);

                        // Give time for the tab navigation to complete
                        if (action.key === 'Tab') {
                            await rpa.sleep(500);
                        } else {
                            await rpa.sleep(100);
                        }

                        success = true;
                        break;

                    case 'wait':
                        const waitTime = action.timeout || 1000;
                        updateProgress(`Waiting ${waitTime}ms`, 'info');
                        await rpa.sleep(waitTime);
                        success = true;
                        break;

                    case 'screenshot':
                        updateProgress(`Taking screenshot`, 'info');
                        await rpa.takeScreenshot({ selector: action.selector });
                        success = true;
                        break;

                    default:
                        // Fall back to old implementation for unknown action types
                        success = await this.executeLegacyAction(webview, action);
                        break;
                }

                    if (success) {
                        successfulActions++;
                        updateProgress(`✅ Step ${actionIndex + 1} completed`, 'success');
                        updateDebugInfo(`✅ Action ${actionIndex + 1} succeeded: ${action.type}`);
                        actionCompleted = true;
                        clearTimeout(timeoutId);
                        clearInterval(skipCheckInterval);
                        return true;
                    } else {
                        throw new Error(`Action failed: ${action.type}`);
                    }
                } catch (error) {
                    actionCompleted = true;
                    clearTimeout(timeoutId);
                    clearInterval(skipCheckInterval);
                    updateDebugInfo(`❌ Action ${actionIndex + 1} failed: ${error.message}`);
                    throw error;
                }
            })();

            // Race between action completion and timeout
            try {
                const result = await Promise.race([actionPromise, timeoutPromise]);

                if (result) {
                    // Move to next action
                    actionIndex++;
                    retryCount = 0;

                    // Small delay between actions
                    await rpa.sleep(500);

                    // Continue to next action
                    executeNextAction();
                }
            } catch (error) {
                // Check if skipped
                if (shouldSkip) {
                    updateProgress(`Skipped step ${actionIndex + 1}`, 'warning');
                    failedActions.push({
                        step: actionIndex + 1,
                        action: action.type,
                        error: 'Skipped by user'
                    });
                    shouldSkip = false;
                    actionIndex++;
                    retryCount = 0;
                    await rpa.sleep(500);
                    executeNextAction();
                    return;
                }

                console.error(`Step ${actionIndex + 1} failed:`, error);

                // Show timeout message specifically
                if (error.message.includes('timeout')) {
                    updateProgress(`⏰ Step ${actionIndex + 1} timed out - Use Skip button to continue`, 'error');
                }

                if (retryCount < maxRetries) {
                    retryCount++;
                    updateProgress(`⚠️ Retrying step ${actionIndex + 1} (attempt ${retryCount + 1}/${maxRetries + 1})`, 'warning');
                    await rpa.sleep(1000);
                    executeNextAction();
                } else {
                    failedActions.push({
                        step: actionIndex + 1,
                        action: action.type,
                        error: error.message
                    });
                    updateProgress(`❌ Step ${actionIndex + 1} failed after ${maxRetries + 1} attempts`, 'error');

                    // Move to next action despite failure
                    actionIndex++;
                    retryCount = 0;
                    await rpa.sleep(1000);
                    executeNextAction();
                }
            }
        };

        // Start the automation execution
        executeNextAction();
    }

    // Legacy action execution for fallback
    async executeLegacyAction(webview, action) {
        try {
            const script = this.generateActionScript(action);
            if (this.debugMode) {
            }
            const result = await webview.executeJavaScript(script);
            return result && result.success;
        } catch (error) {
            console.error('Legacy action failed:', error);
            return false;
        }
    }

    generateActionScript(action) {
        // Pure coordinate-based robot API - NO selectors, NO element finding
        // Everything is based on X,Y coordinates recorded during the automation

        // We don't need ANY selector parsing or element finding!
        // Everything is coordinate-based

        // Handle each action type with coordinates only
        switch (action.type) {
            case 'form-click':
                // Specialized form field click - always use coordinates
                return `
                    (function() {
                        console.log('Form field click at (${action.x}, ${action.y}) - ${action.fieldLabel || action.fieldId}');
                        return {
                            success: true,
                            needsRobotClick: true,
                            x: ${action.x},
                            y: ${action.y},
                            isFormField: true,
                            directCoordinates: true
                        };
                    })();
                `;

            case 'form-input':
                // Form input with better handling - try JS first for reliability
                return `
                    (async function() {
                        console.log('Form input at (${action.x}, ${action.y}): "${action.value}" in ${action.fieldLabel || action.fieldId}');

                        // First try to set value directly via JavaScript for reliability
                        const element = document.elementFromPoint(${action.x}, ${action.y});
                        if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
                            // Focus the element
                            element.focus();

                            // Clear and set new value
                            element.value = '';
                            element.value = '${action.value.replace(/'/g, "\\'")}';

                            // Dispatch input events to trigger any listeners
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                            element.dispatchEvent(new Event('change', { bubbles: true }));

                            // Small delay to let events process
                            await new Promise(r => setTimeout(r, 100));


                            // If value was set successfully, we're done
                            if (element.value === '${action.value.replace(/'/g, "\\'")}') {
                                return { success: true };
                            }
                        }

                        // If JS approach didn't work, fall back to robot input
                        return {
                            success: true,
                            needsFormInput: true,
                            x: ${action.x},
                            y: ${action.y},
                            value: '${action.value.replace(/'/g, "\\'")}',
                            fieldLabel: '${action.fieldLabel || ''}',
                            directCoordinates: true
                        };
                    })();
                `;

            case 'form-tab':
                // Tab navigation between fields
                return `
                    (function() {
                        return {
                            success: true,
                            needsRobotTab: true,
                            fromField: '${action.fromField || ''}',
                            directCoordinates: true
                        };
                    })();
                `;

            case 'click':
                // ALWAYS use coordinates - no fallback
                return `
                    (function() {
                        console.log('Click at (${action.x || 0}, ${action.y || 0})');
                        return {
                            success: true,
                            needsRobotClick: true,
                            x: ${action.x || 0},
                            y: ${action.y || 0},
                            directCoordinates: true
                        };
                    })();
                `;

            case 'old-click-removed':
                // Removed old fallback code
                return `
                    // Find element and return coordinates for robot API
                    (async function() {
                        try {
                            // Store whether this is XPath
                            const isXPath = ${action.isXPath ? 'true' : 'false'};

                            // Decode the selector and get safeFindElement function
                            ${decodeSelectorLogic}

                            // Element should already be found by findByComponents
                            if (element) {
                            }

                            // If element wasn't found by components, try safeFindElement as fallback
                            if (!element) {
                                element = safeFindElement();
                                if (element) {
                                }
                            }

                            // Debug: Log what we found
                            if (element) {
                            } else {

                                // Wait for element to appear (for dynamically loaded content)
                                let waitAttempts = 0;
                                const maxWaitAttempts = 20; // 10 seconds total

                                // First, check if there's a size selector button that needs to be clicked
                                const selectorText = attrValue && attrValue.includes('43') ? '43' : '';
                                if (selectorText && (selectorText === '43' || /^\\d+$/.test(selectorText))) {

                                    // Look for common size selector triggers
                                    const sizeButtons = document.querySelectorAll(
                                        'button:not([disabled])[class*="size"], ' +
                                        'div[class*="size-selector"], ' +
                                        'div[class*="size-picker"], ' +
                                        '[aria-label*="size"], ' +
                                        '[data-test*="size"], ' +
                                        'button:not([disabled])[class*="Size"], ' +
                                        'span[class*="size-guide"]'
                                    );

                                    for (const btn of sizeButtons) {
                                        const btnRect = btn.getBoundingClientRect();
                                        if (btnRect.width > 0 && btnRect.height > 0) {
                                            try {
                                                btn.click();
                                                await new Promise(r => setTimeout(r, 1000)); // Wait for dropdown to open
                                                break;
                                            } catch (e) {
                                                console.log('Could not click size button:', e);
                                            }
                                        }
                                    }
                                }

                                while (!element && waitAttempts < maxWaitAttempts) {
                                    await new Promise(r => setTimeout(r, 500));

                                    // Re-run the component-based search to find the element
                                    // Don't use querySelector as it fails with escaped selectors
                                    try {
                                        if (isXPath) {
                                            // For XPath, skip retry since we don't have the selector
                                            // Component-based search doesn't work with XPath
                                        } else {
                                            // Use component-based search which is more reliable
                                            element = findByComponents();

                                            // Special retry logic removed - using component search only

                                            // Don't use querySelector with problematic selectors
                                        }
                                    } catch (e) {
                                        console.log('Retry search error (non-critical):', e.message);
                                        // Try component search as fallback
                                        element = findByComponents();
                                    }

                                    if (element) {
                                        break;
                                    }

                                    waitAttempts++;

                                    // Every 2 seconds, log that we're still waiting
                                    if (waitAttempts % 4 === 0) {
                                    }
                                }

                                if (!element) {
                                    console.error('❌ Element never appeared after waiting', maxWaitAttempts * 500, 'ms');

                                // Don't try to validate selector with querySelector as it may fail with escaped chars
                                // Just report that element was not found

                                return {
                                    success: false,
                                    error: 'Element not found after waiting'
                                };
                            }

                            // Enhanced visibility check and handling

                            // First, check if element is in a scrollable container
                            let scrollableParent = element.parentElement;
                            while (scrollableParent) {
                                const parentStyles = window.getComputedStyle(scrollableParent);
                                const overflow = parentStyles.overflow + parentStyles.overflowY;
                                if (overflow.includes('scroll') || overflow.includes('auto')) {
                                    // Scroll the parent to make the element visible
                                    const elementTop = element.offsetTop;
                                    scrollableParent.scrollTop = elementTop - 100;
                                    await new Promise(r => setTimeout(r, 500));
                                    break;
                                }
                                scrollableParent = scrollableParent.parentElement;
                            }

                            // Now try to scroll the element into view
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await new Promise(r => setTimeout(r, 800));

                            // Check if element is visible after scrolling
                            let rect = element.getBoundingClientRect();
                            let isVisible = rect.width > 0 && rect.height > 0 &&
                                          rect.top < window.innerHeight &&
                                          rect.bottom > 0 &&
                                          rect.left < window.innerWidth &&
                                          rect.right > 0;

                            // Check computed styles for visibility
                            const styles = window.getComputedStyle(element);
                            const isStyleVisible = styles.display !== 'none' &&
                                                  styles.visibility !== 'hidden' &&
                                                  styles.opacity !== '0';

                                hasSize: rect.width > 0 && rect.height > 0,
                                dimensions: { width: rect.width, height: rect.height },
                                position: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
                                inViewport: rect.top < window.innerHeight && rect.bottom > 0,
                                styleVisible: isStyleVisible,
                                display: styles.display,
                                visibility: styles.visibility,
                                opacity: styles.opacity,
                                pointerEvents: styles.pointerEvents,
                                zIndex: styles.zIndex,
                                position: styles.position
                            });

                            // Check if element is disabled or not clickable
                            const isDisabled = element.disabled ||
                                              element.getAttribute('disabled') !== null ||
                                              element.classList.contains('disabled') ||
                                              element.classList.contains('unavailable') ||
                                              element.classList.contains('out-of-stock') ||
                                              styles.pointerEvents === 'none' ||
                                              styles.cursor === 'not-allowed';

                            if (isDisabled) {
                                    disabled: element.disabled,
                                    disabledAttr: element.getAttribute('disabled'),
                                    classes: element.className,
                                    pointerEvents: styles.pointerEvents,
                                    cursor: styles.cursor
                                });
                            }

                            if (!isVisible || !isStyleVisible) {

                                // Try to expand parent containers that might be collapsed
                                let parent = element.parentElement;
                                let expandAttempts = 0;
                                while (parent && expandAttempts < 5) {
                                    // Check if parent might be a collapsible container
                                    const parentStyles = window.getComputedStyle(parent);
                                    if (parentStyles.display === 'none' || parentStyles.height === '0px') {
                                        // Try clicking on the parent to expand it
                                        parent.click();
                                        await new Promise(r => setTimeout(r, 500));
                                    }
                                    parent = parent.parentElement;
                                    expandAttempts++;
                                }

                                // Re-check visibility after expansion attempts
                                rect = element.getBoundingClientRect();
                                isVisible = rect.width > 0 && rect.height > 0;

                                if (!isVisible) {

                                    // Check if there's a visible alternative (like another size option)
                                    const elementText = element.textContent?.trim();
                                    if (elementText) {
                                        const allSimilar = document.querySelectorAll('a, button, div[role="button"]');
                                        let visibleAlternative = null;

                                        for (const alt of allSimilar) {
                                            if (alt !== element && alt.textContent?.trim() === elementText) {
                                                const altRect = alt.getBoundingClientRect();
                                                const altStyles = window.getComputedStyle(alt);
                                                if (altRect.width > 0 && altRect.height > 0 &&
                                                    altStyles.display !== 'none' &&
                                                    altStyles.visibility !== 'hidden') {
                                                    visibleAlternative = alt;
                                                    break;
                                                }
                                            }
                                        }

                                        if (visibleAlternative) {
                                            element = visibleAlternative;
                                            rect = element.getBoundingClientRect();
                                            isVisible = true;
                                        }
                                    }

                                    if (!isVisible) {
                                        // Try forcing visibility as last resort
                                        element.style.display = 'block !important';
                                        element.style.visibility = 'visible !important';
                                        element.style.opacity = '1 !important';
                                        element.style.width = 'auto !important';
                                        element.style.height = 'auto !important';
                                        await new Promise(r => setTimeout(r, 300));

                                        // Final visibility check
                                        rect = element.getBoundingClientRect();
                                        if (rect.width === 0 || rect.height === 0) {
                                            // Log parent hierarchy to understand the issue
                                            let parentInfo = [];
                                            let currentParent = element.parentElement;
                                            let level = 0;
                                            while (currentParent && level < 5) {
                                                const parentRect = currentParent.getBoundingClientRect();
                                                const parentStyles = window.getComputedStyle(currentParent);
                                                parentInfo.push({
                                                    level: level,
                                                    tag: currentParent.tagName,
                                                    class: currentParent.className,
                                                    display: parentStyles.display,
                                                    visibility: parentStyles.visibility,
                                                    dimensions: { width: parentRect.width, height: parentRect.height }
                                                });
                                                currentParent = currentParent.parentElement;
                                                level++;
                                            }
                                            console.error('Parent hierarchy:', parentInfo);

                                            return {
                                                success: false,
                                                error: 'Element never became visible. It may be: 1) Out of stock/disabled, 2) In a hidden container, 3) Covered by another element. Check console for parent hierarchy.'
                                            };
                                        }
                                    }
                                }
                            }

                            // Return element coordinates for robot API click
                            const finalRect = element.getBoundingClientRect();
                            const centerX = Math.round(finalRect.left + finalRect.width / 2);
                            const centerY = Math.round(finalRect.top + finalRect.height / 2);


                            return {
                                success: true,
                                needsRobotClick: true,
                                x: centerX,
                                y: centerY,
                                element: {
                                    tagName: element.tagName,
                                    className: element.className,
                                    id: element.id,
                                    disabled: isDisabled
                                }
                            };
                        } catch (e) {
                            console.error('Click error:', e);
                            return {
                                success: false,
                                error: 'Click error: ' + e.message
                            };
                        } finally {
                        }
                    })().catch(err => {
                        console.error('Click promise rejected:', err);
                        return { success: false, error: 'Promise rejected: ' + err.message };
                    });
                `;

            case 'input':
                // ALWAYS use coordinates
                return `
                    (function() {
                        console.log('Input at (${action.x || 0}, ${action.y || 0}): "${action.value || ''}"');
                        return {
                            success: true,
                            needsRobotInput: true,
                            x: ${action.x || 0},
                            y: ${action.y || 0},
                            value: '${(action.value || '').replace(/'/g, "\\'")}',
                            directCoordinates: true
                        };
                    })();
                `;

            case 'old-input-removed':
                return `
                    (async function() {
                        try {
                            // Decode the selector first (always needed for both XPath and CSS)
                            ${decodeSelectorLogic}

                            // Element should already be found by findByComponents
                            if (!element) {
                                element = safeFindElement();
                            }

                            if (!element) {
                                console.error('Input element not found');
                                return {
                                    success: false,
                                    error: 'Input element not found'
                                };
                            }

                            // Check if it's actually an input element or contenteditable
                            const isContentEditable = element.contentEditable === 'true';
                            if (!isContentEditable && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
                                console.error('Element is not an input:', element.tagName);
                                return {
                                    success: false,
                                    error: 'Element is not an input field (found: ' + element.tagName + ')'
                                };
                            }

                            // Check if input is editable
                            if (!isContentEditable && (element.readOnly || element.disabled)) {
                                console.error('Input is not editable:', { readOnly: element.readOnly, disabled: element.disabled });
                                return {
                                    success: false,
                                    error: 'Input is ' + (element.readOnly ? 'readonly' : 'disabled')
                                };
                            }

                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await new Promise(r => setTimeout(r, 300));

                            // Get element coordinates for robot API
                            const rect = element.getBoundingClientRect();
                            const x = Math.round(rect.left + rect.width / 2);
                            const y = Math.round(rect.top + rect.height / 2);


                            return {
                                success: true,
                                needsRobotInput: true,
                                x: x,
                                y: y,
                                value: '${action.value.replace(/'/g, "\\'")}',
                                element: {
                                    tagName: element.tagName,
                                    className: element.className,
                                    id: element.id,
                                    isContentEditable: isContentEditable
                                }
                            };
                        } catch (e) {
                            console.error('Input action error:', e);
                            return {
                                success: false,
                                error: e.message || 'Unknown error during input'
                            };
                        } finally {
                        }
                    })().catch(err => {
                        console.error('Input promise rejected:', err);
                        return { success: false, error: 'Promise rejected: ' + err.message };
                    });
                `;

            case 'select':
                return `
                    (async function() {
                        try {
                            // Decode the selector first (always needed for both XPath and CSS)
                            ${decodeSelectorLogic}

                            // Initialize element variable
                            let element = null;

                            ${selectorLogic}
                            if (!element) {
                                return {
                                    success: false,
                                    error: 'Select element not found'
                                };
                            }

                            if (element.tagName !== 'SELECT') {
                                return {
                                    success: false,
                                    error: 'Element is not a SELECT (found: ' + element.tagName + ')'
                                };
                            }

                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                            // Wait for scroll
                            await new Promise(resolve => setTimeout(resolve, 300));

                            try {
                                element.value = '${action.value ? action.value.replace(/'/g, "\\'") : ''}';
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                console.log('Select value set to:', '${action.value ? action.value.replace(/'/g, "\\'") : ''}');
                                return { success: true };
                            } catch (selectError) {
                                console.error('Select change failed:', selectError);
                                return {
                                    success: false,
                                    error: 'Select failed: ' + selectError.message
                                };
                            }
                        } catch (e) {
                            console.error('Select action error:', e);
                            return {
                                success: false,
                                error: e.message || 'Unknown error during select'
                            };
                        }
                    })();
                `;

            case 'submit':
                return `
                    (async function() {
                        try {
                            // Decode the selector first (always needed for both XPath and CSS)
                            ${decodeSelectorLogic}

                            // Initialize element variable
                            let element = null;

                            ${selectorLogic}
                            if (!element) {
                                return {
                                    success: false,
                                    error: 'Form element not found'
                                };
                            }

                            try {
                                if (element.tagName === 'FORM') {
                                    element.submit();
                                } else {
                                    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                                }
                                return { success: true };
                            } catch (submitError) {
                                console.error('Submit event failed:', submitError);
                                return {
                                    success: false,
                                    error: 'Submit failed: ' + submitError.message
                                };
                            }
                        } catch (e) {
                            console.error('Submit action error:', e);
                            return {
                                success: false,
                                error: e.message || 'Unknown error during submit'
                            };
                        }
                    })();
                `;

            case 'mousemove':
                // Mouse move with coordinates
                return `
                    (function() {
                        console.log('Mouse move to (${action.x || 0}, ${action.y || 0})');

                        // Try to trigger hover events if we have coordinates
                        if (${action.x || 0} && ${action.y || 0}) {
                            const element = document.elementFromPoint(${action.x || 0}, ${action.y || 0});
                            if (element) {
                                // Trigger mouse events on the element
                                ['mouseenter', 'mouseover', 'mousemove'].forEach(eventType => {
                                    const event = new MouseEvent(eventType, {
                                        view: window,
                                        bubbles: true,
                                        cancelable: true,
                                        clientX: ${action.x || 0},
                                        clientY: ${action.y || 0}
                                    });
                                    element.dispatchEvent(event);
                                });
                            }
                        }

                        return {
                            success: true,
                            x: ${action.x || 0},
                            y: ${action.y || 0}
                        };
                    })();
                `;

            case 'hover':
                // ALWAYS use coordinates
                return `
                    (function() {
                        console.log('Hover at (${action.x || 0}, ${action.y || 0})');
                        return {
                            success: true,
                            needsRealHover: true,
                            x: ${action.x || 0},
                            y: ${action.y || 0},
                            directCoordinates: true
                        };
                    })();
                `;

            case 'old-hover-removed':
                return `
                    // Simplified hover action using component-based search
                    (async function() {
                        try {
                            // Decode the selector and use component-based search
                            ${decodeSelectorLogic}

                            // Store whether this is XPath
                            const isXPath = ${action.isXPath ? 'true' : 'false'};

                            // Element should already be found by findByComponents
                            if (element) {
                            }

                            // If still not found, wait a bit for dynamic content
                            if (!element) {
                                console.log('Element not found initially, waiting...');

                                let waitAttempts = 0;
                                const maxWaitAttempts = 10; // 5 seconds

                                while (!element && waitAttempts < maxWaitAttempts) {
                                    await new Promise(r => setTimeout(r, 500));

                                    // Try component search again
                                    element = findByComponents();

                                    waitAttempts++;
                                }
                            }

                            if (!element) {
                                console.error('Hover target not found');
                                return {
                                    success: false,
                                    error: 'Hover target not found after waiting'
                                };
                            }

                            console.log('Found hover target element:', element.tagName, element.className || '');

                            // Check if element is visible
                            const rect = element.getBoundingClientRect();
                            const isVisible = rect.width > 0 && rect.height > 0;
                            const computedStyle = window.getComputedStyle(element);
                            const isStyleVisible = computedStyle.display !== 'none' &&
                                                 computedStyle.visibility !== 'hidden';

                            if (!isVisible || !isStyleVisible) {
                                console.log('Rect:', rect.width, 'x', rect.height);
                                console.log('Display:', computedStyle.display, 'Visibility:', computedStyle.visibility);

                                // Try to make parent visible first
                                let parent = element.parentElement;
                                while (parent) {
                                    const parentStyle = window.getComputedStyle(parent);
                                    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
                                        parent.style.display = 'block';
                                        parent.style.visibility = 'visible';
                                    }
                                    parent = parent.parentElement;
                                    if (parent === document.body) break;
                                }

                                // Try clicking parent to reveal it
                                if (element.parentElement) {
                                    try {
                                        element.parentElement.click();
                                        await new Promise(r => setTimeout(r, 500));
                                    } catch (e) {
                                        console.log('Could not click parent:', e);
                                    }
                                }
                            }

                            // Ensure element is in viewport
                            try {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                            } catch (scrollErr) {
                                console.log('ScrollIntoView failed, trying alternative scroll');
                                window.scrollTo({
                                    top: rect.top + window.scrollY - window.innerHeight / 2,
                                    behavior: 'smooth'
                                });
                            }

                            // Wait for scroll
                            await new Promise(resolve => setTimeout(resolve, 300));

                            try {
                                // Get fresh rect after scrolling
                                const rect2 = element.getBoundingClientRect();

                                // Validate rect before using it
                                if (!rect2 || rect2.width === 0 || rect2.height === 0) {
                                    console.warn('Element has no size after scrolling, using fallback coordinates');
                                    // Use a fallback position
                                    rect2 = { left: 100, top: 100, width: 10, height: 10 };
                                }

                                const centerX = Math.round(rect2.left + rect2.width / 2);
                                const centerY = Math.round(rect2.top + rect2.height / 2);

                                console.log('Returning coordinates for real mouse hover at:', centerX, centerY);

                                // Return coordinates for real mouse movement via sendInputEvent
                                // This will be handled by executeNextAction
                                return {
                                    success: true,
                                    needsRealHover: true,
                                    x: centerX,
                                    y: centerY,
                                    element: {
                                        tagName: element.tagName,
                                        className: element.className,
                                        id: element.id
                                    }
                                };
                            } catch (hoverError) {
                                console.error('Error during hover event dispatch:', hoverError);
                                return {
                                    success: false,
                                    error: 'Hover event failed: ' + hoverError.message
                                };
                            }
                        } catch (e) {
                            console.error('Hover action error:', e);
                            console.error('Stack:', e.stack);
                            return {
                                success: false,
                                error: e.message || 'Unknown error during hover'
                            };
                        } finally {
                        }
                    })().catch(err => {
                        console.error('Hover promise rejected:', err);
                        return { success: false, error: 'Promise rejected: ' + err.message };
                    });
                `;

            case 'scroll':
                return `
                    (async function() {
                        try {
                            // Return scroll parameters for robot API
                            const scrollX = ${action.x || 0};
                            const scrollY = ${action.y || 0};

                            // Get current scroll position and viewport info
                            const currentX = window.scrollX || window.pageXOffset;
                            const currentY = window.scrollY || window.pageYOffset;
                            const viewportWidth = window.innerWidth;
                            const viewportHeight = window.innerHeight;


                            return {
                                success: true,
                                needsRobotScroll: true,
                                targetX: scrollX,
                                targetY: scrollY,
                                currentX: currentX,
                                currentY: currentY,
                                deltaX: scrollX - currentX,
                                deltaY: scrollY - currentY,
                                viewportWidth: viewportWidth,
                                viewportHeight: viewportHeight
                            };
                        } catch (e) {
                            console.error('Scroll preparation failed:', e.message);
                            return {
                                success: false,
                                error: 'Scroll preparation failed: ' + e.message
                            };
                        }
                    })();
                `;

            case 'focus':
                // If we have coordinates, just click there to focus
                if (action.x !== undefined && action.y !== undefined) {
                    return `
                        // Using coordinates to focus via click
                        (function() {
                            // Focus is essentially a click for robot API
                            return {
                                success: true,
                                needsRobotClick: true,
                                x: ${action.x},
                                y: ${action.y},
                                isFocusAction: true,
                                directCoordinates: true
                            };
                        })();
                    `;
                }

                // Fallback without coordinates (shouldn't happen with new recordings)
                return `
                    (function() {
                        // Can't focus without element, just return success
                        return { success: true };
                    })();
                `;

            case 'keypress':
                // For keypress, we need to focus the element first (click on it), then send the key
                if (action.x !== undefined && action.y !== undefined) {
                    return `
                        // Using coordinates to focus element then send keypress
                        (function() {
                            console.log('Keypress at (${action.x}, ${action.y}): ${action.key}');
                            return {
                                success: true,
                                needsRobotKeypress: true,
                                x: ${action.x},
                                y: ${action.y},
                                key: '${action.key}',
                                ctrlKey: ${action.ctrlKey || false},
                                shiftKey: ${action.shiftKey || false},
                                altKey: ${action.altKey || false},
                                metaKey: ${action.metaKey || false},
                                directCoordinates: true
                            };
                        })();
                    `;
                }

                // Fallback without coordinates
                return `
                    (function() {
                        console.log('Keypress without coordinates - sending key directly: ${action.key}');
                        return {
                            success: true,
                            needsRobotKeypress: true,
                            key: '${action.key}',
                            ctrlKey: ${action.ctrlKey || false},
                            shiftKey: ${action.shiftKey || false},
                            altKey: ${action.altKey || false},
                            metaKey: ${action.metaKey || false}
                        };
                    })();
                `;

            case 'dblclick':
                return `
                    (function() {
                        try {
                            ${selectorLogic}
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                // Simulate double click
                                const dblClickEvent = new MouseEvent('dblclick', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true
                                });
                                element.dispatchEvent(dblClickEvent);
                            } else {
                                throw new Error('Double click target not found');
                            }
                        } catch (e) {
                            console.error('Double click failed:', e.message);
                            throw e;
                        }
                    })();
                `;

            case 'rightclick':
                return `
                    (function() {
                        try {
                            ${selectorLogic}
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                // Simulate right click
                                const contextMenuEvent = new MouseEvent('contextmenu', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true,
                                    button: 2,
                                    buttons: 2
                                });
                                element.dispatchEvent(contextMenuEvent);
                            } else {
                                throw new Error('Right click target not found');
                            }
                        } catch (e) {
                            console.error('Right click failed:', e.message);
                            throw e;
                        }
                    })();
                `;

            case 'wait':
                return `
                    (function() {
                        return new Promise(resolve => {
                            console.log('Waiting ${action.duration || 500}ms...');
                            setTimeout(resolve, ${action.duration || 500});
                        });
                    })();
                `;

            case 'checkbox':
            case 'check':
            case 'radio':
                return `
                    (function() {
                        console.log('${action.inputType === 'radio' ? 'Radio' : 'Checkbox'} toggle');

                        // Try to find element by selector if available
                        const selector = ${JSON.stringify(action.selector || '')};
                        let element = null;

                        if (selector) {
                            element = document.querySelector(selector);
                        }

                        // Fallback to coordinates if no element found
                        if (!element && ${action.x || 0} && ${action.y || 0}) {
                            element = document.elementFromPoint(${action.x || 0}, ${action.y || 0});
                        }

                        if (element && (element.type === 'checkbox' || element.type === 'radio')) {
                            // Scroll into view
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                            // Check current state
                            const shouldCheck = ${action.checked ? 'true' : 'false'};

                            // Only click if state needs to change
                            if (element.checked !== shouldCheck) {
                                element.focus();
                                element.click();

                                // Also dispatch change event
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            return {
                                success: true,
                                checked: element.checked,
                                type: element.type
                            };
                        } else {
                            // If can't find the element, return coordinates for robot click
                            return {
                                success: false,
                                needsRobotClick: true,
                                x: ${action.x || 0},
                                y: ${action.y || 0}
                            };
                        }
                    })();
                `;

            default:
                return '// Unknown action type: ' + action.type;
        }
    }

    deleteAutomation(id) {
        if (confirm('Are you sure you want to delete this automation?')) {
            this.savedAutomations = this.savedAutomations.filter(a => a.id !== id);
            this.saveAutomationsToStorage();
            this.populateAutomationList();

            // Remove associated bookmark
            this.bookmarks = this.bookmarks.filter(b => b.automationId !== id);
            this.saveBookmarks();
            this.renderBookmarks();

            this.showNotification('Automation deleted', 'success');
        }
    }

    showRecordingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'recording-indicator';
        indicator.className = 'recording-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #e74c3c;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 2147483647;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            cursor: move;
            user-select: none;
        `;
        indicator.innerHTML = `
            <div class="record-dot" style="
                width: 10px;
                height: 10px;
                background: white;
                border-radius: 50%;
                animation: blink 1s infinite;
            "></div>
            <span>Recording...</span>
            <button id="stop-recording-btn" style="
                background: white;
                color: #e74c3c;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-weight: bold;
                margin-left: 10px;
            ">Stop</button>
        `;

        // Add blink animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
        `;
        document.head.appendChild(style);

        // Add click handler to stop button
        const stopBtn = indicator.querySelector('#stop-recording-btn');

        // Use mousedown to prevent drag interference
        stopBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });

        stopBtn.addEventListener('mouseup', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await this.stopRecording();
        });

        // Make the indicator draggable
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        indicator.addEventListener('mousedown', (e) => {
            // Only allow dragging when clicking outside the stop button
            if (e.target !== stopBtn && e.target.id !== 'stop-recording-btn') {
                isDragging = true;
                dragOffsetX = e.clientX - indicator.offsetLeft;
                dragOffsetY = e.clientY - indicator.offsetTop;
                indicator.style.cursor = 'grabbing';
            }
        });

        const handleMouseMove = (e) => {
            if (isDragging) {
                indicator.style.left = (e.clientX - dragOffsetX) + 'px';
                indicator.style.top = (e.clientY - dragOffsetY) + 'px';
                indicator.style.right = 'auto';
            }
        };

        const handleMouseUp = () => {
            isDragging = false;
            indicator.style.cursor = 'move';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        document.body.appendChild(indicator);
    }

    hideRecordingIndicator() {
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // Page context menu functionality
    setupPageContextMenu() {
        this.pageContextMenu = document.getElementById('page-context-menu');
        this.linkContextMenu = document.getElementById('link-context-menu');
        this.textContextMenu = document.getElementById('text-context-menu');
        this.imageContextMenu = document.getElementById('image-context-menu');
        this.tabContextMenu = document.getElementById('tab-context-menu');
        this.urlBarContextMenu = document.getElementById('url-bar-context-menu');
        this.pageContextMenuClickHandler = null;
        this.currentLinkUrl = null;
        this.currentSelectedText = null;
        this.currentImageUrl = null;
        this.currentImageLinkUrl = null;

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hidePageContextMenu();
                this.hideLinkContextMenu();
                this.hideTextContextMenu();
                this.hideImageContextMenu();
                this.hideUrlBarContextMenu();
            }
        });
        
        // Handle page menu item clicks
        this.pageContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handlePageContextMenuAction(action);
                this.hidePageContextMenu();
            });
        });
        
        // Handle link menu item clicks
        this.linkContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleLinkContextMenuAction(action);
                this.hideLinkContextMenu();
            });
        });

        // Handle text menu item clicks
        this.textContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleTextContextMenuAction(action);
                this.hideTextContextMenu();
            });
        });

        // Handle image menu item clicks
        this.imageContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleImageContextMenuAction(action);
                this.hideImageContextMenu();
            });
        });

        // Handle tab menu item clicks
        this.tabContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleTabContextMenuAction(action);
                this.hideTabContextMenu();
            });
        });

        // Handle URL bar context menu
        this.addressBar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showUrlBarContextMenu(e);
        });

        // Handle URL bar menu item clicks
        this.urlBarContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleUrlBarContextMenuAction(action);
                this.hideUrlBarContextMenu();
            });
        });

        // Google search bar functionality
        if (this.googleSearchBar) {
            this.googleSearchBar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = this.googleSearchBar.value.trim();
                    if (query) {
                        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

                        // Always navigate in the current tab
                        this.addressBar.value = googleSearchUrl;
                        this.navigate();
                    }
                }
            });
        }
    }
    
    setupModelSelector() {
        this.modelSelect = document.getElementById('model-select');

        // Load saved model preference
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) {
            this.modelSelect.value = savedModel;
        }

        // Save model selection when changed
        this.modelSelect.addEventListener('change', () => {
            localStorage.setItem('selectedModel', this.modelSelect.value);
        });
    }

    setupAdBlockerToggle() {
        this.adBlockerToggle = document.getElementById('ad-blocker-toggle');

        // Load initial state
        window.electronAPI.getAdBlocker().then(result => {
            this.adBlockerToggle.checked = result.enabled;
        });

        // Handle toggle changes
        this.adBlockerToggle.addEventListener('change', async () => {
            const enabled = this.adBlockerToggle.checked;
            await window.electronAPI.setAdBlocker(enabled);

            // Inject CSS to hide ads in existing webviews
            this.tabs.forEach(tab => {
                if (tab.webview) {
                    this.updateAdBlockerInWebview(tab.webview, enabled);
                }
            });
        });

        // Listen for ad blocker changes from main process
        window.electronAPI.onAdBlockerChanged((enabled) => {
            this.adBlockerToggle.checked = enabled;

            // Update all webviews
            this.tabs.forEach(tab => {
                if (tab.webview) {
                    this.updateAdBlockerInWebview(tab.webview, enabled);
                }
            });
        });
    }

    setupTrackerBlockerToggle() {
        this.trackerBlockerToggle = document.getElementById('tracker-blocker-toggle');

        // Load initial state
        window.electronAPI.getTrackerBlocker().then(result => {
            this.trackerBlockerToggle.checked = result.enabled;
        });

        // Handle toggle changes
        this.trackerBlockerToggle.addEventListener('change', async () => {
            const enabled = this.trackerBlockerToggle.checked;
            await window.electronAPI.setTrackerBlocker(enabled);

            // Tracker blocking happens at network level in main.js
            // No need to update individual webviews
        });

        // Listen for tracker blocker changes from main process
        window.electronAPI.onTrackerBlockerChanged((enabled) => {
            this.trackerBlockerToggle.checked = enabled;
            // Tracker blocking happens at network level, no webview updates needed
        });
    }

    setupDarkModeEnforcer() {
        this.darkModeEnforcerToggle = document.getElementById('dark-mode-enforcer-toggle');

        // Load initial state from localStorage
        const savedState = localStorage.getItem('darkModeEnforcer');
        this.darkModeEnforcerToggle.checked = savedState === 'true';

        // Apply dark mode to the renderer page on load
        if (savedState === 'true') {
            document.body.classList.add('dark-mode');
        }

        // Handle toggle changes
        this.darkModeEnforcerToggle.addEventListener('change', () => {
            const enabled = this.darkModeEnforcerToggle.checked;
            localStorage.setItem('darkModeEnforcer', enabled.toString());

            // Apply dark mode class to the renderer page
            if (enabled) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }

            // Reload all existing webviews to apply dark mode
            this.tabs.forEach(tab => {
                if (tab.webview && tab.webview.src && !tab.webview.src.startsWith('about:')) {
                    tab.webview.reload();
                }
            });
        });
    }

    updateDarkModeInWebview(webview, enabled) {
        // Dark mode CSS is now injected via did-start-loading event
        // This function is kept for compatibility but does nothing
        // The actual injection happens in the did-start-loading listener
    }

    updateAdBlockerInWebview(webview, enabled) {
        // Note: Most ad blocking happens at the network level in main.js
        // This function now only handles DOM cleanup for ads that get through

        if (enabled) {
            webview.executeJavaScript('window.location.hostname').then(hostname => {
                // Extended whitelist including Google Workspace apps
                const whitelistedHosts = [
                    'youtube.com', 'www.youtube.com', 'm.youtube.com',
                    'linkedin.com', 'www.linkedin.com', 'in.linkedin.com',
                    'docs.google.com', 'sheets.google.com', 'slides.google.com',
                    'drive.google.com', 'mail.google.com', 'calendar.google.com'
                ];

                if (whitelistedHosts.some(host => hostname === host || hostname.endsWith('.' + host))) {
                    return;
                }

                // Remove ad elements from DOM instead of hiding with CSS
                // This is cleaner and doesn't interfere with page layouts
                webview.executeJavaScript(`
                    (function() {
                        if (window.__adBlockerInstalled) return;
                        window.__adBlockerInstalled = true;

                        const removeAds = () => {
                            // Only target definite ad elements to avoid false positives
                            const adSelectors = [
                                // Ad iframes with known sources
                                'iframe[src*="doubleclick.net"]',
                                'iframe[src*="googlesyndication.com"]',
                                'iframe[src*="googleadservices.com"]',
                                'iframe[src*="amazon-adsystem.com"]',
                                'iframe[src*="facebook.com/tr"]',
                                'iframe[src*="adsystem"]',

                                // Google AdSense
                                'ins.adsbygoogle',
                                'div[id="google_ads_frame"]',
                                '.google-auto-placed',

                                // AMP ads
                                'amp-ad',
                                'amp-embed',

                                // Elements with explicit ad attributes
                                '[data-ad]',
                                '[data-ad-slot]',
                                '[data-google-query-id]',
                                '[aria-label="advertisement" i]',
                                '[aria-label="sponsored" i]'
                            ];

                            adSelectors.forEach(selector => {
                                try {
                                    const elements = document.querySelectorAll(selector);
                                    elements.forEach(el => {
                                        el.remove();
                                    });
                                } catch (e) {
                                    // Silently fail on invalid selectors
                                }
                            });
                        };

                        // Initial cleanup
                        removeAds();

                        // Cleanup after dynamic content loads
                        setTimeout(removeAds, 1000);
                        setTimeout(removeAds, 3000);

                        // Monitor for dynamically added ads
                        const observer = new MutationObserver((mutations) => {
                            let foundAd = false;

                            for (let mutation of mutations) {
                                for (let node of mutation.addedNodes) {
                                    if (node.nodeType === 1) { // Element node
                                        // Check iframes
                                        if (node.tagName === 'IFRAME') {
                                            const src = node.src || '';
                                            if (src.includes('doubleclick') ||
                                                src.includes('googlesyndication') ||
                                                src.includes('googleadservices') ||
                                                src.includes('amazon-adsystem')) {
                                                node.remove();
                                                foundAd = true;
                                            }
                                        }
                                        // Check Google AdSense
                                        else if (node.tagName === 'INS' && node.classList.contains('adsbygoogle')) {
                                            node.remove();
                                            foundAd = true;
                                        }
                                        // Check for ads in children
                                        else if (node.querySelector) {
                                            const adChild = node.querySelector('ins.adsbygoogle, iframe[src*="doubleclick"]');
                                            if (adChild) {
                                                adChild.remove();
                                                foundAd = true;
                                            }
                                        }
                                    }
                                }
                            }

                            // If we found ads, do another cleanup pass
                            if (foundAd) {
                                setTimeout(removeAds, 100);
                            }
                        });

                        // Start observing
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                    })();
                `).catch(err => {
                    console.log('Could not install ad remover:', err);
                });
            }).catch(() => {
                console.log('Could not determine hostname for ad blocker');
            });
        } else {
            // Mark ad blocker as disabled
            webview.executeJavaScript(`
                window.__adBlockerInstalled = false;
            `).catch(() => {});
        }
    }
    
    getSelectedModel() {
        return this.modelSelect ? this.modelSelect.value : 'claude-sonnet-4-20250514';
    }
    
    showPageContextMenu(x, y) {
        // Store coordinates for inspect element feature
        this.contextMenuX = x;
        this.contextMenuY = y;

        // Hide any existing bookmark context menu
        this.hideContextMenu();
        this.hideTextContextMenu();

        // Create or get the invisible overlay
        let overlay = document.getElementById('context-menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'context-menu-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999;
                background: transparent;
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';
        
        // Position and show the menu
        this.pageContextMenu.style.left = x + 'px';
        this.pageContextMenu.style.top = y + 'px';
        this.pageContextMenu.classList.add('visible');
        
        // Update back and forward button states
        const backItem = this.pageContextMenu.querySelector('[data-action="back"]');
        const forwardItem = this.pageContextMenu.querySelector('[data-action="forward"]');
        const webview = this.getOrCreateWebview(this.activeTabId);

        if (backItem && webview) {
            const canGoBack = webview.canGoBack && typeof webview.canGoBack === 'function' ? webview.canGoBack() : false;
            backItem.style.opacity = canGoBack ? '1' : '0.5';
            backItem.style.cursor = canGoBack ? 'pointer' : 'not-allowed';
        }

        if (forwardItem && webview) {
            const canGoForward = webview.canGoForward && typeof webview.canGoForward === 'function' ? webview.canGoForward() : false;
            forwardItem.style.opacity = canGoForward ? '1' : '0.5';
            forwardItem.style.cursor = canGoForward ? 'pointer' : 'not-allowed';
        }
        
        // Handle clicks on the overlay
        overlay.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hidePageContextMenu();
        };
        
        // Prevent clicks on the menu from closing it
        this.pageContextMenu.onclick = (e) => {
            e.stopPropagation();
        };
    }
    
    hidePageContextMenu() {
        this.pageContextMenu.classList.remove('visible');
        
        // Hide the overlay
        const overlay = document.getElementById('context-menu-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // Remove click handler from menu
        this.pageContextMenu.onclick = null;
    }
    
    handlePageContextMenuAction(action) {
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;

        switch(action) {
            case 'back':
                this.goBack();
                break;
            case 'forward':
                this.goForward();
                break;
            case 'reload':
                this.refresh();
                break;
            case 'save-as':
                this.savePageAs();
                break;
            case 'print':
                webview.print();
                break;
            case 'view-source':
                this.viewPageSource();
                break;
            case 'inspect':
                this.inspectElementAtPosition(this.contextMenuX, this.contextMenuY);
                break;
        }
    }
    
    async savePageAs() {
        const tab = this.getCurrentTab();
        const webview = this.getOrCreateWebview(this.activeTabId);

        if (!tab || !tab.url || !webview) {
            this.showNotification('No page to save', 'error');
            return;
        }

        try {
            // Request the main process to show save dialog and save the page
            const result = await window.electronAPI.savePage({
                url: tab.url,
                title: tab.title || 'Untitled'
            });

            if (result.success) {
                this.showNotification('Page saved successfully', 'success');
            } else if (result.cancelled) {
                // User cancelled, no notification needed
            } else {
                this.showNotification(result.error || 'Failed to save page', 'error');
            }
        } catch (error) {
            console.error('Error saving page:', error);
            this.showNotification('Failed to save page', 'error');
        }
    }

    async viewPageSource() {
        const tab = this.getCurrentTab();
        const webview = this.getOrCreateWebview(this.activeTabId);

        if (!tab || !tab.url || !webview) return;

        try {
            // Get the HTML source from the webview
            const html = await webview.executeJavaScript('document.documentElement.outerHTML');

            // Apply syntax highlighting
            const highlightedHtml = this.highlightHTML(html);

            // Create the source viewer HTML
            const sourceViewerHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>View Source</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 12px;
            background: #1e1e1e;
            color: #d4d4d4;
            line-height: 1.6;
        }
        pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .header {
            background: #2d2d30;
            padding: 10px 20px;
            margin: -20px -20px 20px -20px;
            border-bottom: 1px solid #3e3e42;
            font-size: 13px;
        }
        /* Syntax highlighting colors */
        .tag { color: #569cd6; }
        .attr-name { color: #9cdcfe; }
        .attr-value { color: #ce9178; }
        .comment { color: #6a9955; font-style: italic; }
        .doctype { color: #569cd6; }
        .text { color: #d4d4d4; }
    </style>
</head>
<body>
    <div class="header">Source of: ${tab.url.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <pre>${highlightedHtml}</pre>
</body>
</html>`;

            // Write to a temporary file
            const tempFileName = `view-source-${Date.now()}.html`;
            const tempPathResult = await window.electronAPI.getTempPath(tempFileName);
            if (!tempPathResult.success) {
                console.error('Failed to get temp path:', tempPathResult.error);
                return;
            }
            const tempPath = tempPathResult.path;
            const writeResult = await window.electronAPI.writeFile(tempPath, sourceViewerHtml);
            if (!writeResult.success) {
                console.error('Failed to write temp file:', writeResult.error);
                return;
            }

            // Create a new tab with the file
            const sourceTabId = this.createTab(`file://${tempPath}`);

            // Update tab title
            const sourceTab = this.tabs.find(t => t.id === sourceTabId);
            if (sourceTab) {
                sourceTab.title = `Source: ${tab.title || tab.url}`;
                this.updateTabTitle(sourceTabId);
            }

            // Switch to the new tab
            this.switchToTab(sourceTabId);
        } catch (error) {
            console.error('Error viewing source:', error);
            this.showNotification('Failed to view page source', 'error');
        }
    }

    highlightHTML(html) {
        // Escape HTML entities first
        let escaped = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Highlight HTML comments
        escaped = escaped.replace(
            /(&lt;!--[\s\S]*?--&gt;)/g,
            '<span class="comment">$1</span>'
        );

        // Highlight DOCTYPE
        escaped = escaped.replace(
            /(&lt;!DOCTYPE[^&]*&gt;)/gi,
            '<span class="doctype">$1</span>'
        );

        // Highlight opening and closing tags with attributes
        escaped = escaped.replace(
            /(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z][a-zA-Z0-9-]*(?:=(?:"[^"]*"|'[^']*'|[^\s&gt;]*))?)*\s*)(\/?&gt;)/g,
            (match, openBracket, tagName, attributes, closeBracket) => {
                // Highlight tag brackets and name
                let result = `<span class="tag">${openBracket}${tagName}</span>`;

                // Highlight attributes
                if (attributes) {
                    result += attributes.replace(
                        /([a-zA-Z][a-zA-Z0-9-]*)(?:=((?:"[^"]*"|'[^']*'|[^\s&gt;]*)?))?/g,
                        (attrMatch, attrName, attrValue) => {
                            if (attrValue) {
                                return `<span class="attr-name">${attrName}</span>=<span class="attr-value">${attrValue}</span>`;
                            }
                            return `<span class="attr-name">${attrName}</span>`;
                        }
                    );
                }

                result += `<span class="tag">${closeBracket}</span>`;
                return result;
            }
        );

        return escaped;
    }
    
    async takeScreenshot() {
        const tab = this.getCurrentTab();
        if (!tab || tab.mode !== 'web') {
            alert('Screenshot only works on web pages. Navigate to a page first.');
            return;
        }

        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) return;

        const webview = content.querySelector('.tab-webview');
        if (!webview) return;

        try {
            // Capture the visible viewport of the webview
            const screenshot = await webview.capturePage();

            // Convert NativeImage to data URL
            const dataUrl = screenshot.toDataURL();

            // Create a download link
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                             new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
            const filename = `screenshot_${timestamp}.png`;

            link.href = dataUrl;
            link.download = filename;
            link.click();

            this.showNotification(`Screenshot saved as ${filename}`, 'success');
        } catch (error) {
            console.error('Error taking screenshot:', error);
            alert('Failed to take screenshot: ' + error.message);
        }
    }

    async generateSearchSuggestions() {
        try {
            const tab = this.getCurrentTab();
            if (!tab) {
                this.showNotification('No active page to analyze', 'error');
                return;
            }
            
            // Get the webview for this tab
            const webview = this.getOrCreateWebview(this.activeTabId);
            if (!webview || tab.mode !== 'web') {
                this.showNotification('Please navigate to a webpage first', 'error');
                return;
            }
            
            // Get the overlay from the current tab's content
            const currentContent = this.getCurrentContent();
            if (!currentContent) {
                console.error('No current content found!');
                return;
            }
            
            const suggestionsOverlay = currentContent.querySelector('.tab-suggestions-overlay');
            if (!suggestionsOverlay) {
                console.error('Suggestions overlay not found in current tab!');
                return;
            }
            
            const suggestionsList = suggestionsOverlay.querySelector('.suggestions-list');
            const suggestionsLoading = suggestionsOverlay.querySelector('.suggestions-loading');
            
            if (!suggestionsList || !suggestionsLoading) {
                console.error('Suggestions list or loading element not found!');
                return;
            }
            
            // Show overlay with loading state
            suggestionsOverlay.classList.remove('hidden');
            suggestionsLoading.style.display = 'block';
            suggestionsLoading.textContent = 'Analyzing page context...';
            suggestionsList.style.display = 'none';
            suggestionsList.innerHTML = '';
            
            // Set up close handlers for this overlay
            const closeBtn = suggestionsOverlay.querySelector('.suggestions-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    suggestionsOverlay.classList.add('hidden');
                };
            }
            
            // Click outside to close
            suggestionsOverlay.onclick = (e) => {
                if (e.target === suggestionsOverlay) {
                    suggestionsOverlay.classList.add('hidden');
                }
            };
            
            
            // Get page content
            const pageText = await webview.executeJavaScript(`
                (() => {
                    const getText = (el) => {
                        let text = '';
                        for (const node of el.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                text += node.textContent + ' ';
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                if (!['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) {
                                    text += getText(node) + ' ';
                                }
                            }
                        }
                        return text;
                    };
                    return getText(document.body).replace(/\\s+/g, ' ').trim();
                })()
            `);
            
            // Get selected model
            const modelSelect = document.getElementById('model-select');
            const model = modelSelect.value;

            // Generate suggestions using Claude
            const result = await window.electronAPI.generateSearchSuggestions(
                tab.url,
                tab.title,
                pageText,
                model
            );
            
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            // Hide loading, show suggestions
            suggestionsLoading.style.display = 'none';
            suggestionsList.style.display = 'block';
            suggestionsList.style.visibility = 'visible';
            suggestionsList.style.opacity = '1';
            suggestionsList.style.minHeight = '100px';
            
            // Clear and verify
            suggestionsList.innerHTML = '';
            
            // Fallback test data if API fails
            if (!result.suggestions || result.suggestions.length === 0) {
                result.suggestions = [
                    { query: "test search 1", context: "This is a test suggestion" },
                    { query: "test search 2", context: "Another test suggestion" }
                ];
            }
            
            // Render suggestions
            if (result.suggestions && result.suggestions.length > 0) {
                
                result.suggestions.forEach((suggestion, index) => {
                    const suggestionEl = document.createElement('div');
                    suggestionEl.className = 'suggestion-item';
                    suggestionEl.innerHTML = `
                        <div class="suggestion-query">${suggestion.query}</div>
                        <div class="suggestion-context">${suggestion.context || ''}</div>
                    `;
                    
                    // Click to search in new tab
                    suggestionEl.addEventListener('click', () => {
                        // Create a new tab with the Claude search
                        const newTabId = this.createTab(suggestion.query);
                        
                        // Switch to the new tab after a brief delay
                        setTimeout(() => {
                            this.switchToTab(newTabId);
                        }, 100);
                        
                        // The overlay stays open in the original tab
                        // Since it's part of that tab's content, it will still be there when you return
                    });

                    suggestionsList.appendChild(suggestionEl);
                });

            } else {
                suggestionsList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No suggestions generated</div>';
            }
            
        } catch (error) {
            console.error('Error generating suggestions:', error);
            
            const suggestionsOverlay = document.getElementById('suggestions-overlay');
            const suggestionsList = suggestionsOverlay ? suggestionsOverlay.querySelector('.suggestions-list') : null;
            const suggestionsLoading = suggestionsOverlay ? suggestionsOverlay.querySelector('.suggestions-loading') : null;
            
            if (suggestionsLoading) suggestionsLoading.style.display = 'none';
            if (suggestionsList) {
                suggestionsList.style.display = 'block';
                suggestionsList.style.visibility = 'visible';
                suggestionsList.style.opacity = '1';
                suggestionsList.innerHTML = DOMPurify.sanitize(`<div style="text-align: center; color: #d32f2f; padding: 20px;">Error: ${error.message}</div>`);
            }
        }
    }
    
    async createSmartBookmark() {
        const tab = this.getCurrentTab();
        if (!tab || !tab.url || tab.mode !== 'web') {
            alert('Please navigate to a webpage first');
            return;
        }
        
        // Show loading notification
        this.showNotification('🤖 Analyzing page for smart bookmark...', 5000);
        
        try {
            // Get the webview
            const webview = this.getOrCreateWebview(this.activeTabId);
            if (!webview) {
                alert('No webpage loaded');
                return;
            }
            
            // Extract page content
            const pageContent = await webview.executeJavaScript(`
                (function() {
                    // Get page metadata
                    const title = document.title || '';
                    const description = document.querySelector('meta[name="description"]')?.content || 
                                      document.querySelector('meta[property="og:description"]')?.content || '';
                    const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
                    
                    // Get main content text (limit to avoid token limits)
                    const bodyText = document.body ? document.body.innerText.substring(0, 2000) : '';
                    
                    return {
                        title: title,
                        description: description,
                        keywords: keywords,
                        content: bodyText,
                        url: window.location.href
                    };
                })();
            `);
            
            // Use Claude to generate tags and description
            const model = this.getSelectedModel();
            const result = await window.electronAPI.analyzeBookmark(
                pageContent.url,
                pageContent.title,
                pageContent.description,
                pageContent.keywords,
                pageContent.content,
                model
            );
            
            if (result.success) {
                // Add the bookmark with smart data
                this.addBookmark(
                    tab.url,
                    tab.title || pageContent.title,
                    tab.favicon,
                    result.tags || [],
                    result.description || ''
                );
                
                this.showNotification('✅ Smart bookmark added with tags and description!', 3000);
            } else {
                // Fallback to regular bookmark
                this.addBookmark(tab.url, tab.title, tab.favicon);
                this.showNotification('📌 Bookmark added (without smart features)', 3000);
            }
        } catch (error) {
            console.error('Error creating smart bookmark:', error);
            // Fallback to regular bookmark
            this.addBookmark(tab.url, tab.title, tab.favicon);
            this.showNotification('📌 Bookmark added (without smart features)', 3000);
        }
    }
    
    showNotification(message, duration = 5000) {  // Increased default from 3s to 5s
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInRight 0.6s ease-out;  /* Slower animation from 0.3s to 0.6s */
            max-width: 450px;
            font-size: 15px;
            font-weight: 500;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        notification.innerHTML = `<span>${message}</span>`;
        
        // Add animation if not already present
        if (!document.querySelector('#notification-animations')) {
            const style = document.createElement('style');
            style.id = 'notification-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(120%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(120%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease-out';  // Slower exit animation
            notification.style.animationFillMode = 'forwards';
            setTimeout(() => {
                notification.remove();
            }, 500);  // Match the animation duration
        }, duration);
    }
    
    async startCasting() {
        const tab = this.getCurrentTab();
        if (!tab || !tab.url) return;
        
        try {
            // Request casting through the main process
            const result = await window.electronAPI.startCast(tab.url, tab.title);
            
            if (result.success) {
                // Show a notification that casting has started
                this.showCastNotification('Casting to ' + result.deviceName);
            } else if (result.error) {
                console.error('Failed to start casting:', result.error);
                if (result.error === 'NO_DEVICES_FOUND') {
                    alert('No Chromecast devices found on your network');
                } else if (result.error === 'USER_CANCELLED') {
                    // User cancelled, do nothing
                } else {
                    alert('Failed to start casting: ' + result.error);
                }
            }
        } catch (error) {
            console.error('Error starting cast:', error);
            alert('Failed to start casting');
        }
    }
    
    showCastNotification(message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.innerHTML = `
            <span style="font-size: 20px;">📺</span>
            <span>${message}</span>
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            notification.style.animationFillMode = 'forwards';
            setTimeout(() => {
                notification.remove();
                style.remove();
            }, 300);
        }, 3000);
    }
    
    // Link context menu functionality
    showLinkContextMenu(x, y, linkUrl) {
        // Store coordinates for inspect element feature
        this.contextMenuX = x;
        this.contextMenuY = y;

        // Hide any existing menus
        this.hideContextMenu();
        this.hidePageContextMenu();
        this.hideTextContextMenu();

        // Store the link URL for later use
        this.currentLinkUrl = linkUrl;
        
        // Create or get the invisible overlay
        let overlay = document.getElementById('context-menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'context-menu-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999;
                background: transparent;
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';
        
        // Position and show the menu
        this.linkContextMenu.style.left = x + 'px';
        this.linkContextMenu.style.top = y + 'px';
        this.linkContextMenu.classList.add('visible');
        
        // Handle clicks on the overlay
        overlay.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideLinkContextMenu();
        };
        
        // Prevent clicks on the menu from closing it
        this.linkContextMenu.onclick = (e) => {
            e.stopPropagation();
        };
    }
    
    hideLinkContextMenu() {
        this.linkContextMenu.classList.remove('visible');
        this.currentLinkUrl = null;
        
        // Hide the overlay
        const overlay = document.getElementById('context-menu-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // Remove click handler from menu
        this.linkContextMenu.onclick = null;
    }
    
    handleLinkContextMenuAction(action) {
        if (!this.currentLinkUrl) return;

        switch(action) {
            case 'open-new-tab':
                this.createTab(this.currentLinkUrl);
                break;
            case 'open-new-window':
                window.electronAPI.newWindowWithUrl(this.currentLinkUrl);
                break;
            case 'open-incognito-tab':
                // Create incognito tab with the URL
                const incognitoTabId = this.createTab(this.currentLinkUrl, true);
                // Switch to the new incognito tab
                setTimeout(() => {
                    this.switchToTab(incognitoTabId);
                }, 100);
                break;
            case 'open-incognito-window':
                // Open URL in new incognito window
                window.electronAPI.newIncognitoWindowWithUrl(this.currentLinkUrl);
                break;
            case 'copy-link':
                // Copy to clipboard
                const tempInput = document.createElement('textarea');
                tempInput.value = this.currentLinkUrl;
                tempInput.style.position = 'absolute';
                tempInput.style.left = '-9999px';
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                break;
            case 'inspect':
                this.inspectElementAtPosition(this.contextMenuX, this.contextMenuY);
                break;
        }
    }

    // Text selection context menu functionality
    showTextContextMenu(x, y, selectedText) {
        // Store coordinates for inspect element feature
        this.contextMenuX = x;
        this.contextMenuY = y;

        // Hide any existing menus
        this.hideContextMenu();
        this.hidePageContextMenu();
        this.hideLinkContextMenu();

        // Store the selected text for later use
        this.currentSelectedText = selectedText;

        // Update the preview text in the menu
        const previewElement = this.textContextMenu.querySelector('.selected-text-preview');
        if (previewElement) {
            // Truncate long text for display
            const displayText = selectedText.length > 30 ?
                selectedText.substring(0, 30) + '...' :
                selectedText;
            previewElement.textContent = displayText;
        }

        // Create or get the invisible overlay
        let overlay = document.getElementById('context-menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'context-menu-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999;
                background: transparent;
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';

        // Position and show the menu
        this.textContextMenu.style.left = x + 'px';
        this.textContextMenu.style.top = y + 'px';
        this.textContextMenu.classList.add('visible');

        // Handle clicks on the overlay
        overlay.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideTextContextMenu();
        };

        // Prevent clicks on the menu from closing it
        this.textContextMenu.onclick = (e) => {
            e.stopPropagation();
        };
    }

    hideTextContextMenu() {
        if (this.textContextMenu) {
            this.textContextMenu.classList.remove('visible');
        }
        this.currentSelectedText = null;

        // Hide the overlay
        const overlay = document.getElementById('context-menu-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        // Remove click handler from menu
        if (this.textContextMenu) {
            this.textContextMenu.onclick = null;
        }
    }

    handleTextContextMenuAction(action) {
        if (!this.currentSelectedText) return;

        switch(action) {
            case 'copy-text':
                // Copy to clipboard
                const tempInput = document.createElement('textarea');
                tempInput.value = this.currentSelectedText;
                tempInput.style.position = 'absolute';
                tempInput.style.left = '-9999px';
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                this.showNotification('✅ Text copied to clipboard', 2000);
                break;
            case 'search-claude':
                // Create a new tab and search with Claude
                // Capture the selected text before it gets cleared
                const searchText = this.currentSelectedText;
                const newTabId = this.createTab();
                // Give the tab more time to fully initialize
                setTimeout(async () => {
                    this.switchToTab(newTabId);
                    // Make sure the tab is current before searching
                    const tab = this.getCurrentTab();
                    if (tab && tab.id === newTabId) {
                        this.addressBar.value = searchText;
                        // Ensure the tab content is ready
                        const content = this.tabsContent.querySelector(`[data-tab-id="${newTabId}"]`);
                        if (content && searchText) {
                            // Directly search with Claude since it's not a URL
                            await this.searchWithClaude(searchText);
                        }
                    }
                }, 200);
                break;
            case 'inspect':
                this.inspectElementAtPosition(this.contextMenuX, this.contextMenuY);
                break;
        }
    }

    // Search functionality
    setupSearchBar() {
        this.searchBar = document.getElementById('search-bar');
        this.searchInput = document.getElementById('search-input');
        this.searchResults = document.getElementById('search-results');
        this.searchPrev = document.getElementById('search-prev');
        this.searchNext = document.getElementById('search-next');
        this.searchClose = document.getElementById('search-close');
        
        this.currentSearchRequestId = null;
        this.currentSearchResultCount = 0;
        this.currentSearchActiveIndex = 0;
        
        // Search input handler
        this.searchInput.addEventListener('input', () => {
            this.performSearch();
        });
        
        // Enter key to go to next result
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.findPrevious();
                } else {
                    this.findNext();
                }
            } else if (e.key === 'Escape') {
                this.hideSearchBar();
            }
        });
        
        // Previous/Next buttons
        this.searchPrev.addEventListener('click', () => this.findPrevious());
        this.searchNext.addEventListener('click', () => this.findNext());
        
        // Close button
        this.searchClose.addEventListener('click', () => this.hideSearchBar());
    }
    
    showSearchBar() {
        const tab = this.getCurrentTab();
        if (!tab) {
            return;
        }

        if (tab.mode !== 'web') {
            return;
        }

        this.searchBar.classList.remove('hidden');
        this.searchInput.focus();
        this.searchInput.select();

        // Clear previous search
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (webview) {
            webview.stopFindInPage('clearSelection');
        }
    }
    
    hideSearchBar() {
        this.searchBar.classList.add('hidden');
        this.searchInput.value = '';
        this.updateSearchResults(0, 0);

        // Clear search highlights and remove listener
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (webview) {
            webview.stopFindInPage('clearSelection');
            if (this.searchResultListener) {
                webview.removeEventListener('found-in-page', this.searchResultListener);
                this.searchResultListener = null;
            }
        }

        // Reset search state
        this.currentSearchResultCount = 0;
        this.currentSearchActiveIndex = 0;
    }

    toggleWebviewDevTools() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab) {
            return;
        }

        // Get the webview element directly from DOM
        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) {
            return;
        }

        const webview = content.querySelector('webview');
        if (!webview) {
            return;
        }

        // Webview elements have isDevToolsOpened and openDevTools/closeDevTools methods
        try {
            if (webview.isDevToolsOpened()) {
                webview.closeDevTools();
            } else {
                webview.openDevTools();
            }
        } catch (err) {
            console.error('Error toggling DevTools:', err);
            // Fallback: just try to open DevTools
            try {
                webview.openDevTools();
            } catch (e) {
                console.error('Failed to open DevTools:', e);
            }
        }
    }

    inspectElementAtPosition(x, y) {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab) {
            return;
        }

        // Get the webview element directly from DOM
        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) {
            return;
        }

        const webview = content.querySelector('webview');
        if (!webview) {
            return;
        }

        // Use inspectElement with coordinates to open dev tools at the specific element
        try {
            webview.inspectElement(x, y);
        } catch (err) {
            console.error('Error inspecting element:', err);
            // Fallback to just opening DevTools
            try {
                webview.openDevTools();
            } catch (e) {
                console.error('Failed to open DevTools:', e);
            }
        }
    }

    performSearch() {
        const searchText = this.searchInput.value;
        if (!searchText) {
            this.updateSearchResults(0, 0);
            const webview = this.getOrCreateWebview(this.activeTabId);
            if (webview) {
                webview.stopFindInPage('clearSelection');
            }
            return;
        }
        
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;
        
        // Remove any existing listener
        if (this.searchResultListener) {
            webview.removeEventListener('found-in-page', this.searchResultListener);
        }
        
        // Set up listener for search results
        this.searchResultListener = (e) => {
            this.currentSearchResultCount = e.result.matches || 0;
            this.currentSearchActiveIndex = e.result.activeMatchOrdinal || 0;
            this.updateSearchResults(this.currentSearchActiveIndex, this.currentSearchResultCount);
            
            // Update button states
            this.searchPrev.disabled = this.currentSearchResultCount === 0;
            this.searchNext.disabled = this.currentSearchResultCount === 0;
        };
        
        webview.addEventListener('found-in-page', this.searchResultListener);
        
        // Start the search
        webview.findInPage(searchText);
    }
    
    findNext() {
        const searchText = this.searchInput.value;
        if (!searchText || this.currentSearchResultCount === 0) return;
        
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;
        
        webview.findInPage(searchText, {
            forward: true,
            findNext: true
        });
    }
    
    findPrevious() {
        const searchText = this.searchInput.value;
        if (!searchText || this.currentSearchResultCount === 0) return;
        
        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview) return;
        
        webview.findInPage(searchText, {
            forward: false,
            findNext: true
        });
    }
    
    updateSearchResults(current, total) {
        if (total === 0) {
            this.searchResults.textContent = '0 of 0';
        } else {
            this.searchResults.textContent = `${current} of ${total}`;
        }
    }

    async savePageAs() {
        const tab = this.getCurrentTab();
        if (!tab) {
            this.showNotification('No active tab to save', 'error');
            return;
        }

        // Check if it's a web page
        if (tab.mode !== 'web') {
            this.showNotification('Can only save web pages', 'error');
            return;
        }

        const webview = this.getOrCreateWebview(this.activeTabId);
        if (!webview || !webview.src) {
            this.showNotification('No page loaded to save', 'error');
            return;
        }

        try {
            // Get the page HTML
            const pageHTML = await webview.executeJavaScript(`
                (() => {
                    // Create a complete HTML document with inline styles
                    const doctype = '<!DOCTYPE html>';
                    const html = document.documentElement.outerHTML;
                    return doctype + '\\n' + html;
                })()
            `);

            // Generate filename from title or URL
            const defaultFileName = (tab.title || 'webpage').replace(/[^a-z0-9]/gi, '_').substring(0, 50) + '.html';

            // Show save dialog
            const result = await window.electronAPI.showSaveDialog(defaultFileName);

            if (!result.canceled && result.filePath) {
                // Write the file
                const writeResult = await window.electronAPI.writeFile(result.filePath, pageHTML);

                if (writeResult.success) {
                    this.showNotification(`✅ Page saved to ${result.filePath.split('/').pop()}`, 'success');
                } else {
                    this.showNotification(`❌ Failed to save: ${writeResult.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Error saving page:', error);
            this.showNotification('Failed to save page: ' + error.message, 'error');
        }
    }

    printPage() {
        const tab = this.getCurrentTab();
        if (!tab) {
            this.showNotification('No active tab to print', 'error');
            return;
        }

        // Check what type of content we're printing
        if (tab.mode === 'web') {
            // Print web content
            const webview = this.getOrCreateWebview(this.activeTabId);
            if (webview && webview.src) {
                // Ensure webview is ready and focused before printing
                webview.focus();

                // Use setTimeout to ensure the webview is ready
                setTimeout(() => {
                    try {
                        // Webview elements have a print() method that shows the print dialog
                        webview.print();
                        // Note: The print dialog is shown but we don't get a callback
                        // so we just show a success message
                        setTimeout(() => {
                            this.showNotification('✅ Print dialog opened', 'success');
                        }, 500);
                    } catch (error) {
                        console.error('Print error:', error);
                        this.showNotification('Failed to open print dialog', 'error');
                    }
                }, 100);
            } else {
                this.showNotification('No page loaded to print', 'error');
            }
        } else if (tab.mode === 'claude') {
            // Print Claude results - use window.print for the main content
            const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"] .tab-claude-results`);
            if (content && content.innerHTML) {
                // Create a temporary print window with just the Claude results
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Print - ${tab.title || 'Claude Results'}</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                padding: 20px;
                                max-width: 800px;
                                margin: 0 auto;
                            }
                            pre {
                                background: #f5f5f5;
                                padding: 10px;
                                border-radius: 4px;
                                overflow-wrap: break-word;
                            }
                            code {
                                background: #f0f0f0;
                                padding: 2px 4px;
                                border-radius: 3px;
                            }
                            h1, h2, h3 { margin-top: 20px; }
                            @media print {
                                body { padding: 0; }
                            }
                        </style>
                    </head>
                    <body>
                        ${content.innerHTML}
                    </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.close();
                this.showNotification('✅ Print dialog opened', 'success');
            } else {
                this.showNotification('No Claude results to print', 'error');
            }
        } else {
            // Welcome screen - nothing to print
            this.showNotification('Nothing to print on welcome screen', 'info');
        }
    }

    async viewPageSource() {
        const tab = this.getCurrentTab();
        if (!tab) {
            this.showNotification('No active tab', 'error');
            return;
        }

        if (tab.mode !== 'web') {
            this.showNotification('Page source only available for web pages', 'info');
            return;
        }

        // Get the current webview that's already attached to the DOM
        const content = this.getCurrentContent();
        const webview = content.querySelector('.tab-webview');

        if (!webview || !webview.src) {
            this.showNotification('No page loaded', 'error');
            return;
        }

        try {
            // Get the page source - wrap in try to handle any JavaScript errors
            const source = await webview.executeJavaScript(`
                (function() {
                    try {
                        return document.documentElement.outerHTML;
                    } catch (e) {
                        return 'Error: ' + e.message;
                    }
                })()
            `);

            if (!source) {
                this.showNotification('Page source is empty', 'error');
                return;
            }

            const pageUrl = webview.getURL();

            // Create HTML page with syntax-highlighted source
            const sourceHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>View Source: ${pageUrl}</title>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css">
                    <style>
                        body {
                            margin: 0;
                            padding: 20px;
                            background: #f5f5f5;
                            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
                            font-size: 13px;
                            line-height: 1.5;
                        }
                        .header {
                            background: white;
                            padding: 15px;
                            margin: -20px -20px 20px -20px;
                            border-bottom: 1px solid #ddd;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        }
                        .url {
                            color: #666;
                            font-size: 13px;
                            word-break: break-all;
                        }
                        .source-container {
                            background: white;
                            border-radius: 4px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            overflow: hidden;
                        }
                        pre {
                            margin: 0;
                            padding: 20px;
                            overflow-x: auto;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        }
                        code {
                            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
                            font-size: 13px;
                        }
                        /* Line numbers */
                        .hljs {
                            background: white;
                            padding: 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <strong>View Source</strong>
                        <div class="url">${pageUrl}</div>
                    </div>
                    <div class="source-container">
                        <pre><code class="language-html">${source.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                    </div>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
                    <script>hljs.highlightAll();</script>
                </body>
                </html>
            `;

            // Create a data URL for the source
            const dataURL = 'data:text/html;charset=utf-8,' + encodeURIComponent(sourceHTML);

            // Create a new tab with the data URL
            const sourceTabId = this.createTab(dataURL);

            // Update the tab title
            this.updateTabTitle(sourceTabId, `Source: ${tab.title || 'Untitled'}`);

            // Switch to the new tab
            this.switchToTab(sourceTabId);

            this.showNotification('✅ Page source opened in new tab', 'success');
        } catch (error) {
            console.error('Error getting page source:', error);
            console.error('Error stack:', error.stack);
            this.showNotification(`Failed to get page source: ${error.message}`, 'error');
        }
    }

    nextTab() {
        if (this.tabs.length <= 1) return;

        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        const nextIndex = (currentIndex + 1) % this.tabs.length;
        this.switchToTab(this.tabs[nextIndex].id);
    }

    previousTab() {
        if (this.tabs.length <= 1) return;

        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        const previousIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
        this.switchToTab(this.tabs[previousIndex].id);
    }

    moveTabRight() {
        if (this.tabs.length <= 1) return;

        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        if (currentIndex === this.tabs.length - 1) {
            // Already at the rightmost position
            return;
        }

        // Swap with next tab
        const nextIndex = currentIndex + 1;
        [this.tabs[currentIndex], this.tabs[nextIndex]] = [this.tabs[nextIndex], this.tabs[currentIndex]];

        // Update DOM positions
        this.reorderTabsInDOM();
    }

    moveTabLeft() {
        if (this.tabs.length <= 1) return;

        const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
        if (currentIndex === 0) {
            // Already at the leftmost position
            return;
        }

        // Swap with previous tab
        const previousIndex = currentIndex - 1;
        [this.tabs[currentIndex], this.tabs[previousIndex]] = [this.tabs[previousIndex], this.tabs[currentIndex]];

        // Update DOM positions
        this.reorderTabsInDOM();
    }

    duplicateTab() {
        // Get the current active tab
        const currentTab = this.tabs.find(t => t.id === this.activeTabId);
        if (!currentTab) return;

        // Create a new tab
        const newTabId = this.createTab(currentTab.isIncognito);
        const newTab = this.tabs.find(t => t.id === newTabId);
        if (!newTab) return;

        // Copy the current tab's state
        newTab.title = currentTab.title;
        newTab.url = currentTab.url;
        newTab.favicon = currentTab.favicon;
        newTab.mode = currentTab.mode;

        // Update the tab title in the UI
        this.updateTabTitle(newTabId, newTab.title);

        // Update favicon if exists
        if (newTab.favicon) {
            const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${newTabId}"]`);
            if (tabElement) {
                const favicon = tabElement.querySelector('.tab-favicon');
                if (favicon) {
                    favicon.src = newTab.favicon;
                    favicon.style.display = 'block';
                }
            }
        }

        // Handle different modes
        const content = this.tabsContent.querySelector(`[data-tab-id="${newTabId}"]`);
        if (!content) return;

        if (currentTab.mode === 'web' && currentTab.url) {
            // Navigate to the same URL
            this.showWebView(newTabId);
            const webview = this.getOrCreateWebview(newTabId);
            if (webview) {
                webview.src = currentTab.url;
            }
        } else if (currentTab.mode === 'claude') {
            // If it's a Claude search result, we just switch to Claude mode
            // but don't duplicate the search (user can re-run if needed)
            this.showClaudeResults(newTabId);
            const claudeResults = content.querySelector('.tab-claude-results');
            if (claudeResults) {
                claudeResults.innerHTML = `
                    <div class="claude-response">
                        <div class="query-header">Duplicated from: ${currentTab.title}</div>
                        <div class="response-content">
                            <p>This tab was duplicated from a Claude search. Enter a new query in the address bar to search again.</p>
                        </div>
                    </div>
                `;
            }
        } else if (currentTab.mode === 'history') {
            // Duplicate history view
            this.showHistory();
        } else if (currentTab.mode === 'settings') {
            // Duplicate settings view
            this.showSettings();
        }

        // Update address bar if URL exists
        if (currentTab.url && this.activeTabId === newTabId) {
            this.addressBar.value = currentTab.url;
        }

        // Add to history if it's a web URL (but not if it's a recording tab)
        if (currentTab.mode === 'web' && currentTab.url && currentTab.id !== this.recordingTabId) {
            const isAutomation = (currentTab.id === this.recordingTabId);
            this.addToHistory(currentTab.url, newTab.title, newTab.favicon, null, isAutomation);
        }
    }

    reorderTabsInDOM() {
        // Clear and rebuild tab bar to match the tabs array order
        const tabElements = [];
        this.tabs.forEach(tab => {
            const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${tab.id}"]`);
            if (tabElement) {
                tabElements.push(tabElement);
            }
        });

        // Remove all tabs from container
        tabElements.forEach(el => el.remove());

        // Add them back in the correct order
        tabElements.forEach((el, index) => {
            const tabId = parseInt(el.dataset.tabId);
            const tab = this.tabs[index];
            if (tab.id === tabId) {
                this.tabsContainer.appendChild(el);
            }
        });
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('browsingHistory');
            if (saved) {
                this.browsingHistory = JSON.parse(saved);
                // Clean up potential automation URLs from old data
                this.cleanupAutomationHistory();
            }
        } catch (error) {
            console.error('Failed to load history:', error);
            this.browsingHistory = [];
        }
    }

    cleanupAutomationHistory() {
        // Remove entries that look like they came from automation recording
        // Use multiple heuristics to identify automation patterns

        // Sort by timestamp to process in chronological order
        const sortedHistory = [...this.browsingHistory].sort((a, b) => a.lastVisited - b.lastVisited);

        // Mark items that are part of automation bursts
        const markedForRemoval = new Set();

        for (let i = 0; i < sortedHistory.length; i++) {
            const item = sortedHistory[i];

            // Heuristic 1: Rapid sequential navigation (2+ URLs in 3 seconds)
            // Very aggressive to catch automation
            const windowSize = 3000; // 3 seconds
            const minBurstSize = 2; // Just 2 rapid URLs to flag

            const recentItems = [];
            for (let j = i - 1; j >= 0; j--) {
                const timeDiff = item.lastVisited - sortedHistory[j].lastVisited;
                if (timeDiff > windowSize) break;
                if (sortedHistory[j].url !== item.url) { // Different URLs
                    recentItems.push(sortedHistory[j]);
                }
            }

            if (recentItems.length >= minBurstSize - 1) {
                // Mark this entire burst as automation
                markedForRemoval.add(item);
                recentItems.forEach(r => markedForRemoval.add(r));
            }

            // Heuristic 2: Very rapid navigation (< 1000ms between different URLs)
            // This catches fast automation even if there aren't many URLs
            if (i > 0) {
                const prevItem = sortedHistory[i - 1];
                const timeDiff = item.lastVisited - prevItem.lastVisited;

                if (timeDiff < 1000 && item.url !== prevItem.url) {
                    markedForRemoval.add(item);
                    markedForRemoval.add(prevItem);
                }
            }

            // Heuristic 3: Common automation patterns in URLs
            // These patterns suggest automated testing/recording
            const automationPatterns = [
                /localhost:\d+/i,
                /127\.0\.0\.1:\d+/i,
                /0\.0\.0\.0:\d+/i,
                /test\.html/i,
                /demo\.html/i,
                /sample\.html/i,
                /example\.html/i,
                /automation/i,
                /puppeteer/i,
                /selenium/i,
                /webdriver/i,
                /playwright/i,
                /cypress/i,
                /testcafe/i
            ];

            const looksLikeAutomation = automationPatterns.some(pattern => pattern.test(item.url));

            // If URL looks like automation, always remove it (don't require rapid sequence)
            if (looksLikeAutomation) {
                markedForRemoval.add(item);
            }

            // Heuristic 5: Automation-related titles
            // Remove entries with titles that look like automation names
            const automationTitlePatterns = [
                /🤖/,
                /automation/i,
                /recording/i,
                /playback/i,
                /running\.\.\./i,
                /▶️/,
                /🎯/
            ];

            const hasAutomationTitle = item.title && automationTitlePatterns.some(pattern => pattern.test(item.title));
            if (hasAutomationTitle) {
                markedForRemoval.add(item);
            }

            // Heuristic 4: Duplicate URLs visited very close together
            // Check if the same URL was visited multiple times in a short window
            if (i > 0) {
                const duplicateWindow = 10000; // 10 seconds
                const sameUrlVisits = [];
                for (let j = i - 1; j >= 0; j--) {
                    const timeDiff = item.lastVisited - sortedHistory[j].lastVisited;
                    if (timeDiff > duplicateWindow) break;
                    if (sortedHistory[j].url === item.url) {
                        sameUrlVisits.push(sortedHistory[j]);
                    }
                }

                // If same URL visited 3+ times in 10 seconds, likely automation
                if (sameUrlVisits.length >= 2) {
                    markedForRemoval.add(item);
                    sameUrlVisits.forEach(r => markedForRemoval.add(r));
                }
            }
        }

        // Filter out marked items
        const cleanedHistory = sortedHistory.filter(item => !markedForRemoval.has(item));

        // Only update if we actually removed items
        if (cleanedHistory.length < this.browsingHistory.length) {
            this.browsingHistory = cleanedHistory;
            this.saveHistory();
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('browsingHistory', JSON.stringify(this.browsingHistory));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    // Removed duplicate addToHistory - using the one at line 5811 instead

    showHistory() {
        // Create a new tab with history view
        const tabId = this.createTab();
        const tab = this.tabs.find(t => t.id === tabId);

        if (tab) {
            tab.mode = 'history';
            tab.title = 'History';
            this.updateTabTitle(tabId, 'History');

            // Show history UI
            const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
            if (content) {
                const webview = content.querySelector('.tab-webview');
                if (webview) webview.style.display = 'none';

                content.querySelector('.tab-welcome-screen').style.display = 'none';
                const claudeResults = content.querySelector('.tab-claude-results');
                claudeResults.style.display = 'block';

                this.renderHistoryPage(claudeResults);
            }
        }
    }

    async showSettings() {
        // Create a new tab with settings view
        const tabId = this.createTab();
        const tab = this.tabs.find(t => t.id === tabId);

        if (tab) {
            tab.mode = 'settings';
            tab.title = 'Settings';
            this.updateTabTitle(tabId, 'Settings');

            // Show settings UI
            const content = this.tabsContent.querySelector(`[data-tab-id="${tabId}"]`);
            if (content) {
                const webview = content.querySelector('.tab-webview');
                if (webview) webview.style.display = 'none';

                content.querySelector('.tab-welcome-screen').style.display = 'none';
                const claudeResults = content.querySelector('.tab-claude-results');
                claudeResults.style.display = 'block';

                this.renderSettingsPage(claudeResults);
            }
        }
    }

    renderSettingsPage(container) {
        // Get current API key, GPU settings, and browser settings
        Promise.all([
            window.electronAPI.getApiKey(),
            window.electronAPI.getInceptionApiKey(),
            window.electronAPI.getGpuAcceleration ? window.electronAPI.getGpuAcceleration() : Promise.resolve({ enabled: true }),
            this.loadSettings()
        ]).then(([apiResult, inceptionApiResult, gpuResult, browserSettings]) => {
            const currentKey = apiResult.apiKey || '';
            const maskedKey = currentKey ? `${currentKey.substring(0, 8)}...${currentKey.substring(currentKey.length - 4)}` : '';
            const currentInceptionKey = inceptionApiResult.apiKey || '';
            const maskedInceptionKey = currentInceptionKey ? `${currentInceptionKey.substring(0, 8)}...${currentInceptionKey.substring(currentInceptionKey.length - 4)}` : '';
            const gpuEnabled = gpuResult.enabled !== false; // Default to true if not set

            container.innerHTML = `
                <div class="settings-page">
                    <div class="settings-header">
                        <h1>Settings</h1>
                    </div>
                    <div class="settings-content">
                        <div class="settings-section">
                            <h2>API Keys</h2>
                            <div class="settings-group">
                                <label for="api-key-input">Anthropic API Key</label>
                                <div class="api-key-input-group">
                                    <input type="password"
                                           id="api-key-input"
                                           class="settings-input"
                                           placeholder="sk-ant-api..."
                                           value="${currentKey}">
                                    <button id="toggle-api-key-visibility" class="settings-button secondary">Show</button>
                                </div>
                                <div class="settings-hint">
                                    ${currentKey ? `Current key: ${maskedKey}` : 'No API key configured'}
                                </div>
                                <div class="settings-actions">
                                    <button id="save-api-key" class="settings-button primary">Save API Key</button>
                                    <a href="#" id="get-api-key-link" class="settings-link">Get an API key from Anthropic Console →</a>
                                </div>
                            </div>
                            <div class="settings-group" style="margin-top: 20px;">
                                <label for="inception-api-key-input">Inception Labs API Key</label>
                                <div class="api-key-input-group">
                                    <input type="password"
                                           id="inception-api-key-input"
                                           class="settings-input"
                                           placeholder="Enter Inception Labs API key"
                                           value="${currentInceptionKey}">
                                    <button id="toggle-inception-api-key-visibility" class="settings-button secondary">Show</button>
                                </div>
                                <div class="settings-hint">
                                    ${currentInceptionKey ? `Current key: ${maskedInceptionKey}` : 'No Inception Labs API key configured'}
                                </div>
                                <div class="settings-actions">
                                    <button id="save-inception-api-key" class="settings-button primary">Save API Key</button>
                                </div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h2>Startup</h2>
                            <div class="settings-group">
                                <div class="settings-item">
                                    <label class="settings-checkbox">
                                        <input type="checkbox" id="restore-tabs-setting" ${browserSettings.restoreTabsOnStartup ? 'checked' : ''}>
                                        <span>Restore tabs from previous session</span>
                                    </label>
                                    <p class="settings-description">When enabled, all tabs from your last session will be reopened when you start the browser</p>
                                </div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h2>Privacy & Data</h2>
                            <div class="settings-group">
                                <label>Privacy Settings</label>
                                <div class="settings-item" style="margin-bottom: 16px;">
                                    <label class="settings-checkbox">
                                        <input type="checkbox" id="block-third-party-cookies-setting" ${browserSettings.blockThirdPartyCookies ? 'checked' : ''}>
                                        <span>Block third-party cookies</span>
                                    </label>
                                    <p class="settings-description">Prevent websites from setting cookies from other domains (improves privacy)</p>
                                </div>
                            </div>
                            <div class="settings-group">
                                <label>Browsing Data</label>
                                <div class="settings-hint">
                                    Clear cookies, cache, history, and other browsing data
                                </div>
                                <div class="settings-actions">
                                    <button id="clear-history" class="settings-button secondary">Clear History</button>
                                    <button id="clear-cookies" class="settings-button secondary">Clear Cookies</button>
                                    <button id="clear-all-data" class="settings-button secondary">Clear All Data</button>
                                </div>
                                <div id="clear-status" class="settings-hint" style="margin-top: 8px; display: none;"></div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h2>Performance</h2>
                            <div class="settings-group">
                                <label>Graphics Acceleration</label>
                                <div class="settings-hint">
                                    Hardware acceleration can improve performance but may cause issues on some systems
                                </div>
                                <div class="settings-actions" style="align-items: center;">
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gpu-acceleration" ${gpuEnabled ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                    <span id="gpu-status" style="margin-left: 12px;">${gpuEnabled ? 'Enabled' : 'Disabled'}</span>
                                </div>
                                <div id="gpu-restart-notice" class="settings-hint" style="margin-top: 8px; color: #ff9800; display: none;">
                                    ⚠ Restart the browser for changes to take effect
                                </div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h2>Updates</h2>
                            <div class="settings-group">
                                <label>Application Updates</label>
                                <div class="settings-hint">
                                    Check for and install updates to ${BROWSER_NAME}
                                </div>
                                <div class="settings-actions">
                                    <button id="check-updates" class="settings-button primary">Check for Updates</button>
                                </div>
                                <div id="update-status" class="settings-hint" style="margin-top: 8px; display: none;"></div>
                                <div id="update-progress" style="margin-top: 8px; display: none;">
                                    <div style="background: #e0e0e0; border-radius: 4px; height: 8px; overflow: hidden;">
                                        <div id="update-progress-bar" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
                                    </div>
                                    <div id="update-progress-text" style="font-size: 12px; margin-top: 4px; color: #666;"></div>
                                </div>
                                <div id="update-install" style="margin-top: 8px; display: none;">
                                    <button id="install-update" class="settings-button primary">Restart and Install Update</button>
                                </div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h2>Onboarding</h2>
                            <div class="settings-group">
                                <label>Welcome Tour</label>
                                <div class="settings-hint">
                                    Restart the welcome tour to learn about ${BROWSER_NAME} features again
                                </div>
                                <div class="settings-actions">
                                    <button id="reset-onboarding-btn" class="settings-button secondary">Reset Onboarding Tour</button>
                                </div>
                                <div id="onboarding-reset-status" class="settings-hint" style="margin-top: 8px; display: none; color: #4CAF50;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="settings-footer">
                        <div class="copyright-info">
                            <p>© 2025 Tim Tully &lt;<a href="mailto:tim@menlovc.com">tim@menlovc.com</a>&gt;</p>
                            <p>${BROWSER_NAME} is licensed under the <a href="https://opensource.org/licenses/MIT" target="_blank">MIT License</a></p>
                            <p class="attribution">
                                ${BROWSER_NAME} is powered by <a href="https://www.electronjs.org" target="_blank">Electron</a>
                                and enabled by the <a href="https://www.chromium.org" target="_blank">Chromium</a> open source project.
                            </p>
                            <p class="attribution">
                                AI capabilities provided by <a href="https://www.anthropic.com" target="_blank">Anthropic's Claude API</a>.
                            </p>
                            <p class="version">Version 1.0.0</p>
                        </div>
                    </div>
                </div>
            `;

            // Set up event listeners
            const apiKeyInput = container.querySelector('#api-key-input');
            const toggleButton = container.querySelector('#toggle-api-key-visibility');
            const saveButton = container.querySelector('#save-api-key');
            const getKeyLink = container.querySelector('#get-api-key-link');

            // Toggle password visibility
            toggleButton.addEventListener('click', () => {
                if (apiKeyInput.type === 'password') {
                    apiKeyInput.type = 'text';
                    toggleButton.textContent = 'Hide';
                } else {
                    apiKeyInput.type = 'password';
                    toggleButton.textContent = 'Show';
                }
            });

            // Save API key
            saveButton.addEventListener('click', async () => {
                const newKey = apiKeyInput.value.trim();
                if (newKey) {
                    const result = await window.electronAPI.setApiKey(newKey);
                    if (result.success) {
                        // Show success message
                        const hint = container.querySelector('.settings-hint');
                        hint.innerHTML = '<span style="color: #4CAF50;">✓ API key saved successfully</span>';
                        setTimeout(() => {
                            const maskedNewKey = `${newKey.substring(0, 8)}...${newKey.substring(newKey.length - 4)}`;
                            hint.textContent = `Current key: ${maskedNewKey}`;
                        }, 2000);
                        // Clear the dismissed flag since user now has an API key
                        localStorage.removeItem('apiKeyWarningDismissed');
                    }
                } else {
                    alert('Please enter a valid API key');
                }
            });

            // Open API key page
            getKeyLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.electronAPI.openExternal('https://console.anthropic.com/settings/keys');
            });

            // Inception Labs API key event listeners
            const inceptionApiKeyInput = container.querySelector('#inception-api-key-input');
            const inceptionToggleButton = container.querySelector('#toggle-inception-api-key-visibility');
            const inceptionSaveButton = container.querySelector('#save-inception-api-key');

            // Toggle Inception password visibility
            if (inceptionToggleButton && inceptionApiKeyInput) {
                inceptionToggleButton.addEventListener('click', () => {
                    if (inceptionApiKeyInput.type === 'password') {
                        inceptionApiKeyInput.type = 'text';
                        inceptionToggleButton.textContent = 'Hide';
                    } else {
                        inceptionApiKeyInput.type = 'password';
                        inceptionToggleButton.textContent = 'Show';
                    }
                });
            }

            // Save Inception API key
            if (inceptionSaveButton && inceptionApiKeyInput) {
                inceptionSaveButton.addEventListener('click', async () => {
                    const newKey = inceptionApiKeyInput.value.trim();
                    if (newKey) {
                        const result = await window.electronAPI.setInceptionApiKey(newKey);
                        if (result.success) {
                            // Show success message
                            const hints = container.querySelectorAll('.settings-hint');
                            const inceptionHint = hints[1]; // Second hint is for Inception Labs
                            if (inceptionHint) {
                                inceptionHint.innerHTML = '<span style="color: #4CAF50;">✓ API key saved successfully</span>';
                                setTimeout(() => {
                                    const maskedNewKey = `${newKey.substring(0, 8)}...${newKey.substring(newKey.length - 4)}`;
                                    inceptionHint.textContent = `Current key: ${maskedNewKey}`;
                                }, 2000);
                            }
                        }
                    } else {
                        alert('Please enter a valid Inception Labs API key');
                    }
                });
            }

            // Clear data buttons
            const clearHistoryBtn = container.querySelector('#clear-history');
            const clearCookiesBtn = container.querySelector('#clear-cookies');
            const clearAllDataBtn = container.querySelector('#clear-all-data');
            const clearStatus = container.querySelector('#clear-status');

            if (clearHistoryBtn) {
                clearHistoryBtn.addEventListener('click', async () => {
                    if (confirm('This will clear your browsing history. Continue?')) {
                        try {
                            // Clear history
                            this.browsingHistory = [];
                            this.saveHistory();

                            // Show success message
                            clearStatus.style.display = 'block';
                            clearStatus.innerHTML = '<span style="color: #4CAF50;">✓ History cleared successfully</span>';
                            setTimeout(() => {
                                clearStatus.style.display = 'none';
                            }, 3000);
                        } catch (error) {
                            console.error('Error clearing history:', error);
                            clearStatus.style.display = 'block';
                            clearStatus.innerHTML = '<span style="color: #f44336;">✗ Failed to clear history</span>';
                            setTimeout(() => {
                                clearStatus.style.display = 'none';
                            }, 3000);
                        }
                    }
                });
            }

            if (clearCookiesBtn) {
                clearCookiesBtn.addEventListener('click', async () => {
                    try {
                        // Clear cookies using IPC
                        const result = await window.electronAPI.clearCookies();

                        if (result.success) {
                            // Show success message
                            clearStatus.style.display = 'block';
                            clearStatus.innerHTML = '<span style="color: #4CAF50;">✓ Cookies cleared successfully</span>';
                            setTimeout(() => {
                                clearStatus.style.display = 'none';
                            }, 3000);
                        } else {
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        console.error('Error clearing cookies:', error);
                        clearStatus.style.display = 'block';
                        clearStatus.innerHTML = '<span style="color: #f44336;">✗ Failed to clear cookies</span>';
                        setTimeout(() => {
                            clearStatus.style.display = 'none';
                        }, 3000);
                    }
                });
            }

            if (clearAllDataBtn) {
                clearAllDataBtn.addEventListener('click', async () => {
                    if (confirm('This will clear all browsing data including history, cookies, cache, and local storage. Continue?')) {
                        try {
                            // Clear history first
                            this.browsingHistory = [];
                            this.saveHistory();

                            // Clear all browsing data using IPC
                            const result = await window.electronAPI.clearAllBrowsingData();

                            if (result.success) {
                                // Show success message
                                clearStatus.style.display = 'block';
                                clearStatus.innerHTML = '<span style="color: #4CAF50;">✓ All browsing data cleared successfully</span>';
                                setTimeout(() => {
                                    clearStatus.style.display = 'none';
                                }, 3000);
                            } else {
                                throw new Error(result.error);
                            }
                        } catch (error) {
                            console.error('Error clearing browsing data:', error);
                            clearStatus.style.display = 'block';
                            clearStatus.innerHTML = '<span style="color: #f44336;">✗ Failed to clear browsing data</span>';
                            setTimeout(() => {
                                clearStatus.style.display = 'none';
                            }, 3000);
                        }
                    }
                });
            }

            // GPU acceleration toggle
            const gpuToggle = container.querySelector('#gpu-acceleration');
            const gpuStatus = container.querySelector('#gpu-status');
            const gpuRestartNotice = container.querySelector('#gpu-restart-notice');

            if (gpuToggle) {
                gpuToggle.addEventListener('change', async () => {
                    const enabled = gpuToggle.checked;
                    gpuStatus.textContent = enabled ? 'Enabled' : 'Disabled';

                    // Save the setting
                    if (window.electronAPI.setGpuAcceleration) {
                        const result = await window.electronAPI.setGpuAcceleration(enabled);
                        if (result.success) {
                            // Show restart notice
                            gpuRestartNotice.style.display = 'block';
                        }
                    }
                });
            }

            // Restore tabs checkbox
            const restoreTabsCheckbox = container.querySelector('#restore-tabs-setting');
            if (restoreTabsCheckbox) {
                restoreTabsCheckbox.addEventListener('change', async () => {
                    const settings = await this.loadSettings();
                    settings.restoreTabsOnStartup = restoreTabsCheckbox.checked;
                    this.isRestoreEnabled = restoreTabsCheckbox.checked;
                    await this.saveSettings(settings);

                    // Save current tabs if we just enabled restoration
                    if (this.isRestoreEnabled) {
                        await this.saveTabState();
                    }
                });
            }

            // Third-party cookie blocker
            const blockCookiesCheckbox = container.querySelector('#block-third-party-cookies-setting');
            if (blockCookiesCheckbox) {
                blockCookiesCheckbox.addEventListener('change', async () => {
                    const settings = await this.loadSettings();
                    settings.blockThirdPartyCookies = blockCookiesCheckbox.checked;
                    await this.saveSettings(settings);

                    // Apply the cookie blocking setting
                    await window.electronAPI.setThirdPartyCookieBlocking(blockCookiesCheckbox.checked);

                    this.showNotification(
                        blockCookiesCheckbox.checked
                            ? 'Third-party cookies will be blocked'
                            : 'Third-party cookies are now allowed',
                        'success'
                    );
                });
            }

            // Update checking
            const checkUpdatesBtn = container.querySelector('#check-updates');
            const updateStatus = container.querySelector('#update-status');
            const updateProgress = container.querySelector('#update-progress');
            const updateProgressBar = container.querySelector('#update-progress-bar');
            const updateProgressText = container.querySelector('#update-progress-text');
            const updateInstall = container.querySelector('#update-install');
            const installUpdateBtn = container.querySelector('#install-update');

            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', async () => {
                    checkUpdatesBtn.disabled = true;
                    checkUpdatesBtn.textContent = 'Checking...';
                    updateStatus.style.display = 'block';
                    updateStatus.innerHTML = 'Checking for updates...';

                    const result = await window.electronAPI.checkForUpdates();

                    if (!result.success) {
                        updateStatus.innerHTML = `<span style="color: #f44336;">Error: ${result.error}</span>`;
                        checkUpdatesBtn.disabled = false;
                        checkUpdatesBtn.textContent = 'Check for Updates';
                    }
                });
            }

            if (installUpdateBtn) {
                installUpdateBtn.addEventListener('click', () => {
                    window.electronAPI.quitAndInstall();
                });
            }

            // Set up update event listeners
            window.electronAPI.onUpdateChecking(() => {
                updateStatus.style.display = 'block';
                updateStatus.innerHTML = 'Checking for updates...';
                if (checkUpdatesBtn) {
                    checkUpdatesBtn.disabled = true;
                    checkUpdatesBtn.textContent = 'Checking...';
                }
            });

            window.electronAPI.onUpdateAvailable((info) => {
                updateStatus.innerHTML = `<span style="color: #2196F3;">Update available: v${info.version}</span>`;
                updateProgress.style.display = 'block';
                updateProgressText.textContent = 'Downloading update...';
            });

            window.electronAPI.onUpdateNotAvailable((info) => {
                updateStatus.innerHTML = `<span style="color: #4CAF50;">✓ You're up to date! (v${info.version})</span>`;
                if (checkUpdatesBtn) {
                    checkUpdatesBtn.disabled = false;
                    checkUpdatesBtn.textContent = 'Check for Updates';
                }
                setTimeout(() => {
                    updateStatus.style.display = 'none';
                }, 5000);
            });

            window.electronAPI.onUpdateError((message) => {
                updateStatus.innerHTML = `<span style="color: #f44336;">Update error: ${message}</span>`;
                if (checkUpdatesBtn) {
                    checkUpdatesBtn.disabled = false;
                    checkUpdatesBtn.textContent = 'Check for Updates';
                }
                updateProgress.style.display = 'none';
            });

            window.electronAPI.onUpdateDownloadProgress((progress) => {
                updateProgressBar.style.width = `${progress.percent}%`;
                updateProgressText.textContent = `Downloading: ${Math.round(progress.percent)}% (${Math.round(progress.bytesPerSecond / 1024)} KB/s)`;
            });

            window.electronAPI.onUpdateDownloaded((info) => {
                updateStatus.innerHTML = `<span style="color: #4CAF50;">✓ Update v${info.version} downloaded and ready to install</span>`;
                updateProgress.style.display = 'none';
                updateInstall.style.display = 'block';
                if (checkUpdatesBtn) {
                    checkUpdatesBtn.style.display = 'none';
                }
            });

            // Onboarding reset button
            const resetOnboardingBtn = container.querySelector('#reset-onboarding-btn');
            const onboardingResetStatus = container.querySelector('#onboarding-reset-status');
            if (resetOnboardingBtn) {
                resetOnboardingBtn.addEventListener('click', () => {
                    this.resetOnboarding();
                    onboardingResetStatus.style.display = 'block';
                    onboardingResetStatus.textContent = '✓ Onboarding reset! The welcome tour will show on next startup.';
                    setTimeout(() => {
                        onboardingResetStatus.style.display = 'none';
                    }, 5000);
                });
            }

        });
    }

    renderHistoryPage(container) {
        // Group history by date
        const groupedHistory = this.groupHistoryByDate(this.browsingHistory);

        let historyHTML = `
            <div class="history-page">
                <div class="history-header">
                    <h1>History</h1>
                    <div class="history-controls">
                        <input type="text" id="history-search" placeholder="Search history..." class="history-search">
                        <button id="clear-history-btn" class="clear-history-btn">Clear browsing data</button>
                    </div>
                </div>
                <div class="history-content">
        `;

        // Render each date group
        for (const [date, items] of Object.entries(groupedHistory)) {
            historyHTML += `
                <div class="history-date-group">
                    <h2 class="history-date">${date}</h2>
                    <div class="history-items">
            `;

            items.forEach(item => {
                const time = new Date(item.lastVisited || Date.now()).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const domain = new URL(item.url).hostname;

                historyHTML += `
                    <div class="history-item" data-url="${item.url}">
                        <div class="history-time">${time}</div>
                        <div class="history-favicon">
                            <img src="https://www.google.com/s2/favicons?domain=${domain}" width="16" height="16" onerror="this.style.display='none'">
                        </div>
                        <div class="history-details">
                            <div class="history-title">${this.escapeHtml(item.title)}</div>
                            <div class="history-url">${this.escapeHtml(item.url)}</div>
                        </div>
                        <button class="history-remove" data-timestamp="${item.timestamp}">×</button>
                    </div>
                `;
            });

            historyHTML += `
                    </div>
                </div>
            `;
        }

        historyHTML += `
                </div>
            </div>
        `;

        container.innerHTML = historyHTML;

        // Add event listeners
        this.setupHistoryEventListeners(container);

        // Apply styling
        this.applyHistoryStyling(container);
    }

    groupHistoryByDate(history) {
        const grouped = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        history.forEach(item => {
            // Use lastVisited instead of timestamp (which doesn't exist)
            const itemDate = new Date(item.lastVisited || Date.now());
            let dateKey;

            if (isNaN(itemDate.getTime())) {
                console.error('Invalid date for history item:', item);
                dateKey = 'Unknown Date';
            } else if (itemDate.toDateString() === today.toDateString()) {
                dateKey = 'Today';
            } else if (itemDate.toDateString() === yesterday.toDateString()) {
                dateKey = 'Yesterday';
            } else {
                dateKey = itemDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }

            // Add each visit separately (don't combine)
            grouped[dateKey].push(item);
        });

        // Sort items within each date group by time (most recent first)
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => b.lastVisited - a.lastVisited);
        });

        return grouped;
    }

    setupHistoryEventListeners(container) {
        // Search functionality
        const searchInput = container.querySelector('#history-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterHistory(e.target.value.toLowerCase());
            });
        }

        // Clear history button
        const clearBtn = container.querySelector('#clear-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Clear all browsing history?')) {
                    this.clearHistory();
                }
            });
        }

        // History item clicks
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('history-remove')) {
                    const url = item.dataset.url;
                    this.createTab(url);
                }
            });
        });

        // Remove individual items
        container.querySelectorAll('.history-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const timestamp = parseInt(btn.dataset.timestamp);
                this.removeHistoryItem(timestamp);
            });
        });
    }

    filterHistory(searchTerm) {
        const items = document.querySelectorAll('.history-item');
        const dateGroups = document.querySelectorAll('.history-date-group');

        items.forEach(item => {
            const title = item.querySelector('.history-title').textContent.toLowerCase();
            const url = item.querySelector('.history-url').textContent.toLowerCase();

            if (title.includes(searchTerm) || url.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });

        // Hide empty date groups
        dateGroups.forEach(group => {
            const visibleItems = group.querySelectorAll('.history-item[style="display: flex;"], .history-item:not([style])');
            if (visibleItems.length === 0) {
                group.style.display = 'none';
            } else {
                group.style.display = 'block';
            }
        });
    }

    removeHistoryItem(timestamp) {
        this.browsingHistory = this.browsingHistory.filter(item => item.timestamp !== timestamp);
        this.saveHistory();

        // Re-render the history page
        const activeTab = this.tabs.find(t => t.id === this.activeTabId);
        if (activeTab && activeTab.mode === 'history') {
            const container = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"] .tab-claude-results`);
            if (container) {
                this.renderHistoryPage(container);
            }
        }
    }

    clearHistory() {
        this.browsingHistory = [];
        this.saveHistory();

        // Re-render the history page
        const activeTab = this.tabs.find(t => t.id === this.activeTabId);
        if (activeTab && activeTab.mode === 'history') {
            const container = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"] .tab-claude-results`);
            if (container) {
                this.renderHistoryPage(container);
            }
        }

        this.showNotification('✅ Browsing history cleared', 'success');
    }

    showClearBrowsingDataDialog() {
        // Create a modal dialog for clearing browsing data
        const dialog = document.createElement('div');
        dialog.className = 'clear-data-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        dialog.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 30px;
                width: 400px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            ">
                <h2 style="margin: 0 0 20px 0; font-size: 20px;">Clear Browsing Data</h2>

                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
                        <input type="checkbox" id="clear-history-check" checked style="margin-right: 10px;">
                        <span>Browsing history (${this.browsingHistory.length} items)</span>
                    </label>

                    <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
                        <input type="checkbox" id="clear-bookmarks-check" style="margin-right: 10px;">
                        <span>Bookmarks (${this.bookmarks.length} items)</span>
                    </label>

                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="clear-closed-tabs-check" style="margin-right: 10px;">
                        <span>Recently closed tabs (${this.closedTabs.length} items)</span>
                    </label>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="cancel-clear-btn" style="
                        padding: 8px 20px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Cancel</button>

                    <button id="confirm-clear-btn" style="
                        padding: 8px 20px;
                        border: none;
                        background: #f44336;
                        color: white;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Clear Data</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Add event listeners
        dialog.querySelector('#cancel-clear-btn').addEventListener('click', () => {
            dialog.remove();
        });

        dialog.querySelector('#confirm-clear-btn').addEventListener('click', () => {
            const clearHistory = dialog.querySelector('#clear-history-check').checked;
            const clearBookmarks = dialog.querySelector('#clear-bookmarks-check').checked;
            const clearClosedTabs = dialog.querySelector('#clear-closed-tabs-check').checked;

            let cleared = [];

            if (clearHistory) {
                this.browsingHistory = [];
                this.saveHistory();
                cleared.push('history');
            }

            if (clearBookmarks) {
                this.bookmarks = [];
                this.saveBookmarks();
                this.renderBookmarks();
                this.updateTagFilter();
                cleared.push('bookmarks');
            }

            if (clearClosedTabs) {
                this.closedTabs = [];
                cleared.push('closed tabs');
            }

            dialog.remove();

            if (cleared.length > 0) {
                this.showNotification(`✅ Cleared: ${cleared.join(', ')}`, 'success');

                // Refresh history page if it's open
                const activeTab = this.tabs.find(t => t.id === this.activeTabId);
                if (activeTab && activeTab.mode === 'history') {
                    const container = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"] .tab-claude-results`);
                    if (container) {
                        this.renderHistoryPage(container);
                    }
                }
            }
        });

        // Close on background click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    applyHistoryStyling(container) {
        const style = document.createElement('style');
        style.textContent = `
            .history-page {
                padding: 20px;
                max-width: 900px;
                margin: 0 auto;
            }

            .history-header {
                margin-bottom: 30px;
            }

            .history-header h1 {
                font-size: 28px;
                margin-bottom: 20px;
                color: #333;
            }

            .history-controls {
                display: flex;
                gap: 15px;
                align-items: center;
            }

            .history-search {
                flex: 1;
                padding: 10px 15px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            }

            .clear-history-btn {
                padding: 10px 20px;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }

            .clear-history-btn:hover {
                background: #da190b;
            }

            .history-date-group {
                margin-bottom: 30px;
            }

            .history-date {
                font-size: 16px;
                color: #666;
                margin-bottom: 15px;
                padding-bottom: 8px;
                border-bottom: 1px solid #eee;
            }

            .history-item {
                display: flex;
                align-items: center;
                padding: 10px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s;
            }

            .history-item:hover {
                background: #f5f5f5;
            }

            .history-time {
                color: #999;
                font-size: 13px;
                width: 60px;
                flex-shrink: 0;
            }

            .history-favicon {
                width: 20px;
                height: 20px;
                margin: 0 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .history-details {
                flex: 1;
                min-width: 0;
            }

            .history-title {
                font-size: 14px;
                color: #333;
                margin-bottom: 3px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .history-url {
                font-size: 12px;
                color: #999;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .history-remove {
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                color: #999;
                font-size: 20px;
                cursor: pointer;
                display: none;
                border-radius: 4px;
            }

            .history-item:hover .history-remove {
                display: block;
            }

            .history-remove:hover {
                background: #e0e0e0;
                color: #333;
            }

            /* Dark mode for incognito */
            .incognito-content .history-page {
                color: #ddd;
            }

            .incognito-content .history-header h1 {
                color: #ddd;
            }

            .incognito-content .history-search {
                background: #2a2a2a;
                color: #ddd;
                border-color: #444;
            }

            .incognito-content .history-date {
                color: #aaa;
                border-bottom-color: #444;
            }

            .incognito-content .history-item:hover {
                background: #2a2a2a;
            }

            .incognito-content .history-title {
                color: #ddd;
            }

            .incognito-content .history-remove:hover {
                background: #3a3a3a;
                color: #ddd;
            }
        `;

        if (!document.querySelector('#history-styles')) {
            style.id = 'history-styles';
            document.head.appendChild(style);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    reopenClosedTab() {
        // Check if there are any closed tabs to reopen
        if (this.closedTabs.length === 0) {
            this.showNotification('No recently closed tabs to reopen', 'info');
            return;
        }

        // Pop the most recently closed tab from the stack
        const closedTab = this.closedTabs.shift();

        // Create a new tab with the saved data
        const newTabId = this.createTab(closedTab.url);

        // Restore the tab's state after it's created
        setTimeout(() => {
            const tab = this.tabs.find(t => t.id === newTabId);
            if (tab) {
                // Restore history
                tab.history = closedTab.history;
                tab.historyIndex = closedTab.historyIndex;
                tab.title = closedTab.title;
                tab.favicon = closedTab.favicon;

                // Update UI
                this.updateTabTitle(newTabId, closedTab.title);
                this.updateTabFavicon(newTabId, closedTab.favicon);

                // Navigate to the URL
                if (closedTab.url) {
                    this.addressBar.value = closedTab.url;
                    this.navigate();
                }

                this.showNotification(`✅ Reopened: ${closedTab.title || closedTab.url}`, 'success');
            }
        }, 100);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
            word-wrap: break-word;
        `;

        // Style based on type
        switch(type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.background = '#ff4444';
                notification.style.color = 'white';
                break;
            default:
                notification.style.background = '#4a5568';
                notification.style.color = 'white';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showRecordingToast(message) {
        // Create a temporary notification with shorter duration for recording actions
        const notification = document.createElement('div');
        notification.className = 'recording-toast';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 10000;
            animation: slideInUp 0.2s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 350px;
            word-wrap: break-word;
            background: rgba(74, 85, 104, 0.95);
            color: white;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        // Add animation if not already present
        if (!document.querySelector('#recording-toast-animations')) {
            const style = document.createElement('style');
            style.id = 'recording-toast-animations';
            style.textContent = `
                @keyframes slideInUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutDown {
                    from {
                        transform: translateY(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove after 1.5 seconds (shorter duration for recording actions)
        setTimeout(() => {
            notification.style.animation = 'slideOutDown 0.2s ease';
            setTimeout(() => notification.remove(), 200);
        }, 1500);
    }

    applyIncognitoStyling() {
        if (this.isIncognito) {
            // Add incognito class to body for styling
            document.body.classList.add('incognito-mode');

            // Update the browser title
            document.title = `${BROWSER_NAME} (Incognito)`;

            // Hide bookmarks bar in incognito mode
            this.bookmarksBar.classList.add('hidden');

            // Add incognito indicator
            if (!document.getElementById('incognito-indicator')) {
                const indicator = document.createElement('div');
                indicator.id = 'incognito-indicator';
                indicator.innerHTML = `
                    <span style="font-size: 18px; margin-right: 8px;">🕵️</span>
                    <span>Incognito Mode</span>
                `;
                indicator.style.cssText = `
                    position: fixed;
                    top: 8px;
                    right: 150px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    z-index: 1000;
                    pointer-events: none;
                `;
                document.body.appendChild(indicator);
            }
        }
    }

    showImageContextMenu(x, y, imageUrl, linkUrl) {
        // Store coordinates for inspect element feature
        this.contextMenuX = x;
        this.contextMenuY = y;

        // Hide any other context menus
        this.hidePageContextMenu();
        this.hideLinkContextMenu();
        this.hideTextContextMenu();

        // Validate and store the image URLs for later use
        if (!imageUrl) {
            console.error('showImageContextMenu called with null/undefined imageUrl');
            return;
        }

        this.currentImageUrl = imageUrl;
        this.currentImageLinkUrl = linkUrl;

        // Create or get the invisible overlay
        let overlay = document.getElementById('context-menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'context-menu-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999;
                background: transparent;
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';

        // Position and show the menu
        this.imageContextMenu.style.left = x + 'px';
        this.imageContextMenu.style.top = y + 'px';
        this.imageContextMenu.classList.add('visible');

        // Handle clicks on the overlay
        overlay.onclick = (e) => {
            e.preventDefault();
            this.hideImageContextMenu();
        };

        // Prevent clicks on the menu from closing it
        this.imageContextMenu.onclick = (e) => {
            e.stopPropagation();
        };
    }

    hideImageContextMenu() {
        if (this.imageContextMenu) {
            this.imageContextMenu.classList.remove('visible');
        }
        this.currentImageUrl = null;
        this.currentImageLinkUrl = null;

        // Hide the overlay
        const overlay = document.getElementById('context-menu-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        // Remove click handler from menu
        if (this.imageContextMenu) {
            this.imageContextMenu.onclick = null;
        }
    }

    showTabContextMenu(event, tabId) {
        this.currentTabId = tabId;
        const menu = this.tabContextMenu;

        // Hide any other context menus first
        this.hidePageContextMenu();
        this.hideLinkContextMenu();
        this.hideTextContextMenu();
        this.hideImageContextMenu();
        this.hideUrlBarContextMenu();

        // Update mute/unmute text
        const tab = this.tabs.find(t => t.id === tabId);
        const muteItem = menu.querySelector('[data-action="mute-tab"]');
        if (tab && tab.isMuted) {
            muteItem.textContent = 'Unmute site';
        } else {
            muteItem.textContent = 'Mute site';
        }

        // Update pin/unpin text
        const pinItem = menu.querySelector('[data-action="pin-tab"]');
        if (tab && tab.isPinned) {
            pinItem.textContent = 'Unpin';
        } else {
            pinItem.textContent = 'Pin';
        }

        // Position the menu
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        menu.style.display = 'block';

        // Remove any existing click handler
        if (this.tabContextMenuClickHandler) {
            document.removeEventListener('click', this.tabContextMenuClickHandler);
        }

        // Create new click handler
        this.tabContextMenuClickHandler = (e) => {
            // Check if click is outside the menu
            if (!menu.contains(e.target)) {
                this.hideTabContextMenu();
                document.removeEventListener('click', this.tabContextMenuClickHandler);
                this.tabContextMenuClickHandler = null;
            }
        };

        // Add click outside handler with a small delay to avoid immediate trigger
        setTimeout(() => {
            document.addEventListener('click', this.tabContextMenuClickHandler);
        }, 10);
    }

    hideTabContextMenu() {
        if (this.tabContextMenu) {
            this.tabContextMenu.style.display = 'none';
        }
        // Clean up the click handler
        if (this.tabContextMenuClickHandler) {
            document.removeEventListener('click', this.tabContextMenuClickHandler);
            this.tabContextMenuClickHandler = null;
        }
    }

    showUrlBarContextMenu(event) {
        const menu = this.urlBarContextMenu;

        // Position the menu
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        menu.style.display = 'block';

        // Add click outside handler
        setTimeout(() => {
            document.addEventListener('click', this.hideUrlBarContextMenu.bind(this), { once: true });
        }, 100);
    }

    hideUrlBarContextMenu() {
        if (this.urlBarContextMenu) {
            this.urlBarContextMenu.style.display = 'none';
        }
    }

    handleUrlBarContextMenuAction(action) {
        const addressBar = this.addressBar;

        switch(action) {
            case 'cut':
                if (addressBar.selectionStart !== addressBar.selectionEnd) {
                    document.execCommand('cut');
                } else {
                    // Select all and cut if nothing selected
                    addressBar.select();
                    document.execCommand('cut');
                }
                break;
            case 'copy':
                if (addressBar.selectionStart !== addressBar.selectionEnd) {
                    document.execCommand('copy');
                } else {
                    // Select all and copy if nothing selected
                    addressBar.select();
                    document.execCommand('copy');
                    // Restore cursor position
                    addressBar.setSelectionRange(addressBar.value.length, addressBar.value.length);
                }
                break;
            case 'paste':
                navigator.clipboard.readText().then(text => {
                    const start = addressBar.selectionStart;
                    const end = addressBar.selectionEnd;
                    const value = addressBar.value;
                    addressBar.value = value.slice(0, start) + text + value.slice(end);
                    // Move cursor after pasted text
                    const newPos = start + text.length;
                    addressBar.setSelectionRange(newPos, newPos);
                });
                break;
            case 'delete':
                if (addressBar.selectionStart !== addressBar.selectionEnd) {
                    // Delete selected text
                    const start = addressBar.selectionStart;
                    const end = addressBar.selectionEnd;
                    const value = addressBar.value;
                    addressBar.value = value.slice(0, start) + value.slice(end);
                    addressBar.setSelectionRange(start, start);
                } else {
                    // Clear entire field if nothing selected
                    addressBar.value = '';
                }
                break;
        }

        // Focus back to address bar
        addressBar.focus();
    }

    handleTabContextMenuAction(action) {
        const tabId = this.currentTabId;
        if (!tabId) return;

        switch (action) {
            case 'new-tab-right':
                this.createNewTabToRight(tabId);
                break;
            case 'reload-tab':
                this.reloadTab(tabId);
                break;
            case 'duplicate-tab':
                this.duplicateTab(tabId);
                break;
            case 'pin-tab':
                this.toggleTabPin(tabId);
                break;
            case 'mute-tab':
                this.toggleTabMute(tabId);
                break;
            case 'close-tab':
                this.closeTab(tabId);
                break;
            case 'close-other-tabs':
                this.closeOtherTabs(tabId);
                break;
            case 'move-to-new-window':
                this.moveTabToNewWindow(tabId);
                break;
        }
    }

    createNewTabToRight(tabId) {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        const currentTab = this.tabs[tabIndex];
        const newTabId = this.createTab('', currentTab?.isIncognito || false);
        const newTab = this.tabs.find(t => t.id === newTabId);

        // Move the new tab to right of current tab
        if (tabIndex >= 0 && newTab && tabIndex < this.tabs.length - 2) {
            const newTabElement = document.querySelector(`[data-tab-id="${newTabId}"]`);
            const targetTab = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (newTabElement && targetTab) {
                targetTab.parentNode.insertBefore(newTabElement, targetTab.nextSibling);
            }

            // Reorder in array
            const newTabIndex = this.tabs.findIndex(t => t.id === newTabId);
            const [movedTab] = this.tabs.splice(newTabIndex, 1);
            this.tabs.splice(tabIndex + 1, 0, movedTab);
        }

        this.switchToTab(newTabId);
    }

    reloadTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab && tab.webview) {
            tab.webview.reload();
        }
    }

    duplicateTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
            const newTabId = this.createTab('', tab.isIncognito);
            // Wait for tab to be ready, then navigate to same URL
            setTimeout(() => {
                if (tab.url && tab.url !== 'about:blank') {
                    const newTabObj = this.tabs.find(t => t.id === newTabId);
                    if (newTabObj) {
                        this.switchToTab(newTabId);
                        this.addressBar.value = tab.url;
                        this.navigate();
                    }
                }
            }, 100);
        }
    }

    toggleTabPin(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        tab.isPinned = !tab.isPinned;

        // Update the tab element
        const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            if (tab.isPinned) {
                tabElement.classList.add('pinned');
                // Move pinned tab to the left
                this.movePinnedTabToLeft(tabId);
            } else {
                tabElement.classList.remove('pinned');
            }
        }

        // Save to localStorage
        this.savePinnedTabs();
    }

    movePinnedTabToLeft(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab || !tab.isPinned) return;

        // Find the position after the last pinned tab
        let lastPinnedIndex = -1;
        for (let i = 0; i < this.tabs.length; i++) {
            if (this.tabs[i].isPinned && this.tabs[i].id !== tabId) {
                lastPinnedIndex = i;
            }
        }

        const currentIndex = this.tabs.findIndex(t => t.id === tabId);
        if (currentIndex > lastPinnedIndex + 1) {
            // Move tab in array
            const [movedTab] = this.tabs.splice(currentIndex, 1);
            this.tabs.splice(lastPinnedIndex + 1, 0, movedTab);

            // Move tab in DOM
            const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
            const allTabElements = Array.from(this.tabsContainer.querySelectorAll('.tab'));

            if (lastPinnedIndex === -1) {
                // Move to beginning
                this.tabsContainer.insertBefore(tabElement, this.tabsContainer.firstChild);
            } else {
                // Move after last pinned tab
                const lastPinnedElement = allTabElements[lastPinnedIndex];
                if (lastPinnedElement) {
                    this.tabsContainer.insertBefore(tabElement, lastPinnedElement.nextSibling);
                }
            }
        }
    }

    savePinnedTabs() {
        const pinnedTabs = this.tabs
            .filter(tab => tab.isPinned)
            .map(tab => ({
                url: tab.url,
                title: tab.title,
                favicon: tab.favicon
            }));
        localStorage.setItem('pinnedTabs', JSON.stringify(pinnedTabs));
    }

    loadPinnedTabs() {
        const pinnedTabs = localStorage.getItem('pinnedTabs');
        if (pinnedTabs) {
            try {
                const tabs = JSON.parse(pinnedTabs);
                tabs.forEach(tabData => {
                    if (tabData.url) {
                        const newTabId = this.createTab(tabData.url);
                        const tab = this.tabs.find(t => t.id === newTabId);
                        if (tab) {
                            tab.isPinned = true;
                            tab.title = tabData.title || 'New Tab';
                            tab.favicon = tabData.favicon;

                            // Update UI
                            const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${newTabId}"]`);
                            if (tabElement) {
                                tabElement.classList.add('pinned');
                                this.updateTabTitle(newTabId, tab.title);
                                if (tab.favicon) {
                                    this.updateTabFavicon(newTabId, tab.favicon);
                                }
                            }
                        }
                    }
                });
            } catch (e) {
                console.error('Error loading pinned tabs:', e);
            }
        }
    }

    async loadSettings() {
        try {
            // Try to load from IPC first (file storage)
            const result = await window.electronAPI.getBrowserSettings();
            if (result.success && result.settings) {
                return result.settings;
            }

            // Fallback to localStorage
            const saved = localStorage.getItem('browserSettings');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        // Return default settings
        return {
            restoreTabsOnStartup: false,
            saveHistory: true,
            blockThirdPartyCookies: false
        };
    }

    async saveSettings(settings) {
        try {
            // Save to both IPC (file) and localStorage
            await window.electronAPI.saveBrowserSettings(settings);
            localStorage.setItem('browserSettings', JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async saveTabState() {
        // Save current tab state for restoration
        const tabState = this.tabs
            .filter(tab => !tab.isPinned && tab.url && tab.url !== 'about:blank') // Don't save pinned tabs or empty tabs
            .map(tab => ({
                url: tab.url,
                title: tab.title,
                favicon: tab.favicon,
                mode: tab.mode
            }));

        try {
            // Save via IPC to file
            const result = await window.electronAPI.saveTabState(tabState);
            if (result.success) {
            } else {
                console.error('Failed to save tab state via IPC:', result.error);
            }

            // Also save to localStorage as backup
            localStorage.setItem('tabState', JSON.stringify(tabState));
        } catch (error) {
            console.error('Failed to save tab state:', error);
        }
    }

    // Debounced auto-save function
    scheduleAutoSave() {
        // Only auto-save if restore is enabled
        if (!this.isRestoreEnabled) return;

        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Schedule new save
        this.autoSaveTimer = setTimeout(async () => {
            await this.saveTabState();
        }, this.autoSaveDebounceTime);
    }

    async loadTabState() {
        const settings = await this.loadSettings();

        if (!settings.restoreTabsOnStartup) {
            return false; // Don't restore if setting is off
        }

        try {
            // Try to load from IPC first
            const result = await window.electronAPI.loadTabState();
            let tabState = null;

            if (result.success && result.tabState) {
                tabState = result.tabState;
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem('tabState');
                if (saved) {
                    tabState = JSON.parse(saved);
                }
            }

            if (tabState) {

                tabState.forEach((tabData, index) => {
                    if (tabData.url) {
                        const newTabId = this.createTab(tabData.url);
                        const tab = this.tabs.find(t => t.id === newTabId);
                        if (tab) {
                            tab.title = tabData.title || 'Loading...';
                            tab.favicon = tabData.favicon || 'assets/default-favicon.png';
                            tab.mode = tabData.mode || 'web';

                            // Update tab UI
                            this.updateTabTitle(newTabId, tab.title);
                            this.updateTabFavicon(newTabId, tab.favicon);
                        }
                    }
                });

                // Clear the saved state after loading to prevent duplicate loads
                localStorage.removeItem('tabState');

                return true; // Tabs were restored
            } else {
            }
        } catch (error) {
            console.error('Failed to load tab state:', error);
        }

        return false; // No tabs restored
    }

    closeOtherTabs(tabId) {
        // Get all tabs except the one to keep
        const tabsToClose = this.tabs.filter(t => t.id !== tabId);

        // Close each tab
        tabsToClose.forEach(tab => {
            // Remove tab element from DOM
            const tabElement = this.tabsContainer.querySelector(`[data-tab-id="${tab.id}"]`);
            if (tabElement) {
                tabElement.remove();
            }

            // Remove content element from DOM
            const contentElement = this.tabsContent.querySelector(`[data-tab-id="${tab.id}"]`);
            if (contentElement) {
                contentElement.remove();
            }

            // Clean up webview if exists
            if (tab.webview) {
                try {
                    tab.webview.stop();
                    tab.webview.loadURL('about:blank');
                    tab.webview.remove();
                } catch (e) {
                    console.error('Error cleaning up webview:', e);
                }
            }
        });

        // Keep only the current tab in the tabs array
        this.tabs = this.tabs.filter(t => t.id === tabId);

        // Make sure the remaining tab is active
        this.switchToTab(tabId);
    }

    async moveTabToNewWindow(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        // Don't move if it's the only tab
        if (this.tabs.length <= 1) {
            return;
        }

        try {
            // Open new window with the tab's URL
            if (tab.isIncognito) {
                await window.electronAPI.newIncognitoWindowWithUrl(tab.url || 'about:blank');
            } else {
                await window.electronAPI.newWindowWithUrl(tab.url || 'about:blank');
            }

            // Close the tab in the current window
            this.closeTab(tabId);
        } catch (error) {
            console.error('Error moving tab to new window:', error);
        }
    }

    toggleTabMute(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab && tab.webview) {
            const isMuted = tab.webview.isAudioMuted();
            tab.webview.setAudioMuted(!isMuted);
            tab.isMuted = !isMuted;

            // Update audio indicator
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabElement) {
                const audioIndicator = tabElement.querySelector('.tab-audio-indicator');
                if (audioIndicator) {
                    if (tab.isMuted) {
                        audioIndicator.classList.remove('playing');
                        audioIndicator.classList.add('muted');
                    } else if (tab.isPlayingAudio) {
                        audioIndicator.classList.remove('muted');
                        audioIndicator.classList.add('playing');
                    }
                }
            }
        }
    }

    updateTabAudioState(tabId, isPlaying) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.isPlayingAudio = isPlaying;
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabElement) {
                const audioIndicator = tabElement.querySelector('.tab-audio-indicator');
                if (audioIndicator) {
                    if (isPlaying || tab.isMuted) {
                        audioIndicator.style.display = 'flex';
                        if (tab.isMuted) {
                            audioIndicator.classList.remove('playing');
                            audioIndicator.classList.add('muted');
                        } else {
                            audioIndicator.classList.remove('muted');
                            audioIndicator.classList.add('playing');
                        }
                    } else {
                        audioIndicator.style.display = 'none';
                    }
                }
            }
        }
    }

    async handleImageContextMenuAction(action) {
        if (!this.currentImageUrl) {
            console.error('No currentImageUrl available');
            this.showNotification('❌ No image URL available', 2000);
            return;
        }

        // Store the URL in a local variable to prevent loss of context
        const imageUrl = this.currentImageUrl;

        switch(action) {
            case 'save-image':
                // Download the image - extract filename from URL
                try {
                    const urlObj = new URL(imageUrl);
                    let filename = urlObj.pathname.split('/').pop() || 'image';

                    // Remove query parameters if present
                    filename = filename.split('?')[0];

                    // Decode HTML entities and URL encoding
                    filename = decodeURIComponent(filename);

                    // Remove any HTML tags if present
                    filename = filename.replace(/<[^>]*>/g, '');

                    // Clean up filename - remove invalid characters
                    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

                    // If filename is empty or just underscores, use a default
                    if (!filename || filename.replace(/_/g, '').length === 0) {
                        filename = 'image';
                    }

                    // Determine the correct image extension by checking the URL
                    let imageExt = '.jpg'; // Default extension

                    // Look for image extensions in the URL path and query parameters
                    // Match image extensions that appear before query params or at the end
                    const imageExtPattern = /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)(?=[?&#]|$)/i;
                    const match = imageUrl.match(imageExtPattern);

                    if (match) {
                        imageExt = match[0].toLowerCase();
                    }

                    // Check if filename already has the correct image extension
                    const hasCorrectExt = /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(filename);

                    if (!hasCorrectExt) {
                        // Remove any non-image extensions and add the correct one
                        // Remove everything after the last dot if it's not an image extension
                        const lastDotIndex = filename.lastIndexOf('.');
                        if (lastDotIndex > 0) {
                            const currentExt = filename.substring(lastDotIndex);
                            if (!/^\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(currentExt)) {
                                // Remove the non-image extension
                                filename = filename.substring(0, lastDotIndex);
                            }
                        }

                        // Add the correct image extension if needed
                        if (!/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(filename)) {
                            filename = filename + imageExt;
                        }
                    }

                    // Ensure the filename isn't too long
                    if (filename.length > 255) {
                        const ext = filename.substring(filename.lastIndexOf('.'));
                        filename = filename.substring(0, 250 - ext.length) + ext;
                    }

                    // Request save location from main process
                    const result = await window.electronAPI.showSaveDialog(filename);

                    if (result && result.filePath) {
                        // Download the image through main process - use the local variable, not this.currentImageUrl
                        const downloadResult = await window.electronAPI.downloadImage(imageUrl, result.filePath);

                        if (downloadResult && downloadResult.success) {
                            this.showNotification('✅ Image saved successfully', 2000);
                        } else {
                            console.error('Download failed:', downloadResult);
                            this.showNotification(`❌ Failed to save image: ${downloadResult?.error || 'Unknown error'}`, 3000);
                        }
                    }
                } catch (error) {
                    console.error('Error saving image:', error);
                    this.showNotification('❌ Failed to save image', 2000);
                }
                break;

            case 'copy-image':
                // Copy image URL to clipboard for now (full image copy would need main process support)
                const webview = this.getOrCreateWebview(this.activeTabId);
                if (webview) {
                    // Execute JavaScript in the webview to copy the image URL
                    webview.executeJavaScript(`
                        navigator.clipboard.writeText('${this.currentImageUrl}')
                            .catch(err => console.error('Failed to copy:', err));
                    `);
                    this.showNotification('✅ Image URL copied to clipboard', 2000);
                }
                break;

            case 'copy-image-url':
                // Copy image URL to clipboard
                const tempInput = document.createElement('textarea');
                tempInput.value = this.currentImageUrl;
                tempInput.style.position = 'absolute';
                tempInput.style.left = '-9999px';
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                this.showNotification('✅ Image URL copied to clipboard', 2000);
                break;

            case 'open-image-new-tab':
                // Open image in new tab
                const tabId = this.createTab();
                setTimeout(() => {
                    this.switchToTab(tabId);
                    this.addressBar.value = this.currentImageUrl;
                    this.navigate();
                }, 100);
                break;
            case 'inspect':
                this.inspectElementAtPosition(this.contextMenuX, this.contextMenuY);
                break;
        }
    }

    // Autocomplete functionality
    setupAutocomplete() {
        this.inlineAutocompleteActive = false;
        this.lastTypedValue = '';

        // Handle input changes
        this.addressBar.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Clear inline autocomplete on any manual editing
            if (this.inlineAutocompleteActive) {
                this.inlineAutocompleteActive = false;
            }

            this.lastTypedValue = e.target.value;

            if (query.length > 0) {
                this.showAutocompleteResults(query);
            } else {
                this.hideAutocomplete();
            }
        });

        // Handle selection changes (cursor movement)
        this.addressBar.addEventListener('select', () => {
            this.inlineAutocompleteActive = false;
        });

        // Handle click to clear autocomplete
        this.addressBar.addEventListener('mousedown', () => {
            this.inlineAutocompleteActive = false;
        });

        // Handle keydown for special autocomplete behavior
        this.addressBar.addEventListener('keydown', (e) => {
            // Any cursor movement clears the inline autocomplete
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                e.key === 'Home' || e.key === 'End') {
                this.inlineAutocompleteActive = false;
            }

            // Backspace/Delete clears inline autocomplete
            if (e.key === 'Backspace' || e.key === 'Delete') {
                this.inlineAutocompleteActive = false;
            }

            // Tab accepts the inline autocomplete
            if (e.key === 'Tab' && this.inlineAutocompleteActive) {
                e.preventDefault();
                const value = this.addressBar.value;
                this.lastTypedValue = value;
                this.inlineAutocompleteActive = false;
                this.addressBar.setSelectionRange(value.length, value.length);
            }
        });

        // Handle focus
        this.addressBar.addEventListener('focus', () => {
            const query = this.addressBar.value.trim();
            if (query.length > 0) {
                this.lastTypedValue = this.addressBar.value;
                this.showAutocompleteResults(query);
            }
        });

        // Handle blur (with delay to allow clicking on dropdown items)
        this.addressBar.addEventListener('blur', () => {
            setTimeout(() => {
                if (!this.autocompleteDropdown.matches(':hover')) {
                    this.hideAutocomplete();
                }
            }, 200);
        });

        // Handle clicks outside
        document.addEventListener('click', (e) => {
            if (!this.addressBar.contains(e.target) && !this.autocompleteDropdown.contains(e.target)) {
                this.hideAutocomplete();
            }
        });
    }

    showAutocompleteResults(query) {
        // Check if it's a command and show helper text
        if (query.startsWith('/')) {
            this.showCommandHelper(query);
            return;
        }

        const results = this.searchHistoryAndBookmarks(query);

        if (results.length === 0) {
            this.hideAutocomplete();
            return;
        }

        this.autocompleteResults = results;
        this.selectedAutocompleteIndex = -1;

        // Apply inline autocomplete only once when typing at the end
        if (results.length > 0 && !this.inlineAutocompleteActive) {
            const currentPos = this.addressBar.selectionStart;
            const currentValue = this.addressBar.value;

            // Only apply if cursor is at the end and user is typing forward
            if (currentPos === currentValue.length && currentValue === this.lastTypedValue) {
                const topResult = results[0];
                const completion = this.getInlineCompletion(query, topResult.url);

                if (completion) {
                    // Apply the completion
                    this.addressBar.value = query + completion;
                    // Select the completed portion
                    this.addressBar.setSelectionRange(query.length, this.addressBar.value.length);
                    this.inlineAutocompleteActive = true;
                }
            }
        }

        // Clear and rebuild dropdown to avoid innerHTML parsing issues
        this.autocompleteDropdown.innerHTML = '';

        // Create elements programmatically to avoid HTML parsing issues with SVG
        results.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'autocomplete-item';
            itemDiv.dataset.index = index;

            const img = document.createElement('img');
            img.className = 'autocomplete-item-icon';

            // Use favicon if it's a valid URL (not our placeholder SVG)
            if (item.favicon &&
                !item.favicon.includes('data:image/svg+xml,<svg') &&
                !item.favicon.includes('PHN2ZyB4bWxucz0i')) {
                img.src = item.favicon;
            } else {
                // Use a globe icon as default
                img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiIvPjxwYXRoIGQ9Ik0xMiAyYTUuNSA3LjUgMCAwIDEgMCAyMCA1LjUgNy41IDAgMCAxIDAtMjAiLz48L3N2Zz4=';
            }

            img.addEventListener('error', function() {
                // Fallback to globe icon
                this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiIvPjxwYXRoIGQ9Ik0xMiAyYTUuNSA3LjUgMCAwIDEgMCAyMCA1LjUgNy41IDAgMCAxIDAtMjAiLz48L3N2Zz4=';
            });

            const span = document.createElement('span');
            span.className = 'autocomplete-item-text';

            // Format display text
            const title = item.title || this.getDomainFromUrl(item.url);
            const domain = this.getDomainFromUrl(item.url);
            const displayText = item.title ? `${title} - ${domain}` : item.url;
            span.textContent = displayText; // Use textContent, not innerHTML

            itemDiv.appendChild(img);
            itemDiv.appendChild(span);
            this.autocompleteDropdown.appendChild(itemDiv);
        });

        this.autocompleteDropdown.classList.remove('hidden');

        // Add click handlers to items
        this.autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                const selected = this.autocompleteResults[index];
                this.addressBar.value = selected.url;
                this.hideAutocomplete();
                this.navigate();
            });
        });
    }

    searchHistoryAndBookmarks(query) {
        const results = [];
        const queryLower = query.toLowerCase();
        const seen = new Set();

        // Helper function to check if a URL matches the query and return match quality
        const urlMatches = (url, searchQuery) => {
            const urlLower = url.toLowerCase();

            // Try to parse URL for better matching
            let hostname = '';
            let pathname = '';
            let fullUrl = urlLower;

            try {
                const urlObj = new URL(url);
                hostname = urlObj.hostname.replace('www.', '');
                pathname = urlObj.pathname;
                fullUrl = hostname + pathname;
            } catch (e) {
                // Invalid URL, use as-is
            }

            // Exact domain match (highest priority) - e.g., "github.com"
            if (hostname === searchQuery || hostname === 'www.' + searchQuery) {
                return { matches: true, score: 10 };
            }

            // Domain prefix match - e.g., "git" matches "github.com"
            if (hostname.startsWith(searchQuery)) {
                return { matches: true, score: 9 };
            }

            // Subdomain match - e.g., "docs" matches "docs.google.com"
            if (hostname.startsWith(searchQuery + '.')) {
                return { matches: true, score: 8.5 };
            }

            // URL path prefix match - e.g., "github.com/user" starts with "github.com/u"
            if (fullUrl.startsWith(searchQuery)) {
                return { matches: true, score: 8 };
            }

            // Domain contains query - e.g., "hub" matches "github.com"
            if (hostname.includes(searchQuery)) {
                return { matches: true, score: 6 };
            }

            // Full URL contains query
            if (urlLower.includes(searchQuery)) {
                return { matches: true, score: 5 };
            }

            // Special case for Gmail and other common services
            const specialMappings = {
                'gmail': ['mail.google.com', 'gmail.com'],
                'youtube': ['youtube.com', 'youtu.be'],
                'maps': ['maps.google.com', 'google.com/maps'],
                'drive': ['drive.google.com'],
                'docs': ['docs.google.com'],
                'sheets': ['sheets.google.com'],
                'slides': ['slides.google.com'],
                'calendar': ['calendar.google.com'],
                'meet': ['meet.google.com'],
                'github': ['github.com', 'gist.github.com'],
                'twitter': ['twitter.com', 'x.com'],
                'facebook': ['facebook.com', 'fb.com'],
                'instagram': ['instagram.com', 'instagr.am'],
                'linkedin': ['linkedin.com', 'lnkd.in'],
                'reddit': ['reddit.com', 'redd.it']
            };

            // Check if query matches any special mapping
            for (const [keyword, domains] of Object.entries(specialMappings)) {
                if (searchQuery === keyword || searchQuery.startsWith(keyword)) {
                    for (const domain of domains) {
                        if (urlLower.includes(domain)) {
                            return { matches: true, score: 7 };
                        }
                    }
                }
            }

            return { matches: false, score: 0 };
        };

        // Patterns to exclude from autocomplete based on title
        const excludeTitlePatterns = [
            /🤖/,  // Robot emoji
            /automation/i,
            /recording/i,
            /playback/i,
            /running\.\.\./i,
            /▶️/,  // Play button emoji
            /🎯/   // Target emoji
        ];

        // Search bookmarks first (higher priority)
        this.bookmarks.forEach(bookmark => {
            if (seen.has(bookmark.url)) return;

            // Skip automation bookmarks
            if (bookmark.isAutomation) return;

            // Skip bookmarks with automation-related titles
            const hasAutomationTitle = bookmark.title && excludeTitlePatterns.some(pattern => pattern.test(bookmark.title));
            if (hasAutomationTitle) return;

            const titleMatch = bookmark.title && bookmark.title.toLowerCase().includes(queryLower);
            const titlePrefixMatch = bookmark.title && bookmark.title.toLowerCase().startsWith(queryLower);
            const urlMatchResult = urlMatches(bookmark.url, queryLower);
            const tagMatch = bookmark.tags && bookmark.tags.some(tag =>
                tag.toLowerCase().includes(queryLower)
            );

            if (titleMatch || urlMatchResult.matches || tagMatch) {
                // Calculate combined score
                let score = 100; // Base score for bookmarks (higher priority)

                if (titlePrefixMatch) score += 50;
                else if (titleMatch) score += 30;

                if (urlMatchResult.matches) score += urlMatchResult.score * 5;

                if (tagMatch) score += 20;

                results.push({
                    url: bookmark.url,
                    title: bookmark.title,
                    favicon: bookmark.favicon,
                    type: 'bookmark',
                    score: score
                });
                seen.add(bookmark.url);
            }
        });

        // Search history (skip interstitial pages and duplicates)
        // Since we now keep all visits, we need to deduplicate for autocomplete
        const urlToMostRecent = new Map();

        // Patterns to exclude from autocomplete (automation URLs)
        const excludePatterns = [
            /localhost:\d+/i,
            /127\.0\.0\.1:\d+/i,
            /0\.0\.0\.0:\d+/i,
            /192\.168\.\d+\.\d+:\d+/i,
            /10\.\d+\.\d+\.\d+:\d+/i,
            /test\.html/i,
            /demo\.html/i,
            /sample\.html/i,
            /example\.html/i,
            /automation/i,
            /puppeteer/i,
            /selenium/i,
            /webdriver/i,
            /playwright/i,
            /cypress/i,
            /testcafe/i
        ];

        // First pass: find most recent visit for each URL (excluding automation patterns)
        this.browsingHistory.forEach(historyItem => {
            if (historyItem.isInterstitial) return;

            // Skip URLs that match automation patterns
            const isAutomationUrl = excludePatterns.some(pattern => pattern.test(historyItem.url));
            if (isAutomationUrl) return;

            // Skip entries with automation-related titles
            const hasAutomationTitle = historyItem.title && excludeTitlePatterns.some(pattern => pattern.test(historyItem.title));
            if (hasAutomationTitle) return;

            if (!urlToMostRecent.has(historyItem.url) ||
                historyItem.lastVisited > urlToMostRecent.get(historyItem.url).lastVisited) {
                urlToMostRecent.set(historyItem.url, historyItem);
            }
        });

        // Second pass: search unique URLs
        for (const historyItem of urlToMostRecent.values()) {
            if (seen.has(historyItem.url)) continue;
            if (results.length >= 15) break;

            const titleMatch = historyItem.title && historyItem.title.toLowerCase().includes(queryLower);
            const titlePrefixMatch = historyItem.title && historyItem.title.toLowerCase().startsWith(queryLower);
            const urlMatchResult = urlMatches(historyItem.url, queryLower);

            // Also check if the query matches any URL in the redirect chain
            let redirectMatchResult = { matches: false, score: 0 };
            if (historyItem.originalUrl) {
                redirectMatchResult = urlMatches(historyItem.originalUrl, queryLower);
            }
            if (!redirectMatchResult.matches && historyItem.redirectChain) {
                for (const url of historyItem.redirectChain) {
                    const result = urlMatches(url, queryLower);
                    if (result.matches && result.score > redirectMatchResult.score) {
                        redirectMatchResult = result;
                    }
                }
            }

            if (titleMatch || urlMatchResult.matches || redirectMatchResult.matches) {
                // Base score for history items
                let score = 10;

                // Title matching
                if (titlePrefixMatch) score += 25;
                else if (titleMatch) score += 15;

                // URL matching (with quality weighting)
                if (urlMatchResult.matches) {
                    score += urlMatchResult.score * 3;
                }

                // Redirect matching
                if (redirectMatchResult.matches) {
                    score += redirectMatchResult.score * 2;
                }

                // Count actual visits for this URL (frequency scoring)
                const visitCount = this.browsingHistory.filter(h => h.url === historyItem.url).length;
                if (visitCount > 1) score += Math.min(visitCount * 2, 30); // Up to +30 for very frequent visits

                // Recency boost
                const now = Date.now();
                const hourAgo = now - (60 * 60 * 1000);
                const dayAgo = now - (24 * 60 * 60 * 1000);
                const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

                if (historyItem.lastVisited > hourAgo) score += 15;
                else if (historyItem.lastVisited > dayAgo) score += 8;
                else if (historyItem.lastVisited > weekAgo) score += 3;

                results.push({
                    url: historyItem.url,
                    title: historyItem.title,
                    favicon: historyItem.favicon,
                    type: 'history',
                    score: score,
                    visitCount: visitCount // Include for debugging/display
                });
                seen.add(historyItem.url);
            }
        }

        // Sort by score (higher score = better match)
        results.sort((a, b) => b.score - a.score);

        // Return top 8 results
        return results.slice(0, 8);
    }

    selectNextAutocomplete() {
        if (this.autocompleteResults.length === 0) return;

        this.selectedAutocompleteIndex++;
        if (this.selectedAutocompleteIndex >= this.autocompleteResults.length) {
            this.selectedAutocompleteIndex = 0;
        }

        this.updateAutocompleteSelection();
    }

    selectPreviousAutocomplete() {
        if (this.autocompleteResults.length === 0) return;

        this.selectedAutocompleteIndex--;
        if (this.selectedAutocompleteIndex < 0) {
            this.selectedAutocompleteIndex = this.autocompleteResults.length - 1;
        }

        this.updateAutocompleteSelection();
    }

    updateAutocompleteSelection() {
        // Remove all selected classes
        this.autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selected class to current item
        if (this.selectedAutocompleteIndex >= 0) {
            const selectedItem = this.autocompleteDropdown.querySelector(
                `.autocomplete-item[data-index="${this.selectedAutocompleteIndex}"]`
            );
            if (selectedItem) {
                selectedItem.classList.add('selected');
                // Update address bar with selected URL
                const selected = this.autocompleteResults[this.selectedAutocompleteIndex];
                this.addressBar.value = selected.url;
            }
        }
    }

    hideAutocomplete() {
        this.autocompleteDropdown.classList.add('hidden');
        this.autocompleteDropdown.innerHTML = '';
        this.autocompleteResults = [];
        this.selectedAutocompleteIndex = -1;
        this.inlineAutocompleteActive = false;
    }

    getInlineCompletion(userInput, url) {
        const inputLower = userInput.toLowerCase();

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace(/^www\./, '');
            const pathname = urlObj.pathname;
            const cleanInput = inputLower.replace(/^www\./, '');

            // Case 1: Domain prefix match (e.g., "git" -> "hub.com")
            if (hostname.startsWith(cleanInput)) {
                return hostname.substring(cleanInput.length);
            }

            // Case 2: Full URL with path (e.g., "github.com/ant" -> "hropics")
            const fullUrl = hostname + pathname;
            if (fullUrl.toLowerCase().startsWith(cleanInput)) {
                return fullUrl.substring(cleanInput.length);
            }

        } catch (e) {
            // Not a valid URL format
        }

        return null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            return url;
        }
    }

    addToHistory(url, title, favicon, redirectInfo = null, isAutomation = false) {
        // Don't add Claude results or empty URLs
        if (!url || url.startsWith('data:') || url === 'about:blank') return;

        // Don't add automation URLs to history at all
        if (isAutomation) return;

        // Skip common interstitial/redirect pages
        const interstitialPatterns = [
            /\/saml\//i,
            /\/oauth\//i,
            /\/auth\//i,
            /\/signin\?/i,
            /\/login\?/i,
            /\/sso\//i,
            /\/redirect\?/i,
            /\/callback\?/i,
            /accounts\.google\.com\/ServiceLogin/i,
            /accounts\.google\.com\/signin/i,
            /login\.microsoftonline\.com/i,
            /\/blank\.html/i,
            /\/loading/i,
            /\/interstitial/i
        ];

        // Check if this looks like an interstitial page
        const isInterstitial = interstitialPatterns.some(pattern => pattern.test(url));

        // Clean HTML from title if present
        if (title && typeof title === 'string') {
            // First, strip any leading/trailing whitespace and common HTML artifacts
            title = title.trim();

            // Remove leading > or < or &gt; that might be from broken HTML
            title = title.replace(/^(&gt;|&lt;|[<>])+/, '');

            // Decode HTML entities without interpreting as HTML
            const textarea = document.createElement('textarea');
            textarea.innerHTML = title;
            title = textarea.value;

            // Remove any leading > or < after decoding
            title = title.replace(/^[<>]+/, '');

            // Final cleanup - remove any remaining HTML tags
            title = title.replace(/<[^>]*>/g, '');

            // Trim again after all processing
            title = title.trim();
        }

        // Skip if title suggests it's a redirect/loading page
        const titleLower = (title || '').toLowerCase();
        const skipTitles = ['redirecting', 'loading', 'signing in', 'authenticating', 'please wait'];
        const shouldSkipByTitle = skipTitles.some(skip => titleLower.includes(skip));

        if (isInterstitial || shouldSkipByTitle) {
            // Mark as interstitial but still store (with lower priority)
            const existingIndex = this.browsingHistory.findIndex(item => item.url === url);
            if (existingIndex >= 0) {
                this.browsingHistory[existingIndex].isInterstitial = true;
            }
            return;
        }

        // Always add a new entry for each visit (don't update existing)
        // This preserves full browsing history
        const historyEntry = {
            url: url,
            title: title || url,
            favicon: favicon || null,
            visitCount: 1,
            lastVisited: Date.now(),
            isInterstitial: false
        };

        // Add redirect info if provided
        if (redirectInfo) {
            historyEntry.originalUrl = redirectInfo.originalUrl;
            historyEntry.redirectChain = redirectInfo.redirectChain;
        }

        this.browsingHistory.unshift(historyEntry);

        // However, we should still update favicon/title for recent entries of the same URL
        // (in case we're getting better data on subsequent loads)
        const recentSameUrl = this.browsingHistory.slice(1, 10).filter(item => item.url === url);
        recentSameUrl.forEach(item => {
            // Update title if the old one was just the URL
            if (title && (item.title === url || !item.title)) {
                item.title = title;
            }
            // Update favicon if we have a better one
            if (favicon && !item.favicon) {
                item.favicon = favicon;
            }
        });

        // Limit history size
        if (this.browsingHistory.length > this.maxHistoryItems) {
            this.browsingHistory = this.browsingHistory.slice(0, this.maxHistoryItems);
        }

        // Save to localStorage for persistence
        this.saveHistory();
    }

    saveHistory() {
        try {
            localStorage.setItem('browsingHistory', JSON.stringify(this.browsingHistory.slice(0, 100)));
        } catch (e) {
            console.error('Failed to save history:', e);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('browsingHistory');
            if (saved) {
                this.browsingHistory = JSON.parse(saved);

                // Clean any existing titles and favicons that might have HTML artifacts
                this.browsingHistory = this.browsingHistory.map(item => {
                    if (item.title && typeof item.title === 'string') {
                        // Clean the title
                        let title = item.title.trim();

                        // Remove leading > or < or &gt; that might be from broken HTML
                        title = title.replace(/^(&gt;|&lt;|[<>])+/, '');

                        // Decode HTML entities
                        const textarea = document.createElement('textarea');
                        textarea.innerHTML = title;
                        title = textarea.value;

                        // Remove any leading > or < after decoding
                        title = title.replace(/^[<>]+/, '');

                        // Remove any HTML tags
                        title = title.replace(/<[^>]*>/g, '');

                        item.title = title.trim();
                    }

                    // Clean up invalid favicons
                    if (item.favicon && typeof item.favicon === 'string') {
                        // Remove favicon if it's our default SVG or contains HTML
                        if (item.favicon.includes('data:image/svg+xml,<svg') ||
                            item.favicon.includes('xmlns="http://www.w3.org/2000/svg"')) {
                            delete item.favicon;
                        }
                    }

                    return item;
                });

                // Save cleaned history back to storage
                this.saveHistory();
            }
        } catch (e) {
            console.error('Failed to load history:', e);
        }
    }

    // Semantic Search Methods
    showSemanticSearchDialog() {
        const dialog = document.getElementById('semantic-search-dialog');
        const input = document.getElementById('semantic-search-input');
        const results = document.getElementById('semantic-search-results');
        const resultsList = document.getElementById('semantic-search-results-list');

        if (dialog) {
            dialog.classList.remove('hidden');
            if (input) {
                input.value = '';
                input.focus();
            }
            if (results) {
                results.classList.add('hidden');
            }
            if (resultsList) {
                resultsList.innerHTML = '';
            }
        }
    }

    hideSemanticSearchDialog() {
        const dialog = document.getElementById('semantic-search-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
        // Clear any highlights
        this.clearSearchHighlights();
    }

    // Ask Page Methods
    showAskPageDialog() {
        const dialog = document.getElementById('ask-page-dialog');
        const input = document.getElementById('ask-page-input');
        const results = document.getElementById('ask-page-results');
        const answer = document.getElementById('ask-page-answer');

        if (dialog) {
            dialog.classList.remove('hidden');
            if (input) {
                input.value = '';
                input.focus();
            }
            if (results) {
                results.classList.add('hidden');
            }
            if (answer) {
                answer.innerHTML = '';
            }
        }
    }

    hideAskPageDialog() {
        const dialog = document.getElementById('ask-page-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
    }

    async askAboutPage(question) {
        const tab = this.getCurrentTab();
        if (!tab) {
            alert('No active tab');
            return;
        }

        // Try to get the webview from the current tab content
        const content = this.tabsContent.querySelector(`[data-tab-id="${this.activeTabId}"]`);
        if (!content) {
            alert('No content area found');
            return;
        }

        const webview = content.querySelector('.tab-webview');
        if (!webview || !webview.src || webview.src === 'about:blank' || webview.src === '') {
            alert('Please navigate to a webpage first');
            return;
        }

        const results = document.getElementById('ask-page-results');
        const answer = document.getElementById('ask-page-answer');

        // Show loading state
        if (results) {
            results.classList.remove('hidden');
        }
        if (answer) {
            answer.innerHTML = '<div class="loading">Analyzing page content and generating answer...</div>';
        }

        try {
            // Extract text content from the webview
            const pageText = await webview.executeJavaScript(`
                (function() {
                    const bodyClone = document.body ? document.body.cloneNode(true) : null;

                    if (bodyClone) {
                        const scripts = bodyClone.querySelectorAll('script, style, noscript');
                        scripts.forEach(el => el.remove());

                        const bodyText = bodyClone.innerText || bodyClone.textContent || '';
                        const titleText = document.title || '';

                        return titleText + '\\n\\n' + bodyText;
                    } else {
                        return document.title + '\\n\\n' + document.body.innerText;
                    }
                })();
            `);

            if (!pageText || pageText.trim().length < 50) {
                answer.innerHTML = '<p>Unable to extract meaningful content from this page.</p>';
                return;
            }

            // Remove any existing listeners
            window.electronAPI.removeSummaryStreamListeners();

            // Set up container for streamed content
            answer.innerHTML = '';
            let streamedContent = '';

            // Set up streaming listeners
            window.electronAPI.onSummaryStreamChunk((data) => {
                streamedContent += data.text;
                answer.innerHTML = this.processMarkdownContent(streamedContent);
            });

            window.electronAPI.onSummaryStreamEnd((data) => {
                answer.innerHTML = this.processMarkdownContent(data.fullContent);
                window.electronAPI.removeSummaryStreamListeners();
            });

            window.electronAPI.onSummaryStreamError((data) => {
                answer.innerHTML = `
                    <div class="error">
                        <h3>Error generating answer</h3>
                        <p>${data.error}</p>
                    </div>
                `;
                window.electronAPI.removeSummaryStreamListeners();
            });

            // Get selected model
            const model = this.getSelectedModel();

            // Generate answer by streaming from Claude with custom prompt
            const customPrompt = `Based on the following webpage content, please answer this specific question:\n\nQuestion: ${question}\n\nProvide a clear, detailed answer based only on the information available in the page content. If the answer cannot be found in the content, please say so.`;
            await window.electronAPI.summarizePageStream(pageText.substring(0, 50000), model, customPrompt);

        } catch (error) {
            answer.innerHTML = `
                <div class="error">
                    <h3>Error during question answering</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async performSemanticSearch(query) {
        const model = document.getElementById('model-select').value;
        const results = document.getElementById('semantic-search-results');
        const resultsList = document.getElementById('semantic-search-results-list');

        // Show loading state
        if (results) {
            results.classList.remove('hidden');
        }
        if (resultsList) {
            resultsList.innerHTML = '<div class="semantic-search-result">Searching across all tabs...</div>';
        }

        try {
            // Collect content from all tabs
            const tabsData = await this.collectTabsContent();


            if (tabsData.length === 0) {
                if (resultsList) {
                    resultsList.innerHTML = '<div class="semantic-search-result">No web pages found in open tabs.</div>';
                }
                return;
            }

            // Call the semantic search API
            const response = await window.electronAPI.semanticSearchTabs(query, tabsData, model);

            if (response.error) {
                if (resultsList) {
                    resultsList.innerHTML = DOMPurify.sanitize(`<div class="semantic-search-result error">Error: ${response.error}</div>`);
                }
                return;
            }

            if (response.success && response.results) {
                this.displaySearchResults(response.results);
            }
        } catch (error) {
            console.error('Semantic search error:', error);
            if (resultsList) {
                resultsList.innerHTML = DOMPurify.sanitize(`<div class="semantic-search-result error">Error: ${error.message}</div>`);
            }
        }
    }

    async collectTabsContent() {
        const tabsData = [];


        for (const tab of this.tabs) {

            if (tab.mode === 'web' && tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('chrome://')) {
                const webview = this.getOrCreateWebview(tab.id);

                if (webview) {
                    try {
                        // Check if webview is ready
                        const isLoading = webview.isLoading();

                        // Wait for webview to be ready if it's still loading
                        if (isLoading) {
                            await new Promise((resolve) => {
                                const checkReady = () => {
                                    if (!webview.isLoading()) {
                                        resolve();
                                    } else {
                                        setTimeout(checkReady, 100);
                                    }
                                };
                                // Set a timeout to prevent infinite waiting
                                setTimeout(resolve, 3000);
                                checkReady();
                            });
                        }

                        // Extract title, metadata, and first paragraphs from the webview
                        const pageData = await webview.executeJavaScript(`
                            const result = {
                                title: document.title || '',
                                metadata: {},
                                paragraphs: []
                            };

                            // Extract metadata
                            const metaTags = document.querySelectorAll('meta');
                            metaTags.forEach(meta => {
                                if (meta.name && meta.content) {
                                    result.metadata[meta.name] = meta.content;
                                } else if (meta.property && meta.content) {
                                    result.metadata[meta.property] = meta.content;
                                }
                            });

                            // Get description from various sources
                            result.description = result.metadata.description ||
                                               result.metadata['og:description'] ||
                                               result.metadata['twitter:description'] || '';

                            // Get keywords
                            result.keywords = result.metadata.keywords || '';

                            // Extract first N paragraphs
                            const paragraphs = document.querySelectorAll('p, article p, main p, [role="main"] p');
                            let extractedCount = 0;
                            const maxParagraphs = 5;

                            for (let p of paragraphs) {
                                const text = p.textContent.trim();
                                // Only include substantial paragraphs (more than 50 chars)
                                if (text.length > 50) {
                                    result.paragraphs.push(text);
                                    extractedCount++;
                                    if (extractedCount >= maxParagraphs) break;
                                }
                            }

                            // If we didn't find enough paragraphs, try h1-h3 and divs
                            if (extractedCount < 3) {
                                const headings = document.querySelectorAll('h1, h2, h3');
                                headings.forEach(h => {
                                    const text = h.textContent.trim();
                                    if (text.length > 20) {
                                        result.paragraphs.push(text);
                                    }
                                });
                            }

                            result;
                        `);

                        // Only add tabs with meaningful content
                        if (pageData.title || pageData.paragraphs.length > 0) {
                            tabsData.push({
                                tabId: tab.id,
                                title: pageData.title || tab.title || 'Untitled',
                                url: tab.url,
                                description: pageData.description,
                                keywords: pageData.keywords,
                                content: pageData.paragraphs.join('\n\n')
                            });
                        } else {
                        }
                    } catch (e) {
                        console.error('Error extracting content from tab:', tab.id, e);
                        console.error('Error details:', e.message, e.stack);
                        // Try to at least include basic tab info
                        if (tab.title && tab.url) {
                            tabsData.push({
                                tabId: tab.id,
                                title: tab.title,
                                url: tab.url,
                                description: 'Could not extract page content',
                                keywords: '',
                                content: ''
                            });
                        }
                    }
                } else {
                }
            } else {
            }
        }

        return tabsData;
    }

    displaySearchResults(results) {
        const resultsList = document.getElementById('semantic-search-results-list');

        if (!resultsList) return;

        resultsList.innerHTML = '';

        if (!results || results.length === 0) {
            resultsList.innerHTML = '<div class="semantic-search-result">No matching content found in any tabs.</div>';
            return;
        }

        // First, highlight matching tabs
        this.highlightMatchingTabs(results);

        // Then display results
        results.forEach((result) => {
            const resultEl = document.createElement('div');
            resultEl.className = 'semantic-search-result';
            resultEl.innerHTML = `
                <div class="search-result-title">
                    ${result.title}
                    <span class="search-result-score">${(result.score * 100).toFixed(0)}% match</span>
                </div>
                <div class="search-result-snippet">${result.snippet}</div>
                <div class="search-result-context">${result.matchContext}</div>
                <div class="search-result-url">${result.url}</div>
            `;

            // Click to switch to that tab
            resultEl.addEventListener('click', () => {
                // Find the tab by matching URL
                for (const tab of this.tabs) {
                    if (tab.url === result.url) {
                        this.switchToTab(tab.id);
                        this.hideSemanticSearchDialog();
                        break;
                    }
                }
            });

            resultsList.appendChild(resultEl);
        });
    }

    highlightMatchingTabs(results) {
        // Clear previous highlights
        this.clearSearchHighlights();

        // Create a set of matching URLs for quick lookup
        const matchingUrls = new Set(results.map(r => r.url));

        // Highlight tabs that have matches
        for (const tab of this.tabs) {
            if (matchingUrls.has(tab.url)) {
                const tabEl = document.querySelector(`[data-tab-id="${tab.id}"]`);
                if (tabEl) {
                    tabEl.classList.add('search-highlight');
                }
            }
        }
    }

    clearSearchHighlights() {
        document.querySelectorAll('.tab.search-highlight').forEach(tab => {
            tab.classList.remove('search-highlight');
        });
    }

    // Download manager methods
    setupDownloadManager() {
        if (!this.downloadsBtn || !this.downloadsPanel) return;

        // Toggle downloads panel
        this.downloadsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadsPanel.classList.toggle('hidden');
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.downloadsPanel.contains(e.target) && !this.downloadsBtn.contains(e.target)) {
                this.downloadsPanel.classList.add('hidden');
            }
        });

        // Clear all downloads
        this.clearDownloadsBtn?.addEventListener('click', () => {
            this.downloads = [];
            this.updateDownloadsList();
        });

        // Listen for download events from main process
        window.electronAPI.onDownloadStarted((data) => {
            this.addDownload(data);
        });

        window.electronAPI.onDownloadProgress((data) => {
            this.updateDownloadProgress(data);
        });

        window.electronAPI.onDownloadDone((data) => {
            this.completeDownload(data);
        });
    }

    setupNetworkDetection() {
        if (!this.offlineWarning) return;

        // Check initial network status
        this.updateNetworkStatus();

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.updateNetworkStatus();
            this.showNotification('Internet connection restored', 'success');
        });

        window.addEventListener('offline', () => {
            this.updateNetworkStatus();
            this.showNotification('No internet connection', 'warning');
        });

        // Also check periodically (every 30 seconds) as a backup
        setInterval(() => {
            this.updateNetworkStatus();
        }, 30000);
    }

    updateNetworkStatus() {
        if (!this.offlineWarning) return;

        const isOnline = navigator.onLine;

        if (isOnline) {
            this.offlineWarning.classList.add('hidden');
        } else {
            this.offlineWarning.classList.remove('hidden');
        }
    }

    addDownload(data) {
        this.downloads.unshift({
            id: data.id,
            fileName: data.fileName,
            totalBytes: data.totalBytes,
            receivedBytes: data.receivedBytes,
            state: data.state,
            speed: 0,
            timeRemaining: 0,
            path: null
        });
        this.updateDownloadsList();
        this.updateDownloadsBadge();
    }

    updateDownloadProgress(data) {
        const download = this.downloads.find(d => d.id === data.id);
        if (download) {
            download.receivedBytes = data.receivedBytes;
            download.state = data.state;
            download.speed = data.speed;
            download.timeRemaining = data.timeRemaining;
            this.updateDownloadsList();
        }
    }

    completeDownload(data) {
        const download = this.downloads.find(d => d.id === data.id);
        if (download) {
            download.state = data.state;
            download.path = data.path;
            this.updateDownloadsList();
        }
    }

    updateDownloadsBadge() {
        const activeDownloads = this.downloads.filter(d => d.state === 'progressing').length;
        if (activeDownloads > 0) {
            this.downloadsBadge.textContent = activeDownloads;
            this.downloadsBadge.classList.remove('hidden');
        } else {
            this.downloadsBadge.classList.add('hidden');
        }
    }

    updateDownloadsList() {
        if (!this.downloadsList) return;

        if (this.downloads.length === 0) {
            this.downloadsList.innerHTML = '<div class="downloads-empty">No downloads yet</div>';
            this.updateDownloadsBadge();
            return;
        }

        this.downloadsList.innerHTML = this.downloads.map(download => {
            const progress = download.totalBytes > 0
                ? (download.receivedBytes / download.totalBytes) * 100
                : 0;

            const statusClass = download.state === 'completed' ? 'completed'
                : download.state === 'cancelled' || download.state === 'interrupted' ? 'failed'
                : 'in-progress';

            const statusText = download.state === 'completed' ? 'Completed'
                : download.state === 'cancelled' ? 'Cancelled'
                : download.state === 'interrupted' ? 'Failed'
                : 'Downloading...';

            const speed = download.speed > 0 ? this.formatSpeed(download.speed) : '';
            const remaining = download.timeRemaining > 0 ? this.formatTime(download.timeRemaining) : '';

            return `
                <div class="download-item ${statusClass}">
                    <div class="download-info">
                        <div class="download-name" title="${download.fileName}">${download.fileName}</div>
                        <div class="download-status">${statusText}${speed ? ' - ' + speed : ''}${remaining ? ' - ' + remaining + ' left' : ''}</div>
                    </div>
                    ${download.state === 'progressing' ? `
                        <div class="download-progress">
                            <div class="download-progress-bar" style="width: ${progress}%"></div>
                        </div>
                    ` : ''}
                    <div class="download-actions">
                        ${download.state === 'completed' && download.path ? `
                            <button class="download-action-btn" onclick="tabManager.openDownload('${download.path}')" title="Open file">
                                <span>Open</span>
                            </button>
                            <button class="download-action-btn" onclick="tabManager.showDownloadInFolder('${download.path}')" title="Show in folder">
                                <span>Show</span>
                            </button>
                        ` : ''}
                        <button class="download-action-btn" onclick="tabManager.removeDownload('${download.id}')" title="Remove from list">
                            <span>×</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        this.updateDownloadsBadge();
    }

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
        if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }

    formatTime(seconds) {
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
        return `${Math.ceil(seconds / 3600)}h`;
    }

    async openDownload(filePath) {
        try {
            await window.electronAPI.openDownload(filePath);
        } catch (error) {
            this.showNotification('Failed to open file', 'error');
        }
    }

    async showDownloadInFolder(filePath) {
        try {
            await window.electronAPI.showDownloadInFolder(filePath);
        } catch (error) {
            this.showNotification('Failed to show file in folder', 'error');
        }
    }

    removeDownload(id) {
        this.downloads = this.downloads.filter(d => d.id !== id);
        this.updateDownloadsList();
    }

    // Onboarding methods
    setupOnboarding() {
        if (!this.onboardingOverlay) return;

        // Get all onboarding elements
        this.onboardingSteps = Array.from(this.onboardingOverlay.querySelectorAll('.onboarding-step'));
        this.onboardingPrevBtn = this.onboardingOverlay.querySelector('#onboarding-prev');
        this.onboardingNextBtn = this.onboardingOverlay.querySelector('#onboarding-next');
        this.onboardingSkipBtn = this.onboardingOverlay.querySelector('.onboarding-skip');
        this.onboardingDots = Array.from(this.onboardingOverlay.querySelectorAll('.onboarding-dot'));

        // Set up event listeners
        if (this.onboardingNextBtn) {
            this.onboardingNextBtn.addEventListener('click', () => this.nextOnboardingStep());
        }

        if (this.onboardingPrevBtn) {
            this.onboardingPrevBtn.addEventListener('click', () => this.prevOnboardingStep());
        }

        if (this.onboardingSkipBtn) {
            this.onboardingSkipBtn.addEventListener('click', () => this.skipOnboarding());
        }

        // Set up dot navigation
        this.onboardingDots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goToOnboardingStep(index));
        });

        // Set up default browser buttons
        const setDefaultBtn = this.onboardingOverlay.querySelector('#onboarding-set-default');
        const skipDefaultBtn = this.onboardingOverlay.querySelector('#onboarding-skip-default');

        if (setDefaultBtn) {
            setDefaultBtn.addEventListener('click', async () => {
                try {
                    await window.electronAPI.setAsDefaultBrowser();
                    this.nextOnboardingStep();
                } catch (error) {
                    console.error('Failed to set as default browser:', error);
                    this.nextOnboardingStep();
                }
            });
        }

        if (skipDefaultBtn) {
            skipDefaultBtn.addEventListener('click', () => {
                this.nextOnboardingStep();
            });
        }

        // Set up bookmark import buttons
        const importBtns = this.onboardingOverlay.querySelectorAll('.onboarding-import-btn');
        const skipImportBtn = this.onboardingOverlay.querySelector('#onboarding-skip-import');
        const importStatus = this.onboardingOverlay.querySelector('#import-status');

        importBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const browser = btn.dataset.browser;
                importStatus.style.display = 'block';
                importStatus.style.background = '#e3f2fd';
                importStatus.style.color = '#1976d2';
                importStatus.textContent = `Importing bookmarks from ${browser.charAt(0).toUpperCase() + browser.slice(1)}...`;

                try {
                    const result = await window.electronAPI.importBookmarks(browser);

                    if (result.success) {
                        // Add imported bookmarks to our bookmarks array
                        if (result.bookmarks && result.bookmarks.length > 0) {
                            result.bookmarks.forEach(bookmark => {
                                // Check if bookmark already exists
                                const exists = this.bookmarks.some(b => b.url === bookmark.url);
                                if (!exists) {
                                    this.bookmarks.push({
                                        url: bookmark.url,
                                        title: bookmark.title,
                                        favicon: null,
                                        tags: [],
                                        dateAdded: Date.now()
                                    });
                                }
                            });
                            this.saveBookmarks();
                            this.renderBookmarks();
                        }

                        importStatus.style.background = '#e8f5e9';
                        importStatus.style.color = '#2e7d32';
                        importStatus.textContent = `✓ Imported ${result.count || 0} bookmarks successfully!`;

                        setTimeout(() => {
                            this.nextOnboardingStep();
                        }, 1500);
                    } else {
                        throw new Error(result.error || 'Failed to import bookmarks');
                    }
                } catch (error) {
                    console.error('Import error:', error);
                    importStatus.style.background = '#ffebee';
                    importStatus.style.color = '#c62828';
                    importStatus.textContent = `✗ ${error.message}`;
                }
            });

            // Hover effect
            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = '#4299e1';
                btn.style.background = '#f7fafc';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.borderColor = '#e0e0e0';
                btn.style.background = 'white';
            });
        });

        if (skipImportBtn) {
            skipImportBtn.addEventListener('click', () => {
                this.nextOnboardingStep();
            });
        }
    }

    checkAndShowOnboarding() {
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding') === 'true';
        if (!hasSeenOnboarding) {
            this.showOnboarding();
        }
    }

    showOnboarding() {
        if (!this.onboardingOverlay) return;

        this.currentOnboardingStep = 0;
        this.updateOnboardingStep();
        this.onboardingOverlay.classList.remove('hidden');
    }

    hideOnboarding() {
        if (!this.onboardingOverlay) return;

        this.onboardingOverlay.classList.add('hidden');
        localStorage.setItem('hasSeenOnboarding', 'true');
    }

    nextOnboardingStep() {
        if (this.currentOnboardingStep < this.onboardingSteps.length - 1) {
            this.currentOnboardingStep++;
            this.updateOnboardingStep();
        } else {
            // Reached the end
            this.hideOnboarding();
        }
    }

    prevOnboardingStep() {
        if (this.currentOnboardingStep > 0) {
            this.currentOnboardingStep--;
            this.updateOnboardingStep();
        }
    }

    goToOnboardingStep(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.onboardingSteps.length) {
            this.currentOnboardingStep = stepIndex;
            this.updateOnboardingStep();
        }
    }

    skipOnboarding() {
        this.hideOnboarding();
    }

    updateOnboardingStep() {
        // Hide all steps
        this.onboardingSteps.forEach(step => {
            step.classList.add('hidden');
        });

        // Show current step
        if (this.onboardingSteps[this.currentOnboardingStep]) {
            this.onboardingSteps[this.currentOnboardingStep].classList.remove('hidden');
        }

        // Update dots
        this.onboardingDots.forEach((dot, index) => {
            if (index === this.currentOnboardingStep) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        // Update buttons
        if (this.onboardingPrevBtn) {
            this.onboardingPrevBtn.disabled = this.currentOnboardingStep === 0;
        }

        if (this.onboardingNextBtn) {
            if (this.currentOnboardingStep === this.onboardingSteps.length - 1) {
                this.onboardingNextBtn.textContent = 'Get Started';
            } else {
                this.onboardingNextBtn.textContent = 'Next';
            }
        }
    }

    resetOnboarding() {
        localStorage.removeItem('hasSeenOnboarding');
    }
}

// Initialize tab manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const tabManager = new TabManager();
        // Expose globally for window communication
        window.tabManager = tabManager;

        // TEST: Create a test webview function
        window.testWebview = function() {
            const webview = document.createElement('webview');
            webview.style.width = '400px';
            webview.style.height = '300px';
            webview.style.position = 'fixed';
            webview.style.top = '100px';
            webview.style.left = '100px';
            webview.style.zIndex = '9999';
            webview.style.border = '2px solid red';
            webview.setAttribute('src', 'https://example.com');
            document.body.appendChild(webview);

            webview.addEventListener('did-start-loading', () => {
            });

            webview.addEventListener('did-stop-loading', () => {
            });

            webview.addEventListener('did-fail-load', (e) => {
                console.error('Test webview: did-fail-load', e);
            });

            return webview;
        };
    });
} else {
    const tabManager = new TabManager();
    // Expose globally for window communication
    window.tabManager = tabManager;

    // TEST: Create a test webview function
    window.testWebview = function() {
        const webview = document.createElement('webview');
        webview.style.width = '400px';
        webview.style.height = '300px';
        webview.style.position = 'fixed';
        webview.style.top = '100px';
        webview.style.left = '100px';
        webview.style.zIndex = '9999';
        webview.style.border = '2px solid red';
        webview.setAttribute('src', 'https://example.com');
        document.body.appendChild(webview);

        webview.addEventListener('did-start-loading', () => {
        });

        webview.addEventListener('did-stop-loading', () => {
        });

        webview.addEventListener('did-fail-load', (e) => {
            console.error('Test webview: did-fail-load', e);
        });

        return webview;
    };
}

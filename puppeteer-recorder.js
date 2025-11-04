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

const DEFAULT_DEBUG_PORT = parseInt(process.env.DEBUG_PORT || process.env.REMOTE_DEBUG_PORT || '9222', 10) || 9222;

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

/**
 * PuppeteerRecorder uses Chrome DevTools Protocol to record user interactions
 * This provides more accurate and detailed recording compared to DOM event listeners
 */
class PuppeteerRecorder {
    constructor() {
        this.browser = null;
        this.page = null;
        this.client = null;
        this.isRecording = false;
        this.recordedActions = [];
        this.lastUrl = null;
    }

    /**
     * Connect to existing Chrome instance and start recording
     */
    async startRecording(port = DEFAULT_DEBUG_PORT, initialUrl = null) {
        try {

            // First check if we can reach the debugging port
            const http = require('http');
            const checkPort = () => new Promise((resolve) => {
                const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
                    if (res.statusCode === 200) {
                        resolve(true);
                    } else {
                        console.error(`❌ Chrome debugging port returned status: ${res.statusCode}`);
                        resolve(false);
                    }
                });
                req.on('error', (err) => {
                    console.error('❌ Cannot reach Chrome debugging port:', err.message);
                    resolve(false);
                });
            });

            const portAccessible = await checkPort();
            if (!portAccessible) {
                throw new Error(`Cannot connect to Chrome debugging port ${port}. Make sure Chrome is running with --remote-debugging-port=${port}`);
            }

            // Connect to existing browser
            this.browser = await puppeteer.connect({
                browserURL: `http://127.0.0.1:${port}`,
                defaultViewport: null
            });

            // Get all pages
            const pages = await this.browser.pages();

            // Also check for targets (includes webviews)
            const targets = await this.browser.targets();

            if (pages.length === 0) {
                throw new Error('No pages found in browser');
            }

            // Find the active page

            // Try to find the most suitable page for recording
            let targetPage = null;

            // First, check if we have an initial URL and find the matching page or webview
            if (initialUrl && initialUrl !== 'about:blank') {
                // Look for a page with this exact URL
                for (const page of pages) {
                    const url = await page.url();
                    if (url === initialUrl) {
                        targetPage = page;
                        break;
                    }
                }

                // If not found in pages, check webview targets
                if (!targetPage) {
                    // Look for webview target with the URL
                    for (const target of targets) {
                        if (target.type() === 'webview') {
                            const targetUrl = target.url();

                            if (targetUrl === initialUrl) {
                                try {
                                    targetPage = await target.page();
                                    if (!targetPage) {
                                        // If page() returns null, try to attach to it
                                        const client = await target.createCDPSession();
                                        await client.send('Target.attachToTarget', {
                                            targetId: target._targetInfo.targetId,
                                            flatten: true
                                        });
                                        targetPage = await target.page();
                                    }
                                    break;
                                } catch (e) {
                                    // Could not get page from webview
                                }
                            }
                        }
                    }
                }

                // If still not found, try to use the main page and inject into the webview
                if (!targetPage) {
                    if (pages.length > 0) {
                        targetPage = pages[0]; // Use the main page

                        // We'll need to inject our recording script into the webview
                        // This is handled later in setupEventListeners
                    } else {
                        throw new Error(`Cannot find tab with URL: ${initialUrl}`);
                    }
                }
            } else {
                // No initial URL specified, try to find the most recently active page
                // Skip pages that are likely system pages
                for (let i = pages.length - 1; i >= 0; i--) {
                    const page = pages[i];
                    const url = await page.url();
                    if (url && url !== 'about:blank' && !url.startsWith('chrome://') && !url.includes('file://')) {
                        targetPage = page;
                        break;
                    }
                }

                // If no suitable page found, use the last page
                if (!targetPage && pages.length > 0) {
                    targetPage = pages[pages.length - 1];
                }
            }

            this.page = targetPage;

            // Don't bring the page to front - this might interfere with Electron's UI
            // await this.page.bringToFront();

            // Get CDP client for advanced features
            this.client = await this.page.target().createCDPSession();

            // Enable necessary CDP domains
            await this.client.send('DOM.enable');
            await this.client.send('Runtime.enable');
            await this.client.send('Page.enable');
            await this.client.send('Network.enable');

            // Set up event listeners
            await this.setupEventListeners();

            this.isRecording = true;
            this.lastUrl = await this.page.url();

            // Add the initial navigate action if we're on a real page
            if (this.lastUrl && this.lastUrl !== 'about:blank') {
                this.recordedActions.push({
                    type: 'navigate',
                    url: this.lastUrl,
                    timestamp: Date.now()
                });
            }


            return true;

        } catch (error) {
            console.error('Failed to start recording:', error);
            console.error('Stack trace:', error.stack);
            return false;
        }
    }

    /**
     * Inject recording script into the current page
     */
    async injectRecordingScript() {
        if (!this.page) return;

        try {
            // Check if script is already injected
            const alreadyInjected = await this.page.evaluate(() => {
                return !!window.__puppeteerRecorder;
            });

            if (alreadyInjected) {
                return;
            }

            // Inject the full recording script
            await this.page.evaluate(() => {

                // Initialize recorder object
                window.__puppeteerRecorder = {
                    clicks: [],
                    inputs: [],
                    hovers: []
                };

                // Helper to generate selector
                function getSelector(element) {
                    if (element.id) {
                        return '#' + element.id;
                    }

                    if (element.getAttribute('aria-label')) {
                        return '[aria-label="' + element.getAttribute('aria-label') + '"]';
                    }

                    if (element.name) {
                        return '[name="' + element.name + '"]';
                    }

                    if (element.className && typeof element.className === 'string') {
                        const classes = element.className.trim().split(/\s+/).filter(c => c);
                        if (classes.length > 0) {
                            return '.' + classes.join('.');
                        }
                    }

                    // Build a path selector
                    let path = [];
                    let current = element;
                    while (current && current.tagName) {
                        let selector = current.tagName.toLowerCase();
                        if (current.className && typeof current.className === 'string') {
                            const classes = current.className.trim().split(/\s+/).filter(c => c);
                            if (classes.length > 0) {
                                selector += '.' + classes[0];
                            }
                        }
                        path.unshift(selector);
                        current = current.parentElement;
                        if (path.length > 3) break;
                    }
                    return path.join(' > ');
                }

                // Track clicks
                document.addEventListener('click', function(e) {
                    const selector = getSelector(e.target);
                    const action = {
                        type: 'click',
                        selector: selector,
                        text: (e.target.innerText || '').substring(0, 30),
                        x: e.clientX,
                        y: e.clientY,
                        timestamp: Date.now()
                    };
                    window.__puppeteerRecorder.clicks.push(action);
                }, true);

                // Track inputs
                document.addEventListener('input', function(e) {
                    const target = e.target;
                    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                        const selector = getSelector(target);
                        const action = {
                            type: 'type',
                            selector: selector,
                            value: target.value,
                            timestamp: Date.now()
                        };
                        // Debounce by replacing last input if same selector
                        const lastInput = window.__puppeteerRecorder.inputs[window.__puppeteerRecorder.inputs.length - 1];
                        if (lastInput && lastInput.selector === selector && Date.now() - lastInput.timestamp < 1000) {
                            lastInput.value = target.value;
                            lastInput.timestamp = Date.now();
                        } else {
                            window.__puppeteerRecorder.inputs.push(action);
                        }
                    }
                }, true);

                // Track hovers
                let hoverTimeout;
                document.addEventListener('mouseover', function(e) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = setTimeout(() => {
                        const target = e.target;
                        if (target.id || target.getAttribute('aria-label') ||
                            (target.className && typeof target.className === 'string' && target.className.includes('menu')) ||
                            target.tagName === 'BUTTON' || target.tagName === 'A') {
                            const selector = getSelector(target);
                            const lastHover = window.__puppeteerRecorder.hovers[window.__puppeteerRecorder.hovers.length - 1];
                            if (!lastHover || lastHover.selector !== selector) {
                                window.__puppeteerRecorder.hovers.push({
                                    type: 'hover',
                                    selector: selector,
                                    timestamp: Date.now()
                                });
                            }
                        }
                    }, 200);
                }, true);

                // Track form submissions
                document.addEventListener('submit', function(e) {
                    const selector = getSelector(e.target);
                    window.__puppeteerRecorder.clicks.push({
                        type: 'submit',
                        selector: selector,
                        timestamp: Date.now()
                    });
                }, true);

            });

        } catch (error) {
            console.error('Failed to inject recording script:', error);
        }
    }

    /**
     * Set up CDP event listeners to capture user interactions
     */
    async setupEventListeners() {
        // Track page navigation
        this.page.on('framenavigated', async (frame) => {
            if (frame === this.page.mainFrame()) {
                const url = frame.url();
                if (url !== this.lastUrl && url !== 'about:blank') {
                    this.recordedActions.push({
                        type: 'navigate',
                        url: url,
                        timestamp: Date.now()
                    });
                    this.lastUrl = url;

                    // Re-inject the script after navigation
                    setTimeout(() => this.injectRecordingScript(), 500);
                }
            }
        });

        // First inject the recording script into the current page
        await this.injectRecordingScript();

        // Also set it up for future navigations
        await this.page.evaluateOnNewDocument(() => {
            // This runs in the page context before any page scripts
            window.__puppeteerRecorder = {
                clicks: [],
                inputs: [],
                hovers: []
            };

            // Helper to generate selector
            function getSelector(element) {
                if (element.id) {
                    return '#' + element.id;
                }

                if (element.getAttribute('aria-label')) {
                    return '[aria-label="' + element.getAttribute('aria-label') + '"]';
                }

                if (element.name) {
                    return '[name="' + element.name + '"]';
                }

                if (element.className && typeof element.className === 'string') {
                    const classes = element.className.trim().split(/\s+/).filter(c => c);
                    if (classes.length > 0) {
                        return '.' + classes.join('.');
                    }
                }

                // Build a path selector
                let path = [];
                let current = element;
                while (current && current.tagName) {
                    let selector = current.tagName.toLowerCase();
                    if (current.className && typeof current.className === 'string') {
                        const classes = current.className.trim().split(/\s+/).filter(c => c);
                        if (classes.length > 0) {
                            selector += '.' + classes[0];
                        }
                    }
                    path.unshift(selector);
                    current = current.parentElement;
                    if (path.length > 3) break; // Limit depth
                }
                return path.join(' > ');
            }

            // Track clicks
            document.addEventListener('click', function(e) {
                const selector = getSelector(e.target);
                const action = {
                    type: 'click',
                    selector: selector,
                    text: (e.target.innerText || '').substring(0, 30),
                    x: e.clientX,
                    y: e.clientY,
                    timestamp: Date.now()
                };
                window.__puppeteerRecorder.clicks.push(action);
            }, true);

            // Track inputs
            document.addEventListener('input', function(e) {
                const target = e.target;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    const selector = getSelector(target);
                    const action = {
                        type: 'type',
                        selector: selector,
                        value: target.value,
                        timestamp: Date.now()
                    };
                    // Debounce by replacing last input if same selector
                    const lastInput = window.__puppeteerRecorder.inputs[window.__puppeteerRecorder.inputs.length - 1];
                    if (lastInput && lastInput.selector === selector && Date.now() - lastInput.timestamp < 1000) {
                        lastInput.value = target.value;
                        lastInput.timestamp = Date.now();
                    } else {
                        window.__puppeteerRecorder.inputs.push(action);
                    }
                }
            }, true);

            // Track hovers (for dropdown menus)
            let hoverTimeout;
            document.addEventListener('mouseover', function(e) {
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    const target = e.target;
                    // Only record hover on actionable elements
                    if (target.id || target.getAttribute('aria-label') ||
                        (target.className && typeof target.className === 'string' && target.className.includes('menu')) ||
                        target.tagName === 'BUTTON' || target.tagName === 'A') {
                        const selector = getSelector(target);
                        const lastHover = window.__puppeteerRecorder.hovers[window.__puppeteerRecorder.hovers.length - 1];
                        // Avoid duplicate hovers
                        if (!lastHover || lastHover.selector !== selector) {
                            window.__puppeteerRecorder.hovers.push({
                                type: 'hover',
                                selector: selector,
                                timestamp: Date.now()
                            });
                        }
                    }
                }, 200); // Wait 200ms to ensure intentional hover
            }, true);

            // Track form submissions
            document.addEventListener('submit', function(e) {
                const selector = getSelector(e.target);
                window.__puppeteerRecorder.clicks.push({
                    type: 'submit',
                    selector: selector,
                    timestamp: Date.now()
                });
            }, true);
        });

        // Poll for recorded actions periodically
        this.pollInterval = setInterval(async () => {
            if (!this.isRecording) return;

            try {
                // First check if recorder is still present
                const recorderExists = await this.page.evaluate(() => {
                    return !!window.__puppeteerRecorder;
                });

                if (!recorderExists) {
                    await this.injectRecordingScript();
                    return;
                }

                const actions = await this.page.evaluate(() => {
                    if (window.__puppeteerRecorder) {
                        const allActions = [
                            ...window.__puppeteerRecorder.clicks,
                            ...window.__puppeteerRecorder.inputs,
                            ...window.__puppeteerRecorder.hovers
                        ].sort((a, b) => a.timestamp - b.timestamp);

                        // Clear the arrays
                        window.__puppeteerRecorder.clicks = [];
                        window.__puppeteerRecorder.inputs = [];
                        window.__puppeteerRecorder.hovers = [];

                        return allActions;
                    }
                    return [];
                });

                if (actions.length > 0) {
                    this.recordedActions.push(...actions);
                    console.log(`📊 Collected ${actions.length} new actions`);
                    actions.forEach(action => {
                        console.log(`  - ${action.type}: ${action.selector || action.url || action.key}`);
                    });
                }
            } catch (e) {
                console.error('❌ Error polling for actions:', e.message);
                // Page might have navigated, that's ok
            }
        }, 500);

        // Track keyboard shortcuts
        await this.page.evaluateOnNewDocument(() => {
            document.addEventListener('keydown', function(e) {
                // Record important keyboard shortcuts
                if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab' ||
                    (e.ctrlKey || e.metaKey)) {
                    const key = e.key;
                    const modifiers = [];
                    if (e.ctrlKey) modifiers.push('Control');
                    if (e.metaKey) modifiers.push('Meta');
                    if (e.shiftKey) modifiers.push('Shift');
                    if (e.altKey) modifiers.push('Alt');

                    window.__puppeteerRecorder.clicks.push({
                        type: 'keypress',
                        key: key,
                        modifiers: modifiers,
                        timestamp: Date.now()
                    });
                }
            }, true);
        });
    }

    /**
     * Stop recording and return actions
     */
    async stopRecording() {
        this.isRecording = false;

        // Collect any remaining actions
        if (this.page) {
            try {
                const finalActions = await this.page.evaluate(() => {
                    if (window.__puppeteerRecorder) {
                        return [
                            ...window.__puppeteerRecorder.clicks,
                            ...window.__puppeteerRecorder.inputs,
                            ...window.__puppeteerRecorder.hovers
                        ];
                    }
                    return [];
                });

                if (finalActions.length > 0) {
                    this.recordedActions.push(...finalActions);
                }
            } catch (e) {
                // Page might be closed
            }
        }

        // Clear interval
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        // Disconnect
        if (this.browser) {
            await this.browser.disconnect();
            this.browser = null;
            this.page = null;
            this.client = null;
        }

        // Sort all actions by timestamp
        this.recordedActions.sort((a, b) => a.timestamp - b.timestamp);

        return this.recordedActions;
    }

    /**
     * Get recorded actions without stopping
     */
    getRecordedActions() {
        return [...this.recordedActions].sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Clear recorded actions
     */
    clearRecording() {
        this.recordedActions = [];
    }

    /**
     * Check if currently recording
     */
    isCurrentlyRecording() {
        return this.isRecording;
    }
}

module.exports = PuppeteerRecorder;

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

const PuppeteerRecorder = require('./puppeteer-recorder');

/**
 * Extended PuppeteerRecorder with UI notification support
 */
class PuppeteerRecorderWithUI extends PuppeteerRecorder {
    constructor(uiCallback) {
        super();
        this.uiCallback = uiCallback || (() => {});
        this.actionCounter = 0;
    }

    /**
     * Override setupEventListeners to add UI notifications
     */
    async setupEventListeners() {
        // Call parent setup first (this includes injectRecordingScript)
        await super.setupEventListeners();

        // Inject UI elements into current page
        await this.injectUIElements();

        // Override polling with UI updates
        clearInterval(this.pollInterval);
        this.pollInterval = setInterval(async () => {
            if (!this.isRecording) return;

            try {
                const actions = await this.page.evaluate(() => {
                    if (window.__puppeteerRecorder) {
                        const allActions = [
                            ...window.__puppeteerRecorder.clicks,
                            ...window.__puppeteerRecorder.inputs,
                            ...window.__puppeteerRecorder.hovers
                        ].sort((a, b) => a.timestamp - b.timestamp);

                        // Clear arrays
                        window.__puppeteerRecorder.clicks = [];
                        window.__puppeteerRecorder.inputs = [];
                        window.__puppeteerRecorder.hovers = [];

                        return allActions;
                    }
                    return [];
                });

                if (actions.length > 0) {
                    this.recordedActions.push(...actions);
                    this.actionCounter += actions.length;

                    // Update UI counter
                    await this.page.evaluate((count) => {
                        if (window.__updateActionCounter) {
                            window.__updateActionCounter(count);
                        }
                    }, this.actionCounter);

                    // Notify via callback
                    actions.forEach(action => {
                        this.uiCallback({
                            type: action.type,
                            selector: action.selector,
                            count: this.actionCounter
                        });
                    });

                    console.log(`📊 Collected ${actions.length} new actions (total: ${this.actionCounter})`);
                }
            } catch (e) {
                // Page might have navigated
            }
        }, 500);

        // Also set up UI for future navigations
        await this.page.evaluateOnNewDocument(() => {
            // This code will be injected into new pages after navigation
            if (window.__recorderUIInjected) return;
            window.__recorderUIInjected = true;

            const style = document.createElement('style');
            style.textContent = `
                .puppeteer-notification {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(0, 128, 255, 0.9);
                    color: white;
                    padding: 10px 15px;
                    border-radius: 5px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    z-index: 999999;
                    animation: slideIn 0.3s ease-out;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                }

                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }

                .puppeteer-notification.click { background: rgba(76, 175, 80, 0.9); }
                .puppeteer-notification.type { background: rgba(33, 150, 243, 0.9); }
                .puppeteer-notification.hover { background: rgba(255, 152, 0, 0.9); }
                .puppeteer-notification.navigate { background: rgba(156, 39, 176, 0.9); }

                .puppeteer-counter {
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 999999;
                }
            `;
            document.head.appendChild(style);

            // Function to show notification
            window.__showRecordingNotification = function(text, type = 'info') {
                const existing = document.querySelector('.puppeteer-notification');
                if (existing) existing.remove();

                const notification = document.createElement('div');
                notification.className = 'puppeteer-notification ' + type;
                notification.textContent = text;
                document.body.appendChild(notification);

                setTimeout(() => {
                    notification.style.animation = 'fadeOut 0.3s ease-out';
                    setTimeout(() => notification.remove(), 300);
                }, 2000);
            };

            // Update counter
            window.__updateActionCounter = function(count) {
                let counter = document.querySelector('.puppeteer-counter');
                if (!counter) {
                    counter = document.createElement('div');
                    counter.className = 'puppeteer-counter';
                    document.body.appendChild(counter);
                }
                counter.textContent = '🔴 Recording: ' + count + ' actions';
            };

            // Override console.log for notifications
            const originalLog = console.log;
            console.log = function(...args) {
                if (args[0] && typeof args[0] === 'string') {
                    if (args[0].includes('🖱️ Click recorded:')) {
                        window.__showRecordingNotification('Click: ' + args[1], 'click');
                    } else if (args[0].includes('⌨️ Input recorded:')) {
                        window.__showRecordingNotification('Type: ' + args[1], 'type');
                    } else if (args[0].includes('🫱 Hover recorded:')) {
                        window.__showRecordingNotification('Hover: ' + args[1], 'hover');
                    }
                }
                return originalLog.apply(console, args);
            };

            // Show initial indicator
            window.__showRecordingNotification('🔴 Recording Started', 'info');
            window.__updateActionCounter(0);
        });
    }

    /**
     * Inject UI elements into the current page
     */
    async injectUIElements() {
        if (!this.page) return;

        try {
            await this.page.evaluate((count) => {
                // Check if UI is already injected
                if (window.__recorderUIInjected) return;
                window.__recorderUIInjected = true;

                const style = document.createElement('style');
                style.textContent = `
                    .puppeteer-notification {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        background: rgba(0, 128, 255, 0.9);
                        color: white;
                        padding: 10px 15px;
                        border-radius: 5px;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        font-size: 14px;
                        z-index: 999999;
                        animation: slideIn 0.3s ease-out;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    }

                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }

                    @keyframes fadeOut {
                        from { opacity: 1; }
                        to { opacity: 0; }
                    }

                    .puppeteer-notification.click { background: rgba(76, 175, 80, 0.9); }
                    .puppeteer-notification.type { background: rgba(33, 150, 243, 0.9); }
                    .puppeteer-notification.hover { background: rgba(255, 152, 0, 0.9); }
                    .puppeteer-notification.navigate { background: rgba(156, 39, 176, 0.9); }

                    .puppeteer-counter {
                        position: fixed;
                        top: 10px;
                        left: 10px;
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 8px 12px;
                        border-radius: 20px;
                        font-family: monospace;
                        font-size: 12px;
                        z-index: 999999;
                    }
                `;
                document.head.appendChild(style);

                // Function to show notification
                window.__showRecordingNotification = function(text, type = 'info') {
                    const existing = document.querySelector('.puppeteer-notification');
                    if (existing) existing.remove();

                    const notification = document.createElement('div');
                    notification.className = 'puppeteer-notification ' + type;
                    notification.textContent = text;
                    document.body.appendChild(notification);

                    setTimeout(() => {
                        notification.style.animation = 'fadeOut 0.3s ease-out';
                        setTimeout(() => notification.remove(), 300);
                    }, 2000);
                };

                // Update counter
                window.__updateActionCounter = function(count) {
                    let counter = document.querySelector('.puppeteer-counter');
                    if (!counter) {
                        counter = document.createElement('div');
                        counter.className = 'puppeteer-counter';
                        document.body.appendChild(counter);
                    }
                    counter.textContent = '🔴 Recording: ' + count + ' actions';
                };

                // Override console.log for notifications
                const originalLog = console.log;
                console.log = function(...args) {
                    if (args[0] && typeof args[0] === 'string') {
                        if (args[0].includes('🖱️ Click recorded:')) {
                            window.__showRecordingNotification('Click: ' + args[1], 'click');
                        } else if (args[0].includes('⌨️ Input recorded:')) {
                            window.__showRecordingNotification('Type: ' + args[1], 'type');
                        } else if (args[0].includes('🫱 Hover recorded:')) {
                            window.__showRecordingNotification('Hover: ' + args[1], 'hover');
                        }
                    }
                    return originalLog.apply(console, args);
                };

                // Show initial indicator
                window.__showRecordingNotification('🔴 Recording Started', 'info');
                window.__updateActionCounter(count || 0);
            }, this.actionCounter);

            console.log('✅ UI elements injected into page');
        } catch (error) {
            console.error('Failed to inject UI elements:', error);
        }
    }


    /**
     * Override startRecording to reset counter
     */
    async startRecording(port = DEFAULT_DEBUG_PORT, url = null) {
        this.actionCounter = 0;
        return await super.startRecording(port, url);
    }

    /**
     * Override stopRecording to clean up UI
     */
    async stopRecording() {
        // Remove UI elements
        if (this.page) {
            try {
                await this.page.evaluate(() => {
                    const notification = document.querySelector('.puppeteer-notification');
                    const counter = document.querySelector('.puppeteer-counter');
                    if (notification) notification.remove();
                    if (counter) counter.remove();
                });
            } catch (e) {
                // Page might be closed
            }
        }

        return await super.stopRecording();
    }
}

module.exports = PuppeteerRecorderWithUI;

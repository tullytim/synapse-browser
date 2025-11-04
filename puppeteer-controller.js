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

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// TEMPORARILY DISABLE stealth plugin - it might conflict with our preload script
// Our webview-preload.js is more comprehensive anyway
// puppeteer.use(StealthPlugin());

const DEFAULT_DEBUG_PORT = parseInt(process.env.DEBUG_PORT || process.env.REMOTE_DEBUG_PORT || '9222', 10) || 9222;

class PuppeteerController {
    constructor() {
        this.browser = null;
        this.page = null;
        this.debugPort = DEFAULT_DEBUG_PORT; // Default Chrome DevTools port
        this.successfulSelectors = new Map(); // Track successful selectors for reuse
    }

    /**
     * Connect to an existing Chrome/Chromium instance
     * @param {number} port - The debugging port
     */
    async connect(port = this.debugPort) {
        try {
            // Connect to the browser instance
            this.browser = await puppeteer.connect({
                browserURL: `http://127.0.0.1:${port}`,
                defaultViewport: null
            });

            // Get all pages
            const pages = await this.browser.pages();

            // Use the first page or create a new one
            this.page = pages[0] || await this.browser.newPage();

            // Apply additional anti-detection measures
            await this.applyAntiDetection();

            return true;
        } catch (error) {
            console.error('❌ Failed to connect puppeteer:', error);
            return false;
        }
    }

    /**
     * Connect directly to a webview's debugger URL
     * @param {string} debuggerUrl - The webview's debugger URL
     */
    async connectToWebview(debuggerUrl) {
        try {
            // Connect directly to the page
            this.browser = await puppeteer.connect({
                browserWSEndpoint: debuggerUrl,
                defaultViewport: null
            });

            // Get the page
            const pages = await this.browser.pages();
            this.page = pages[0];

            // Apply additional anti-detection measures
            await this.applyAntiDetection();

            return true;
        } catch (error) {
            console.error('❌ Failed to connect to webview:', error);
            return false;
        }
    }

    /**
     * Apply additional anti-detection measures beyond stealth plugin
     *
     * NOTE: For automation windows created with BrowserWindow + preload,
     * the webview-preload.js is already applied via Electron's preload mechanism.
     * We DON'T need to inject it again via evaluateOnNewDocument() as that causes
     * double-execution and "Cannot redefine property" errors.
     *
     * This method now just verifies the preload script is working.
     */
    async applyAntiDetection() {
        if (!this.page) return;

        try {
            const currentUrl = this.page.url();
            console.log(`[Anti-Detection] Checking page at: ${currentUrl}`);

            // Verify the Electron preload script is working
            const canAccessPage = await this.page.evaluate(() => true).catch(() => false);
            if (canAccessPage) {
                console.log('[Anti-Detection] ✓ Page is accessible');

                // Check if preload already ran (from Electron's preload mechanism)
                const preloadLoaded = await this.page.evaluate(() => window.__SYNAPSE_PRELOAD_LOADED__).catch(() => false);
                if (preloadLoaded) {
                    console.log('[Anti-Detection] ✓ Electron preload script confirmed loaded');
                } else {
                    console.warn('[Anti-Detection] ⚠️ Preload script marker not found - preload may not have run yet');
                }
            } else {
                console.warn('[Anti-Detection] ⚠️ Cannot access page - might be a timing issue');
            }
        } catch (error) {
            console.error('[Anti-Detection] ❌ Error checking anti-detection:', error.message);
        }
    }

    /**
     * Set the current page and apply anti-detection measures
     * Use this instead of directly setting this.page to ensure anti-detection is applied
     */
    async setPage(page) {
        this.page = page;
        await this.applyAntiDetection();
    }

    /**
     * Navigate to a URL
     */
    async goto(url) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        console.log(`[Navigation] → ${url}`);
        const response = await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Verify anti-detection script ran and check for issues
        try {
            const diagnostics = await this.page.evaluate(() => {
                return {
                    preloadLoaded: window.__SYNAPSE_PRELOAD_LOADED__,
                    webdriver: navigator.webdriver,
                    cdcKeys: Object.keys(window).filter(k => k.includes('cdc') || k.includes('puppeteer') || k.includes('playwright')),
                    chrome: !!window.chrome,
                    chromeRuntime: !!window.chrome?.runtime,
                    plugins: navigator.plugins.length
                };
            });

            console.log('[Navigation] ✓ Page loaded. Diagnostics:', JSON.stringify(diagnostics, null, 2));

            if (!diagnostics.preloadLoaded) {
                console.error('[Navigation] ❌ CRITICAL: Preload script did NOT run on this page!');
            }
            if (diagnostics.webdriver !== false) {
                console.error('[Navigation] ❌ CRITICAL: navigator.webdriver is not false:', diagnostics.webdriver);
            }
            if (diagnostics.cdcKeys.length > 0) {
                console.error('[Navigation] ❌ CRITICAL: CDP markers found:', diagnostics.cdcKeys);
            }
        } catch (e) {
            console.warn('[Navigation] ⚠️ Could not run diagnostics:', e.message);
        }

        return response;
    }

    /**
     * Validate if a selector is too generic/broad
     */
    isSelectorTooGeneric(selector) {
        const genericSelectors = ['div', 'span', 'p', 'a', 'button', 'input', 'img', 'ul', 'li', 'table', 'tr', 'td'];

        // Check direct selector
        if (genericSelectors.includes(selector.toLowerCase())) {
            return true;
        }

        // Check XPath selectors like //div, //span, etc.
        if (selector.startsWith('//')) {
            const tagName = selector.substring(2).split('[')[0].split('/')[0].toLowerCase();
            if (genericSelectors.includes(tagName)) {
                return true;
            }
        }

        // Check for single tag selectors in alternative forms
        const singleTagPattern = /^\/\/([a-z]+)$/i;
        const match = selector.match(singleTagPattern);
        if (match && genericSelectors.includes(match[1].toLowerCase())) {
            return true;
        }

        return false;
    }

    /**
     * Click an element
     * @param {string} selector - CSS selector or XPath
     */
    async click(selector) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        // Skip overly generic selectors
        if (this.isSelectorTooGeneric(selector)) {
            console.warn(`⚠️ Warning: Generic selector detected: ${selector} - continuing anyway for debugging`);
            // Don't throw error for now - just log warning
        }

        // Convert Playwright text selector to XPath if needed
        let actualSelector = selector;
        if (selector.startsWith('text=')) {
            // Remove text= prefix and handle quotes properly
            let text = selector.substring(5);
            // Remove surrounding quotes if present
            if ((text.startsWith('"') && text.endsWith('"')) ||
                (text.startsWith("'") && text.endsWith("'"))) {
                text = text.slice(1, -1);
            }
            // Use normalize-space to handle whitespace and make it more robust
            actualSelector = `//*[normalize-space(text())='${text}' or normalize-space()='${text}']`;
        }

        // Handle jQuery :eq() pseudo-selector and /*positional*/ comments
        if (selector.includes(':eq(') || selector.includes('/*positional*/')) {
            // Remove /*positional*/ comment first
            actualSelector = actualSelector.replace(/\/\*positional\*\//g, '');

            // Convert :eq(n) to :nth-child(n+1) since :eq is 0-based and :nth-child is 1-based
            actualSelector = actualSelector.replace(/:eq\((\d+)\)/g, (match, index) => {
                const nthIndex = parseInt(index) + 1;
                return `:nth-child(${nthIndex})`;
            });

        }

        try {
            // Check if it's an XPath or CSS selector
            if (actualSelector.startsWith('//') || actualSelector.startsWith('(//')) {
                // XPath - click using evaluate with retry logic
                let clicked = false;
                let retries = 0;
                const maxRetries = 3;

                while (!clicked && retries < maxRetries) {
                    try {
                        clicked = await this.page.evaluate((xpath) => {
                            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                            const element = result.singleNodeValue;
                            if (!element) return false;
                            element.click();
                            return true;
                        }, actualSelector);

                        if (!clicked && retries < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            retries++;
                        }
                    } catch (error) {
                        if (error.message.includes('detached Frame') && retries < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            retries++;
                        } else {
                            throw error;
                        }
                    }
                }

                if (!clicked) {
                    throw new Error(`No element found for XPath: ${actualSelector}`);
                }
            } else {
                // CSS selector - handle special cases
                // Check if it's an aria-label selector
                if (actualSelector.includes('[aria-label=')) {
                    // For aria-label selectors, use evaluate for more reliable clicking
                    const clicked = await this.page.evaluate((selector) => {
                        const element = document.querySelector(selector);
                        if (!element) return false;
                        element.click();
                        return true;
                    }, actualSelector);

                    if (!clicked) {
                        throw new Error(`No element found for selector: ${actualSelector}`);
                    }
                } else if (actualSelector.includes('.') && actualSelector.split('.').length > 2) {
                    // Multiple class selector - might need special handling
                    // Try to wait and click, but be prepared for failure
                    try {
                        await this.page.waitForSelector(actualSelector, {
                            visible: true,
                            timeout: 3000
                        });
                        await this.page.click(actualSelector);
                    } catch (e) {
                        // If multi-class fails, try using evaluate
                        const clicked = await this.page.evaluate((selector) => {
                            const element = document.querySelector(selector);
                            if (!element) return false;
                            element.click();
                            return true;
                        }, actualSelector);

                        if (!clicked) {
                            throw new Error(`No element found for multi-class selector: ${actualSelector}`);
                        }
                    }
                } else {
                    // Regular CSS selector
                    await this.page.waitForSelector(actualSelector, {
                        visible: true,
                        timeout: 5000
                    });
                    await this.page.click(actualSelector);
                }
            }
            return true;
        } catch (error) {
            // Try alternative selectors
            const alternativeSelectors = this.generateAlternativeSelectors(selector);

            for (const altSelector of alternativeSelectors) {
                // Skip generic alternative selectors too
                if (this.isSelectorTooGeneric(altSelector)) {
                    console.warn(`⚠️ Skipping generic alternative selector: ${altSelector}`);
                    continue;
                }

                try {
                    if (altSelector.startsWith('//') || altSelector.startsWith('(//')) {
                        // XPath
                        const elements = await this.page.$x(altSelector);
                        if (elements.length > 0) {
                            await elements[0].click();
                            this.successfulSelectors.set(selector, altSelector); // Remember this worked
                            return true;
                        }
                    } else {
                        // CSS selector
                        await this.page.waitForSelector(altSelector, {
                            visible: true,
                            timeout: 2000
                        });
                        await this.page.click(altSelector);
                        this.successfulSelectors.set(selector, altSelector); // Remember this worked
                        return true;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            throw new Error(`Failed to click: ${selector} - ${error.message}`);
        }
    }

    /**
     * Type text into an element
     * @param {string} selector - CSS selector or XPath
     * @param {string} text - Text to type
     */
    async type(selector, text) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        // Check if we have a successful selector for this pattern
        if (this.successfulSelectors.has(selector)) {
            const successfulSelector = this.successfulSelectors.get(selector);
            try {
                if (successfulSelector.startsWith('//') || successfulSelector.startsWith('(//')) {
                    // XPath - use evaluate to type
                    const typed = await this.page.evaluate((xpath, textToType) => {
                        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        const element = result.singleNodeValue;
                        if (!element) return false;
                        element.focus();
                        element.value = '';
                        element.value = textToType;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }, successfulSelector, text);

                    if (typed) {
                        return true;
                    }
                } else {
                    // CSS selector
                    await this.page.waitForSelector(successfulSelector, { visible: true, timeout: 2000 });
                    await this.page.focus(successfulSelector);
                    await this.page.evaluate(sel => document.querySelector(sel).value = '', successfulSelector);
                    await this.page.type(successfulSelector, text);
                    return true;
                }
            } catch (error) {
                console.warn(`⚠️ Cached selector failed, falling back to normal logic: ${error.message}`);
            }
        }

        // Convert Playwright text selector to XPath if needed
        let actualSelector = selector;
        if (selector.startsWith('text=')) {
            const textContent = selector.substring(5).replace(/"/g, '');
            actualSelector = `//*[contains(text(), '${textContent}')]`;
        }

        // Handle jQuery :eq() pseudo-selector and /*positional*/ comments
        if (selector.includes(':eq(') || selector.includes('/*positional*/')) {
            // Remove /*positional*/ comment first
            actualSelector = actualSelector.replace(/\/\*positional\*\//g, '');

            // Convert :eq(n) to :nth-child(n+1) since :eq is 0-based and :nth-child is 1-based
            actualSelector = actualSelector.replace(/:eq\((\d+)\)/g, (match, index) => {
                const nthIndex = parseInt(index) + 1;
                return `:nth-child(${nthIndex})`;
            });

        }

        try {
            // Handle XPath vs CSS selector
            if (actualSelector.startsWith('//') || actualSelector.startsWith('(//')) {
                // XPath - use evaluate to type into element
                const typed = await this.page.evaluate((xpath, textToType) => {
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    const element = result.singleNodeValue;
                    if (!element) return false;

                    // Focus the element
                    element.focus();

                    // Clear the current value
                    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                        // Select all text
                        if (element.select) {
                            element.select();
                        }
                        element.value = textToType;

                        // Trigger input and change events
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    } else if (element.contentEditable === 'true') {
                        // For contenteditable elements
                        element.textContent = textToType;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        // Try to click and type
                        element.click();
                        return false; // Will fall back to keyboard typing
                    }

                    return true;
                }, actualSelector, text);

                if (!typed) {
                    // Fallback: try clicking and using keyboard
                    const clicked = await this.page.evaluate((xpath) => {
                        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        const element = result.singleNodeValue;
                        if (!element) return false;
                        element.click();
                        element.focus();
                        return true;
                    }, actualSelector);

                    if (clicked) {
                        // Clear existing text with triple click and type
                        await this.page.keyboard.down('Control');
                        await this.page.keyboard.press('a');
                        await this.page.keyboard.up('Control');
                        await this.page.keyboard.type(text);
                    } else {
                        throw new Error(`No element found for XPath: ${actualSelector}`);
                    }
                }
            } else {
                // CSS selector
                await this.page.waitForSelector(actualSelector, {
                    visible: true,
                    timeout: 5000
                });
                await this.page.click(actualSelector, { clickCount: 3 }); // Select all
                await this.page.type(actualSelector, text);
            }
            return true;
        } catch (error) {
            // Try alternative selectors
            const alternativeSelectors = this.generateAlternativeSelectors(selector);

            for (const altSelector of alternativeSelectors) {
                // Skip generic alternative selectors too
                if (this.isSelectorTooGeneric(altSelector)) {
                    console.warn(`⚠️ Skipping generic alternative selector: ${altSelector}`);
                    continue;
                }

                try {
                    if (altSelector.startsWith('//') || altSelector.startsWith('(//')) {
                        // XPath alternative
                        const typed = await this.page.evaluate((xpath, textToType) => {
                            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                            const element = result.singleNodeValue;
                            if (!element) return false;

                            element.focus();
                            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                                element.select();
                                element.value = textToType;
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                return true;
                            }
                            return false;
                        }, altSelector, text);

                        if (typed) {
                            return true;
                        }
                    } else {
                        // CSS selector alternative
                        await this.page.waitForSelector(altSelector, {
                            visible: true,
                            timeout: 2000
                        });
                        await this.page.click(altSelector, { clickCount: 3 });
                        await this.page.type(altSelector, text);
                        return true;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            throw new Error(`Failed to type: ${selector} - ${error.message}`);
        }
    }

    /**
     * Hover over an element
     * @param {string} selector - CSS selector or XPath
     */
    async hover(selector) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        // Skip overly generic selectors
        if (this.isSelectorTooGeneric(selector)) {
            console.warn(`⚠️ Warning: Generic hover selector detected: ${selector} - continuing anyway for debugging`);
            // Don't throw error for now - just log warning
        }

        // Convert Playwright text selector to XPath if needed
        let actualSelector = selector;
        if (selector.startsWith('text=')) {
            // Remove text= prefix and handle quotes properly
            let text = selector.substring(5);
            // Remove surrounding quotes if present
            if ((text.startsWith('"') && text.endsWith('"')) ||
                (text.startsWith("'") && text.endsWith("'"))) {
                text = text.slice(1, -1);
            }
            // Use normalize-space to handle whitespace and make it more robust
            actualSelector = `//*[normalize-space(text())='${text}' or normalize-space()='${text}']`;
        }

        // Handle jQuery :eq() pseudo-selector and /*positional*/ comments
        if (selector.includes(':eq(') || selector.includes('/*positional*/')) {
            // Remove /*positional*/ comment first
            actualSelector = actualSelector.replace(/\/\*positional\*\//g, '');

            // Convert :eq(n) to :nth-child(n+1) since :eq is 0-based and :nth-child is 1-based
            actualSelector = actualSelector.replace(/:eq\((\d+)\)/g, (match, index) => {
                const nthIndex = parseInt(index) + 1;
                return `:nth-child(${nthIndex})`;
            });

        }

        try {
            // Try XPath first if it looks like one
            if (actualSelector.startsWith('//') || actualSelector.startsWith('(//')) {
                // For XPath, use evaluate to perform the hover action directly
                const hovered = await this.page.evaluate((xpath) => {
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    const element = result.singleNodeValue;
                    if (!element) return false;

                    // Trigger hover event
                    const mouseEvent = new MouseEvent('mouseover', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(mouseEvent);

                    // Also trigger mouseenter for completeness
                    const mouseEnterEvent = new MouseEvent('mouseenter', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    element.dispatchEvent(mouseEnterEvent);

                    return true;
                }, actualSelector);

                if (!hovered) {
                    throw new Error('No element found for XPath');
                }

                // Wait for potential dynamic content to appear after hover
                await new Promise(resolve => setTimeout(resolve, 500));
                return true;
            } else {
                // Try CSS selector
                await this.page.waitForSelector(actualSelector, {
                    visible: true,
                    timeout: 5000
                });
                await this.page.hover(actualSelector);

                // Wait for potential dynamic content to appear after hover
                await new Promise(resolve => setTimeout(resolve, 500));
                return true;
            }
        } catch (error) {
            // Try alternative selectors
            const alternativeSelectors = this.generateAlternativeSelectors(selector);

            for (const altSelector of alternativeSelectors) {
                // Skip generic alternative selectors too
                if (this.isSelectorTooGeneric(altSelector)) {
                    console.warn(`⚠️ Skipping generic alternative selector: ${altSelector}`);
                    continue;
                }

                try {
                    if (altSelector.startsWith('//') || altSelector.startsWith('(//')) {
                        const elements = await this.page.$x(altSelector);
                        if (elements.length > 0) {
                            await elements[0].hover();

                            // Wait for potential dynamic content to appear after hover
                            await new Promise(resolve => setTimeout(resolve, 500));
                            return true;
                        }
                    } else {
                        await this.page.waitForSelector(altSelector, {
                            visible: true,
                            timeout: 2000
                        });
                        await this.page.hover(altSelector);

                        // Wait for potential dynamic content to appear after hover
                        await new Promise(resolve => setTimeout(resolve, 500));
                        return true;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            throw new Error(`Failed to hover: ${selector} - ${error.message}`);
        }
    }

    /**
     * Press a keyboard key
     * @param {string} key - Key to press (e.g., 'Enter', 'Tab')
     */
    async press(key) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        await this.page.keyboard.press(key);
        return true;
    }

    /**
     * Select an option from a dropdown
     * @param {string} selector - CSS selector or XPath for the select element
     * @param {string} value - Value to select
     */
    async select(selector, value) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        try {
            // Check if it's an XPath or CSS selector
            if (selector.startsWith('//') || selector.startsWith('(//')) {
                // XPath - use evaluate to select option
                const selected = await this.page.evaluate((xpath, val) => {
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    const element = result.singleNodeValue;
                    if (!element) return false;

                    if (element.tagName === 'SELECT') {
                        element.value = val;
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                }, selector, value);

                if (!selected) {
                    throw new Error(`No select element found for XPath: ${selector}`);
                }
            } else {
                // CSS selector
                await this.page.select(selector, value);
            }

            return true;
        } catch (error) {
            throw new Error(`Failed to select in ${selector}: ${error.message}`);
        }
    }

    /**
     * Wait for navigation
     */
    async waitForNavigation(options = {}) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        return await this.page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 30000,
            ...options
        });
    }

    /**
     * Wait for a selector to appear
     * @param {string} selector - CSS selector or XPath
     * @param {number} timeout - Timeout in milliseconds
     */
    async waitForSelector(selector, timeout = 5000) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        // Check if it's an XPath
        if (selector.startsWith('//') || selector.startsWith('(//')) {
            // Poll for XPath element with frame-safe evaluation
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                try {
                    const found = await this.page.evaluate((xpath) => {
                        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        const element = result.singleNodeValue;
                        if (!element) return false;

                        // Check if visible
                        const rect = element.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0;
                    }, selector);

                    if (found) {
                        return true;
                    }
                } catch (error) {
                    // If frame is detached, continue waiting
                    if (error.message.includes('detached Frame')) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }
            throw new Error(`Timeout waiting for XPath: ${selector}`);
        } else {
            // CSS selector with retry logic
            try {
                return await this.page.waitForSelector(selector, {
                    visible: true,
                    timeout
                });
            } catch (error) {
                if (error.message.includes('detached Frame')) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return await this.page.waitForSelector(selector, {
                        visible: true,
                        timeout: timeout - 500 // Reduce timeout for retry
                    });
                }
                throw error;
            }
        }
    }

    /**
     * Evaluate JavaScript in the page context
     * @param {Function|string} fn - Function or string to evaluate
     * @param {...any} args - Arguments to pass to the function
     */
    async evaluate(fn, ...args) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        return await this.page.evaluate(fn, ...args);
    }

    /**
     * Take a screenshot
     * @param {string} path - Path to save the screenshot
     */
    async screenshot(path) {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        await this.page.screenshot({ path, fullPage: true });
        return true;
    }

    /**
     * Generate alternative selectors for better element finding
     * @param {string} selector - Original selector
     */
    generateAlternativeSelectors(selector) {
        const alternatives = [];

        // Handle aria-label selectors first (high priority)
        if (selector.includes('[aria-label=')) {
            const labelMatch = selector.match(/\[aria-label="([^"]+)"\]/);
            if (labelMatch) {
                const label = labelMatch[1];
                // Try different variations
                alternatives.push(
                    `//*[@aria-label="${label}"]`, // XPath version
                    `*[aria-label="${label}"]`,
                    `[aria-label="${label}"]`,
                    `button[aria-label="${label}"]`,
                    `a[aria-label="${label}"]`,
                    `input[aria-label="${label}"]`
                );
            }
        }

        // Handle multi-class selectors (.class1.class2.class3)
        if (selector.startsWith('.') && !selector.includes(' ') && !selector.includes('[')) {
            const classes = selector.substring(1).split('.');
            if (classes.length > 1) {
                // Try using just the first class
                alternatives.push(`.${classes[0]}`);
                // Try using just the last class (often more specific)
                alternatives.push(`.${classes[classes.length - 1]}`);
                // Try as attribute selector with all classes
                alternatives.push(`[class="${classes.join(' ')}"]`);
                // Try XPath with all classes
                const xpathClasses = classes.map(c => `contains(@class, "${c}")`).join(' and ');
                alternatives.push(`//*[${xpathClasses}]`);
            }
        }

        // Handle Playwright text selectors
        if (selector.startsWith('text=')) {
            const text = selector.substring(5).replace(/"/g, '');
            // Order from most specific to least specific
            // Avoid overly generic selectors like 'div' and 'span'
            alternatives.push(
                `//button[contains(text(), '${text}')]`,
                `//a[contains(text(), '${text}')]`,
                `//input[@value='${text}']`,
                `//label[contains(text(), '${text}')]`,
                `//h1[contains(text(), '${text}')]`,
                `//h2[contains(text(), '${text}')]`,
                `//h3[contains(text(), '${text}')]`,
                `//li[contains(text(), '${text}')]`,
                `//td[contains(text(), '${text}')]`,
                `//th[contains(text(), '${text}')]`,
                `//*[@title='${text}']`,
                `//*[@aria-label='${text}']`,
                `//*[contains(text(), '${text}')]`,
                `//*[contains(., '${text}')]`
            );
            return alternatives;
        }

        // Handle XPath selectors - try both input and textarea
        if (selector.startsWith('//input[@name=') || selector.includes('//input[')) {
            // Try replacing input with textarea
            const textareaSelector = selector.replace('//input', '//textarea');
            alternatives.push(textareaSelector);
        }

        // If it's a name selector, try different variations
        if (selector.includes('[name=') || selector.includes('name=')) {
            const nameMatch = selector.match(/name=["']?([^"'\]]+)["']?\]?/);
            if (nameMatch) {
                const name = nameMatch[1];
                alternatives.push(
                    `input[name="${name}"]`,
                    `textarea[name="${name}"]`,
                    `select[name="${name}"]`,
                    `[name="${name}"]`
                );
            }
        }

        // If it's an ID selector, try without # and as attribute
        if (selector.startsWith('#')) {
            const id = selector.substring(1).split('.')[0]; // Handle #id.class cases
            alternatives.push(
                `[id="${id}"]`,
                `//*[@id="${id}"]` // XPath version
            );
        }

        // If it contains placeholder
        if (selector.includes('placeholder=')) {
            const placeholderMatch = selector.match(/placeholder=["']?([^"']+)["']?/);
            if (placeholderMatch) {
                const placeholder = placeholderMatch[1];
                alternatives.push(
                    `input[placeholder="${placeholder}"]`,
                    `textarea[placeholder="${placeholder}"]`,
                    `[placeholder*="${placeholder}"]`
                );
            }
        }

        return alternatives;
    }

    /**
     * Find element by text content
     * @param {string} text - Text to search for
     * @param {string} tagName - Optional tag name to filter
     */
    async findByText(text, tagName = '*') {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }

        const element = await this.page.evaluateHandle((text, tag) => {
            const elements = document.querySelectorAll(tag);
            for (const el of elements) {
                if (el.textContent && el.textContent.trim() === text) {
                    return el;
                }
            }
            return null;
        }, text, tagName);

        return element;
    }

    /**
     * Disconnect from the browser
     */
    async disconnect() {
        // Close the page first if it exists
        if (this.page) {
            try {
                // Check if page is still valid before closing
                if (!this.page.isClosed()) {
                    await this.page.close();
                }
            } catch (error) {
                console.warn('Page already closed or invalid:', error.message);
            }
            this.page = null;
        }

        // Then disconnect from the browser
        if (this.browser) {
            try {
                await this.browser.disconnect();
            } catch (error) {
                console.warn('Browser disconnect error:', error.message);
            }
            this.browser = null;
        }

        // Clear any cached selectors
        this.successfulSelectors.clear();
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.browser && this.browser.isConnected();
    }

    /**
     * Get current URL
     */
    async getUrl() {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }
        return await this.page.url();
    }

    /**
     * Get page title
     */
    async getTitle() {
        if (!this.page) {
            throw new Error('Not connected to any page');
        }
        return await this.page.title();
    }
}

module.exports = PuppeteerController;

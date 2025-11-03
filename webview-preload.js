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

// Webview preload script - runs before any page content
// This ensures anti-bot measures are applied before detection scripts run
(function() {
    'use strict';

    // Set a marker to verify the preload script ran (in a non-detectable way)
    // Store in a closure variable instead of exposing on window
    const __SYNAPSE_PRELOAD_LOADED__ = true;

    // Disable WebAuthn API to prevent sites from detecting hardware key support
    // This prevents sites from requiring MFA keys when the browser can't actually use them
    // NOTE: navigator.credentials override DISABLED - it breaks nytimes.com and other sites
    // that use the Credentials Management API for password/login features
    /*
    if (navigator.credentials) {
        try {
            Object.defineProperty(navigator, 'credentials', {
                get: () => undefined,
                configurable: false
            });
        } catch (e) {
            // If we can't override, at least try to remove the methods
            try {
                delete navigator.credentials;
            } catch (e2) {
                // Could not disable WebAuthn API
            }
        }
    }
    */

    // Also remove PublicKeyCredential if it exists
    if (window.PublicKeyCredential) {
        try {
            window.PublicKeyCredential = undefined;
            delete window.PublicKeyCredential;
        } catch (e) {
            // Could not remove PublicKeyCredential
        }
    }

    // Dark mode - expose activation function and check flag
    // TEMPORARILY DISABLED TO DEBUG NYTIMES ISSUE
    window.__activateDarkMode = function() {
        // Whitelist: Don't apply dark mode to these domains
        const hostname = window.location.hostname;
        const darkModeWhitelist = [
            'docs.google.com',
            'slides.google.com'
        ];

        const isWhitelisted = darkModeWhitelist.some(domain => hostname.includes(domain));

        // Gmail-specific: compute once at initialization to avoid repeated checks
        const isGmail = hostname.includes('mail.google.com');

        if (isWhitelisted) {
            return;
        }

        // Check if already activated
        if (document.getElementById('dark-mode-enforcer-preload')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'dark-mode-enforcer-preload';
        style.textContent = `
            html {
                background-color: #484848 !important;
                color-scheme: dark !important;
            }
            body {
                background-color: #484848 !important;
                color: #e0e0e0 !important;
            }
            /* Universal dark background - excludes only media and elements with background images */
            /* REMOVED: This was too aggressive and made images invisible against dark backgrounds */
            /* Instead, we target specific elements below */
            /* *:not(video):not(iframe):not(img):not(canvas):not(svg):not(picture):not([style*="background-image"]):not([style*="background: url"]):not([class*="video"]):not([id*="video"]) {
                background-color: #484848 !important;
            } */
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
                --color-background: #484848 !important;
                --background-color: #484848 !important;
                --bg-color: #484848 !important;
                --surface-color: #484848 !important;

                /* Force color-scheme */
                color-scheme: dark !important;
            }
            /* REMOVED - was causing gray blocks over videos */
            /* div, section, article, main, aside, header, footer, nav {
                background-color: #484848;
                color: #e0e0e0;
            } */
            /* Override white/light backgrounds specifically */
            /* BUT exclude buttons to prevent blocking video controls */
            [style*="background-color: #fff"]:not(button):not([role="button"]),
            [style*="background-color: white"]:not(button):not([role="button"]),
            [style*="background-color: #ffffff"]:not(button):not([role="button"]),
            [style*="background-color: #FFF"]:not(button):not([role="button"]),
            [style*="background-color: White"]:not(button):not([role="button"]),
            [style*="background-color: #FFFFFF"]:not(button):not([role="button"]),
            [style*="background: #fff"]:not(button):not([role="button"]),
            [style*="background: white"]:not(button):not([role="button"]),
            [style*="background: #ffffff"]:not(button):not([role="button"]),
            [style*="background: #FFF"]:not(button):not([role="button"]),
            [style*="background: White"]:not(button):not([role="button"]),
            [style*="background: #FFFFFF"]:not(button):not([role="button"]),
            [style*="background-color:white"]:not(button):not([role="button"]),
            [style*="background-color:#fff"]:not(button):not([role="button"]),
            [style*="background-color:#ffffff"]:not(button):not([role="button"]),
            [style*="background:white"]:not(button):not([role="button"]),
            [style*="background:#fff"]:not(button):not([role="button"]),
            [style*="background:#ffffff"]:not(button):not([role="button"]),
            [style*="background-color: rgb(255, 255, 255)"]:not(button):not([role="button"]),
            [style*="background-color:rgb(255,255,255)"]:not(button):not([role="button"]),
            [style*="background: rgb(255, 255, 255)"]:not(button):not([role="button"]),
            [style*="background:rgb(255,255,255)"]:not(button):not([role="button"]),
            [style*="background-color: rgba(255, 255, 255"]:not(button):not([role="button"]),
            [style*="background-color:rgba(255,255,255"]:not(button):not([role="button"]),
            [style*="background: rgba(255, 255, 255"]:not(button):not([role="button"]),
            [style*="background:rgba(255,255,255"]:not(button):not([role="button"]) {
                background-color: #484848 !important;
            }
            /* Catch very light grays that are essentially white */
            [style*="background-color: rgb(254"]:not(button):not([role="button"]),
            [style*="background-color: rgb(253"]:not(button):not([role="button"]),
            [style*="background-color: rgb(252"]:not(button):not([role="button"]),
            [style*="background-color: rgb(251"]:not(button):not([role="button"]),
            [style*="background-color: rgb(250"]:not(button):not([role="button"]),
            [style*="background-color: rgb(249"]:not(button):not([role="button"]),
            [style*="background-color: rgb(248"]:not(button):not([role="button"]),
            [style*="background: rgb(254"]:not(button):not([role="button"]),
            [style*="background: rgb(253"]:not(button):not([role="button"]),
            [style*="background: rgb(252"]:not(button):not([role="button"]),
            [style*="background: rgb(251"]:not(button):not([role="button"]),
            [style*="background: rgb(250"]:not(button):not([role="button"]),
            [style*="background: rgb(249"]:not(button):not([role="button"]),
            [style*="background: rgb(248"]:not(button):not([role="button"]) {
                background-color: #484848 !important;
            }
            /* Catch light gray and off-white backgrounds */
            /* BUT DON'T touch RGB colors - they might be colored events */
            /* AND exclude buttons to prevent blocking video controls */
            [style*="background-color: #f"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background: #f"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background-color: #e"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background: #e"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background-color: #d"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background: #d"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background-color: #c"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background: #c"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background-color: #b"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background: #b"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background-color: #a"]:not([style*="rgb"]):not(button):not([role="button"]),
            [style*="background: #a"]:not([style*="rgb"]):not(button):not([role="button"]) {
                background-color: #3d3d3d !important;
            }
            /* Catch common white/light background classes */
            [class*="bg-white"]:not(button):not([role="button"]),
            [class*="bg-light"]:not(button):not([role="button"]),
            [class*="background-white"]:not(button):not([role="button"]),
            [class*="background-light"]:not(button):not([role="button"]),
            [class*="BackgroundWhite"]:not(button):not([role="button"]),
            [class*="BackgroundLight"]:not(button):not([role="button"]) {
                background-color: #484848 !important;
            }
            /* NUCLEAR: Force section tags to be dark with maximum specificity */
            /* But exclude elements with native dark mode markers (including dynamically added class) */
            html section:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            body section:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                background: #484848 !important;
                background-color: #484848 !important;
            }
            /* Force section tags with any selector to be dark */
            section:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                background: #484848 !important;
                background-color: #484848 !important;
            }
            section[style]:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section[class]:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                background: #484848 !important;
                background-color: #484848 !important;
            }
            section[id]:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section[role]:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                background: #484848 !important;
                background-color: #484848 !important;
            }
            /* Also force divs with same aggression */
            /* BUT exclude divs that contain, are siblings of, or are near video/iframe elements */
            /* Also exclude divs with overlay/layer classes or data attributes */
            /* Also exclude video player controls like progress bars and scrubbers */
            /* Also exclude elements with native dark mode markers (data attributes or dynamically added class) */
            html div:not(:has(video)):not(:has(iframe)):not(video ~ *):not(iframe ~ *):not(:has(~ video)):not(:has(~ iframe)):not([class*="overlay"]):not([id*="overlay"]):not([data-layer]):not([class*="progress"]):not([class*="scrubber"]):not([class*="chapter"]):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            body div:not(:has(video)):not(:has(iframe)):not(video ~ *):not(iframe ~ *):not(:has(~ video)):not(:has(~ iframe)):not([class*="overlay"]):not([id*="overlay"]):not([data-layer]):not([class*="progress"]):not([class*="scrubber"]):not([class*="chapter"]):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                background-color: #484848 !important;
            }
            div:not(:has(video)):not(:has(iframe)):not(video ~ *):not(iframe ~ *):not(:has(~ video)):not(:has(~ iframe)):not([class*="overlay"]):not([id*="overlay"]):not([data-layer]):not([class*="progress"]):not([class*="scrubber"]):not([class*="chapter"]):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                background-color: #484848 !important;
            }
            div[style]:not(:has(video)):not(:has(iframe)):not(video ~ *):not(iframe ~ *):not(:has(~ video)):not(:has(~ iframe)):not([class*="overlay"]):not([id*="overlay"]):not([data-layer]):not([class*="progress"]):not([class*="scrubber"]):not([class*="chapter"]):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div[class]:not(:has(video)):not(:has(iframe)):not(video ~ *):not(iframe ~ *):not(:has(~ video)):not(:has(~ iframe)):not([class*="overlay"]):not([id*="overlay"]):not([data-layer]):not([class*="progress"]):not([class*="scrubber"]):not([class*="chapter"]):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                background-color: #484848 !important;
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
                background-color: #3d3d3d !important;
            }
            /* ALL elements with ANY background color must have light text */
            [style*="background-color"],
            [style*="background:"],
            [style*="background-image"] {
                color: #ffffff !important;
            }
            /* Spans, divs, and sections with backgrounds need light text */
            span[style*="background"],
            div[style*="background"],
            section[style*="background"],
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
            /* But exclude elements with native dark mode markers (including dynamically added class) */
            p:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            span:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h1:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h2:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h3:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h4:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h5:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h6:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            li:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            td:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            th:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            label:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            b:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            strong:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            em:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            i:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            article:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            aside:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            header:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            footer:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            nav:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            main:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            blockquote:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            pre:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            code:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            kbd:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            samp:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            var:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            mark:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            small:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            sub:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            sup:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            dd:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            dt:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            figcaption:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            caption:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            legend:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            address:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            time:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                color: #e0e0e0 !important;
            }
            /* Specifically target bold elements and headings with important */
            /* But exclude elements with native dark mode markers */
            b:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            strong:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                color: #e0e0e0 !important;
            }
            h1:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h2:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h3:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h4:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h5:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h6:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                color: #e0e0e0 !important;
            }
            /* Extra specificity for stubborn headings */
            body h1:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            body h2:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            body h3:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            body h4:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            body h5:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            body h6:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                color: #e0e0e0 !important;
                background-color: transparent !important;
            }
            article h1:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            article h2:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            article h3:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            article h4:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            article h5:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            article h6:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section h1:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section h2:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section h3:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section h4:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section h5:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            section h6:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div h1:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div h2:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div h3:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div h4:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div h5:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            div h6:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                color: #e0e0e0 !important;
                background-color: transparent !important;
            }
            /* Override any background on headings to be dark */
            h1:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h2:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h3:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h4:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h5:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            h6:not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
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
            /* REMOVED - was causing z-index stacking issues */
            /* a {
                position: relative !important;
                z-index: 1 !important;
            } */
            /* Don't modify pointer-events on overlays - let them work naturally */
            /* REMOVED video from opacity rule - don't touch videos at all */
            /* REMOVED img, picture, and svg - don't apply dark mode opacity to images */
            canvas {
                opacity: 0.9 !important;
            }
            /* REMOVED - don't apply any CSS to video tags */
            /* video, iframe {
                background: transparent !important;
            }
            *:has(> video), *:has(> iframe) {
                background: transparent !important;
            }
            video {
                display: block !important;
                visibility: visible !important;
            } */
            /* FINAL OVERRIDE - catches everything that slipped through */
            /* Exclude media elements and native dark mode elements from universal selectors */
            body *:not(video):not(img):not(picture):not(canvas):not(svg):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            html *:not(video):not(img):not(picture):not(canvas):not(svg):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode) {
                color: #e0e0e0 !important;
            }
            /* Re-apply link colors after universal selector */
            body a, body a *, html a, html a * {
                color: #88c0ff !important;
            }
            /* ABSOLUTE FINAL TEXT COLOR - comes last to override everything */
            /* Exclude media elements and native dark mode elements from universal selectors */
            *:not(video):not(img):not(picture):not(canvas):not(svg):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode),
            *:not(video):not(img):not(picture):not(canvas):not(svg):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode)::before,
            *:not(video):not(img):not(picture):not(canvas):not(svg):not([data-dark-mode-processed]):not([data-theme*="dark"]):not([data-color-scheme*="dark"]):not(.has-native-dark-mode)::after {
                color: #e0e0e0 !important;
            }
            /* Links must stay blue even after absolute override */
            a, a *, a::before, a::after {
                color: #88c0ff !important;
            }
            /* Keep media elements normal and fully visible */
            /* Ensure images and pictures are fully visible */
            img, picture {
                opacity: 1 !important;
                visibility: visible !important;
                filter: none !important;
                background: transparent !important;
            }
            /* Ensure videos are fully visible and clickable */
            video, iframe {
                opacity: 1 !important;
                visibility: visible !important;
                filter: none !important;
                background: transparent !important;
                display: block !important;
                pointer-events: auto !important;
            }
            /* Ensure video containers don't obscure videos */
            *:has(> video), *:has(> iframe) {
                background: transparent !important;
            }
            /* Ensure video player overlays stay transparent (generic for all players) */
            /* Siblings that come after video/iframe */
            video ~ *, iframe ~ * {
                background: transparent !important;
                background-color: transparent !important;
            }
            /* Siblings that come before video/iframe (like YouTube overlays) */
            *:has(~ video), *:has(~ iframe) {
                background: transparent !important;
                background-color: transparent !important;
            }
            /* Explicitly keep overlay CONTAINERS transparent - but NOT controls inside them */
            html div[class*="overlays-container"], body div[class*="overlays-container"],
            html [class*="overlays-container"], body [class*="overlays-container"] {
                background: transparent !important;
                background-color: transparent !important;
            }
            body canvas,
            html canvas {
                color: unset !important;
                opacity: 0.9 !important;
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
            /* Ensure input fields are readable */
            input, textarea, select {
                background-color: #3d3d3d !important;
                color: #e0e0e0 !important;
                border-color: #555 !important;
            }
            /* Gmail-specific: Improve inbox row visibility */
            tr[role="row"] {
                background-color: #3d3d3d !important;
                border-bottom: 1px solid #555 !important;
            }
            tr[role="row"]:hover {
                background-color: #505050 !important;
            }
            /* Gmail unread emails - make them stand out */
            tr[role="row"].zA, tr[role="row"].zE {
                background-color: #454545 !important;
            }
            /* Gmail table cells */
            td[role="gridcell"] {
                color: #e0e0e0 !important;
            }
            /* Gmail inbox container */
            div[role="main"], div[role="navigation"] {
                background-color: #383838 !important;
            }
            /* Gmail opened email content */
            div[role="article"], div[role="listitem"] {
                background-color: #3d3d3d !important;
                border: 1px solid #555 !important;
                margin: 4px !important;
                padding: 8px !important;
            }
            /* Gmail email body text */
            div[data-message-id] {
                background-color: #404040 !important;
                color: #e0e0e0 !important;
            }
            /* Gmail email headers and metadata */
            span[email], span[data-hovercard-id] {
                color: #b8d4ff !important;
            }
            /* Gmail conversation view */
            div.adn, div.gs {
                background-color: #3d3d3d !important;
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
            div[style*="transparent"], section[style*="transparent"], span[style*="transparent"],
            div[style*="rgba(0, 0, 0, 0)"], section[style*="rgba(0, 0, 0, 0)"], span[style*="rgba(0, 0, 0, 0)"],
            div[style*="rgba(0,0,0,0)"], section[style*="rgba(0,0,0,0)"], span[style*="rgba(0,0,0,0)"] {
                background-color: #484848 !important;
            }
            /* ALL children of elements with backgrounds MUST be white */
            [style*="background-color"]:not(body):not(html) *,
            [style*="background:"]:not(body):not(html) *,
            [style*="background-image"]:not(body):not(html) * {
                color: #ffffff !important;
            }
            /* Extra specificity for divs, sections, and spans with backgrounds */
            div[style*="background"] {
                color: #ffffff !important;
            }
            div[style*="background"] * {
                color: #ffffff !important;
            }
            section[style*="background"] {
                color: #ffffff !important;
            }
            section[style*="background"] * {
                color: #ffffff !important;
            }
            span[style*="background"] {
                color: #ffffff !important;
            }
            span[style*="background"] * {
                color: #ffffff !important;
            }
        `;
        // Insert immediately - before page renders
        const insertStyle = () => {
            if (document.head) {
                document.head.insertBefore(style, document.head.firstChild);
            } else if (document.documentElement) {
                document.documentElement.appendChild(style);
            }
        };

        // Try to insert immediately
        insertStyle();

        // Also listen for DOM ready in case head isn't ready yet
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', insertStyle);
        }

        // RACE CONDITION FIX: Watch for native dark mode attributes being added
        // When sites add data-dark-mode-processed (or similar), remove our forced styles
        const observeNativeDarkMode = () => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes') {
                        const target = mutation.target;
                        // Check if a dark mode attribute was added
                        const hasDarkModeAttr =
                            target.hasAttribute('data-dark-mode-processed') ||
                            target.getAttribute('data-theme')?.includes('dark') ||
                            target.getAttribute('data-color-scheme')?.includes('dark') ||
                            target.getAttribute('data-bs-theme') === 'dark' ||
                            target.getAttribute('data-mode') === 'dark';

                        if (hasDarkModeAttr) {
                            // Remove our forced styles from this element and all children
                            const elementsToFix = [target, ...target.querySelectorAll('*')];
                            elementsToFix.forEach(el => {
                                // Add class to exclude from CSS selectors
                                el.classList.add('has-native-dark-mode');

                                // IMPORTANT: Also remove inline styles we may have added
                                // This is critical because !important inline styles override everything
                                el.style.removeProperty('color');
                                el.style.removeProperty('background-color');

                                // If the element has no other inline styles, remove the style attribute entirely
                                if (el.style.length === 0 && el.hasAttribute('style')) {
                                    el.removeAttribute('style');
                                }
                            });
                        }
                    }
                });
            });

            // Start observing the entire document
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-dark-mode-processed', 'data-theme', 'data-color-scheme', 'data-bs-theme', 'data-mode'],
                subtree: true
            });
        };

        // Start the observer when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observeNativeDarkMode);
        } else {
            observeNativeDarkMode();
        }

        // ABSOLUTE NUCLEAR OPTION: Force white text on EVERYTHING, no exceptions except links and media
        const forceWhiteTextEverywhere = () => {
            // Get ALL elements on the page
            const allElements = document.querySelectorAll('*');

            // Process in batches to avoid UI freeze on large pages like Gmail
            const BATCH_SIZE = 100;
            let index = 0;

            const processBatch = () => {
                const end = Math.min(index + BATCH_SIZE, allElements.length);

                for (let i = index; i < end; i++) {
                    const el = allElements[i];
                    processTextColor(el);
                }

                index = end;
                if (index < allElements.length) {
                    requestAnimationFrame(processBatch);
                }
            };

            processBatch();
        };

        // Extract text color processing to separate function
        const processTextColor = (el) => {
                // Skip elements with native dark mode
                if (el.classList.contains('has-native-dark-mode') ||
                    (!isGmail && el.hasAttribute('data-dark-mode-processed')) ||
                    el.getAttribute('data-theme')?.includes('dark') ||
                    el.getAttribute('data-color-scheme')?.includes('dark')) {
                    return;
                }

                // Skip media elements - don't mutate them at all
                if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME' ||
                    el.tagName === 'IMG' || el.tagName === 'CANVAS' ||
                    el.tagName === 'SVG' || el.tagName === 'PICTURE') {
                    return;
                }

                // Links should be blue
                if (el.tagName === 'A') {
                    el.style.setProperty('color', '#88c0ff', 'important');
                    return;
                }

                // Everything else gets white text, no questions asked
                el.style.setProperty('color', '#ffffff', 'important');

                // Skip buttons for background modifications (to prevent opacity issues over videos)
                if (el.tagName === 'BUTTON' ||
                    (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) ||
                    el.getAttribute('role') === 'button') {
                    return;
                }

                // Check if element has a background that we should preserve or adjust
                const computedStyle = window.getComputedStyle(el);
                const bgColor = computedStyle.backgroundColor;

                // Parse rgb(r, g, b) or rgba(r, g, b, a)
                if (bgColor && bgColor.startsWith('rgb')) {
                    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);

                        // Check if it's a light/white background - lowered threshold to catch more
                        const isLight = r > 180 && g > 180 && b > 180;
                        const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);
                        const isGrayish = maxDiff < 60; // Increased tolerance for gray/white

                        // If it's light and grayish, darken it aggressively
                        if (isLight && isGrayish) {
                            el.style.setProperty('background-color', '#484848', 'important');
                        }
                        // Catch very bright elements even if they have some color
                        else if (r > 230 && g > 230 && b > 230) {
                            el.style.setProperty('background-color', '#484848', 'important');
                        }
                        // If it's a colored background (not forced by our CSS), preserve it
                        // by setting it explicitly so our universal selector doesn't override
                        else if (maxDiff > 60 && !el.hasAttribute('data-dark-mode-processed')) {
                            el.style.setProperty('background-color', bgColor, 'important');
                            el.setAttribute('data-dark-mode-processed', 'true');
                        }
                    }
                }
                // Also catch white color name
                else if (bgColor === 'white' || bgColor === '#fff' || bgColor === '#ffffff') {
                    el.style.setProperty('background-color', '#484848', 'important');
                }
        };

        // Run continuously on an interval
        let intervalId = null;

        const startForcing = () => {
            // Run immediately - process all elements AND set text colors
            forceWhiteTextEverywhere();

            // Batch process all elements to avoid UI freeze
            const allElements = document.querySelectorAll('*');
            const BATCH_SIZE = 100;
            let index = 0;

            const processBatch = () => {
                const end = Math.min(index + BATCH_SIZE, allElements.length);
                for (let i = index; i < end; i++) {
                    processElement(allElements[i]);
                }
                index = end;
                if (index < allElements.length) {
                    requestAnimationFrame(processBatch);
                }
            };

            processBatch();

            // DIRECTLY target section tags specifically - force EVERYTHING dark first
            const forceSectionsDark = () => {
                // Use multiple methods to force dark backgrounds on sections
                const sections = document.querySelectorAll('section');
                sections.forEach(section => {
                    // Method 1: setProperty with important - most reliable
                    section.style.setProperty('background-color', '#484848', 'important');
                    section.style.setProperty('background', '#484848', 'important');

                    // Method 2: Direct style property assignment as backup
                    section.style.backgroundColor = '#484848';
                    section.style.background = '#484848';

                    // Method 3: Force into style attribute directly to ensure it's there
                    const currentStyle = section.getAttribute('style') || '';
                    // Remove any existing background or background-color in the style attribute
                    let cleanedStyle = currentStyle.replace(/background-color\s*:\s*[^;]+;?/gi, '').trim();
                    cleanedStyle = cleanedStyle.replace(/background\s*:\s*[^;]+;?/gi, '').trim();
                    // Add our background with !important
                    const newStyle = cleanedStyle + (cleanedStyle ? '; ' : '') + 'background: #484848 !important;';
                    section.setAttribute('style', newStyle);
                });

                // Do the same for divs and other containers (but skip overlays and video-related elements)
                document.querySelectorAll('div, article, main, aside, header, footer, nav').forEach(el => {
                    const classStr = el.getAttribute('class') || '';
                    const idStr = el.getAttribute('id') || '';

                    // Skip scrubbers, progress bars, and related elements (removed expensive closest() calls)
                    if (classStr.includes('scrubber') || idStr.includes('scrubber') ||
                        classStr.includes('progress') || idStr.includes('progress') ||
                        classStr.includes('chapter') || classStr.includes('timed-marker') ||
                        classStr.includes('clip-')) {
                        return;
                    }

                    // Skip ONLY the main overlay containers
                    if ((classStr.includes('overlay-container') || idStr.includes('overlay-container') ||
                         classStr.includes('overlays-container') || idStr.includes('overlays-container')) &&
                        !el.hasAttribute('role') && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') {
                        return;
                    }
                    el.style.setProperty('background-color', '#484848', 'important');
                    el.style.backgroundColor = '#484848';
                });
            };

            // Force video player OVERLAY containers to be transparent
            const forceVideoPlayerTransparency = () => {
                // Only make the main overlay containers transparent - NOT controls inside them
                document.querySelectorAll('[class*="overlays-container"], [id*="overlays-container"]').forEach(el => {
                    // Only target the actual container divs, not buttons or interactive elements
                    if (el.tagName === 'DIV' && !el.hasAttribute('role')) {
                        el.style.setProperty('background-color', 'transparent', 'important');
                        el.style.setProperty('background', 'transparent', 'important');
                        el.removeAttribute('data-dark-mode-processed');
                    }
                });
            };

            // Run section forcing immediately
            forceSectionsDark();

            // Force video player controls to be transparent AFTER all processing (critical order)
            forceVideoPlayerTransparency();

            // Clear any existing interval (rely on MutationObserver instead for performance)
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
        };

        // Add MutationObserver to catch new elements immediately
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Process added nodes
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Skip if node or any ancestor has native dark mode
                        const hasNativeDarkMode = node.classList?.contains('has-native-dark-mode') ||
                            (!isGmail && node.hasAttribute?.('data-dark-mode-processed')) ||
                            node.getAttribute?.('data-theme')?.includes('dark') ||
                            node.getAttribute?.('data-color-scheme')?.includes('dark') ||
                            node.closest?.('.has-native-dark-mode') ||
                            (!isGmail && node.closest?.('[data-dark-mode-processed]'));

                        if (hasNativeDarkMode) {
                            return;
                        }

                        // If it's a section, force it dark immediately
                        if (node.tagName === 'SECTION') {
                            node.style.setProperty('background-color', '#484848', 'important');
                        }
                        // If it's an iframe, apply dark mode to its content
                        if (node.tagName === 'IFRAME') {
                            // Wait for iframe to load before applying dark mode
                            node.addEventListener('load', () => applyDarkModeToIframe(node), { once: true });
                        }
                        // Check for iframes in descendants (only if container has many children)
                        else if (node.children && node.children.length > 5) {
                            const iframeDescendants = node.querySelectorAll?.('iframe');
                            if (iframeDescendants && iframeDescendants.length > 0) {
                                iframeDescendants.forEach(iframe => {
                                    iframe.addEventListener('load', () => applyDarkModeToIframe(iframe), { once: true });
                                });
                            }
                        }

                        // Process the node itself
                        processElement(node);

                        // Process descendants - batch if large to avoid UI freeze
                        const descendants = node.querySelectorAll('*');
                        if (descendants.length > 50) {
                            // Large container - batch process to avoid freeze
                            const BATCH_SIZE = 50;
                            let index = 0;
                            const processBatch = () => {
                                const end = Math.min(index + BATCH_SIZE, descendants.length);
                                for (let i = index; i < end; i++) {
                                    processElement(descendants[i]);
                                }
                                index = end;
                                if (index < descendants.length) {
                                    requestAnimationFrame(processBatch);
                                }
                            };
                            processBatch();
                        } else {
                            // Small container - process immediately
                            descendants.forEach(processElement);
                        }
                    }
                });

                // Process attribute changes (style changes)
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (mutation.target.nodeType === 1) {
                        // If a section's style is being changed, force it dark immediately
                        if (mutation.target.tagName === 'SECTION') {
                            mutation.target.style.setProperty('background-color', '#484848', 'important');
                        }
                        processElement(mutation.target);
                    }
                }
            });
            // After processing all mutations, ensure video player elements stay transparent
            forceVideoPlayerTransparency();
        });

        // Extract element processing logic
        const processElement = (el) => {
            // Skip elements with native dark mode
            if (el.classList.contains('has-native-dark-mode') ||
                (!isGmail && el.hasAttribute('data-dark-mode-processed')) ||
                el.getAttribute('data-theme')?.includes('dark') ||
                el.getAttribute('data-color-scheme')?.includes('dark')) {
                return;
            }

            // Skip media elements
            if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME' ||
                el.tagName === 'IMG' || el.tagName === 'CANVAS' ||
                el.tagName === 'SVG' || el.tagName === 'PICTURE') {
                return;
            }

            // Skip video player UI - overlays AND controls (scrubbers, progress bars, etc.)
            const classStr = el.getAttribute('class') || '';
            const idStr = el.getAttribute('id') || '';

            // Skip elements inside scrubbers and progress bars - they need native YouTube styling
            if (el.closest('[class*="scrubber"]') || el.closest('[class*="progress"]')) {
                return;
            }

            // Skip scrubbers and progress bars themselves
            if (classStr.includes('scrubber') || idStr.includes('scrubber') ||
                classStr.includes('progress') || idStr.includes('progress') ||
                classStr.includes('chapter') || classStr.includes('timed-marker') ||
                classStr.includes('clip-')) {
                return;
            }

            // Skip overlay containers
            if ((classStr.includes('overlay-container') || idStr.includes('overlay-container') ||
                 classStr.includes('overlays-container') || idStr.includes('overlays-container')) &&
                !el.hasAttribute('role') && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') {
                return;
            }

            // Skip buttons for background modifications
            const isButton = el.tagName === 'BUTTON' ||
                (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) ||
                el.getAttribute('role') === 'button';

            if (!isButton) {
                // Explicitly handle semantic HTML5 container elements
                const isSemanticContainer = ['SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'DIV'].includes(el.tagName);

                // ULTRA AGGRESSIVE: Force ALL section/div tags dark, then check if we need to preserve colored backgrounds
                if (isSemanticContainer) {
                    const classStr = el.getAttribute('class') || '';
                    const idStr = el.getAttribute('id') || '';

                    // Skip elements inside scrubbers and progress bars
                    if (el.closest('[class*="scrubber"]') || el.closest('[class*="progress"]')) {
                        return;
                    }

                    // Skip scrubbers, progress bars, and related elements
                    if (classStr.includes('scrubber') || idStr.includes('scrubber') ||
                        classStr.includes('progress') || idStr.includes('progress') ||
                        classStr.includes('chapter') || classStr.includes('timed-marker') ||
                        classStr.includes('clip-')) {
                        return;
                    }

                    // Skip ONLY the main overlay containers
                    if ((classStr.includes('overlay-container') || idStr.includes('overlay-container') ||
                         classStr.includes('overlays-container') || idStr.includes('overlays-container')) &&
                        !el.hasAttribute('role') && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') {
                        return;
                    }
                    // Skip elements that are siblings of video/iframe
                    if (el.parentElement && (el.parentElement.querySelector('video') || el.parentElement.querySelector('iframe'))) {
                        return;
                    }

                    // First, check if it has a colored background we should preserve BEFORE changing it
                    const computedStyle = window.getComputedStyle(el);
                    const bgColor = computedStyle.backgroundColor;

                    let shouldPreserveColor = false;
                    if (bgColor && bgColor.startsWith('rgb')) {
                        const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                        if (match) {
                            const r = parseInt(match[1]);
                            const g = parseInt(match[2]);
                            const b = parseInt(match[3]);
                            const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);

                            // If it has actual color variation (not just gray/white), preserve the colored background
                            if (maxDiff > 60 && !(r > 180 && g > 180 && b > 180)) {
                                shouldPreserveColor = true;
                            }
                        }
                    }

                    // Now set the background color
                    if (shouldPreserveColor) {
                        el.style.setProperty('background-color', bgColor, 'important');
                        el.setAttribute('data-dark-mode-processed', 'colored');
                    } else {
                        el.style.setProperty('background-color', '#484848', 'important');
                        el.setAttribute('data-dark-mode-processed', 'dark');
                    }
                    return; // Done processing this semantic container
                }

                // For non-semantic containers, check both inline style AND computed style for maximum coverage
                const inlineStyle = el.style.backgroundColor;
                const computedStyle = window.getComputedStyle(el);
                const bgColor = computedStyle.backgroundColor;

                // Helper function to check if a color is light
                const isColorLight = (colorStr) => {
                    if (!colorStr) return false;

                    // Check color names
                    if (colorStr === 'white' || colorStr === '#fff' || colorStr === '#ffffff' ||
                        colorStr === '#FFF' || colorStr === '#FFFFFF') {
                        return true;
                    }

                    // Check RGB values
                    if (colorStr.startsWith('rgb')) {
                        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                        if (match) {
                            const r = parseInt(match[1]);
                            const g = parseInt(match[2]);
                            const b = parseInt(match[3]);

                            // Very bright = light
                            if (r > 230 && g > 230 && b > 230) return true;

                            // Light and grayish
                            const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);
                            if (r > 180 && g > 180 && b > 180 && maxDiff < 60) return true;

                            // For semantic containers, be more aggressive
                            if (isSemanticContainer && r > 150 && g > 150 && b > 150 && maxDiff < 80) return true;
                        }
                    }

                    // Check hex values
                    if (colorStr.startsWith('#')) {
                        const hex = colorStr.substring(1);
                        if (hex.length === 3 || hex.length === 6) {
                            const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
                            const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
                            const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);

                            if (r > 230 && g > 230 && b > 230) return true;

                            const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);
                            if (r > 180 && g > 180 && b > 180 && maxDiff < 60) return true;

                            if (isSemanticContainer && r > 150 && g > 150 && b > 150 && maxDiff < 80) return true;
                        }
                    }

                    return false;
                };

                // Check if we should force dark background
                let shouldForceDark = false;

                // Check inline style first (catches manual DevTools changes)
                if (inlineStyle && isColorLight(inlineStyle)) {
                    shouldForceDark = true;
                }

                // Check computed style
                if (!shouldForceDark) {
                    if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
                        shouldForceDark = true;
                    } else if (isColorLight(bgColor)) {
                        shouldForceDark = true;
                    }
                }

                // Force dark background if needed
                if (shouldForceDark) {
                    el.style.setProperty('background-color', '#484848', 'important');
                }
                // Preserve colored backgrounds (high color variation)
                else if (bgColor && bgColor.startsWith('rgb')) {
                    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);
                        const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);

                        // Preserve colored backgrounds
                        if (maxDiff > 60 && !el.hasAttribute('data-dark-mode-processed')) {
                            el.style.setProperty('background-color', bgColor, 'important');
                            el.setAttribute('data-dark-mode-processed', 'true');
                        }
                    }
                }
            }
        };

        // Start observing
        const startObserving = () => {
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            } else {
                setTimeout(startObserving, 10);
            }
        };

        // Protect section styles from being overridden by page scripts
        const protectSectionStyles = () => {
            // Override setAttribute for all section elements
            const originalSetAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
                if (this.tagName === 'SECTION' && name === 'style') {
                    // Force our background into the style attribute
                    if (!value.includes('background')) {
                        value += '; background: #484848 !important;';
                    }
                }
                return originalSetAttribute.call(this, name, value);
            };

            // No need for polling - MutationObserver handles section changes
        };

        // Apply dark mode to iframe content
        const applyDarkModeToIframe = (iframe) => {
            try {
                // Try to access the iframe's content document
                // This will fail for cross-origin iframes due to same-origin policy
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

                if (!iframeDoc) {
                    return; // Cannot access cross-origin iframe
                }

                // Check if dark mode already applied to this iframe
                if (iframeDoc.getElementById('dark-mode-enforcer-iframe')) {
                    return;
                }

                // Inject dark mode styles into the iframe
                const style = iframeDoc.createElement('style');
                style.id = 'dark-mode-enforcer-iframe';
                style.textContent = `
                    html {
                        background-color: #484848 !important;
                        color-scheme: dark !important;
                    }
                    body {
                        background-color: #484848 !important;
                        color: #e0e0e0 !important;
                    }
                    * {
                        background-color: #484848 !important;
                        color: #e0e0e0 !important;
                    }
                    a, a:link, a:visited {
                        color: #88c0ff !important;
                    }
                `;

                // Append to iframe's head or body
                if (iframeDoc.head) {
                    iframeDoc.head.appendChild(style);
                } else if (iframeDoc.body) {
                    iframeDoc.body.insertBefore(style, iframeDoc.body.firstChild);
                }
            } catch (e) {
                // Cross-origin iframe or other access error - silently fail
                // This is expected for iframes from different domains
            }
        };

        // Process all iframes on the page
        const processAllIframes = () => {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                // Wait for iframe to load before applying dark mode
                if (iframe.contentDocument?.readyState === 'complete') {
                    applyDarkModeToIframe(iframe);
                } else {
                    iframe.addEventListener('load', () => applyDarkModeToIframe(iframe), { once: true });
                }
            });
        };

        // Start when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                startForcing();
                startObserving();
                protectSectionStyles();
                processAllIframes();
            });
        } else {
            startForcing();
            startObserving();
            protectSectionStyles();
            processAllIframes();
        }
    };

    // Call activation immediately if flag is already set
    if (window.__darkModeEnabled === true) {
        window.__activateDarkMode();
    }

    // Apply all modifications before page scripts load
    try {
        // console.log('[Preload] Starting anti-bot measures...');

        // 1. Override webdriver property to hide automation
        // CRITICAL: Don't use a getter - bot detection scripts check for this!
        // Real Chrome either doesn't have this property or it's a direct value

        // First, try to delete it from the prototype chain
        try {
            delete Object.getPrototypeOf(navigator).webdriver;
        } catch(e) {
            // Silently handle error
        }

        // Then try to delete it from navigator itself
        try {
            delete navigator.webdriver;
        } catch(e) {
            // Silently handle error
        }

        // Now redefine it as a VALUE property (not a getter!) to avoid detection
        // If we can't delete it, at least make it return false like real Chrome
        try {
            Object.defineProperty(navigator, 'webdriver', {
                value: false,  // Real Chrome has false, not undefined
                writable: false,
                enumerable: true,
                configurable: true
            });
        } catch(e) {
            // If that fails, try just setting it
            try {
                navigator.webdriver = false;
            } catch(e2) {
                // Silently handle error
            }
        }

        // 2. Chrome object with complete implementation
        try {
        if (!window.chrome || !window.chrome.runtime) {
            window.chrome = {
                app: {
                    isInstalled: false,
                    getDetails: () => null,
                    getIsInstalled: () => false,
                    InstallState: {
                        DISABLED: 'disabled',
                        INSTALLED: 'installed',
                        NOT_INSTALLED: 'not_installed'
                    },
                    RunningState: {
                        CANNOT_RUN: 'cannot_run',
                        READY_TO_RUN: 'ready_to_run',
                        RUNNING: 'running'
                    }
                },
                runtime: {
                    id: undefined,
                    // Real Chrome returns undefined for these when no extension context
                    connect: function() { return undefined; },
                    sendMessage: function() { return undefined; },
                    onConnect: {
                        addListener: function() {},
                        removeListener: function() {},
                        hasListener: function() { return false; }
                    },
                    onMessage: {
                        addListener: function() {},
                        removeListener: function() {},
                        hasListener: function() { return false; }
                    },
                    onConnectExternal: {
                        addListener: function() {},
                        removeListener: function() {},
                        hasListener: function() { return false; }
                    },
                    onMessageExternal: {
                        addListener: function() {},
                        removeListener: function() {},
                        hasListener: function() { return false; }
                    },
                    lastError: undefined,
                    getManifest: function() { return undefined; },
                    getURL: function(path) { return path || ''; },
                    getPlatformInfo: function(callback) {
                        const info = {
                            os: 'mac',
                            arch: 'arm',
                            nacl_arch: 'arm'
                        };
                        if (callback) callback(info);
                        return Promise.resolve(info);
                    }
                },
                loadTimes: function() {
                    const now = Date.now() / 1000;
                    return {
                        commitLoadTime: now - 1,
                        connectionInfo: 'h2',
                        finishDocumentLoadTime: now,
                        finishLoadTime: now,
                        firstPaintAfterLoadTime: 0,
                        firstPaintTime: now - 0.5,
                        navigationType: 'Other',
                        npnNegotiatedProtocol: 'h2',
                        requestTime: now - 2,
                        startLoadTime: now - 1.5,
                        wasAlternateProtocolAvailable: false,
                        wasFetchedViaSpdy: true,
                        wasNpnNegotiated: true
                    };
                },
                csi: function() {
                    return {
                        onloadT: Date.now(),
                        pageT: Date.now() - 1000,
                        startE: Date.now() - 2000,
                        tran: 15
                    };
                }
            };
        }
        } catch(e) {
            // Silently handle error
        }

        // 3. Realistic plugins array
        try {
        const pluginData = [
            {
                name: 'PDF Viewer',
                description: 'Portable Document Format',
                filename: 'internal-pdf-viewer',
                mimeTypes: [{
                    type: 'application/pdf',
                    suffixes: 'pdf',
                    description: 'Portable Document Format'
                }]
            },
            {
                name: 'Chrome PDF Viewer',
                description: '',
                filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                mimeTypes: [{
                    type: 'application/pdf',
                    suffixes: 'pdf',
                    description: ''
                }]
            },
            {
                name: 'Native Client',
                description: '',
                filename: 'internal-nacl-plugin',
                mimeTypes: [
                    {
                        type: 'application/x-nacl',
                        suffixes: '',
                        description: 'Native Client Executable'
                    },
                    {
                        type: 'application/x-pnacl',
                        suffixes: '',
                        description: 'Portable Native Client Executable'
                    }
                ]
            }
        ];

        const plugins = [];
        pluginData.forEach(p => {
            const plugin = Object.create(Plugin.prototype);

            // Use Object.defineProperty to avoid read-only property errors
            try {
                Object.defineProperties(plugin, {
                    name: { value: p.name, writable: false },
                    description: { value: p.description, writable: false },
                    filename: { value: p.filename, writable: false },
                    length: { value: p.mimeTypes.length, writable: false }
                });

                p.mimeTypes.forEach((mt, i) => {
                    plugin[i] = mt;
                });

                plugin.item = function(index) {
                    return this[index];
                };

                plugin.namedItem = function(name) {
                    for (let i = 0; i < this.length; i++) {
                        if (this[i].type === name) return this[i];
                    }
                    return null;
                };

                plugins.push(plugin);
            } catch (e) {
                // Silently skip if we can't modify plugin properties
                // This is non-critical for the browser functionality
            }
        });

        // Create a proper PluginArray-like object
        const pluginArray = Object.create(PluginArray.prototype);
        plugins.forEach((plugin, index) => {
            pluginArray[index] = plugin;
        });

        Object.defineProperties(pluginArray, {
            length: {
                value: plugins.length,
                writable: false,
                enumerable: false,
                configurable: false
            },
            item: {
                value: function(index) {
                    return this[index] || null;
                },
                writable: false,
                enumerable: false,
                configurable: false
            },
            namedItem: {
                value: function(name) {
                    for (let i = 0; i < this.length; i++) {
                        if (this[i].name === name) return this[i];
                    }
                    return null;
                },
                writable: false,
                enumerable: false,
                configurable: false
            },
            refresh: {
                value: function() {},
                writable: false,
                enumerable: false,
                configurable: false
            }
        });

        // Override toString to return realistic value
        Object.defineProperty(pluginArray, 'toString', {
            value: function() {
                return '[object PluginArray]';
            },
            writable: false,
            enumerable: false,
            configurable: false
        });

        Object.defineProperty(navigator, 'plugins', {
            get: () => pluginArray,
            configurable: false,
            enumerable: true
        });

        // 4. MimeTypes array
        const mimeTypes = [];
        pluginData.forEach(p => {
            p.mimeTypes.forEach(mt => {
                // Create a plain object instead of using MimeType.prototype
                // because MimeType has read-only properties we can't override
                const mimeType = {
                    type: mt.type,
                    description: mt.description,
                    suffixes: mt.suffixes,
                    enabledPlugin: plugins.find(pl => pl.name === p.name)
                };
                mimeTypes.push(mimeType);
            });
        });

        Object.defineProperty(navigator, 'mimeTypes', {
            get: () => mimeTypes,
            configurable: false,
            enumerable: true
        });
        } catch(e) {
            // Silently handle error
        }

        // 5. Navigator properties

        // Store original values BEFORE overriding to avoid infinite loops
        const originalConnection = navigator.connection;
        const originalHardwareConcurrency = navigator.hardwareConcurrency;
        const originalDeviceMemory = navigator.deviceMemory;

        // First try to delete the existing property
        try {
            delete navigator.languages;
        } catch(e) {
            // Silently handle error
        }

        try {
            Object.defineProperties(navigator, {
                languages: {
                    get: () => ['en-US', 'en'],
                    configurable: true,
                    enumerable: true
                },
            vendor: {
                get: () => 'Google Inc.',
                configurable: false
            },
            vendorSub: {
                get: () => '',
                configurable: false
            },
            productSub: {
                get: () => '20030107',
                configurable: false
            },
            product: {
                get: () => 'Gecko',
                configurable: false
            },
            appCodeName: {
                get: () => 'Mozilla',
                configurable: false
            },
            appName: {
                get: () => 'Netscape',
                configurable: false
            },
            doNotTrack: {
                get: () => null,
                configurable: false
            },
            pdfViewerEnabled: {
                get: () => true,
                configurable: false
            },
            maxTouchPoints: {
                get: () => 0,
                configurable: false
            },
            hardwareConcurrency: {
                get: () => originalHardwareConcurrency || 8,
                configurable: false
            },
            deviceMemory: {
                get: () => originalDeviceMemory || 8,
                configurable: false
            },
            connection: {
                get: () => originalConnection || {
                    downlink: 10,
                    effectiveType: '4g',
                    rtt: 50,
                    saveData: false,
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true
                },
                configurable: false
            },
            platform: {
                get: () => 'MacIntel',
                configurable: false
            },
            userAgent: {
                get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                configurable: false
            }
        });
        } catch(e) {
            // Silently handle error
        }

        // userAgentData needs special handling - delete first then redefine
        try {
            delete navigator.userAgentData;
        } catch(e) {
            // Silently handle error
        }

        try {
        Object.defineProperty(navigator, 'userAgentData', {
            get: () => ({
                    brands: [
                        { brand: "Chromium", version: "142" },
                        { brand: "Not?A_Brand", version: "99" }
                    ],
                    mobile: false,
                    platform: "macOS",
                    getHighEntropyValues: () => Promise.resolve({
                        brands: [
                            { brand: "Chromium", version: "142" },
                            { brand: "Not?A_Brand", version: "99" }
                        ],
                        mobile: false,
                        platform: "macOS",
                        platformVersion: "15.2.0",
                        architecture: "arm",
                        bitness: "64",
                        model: "",
                        uaFullVersion: "142.0.0.0"
                    }),
                    toJSON: function() {
                        return {
                            brands: this.brands,
                            mobile: this.mobile,
                            platform: this.platform
                        };
                    }
                }),
            configurable: true,
            enumerable: true
        });
        } catch(e) {
            // Silently handle error
        }

        // 6. Battery API - Remove it since Chrome removed this API
        // First try to delete it
        try {
            delete navigator.getBattery;
        } catch(e) {}

        // If still exists, override it to be undefined and non-enumerable
        if ('getBattery' in navigator) {
            try {
                Object.defineProperty(navigator, 'getBattery', {
                    get: () => undefined,
                    set: () => {},
                    enumerable: false,
                    configurable: true
                });
            } catch(e) {}
        }

        // 7. Permissions API - match real Chrome behavior more accurately
        if (navigator.permissions && navigator.permissions.query) {
            const originalQuery = navigator.permissions.query;
            navigator.permissions.query = function(parameters) {
                // Return realistic permission states based on actual Chrome behavior
                const name = parameters?.name || parameters;
                let state = 'prompt'; // Default state

                // Match real Chrome permission states
                if (name === 'notifications' || name === 'push' || name === 'persistent-storage') {
                    state = 'prompt'; // User must grant these
                } else if (name === 'midi' || name === 'clipboard-read' || name === 'clipboard-write') {
                    state = 'prompt';
                } else if (name === 'accelerometer' || name === 'gyroscope' || name === 'magnetometer') {
                    state = 'granted'; // Usually granted by default in Chrome
                } else if (name === 'camera' || name === 'microphone') {
                    state = 'prompt'; // More realistic - don't auto-grant
                } else if (name === 'geolocation') {
                    state = 'prompt';
                }

                return Promise.resolve({
                    state: state,
                    onchange: null,
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true
                });
            };
        }

        // MediaDevices for Google Meet
        if (!navigator.mediaDevices) {
            navigator.mediaDevices = {};
        }

        // Ensure getUserMedia exists
        if (!navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
                // Return a promise that will be handled by Electron's permission system
                return navigator.webkitGetUserMedia ?
                    new Promise((resolve, reject) => {
                        navigator.webkitGetUserMedia(constraints, resolve, reject);
                    }) :
                    Promise.reject(new Error('getUserMedia not supported'));
            };
        }

        // Ensure enumerateDevices exists
        if (!navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices = function() {
                return Promise.resolve([
                    { deviceId: 'default', kind: 'audioinput', label: 'Default Audio Input' },
                    { deviceId: 'default', kind: 'videoinput', label: 'Default Video Input' },
                    { deviceId: 'default', kind: 'audiooutput', label: 'Default Audio Output' }
                ]);
            };
        }

        // 8. WebGL - rely on native support (enabled via command line flags)
        // No mocking - native WebGL is enabled via GPU flags in main.js

        // 9. Canvas fingerprint protection - disable noise to avoid detection
        // Many bot detectors check if canvas APIs are modified
        // Leaving it unmodified is actually less suspicious

        // 10. AudioContext - leave unmodified to avoid detection

        // 11. Screen properties
        Object.defineProperties(screen, {
            availTop: {
                get: () => 0,
                configurable: false
            },
            availLeft: {
                get: () => 0,
                configurable: false
            }
        });

        // 12. Remove automation indicators - comprehensive CDP detection removal
        // Remove all cdc_ prefixed properties (ChromeDriver detection)
        const cdcProps = Object.keys(window).filter(prop =>
            prop.includes('cdc_') ||
            prop.includes('$cdc_') ||
            prop.includes('$chrome_') ||
            prop.includes('__chrome_') ||
            prop.includes('webdriver') ||
            prop.includes('driver') ||
            prop.includes('selenium')
        );
        cdcProps.forEach(prop => {
            try {
                delete window[prop];
            } catch(e) {}
        });

        // Also check document for CDP markers
        const docCdcProps = Object.keys(document).filter(prop =>
            prop.includes('cdc_') ||
            prop.includes('$cdc_') ||
            prop.includes('webdriver')
        );
        docCdcProps.forEach(prop => {
            try {
                delete document[prop];
            } catch(e) {}
        });

        // Remove specific known automation indicators
        delete window.$cdc_asdjflasutopfhvcZLmcfl_;
        delete window.$chrome_asyncScriptInfo;
        delete window.__driver_evaluate;
        delete window.__webdriver_evaluate;
        delete window.__selenium_evaluate;
        delete window.__fxdriver_evaluate;
        delete window.__driver_unwrapped;
        delete window.__webdriver_unwrapped;
        delete window.__selenium_unwrapped;
        delete window.__fxdriver_unwrapped;
        delete window._Selenium_IDE_Recorder;
        delete window._selenium;
        delete window.calledSelenium;
        delete window.__webdriverFunc;
        delete window.__webdriver_script_fn;
        delete window.domAutomation;
        delete window.domAutomationController;

        // Remove Puppeteer/Playwright detection
        delete window.__puppeteer_evaluation_script__;
        delete window.__playwright_evaluation_script__;
        delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

        // CRITICAL: Completely remove CDC properties from document
        // Setting them to undefined doesn't work - they still show up with 'in' operator
        delete document.$cdc_asdjflasutopfhvcZLmcfl_;

        // Prevent CDP properties from being added to document by proxying it
        const documentProxyHandler = {
            get(target, prop) {
                // Block all CDP detection properties
                if (typeof prop === 'string' && (
                    prop.includes('$cdc_') ||
                    prop.includes('cdc_') ||
                    prop.includes('$chrome_') ||
                    prop.includes('__chrome_') ||
                    prop === 'webdriver'
                )) {
                    return undefined;
                }
                return Reflect.get(target, prop);
            },
            has(target, prop) {
                // Hide CDP properties from 'in' operator checks
                if (typeof prop === 'string' && (
                    prop.includes('$cdc_') ||
                    prop.includes('cdc_') ||
                    prop.includes('$chrome_') ||
                    prop.includes('__chrome_')
                )) {
                    return false;
                }
                return Reflect.has(target, prop);
            }
        };

        // Can't proxy document directly in most browsers, so intercept getOwnPropertyNames
        const originalGetOwnPropertyNames = Object.getOwnPropertyNames;
        Object.getOwnPropertyNames = function(obj) {
            const props = originalGetOwnPropertyNames(obj);
            if (obj === document || obj === window) {
                return props.filter(prop =>
                    !prop.includes('$cdc_') &&
                    !prop.includes('cdc_') &&
                    !prop.includes('$chrome_') &&
                    !prop.includes('__chrome_')
                );
            }
            return props;
        };

        // Also intercept Object.keys
        const originalObjectKeys = Object.keys;
        Object.keys = function(obj) {
            const keys = originalObjectKeys(obj);
            if (obj === document || obj === window) {
                return keys.filter(key =>
                    !key.includes('$cdc_') &&
                    !key.includes('cdc_') &&
                    !key.includes('$chrome_') &&
                    !key.includes('__chrome_')
                );
            }
            return keys;
        };

        // Intercept Object.getOwnPropertyDescriptor to hide CDP properties
        const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
        Object.getOwnPropertyDescriptor = function(obj, prop) {
            if ((obj === document || obj === window) && typeof prop === 'string' && (
                prop.includes('$cdc_') ||
                prop.includes('cdc_') ||
                prop.includes('$chrome_') ||
                prop.includes('__chrome_')
            )) {
                return undefined;
            }
            return originalGetOwnPropertyDescriptor(obj, prop);
        };

        // Critical: Override document.hasOwnProperty to hide CDP properties
        const originalHasOwnProperty = document.hasOwnProperty;
        document.hasOwnProperty = function(prop) {
            if (typeof prop === 'string' && (
                prop.includes('$cdc_') ||
                prop.includes('cdc_') ||
                prop.includes('$chrome_') ||
                prop.includes('__chrome_')
            )) {
                return false;
            }
            return originalHasOwnProperty.call(this, prop);
        };

        // Continuously remove CDP properties (they can be added dynamically)
        // Use original methods to bypass our interceptions
        const removeCDPProperties = () => {
            try {
                // Remove from document - use ORIGINAL getOwnPropertyNames to see real properties
                const docProps = originalGetOwnPropertyNames(document);
                docProps.forEach(key => {
                    if (key.includes('$cdc_') || key.includes('cdc_') ||
                        key.includes('$chrome_') || key.includes('__chrome_') ||
                        key.includes('puppeteer') || key.includes('playwright')) {
                        delete document[key];
                    }
                });
                // Remove from window
                const winProps = originalGetOwnPropertyNames(window);
                winProps.forEach(key => {
                    if (key.includes('$cdc_') || key.includes('cdc_') ||
                        key.includes('$chrome_') || key.includes('__chrome_') ||
                        key.includes('puppeteer') || key.includes('playwright')) {
                        delete window[key];
                    }
                });

                // Also check for Runtime.enable detection (CDP command)
                delete window.__RUNTIME_ENABLED__;
                delete window.__CDP_RUNTIME_ENABLED__;
            } catch(e) {}
        };

        // Run cleanup immediately and more aggressively
        removeCDPProperties();

        // Run very frequently to catch dynamically added properties
        setInterval(removeCDPProperties, 50); // Check every 50ms (more aggressive)

        // Also run on page events
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', removeCDPProperties);
        } else {
            removeCDPProperties();
        }
        window.addEventListener('load', removeCDPProperties);

        // Run on any navigation
        window.addEventListener('beforeunload', removeCDPProperties);
        window.addEventListener('pagehide', removeCDPProperties);

        // 13. Keyboard and MediaCapabilities
        if (!navigator.keyboard) {
            navigator.keyboard = {
                lock: () => Promise.resolve(),
                unlock: () => {},
                getLayoutMap: () => Promise.resolve(new Map())
            };
        }

        if (!navigator.mediaCapabilities) {
            navigator.mediaCapabilities = {
                decodingInfo: () => Promise.resolve({
                    supported: true,
                    smooth: true,
                    powerEfficient: true,
                    configuration: {}
                }),
                encodingInfo: () => Promise.resolve({
                    supported: true,
                    smooth: true,
                    powerEfficient: true,
                    configuration: {}
                })
            };
        }

        // Add storage API if missing
        if (!navigator.storage) {
            navigator.storage = {
                estimate: () => Promise.resolve({
                    quota: 1024 * 1024 * 1024 * 100, // 100GB
                    usage: 1024 * 1024 * 10 // 10MB
                }),
                persist: () => Promise.resolve(false),
                persisted: () => Promise.resolve(false),
                getDirectory: () => Promise.reject(new Error('Not supported'))
            };
        }

        // Add locks API if missing
        if (!navigator.locks) {
            navigator.locks = {
                request: (name, callback) => {
                    if (typeof callback === 'function') {
                        return Promise.resolve(callback());
                    }
                    return Promise.resolve();
                },
                query: () => Promise.resolve({ held: [], pending: [] })
            };
        }

        // Add wakeLock API if missing
        if (!navigator.wakeLock) {
            navigator.wakeLock = {
                request: (type) => Promise.resolve({
                    type: type || 'screen',
                    released: false,
                    release: () => Promise.resolve()
                })
            };
        }

        // Add USB API if missing (for WebUSB)
        if (!navigator.usb) {
            navigator.usb = {
                getDevices: () => Promise.resolve([]),
                requestDevice: () => Promise.reject(new DOMException('No device selected', 'NotFoundError')),
                addEventListener: () => {},
                removeEventListener: () => {},
                onconnect: null,
                ondisconnect: null
            };
        }

        // Add HID API if missing
        if (!navigator.hid) {
            navigator.hid = {
                getDevices: () => Promise.resolve([]),
                requestDevice: () => Promise.reject(new DOMException('No device selected', 'NotFoundError')),
                addEventListener: () => {},
                removeEventListener: () => {},
                onconnect: null,
                ondisconnect: null
            };
        }

        // Add Serial API if missing
        if (!navigator.serial) {
            navigator.serial = {
                getPorts: () => Promise.resolve([]),
                requestPort: () => Promise.reject(new DOMException('No port selected', 'NotFoundError')),
                addEventListener: () => {},
                removeEventListener: () => {},
                onconnect: null,
                ondisconnect: null
            };
        }

        // Add Bluetooth API if missing
        if (!navigator.bluetooth) {
            navigator.bluetooth = {
                getAvailability: () => Promise.resolve(false),
                getDevices: () => Promise.resolve([]),
                requestDevice: () => Promise.reject(new DOMException('Bluetooth adapter not available', 'NotFoundError')),
                addEventListener: () => {},
                removeEventListener: () => {},
                onavailabilitychanged: null
            };
        }

        // Add Clipboard API if missing (be careful - this can break legitimate sites)
        if (!navigator.clipboard) {
            navigator.clipboard = {
                read: () => Promise.reject(new DOMException('Read permission denied', 'NotAllowedError')),
                readText: () => Promise.reject(new DOMException('Read permission denied', 'NotAllowedError')),
                write: () => Promise.reject(new DOMException('Write permission denied', 'NotAllowedError')),
                writeText: () => Promise.reject(new DOMException('Write permission denied', 'NotAllowedError'))
            };
        }

        // Add XR API if missing (WebXR for VR/AR)
        if (!navigator.xr) {
            navigator.xr = {
                isSessionSupported: () => Promise.resolve(false),
                requestSession: () => Promise.reject(new DOMException('XR not supported', 'NotSupportedError')),
                addEventListener: () => {},
                removeEventListener: () => {},
                ondevicechange: null
            };
        }

        // 14. Function toString - make our overrides look native
        // Store the original toString
        const originalToString = Function.prototype.toString;

        // Create a whitelist of our mocked functions that should look native
        const mockedFunctions = new WeakSet();

        // Override toString to make our functions look native
        const newToString = function() {
            // If this is one of our mocked functions, return a native-looking string
            if (mockedFunctions.has(this)) {
                return `function ${this.name}() { [native code] }`;
            }
            // Otherwise use original toString
            return originalToString.call(this);
        };

        // Make the new toString itself look native
        Object.defineProperty(Function.prototype, 'toString', {
            value: newToString,
            writable: true,
            configurable: true,
            enumerable: false
        });

        // Make toString.toString() also look native
        Object.defineProperty(newToString, 'toString', {
            value: function() {
                return 'function toString() { [native code] }';
            },
            writable: true,
            configurable: true
        });

        // Add our mocked functions to the whitelist
        if (navigator.getBattery) mockedFunctions.add(navigator.getBattery);
        if (navigator.getUserMedia) mockedFunctions.add(navigator.getUserMedia);
        if (navigator.mediaDevices?.getUserMedia) mockedFunctions.add(navigator.mediaDevices.getUserMedia);
        if (navigator.mediaDevices?.enumerateDevices) mockedFunctions.add(navigator.mediaDevices.enumerateDevices);
        if (window.chrome?.runtime?.connect) mockedFunctions.add(window.chrome.runtime.connect);
        if (window.chrome?.runtime?.sendMessage) mockedFunctions.add(window.chrome.runtime.sendMessage);
        if (window.chrome?.loadTimes) mockedFunctions.add(window.chrome.loadTimes);
        if (window.chrome?.csi) mockedFunctions.add(window.chrome.csi);
        if (navigator.plugins?.item) mockedFunctions.add(navigator.plugins.item);
        if (navigator.plugins?.namedItem) mockedFunctions.add(navigator.plugins.namedItem);
        if (navigator.plugins?.refresh) mockedFunctions.add(navigator.plugins.refresh);
        if (navigator.storage?.estimate) mockedFunctions.add(navigator.storage.estimate);
        if (navigator.storage?.persist) mockedFunctions.add(navigator.storage.persist);
        if (navigator.storage?.persisted) mockedFunctions.add(navigator.storage.persisted);
        if (navigator.locks?.request) mockedFunctions.add(navigator.locks.request);
        if (navigator.locks?.query) mockedFunctions.add(navigator.locks.query);
        if (navigator.wakeLock?.request) mockedFunctions.add(navigator.wakeLock.request);
        if (navigator.usb?.getDevices) mockedFunctions.add(navigator.usb.getDevices);
        if (navigator.usb?.requestDevice) mockedFunctions.add(navigator.usb.requestDevice);
        if (navigator.hid?.getDevices) mockedFunctions.add(navigator.hid.getDevices);
        if (navigator.hid?.requestDevice) mockedFunctions.add(navigator.hid.requestDevice);
        if (navigator.serial?.getPorts) mockedFunctions.add(navigator.serial.getPorts);
        if (navigator.serial?.requestPort) mockedFunctions.add(navigator.serial.requestPort);
        if (navigator.bluetooth?.getAvailability) mockedFunctions.add(navigator.bluetooth.getAvailability);
        if (navigator.bluetooth?.getDevices) mockedFunctions.add(navigator.bluetooth.getDevices);
        if (navigator.bluetooth?.requestDevice) mockedFunctions.add(navigator.bluetooth.requestDevice);
        if (navigator.clipboard?.read) mockedFunctions.add(navigator.clipboard.read);
        if (navigator.clipboard?.readText) mockedFunctions.add(navigator.clipboard.readText);
        if (navigator.clipboard?.write) mockedFunctions.add(navigator.clipboard.write);
        if (navigator.clipboard?.writeText) mockedFunctions.add(navigator.clipboard.writeText);
        if (navigator.xr?.isSessionSupported) mockedFunctions.add(navigator.xr.isSessionSupported);
        if (navigator.xr?.requestSession) mockedFunctions.add(navigator.xr.requestSession);

        // 15. Remove Electron-specific window properties
        delete window.process;
        delete window.require;
        delete window.Buffer;
        delete window.global;
        delete window.ELECTRON_ENABLE_SECURITY_WARNINGS;
        delete window.ELECTRON_ENABLE_LOGGING;
        delete window.ELECTRON_DISABLE_SECURITY_WARNINGS;
        delete window.electronBinding;
        delete window._linkedBinding;
        delete window.crashReporter;
        delete window.desktopCapturer;
        delete window.ipcRenderer;
        delete window.nativeImage;
        delete window.remote;
        delete window.clipboard;
        delete window.shell;

        // Remove Electron from navigator
        delete navigator.electron;

        // Remove any __electron properties
        Object.keys(window).filter(key => key.includes('electron') || key.includes('Electron')).forEach(key => {
            try {
                delete window[key];
            } catch(e) {}
        });

        // Override external.AddSearchProvider if it exists (Electron-specific)
        if (window.external && window.external.AddSearchProvider) {
            delete window.external.AddSearchProvider;
        }

        // Make sure toString on window doesn't expose Electron
        try {
            const originalToString = window.constructor.toString;
            window.constructor.toString = function() {
                return 'function Window() { [native code] }';
            };
        } catch(e) {}

        // 16. WebRTC - leave unmodified to avoid detection

        // 17. Intl.DateTimeFormat - leave unmodified

        // 18. Notification permission - leave as is

        // 19. Error stack traces - leave unmodified

        // 20. User activation API - set realistic values
        if (!navigator.userActivation) {
            Object.defineProperty(navigator, 'userActivation', {
                get: () => ({
                    hasBeenActive: false,
                    isActive: false
                }),
                configurable: false
            });
        }

        // Removed aggressive Proxy overrides (console, eval, Function, Error, performance.now)
        // They were breaking legitimate sites like Okta SSO

        // Remove automation port info if present
        delete window.__karma__;
        delete window.__coverage__;
        delete window.__nightmare;
        delete window.nightmare;
        delete window._phantom;
        delete window.phantom;
        delete window.callPhantom;

        // Override document properties that might expose automation
        try {
            Object.defineProperty(document, 'hidden', {
                get: () => false,
                configurable: true
            });

            Object.defineProperty(document, 'visibilityState', {
                get: () => 'visible',
                configurable: true
            });
        } catch (e) {
            // Ignore if can't override
        }

        // Add missing browser APIs that real browsers have
        if (!window.Notification) {
            window.Notification = class Notification {
                constructor(title, options) {
                    this.title = title;
                    this.options = options;
                }
                static requestPermission() {
                    return Promise.resolve('default');
                }
                static get permission() {
                    return 'default';
                }
            };
        }

        // Override document.documentElement.getAttribute to hide automation
        const originalGetAttribute = Element.prototype.getAttribute;
        Element.prototype.getAttribute = function(name) {
            // Don't expose any webdriver attributes
            if (name === 'webdriver' || name === 'driver' || name === 'selenium') {
                return null;
            }
            return originalGetAttribute.call(this, name);
        };

        // Add realistic window dimensions
        // Real browsers have outerWidth/Height that account for browser UI
        const getRealisticOuterWidth = () => {
            // Add a small amount for window borders (typically 0-2px on each side)
            return window.innerWidth + 0;
        };

        const getRealisticOuterHeight = () => {
            // Add height for browser chrome (toolbar, bookmarks bar, etc.)
            // Typical Chrome has ~85-120px of chrome
            return window.innerHeight + 85;
        };

        Object.defineProperties(window, {
            outerWidth: {
                get: getRealisticOuterWidth,
                configurable: true,
                enumerable: true
            },
            outerHeight: {
                get: getRealisticOuterHeight,
                configurable: true,
                enumerable: true
            }
        });

        // Ensure screen.width/height is greater than or equal to window dimensions
        // This is a common headless browser detection method
        if (window.screen) {
            const originalScreenWidth = Object.getOwnPropertyDescriptor(Screen.prototype, 'width')?.get ||
                                       Object.getOwnPropertyDescriptor(window.screen, 'width')?.get;
            const originalScreenHeight = Object.getOwnPropertyDescriptor(Screen.prototype, 'height')?.get ||
                                        Object.getOwnPropertyDescriptor(window.screen, 'height')?.get;

            // Make sure screen dimensions are realistic and larger than window
            Object.defineProperty(window.screen, 'width', {
                get: function() {
                    const original = originalScreenWidth?.call(this) || 1920;
                    return Math.max(original, window.innerWidth);
                },
                configurable: true
            });

            Object.defineProperty(window.screen, 'height', {
                get: function() {
                    const original = originalScreenHeight?.call(this) || 1080;
                    return Math.max(original, window.innerHeight + 100);
                },
                configurable: true
            });
        }

        // Ensure screen properties are realistic
        if (window.screen) {
            Object.defineProperties(screen, {
                availWidth: {
                    get: () => screen.width,
                    configurable: true
                },
                availHeight: {
                    get: () => screen.height - 25, // Account for menu bar
                    configurable: true
                },
                colorDepth: {
                    get: () => 24,
                    configurable: true
                },
                pixelDepth: {
                    get: () => 24,
                    configurable: true
                }
            });
        }

        // Add realistic mouse and touch event support
        // Some bot detection checks if MouseEvent and TouchEvent are properly defined
        if (typeof MouseEvent !== 'undefined') {
            // Ensure MouseEvent.prototype has realistic properties
            Object.defineProperty(MouseEvent.prototype, 'toJSON', {
                value: function() {
                    return {};
                },
                configurable: true,
                enumerable: false
            });
        }

        // Add realistic touch support even on non-touch devices
        // navigator.maxTouchPoints is already set to 0 for desktop
        if (typeof TouchEvent === 'undefined') {
            // Define TouchEvent for completeness, even though maxTouchPoints is 0
            window.TouchEvent = class TouchEvent extends UIEvent {
                constructor(type, options) {
                    super(type, options);
                }
            };
        }

        // Add realistic PointerEvent support
        if (typeof PointerEvent !== 'undefined') {
            Object.defineProperty(PointerEvent.prototype, 'toJSON', {
                value: function() {
                    return {};
                },
                configurable: true,
                enumerable: false
            });
        }

        // Ensure proper event firing behavior
        // Some detection scripts check if events are fired in the correct order
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            // Call original but ensure it behaves like real Chrome
            return originalAddEventListener.call(this, type, listener, options);
        };

        // Make addEventListener look native
        mockedFunctions.add(EventTarget.prototype.addEventListener);

    } catch (err) {
        // Silently skip - these anti-bot measures are optional and may fail in newer browsers
    }

    // Add automation recording functionality with persistence
    // Check if recording should be active (persists across navigations)
    const checkAndStartRecording = function() {
        const isRecording = sessionStorage.getItem('__automationRecording') === 'true';
        if (isRecording) {
            window.__startAutomationRecording();
        }
    };

    window.__startAutomationRecording = function() {
        if (window.__automationRecording) {
            return;
        }

        window.__automationRecording = true;
        // Store in sessionStorage to persist across page navigations
        sessionStorage.setItem('__automationRecording', 'true');

        // Add visual indicator
        const indicator = document.createElement('div');
        indicator.id = 'recording-indicator';
        indicator.style.cssText = 'position: fixed; top: 10px; right: 10px; background: red; color: white; padding: 5px 10px; z-index: 999999; font-family: monospace; pointer-events: none;';
        indicator.textContent = '🔴 RECORDING';

        // Wait for body to be available
        if (document.body) {
            document.body.appendChild(indicator);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(indicator);
            });
        }

        let actionCount = 0;

        // Function to send actions to main process
        function sendAction(action) {
            actionCount++;

            // Update indicator
            const ind = document.getElementById('recording-indicator');
            if (ind) {
                ind.textContent = '🔴 RECORDING (' + actionCount + ')';
                ind.style.background = 'green';
                setTimeout(() => { ind.style.background = 'red'; }, 200);
            }

            // Send action via console.log for webview communication
            console.log('AUTOMATION_ACTION:' + JSON.stringify(action));

            // Try to use IPC to send to host
            try {
                // In webview context, we need to use postMessage to communicate with the host
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        type: 'AUTOMATION_ACTION',
                        action: action
                    }, '*');
                }
            } catch (err) {
                // Silently handle error
            }
        }

        // Helper to get field label text
        function getFieldLabel(element) {
            // Method 1: Label with 'for' attribute
            if (element.id) {
                const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
                if (label) {
                    return label.textContent.trim();
                }
            }

            // Method 2: Wrapping label
            const parentLabel = element.closest('label');
            if (parentLabel) {
                // Get text content but exclude the input's own text
                const labelClone = parentLabel.cloneNode(true);
                const inputs = labelClone.querySelectorAll('input, select, textarea');
                inputs.forEach(input => input.remove());
                return labelClone.textContent.trim();
            }

            // Method 3: Previous sibling label
            let prevSibling = element.previousElementSibling;
            while (prevSibling) {
                if (prevSibling.tagName === 'LABEL') {
                    return prevSibling.textContent.trim();
                }
                // Also check for text in spans or divs immediately before
                if ((prevSibling.tagName === 'SPAN' || prevSibling.tagName === 'DIV') &&
                    prevSibling.textContent && prevSibling.textContent.trim().length < 50) {
                    return prevSibling.textContent.trim();
                }
                prevSibling = prevSibling.previousElementSibling;
            }

            // Method 4: aria-labelledby
            const labelledBy = element.getAttribute('aria-labelledby');
            if (labelledBy) {
                const labelElement = document.getElementById(labelledBy);
                if (labelElement) {
                    return labelElement.textContent.trim();
                }
            }

            // Method 5: placeholder as last resort
            if (element.placeholder) {
                return element.placeholder;
            }

            return null;
        }

        // Smart selector generation with multiple strategies
        function generateBestSelector(element) {
            const tagName = element.tagName.toLowerCase();

            // Priority 1: ID (most reliable and fastest)
            if (element.id && element.id.trim() && !element.id.match(/^[0-9]/) && element.id.length < 50) {
                const escapedId = CSS.escape(element.id);
                // Verify uniqueness
                if (document.querySelectorAll('#' + escapedId).length === 1) {
                    return '#' + escapedId;
                }
            }

            // Priority 2: data attributes commonly used for testing
            const dataAttributes = ['data-testid', 'data-test', 'data-test-id', 'data-cy', 'data-qa', 'data-id', 'data-target'];
            for (const attr of dataAttributes) {
                const value = element.getAttribute(attr);
                if (value) {
                    const selector = `[${attr}="${CSS.escape(value)}"]`;
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                    // Try with tag name for more specificity
                    const tagSelector = `${tagName}[${attr}="${CSS.escape(value)}"]`;
                    if (document.querySelectorAll(tagSelector).length === 1) {
                        return tagSelector;
                    }
                }
            }

            // Priority 3: Form elements - use label association
            if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
                // Try name attribute first
                if (element.name) {
                    const selector = `${tagName}[name="${CSS.escape(element.name)}"]`;
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }

                // Try type + placeholder for inputs
                if (tagName === 'input' && element.type && element.placeholder) {
                    const selector = `input[type="${element.type}"][placeholder="${CSS.escape(element.placeholder)}"]`;
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }

                // Try to find associated label
                const label = getFieldLabel(element);
                if (label) {
                    // Use label text to identify the field
                    const labelText = label.replace(/[^\w\s]/g, '').trim();
                    if (labelText) {
                        return `${tagName}[label="${labelText}"]/*labeled*/`;
                    }
                }
            }

            // Priority 4: Buttons and links - use text content
            if (tagName === 'button' || tagName === 'a') {
                const text = (element.textContent || '').trim();
                if (text && text.length > 2 && text.length < 50) {
                    // Check if text is reasonably unique
                    const sameTextElements = Array.from(document.querySelectorAll(tagName)).filter(el =>
                        el.textContent && el.textContent.trim() === text
                    );
                    if (sameTextElements.length === 1) {
                        return `${tagName}:contains("${text.substring(0, 30)}")/*text*/`;
                    }
                    // If not unique, try with parent context
                    if (sameTextElements.length <= 3) {
                        const parent = element.parentElement;
                        if (parent && parent.className) {
                            const parentClass = parent.className.split(/\s+/)[0];
                            if (parentClass && !parentClass.match(/^(css-|sc-)/)) {
                                return `.${CSS.escape(parentClass)} ${tagName}:contains("${text.substring(0, 30)}")/*text*/`;
                            }
                        }
                    }
                }

                // For links, also try href
                if (tagName === 'a' && element.href) {
                    const href = element.getAttribute('href'); // Get relative href
                    if (href && !href.startsWith('javascript:')) {
                        const selector = `a[href="${CSS.escape(href)}"]`;
                        if (document.querySelectorAll(selector).length === 1) {
                            return selector;
                        }
                    }
                }
            }

            // Priority 5: ARIA attributes
            const ariaAttrs = ['aria-label', 'aria-labelledby', 'aria-describedby', 'role'];
            for (const attr of ariaAttrs) {
                const value = element.getAttribute(attr);
                if (value && value.length < 50) {
                    const selector = `${tagName}[${attr}="${CSS.escape(value)}"]`;
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }
            }

            // Priority 6: Images - use alt or src
            if (tagName === 'img') {
                if (element.alt) {
                    const selector = `img[alt="${CSS.escape(element.alt)}"]`;
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }
                if (element.src) {
                    // Use just the filename from src
                    const filename = element.src.split('/').pop().split('?')[0];
                    if (filename) {
                        const selector = `img[src*="${CSS.escape(filename)}"]`;
                        if (document.querySelectorAll(selector).length === 1) {
                            return selector;
                        }
                    }
                }
            }

            // Priority 7: Try unique class combinations
            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\s+/)
                    .filter(c => c && !c.match(/^(active|focus|hover|selected|disabled|css-|sc-|js-|is-|has-)/));

                if (classes.length > 0) {
                    // Try most specific class first
                    for (const cls of classes) {
                        const classSelector = `.${CSS.escape(cls)}`;
                        const matches = document.querySelectorAll(classSelector);
                        if (matches.length === 1) {
                            return classSelector;
                        }
                        // Try with tag name
                        const tagClassSelector = `${tagName}.${CSS.escape(cls)}`;
                        const tagMatches = document.querySelectorAll(tagClassSelector);
                        if (tagMatches.length === 1) {
                            return tagClassSelector;
                        }
                    }

                    // Try combination of meaningful classes
                    if (classes.length >= 2) {
                        const comboSelector = `${tagName}.${classes.slice(0, 2).map(c => CSS.escape(c)).join('.')}`;
                        try {
                            const matches = document.querySelectorAll(comboSelector);
                            if (matches.length === 1) {
                                return comboSelector;
                            }
                        } catch (e) {}
                    }
                }
            }

            // Priority 8: Position-based with parent context
            const parent = element.parentElement;
            if (parent) {
                // Try to identify parent uniquely first
                let parentSelector = null;

                // Check if parent has ID
                if (parent.id && parent.id.trim()) {
                    parentSelector = '#' + CSS.escape(parent.id);
                } else if (parent.className) {
                    const parentClasses = parent.className.trim().split(/\s+/)
                        .filter(c => c && !c.match(/^(active|focus|hover|selected|disabled|css-|sc-)/));
                    if (parentClasses.length > 0) {
                        const parentClass = `.${CSS.escape(parentClasses[0])}`;
                        // Check if parent class is reasonably unique
                        if (document.querySelectorAll(parentClass).length <= 3) {
                            parentSelector = parentClass;
                        }
                    }
                }

                if (parentSelector) {
                    // Count siblings of same type
                    const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);

                    if (siblings.length === 1) {
                        // Only child of this type
                        return `${parentSelector} > ${tagName}`;
                    } else if (siblings.length <= 5) {
                        // Try to find distinguishing attribute
                        for (const attr of ['type', 'name', 'placeholder', 'value', 'title']) {
                            const value = element.getAttribute(attr);
                            if (value) {
                                const selectorWithAttr = `${parentSelector} > ${tagName}[${attr}="${CSS.escape(value)}"]`;
                                if (document.querySelectorAll(selectorWithAttr).length === 1) {
                                    return selectorWithAttr;
                                }
                            }
                        }

                        // Use position among siblings
                        const index = siblings.indexOf(element);
                        if (index >= 0) {
                            return `${parentSelector} > ${tagName}:eq(${index})/*positional*/`;
                        }
                    }
                }
            }

            // Priority 9: Build minimal path as last resort
            // Try to build a simple, robust path
            const pathElements = [];
            let curr = element;
            let levels = 0;

            while (curr && curr !== document.body && levels < 2) {
                // Skip if we've already found a good anchor
                if (curr.id && curr.id.trim() && !curr.id.match(/^[0-9]/)) {
                    pathElements.unshift('#' + CSS.escape(curr.id));
                    break;
                }

                // Try to use a meaningful selector for this level
                const currTag = curr.tagName.toLowerCase();
                let levelSelector = currTag;

                // Add first meaningful class if available
                if (curr.className && typeof curr.className === 'string') {
                    const meaningfulClass = curr.className.trim().split(/\s+/)
                        .find(c => c && !c.match(/^(active|focus|hover|selected|disabled|css-|sc-|js-)/));
                    if (meaningfulClass) {
                        levelSelector = `${currTag}.${CSS.escape(meaningfulClass)}`;
                    }
                }

                pathElements.unshift(levelSelector);
                curr = curr.parentElement;
                levels++;
            }

            if (pathElements.length > 0) {
                const pathSelector = pathElements.join(' ');
                try {
                    const matches = document.querySelectorAll(pathSelector);
                    if (matches.length === 1) {
                        return pathSelector;
                    }
                    // If we have a small number of matches, add index
                    if (matches.length <= 10) {
                        const idx = Array.from(matches).indexOf(element);
                        if (idx >= 0) {
                            return `${pathSelector}:eq(${idx})/*path*/`;
                        }
                    }
                } catch (e) {}
            }

            // Fallback: use simple tag name or with text content

            // Try to use text content for buttons and links
            if ((tagName === 'button' || tagName === 'a') && element.textContent) {
                const text = element.textContent.trim().substring(0, 30);
                if (text) {
                    // This is a pseudo-selector that the backend can handle
                    return `${tagName}[text="${text}"]`;
                }
            }

            // Last resort: just return the tag name
            return tagName;
        }

        // Generate XPath as fallback
        function generateXPath(element) {
            if (element.id) {
                return `//*[@id="${element.id}"]`;
            }

            const parts = [];
            let current = element;

            while (current && current.nodeType === Node.ELEMENT_NODE) {
                let index = 1;
                let sibling = current.previousSibling;

                while (sibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
                        index++;
                    }
                    sibling = sibling.previousSibling;
                }

                const tagName = current.nodeName.toLowerCase();
                const part = `${tagName}[${index}]`;
                parts.unshift(part);

                if (current.parentNode === document.body) {
                    parts.unshift('body');
                    break;
                }

                current = current.parentNode;
            }

            return '/' + parts.join('/');
        }

        // Track clicks primarily with coordinates
        document.addEventListener('click', function(e) {
            const target = e.target;

            // Skip click tracking for checkboxes and radios - they're handled by change event
            if (target.type === 'checkbox' || target.type === 'radio') {
                return;
            }

            // Primary data: mouse coordinates
            const actionData = {
                type: 'click',
                x: e.clientX,
                y: e.clientY,
                pageX: e.pageX,  // Include page coordinates for scrolled content
                pageY: e.pageY,
                text: (target.innerText || target.textContent || '').substring(0, 50).trim(),
                tagName: target.tagName.toLowerCase(),
                timestamp: Date.now()
            };

            // Still include selector as fallback/debugging info but not primary
            try {
                const selector = generateBestSelector(target);
                const xpath = generateXPath(target);
                actionData.selector = selector;
                actionData.xpath = xpath;

                // Get element attributes for additional context
                const attributes = {};
                if (target.href) attributes.href = target.href;
                if (target.value) attributes.value = target.value;
                if (target.placeholder) attributes.placeholder = target.placeholder;
                actionData.attributes = attributes;
            } catch (err) {
                console.warn('[Recording] Could not generate selector:', err);
            }

            sendAction(actionData);
        }, true);

        // Enhanced form field tracking
        function getFormContext(element) {
            const form = element.closest('form');
            const context = {
                inForm: !!form,
                formId: form?.id || null,
                formName: form?.name || null,
                formAction: form?.action || null,
                formMethod: form?.method || null
            };

            // Try to find associated label
            let label = null;

            // Method 1: Label with 'for' attribute
            if (element.id) {
                const labelElement = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
                if (labelElement) {
                    label = labelElement.textContent.trim();
                }
            }

            // Method 2: Parent label
            if (!label) {
                const parentLabel = element.closest('label');
                if (parentLabel) {
                    label = parentLabel.textContent.replace(element.outerHTML, '').trim();
                }
            }

            // Method 3: Previous sibling label
            if (!label) {
                let sibling = element.previousElementSibling;
                if (sibling && sibling.tagName === 'LABEL') {
                    label = sibling.textContent.trim();
                }
            }

            // Method 4: Look for nearby text
            if (!label && element.parentElement) {
                const parent = element.parentElement;
                const textNodes = Array.from(parent.childNodes)
                    .filter(node => node.nodeType === Node.TEXT_NODE)
                    .map(node => node.textContent.trim())
                    .filter(text => text.length > 0);
                if (textNodes.length > 0) {
                    label = textNodes[0];
                }
            }

            context.label = label;
            context.fieldName = element.name || null;
            context.fieldType = element.type || 'text';
            context.required = element.required || false;
            context.pattern = element.pattern || null;

            // Build a form-relative selector if in a form
            if (form) {
                const formSelector = generateBestSelector(form);
                const fieldName = element.name;

                if (fieldName) {
                    context.formRelativeSelector = `${formSelector} [name="${CSS.escape(fieldName)}"]`;
                } else {
                    // Fall back to position within form
                    const inputs = Array.from(form.querySelectorAll('input, textarea, select'));
                    const index = inputs.indexOf(element);
                    if (index >= 0) {
                        const tagName = element.tagName.toLowerCase();
                        context.formRelativeSelector = `${formSelector} ${tagName}:nth-of-type(${index + 1})`;
                    }
                }
            }

            return context;
        }

        // Track focus on form fields to capture field entry order
        document.addEventListener('focusin', function(e) {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                const selector = generateBestSelector(target);
                const formContext = getFormContext(target);

                sendAction({
                    type: 'focus',
                    selector: selector,
                    formContext: formContext,
                    timestamp: Date.now()
                });
            }
        }, true);

        // Track input with debouncing and form context
        let inputTimeouts = new WeakMap();
        document.addEventListener('input', function(e) {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                // Clear any existing timeout for this element
                if (inputTimeouts.has(target)) {
                    clearTimeout(inputTimeouts.get(target));
                }

                // Set a new timeout to debounce input
                const timeout = setTimeout(() => {
                    const selector = generateBestSelector(target);
                    const xpath = generateXPath(target);
                    const formContext = getFormContext(target);

                    sendAction({
                        type: 'type',
                        selector: selector,
                        xpath: xpath,
                        value: target.value,
                        inputType: target.type || 'text',
                        placeholder: target.placeholder || '',
                        label: formContext.label,
                        formContext: formContext,
                        timestamp: Date.now()
                    });

                    inputTimeouts.delete(target);
                }, 500); // Wait 500ms after user stops typing

                inputTimeouts.set(target, timeout);
            }
        }, true);

        // Track select/dropdown changes
        document.addEventListener('change', function(e) {
            const target = e.target;
            if (target.tagName === 'SELECT') {
                const selector = generateBestSelector(target);
                const formContext = getFormContext(target);
                const selectedOption = target.options[target.selectedIndex];

                sendAction({
                    type: 'select',
                    selector: selector,
                    value: target.value,
                    text: selectedOption ? selectedOption.text : '',
                    label: formContext.label,
                    formContext: formContext,
                    timestamp: Date.now()
                });
            } else if (target.type === 'checkbox' || target.type === 'radio') {
                const selector = generateBestSelector(target);
                const xpath = generateXPath(target);
                const formContext = getFormContext(target);
                const label = getFieldLabel(target) || formContext.label || '';

                // For radio buttons, also track the group
                let radioGroup = null;
                if (target.type === 'radio' && target.name) {
                    radioGroup = {
                        name: target.name,
                        formSelector: formContext.selector
                    };
                }

                sendAction({
                    type: 'checkbox',  // Use 'checkbox' for both checkbox and radio for consistency
                    inputType: target.type,  // Store actual type here
                    selector: selector,
                    xpath: xpath,
                    checked: target.checked,
                    value: target.value || 'on',
                    name: target.name || '',
                    radioGroup: radioGroup,
                    label: label,
                    formContext: formContext,
                    timestamp: Date.now()
                });
            }
        }, true);

        // Mouse movement tracking for precise hover simulation
        // Track mouse movements with throttling to avoid overwhelming the system
        let lastMouseX = -1;
        let lastMouseY = -1;
        let lastMouseMoveTime = 0;
        const mouseMoveThrottle = 100; // Reduced throttle for better tracking (ms)
        const significantDistance = 10; // Reduced distance for more sensitive tracking

        document.addEventListener('mousemove', function(e) {
            const now = Date.now();

            // Calculate distance from last position
            let distance = 999;
            if (lastMouseX !== -1 && lastMouseY !== -1) {
                distance = Math.sqrt(
                    Math.pow(e.clientX - lastMouseX, 2) +
                    Math.pow(e.clientY - lastMouseY, 2)
                );
            }

            // Check if we're near interactive elements (for more frequent tracking)
            const element = document.elementFromPoint(e.clientX, e.clientY);
            const nearInteractive = element && (
                element.tagName === 'A' ||
                element.tagName === 'BUTTON' ||
                element.tagName === 'INPUT' ||
                element.tagName === 'SELECT' ||
                element.tagName === 'TEXTAREA' ||
                element.hasAttribute('onclick') ||
                element.hasAttribute('data-toggle') ||
                element.hasAttribute('aria-haspopup') ||
                element.classList.contains('dropdown')
            );

            // Record mouse move if throttle time passed and movement is significant
            // Or if this is the first movement, or if near interactive elements
            if ((now - lastMouseMoveTime > mouseMoveThrottle && distance > significantDistance) ||
                (nearInteractive && now - lastMouseMoveTime > mouseMoveThrottle/2) ||
                lastMouseX === -1) {

                const action = {
                    type: 'mousemove',
                    x: e.clientX,
                    y: e.clientY,
                    timestamp: now,
                    nearElement: nearInteractive ? element.tagName.toLowerCase() : null
                };

                sendAction(action);

                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                lastMouseMoveTime = now;
            }
        }, true);

        // Scroll tracking with improved responsiveness
        let lastScrollTime = 0;
        let scrollTimeout = null;
        let lastScrollX = 0;
        let lastScrollY = 0;
        const scrollThrottle = 150; // Reduced throttle to capture more scroll events

        const handleScroll = function() {
            const now = Date.now();
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;

            // Clear any pending timeout
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
                scrollTimeout = null;
            }

            // Function to send scroll action
            const sendScrollAction = () => {
                const currentScrollX = window.pageXOffset || document.documentElement.scrollLeft;
                const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

                // Calculate scroll delta since last recorded position
                const deltaX = currentScrollX - lastScrollX;
                const deltaY = currentScrollY - lastScrollY;

                const action = {
                    type: 'scroll',
                    x: currentScrollX,
                    y: currentScrollY,
                    deltaX: deltaX,
                    deltaY: deltaY,
                    timestamp: Date.now(),
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    document: {
                        width: document.documentElement.scrollWidth,
                        height: document.documentElement.scrollHeight
                    }
                };

                sendAction(action);
                lastScrollX = currentScrollX;
                lastScrollY = currentScrollY;
                lastScrollTime = Date.now();
            };

            // Check if scroll position actually changed (avoid duplicate events)
            if (Math.abs(scrollX - lastScrollX) < 1 && Math.abs(scrollY - lastScrollY) < 1) {
                return; // No significant scroll change
            }

            // Throttle scroll events but ensure we capture the final position
            if (now - lastScrollTime > scrollThrottle) {
                sendScrollAction();
            } else {
                // Set timeout to capture final scroll position
                scrollTimeout = setTimeout(sendScrollAction, scrollThrottle);
            }
        };

        // Listen for scroll events on both window and document
        window.addEventListener('scroll', handleScroll, true);
        document.addEventListener('scroll', handleScroll, true);

        // Track wheel events to ensure we don't miss scroll attempts
        document.addEventListener('wheel', function(e) {
            // Trigger scroll handler to ensure we capture wheel-based scrolling
            handleScroll();
        }, { passive: true });

        // Keyboard tracking for special keys including Enter
        document.addEventListener('keydown', function(e) {
            const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

            // Only track special keys
            if (!specialKeys.includes(e.key)) return;

            const target = e.target;
            let selector = '';

            // Build selector
            if (target.id && target.id.trim() !== '') {
                selector = '#' + target.id;
            } else if (target.name && target.name.trim() !== '') {
                selector = '[name="' + target.name + '"]';
            } else if (target.getAttribute('aria-label')) {
                selector = '[aria-label="' + target.getAttribute('aria-label') + '"]';
            } else if (target.className && typeof target.className === 'string') {
                const classes = target.className.trim().split(/\s+/).filter(c => c);
                if (classes.length > 0) {
                    selector = '.' + classes.join('.');
                }
            } else {
                selector = target.tagName.toLowerCase();
            }

            sendAction({
                type: 'keypress',
                selector: selector,
                key: e.key,
                timestamp: Date.now()
            });
        }, true);

        // Track form submissions with all field values
        document.addEventListener('submit', function(e) {
            const form = e.target;
            let formSelector = '';

            if (form.id) {
                formSelector = '#' + CSS.escape(form.id);
            } else if (form.name) {
                formSelector = 'form[name="' + CSS.escape(form.name) + '"]';
            } else if (form.className && typeof form.className === 'string') {
                const classes = form.className.trim().split(/\s+/).filter(c => c);
                if (classes.length > 0) {
                    formSelector = 'form.' + classes.map(c => CSS.escape(c)).join('.');
                }
            } else {
                formSelector = 'form';
            }

            // Capture all form field values at submission time
            const formData = {};
            const fields = [];

            // Collect all form fields
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(field => {
                const fieldInfo = {
                    selector: generateSelector(field),
                    name: field.name || '',
                    type: field.type || field.tagName.toLowerCase(),
                    value: '',
                    label: ''
                };

                // Get field value based on type
                if (field.type === 'checkbox' || field.type === 'radio') {
                    fieldInfo.value = field.checked;
                    fieldInfo.checked = field.checked;
                } else if (field.tagName === 'SELECT') {
                    fieldInfo.value = field.value;
                    const selectedOption = field.options[field.selectedIndex];
                    if (selectedOption) {
                        fieldInfo.selectedText = selectedOption.text;
                    }
                } else {
                    fieldInfo.value = field.value;
                }

                // Get the label
                const label = getFieldLabel(field);
                if (label) {
                    fieldInfo.label = label;
                }

                fields.push(fieldInfo);

                // Also store in formData object for easy access by name
                if (field.name) {
                    formData[field.name] = fieldInfo.value;
                }
            });

            sendAction({
                type: 'submit',
                selector: formSelector,
                formData: formData,
                fields: fields,
                method: form.method || 'get',
                action: form.action || '',
                timestamp: Date.now()
            });
        }, true);

    };

    // Add stop recording function
    window.__stopAutomationRecording = function() {
        window.__automationRecording = false;
        sessionStorage.removeItem('__automationRecording');

        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.remove();
        }
    };

    // Auto-start recording if it was active before navigation
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndStartRecording);
    } else {
        // DOM already loaded, check immediately
        checkAndStartRecording();
    }

    // Auto-focus body when page loads to enable keyboard navigation
    window.addEventListener('DOMContentLoaded', function() {
        // Make body focusable
        document.body.tabIndex = -1;

        // Focus the body
        document.body.focus();

        // Also set up a focus handler to refocus if focus is lost
        document.addEventListener('blur', function(e) {
            if (e.target === document.body && document.activeElement !== document.body) {
                setTimeout(() => {
                    document.body.focus();
                }, 100);
            }
        }, true);

    });

    // Also try to focus as soon as body is available
    const focusBody = function() {
        if (document.body) {
            document.body.tabIndex = -1;
            document.body.focus();
        } else {
            setTimeout(focusBody, 10);
        }
    };
    focusBody();
})();

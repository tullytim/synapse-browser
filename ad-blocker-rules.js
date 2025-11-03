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

// Ad blocking rules for common ad networks and trackers
const AD_BLOCK_RULES = {
    // IMPORTANT: Bot detection services should NEVER be blocked
    // Blocking them makes you MORE detectable as a bot
    whitelist: [
        'perimeterx.net',
        'px-cdn.net',
        'px-cloud.net',
        'datadome.co',
        'cloudflare.com/cdn-cgi/challenge',
        'recaptcha.net',
        'gstatic.com/recaptcha',
        'hcaptcha.com',
        'arkoselabs.com',
        'funcaptcha.com'
    ],

    // Common ad domains
    domains: [
        'doubleclick.net',
        'googleadservices.com',
        'googlesyndication.com',
        'google-analytics.com',
        'googletagmanager.com',
        'googletagservices.com',
        'adsystem.com',
        'adsrvr.org',
        'adzerk.net',
        'amazon-adsystem.com',
        'facebook.com/tr',
        'connect.facebook.net',
        'platform.twitter.com/widgets',
        // 'platform.linkedin.com/in.js', // Commented out - breaks LinkedIn messaging
        'scorecardresearch.com',
        'quantserve.com',
        'outbrain.com',
        'taboola.com',
        'criteo.com',
        'criteo.net',
        'casalemedia.com',
        'openx.net',
        'pubmatic.com',
        'rubiconproject.com',
        'adsafeprotected.com',
        'moatads.com',
        'contextual.media.net',
        'yieldmo.com',
        'sharethrough.com',
        'bidswitch.net',
        'adnxs.com',
        'adsymptotic.com',
        'indexww.com',
        'sovrn.com',
        '3lift.com',
        'spotxchange.com',
        'teads.tv',
        'stickyadstv.com',
        'smartadserver.com',
        'adtech.de',
        'adsrvr.org',
        'media.net',
        'adroll.com',
        'nextroll.com',
        'hotjar.com',
        'fullstory.com',
        'segment.io',
        'segment.com',
        'mixpanel.com',
        'amplitude.com',
        'branch.io',
        'appsflyer.com',
        'adjust.com',
        'kochava.com',
        'tealiumiq.com',
        'nr-data.net',
        'newrelic.com',
        'bugsnag.com',
        'sentry.io',
        'rollbar.com',
        'trackjs.com',
        'logrocket.com',
        'datadog-rum-us.com'
    ],

    // URL patterns to block
    urlPatterns: [
        '*://*.doubleclick.net/*',
        '*://*.googleadservices.com/*',
        '*://*.googlesyndication.com/*',
        '*://*.google-analytics.com/*',
        '*://*.googletagmanager.com/*',
        '*://*.googletagservices.com/*',
        '*://*.facebook.com/tr*',
        '*://*.amazon-adsystem.com/*',
        '*://*.adsystem.com/*',
        '*://*/ads/*',
        '*://*/advertisement/*',
        '*://*/advertising/*',
        '*://*/banner/*',
        '*://*/banners/*',
        '*://*/popup/*',
        '*://*/popunder/*',
        // NOTE: Removed generic tracking/analytics patterns - they block bot detection services
        // '*://*/tracking/*',
        // '*://*/analytics/*',
        '*://*/metrics/*',
        '*://*/telemetry/*',
        '*://*/pixel/*',
        '*://*/pixels/*',
        '*://*/beacon/*',
        '*://*/collect/*',
        '*://*/tag/*',
        '*://*/tags/*',
        '*://*/impression/*',
        '*://*/click/*',
        '*://*/conversion/*',
        '*://*/_ga/*',
        '*://*/_gid/*',
        '*://*/_utm*',
        '*://*/fbclid*'
    ],

    // Common ad element selectors to hide
    cssSelectors: [
        // Generic ad containers
        'div[id*="ad"]',
        'div[id*="Ad"]',
        'div[id*="ads"]',
        'div[id*="Ads"]',
        'div[class*="ad-"]',
        'div[class*="ads-"]',
        'div[class*="advertisement"]',
        'div[class*="advertising"]',
        'iframe[id*="google_ads"]',
        'iframe[src*="doubleclick"]',
        'iframe[src*="googlesyndication"]',

        // Specific ad containers
        '.google-ad',
        '.google-ads',
        '.googlead',
        '.googleads',
        '.ad-container',
        '.ads-container',
        '.advertisement-container',
        '.banner-ad',
        '.banner-ads',
        '.display-ad',
        '.display-ads',
        '.sponsored-content',
        '.promoted-content',
        '.native-ad',
        '.native-ads',

        // Social media embeds (often tracking)
        '.twitter-timeline',
        '.fb-like',
        '.fb-like-box',
        '.fb-page',

        // Newsletter popups
        '[class*="newsletter-popup"]',
        '[class*="newsletter-modal"]',
        '[class*="email-popup"]',
        '[class*="subscribe-popup"]',

        // Cookie banners (optional)
        // '[class*="cookie-banner"]',
        // '[class*="cookie-consent"]',
        // '[id*="cookie-banner"]',
        // '[id*="cookie-consent"]'
    ]
};

module.exports = AD_BLOCK_RULES;
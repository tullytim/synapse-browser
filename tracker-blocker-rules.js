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

// Tracker blocking rules for tracking pixels and beacons
const TRACKER_BLOCK_RULES = {
    // IMPORTANT: CAPTCHAs and bot detection services should NEVER be blocked
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
        'funcaptcha.com',
        'captcha',
        'turnstile'
    ],

    // Tracking pixel and beacon domains
    domains: [
        // Analytics and tracking
        'google-analytics.com',
        'googletagmanager.com',
        'googletagservices.com',
        'facebook.com/tr',
        'connect.facebook.net/en_US/fbevents.js',
        'facebook.net/en_US/fbevents.js',
        'scorecardresearch.com',
        'quantserve.com',
        'hotjar.com',
        'fullstory.com',
        'segment.io',
        'segment.com',
        'mixpanel.com',
        'amplitude.com',
        'heap.io',
        'heapanalytics.com',

        // Marketing pixels
        'doubleclick.net/activity',
        'adnxs.com/seg',
        'adnxs.com/px',
        'adsrvr.org/track',
        'facebook.com/tr/',
        'pinterest.com/ct/',
        'snap.com/pixel',
        'snapchat.com/pixel',
        'linkedin.com/px/',
        'linkedin.com/li.lms-analytics',
        'twitter.com/i/adsct',
        'ads-twitter.com/i/adsct',
        'analytics.twitter.com',
        't.co/i/adsct',
        'bing.com/bat.js',
        'bat.bing.com',
        'clarity.ms',
        'yahoo.com/fpc',
        'amazon-adsystem.com/aax2/apstag.js',

        // Attribution and conversion tracking
        'branch.io',
        'app.link',
        'appsflyer.com',
        'adjust.com',
        'kochava.com',
        'singular.net',
        'tune.com',
        'impact.com',
        'shareasale.com',
        'cj.com',
        'avantlink.com',
        'awin1.com',
        'partnerize.com',

        // Heatmaps and session recording
        'mouseflow.com',
        'crazyegg.com',
        'luckyorange.com',
        'inspectlet.com',
        'sessioncam.com',

        // Product analytics
        'tealiumiq.com',
        'ensighten.com',
        'omniture.com',
        'adobe.com/b/ss',
        'mktoresp.com',
        'marketo.net',
        'pardot.com',
        'hubspot.com/__hs/analytics',
        'hs-analytics.net',
        'hs-banner.com',
        'usemessages.com',

        // Error tracking (may include user tracking)
        'nr-data.net',
        'newrelic.com/jserrors',
        'bugsnag.com',
        'sentry.io',
        'rollbar.com',
        'trackjs.com',
        'logrocket.com',
        'datadog-rum-us.com',
        'datadog-rum-eu.com',
        'datadog-rum-ap.com',

        // E-commerce tracking
        'criteo.com',
        'criteo.net',
        'rtbhouse.com',
        'cdn.taboola.com',
        'cdn.outbrain.com',

        // Other tracking services
        'rum-static.pingdom.net',
        'stats.wp.com',
        'pixel.wp.com',
        'stats.g.doubleclick.net',
        'b.scorecardresearch.com',
        'sb.scorecardresearch.com',
        'pixel.tapad.com',
        'bidswitch.net/sync',
        'match.adsrvr.org'
    ],

    // URL patterns to block (tracking pixels, beacons, and conversion tracking)
    urlPatterns: [
        // Generic tracking patterns
        '*://*/pixel.gif*',
        '*://*/pixel.png*',
        '*://*/tracking.gif*',
        '*://*/track.gif*',
        '*://*/beacon.gif*',
        '*://*/clear.gif*',
        '*://*/transparent.gif*',
        '*://*/1x1.gif*',
        '*://*/pixel/*',
        '*://*/pixels/*',
        '*://*/beacon/*',
        '*://*/beacons/*',
        '*://*/track*',
        '*://*/tracking/*',
        '*://*/analytics/*',
        '*://*/collect*',
        '*://*/events*',
        '*://*/impression*',
        '*://*/conversion*',
        '*://*/pageview*',

        // Specific service patterns
        '*://*.google-analytics.com/collect*',
        '*://*.google-analytics.com/j/collect*',
        '*://*.google-analytics.com/g/collect*',
        '*://www.google-analytics.com/analytics.js',
        '*://www.google-analytics.com/ga.js',
        '*://*.googletagmanager.com/gtm.js*',
        '*://*.facebook.com/tr*',
        '*://*.facebook.com/tr/*',
        '*://connect.facebook.net/*/fbevents.js',
        '*://ct.pinterest.com/*',
        '*://ct.pinterest.com/v3/*',
        '*://analytics.tiktok.com/*',
        '*://analytics.twitter.com/*',
        '*://t.co/i/adsct*',
        '*://px.ads.linkedin.com/*',
        '*://www.linkedin.com/px/*',
        '*://bat.bing.com/bat.js',
        '*://c.clarity.ms/*',
        '*://www.clarity.ms/*',

        // UTM and tracking parameters (query strings)
        '*://*?*utm_*',
        '*://*&utm_*',
        '*://*?*fbclid=*',
        '*://*&fbclid=*',
        '*://*?*gclid=*',
        '*://*&gclid=*',
        '*://*?*msclkid=*',
        '*://*&msclkid=*',
        '*://*?*mc_cid=*',
        '*://*&mc_cid=*',

        // Specific pixel endpoints
        '*://tr.snapchat.com/*',
        '*://sc-static.net/scevent.min.js',
        '*://analytics.reddit.com/*',
        '*://alb.reddit.com/*',
        '*://adsymptotic.com/*',
        '*://amazon-adsystem.com/*/pixel*',

        // Session recording and heatmaps
        '*://script.hotjar.com/*',
        '*://*.mouseflow.com/*',
        '*://*.crazyegg.com/*',
        '*://*.luckyorange.com/*',
        '*://*.fullstory.com/*',
        '*://*.heap.io/*',

        // Attribution pixels
        '*://app.link/*',
        '*://*.branch.io/*/pixel*',
        '*://*.appsflyer.com/*/event*',
        '*://*.adjust.com/*/event*'
    ],

    // Resource types that are typically tracking pixels/beacons
    // These will be checked in addition to URL patterns
    resourceTypes: [
        'ping',  // Beacon API
        'csp_report'  // CSP reports can leak info
    ]
};

module.exports = TRACKER_BLOCK_RULES;

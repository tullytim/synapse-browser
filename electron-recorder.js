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

/**
 * ElectronRecorder - Records user interactions in Electron webviews
 * Uses IPC communication instead of CDP for better compatibility
 */
class ElectronRecorder {
    constructor(ipcCallback) {
        this.isRecording = false;
        this.recordedActions = [];
        this.lastUrl = null;
        this.ipcCallback = ipcCallback;
    }

    /**
     * Start recording user interactions
     */
    startRecording(initialUrl = null) {
        this.isRecording = true;
        this.recordedActions = [];
        this.lastUrl = initialUrl;

        // Add the initial navigate action if we have a URL
        if (initialUrl && initialUrl !== 'about:blank') {
            this.recordedActions.push({
                type: 'navigate',
                url: initialUrl,
                timestamp: Date.now()
            });
        }

        // Request the renderer to inject recording script
        if (this.ipcCallback) {
            this.ipcCallback('inject-recording-script');
        }

        return true;
    }

    /**
     * Add a recorded action from the renderer
     */
    addAction(action) {
        if (!this.isRecording) return;

        // Handle navigation specially
        if (action.type === 'navigate' && action.url === this.lastUrl) {
            return; // Skip duplicate navigations
        }

        this.recordedActions.push({
            ...action,
            timestamp: action.timestamp || Date.now()
        });

        if (action.type === 'navigate') {
            this.lastUrl = action.url;
        }

    }

    /**
     * Stop recording and return actions
     */
    stopRecording() {
        this.isRecording = false;

        // Sort actions by timestamp
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

module.exports = ElectronRecorder;
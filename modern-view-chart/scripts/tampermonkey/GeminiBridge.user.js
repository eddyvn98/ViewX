// ==UserScript==
// @name         Gemini Bridge for ViewX (v1.7 CSP FIX)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Bridges Trading Web with Gemini Web (Fixes TrustedHTML error)
// @author       Antigravity Senior Engineer
// @match        *://gemini.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-start
// @connect      localhost
// ==/UserScript==

(function () {
    'use strict';

    const BRIDGE_URL = 'http://localhost:8091/api/ai/bridge';
    const POLL_INTERVAL = 3000;
    let isProcessing = false;

    // --- Selectors ---
    const SELECTORS = {
        input: 'div[aria-label*="Enter a prompt"], div[aria-label*="Nhập câu lệnh"], div.ql-editor',
        sendButton: 'button[aria-label*="Send message"], button[aria-label*="Gửi tin nhắn"], .send-button',
        stopButton: 'button[aria-label*="Stop response"], button[aria-label*="Dừng câu trả lời"]',
        responseTag: 'message-content'
    };

    // --- UI Styles ---
    GM_addStyle(`
        #bridge-v17-panel {
            position: fixed !important; bottom: 20px !important; right: 20px !important;
            width: 280px !important; background: rgba(19, 23, 34, 0.98) !important;
            border: 2px solid #3b82f6 !important; border-radius: 12px !important;
            z-index: 2147483647 !important; padding: 12px !important; color: #fff !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            font-size: 11px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.8) !important;
        }
        .log-line { margin: 2px 0; border-left: 2px solid #3b82f6; padding-left: 5px; opacity: 0.9; }
        .log-line.err { border-left-color: #ef4444; color: #f87171; }
        .log-line.ok { border-left-color: #10b981; color: #34d399; }
    `);

    // --- DOM-safe UI Creation (No innerHTML) ---
    function log(msg, type = '') {
        const content = document.getElementById('bridge-log-stream');
        if (!content) return;
        const div = document.createElement('div');
        div.className = 'log-line ' + type;
        div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        content.appendChild(div);
        if (content.children.length > 5) content.removeChild(content.firstChild);
    }

    function ensureUI() {
        if (document.getElementById('bridge-v17-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'bridge-v17-panel';

        const header = document.createElement('div');
        header.style.cssText = 'font-weight:900; color:#3b82f6; margin-bottom:8px; display:flex; justify-content:space-between;';

        const title = document.createElement('span');
        title.innerText = 'VIEWX BRIDGE v1.7';

        const indicator = document.createElement('span');
        indicator.id = 'bridge-status-indicator';
        indicator.innerText = '●';

        header.appendChild(title);
        header.appendChild(indicator);

        const logStream = document.createElement('div');
        logStream.id = 'bridge-log-stream';

        panel.appendChild(header);
        panel.appendChild(logStream);

        (document.body || document.documentElement).appendChild(panel);
        log('Bridge Active (CSP Fix applied)');
    }

    setInterval(ensureUI, 2000);

    // --- Core Automation ---
    async function poll() {
        if (isProcessing) return;

        GM_xmlhttpRequest({
            method: "GET",
            url: `${BRIDGE_URL}/pending`,
            onload: (r) => {
                const dot = document.getElementById('bridge-status-indicator');
                if (r.status === 200) {
                    if (dot) dot.style.color = '#3b82f6';
                    const task = JSON.parse(r.responseText);
                    handleTask(task);
                } else {
                    if (dot) dot.style.color = (r.status === 204) ? '#10b981' : '#ef4444';
                }
            },
            onerror: () => {
                const dot = document.getElementById('bridge-status-indicator');
                if (dot) dot.style.color = '#ef4444';
            }
        });
    }

    async function handleTask(task) {
        isProcessing = true;
        log('New Task: ' + task.task_id.slice(0, 6));

        try {
            const input = document.querySelector(SELECTORS.input);
            if (!input) throw new Error('Input field missing');

            input.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, task.prompt);

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            await new Promise(r => setTimeout(r, 800));

            const sendBtn = document.querySelector(SELECTORS.sendButton);
            if (sendBtn && !sendBtn.disabled) {
                log('Clicking Send...');
                sendBtn.click();
            } else {
                log('Using Enter key...', 'err');
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            }

            log('Generating response...');
            const response = await waitForGemini();

            log('Returning result...', 'ok');
            GM_xmlhttpRequest({
                method: "POST",
                url: `${BRIDGE_URL}/result`,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ task_id: task.task_id, response }),
                onload: () => { isProcessing = false; log('Task Success!', 'ok'); }
            });

        } catch (e) {
            log('Error: ' + e.message, 'err');
            isProcessing = false;
        }
    }

    function waitForGemini() {
        return new Promise((resolve) => {
            let attempt = 0;
            const check = setInterval(() => {
                const stopBtn = document.querySelector(SELECTORS.stopButton);
                const responses = document.querySelectorAll(SELECTORS.responseTag);
                const lastRes = responses[responses.length - 1];

                if (!stopBtn && lastRes && lastRes.innerText.trim().length > 30) {
                    clearInterval(check);
                    resolve(lastRes.innerText);
                }

                if (attempt++ > 120) {
                    clearInterval(check);
                    resolve("Error: Response timeout");
                }
            }, 1000);
        });
    }

    setInterval(poll, POLL_INTERVAL);
})();

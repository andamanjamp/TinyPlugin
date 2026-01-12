tinymce.PluginManager.add('aiChat', (editor) => {
    console.log('AI Chat Plugin - Loading');

    // Add Sidebar
    editor.ui.registry.addSidebar('aichat_sidebar', {
        tooltip: 'AI Chat Assistant',
        icon: 'comment',
        onShow: (api) => {
            const container = api.element();
            container.innerHTML = `
                <div class="ai-chat-sidebar" style="display: flex; flex-direction: column; height: 100%; width: 350px; font-family: -apple-system, sans-serif; background: #fff; border-left: 1px solid #eee;">
                    <div class="ai-chat-header" style="padding: 12px 16px; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between;">
                        <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">AI Assistant</h2>
                        <button id="ai-chat-undo" style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; cursor: pointer;">Undo</button>
                    </div>
                    <div id="ai-chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; background: #f9f9f9; display: flex; flex-direction: column; gap: 12px;">
                        <div class="message ai" style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #eee; font-size: 14px; color: #444;">Hello! How can I help?</div>
                    </div>
                    <div style="padding: 16px; border-top: 1px solid #eee;">
                        <textarea id="ai-chat-prompt" placeholder="Type request..." style="width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 10px; font-size: 14px; resize: none; margin-bottom: 10px;"></textarea>
                        <button id="ai-chat-send" style="width: 100%; background: #007bff; color: #fff; border: none; border-radius: 8px; padding: 10px; font-weight: 600; cursor: pointer;">Send</button>
                    </div>
                </div>
            `;

            setTimeout(() => {
                const sendBtn = container.querySelector('#ai-chat-send');
                const undoBtn = container.querySelector('#ai-chat-undo');
                const promptInput = container.querySelector('#ai-chat-prompt');
                const messagesDiv = container.querySelector('#ai-chat-messages');

                undoBtn.onclick = () => editor.undoManager.undo();

                const addMessage = (text, role) => {
                    const msg = document.createElement('div');
                    msg.style.cssText = role === 'user'
                        ? 'background: #007bff; color: white; padding: 12px; border-radius: 8px; align-self: flex-end; max-width: 90%; margin-bottom: 8px;'
                        : 'background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #eee; align-self: flex-start; max-width: 90%; margin-bottom: 8px;';
                    msg.innerText = text;
                    messagesDiv.appendChild(msg);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                };

                sendBtn.onclick = async () => {
                    const prompt = promptInput.value.trim();
                    if (!prompt) return;
                    promptInput.value = '';
                    addMessage(prompt, 'user');
                    sendBtn.disabled = true;

                    try {
                        const response = await fetch('http://localhost:3000/api/code/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ history: [{ role: 'user', content: prompt }], currentHtml: editor.getContent() })
                        });
                        const result = await response.json();
                        if (result.success) {
                            editor.setContent(combineContent(result));
                            addMessage(result.message || 'Updated.', 'ai');
                        }
                    } catch (e) { console.error(e); }
                    finally { sendBtn.disabled = false; }
                };
            }, 0);
        }
    });

    let aiPanel = null;
    let stagedHistory = [];
    let historyIndex = -1;

    const combineContent = (result) => {
        let combined = result.html || '';
        if (result.css) combined += `\n<style>\n${result.css}\n</style>`;
        if (result.js) combined += `\n<script>\n${result.js}\n</script>`;
        return combined;
    };

    const makeDraggable = (dialogEl, handleEl) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        const dragMouseDown = (e) => {
            e.preventDefault();
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Call a function whenever the cursor moves
            document.onmousemove = elementDrag;
        };

        const elementDrag = (e) => {
            e.preventDefault();
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            // Set the element's new position
            dialogEl.style.top = (dialogEl.offsetTop - pos2) + "px";
            dialogEl.style.left = (dialogEl.offsetLeft - pos1) + "px";
            dialogEl.style.margin = "0"; // Remove TinyMCE's centering margin
            dialogEl.style.position = "absolute";
        };

        const closeDragElement = () => {
            // Stop moving when mouse button is released
            document.onmouseup = null;
            document.onmousemove = null;
        };

        if (handleEl) {
            handleEl.onmousedown = dragMouseDown;
            handleEl.style.cursor = "move";
        }
    };

    const updateBtnStates = (api) => {
        const canUndo = historyIndex > 0;
        const canRedo = historyIndex < stagedHistory.length - 1;
        api.setEnabled('undo_btn', canUndo);
        api.setEnabled('redo_btn', canRedo);
        const backBtn = document.querySelector('.ai-modal-back');
        const forwardBtn = document.querySelector('.ai-modal-forward');
        if (backBtn) backBtn.disabled = !canUndo;
        if (forwardBtn) forwardBtn.disabled = !canRedo;
    };

    const updateModalPreview = () => {
        const iframe = document.querySelector('.ai-preview-modal-iframe');
        const countSpan = document.querySelector('.ai-preview-count');
        const currentEntry = stagedHistory[historyIndex];

        if (iframe && currentEntry) {
            let content = currentEntry.html
                .replace(/<script\s+src=["']script\.js["']\s*><\/script>/gi, '')
                .replace(/<link\s+rel=["']stylesheet["']\s+href=["']style\.css["']\s*\/?>/gi, '');

            const resetStyles = `
                <base href="${window.location.origin}/">
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; font-family: sans-serif; }
                    body > div:first-child { height: 100%; width: 100%; }
                    * { box-sizing: border-box; }
                </style>
            `;
            let finalHtml = content.toLowerCase().includes('<head>') ? content.replace(/<head>/i, '<head>' + resetStyles) : `<!DOCTYPE html><html><head>${resetStyles}</head><body>${content}</body></html>`;

            // Force immediate external height
            iframe.style.setProperty('height', '100%', 'important');
            iframe.style.setProperty('display', 'block', 'important');
            iframe.srcdoc = finalHtml;
        }
        if (countSpan) countSpan.innerText = `Version ${historyIndex + 1} of ${stagedHistory.length}`;
    };

    const openPreviewModal = () => {
        let styleTag = document.getElementById('ai-preview-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'ai-preview-styles';
            styleTag.innerHTML = `
                .tox-backdrop, .tox-dialog-wrap__backdrop { display: none !important; }
                .tox-dialog-wrap { 
                    pointer-events: none; 
                    height: 100vh !important; 
                    display: flex !important; 
                    align-items: center !important; 
                    justify-content: center !important; 
                    top: 0 !important; 
                    left: 0 !important; 
                    z-index: 1300 !important; 
                    overflow: hidden !important;
                }
                .tox-dialog { 
                    pointer-events: auto; 
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important; 
                    border: 1px solid #bbb !important; 
                    resize: both !important; 
                    overflow: hidden !important; 
                    min-width: 800px !important; 
                    min-height: 600px !important; 
                    display: flex !important; 
                    flex-direction: column !important;
                    background: #fff !important;
                }
                .tox-dialog__header { cursor: move !important; }
                .tox-dialog__content-js, .tox-dialog__body, .tox-dialog__body-content, .tox-form, .tox-form__group, .tox-htmlpanel, .tox-panel, .tox-panel__body {
                    display: flex !important; flex-direction: column !important; flex: 1 1 auto !important; height: 100% !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; width: 100% !important;
                }
                .ai-preview-container { flex: 1 1 auto !important; height: 100% !important; display: flex !important; flex-direction: column !important; width: 100% !important; background: #fff; overflow: hidden; }
                .ai-preview-header { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 10px 16px !important; border-bottom: 1px solid #eee !important; background: #fcfcfc !important; flex-shrink: 0 !important; }
                .ai-preview-iframe-wrapper { position: relative !important; flex: 1 1 auto !important; height: 100% !important; min-height: 400px !important; border: none !important; overflow: hidden !important; background: #fff !important; }
                .ai-preview-modal-iframe { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; border: none !important; display: block !important; }
                .ai-modal-btn { background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; color: #555; }
                .ai-modal-btn:disabled { opacity: 0.3; cursor: not-allowed; }
            `;
            document.head.appendChild(styleTag);
        }

        const api = editor.windowManager.open({
            title: 'AI Preview',
            width: 1200,
            height: 800,
            body: {
                type: 'panel',
                items: [{
                    type: 'htmlpanel',
                    html: `
                        <div class="ai-preview-container">
                            <div class="ai-preview-header">
                                <span class="ai-preview-count"></span>
                            </div>
                            <div class="ai-preview-iframe-wrapper">
                                <iframe class="ai-preview-modal-iframe"></iframe>
                            </div>
                        </div>`
                }]
            },
            buttons: [
                { type: 'custom', text: 'Undo', name: 'undo_btn', primary: true },
                { type: 'custom', text: 'Redo', name: 'redo_btn', primary: true },
                { type: 'cancel', text: 'Discard' },
                { type: 'submit', text: 'Apply', primary: true }
            ],
            onSubmit: (api) => { editor.setContent(stagedHistory[historyIndex].html); api.close(); },
            onAction: (api, details) => {
                if (details.name === 'undo_btn' && historyIndex > 0) { historyIndex--; updateModalPreview(); updateBtnStates(api); }
                else if (details.name === 'redo_btn' && historyIndex < stagedHistory.length - 1) { historyIndex++; updateModalPreview(); updateBtnStates(api); }
            }
        });

        setTimeout(() => {
            const dialogEl = document.querySelector('.tox-dialog');
            const headerEl = document.querySelector('.tox-dialog__header');
            if (dialogEl && headerEl) {
                makeDraggable(dialogEl, headerEl);
            }

            const backBtn = document.querySelector('.ai-modal-back');
            const forwardBtn = document.querySelector('.ai-modal-forward');
            if (backBtn) backBtn.onclick = () => { if (historyIndex > 0) { historyIndex--; updateModalPreview(); updateBtnStates(api); } };
            if (forwardBtn) forwardBtn.onclick = () => { if (historyIndex < stagedHistory.length - 1) { historyIndex++; updateModalPreview(); updateBtnStates(api); } };
            updateModalPreview();
            updateBtnStates(api);
        }, 100);
    };

    const toggleAiPanel = () => {
        if (!aiPanel) {
            aiPanel = document.createElement('div');
            aiPanel.innerHTML = `
                <div style="display: flex; align-items: center; gap:12px; padding:12px; background:#fff; border:1px solid #ddd;">
                    <span style="font-weight:600;">AI</span>
                    <textarea id="ai-top-prompt" style="flex:1; height:40px; border-radius:4px; border:1px solid #ccc;"></textarea>
                    <button id="ai-top-send" style="background:#007bff; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Send</button>
                </div>`;
            const toolbar = editor.getContainer().querySelector('.tox-toolbar-overlord');
            if (toolbar) toolbar.after(aiPanel);
            else editor.getContainer().prepend(aiPanel);

            aiPanel.querySelector('#ai-top-send').onclick = async () => {
                const prompt = aiPanel.querySelector('#ai-top-prompt').value.trim();
                if (!prompt) return;
                const sendBtn = aiPanel.querySelector('#ai-top-send');
                sendBtn.disabled = true;

                try {
                    const currentHtml = historyIndex >= 0 ? stagedHistory[historyIndex].html : editor.getContent();
                    const response = await fetch('http://localhost:3000/api/code/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ history: [{ role: 'user', content: prompt }], currentHtml })
                    });
                    const result = await response.json();
                    if (result.success) {
                        const combined = combineContent(result);
                        if (stagedHistory.length === 0) stagedHistory.push({ html: editor.getContent(), prompt: '' });
                        stagedHistory = stagedHistory.slice(0, historyIndex + 1);
                        stagedHistory.push({ html: combined, prompt: prompt });
                        historyIndex = stagedHistory.length - 1;
                        if (document.querySelector('.tox-dialog')) updateModalPreview();
                        else openPreviewModal();
                    }
                } catch (e) { console.error(e); }
                finally { sendBtn.disabled = false; }
            };

            // First time opening: check for sidebar
            const sidebarOpen = editor.getContainer().querySelector('.tox-sidebar--sliding-open');
            if (sidebarOpen) editor.execCommand('ToggleSidebar', false, 'aichat_sidebar');
        } else {
            const isOpening = aiPanel.style.display === 'none';
            if (isOpening) {
                const sidebarOpen = editor.getContainer().querySelector('.tox-sidebar--sliding-open');
                if (sidebarOpen) editor.execCommand('ToggleSidebar', false, 'aichat_sidebar');
                aiPanel.style.display = 'block';
            } else {
                aiPanel.style.display = 'none';
            }
        }

        if (aiPanel.style.display !== 'none') {
            aiPanel.querySelector('#ai-top-prompt').focus();
            stagedHistory = [{ html: editor.getContent(), prompt: '' }];
            historyIndex = 0;
        }
    };

    editor.ui.registry.addButton('aiChat', {
        text: 'AI Chat',
        icon: 'comment',
        onAction: () => {
            if (aiPanel && aiPanel.style.display !== 'none') {
                aiPanel.style.display = 'none';
            }
            editor.execCommand('ToggleSidebar', false, 'aichat_sidebar');
        }
    });
    editor.ui.registry.addButton('ai', { text: 'AI', icon: 'code', onAction: () => toggleAiPanel() });

    return { getMetadata: () => ({ name: 'AI Chat Sidebar Plugin' }) };
});
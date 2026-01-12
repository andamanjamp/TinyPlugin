tinymce.PluginManager.add('aiChat', (editor) => {
    console.log('AI Chat Plugin - Loading');

    // Add Sidebar
    editor.ui.registry.addSidebar('aichat_sidebar', {
        tooltip: 'AI Chat Assistant',
        icon: 'comment',
        onShow: (api) => {
            console.log('AI Chat Sidebar - onShow');
            const container = api.element();

            // Inject container styles to ensure it's visible and correctly sized
            container.innerHTML = `
                <div class="ai-chat-sidebar" style="display: flex; flex-direction: column; height: 100%; width: 350px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; border-left: 1px solid #eee;">
                    <div class="ai-chat-header" style="padding: 12px 16px; border-bottom: 1px solid #eee; background: #fff; display: flex; align-items: center; justify-content: space-between;">
                        <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">AI Assistant</h2>
                        <div class="header-actions" style="display: flex; gap: 8px;">
                            <button id="ai-chat-undo" title="Undo Last Change" style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #555;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                                <span style="margin-left: 4px; font-size: 12px; font-weight: 500;">Undo</span>
                            </button>
                            <button id="ai-chat-finish" title="Finish" style="background: #28a745; border: 1px solid #28a745; border-radius: 4px; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #fff;">
                                <span style="font-size: 12px; font-weight: 600;">Finish</span>
                            </button>
                        </div>
                    </div>
                    <div id="ai-chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f9f9f9;">
                        <div class="message ai" style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #eee; font-size: 14px; max-width: 90%; align-self: flex-start; color: #444; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            Hello! How can I help you today?
                        </div>
                    </div>
                    <div class="ai-chat-input-container" style="padding: 16px; border-top: 1px solid #eee; background: #fff;">
                        <textarea id="ai-chat-prompt" placeholder="Type your request..." style="width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 10px; font-size: 14px; resize: none; margin-bottom: 10px; box-sizing: border-box;" rows="3"></textarea>
                        <button id="ai-chat-send" style="width: 100%; background: #007bff; color: #fff; border: none; border-radius: 8px; padding: 10px; font-weight: 600; cursor: pointer;">Send Request</button>
                    </div>
                </div>
                <style>
                    #ai-chat-undo:hover { background: #e9ecef; border-color: #ccc; transform: translateY(-1px); }
                    #ai-chat-undo:active { transform: translateY(0); }
                    #ai-chat-finish:hover { background: #218838; border-color: #1e7e34; box-shadow: 0 2px 4px rgba(40,167,69,0.2); transform: translateY(-1px); }
                    #ai-chat-finish:active { transform: translateY(0); }
                </style>
            `;

            setTimeout(() => {
                const sendBtn = container.querySelector('#ai-chat-send');
                const undoBtn = container.querySelector('#ai-chat-undo');
                const finishBtn = container.querySelector('#ai-chat-finish');
                const promptInput = container.querySelector('#ai-chat-prompt');
                const messagesDiv = container.querySelector('#ai-chat-messages');

                if (!sendBtn || !promptInput || !messagesDiv || !undoBtn || !finishBtn) {
                    console.error('AI Chat Sidebar - Failed to find elements');
                    return;
                }

                undoBtn.onclick = () => {
                    console.log('AI Chat Sidebar - Undo clicked');
                    editor.undoManager.undo();
                };

                finishBtn.onclick = () => {
                    console.log('AI Chat Sidebar - Finish clicked');
                    // Place holder for future logic
                };

                const addMessage = (text, role) => {
                    const msg = document.createElement('div');
                    msg.className = `message ${role}`;
                    msg.style.cssText = role === 'user'
                        ? 'background: #007bff; color: white; padding: 12px; border-radius: 8px; font-size: 14px; max-width: 90%; align-self: flex-end; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);'
                        : 'background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #eee; font-size: 14px; max-width: 90%; align-self: flex-start; margin-bottom: 12px; color: #444; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';
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
                    sendBtn.innerText = 'Thinking...';

                    try {
                        const response = await fetch('http://localhost:3000/api/code/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                history: [{ role: 'user', content: prompt }],
                                currentHtml: editor.getContent()
                            })
                        });

                        const result = await response.json();

                        if (result.success) {
                            let combinedContent = result.html || '';
                            if (result.css) combinedContent += `\n<style>\n${result.css}\n</style>`;
                            if (result.js) combinedContent += `\n<script>\n${result.js}\n</script>`;

                            editor.setContent(combinedContent);
                            addMessage(result.message || 'Updated code as requested.', 'ai');
                        } else {
                            addMessage('Error: ' + result.message, 'ai');
                        }
                    } catch (error) {
                        console.error('AI Chat Error:', error);
                        addMessage('Failed to connect to backend.', 'ai');
                    } finally {
                        sendBtn.disabled = false;
                        sendBtn.innerText = 'Send Request';
                    }
                };

                promptInput.onkeydown = (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendBtn.click();
                    }
                };
            }, 0);
        },
        onHide: (api) => {
            console.log('AI Chat Sidebar - onHide');
        }
    });

    // AI Preview State & UI Logic
    let aiPanel = null;
    let stagedHistory = []; // Now stores { html: string, prompt: string }
    let historyIndex = -1;

    const updateModalPreview = () => {
        const iframe = document.querySelector('.ai-preview-modal-iframe');
        const countSpan = document.querySelector('.ai-preview-count');
        const currentEntry = stagedHistory[historyIndex];

        if (iframe && currentEntry) {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(currentEntry.html);
            doc.close();
        }
        if (countSpan) {
            countSpan.innerText = `Version ${historyIndex + 1} of ${stagedHistory.length}`;
        }

        // Sync prompt to Top Panel
        const topPromptInput = document.getElementById('ai-top-prompt');
        if (topPromptInput && currentEntry) {
            topPromptInput.value = currentEntry.prompt || '';
        }
    };

    const openPreviewModal = () => {
        editor.windowManager.open({
            title: 'AI Preview - Staging Area',
            size: 'large',
            body: {
                type: 'panel',
                items: [
                    {
                        type: 'htmlpanel',
                        html: `
                            <style>
                                /* Aggressively remove all backdrop blurs and fading effects */
                                .tox-backdrop, 
                                .tox-dialog-wrap__backdrop { 
                                    display: none !important; 
                                    background: transparent !important; 
                                    backdrop-filter: none !important; 
                                    filter: none !important; 
                                }
                                .tox-dialog-wrap { 
                                    pointer-events: none; 
                                    backdrop-filter: none !important; 
                                    filter: none !important; 
                                }
                                .tox-dialog { 
                                    pointer-events: auto; 
                                    box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important; 
                                    border: 1px solid #ccc !important; 
                                    filter: none !important; 
                                }
                                body.tox-dialog-open .tox-tinymce { 
                                    filter: none !important; 
                                    opacity: 1 !important; 
                                }
                                .ai-preview-container { height: 600px; display: flex; flex-direction: column; gap: 10px; }
                                .ai-preview-iframe-wrapper { flex: 1; border: 1px solid #ddd; border-radius: 4px; overflow: auto; background: white; }
                                .ai-preview-modal-iframe { width: 100%; height: 100%; border: none; min-height: 1000px; }
                            </style>
                            <div class="ai-preview-container">
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #666;">
                                    <span class="ai-preview-count">Version ${historyIndex + 1} of ${stagedHistory.length}</span>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="ai-modal-btn ai-modal-back" style="padding: 6px 14px; cursor: pointer;">Back</button>
                                        <button class="ai-modal-btn ai-modal-forward" style="padding: 6px 14px; cursor: pointer;">Forward</button>
                                    </div>
                                </div>
                                <div class="ai-preview-iframe-wrapper">
                                    <iframe class="ai-preview-modal-iframe" style="width: 100%; height: 100%; border: none;"></iframe>
                                </div>
                            </div>
                            <style>
                                .ai-modal-btn { background: #fff; border: 1px solid #ccc; border-radius: 4px; font-weight: 500; transition: all 0.2s; }
                                .ai-modal-btn:hover:not(:disabled) { background: #f0f0f0; border-color: #999; }
                                .ai-modal-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: #eee; }
                            </style>
                        `
                    }
                ]
            },
            buttons: [
                {
                    type: 'cancel',
                    text: 'Close'
                },
                {
                    type: 'submit',
                    text: 'Finish & Update Page',
                    primary: true
                }
            ],
            onAction: (api, details) => {
                // Not used as we use custom buttons in htmlpanel for history navigation
            },
            onSubmit: (api) => {
                const currentEntry = stagedHistory[historyIndex];
                if (currentEntry) {
                    editor.undoManager.beforeChange();
                    editor.setContent(currentEntry.html);
                    editor.undoManager.add();
                }
                api.close();
                if (aiPanel) aiPanel.style.display = 'none';
            }
        });

        // Initialize modal content & handlers
        setTimeout(() => {
            const backBtn = document.querySelector('.ai-modal-back');
            const forwardBtn = document.querySelector('.ai-modal-forward');

            const updateBtnStates = () => {
                if (backBtn) backBtn.disabled = historyIndex === 0;
                if (forwardBtn) forwardBtn.disabled = historyIndex === stagedHistory.length - 1;
            };

            if (backBtn) backBtn.onclick = () => {
                if (historyIndex > 0) {
                    historyIndex--;
                    updateModalPreview();
                    updateBtnStates();
                }
            };
            if (forwardBtn) forwardBtn.onclick = () => {
                if (historyIndex < stagedHistory.length - 1) {
                    historyIndex++;
                    updateModalPreview();
                    updateBtnStates();
                }
            };

            updateModalPreview();
            updateBtnStates();
        }, 100);
    };

    const toggleAiPanel = () => {
        if (!aiPanel) {
            const editorContainer = editor.getContainer();
            aiPanel = document.createElement('div');
            aiPanel.className = 'ai-top-panel';
            aiPanel.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #ddd; border-top: 1px solid #ddd; font-family: -apple-system, sans-serif;">
                    <span style="font-weight: 600; font-size: 14px; color: #333;">AI Assistant</span>
                    <textarea id="ai-top-prompt" placeholder="Ask AI to edit this page..." style="flex: 1; border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; font-size: 14px; height: 40px; resize: none;"></textarea>
                    <button id="ai-top-send" style="background: #007bff; color: #fff; border: none; border-radius: 6px; padding: 0 20px; font-weight: 600; cursor: pointer; height: 40px;">Send</button>
                    <button id="ai-top-close" title="Close" style="background: none; border: none; color: #999; cursor: pointer; font-size: 20px; padding: 0 4px;">&times;</button>
                </div>
            `;

            // Inject below the toolbar area
            const toolbar = editorContainer.querySelector('.tox-toolbar-overlord');
            if (toolbar) {
                toolbar.after(aiPanel);
            } else {
                editorContainer.prepend(aiPanel);
            }

            const sendBtn = aiPanel.querySelector('#ai-top-send');
            const promptInput = aiPanel.querySelector('#ai-top-prompt');
            const closeBtn = aiPanel.querySelector('#ai-top-close');

            closeBtn.onclick = () => aiPanel.style.display = 'none';

            sendBtn.onclick = async () => {
                const prompt = promptInput.value.trim();
                if (!prompt) return;

                sendBtn.disabled = true;
                const originalText = sendBtn.innerText;
                sendBtn.innerText = 'Refining...';

                try {
                    const currentHtml = historyIndex >= 0 ? stagedHistory[historyIndex].html : editor.getContent();
                    const response = await fetch('http://localhost:3000/api/code/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            history: [{ role: 'user', content: prompt }],
                            currentHtml: currentHtml
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        let newContent = result.html || '';
                        if (result.css) newContent += `\n<style>\n${result.css}\n</style>`;
                        if (result.js) newContent += `\n<script>\n${result.js}\n</script>`;

                        if (stagedHistory.length === 0) {
                            stagedHistory.push({ html: editor.getContent(), prompt: '' });
                            historyIndex = 0;
                        }

                        stagedHistory = stagedHistory.slice(0, historyIndex + 1);
                        stagedHistory.push({ html: newContent, prompt: prompt });
                        historyIndex = stagedHistory.length - 1;

                        // Check if modal is already open
                        const existingDialog = document.querySelector('.tox-dialog');
                        if (existingDialog) {
                            updateModalPreview();
                            // Re-update button states if modal is open
                            const backBtn = document.querySelector('.ai-modal-back');
                            const forwardBtn = document.querySelector('.ai-modal-forward');
                            if (backBtn) backBtn.disabled = historyIndex === 0;
                            if (forwardBtn) forwardBtn.disabled = historyIndex === stagedHistory.length - 1;
                        } else {
                            openPreviewModal();
                        }
                    }
                } catch (error) {
                    console.error('AI Top Panel Error:', error);
                } finally {
                    sendBtn.disabled = false;
                    sendBtn.innerText = originalText;
                }
            };

            promptInput.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendBtn.click();
                }
            };
        } else {
            aiPanel.style.display = aiPanel.style.display === 'none' ? 'flex' : 'none';
        }

        if (aiPanel.style.display !== 'none') {
            const prompt = aiPanel.querySelector('#ai-top-prompt');
            if (prompt) prompt.focus();
            // Reset staging state on open
            stagedHistory = [editor.getContent()];
            historyIndex = 0;
        }
    };

    // Add Toggle Buttons
    editor.ui.registry.addButton('aiChat', {
        text: 'AI Chat',
        icon: 'comment',
        onAction: () => {
            console.log('Toggling AI Chat Sidebar (aiChat)');
            editor.execCommand('ToggleSidebar', false, 'aichat_sidebar');
        }
    });

    editor.ui.registry.addButton('ai', {
        text: 'AI',
        icon: 'code',
        onAction: () => {
            console.log('Toggling AI Top Panel (ai)');
            toggleAiPanel();
        }
    });

    return {
        getMetadata: () => ({
            name: 'AI Chat Sidebar Plugin'
        })
    };
});

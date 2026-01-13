tinymce.PluginManager.add('webRef', (editor) => {
    console.log('WebRef Plugin - Loading');

    const openWebRefDialog = () => {
        let base64Image = null;

        const makeDraggable = (dialogEl, handleEl) => {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            const dragMouseDown = (e) => {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            };
            const elementDrag = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                dialogEl.style.top = (dialogEl.offsetTop - pos2) + "px";
                dialogEl.style.left = (dialogEl.offsetLeft - pos1) + "px";
                dialogEl.style.margin = "0";
                dialogEl.style.position = "absolute";
            };
            const closeDragElement = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };
            if (handleEl) {
                handleEl.onmousedown = dragMouseDown;
                handleEl.style.cursor = "move";
            }
        };

        const openPreviewModal = (generatedHtml) => {
            let styleTag = document.getElementById('webref-preview-styles');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'webref-preview-styles';
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
                    .ai-preview-htmlarea { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; border: none !important; display: none !important; padding: 12px !important; box-sizing: border-box !important; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace !important; font-size: 13px !important; white-space: pre-wrap !important; overflow: auto !important; }
                `;
                document.head.appendChild(styleTag);
            }

            editor.windowManager.open({
                title: 'WebRef Preview',
                width: 1200,
                height: 800,
                body: {
                    type: 'panel',
                    items: [{
                        type: 'htmlpanel',
                        html: `
                            <div class="ai-preview-container">
                                <div class="ai-preview-header">
                                    <span style="font-weight:600; color:#444;">Generated Result</span>
                                </div>
                                <div class="ai-preview-iframe-wrapper">
                                    <iframe class="ai-preview-modal-iframe"></iframe>
                                    <textarea class="ai-preview-htmlarea" readonly></textarea>
                                </div>
                            </div>`
                    }]
                },
                buttons: [
                    { type: 'custom', text: 'Toggle View', name: 'toggle_view' },
                    { type: 'cancel', text: 'Discard' },
                    { type: 'submit', text: 'Apply', primary: true }
                ],
                onSubmit: (api) => {
                    editor.undoManager.transact(() => {
                        editor.setContent(generatedHtml);
                    });
                    editor.notificationManager.open({ text: 'Content applied.', type: 'success', timeout: 2000 });
                    api.close();
                },
                onAction: (api, details) => {
                    if (details.name === 'toggle_view') {
                        const iframe = document.querySelector('.ai-preview-modal-iframe');
                        const textarea = document.querySelector('.ai-preview-htmlarea');
                        if (!iframe || !textarea) return;
                        if (iframe.style.display !== 'none') {
                            iframe.style.setProperty('display', 'none', 'important');
                            textarea.style.setProperty('display', 'block', 'important');
                            textarea.value = generatedHtml;
                        } else {
                            textarea.style.setProperty('display', 'none', 'important');
                            iframe.style.setProperty('display', 'block', 'important');
                        }
                    }
                },
                onClose: () => {
                    const styleTag = document.getElementById('webref-preview-styles');
                    if (styleTag) styleTag.remove();
                }
            });

            setTimeout(() => {
                const dialogEl = document.querySelector('.tox-dialog');
                const headerEl = document.querySelector('.tox-dialog__header');
                if (dialogEl && headerEl) makeDraggable(dialogEl, headerEl);

                const iframe = document.querySelector('.ai-preview-modal-iframe');
                if (iframe) {
                    const resetStyles = `
                        <base href="${window.location.origin}/">
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>html,body{margin:0;padding:0;width:100%;height:100%;background:#fff;}body>div:first-child{height:100%;width:100%;}*{box-sizing:border-box;}</style>
                    `;
                    let content = generatedHtml || '';
                    if (!content.toLowerCase().includes('<head>')) {
                        content = `<!DOCTYPE html><html><head>${resetStyles}</head><body>${content}</body></html>`;
                    } else {
                        content = content.replace(/<head>/i, '<head>' + resetStyles);
                    }
                    iframe.srcdoc = content;
                }
            }, 100);
        };

        const api = editor.windowManager.open({
            title: 'Generate Web from Image',
            width: 600,
            height: 500,
            body: {
                type: 'panel',
                items: [
                    {
                        type: 'htmlpanel',
                        html: `
                            <div style="padding: 20px; text-align: center;">
                                <div id="web-ref-dropzone" style="border: 2px dashed #ccc; border-radius: 8px; padding: 40px; cursor: pointer; background: #fafafa; transition: border-color 0.3s;">
                                    <p style="margin: 0; color: #666;">Click to upload or Drag & Drop web layout screenshot</p>
                                    <input type="file" id="web-ref-input" accept="image/*" style="display: none;" />
                                </div>
                                <div id="web-ref-preview-container" style="display: none; margin-top: 20px; position: relative;">
                                    <img id="web-ref-preview" style="max-width: 100%; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);" />
                                    <button id="web-ref-remove" style="position: absolute; top: -10px; right: -10px; border-radius: 50%; width: 24px; height: 24px; border: none; background: #ff4d4f; color: white; cursor: pointer;">×</button>
                                </div>
                                <div id="web-ref-status" style="margin-top: 15px; font-size: 14px; color: #007bff; display: none;">Processing...</div>
                            </div>
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
                    text: 'Generate Code',
                    primary: true,
                    name: 'generate_btn',
                    enabled: true
                }
            ],
            onSubmit: async (api) => {

                const statusDiv = document.getElementById('web-ref-status');

                console.log('open web reference dialog');

                if (!base64Image) {
                    console.log('no image selected');
                    editor.notificationManager.open({
                        text: 'Please select an image first.',
                        type: 'error',
                        timeout: 3000
                    });
                    return;
                }

                api.block('Analyzing image with Claude...');

                // Hide previous status/errors
                if (statusDiv) {
                    statusDiv.style.display = 'none';
                }

                try {
                    const response = await fetch('http://localhost:3000/api/code/from-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64Image })
                    });

                    const result = await response.json();

                    if (result.success) {
                        const combineContent = (res) => {
                            let combined = res.html || '';
                            if (res.css) combined += `\n<style>\n${res.css}\n</style>`;
                            if (res.js) combined += `\n<script>\n${res.js}\n</script>`;
                            return combined;
                        };
                        const generatedCode = combineContent(result);
                        api.close(); // Close upload dialog
                        openPreviewModal(generatedCode); // Open preview dialog
                    } else {
                        throw new Error(result.message || 'Generation failed');
                    }
                } catch (e) {
                    console.error('WebRef Error:', e);
                    api.unblock();
                    if (statusDiv) {
                        statusDiv.innerText = 'Error: ' + e.message;
                        statusDiv.style.color = '#ff4d4f';
                        statusDiv.style.display = 'block';
                    } else {
                        editor.notificationManager.open({
                            text: 'Error: ' + e.message,
                            type: 'error'
                        });
                    }
                }
            }
        });

        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            const dropzone = document.getElementById('web-ref-dropzone');
            const input = document.getElementById('web-ref-input');
            const preview = document.getElementById('web-ref-preview');
            const previewContainer = document.getElementById('web-ref-preview-container');
            const removeBtn = document.getElementById('web-ref-remove');


            const handleFile = (file) => {
                if (!file || !file.type.startsWith('image/')) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    base64Image = e.target.result;
                    preview.src = base64Image;
                    dropzone.style.display = 'none';
                    previewContainer.style.display = 'block';
                    if (base64Image) {
                        // api.enable('generate_btn'); // Button is now always enabled
                    }
                };
                reader.readAsDataURL(file);
            };

            dropzone.onclick = () => input.click();
            input.onchange = (e) => handleFile(e.target.files[0]);

            dropzone.ondragover = (e) => {
                e.preventDefault();
                dropzone.style.borderColor = '#007bff';
            };
            dropzone.ondragleave = () => {
                dropzone.style.borderColor = '#ccc';
            };
            dropzone.ondrop = (e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files[0]);
            };

            removeBtn.onclick = () => {
                base64Image = null;
                preview.src = '';
                dropzone.style.display = 'block';
                previewContainer.style.display = 'none';
            };
        }, 100);
    };

    editor.ui.registry.addButton('webRef', {
        icon: 'upload',
        tooltip: 'Generate from Image Reference',
        onAction: () => openWebRefDialog()
    });

    return {
        getMetadata: () => ({
            name: 'WebRef Image-to-Code'
        })
    };
});

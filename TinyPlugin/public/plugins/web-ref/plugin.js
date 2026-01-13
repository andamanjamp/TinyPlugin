tinymce.PluginManager.add('webRef', (editor) => {
    console.log('WebRef Plugin - Loading');

    const openWebRefDialog = () => {
        let base64Image = null;

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
                        editor.setContent(combineContent(result));

                        editor.notificationManager.open({
                            text: 'Web layout generated successfully!',
                            type: 'success',
                            timeout: 3000
                        });

                        api.close();
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

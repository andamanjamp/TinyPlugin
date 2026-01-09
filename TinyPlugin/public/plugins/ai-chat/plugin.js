tinymce.PluginManager.add('aiChat', (editor) => {
    editor.ui.registry.addButton('aiChat', {
        text: 'AI Chat',
        icon: 'ai',
        onAction: () => {
            editor.windowManager.open({
                title: 'AI Chat Assistant',
                body: {
                    type: 'panel',
                    items: [
                        {
                            type: 'textarea',
                            name: 'prompt',
                            label: 'What would you like to do?'
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
                        text: 'Generate',
                        primary: true
                    }
                ],
                onSubmit: async (api) => {
                    const data = api.getData();
                    const prompt = data.prompt;

                    if (!prompt) return;

                    api.block('Thinking...');

                    try {
                        const response = await fetch('http://localhost:3000/api/code/update', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                history: [{ role: 'user', content: prompt }],
                                currentHtml: editor.getContent()
                            })
                        });

                        const result = await response.json();

                        if (result.success) {
                            // Combine HTML, CSS, and JS into a single string
                            let combinedContent = result.html || '';

                            if (result.css) {
                                combinedContent += `\n<style>\n${result.css}\n</style>`;
                            }

                            if (result.js) {
                                combinedContent += `\n<script>\n${result.js}\n</script>`;
                            }

                            editor.setContent(combinedContent);
                            api.close();
                        } else {
                            alert('Error: ' + result.message);
                            api.unblock();
                        }
                    } catch (error) {
                        console.error('AI Chat Error:', error);
                        alert('Failed to connect to backend. Make sure the server is running on port 3000.');
                        api.unblock();
                    }
                }
            });
        }
    });

    return {
        getMetadata: () => ({
            name: 'AI Chat Plugin'
        })
    };
});

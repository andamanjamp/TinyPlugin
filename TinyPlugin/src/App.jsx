import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/tinymce/tinymce.min.js';
    script.referrerPolicy = 'origin';
    script.onload = () => {
      window.tinymce.init({
        selector: '#editor',

        external_plugins: {
          aiChat: '/plugins/ai-chat/plugin.js'
        },

        plugins: 'code aiChat',
        toolbar: 'undo redo | code | aiChat',
        height: '100vh'
      });
    };

    document.body.appendChild(script);
  }, []);

  return <textarea id="editor">hi</textarea>;
}

export default App;

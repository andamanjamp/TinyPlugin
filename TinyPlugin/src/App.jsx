import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.3/tinymce.min.js';
    script.referrerPolicy = 'origin';
    script.onload = () => {
      window.tinymce.init({
        selector: '#editor',

        external_plugins: {
          aiChat: '/plugins/ai-chat/plugin.js',
          webRef: '/plugins/web-ref/plugin.js',
        },

        plugins: 'code aiChat image webRef',
        toolbar: 'undo redo | code | aiChat ai | image webRef',
        height: '100vh',
        width: '100vw',
        license_key: 'gpl',

        // ========================================
        // CONFIGURATION TO PRESERVE STYLE & SCRIPT TAGS
        // ========================================

        // Allow all elements and attributes
        valid_elements: '*[*]',
        extended_valid_elements: 'script[language|type|src|charset],style[type|media]',

        // Allow script and style as children of body
        valid_children: '+body[style|script],+head[style|script]',

        // Custom elements
        custom_elements: 'script,style',

        // Don't remove script/style tags
        invalid_elements: '',

        // Don't verify HTML structure
        verify_html: false,

        // Don't clean up HTML
        cleanup: false,

        // Don't encode entities
        entity_encoding: 'raw',

        // Don't convert URLs
        convert_urls: false,
        relative_urls: false,
        remove_script_host: false,

        // Allow script URLs
        allow_script_urls: true,
        allow_unsafe_link_target: true,

        // Content filtering
        content_css: false,

        // Setup hook to preserve content
        setup: function (editor) {
          // Before content is set
          editor.on('BeforeSetContent', function (e) {
            console.log('BeforeSetContent:', e.content?.substring(0, 100));
          });

          // After content is set
          editor.on('SetContent', function (e) {
            console.log('SetContent completed');
          });

          // Before getting content
          editor.on('BeforeGetContent', function (e) {
            console.log('BeforeGetContent');
          });

          // When editor is initialized
          editor.on('init', function () {
            console.log('TinyMCE initialized with script/style preservation');
          });
        }
      });
    };

    document.body.appendChild(script);

    // Cleanup on unmount
    return () => {
      if (window.tinymce) {
        window.tinymce.remove('#editor');
      }
    };
  }, []);

  return (
    <div className="pagecontainer" style={{ width: '100%', height: '100vh' }}>
      <textarea id="editor" placeholder="Type your text here" className="w-tinymce"></textarea>
    </div>
  );
}

export default App;
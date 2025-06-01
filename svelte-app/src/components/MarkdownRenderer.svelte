<script>
  import { marked } from 'marked';
  import { onMount } from 'svelte';
  
  export let content = '';
  
  let html = '';
  
  // Configure marked
  marked.setOptions({
    highlight: function(code, lang) {
      // Basic syntax highlighting with CSS classes
      return `<code class="language-${lang}">${escapeHtml(code)}</code>`;
    },
    breaks: true,
    gfm: true
  });
  
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  
  $: {
    // Parse markdown to HTML
    html = marked(content);
  }
  
  onMount(() => {
    // Add copy buttons to code blocks
    const codeBlocks = document.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.textContent = 'Copy';
      button.onclick = () => {
        navigator.clipboard.writeText(block.textContent);
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = 'Copy', 2000);
      };
      block.parentElement.appendChild(button);
    });
  });
</script>

<div class="markdown-content">
  {@html html}
</div>

<style>
  .markdown-content {
    line-height: 1.6;
    word-wrap: break-word;
  }
  
  .markdown-content :global(h1),
  .markdown-content :global(h2),
  .markdown-content :global(h3) {
    margin-top: 1em;
    margin-bottom: 0.5em;
  }
  
  .markdown-content :global(p) {
    margin-bottom: 1em;
  }
  
  .markdown-content :global(code) {
    background-color: rgba(0, 0, 0, 0.1);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
  }
  
  .markdown-content :global(pre) {
    background-color: #1e1e1e;
    padding: 1em;
    border-radius: 5px;
    overflow-x: auto;
    position: relative;
  }
  
  .markdown-content :global(pre code) {
    background-color: transparent;
    padding: 0;
    color: #d4d4d4;
  }
  
  .markdown-content :global(.copy-button) {
    position: absolute;
    top: 5px;
    right: 5px;
    padding: 5px 10px;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .markdown-content :global(.copy-button:hover) {
    background-color: #2563eb;
  }
  
  .markdown-content :global(blockquote) {
    border-left: 4px solid #3b82f6;
    padding-left: 1em;
    margin-left: 0;
    color: #666;
  }
  
  .markdown-content :global(a) {
    color: #3b82f6;
    text-decoration: none;
  }
  
  .markdown-content :global(a:hover) {
    text-decoration: underline;
  }
  
  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    margin-bottom: 1em;
    padding-left: 2em;
  }
  
  .markdown-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;
  }
  
  .markdown-content :global(th),
  .markdown-content :global(td) {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
  }
  
  .markdown-content :global(th) {
    background-color: #f5f5f5;
    font-weight: bold;
  }
  
  :global(.dark) .markdown-content :global(code) {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  :global(.dark) .markdown-content :global(blockquote) {
    color: #999;
  }
  
  :global(.dark) .markdown-content :global(th) {
    background-color: #2a2a2a;
  }
</style>
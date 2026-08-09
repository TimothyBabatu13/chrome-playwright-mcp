/**
 * Convert the study data into a Markdown document.
 * @param {Object} data - Collected study content and metadata.
 * @returns {string} Markdown output.
 */
export function formatAsMarkdown(data) {
  let markdown = `# ${data.title || 'Study Notes'}\n\n`;
  // Add source metadata up front.
  markdown += `**Source**: [${data.url}](${data.url})\n`;
  markdown += `**Collected**: ${new Date(data.timestamp).toLocaleString()}\n\n`;
  markdown += `---\n\n`;

  // Render content sections when present.
  if (data.content && data.content.length > 0) {
    markdown += `## Content\n\n`;

    data.content.forEach(section => {
      const headingLevel = section.level === 'H1' ? '##' : section.level === 'H2' ? '###' : '####';
      markdown += `${headingLevel} ${section.heading}\n\n`;
      markdown += `${section.content}\n\n`;
    });
  }

  // Include code samples as fenced blocks.
  if (data.codeSnippets && data.codeSnippets.length > 0) {
    markdown += `## Code Examples\n\n`;
    data.codeSnippets.forEach(snippet => {
      markdown += `### Example ${snippet.id}\n\n`;
      markdown += `\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n\n`;
    });
  }

  return markdown;
}

/**
 * Serialize the study data as pretty-printed JSON.
 * @param {Object} data - Collected study content and metadata.
 * @returns {string} JSON output.
 */
export function formatAsJSON(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Convert the study data into a simple HTML document.
 * @param {Object} data - Collected study content and metadata.
 * @returns {string} HTML output.
 */
export function formatAsHTML(data) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title || 'Study Notes'}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 5px; overflow-x: auto; }
    h1 { color: #333; }
    h2 { color: #555; margin-top: 2rem; }
    .meta { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>${data.title || 'Study Notes'}</h1>
  <!-- Keep the record metadata visible at the top. -->
  <div class="meta">
    <p><strong>Source:</strong> <a href="${data.url}">${data.url}</a></p>
    <p><strong>Collected:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
  </div>
  <hr>
`;

  // Mirror the markdown structure in HTML.
  if (data.content && data.content.length > 0) {
    html += `<h2>Content</h2>\n`;
    data.content.forEach(section => {
      const tag = section.level.toLowerCase();
      html += `<${tag}>${section.heading}</${tag}>\n`;
      html += `<p>${section.content.replace(/\n/g, '<br>')}</p>\n`;
    });
  }

  // Escape code so it renders safely in the browser.
  if (data.codeSnippets && data.codeSnippets.length > 0) {
    html += `<h2>Code Examples</h2>\n`;
    data.codeSnippets.forEach(snippet => {
      html += `<h3>Example ${snippet.id}</h3>\n`;
      html += `<pre><code class="language-${snippet.language}">${escapeHTML(snippet.code)}</code></pre>\n`;
    });
  }

  html += `</body></html>`;
  return html;
}

/**
 * Escape HTML special characters before injecting code content.
 * @param {string} str - Raw code text.
 * @returns {string} Escaped HTML-safe text.
 */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

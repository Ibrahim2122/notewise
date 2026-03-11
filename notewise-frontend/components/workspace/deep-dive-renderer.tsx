"use client";

import { useEffect, useRef, useState } from "react";

interface DeepDiveRendererProps {
  tsxContent: string;
}

/**
 * Renders AI-generated TSX code safely inside a sandboxed iframe using srcDoc.
 * Uses Babel standalone + React CDN to compile and run the TSX.
 * sandbox="allow-scripts" isolates AI code without needing same-origin access.
 */
export function DeepDiveRenderer({ tsxContent }: DeepDiveRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  // Strip markdown code fences if Gemini wrapped the output anyway
  const cleanedTsx = tsxContent
    .replace(/^```(?:tsx|jsx|typescript|javascript)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: transparent;
      overflow: hidden;
    }

    /* H1 — text-3xl font-bold tracking-tight text-foreground */
    h1 {
      font-size: 1.875rem; font-weight: 700; letter-spacing: -0.025em;
      color: #09090b; margin-bottom: 1rem; margin-top: 0.5rem; line-height: 1.25;
    }
    /* H2 — text-2xl font-semibold tracking-tight text-foreground border-b border-border pb-2 */
    h2 {
      font-size: 1.5rem; font-weight: 600; letter-spacing: -0.025em; color: #09090b;
      border-bottom: 1px solid #e4e4e7; padding-bottom: 0.5rem;
      margin-top: 2.5rem; margin-bottom: 0.75rem; line-height: 1.33;
    }
    h2:first-child, section:first-child > h2:first-child { margin-top: 0; }
    /* H3 — text-xl font-semibold text-foreground */
    h3 {
      font-size: 1.25rem; font-weight: 600; color: #09090b;
      margin-top: 2rem; margin-bottom: 0.5rem; line-height: 1.4;
    }
    /* H4 — text-lg font-medium text-foreground */
    h4 {
      font-size: 1.125rem; font-weight: 500; color: #09090b;
      margin-top: 1.5rem; margin-bottom: 0.5rem; line-height: 1.5;
    }
    /* Paragraph — text-base leading-7 text-muted-foreground */
    p { font-size: 1rem; line-height: 1.75rem; color: #71717a; margin-bottom: 1rem; }
    /* List items — text-base leading-7 text-muted-foreground */
    ul { list-style-type: disc; margin-left: 1.5rem; margin-bottom: 1rem; }
    ol { list-style-type: decimal; margin-left: 1.5rem; margin-bottom: 1rem; }
    li { font-size: 1rem; line-height: 1.75rem; color: #71717a; margin-bottom: 0.375rem; }
    /* Section spacing */
    section { margin-bottom: 2rem; }
    /* Blockquote — border-l-4 border-primary/30 italic text-muted-foreground, inner text-base leading-7 */
    blockquote {
      border-left: 4px solid rgba(24,24,27,0.3);
      padding: 0.25rem 0 0.25rem 1rem;
      font-style: italic; color: #71717a; margin-bottom: 1rem;
    }
    blockquote p { line-height: 1.75rem; margin-bottom: 0; }
    /* Inline code — font-mono text-[0.85em] bg-muted px-1.5 py-0.5 rounded text-foreground */
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 0.85em; background: #f4f4f5; border-radius: 0.25rem;
      padding: 0.125rem 0.375rem; color: #09090b;
    }
    /* Code block container — bordered, with optional lang label */
    pre {
      border: 1px solid #e4e4e7; border-radius: 0.5rem;
      overflow: hidden; margin-bottom: 1rem;
    }
    pre code {
      display: block; background: rgba(244,244,245,0.3); padding: 1rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.875rem; line-height: 1.5rem; color: #09090b;
      overflow-x: auto; border-radius: 0;
    }
    /* HR — border-border my-8 */
    hr { border: none; border-top: 1px solid #e4e4e7; margin: 2rem 0; }
    /* Bold / italic */
    strong { font-weight: 600; color: #09090b; }
    em { font-style: italic; }
    b { font-weight: 600; color: #09090b; }
    /* Error state */
    #error {
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem;
      padding: 1rem; color: #dc2626; font-size: 0.875rem;
      font-family: monospace; white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    function reportHeight() {
      window.parent.postMessage({ type: 'resize', height: document.body.scrollHeight }, '*');
    }
    window.onerror = function(msg, src, line, col, err) {
      document.getElementById('root').innerHTML =
        '<div id="error">Render error: ' + (err ? err.message : msg) + '</div>';
      reportHeight();
      return true;
    };
    // Report active heading for TOC highlight in parent
    function setupHeadingObserver() {
      const headings = document.querySelectorAll('h1,h2,h3');
      if (!headings.length) return;
      const obs = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.target.id) {
            window.parent.postMessage({ type: 'activeHeading', id: e.target.id }, '*');
          }
        }
      }, { rootMargin: '-80px 0px -70% 0px', threshold: 0.1 });
      headings.forEach(h => { if (h.id) obs.observe(h); });
    }
  <\/script>
  <script type="text/babel" data-presets="react,env">
    // Intercept "export default" by replacing it with a window assignment
    // so we can render the component regardless of its internal name.
    window.__deepdive_export__ = null;

    ${cleanedTsx.replace(/export\s+default\s+function\s+(\w+)/, "window.__deepdive_export__ = function $1").replace(/export\s+default\s+/, "window.__deepdive_export__ = ")}

    const Component = window.__deepdive_export__;
    if (typeof Component !== 'function') {
      throw new Error('Deep dive did not export a valid React component. Got: ' + typeof Component);
    }

    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(React.createElement(Component));

    setTimeout(() => {
      // Assign id attributes to headings based on their text content
      document.querySelectorAll('h1,h2,h3').forEach(h => {
        if (!h.id) {
          h.id = h.textContent.toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
        }
      });
      setupHeadingObserver();
      reportHeight();
      // Re-report if DOM changes after initial render
      new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true });
    }, 300);
    setTimeout(reportHeight, 1000);
  <\/script>
</body>
</html>`;

  // Listen for height messages from the iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "resize" && typeof e.data.height === "number") {
        setHeight(e.data.height + 32);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      className="w-full border-0"
      style={{ height: `${height}px`, display: "block", overflow: "hidden" }}
      sandbox="allow-scripts"
      title="Deep Dive Content"
      scrolling="no"
    />
  );
}

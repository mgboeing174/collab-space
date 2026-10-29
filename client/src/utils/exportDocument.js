import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel
} from 'docx';

function cleanHtmlToText(html = '') {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.innerText || tmp.textContent || '';
}

/**
 * Standard Native Browser Print-to-PDF:
 * Produces crisp, vector-sharp typography, native browser page breaks,
 * exact code styling, and eliminates awkward gaps and image compression.
 */
export async function exportToPdf(documentTitle, sections, metadata = {}) {
  const title = documentTitle || 'Untitled Document';
  const printWindow = window.open('', '_blank', 'width=900,height=800');

  if (!printWindow) {
    alert('Please allow popups to export high-quality PDF.');
    return;
  }

  let sectionsHtml = '';
  sections.forEach((sec, idx) => {
    const rawContent = (sec.content || '').trim();
    sectionsHtml += `
      <section class="doc-section">
        <header class="section-header">
          <div class="section-title-wrap">
            <span class="section-tag">0${idx + 1}</span>
            <h2 class="section-heading">${sec.title || 'Section'}</h2>
          </div>
          ${sec.assigned_name ? `<span class="section-assignee">Assigned: ${sec.assigned_name}</span>` : ''}
        </header>
        <div class="section-content">
          ${rawContent || '<p class="empty-text">(Empty section)</p>'}
        </div>
      </section>
    `;
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 18mm 16mm 18mm 16mm;
          /* Suppress browser default header (date/title/URL) and footer */
          margin-top: 15mm;
          margin-bottom: 15mm;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111111;
          background-color: #ffffff;
          line-height: 1.6;
          font-size: 10pt;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Document Header */
        .doc-header {
          border-bottom: 2px solid #111111;
          padding-bottom: 12pt;
          margin-bottom: 18pt;
        }

        .doc-title {
          font-size: 20pt;
          font-weight: 800;
          letter-spacing: -0.025em;
          line-height: 1.2;
          color: #111111;
          margin-bottom: 6pt;
        }

        .doc-meta-strip {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8.5pt;
          color: #666666;
          padding-top: 4pt;
        }

        .doc-meta-left {
          display: flex;
          gap: 14pt;
        }

        /* Sections */
        .doc-section {
          margin-bottom: 16pt;
          break-inside: auto;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          border-bottom: 1px solid #eeeeee;
          padding-bottom: 4pt;
          margin-bottom: 8pt;
          break-after: avoid;
        }

        .section-title-wrap {
          display: flex;
          align-items: baseline;
          gap: 6pt;
        }

        .section-tag {
          font-size: 7.5pt;
          font-weight: 700;
          color: #777777;
          letter-spacing: 0.04em;
        }

        .section-heading {
          font-size: 12pt;
          font-weight: 700;
          color: #111111;
          letter-spacing: -0.01em;
        }

        .section-assignee {
          font-size: 8pt;
          color: #555555;
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Content Elements */
        .section-content {
          font-size: 9.5pt;
          color: #2b2b2b;
          line-height: 1.6;
        }

        .section-content h1 {
          font-size: 14pt;
          font-weight: 700;
          color: #111111;
          margin: 6pt 0 4pt;
          break-after: avoid;
        }

        .section-content h2 {
          font-size: 12pt;
          font-weight: 600;
          color: #111111;
          margin: 6pt 0 4pt;
          break-after: avoid;
        }

        .section-content h3 {
          font-size: 10.5pt;
          font-weight: 600;
          color: #111111;
          margin: 4pt 0 3pt;
          break-after: avoid;
        }

        .section-content p {
          margin-bottom: 6pt;
        }

        .section-content ul, .section-content ol {
          margin: 4pt 0 8pt 16pt;
        }

        .section-content li {
          margin-bottom: 2pt;
        }

        .section-content blockquote {
          border-left: 3px solid #111111;
          background: #fafafa;
          padding: 6pt 10pt;
          margin: 6pt 0;
          font-style: italic;
          color: #444444;
          border-radius: 0 4px 4px 0;
          break-inside: avoid;
        }

        .section-content pre {
          background-color: #181818;
          color: #f0f0f0;
          padding: 8pt 10pt;
          border-radius: 5px;
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-size: 8.5pt;
          line-height: 1.45;
          margin: 6pt 0 8pt;
          white-space: pre-wrap;
          word-break: break-all;
          break-inside: auto;
        }

        .section-content code {
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-size: 8.5pt;
          background: #f0f0f0;
          padding: 1px 4px;
          border-radius: 3px;
        }

        .section-content pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }

        .section-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 6pt 0 8pt;
          font-size: 8.5pt;
        }

        .section-content th, .section-content td {
          border: 1px solid #e0e0e0;
          padding: 4pt 6pt;
          text-align: left;
        }

        .section-content th {
          background: #f7f7f7;
          font-weight: 600;
        }

        .empty-text {
          color: #999999;
          font-style: italic;
        }

        /* Footer */
        .doc-footer {
          margin-top: 24pt;
          padding-top: 8pt;
          border-top: 1px solid #eeeeee;
          display: flex;
          justify-content: space-between;
          font-size: 7.5pt;
          color: #888888;
        }
      </style>
    </head>
    <body>
      <header class="doc-header">
        <h1 class="doc-title">${title}</h1>
      </header>

      <main>
        ${sectionsHtml}
      </main>

      <script>
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.print();
          }, 250);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}

/**
 * Export document as DOCX file (.docx)
 */
export async function exportToDocx(documentTitle, sections, metadata = {}) {
  const docChildren = [];

  // Title
  docChildren.push(
    new Paragraph({
      text: documentTitle || 'Untitled Document',
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 }
    })
  );

  // Metadata
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Template: ${metadata.templateType || 'Standard'}   |   Exported: ${new Date().toLocaleDateString()}   |   CollabSpace`,
          color: '777777',
          size: 19
        })
      ],
      spacing: { after: 300 }
    })
  );

  // Sections
  sections.forEach((sec, idx) => {
    // Section Heading
    docChildren.push(
      new Paragraph({
        text: `${idx + 1}. ${sec.title || 'Section'}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 }
      })
    );

    // Section Content Paragraphs
    const plainText = cleanHtmlToText(sec.content);
    if (plainText.trim()) {
      const paragraphs = plainText.split(/\n+/).filter(Boolean);
      paragraphs.forEach((para) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: para.trim(),
                size: 22,
                color: '222222'
              })
            ],
            spacing: { after: 140 }
          })
        );
      });
    } else {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '(Empty section content)',
              italics: true,
              color: '999999',
              size: 20
            })
          ],
          spacing: { after: 140 }
        })
      );
    }
  });

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: docChildren
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(documentTitle || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Branded PDF reports for the Waste Picker Management System.
 *
 * These go to county welfare offices and partner agencies, so they are laid
 * out as documents rather than data dumps: a masthead that identifies the
 * issuing register, the filters the figures were drawn under, and page
 * numbering so a printed copy can be checked for completeness.
 */

const GREEN_700 = [27, 94, 32];
const GREEN_500 = [56, 142, 60];
const GREEN_50 = [232, 245, 233];
const INK = [17, 28, 20];
const MUTED = [91, 107, 96];
const LINE = [221, 229, 223];
const AMBER = [180, 83, 9];
const RED = [198, 40, 40];
const BLUE = [2, 119, 189];

const ORG = 'WASTE PICKER MANAGEMENT SYSTEM';
const REGISTER = 'Western Kenya Waste Picker Register';

/** Recycling mark drawn from primitives — no icon font to embed. */
function drawMark(doc, x, y, size) {
  const r = size / 2;
  doc.setFillColor(...GREEN_500);
  doc.roundedRect(x, y, size, size, 1.6, 1.6, 'F');
  doc.setFillColor(255, 255, 255);
  const cx = x + r;
  const cy = y + r;
  const t = size * 0.17;
  // three chevrons arranged around the centre, echoing the app icon
  for (const angle of [90, 210, 330]) {
    const rad = (angle * Math.PI) / 180;
    const px = cx + Math.cos(rad) * r * 0.42;
    const py = cy - Math.sin(rad) * r * 0.42;
    doc.triangle(px, py - t, px - t, py + t * 0.8, px + t, py + t * 0.8, 'F');
  }
}

function header(doc, { title, subtitle }, pageW) {
  const band = 30;
  doc.setFillColor(...GREEN_700);
  doc.rect(0, 0, pageW, band, 'F');

  drawMark(doc, 14, 8, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(ORG, 32, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 230, 201);
  doc.text(REGISTER, 32, 19.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageW - 14, 14, { align: 'right' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 230, 201);
    doc.text(subtitle, pageW - 14, 19.5, { align: 'right' });
  }
  return band;
}

/** Key/value strip describing how the figures were produced. */
function metaBlock(doc, meta, pageW, top) {
  const rows = Object.entries(meta).filter(([, v]) => v);
  if (!rows.length) return top;

  const boxH = 7 + rows.length * 4.6;
  doc.setFillColor(250, 252, 250);
  doc.setDrawColor(...LINE);
  doc.roundedRect(14, top, pageW - 28, boxH, 1.5, 1.5, 'FD');

  let y = top + 6;
  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(String(k).toUpperCase(), 19, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(String(v), 55, y);
    y += 4.6;
  }
  return top + boxH;
}

/** Headline figures shown above the table. */
function summaryStrip(doc, summary, pageW, top) {
  if (!summary?.length) return top;
  const gap = 4;
  const w = (pageW - 28 - gap * (summary.length - 1)) / summary.length;
  const h = 18;

  summary.forEach((s, i) => {
    const x = 14 + i * (w + gap);
    doc.setFillColor(...GREEN_50);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, top, w, h, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...GREEN_700);
    doc.text(String(s.value), x + 4, top + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(String(s.label).toUpperCase(), x + 4, top + 14);
  });
  return top + h;
}

function footer(doc, pageW, pageH) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${ORG}  ·  Official report`, 14, pageH - 9);
    doc.text(`Page ${i} of ${pages}`, pageW - 14, pageH - 9, { align: 'right' });
  }
}

/** Colours the status / audience words so a printed page still reads clearly. */
const TONE = {
  approved: GREEN_700,
  pending: AMBER,
  rejected: RED,
  suspended: MUTED,
  all: BLUE,
  region: GREEN_700,
  individual: MUTED,
};

/**
 * Lays the report out and returns the jsPDF document without saving it, so the
 * same code path can be exercised and inspected outside a browser download.
 */
export function renderReport({
  title,
  subtitle,
  meta = {},
  summary = [],
  columns,
  rows,
  orientation = 'portrait',
  toneColumn,
}) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  let y = header(doc, { title, subtitle }, pageW) + 8;
  y = metaBlock(doc, meta, pageW, y) + 6;
  y = summaryStrip(doc, summary, pageW, y);
  if (summary.length) y += 6;

  const toneIdx = toneColumn ? columns.findIndex((c) => c.key === toneColumn) : -1;

  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => c.value(r))),
    margin: { left: 14, right: 14, bottom: 20 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 },
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: GREEN_700,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: [250, 252, 250] },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [
        i,
        {
          cellWidth: c.width ?? 'auto',
          halign: c.align ?? 'left',
          font: c.mono ? 'courier' : 'helvetica',
          fontStyle: c.bold ? 'bold' : 'normal',
        },
      ])
    ),
    didParseCell: (d) => {
      if (d.section === 'body' && toneIdx >= 0 && d.column.index === toneIdx) {
        const tone = TONE[String(d.cell.raw).toLowerCase().trim()];
        if (tone) {
          d.cell.styles.textColor = tone;
          d.cell.styles.fontStyle = 'bold';
        }
      }
    },
    // Repeat the masthead on continuation pages so a loose sheet is identifiable
    didDrawPage: (d) => {
      if (d.pageNumber > 1) header(doc, { title, subtitle }, pageW);
    },
  });

  const endY = doc.lastAutoTable.finalY;
  if (endY < pageH - 34) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      'This report is generated from live system records. Figures reflect the moment of generation.',
      14,
      endY + 7
    );
  }

  footer(doc, pageW, pageH);
  return doc;
}

/** Renders the report and hands it to the browser as a download. */
export function buildReportPdf(options) {
  renderReport(options).save(options.filename);
}


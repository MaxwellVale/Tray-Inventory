import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts } from "pdf-lib";

const trayIds = [
  "TRAY-001",
  "TRAY-002",
  "TRAY-003",
  "TRAY-004",
  "TRAY-005",
];

const baseUrl = "https://tray-inventory-delta.vercel.app/tray";

// ---------- Output folders ----------
const outputDir = "./qr-output";
const pngDir = path.join(outputDir, "png");
const pdfPath = path.join(outputDir, "tray-qr-sheet.pdf");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir);

// ---------- Page/layout settings ----------
const MM_TO_PT = 72 / 25.4;

// A4 page in points
const pageWidth = 210 * MM_TO_PT;
const pageHeight = 297 * MM_TO_PT;

// Label cell settings
const cellSizeMm = 40;          // overall square cell size
const qrSizeMm = 30;            // QR size inside the cell
const textHeightMm = 5;         // space for tray ID text
const gapMm = 4;                // gap between cells
const marginMm = 10;            // page margin

const cellSize = cellSizeMm * MM_TO_PT;
const qrSize = qrSizeMm * MM_TO_PT;
const textHeight = textHeightMm * MM_TO_PT;
const gap = gapMm * MM_TO_PT;
const margin = marginMm * MM_TO_PT;

// ---------- Individual PNG generation ----------
async function generateIndividualPNGs() {
  for (const trayId of trayIds) {
    const url = `${baseUrl}/${trayId}`;
    const filePath = path.join(pngDir, `${trayId}.png`);

    await QRCode.toFile(filePath, url, {
      width: 500,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    console.log(`Generated PNG: ${filePath}`);
  }
}

// ---------- Printable PDF sheet generation ----------
async function generatePrintableSheet() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);

  const usableWidth = pageWidth - 2 * margin;
  const usableHeight = pageHeight - 2 * margin;

  const cols = Math.floor((usableWidth + gap) / (cellSize + gap));
  const rows = Math.floor((usableHeight + gap) / (cellSize + gap));

  const cellsPerPage = cols * rows;

  let indexOnPage = 0;

  for (let i = 0; i < trayIds.length; i++) {
    if (indexOnPage >= cellsPerPage) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      indexOnPage = 0;
    }

    const trayId = trayIds[i];
    const url = `${baseUrl}/${trayId}`;

    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);

    const x = margin + col * (cellSize + gap);
    const yTop = pageHeight - margin - row * (cellSize + gap);
    const y = yTop - cellSize;

    // Make QR image in memory
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 500,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const qrBase64 = qrDataUrl.split(",")[1];
    const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, "base64"));

    // Center QR in cell, leaving room for text below
    const qrX = x + (cellSize - qrSize) / 2;
    const qrY = y + textHeight + (cellSize - textHeight - qrSize) / 2;

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    // Draw tray ID centered under QR
    const fontSize = 8;
    const textWidth = font.widthOfTextAtSize(trayId, fontSize);
    const textX = x + (cellSize - textWidth) / 2;
    const textY = y + 4;

    page.drawText(trayId, {
      x: textX,
      y: textY,
      size: fontSize,
      font,
    });

    indexOnPage++;
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);

  console.log(`Generated PDF sheet: ${pdfPath}`);
  console.log(`Grid layout: ${cols} columns x ${rows} rows per page`);
}

// ---------- Run ----------
async function main() {
  await generateIndividualPNGs();
  await generatePrintableSheet();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
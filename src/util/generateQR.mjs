import QRCode from "qrcode";
import fs from "fs";
import path from "path";

const trayIds = ["TRAY-001", "TRAY-002", "TRAY-003", "TRAY-004", "TRAY-005"];
const base = "tray-inventory-delta.vercel.app";
const baseUrl = `https://${base}/tray`; // use backticks to format the string

const outputDir = "./qr-output";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

async function generateQRCodes() {
  for (const trayId of trayIds) {
    const url = `${baseUrl}/${trayId}`;
    const filePath = path.join(outputDir, `${trayId}.png`);

    await QRCode.toFile(filePath, url, {
      width: 400,
      margin: 2,
    });

    console.log(`Generated ${filePath}`);
  }
}

generateQRCodes().catch(console.error);
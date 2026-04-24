import QRCode from "qrcode";
import fs from "fs";
import path from "path";

const trayIds = ["TRAY-005"];
const ip = "192.168.61.11";
const port = "5173";
const baseUrl = `http://${ip}:${port}/tray`; // use backticks to format the string

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
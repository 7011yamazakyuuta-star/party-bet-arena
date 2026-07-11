import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const imagePath = process.argv[2];

if (!imagePath) {
  console.error("Usage: npm run verify:qr -- <screenshot.png|screenshot.jpg>");
  process.exit(1);
}

const absolutePath = path.resolve(imagePath);
const bytes = fs.readFileSync(absolutePath);
const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
const decodedImage = isJpeg
  ? jpeg.decode(bytes, { formatAsRGBA: true, useTArray: true })
  : PNG.sync.read(bytes);
const qr = jsQR(
  new Uint8ClampedArray(decodedImage.data),
  decodedImage.width,
  decodedImage.height,
);

if (!qr) {
  console.error(`No readable QR code found in ${absolutePath}`);
  process.exit(1);
}

const url = new URL(qr.data);
const roomId = url.searchParams.get("roomId");
const joinCode = url.searchParams.get("joinCode");

if (!roomId || !joinCode) {
  console.error(`QR payload is missing roomId or joinCode: ${qr.data}`);
  process.exit(1);
}

console.log(`QR verified: ${qr.data}`);
console.log(`Room ID: ${roomId}`);
console.log(`Join code: ${joinCode}`);

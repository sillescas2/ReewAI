import fs from 'fs';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crcBuf]);
}

function generatePng(width, height, isMaskable = false) {
  // RGBA raw bitmap with filter type 0 byte at the start of each row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Gradient background: indigo (#4F46E5) to violet (#7C3AED) to pink (#EC4899)
      const t = (x + y) / (width + height);
      let r = Math.round(79 + t * (236 - 79));
      let g = Math.round(70 + t * (72 - 70));
      let b = Math.round(229 + t * (153 - 229));
      let a = 255;

      // Outer rounded rect if not maskable
      if (!isMaskable) {
        const radius = width * 0.22;
        const dx = Math.max(0, Math.abs(x - cx) - (cx - radius));
        const dy = Math.max(0, Math.abs(y - cy) - (cy - radius));
        if (dx * dx + dy * dy > radius * radius) {
          a = 0;
        }
      }

      // Draw emblem in center (camera / reel play triangle + border)
      const scale = isMaskable ? 0.40 : 0.48;
      const boxHalf = (width * scale) / 2;
      const insideBox = Math.abs(x - cx) <= boxHalf && Math.abs(y - cy) <= boxHalf;
      const onBorder = insideBox && (
        Math.abs(Math.abs(x - cx) - boxHalf) <= width * 0.025 ||
        Math.abs(Math.abs(y - cy) - boxHalf) <= height * 0.025
      );

      // Play triangle in the middle
      const tx = x - (cx - width * 0.03);
      const ty = y - cy;
      const triH = width * 0.16;
      const insideTriangle = tx >= -triH * 0.5 && tx <= triH * 0.7 && Math.abs(ty) <= (triH * 0.7 - tx) * 0.7;

      if (insideTriangle || onBorder) {
        r = 255;
        g = 255;
        b = 255;
        a = 255;
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate files
fs.writeFileSync('public/pwa-192x192.png', generatePng(192, 192, false));
fs.writeFileSync('public/pwa-512x512.png', generatePng(512, 512, false));
fs.writeFileSync('public/apple-touch-icon.png', generatePng(180, 180, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', generatePng(512, 512, true));

console.log('Successfully generated compliant PWA icons!');

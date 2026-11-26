// The World in One Day — Thursday 26 November 2026.
// A deterministic Node program (stdlib only, no network, no randomness)
// that draws a newspaper front page summing up the day's world news
// and writes it to /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
// 1024x1024 PNG, well under 1 MiB. Two runs write identical bytes.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

export const WIDTH = 1024;
export const HEIGHT = 1024;

// ---- palette ----
const PAPER: RGB = [251, 243, 223];
const INK: RGB = [26, 26, 26];
const RED: RGB = [176, 30, 30];
const GREY: RGB = [90, 90, 90];
const SKY: RGB = [203, 214, 222];
const DARK: RGB = [43, 43, 43];
const SMOKE: RGB = [120, 120, 120];
const SMOKE_LIGHT: RGB = [168, 168, 168];
const SAND: RGB = [214, 196, 150];

type RGB = [number, number, number];

// ---- canvas ----
const px = new Uint8Array(WIDTH * HEIGHT * 3);

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(WIDTH, x + w);
  const y1 = Math.min(HEIGHT, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * WIDTH + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = cy - r; yy <= cy + r; yy++) {
    for (let xx = cx - r; xx <= cx + r; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) {
        if (xx >= 0 && xx < WIDTH && yy >= 0 && yy < HEIGHT) {
          const i = (yy * WIDTH + xx) * 3;
          px[i] = c[0];
          px[i + 1] = c[1];
          px[i + 2] = c[2];
        }
      }
    }
  }
}

function rule(x: number, y: number, w: number, h: number, c: RGB): void {
  fillRect(x, y, w, h, c);
}

// ---- 5x7 bitmap font (rows of 5 bits, "1" = ink) ----
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
};

// Normalise curly quotes/dashes to the ASCII glyphs we have.
function normalise(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .toUpperCase();
}

function textWidth(s: string, scale: number): number {
  return normalise(s).length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  const t = normalise(s);
  for (let ci = 0; ci < t.length; ci++) {
    const g = FONT[t[ci]] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          fillRect(x + ci * 6 * scale + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentred(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Greedy word wrap; returns lines that fit maxWidth px at the scale.
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const words = normalise(s).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur === "" ? w : cur + " " + w;
    if (textWidth(next, scale) <= maxWidth) {
      cur = next;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---- PNG encoder (zlib deflate, correct CRCs, filter 0) ----
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * (1 + WIDTH * 3)] = 0;
    Buffer.from(px.buffer, y * WIDTH * 3, WIDTH * 3).copy(raw, y * (1 + WIDTH * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- the front page ----

const MARGIN = 32;
const CONTENT_W = WIDTH - 2 * MARGIN;

function drawIllustration(x: number, y: number, w: number, h: number): void {
  // Ras Tanura refinery under a smoke plume: sky, sun, towers, smoke.
  fillRect(x, y, w, h, SKY);
  fillCircle(x + 120, y + 52, 34, [238, 214, 140]); // low sun
  // distant storage tanks
  fillRect(x + 60, y + h - 78, 90, 48, DARK);
  fillRect(x + 170, y + h - 66, 70, 36, DARK);
  fillCircle(x + 105, y + h - 78, 45, DARK);
  fillCircle(x + 205, y + h - 66, 35, DARK);
  // distillation towers
  fillRect(x + 330, y + h - 150, 34, 120, DARK);
  fillRect(x + 330, y + h - 158, 34, 8, DARK);
  fillRect(x + 380, y + h - 120, 26, 90, DARK);
  fillRect(x + 420, y + h - 96, 20, 66, DARK);
  // flare stack with a small flame
  fillRect(x + 520, y + h - 168, 12, 138, DARK);
  fillCircle(x + 526, y + h - 172, 9, [224, 122, 30]);
  // chimneys
  fillRect(x + 600, y + h - 132, 22, 102, DARK);
  fillRect(x + 640, y + h - 108, 18, 78, DARK);
  // smoke plume rising over the refinery, drifting right
  fillCircle(x + 640, y + 96, 40, SMOKE);
  fillCircle(x + 690, y + 72, 52, SMOKE_LIGHT);
  fillCircle(x + 752, y + 52, 58, SMOKE);
  fillCircle(x + 826, y + 40, 48, SMOKE_LIGHT);
  fillCircle(x + 890, y + 34, 38, SMOKE);
  fillCircle(x + 712, y + 96, 34, SMOKE);
  fillCircle(x + 780, y + 78, 30, SMOKE_LIGHT);
  // ground
  fillRect(x, y + h - 30, w, 30, SAND);
  fillRect(x, y + h - 30, w, 3, DARK);
  // frame
  fillRect(x, y, w, 3, INK);
  fillRect(x, y + h - 3, w, 3, INK);
  fillRect(x, y, 3, h, INK);
  fillRect(x + w - 3, y, 3, h, INK);
}

interface Story {
  kicker: string;
  headline: string[];
  body: string;
}

const SECONDARY: Story[] = [
  {
    kicker: "EGYPT",
    headline: ["CAIRO TANKER BLAZE", "KILLS AT LEAST 30"],
    body: "A fuel tanker crashes and explodes on the Ring Road, setting dozens of cars ablaze. The toll is preliminary.",
  },
  {
    kicker: "UNITED STATES",
    headline: ["US UNVEILS SWEEPING", "NEW TARIFFS"],
    body: "Broad 'excess capacity' duties target China, the EU, Brazil and others over subsidised factories.",
  },
  {
    kicker: "GAZA",
    headline: ["ISRAEL KILLS SENIOR", "HAMAS OFFICIAL"],
    body: "Mohammad Abuelouf, a Hamas security colonel, is killed in a strike as the ceasefire comes under strain.",
  },
  {
    kicker: "SPACE",
    headline: ["PAKISTAN'S FIRST", "ASTRONAUT FLIES"],
    body: "Muhammad Zeeshan Ali joins China's Shenzhou-24 mission to the Tiangong space station.",
  },
];

function drawStory(s: Story, x: number, y: number, w: number): void {
  drawText(s.kicker, x, y, 2, RED);
  let yy = y + 22;
  for (const line of s.headline) {
    drawText(line, x, yy, 3, INK);
    yy += 26;
  }
  const bodyLines = wrap(s.body, w, 2);
  yy += 4;
  for (const line of bodyLines) {
    drawText(line, x, yy, 2, INK);
    yy += 15;
  }
}

function drawPage(): void {
  fillRect(0, 0, WIDTH, HEIGHT, PAPER);

  // top rule + masthead
  rule(MARGIN, 22, CONTENT_W, 2, INK);
  drawTextCentred("THE WORLD IN ONE DAY", WIDTH / 2, 38, 6, INK);
  drawTextCentred("THURSDAY 26 NOVEMBER 2026", WIDTH / 2, 96, 3, INK);
  rule(MARGIN, 126, CONTENT_W, 4, RED);
  rule(MARGIN, 134, CONTENT_W, 2, INK);

  // lead kicker + headline
  drawTextCentred("MIDDLE EAST - OIL", WIDTH / 2, 150, 2, RED);
  drawTextCentred("HOUTHIS SAY THEY HIT", WIDTH / 2, 172, 5, INK);
  drawTextCentred("SAUDI'S LARGEST REFINERY", WIDTH / 2, 212, 5, INK);

  // lead standfirst
  const stand =
    "Satellite images show thick black smoke over Ras Tanura, the kingdom's biggest refinery; Riyadh says four drones were shot down. Brent crude jumps above $93 a barrel.";
  const standLines = wrap(stand, CONTENT_W, 2);
  let yy = 258;
  for (const line of standLines) {
    drawTextCentred(line, WIDTH / 2, yy, 2, INK);
    yy += 15;
  }

  // illustration
  const illY = 312;
  drawIllustration(MARGIN, illY, CONTENT_W, 200);
  drawTextCentred(
    "RAS TANURA, SAUDI ARABIA - SMOKE SEEN BY SATELLITE. (ILLUSTRATION)",
    WIDTH / 2,
    illY + 212,
    2,
    GREY,
  );

  // divider
  rule(MARGIN, 556, CONTENT_W, 2, INK);

  // secondary stories, two columns x two rows
  const colW = 464;
  const colX = [MARGIN, MARGIN + colW + 32];
  drawStory(SECONDARY[0], colX[0], 576, colW);
  drawStory(SECONDARY[1], colX[1], 576, colW);
  drawStory(SECONDARY[2], colX[0], 748, colW);
  drawStory(SECONDARY[3], colX[1], 748, colW);

  // bottom rule + ALSO strip
  rule(MARGIN, 918, CONTENT_W, 2, INK);
  const also =
    "Sooryavanshi, 15, smashes a record 204 off 53 balls - India marks 18 years since the 26/11 Mumbai attacks - Gukesh draws Game 2 of the world title match - North Korea expels a Swiss diplomat - Six die as a plane crashes into the Gulf of Mexico.";
  const alsoLines = wrap("ALSO: " + also, CONTENT_W, 2);
  let ay = 936;
  for (const line of alsoLines) {
    drawText(line, MARGIN, ay, 2, INK);
    ay += 15;
  }
  rule(MARGIN, 1000, CONTENT_W, 2, INK);
}

function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/entry.png`;
  writeFileSync(outPath, png);
  const hash = createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${hash})`);
}

main();

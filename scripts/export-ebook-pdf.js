const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('@playwright/test');

function parseArgs(argv) {
  const args = {
    input: 'workspace/backup/master.html',
    output: null,
    scale: 2,
    keepPngs: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input' && argv[i + 1]) args.input = argv[++i];
    else if (token === '--output' && argv[i + 1]) args.output = argv[++i];
    else if (token === '--scale' && argv[i + 1]) args.scale = Number(argv[++i]) || 2;
    else if (token === '--keep-pngs') args.keepPngs = true;
  }

  return args;
}

function defaultOutput() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return path.join(os.homedir(), 'Downloads', `JNote_ebook_${yy}-${mm}-${dd}_raster.pdf`);
}

async function renderPagesToPngs(inputPath, pngDir, scale) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 2200 },
    deviceScaleFactor: scale,
  });

  await page.goto(`file://${inputPath}`, {
    waitUntil: 'domcontentloaded',
    timeout: 0,
  });

  await page.addStyleTag({
    content: `
      * {
        animation: none !important;
        transition: none !important;
      }
      body {
        gap: 0 !important;
        padding: 0 !important;
      }
      .page {
        box-shadow: none !important;
        margin: 0 !important;
      }
    `,
  });

  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });

  const handles = await page.locator('.page').elementHandles();
  if (!handles.length) {
    throw new Error('`.page` 요소를 찾지 못했습니다.');
  }

  let index = 1;
  for (const handle of handles) {
    const output = path.join(pngDir, `${String(index).padStart(2, '0')}.png`);
    await handle.screenshot({ path: output });
    index += 1;
  }

  await browser.close();
  return handles.length;
}

function buildPdfFromPngs(pngDir, outputPath) {
  const py = `
from pathlib import Path
from PIL import Image
import sys

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
images = []
for p in sorted(src.glob('*.png')):
    images.append(Image.open(p).convert('RGB'))

if not images:
    raise SystemExit('png-not-found')

first, rest = images[0], images[1:]
first.save(dst, save_all=True, append_images=rest, resolution=150.0)
print(dst)
`;

  const result = spawnSync('python3', ['-c', py, pngDir, outputPath], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'PDF 생성에 실패했습니다.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output || defaultOutput());

  if (!fs.existsSync(inputPath)) {
    throw new Error(`입력 파일을 찾을 수 없습니다: ${inputPath}`);
  }

  const pngDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jnote-pdf-'));

  try {
    const count = await renderPagesToPngs(inputPath, pngDir, args.scale);
    buildPdfFromPngs(pngDir, outputPath);
    console.log(`pages=${count}`);
    console.log(`output=${outputPath}`);
    if (args.keepPngs) {
      console.log(`png_dir=${pngDir}`);
    } else {
      fs.rmSync(pngDir, { recursive: true, force: true });
    }
  } catch (error) {
    fs.rmSync(pngDir, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

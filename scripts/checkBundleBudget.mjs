import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');

const budgets = [
  { name: 'index', matcher: /^index-.*\.js$/, maxKb: 300 },
  { name: 'vendor-charts', matcher: /^vendor-charts-.*\.js$/, maxKb: 550 },
];

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}

async function main() {
  const assetFiles = await readdir(distAssetsDir);
  const failures = [];

  for (const budget of budgets) {
    const filename = assetFiles.find((file) => budget.matcher.test(file));
    if (!filename) {
      failures.push(`No se encontró el asset esperado para "${budget.name}" en dist/assets.`);
      continue;
    }

    const filePath = path.join(distAssetsDir, filename);
    const { size } = await stat(filePath);
    const sizeKb = size / 1024;

    console.log(`[bundle-budget] ${budget.name}: ${formatKb(size)} kB / límite ${budget.maxKb} kB (${filename})`);

    if (sizeKb > budget.maxKb) {
      failures.push(
        `El asset "${budget.name}" pesa ${formatKb(size)} kB y supera el límite de ${budget.maxKb} kB.`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('[bundle-budget] Presupuesto excedido:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('[bundle-budget] OK');
}

main().catch((error) => {
  console.error('[bundle-budget] Error comprobando presupuestos:', error);
  process.exit(1);
});

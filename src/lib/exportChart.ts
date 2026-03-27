import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { downloadFileBuffer } from '@/lib/weatherUtils';

export async function exportChartAsPng(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(element, { cacheBust: true });
  const res = await fetch(dataUrl);
  const buffer = await res.arrayBuffer();
  downloadFileBuffer(buffer, `${filename}.png`, 'image/png');
}

export async function exportChartAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(element, { cacheBust: true });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;

  // A4 landscape if wider than tall, portrait otherwise
  const isLandscape = imgWidth > imgHeight;
  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;

  const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight) * 0.9;
  const scaledW = imgWidth * scale;
  const scaledH = imgHeight * scale;
  const x = (pageWidth - scaledW) / 2;
  const y = (pageHeight - scaledH) / 2;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  pdf.addImage(dataUrl, 'PNG', x, y, scaledW, scaledH);

  const buffer = pdf.output('arraybuffer');
  downloadFileBuffer(buffer, `${filename}.pdf`, 'application/pdf');
}

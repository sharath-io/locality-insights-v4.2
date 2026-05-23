import { useCallback, useRef } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { toast } from 'sonner';

export type ExportFormat = 'instagram' | 'whatsapp' | 'print';

const DIMENSIONS: Record<ExportFormat, { width: number; height: number; pixelRatio: number }> = {
  instagram: { width: 1080, height: 1080, pixelRatio: 2 },
  whatsapp: { width: 1080, height: 720, pixelRatio: 2 },
  print: { width: 3508, height: 2480, pixelRatio: 1 },
};

const FONT_URL =
  'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2';

let cachedFontCss: string | null = null;

async function getFontFaceCss(): Promise<string> {
  if (cachedFontCss) return cachedFontCss;
  try {
    const res = await fetch(FONT_URL);
    const buf = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    cachedFontCss = `@font-face { font-family: 'Playfair Display'; font-style: normal; font-weight: 400; src: url(data:font/woff2;base64,${base64}) format('woff2'); }`;
    return cachedFontCss;
  } catch (err) {
    console.error('Font fetch failed', err);
    return '';
  }
}

function injectFontStyle(svg: SVGSVGElement, css: string): SVGStyleElement {
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.setAttribute('data-brochure-font', 'true');
  style.textContent = css;
  svg.insertBefore(style, svg.firstChild);
  return style;
}

export function useBrochureExport(
  svgRef: React.RefObject<SVGSVGElement | null>,
  exportFormat: ExportFormat,
  reportId: string,
) {
  const busyRef = useRef(false);

  const withFont = useCallback(
    async <T,>(fn: (node: SVGSVGElement, dim: typeof DIMENSIONS[ExportFormat]) => Promise<T>): Promise<T | null> => {
      if (!svgRef.current || busyRef.current) return null;
      busyRef.current = true;
      const svg = svgRef.current;
      const css = await getFontFaceCss();
      const styleNode = css ? injectFontStyle(svg, css) : null;
      const dim = DIMENSIONS[exportFormat];
      try {
        return await fn(svg, dim);
      } finally {
        if (styleNode && styleNode.parentNode) styleNode.parentNode.removeChild(styleNode);
        busyRef.current = false;
      }
    },
    [svgRef, exportFormat],
  );

  const exportPng = useCallback(async () => {
    try {
      const ok = await withFont(async (node, dim) => {
        const dataUrl = await toPng(node as unknown as HTMLElement, {
          width: dim.width,
          height: dim.height,
          pixelRatio: dim.pixelRatio,
          cacheBust: true,
        });
        const link = document.createElement('a');
        link.download = `locateiq-${reportId}-${exportFormat}.png`;
        link.href = dataUrl;
        link.click();
        return true;
      });
      if (ok) toast.success('✦ Brochure exported');
    } catch (err) {
      console.error(err);
      toast.error('Export failed. Please try again.');
    }
  }, [withFont, exportFormat, reportId]);

  const copyToClipboard = useCallback(async () => {
    try {
      const blob = await withFont(async (node, dim) =>
        toBlob(node as unknown as HTMLElement, {
          width: dim.width,
          height: dim.height,
          pixelRatio: dim.pixelRatio,
          cacheBust: true,
        }),
      );
      if (!blob) throw new Error('No blob produced');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('✦ Copied to clipboard — paste into WhatsApp');
    } catch (err) {
      console.error(err);
      toast.error('Copy failed. Your browser may not support image clipboard.');
    }
  }, [withFont]);

  return { exportPng, copyToClipboard };
}

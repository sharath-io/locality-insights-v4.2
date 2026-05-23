import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Instagram, MessageCircle, Printer, Download, Copy, Link2 } from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';
import { fetchRoads } from '@/lib/fetch-roads.functions';
import { useBrochureExport } from '@/hooks/useBrochureExport';
import BrochureCanvas from './BrochureCanvas';
import type { RoadSegment } from '@/types';

type Template = 'connectivity' | 'proximity' | 'investment';
type ExportFormat = 'instagram' | 'whatsapp' | 'print';

const TEMPLATES: Array<{ id: Template; name: string; colors: [string, string] }> = [
  { id: 'connectivity', name: 'Connectivity Map', colors: ['#0f1e35', '#b8954a'] },
  { id: 'proximity', name: 'Proximity Cards', colors: ['#3d5a7a', '#e8a87c'] },
  { id: 'investment', name: 'Investment Brief', colors: ['#1a3c2a', '#d4b077'] },
];

const FORMATS: Array<{ id: ExportFormat; label: string; Icon: typeof Instagram }> = [
  { id: 'instagram', label: 'Instagram (1:1)', Icon: Instagram },
  { id: 'whatsapp', label: 'WhatsApp (3:2)', Icon: MessageCircle },
  { id: 'print', label: 'Print A4', Icon: Printer },
];

export default function BrochureModal() {
  const open = useReportStore((s) => s.brochureOpen);
  const setOpen = useReportStore((s) => s.setBrochureOpen);
  const report = useReportStore((s) => s.locationReport);

  const fetchRoadsFn = useServerFn(fetchRoads);
  const [roads, setRoads] = useState<RoadSegment[] | null>(null);
  const [loadingRoads, setLoadingRoads] = useState(false);
  const [template, setTemplate] = useState<Template>('connectivity');
  const [projectName, setProjectName] = useState(report?.site.label ?? 'Site Location');
  const [format, setFormat] = useState<ExportFormat>('instagram');
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { exportPng, copyToClipboard } = useBrochureExport(svgRef, format, report?.reportId ?? 'report');

  useEffect(() => {
    if (report) setProjectName(report.site.label);
  }, [report]);

  useEffect(() => {
    if (!open || !report) return;
    let cancelled = false;
    setRoads(null);
    setLoadingRoads(true);
    fetchRoadsFn({ data: { bbox: report.bbox } })
      .then((r) => {
        if (!cancelled) setRoads(r);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          toast.error('Could not load road data. Showing fallback map.');
          setRoads([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRoads(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, report, fetchRoadsFn]);

  const handleShareWhatsApp = () => {
    const msg = `Check out the vicinity report for ${projectName}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden bg-transparent border-none shadow-none">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="grid grid-cols-1 md:grid-cols-[65fr_35fr] bg-white rounded-xl overflow-hidden"
            >
              {/* LEFT — Canvas */}
              <div className="bg-[#1a1a1a] p-6 flex items-center justify-center min-h-[480px]">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  ref={canvasWrapRef}
                  className="relative w-full shadow-2xl"
                  style={{ boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}
                >
                  <BrochureCanvas ref={svgRef} report={report} projectName={projectName} roads={roads ?? undefined} />
                  {loadingRoads && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded">
                      <div className="flex flex-col items-center gap-3 text-white">
                        <div className="w-8 h-8 border-2 border-[#b8954a] border-t-transparent rounded-full animate-spin" />
                        <div className="text-xs tracking-widest uppercase">Generating map…</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* RIGHT — Controls */}
              <div className="bg-[#f5f0e8] p-6 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
                {/* TEMPLATE */}
                <div>
                  <div className="text-[10px] tracking-[0.25em] text-[#b8954a] font-semibold uppercase mb-3">
                    Template
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPLATES.map((t) => {
                      const active = template === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTemplate(t.id)}
                          className={`text-left p-2 rounded border transition ${
                            active
                              ? 'border-[#b8954a] bg-white shadow-sm'
                              : 'border-[#e8e2d4] bg-white/60 hover:bg-white'
                          }`}
                        >
                          <div className="w-full h-10 rounded-sm flex overflow-hidden mb-1.5">
                            <div className="flex-1" style={{ background: t.colors[0] }} />
                            <div className="w-1/3" style={{ background: t.colors[1] }} />
                          </div>
                          <div className="text-[10px] font-medium text-[#0f1e35] leading-tight">
                            {t.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-[#d4b077]/40" />

                {/* PROJECT NAME */}
                <div>
                  <div className="text-[10px] tracking-[0.25em] text-[#b8954a] font-semibold uppercase mb-3">
                    Project Name
                  </div>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-white border border-[#e8e2d4] rounded-md px-3 py-2 text-sm text-[#0f1e35] focus:outline-none focus:border-[#b8954a]"
                  />
                </div>

                <div className="h-px bg-[#d4b077]/40" />

                {/* EXPORT AS */}
                <div>
                  <div className="text-[10px] tracking-[0.25em] text-[#b8954a] font-semibold uppercase mb-3">
                    Export As
                  </div>
                  <div className="flex flex-col gap-2">
                    {FORMATS.map((f) => {
                      const active = format === f.id;
                      const Icon = f.Icon;
                      return (
                        <label
                          key={f.id}
                          className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition ${
                            active
                              ? 'border-[#b8954a] bg-white'
                              : 'border-[#e8e2d4] bg-white/60 hover:bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="format"
                            checked={active}
                            onChange={() => setFormat(f.id)}
                            className="accent-[#b8954a]"
                          />
                          <Icon className="w-4 h-4 text-[#0f1e35]" />
                          <span className="text-[13px] text-[#0f1e35]">{f.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1" />

                <div className="flex gap-2">
                  <button
                    onClick={exportPng}
                    className="flex-1 bg-[#b8954a] text-[#0f1e35] rounded-lg py-3 flex items-center justify-center gap-2 hover:brightness-105 transition"
                    style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 600 }}
                  >
                    Export PNG <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={copyToClipboard}
                    title="Copy to clipboard"
                    className="w-12 rounded-lg border border-[#0f1e35]/30 text-[#0f1e35] flex items-center justify-center hover:bg-[#0f1e35]/5 transition"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleShareWhatsApp}
                    title="Share to WhatsApp"
                    className="flex-1 border border-[#0f1e35]/30 text-[#0f1e35] rounded-md py-2 flex items-center justify-center gap-1.5 text-xs hover:bg-[#0f1e35]/5 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    onClick={handleCopyLink}
                    title="Copy link"
                    className="flex-1 border border-[#0f1e35]/30 text-[#0f1e35] rounded-md py-2 flex items-center justify-center gap-1.5 text-xs hover:bg-[#0f1e35]/5 transition"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Link
                  </button>
                  <button
                    onClick={exportPng}
                    title="Download"
                    className="flex-1 border border-[#0f1e35]/30 text-[#0f1e35] rounded-md py-2 flex items-center justify-center gap-1.5 text-xs hover:bg-[#0f1e35]/5 transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

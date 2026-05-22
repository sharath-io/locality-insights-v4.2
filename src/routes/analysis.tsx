import { createFileRoute } from '@tanstack/react-router';
import { useReportStore } from '@/stores/reportStore';

export const Route = createFileRoute('/analysis')({
  head: () => ({
    meta: [
      { title: 'Vicinity Analysis — LocateIQ' },
      { name: 'description', content: 'Intelligent vicinity insights for any location.' },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { coordinates, selectedCategories } = useReportStore();
  return (
    <main className="min-h-screen bg-[var(--cream)] p-10 font-body">
      <h1 className="font-heading text-4xl text-[var(--navy)]">Analysis</h1>
      <p className="mt-2 text-[var(--muted)]">
        Coordinates: {coordinates ? `${coordinates.lat}, ${coordinates.lng}` : 'None'}
      </p>
      <p className="mt-1 text-[var(--muted)]">
        Selected layers ({selectedCategories.length}): {selectedCategories.join(', ') || 'None'}
      </p>
    </main>
  );
}

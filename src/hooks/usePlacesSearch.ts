import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { useReportStore } from '@/stores/reportStore';
import { nearbySearch } from '@/lib/nearby-search.functions';

export function usePlacesSearch() {
  const coordinates = useReportStore((s) => s.coordinates);
  const selectedCategories = useReportStore((s) => s.selectedCategories);
  const setLocationReport = useReportStore((s) => s.setLocationReport);
  const setIsGenerating = useReportStore((s) => s.setIsGenerating);
  const fetchNearby = useServerFn(nearbySearch);
  const ranKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!coordinates || selectedCategories.length === 0) return;
    const key = `${coordinates.lat},${coordinates.lng}|${selectedCategories.join(',')}`;
    // Always run the fetch when coordinates/categories change or component mounts
    // (We removed the ranKeyRef early return to ensure the data is fetched when navigating back)

    let cancelled = false;
    (async () => {
      setIsGenerating(true);
      try {
        const report = await fetchNearby({
          data: {
            lat: coordinates.lat,
            lng: coordinates.lng,
            categories: selectedCategories,
            radiusMeters: 5000,
          },
        });
        if (!cancelled) {
          setLocationReport(report);
          const total = report.pois.reduce((n, g) => n + g.items.length, 0);
          if (total === 0) {
            toast.error(
              'No nearby places returned. The Google Places API daily quota may be exhausted — try again tomorrow or increase the quota.',
            );
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) toast.error('Failed to load vicinity data. Please try again.');
      } finally {
        // Always clear the loading state — even if this effect was cleaned up
        // (React StrictMode double-invoke), so the overlay never gets stuck.
        setIsGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coordinates, selectedCategories, fetchNearby, setLocationReport, setIsGenerating]);
}

import { createFileRoute } from '@tanstack/react-router';
import LandingPage from '@/components/LandingPage';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'LocateIQ — Locality Analysis for Real Estate' },
      {
        name: 'description',
        content:
          'Generate intelligent vicinity insights from any Google Maps location with brochure-ready precision.',
      },
    ],
  }),
  component: LandingPage,
});

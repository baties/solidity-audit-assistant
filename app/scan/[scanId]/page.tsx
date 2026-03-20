import { ReportCard } from '@/components/ReportCard';

/**
 * Dynamic scan result page.
 * Phase 1 will fetch the scan from the API and pass the result to ReportCard.
 */
export default function ScanResultPage({
  params,
}: {
  params: { scanId: string };
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-sm text-white/40 mb-6">Scan ID: {params.scanId}</p>
      {/* Phase 1: fetch scan result server-side and pass to ReportCard */}
      <ReportCard />
    </div>
  );
}

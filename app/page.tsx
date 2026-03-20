import { ScanForm } from '@/components/ScanForm';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--brand-green)]">
          {APP_NAME}
        </h1>
        <p className="text-lg text-white/70">{APP_TAGLINE}</p>
      </div>

      {/* Scan input */}
      <ScanForm />

      {/* Feature list */}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-white/60">
        {[
          'Detects 12+ vulnerability categories',
          'Works with GitHub repos and deployed contracts',
          'Powered by Claude AI via structured analysis',
        ].map((feature) => (
          <li
            key={feature}
            className="border border-white/10 rounded-lg p-4 text-center"
          >
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { APP_NAME } from '@/lib/constants';
import { AuthButton } from '@/components/AuthButton';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'AI-powered smart contract security analysis. Detect vulnerabilities in Solidity code before deployment.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <a href="/" className="text-lg font-bold tracking-tight text-[var(--brand-green)] hover:opacity-80 transition">
              Solidity Smart Audit
            </a>
            <nav className="text-sm text-white/50">
              <AuthButton />
            </nav>
          </header>

          <main className="flex-1">
            {children}
          </main>

          <footer className="border-t border-white/10 px-6 py-4 text-center text-xs text-white/30">
            Solidity Smart Audit — MIT License — Open source smart contract security
          </footer>
        </div>
      </body>
    </html>
  );
}

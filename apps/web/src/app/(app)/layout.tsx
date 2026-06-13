import { Sidebar } from '@/components/shared/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--bg)' }}
      >
        <div className="px-8 py-7 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

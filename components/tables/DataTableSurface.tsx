import type { ReactNode } from 'react';

export default function DataTableSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`app-data-table ${className}`}>{children}</table>
    </div>
  );
}

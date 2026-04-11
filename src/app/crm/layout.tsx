import { CrmSubNav } from "@/components/crm-subnav";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <CrmSubNav />
      {children}
    </div>
  );
}

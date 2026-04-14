import { ControlTowerCommandCenter } from "@/components/control-tower-command-center";

export const dynamic = "force-dynamic";

export default async function ControlTowerCommandCenterPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Command center</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Kanban-style triage by the next route action on each shipment. Filter by the first assigned owner on open
          alerts or exceptions. Cards link to Shipment 360 for execution.
        </p>
      </header>
      <ControlTowerCommandCenter />
    </main>
  );
}

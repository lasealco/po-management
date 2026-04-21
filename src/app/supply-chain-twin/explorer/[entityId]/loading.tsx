import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";

export default function ExplorerEntityLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />
      <p className="mt-6 text-sm text-zinc-500">Loading entity snapshot…</p>
    </main>
  );
}

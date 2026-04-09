export function AccessDenied({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{message}</p>
    </main>
  );
}

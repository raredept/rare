export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-label="Carregando admin">
      <div className="admin-loading-shell rounded-lg border border-neutral-800 bg-neutral-950/80 p-5">
        <div className="h-3 w-28 rounded-full bg-neutral-800" />
        <div className="mt-4 h-8 w-full max-w-sm rounded-lg bg-neutral-800" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-neutral-900" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="admin-loading-shell rounded-lg border border-neutral-800 bg-neutral-950/80 p-4">
            <div className="h-6 w-16 rounded-full bg-neutral-800" />
            <div className="mt-3 h-3 w-24 rounded-full bg-neutral-900" />
          </div>
        ))}
      </div>
      <div className="admin-loading-shell rounded-lg border border-neutral-800 bg-neutral-950/80 p-5">
        <div className="h-4 w-36 rounded-full bg-neutral-800" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 rounded-lg bg-neutral-900" />
          ))}
        </div>
      </div>
    </div>
  );
}

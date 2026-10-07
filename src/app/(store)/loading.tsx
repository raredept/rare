export default function StoreLoading() {
  return (
    <div className="store-shell py-10 lg:py-14" role="status" aria-live="polite">
      <h1 className="sr-only">Carregando conteúdo da RARE</h1>
      <span className="sr-only">Carregando</span>
      <div className="store-loading-shell mb-10 border-b border-neutral-200 pb-8">
        <div className="h-3 w-28 bg-neutral-200" />
        <div className="mt-4 h-10 w-full max-w-lg bg-neutral-200" />
        <div className="mt-4 h-4 w-full max-w-2xl bg-neutral-200" />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="store-loading-shell">
            <div className="aspect-[4/5] bg-neutral-200" />
            <div className="pt-4">
              <div className="h-3 w-20 bg-neutral-200" />
              <div className="mt-3 h-4 w-full bg-neutral-200" />
              <div className="mt-2 h-4 w-3/4 bg-neutral-200" />
              <div className="mt-5 h-5 w-24 bg-neutral-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

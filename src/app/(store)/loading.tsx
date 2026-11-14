export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10" role="status" aria-live="polite">
      <h1 className="sr-only">Carregando conteúdo da RARE</h1>
      <span className="sr-only">Carregando</span>
      <div className="store-loading-shell mb-10 border-b border-neutral-200 pb-8">
        <div className="h-3 w-28 rounded-full bg-neutral-200" />
        <div className="mt-4 h-10 w-full max-w-lg rounded-lg bg-neutral-200" />
        <div className="mt-4 h-4 w-full max-w-2xl rounded-full bg-neutral-200" />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10 xl:grid-cols-5 xl:gap-x-8">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="store-loading-shell rounded-lg border border-neutral-200 bg-white p-2">
            <div className="aspect-[4/5] rounded-lg bg-neutral-200" />
            <div className="px-1 pb-2 pt-4">
              <div className="h-3 w-20 rounded-full bg-neutral-200" />
              <div className="mt-3 h-4 w-full rounded-full bg-neutral-200" />
              <div className="mt-2 h-4 w-3/4 rounded-full bg-neutral-200" />
              <div className="mt-5 h-5 w-24 rounded-full bg-neutral-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

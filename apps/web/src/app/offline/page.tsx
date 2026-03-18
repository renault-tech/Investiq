"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-16 w-16 text-slate-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3l18 18M10.584 10.587a2 2 0 002.828 2.829m4.243-7.07A9 9 0 0112 3a9 9 0 00-9 9c0 1.477.357 2.87.987 4.096m1.42 1.631A9 9 0 0012 21a9 9 0 004.743-1.344"
          />
        </svg>

        <div>
          <h1 className="text-2xl font-bold">Sem conexão</h1>
          <p className="mt-2 text-slate-400">
            Você está offline. Verifique sua conexão e tente novamente.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

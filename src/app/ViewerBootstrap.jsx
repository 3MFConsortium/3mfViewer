import React, { useEffect } from "react";

import { useThreeMFLoader } from "../components/loaders/ThreeMFLoaderContext.js";
import { useViewerStore } from "../stores/viewerStore.js";
import ViewerApp from "./ViewerApp.jsx";

function ViewerBootstrap() {
  const { ensureLib3mf } = useThreeMFLoader();
  const runtimeReady = useViewerStore((state) => state.runtime.ready);
  const runtimeError = useViewerStore((state) => state.runtime.error);
  const setRuntimeReady = useViewerStore((state) => state.setRuntimeReady);
  const setRuntimeError = useViewerStore((state) => state.setRuntimeError);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        setRuntimeError(null);
        await ensureLib3mf();
        if (!cancelled) setRuntimeReady(true);
      } catch (err) {
        console.error("Failed to initialize 3MF runtime", err);
        if (!cancelled) setRuntimeError(err);
      }
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [ensureLib3mf, setRuntimeError, setRuntimeReady]);

  if (runtimeError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center text-slate-600">
        <img src="/3mf_logo.png" alt="3MF" className="h-10 w-auto opacity-90" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-rose-600">Viewer failed to start</h1>
          <p className="text-sm text-slate-500">
            We couldn’t download the 3MF runtime. Please check your connection and try reloading the page.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow transition hover:bg-slate-800"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    );
  }

  if (!runtimeReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 px-4 text-center text-slate-600">
        <img src="/3mf_logo.png" alt="3MF" className="h-10 w-auto opacity-90" />
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-slate-500 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-slate-700">Preparing viewer…</h1>
          <p className="text-sm text-slate-500">
            Downloading the 3MF runtime and assets. This usually takes just a moment.
          </p>
        </div>
      </div>
    );
  }

  return <ViewerApp />;
}

export default ViewerBootstrap;

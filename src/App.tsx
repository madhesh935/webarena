import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppDataProvider } from "./context/app-context";
import { SavedProvider } from "./context/saved-context";

const StoriesPage = lazy(() => import("./pages/Stories").then((m) => ({ default: m.StoriesPage })));
const ChapterPage = lazy(() => import("./pages/Chapter").then((m) => ({ default: m.ChapterPage })));
const ExplorePage = lazy(() => import("./pages/Explore").then((m) => ({ default: m.ExplorePage })));
const ConnectionsPage = lazy(() => import("./pages/Connections").then((m) => ({ default: m.ConnectionsPage })));
const SavedPage = lazy(() => import("./pages/Saved").then((m) => ({ default: m.SavedPage })));

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <AppDataProvider>
          <SavedProvider>
            <Suspense fallback={<main id="main" className="page"><p role="status">Loading…</p></main>}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<StoriesPage />} />
                  <Route path="/stories/:chapterId" element={<ChapterPage />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/connections" element={<ConnectionsPage />} />
                  <Route path="/connections/:receiptId" element={<ConnectionsPage />} />
                  <Route path="/saved" element={<SavedPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </SavedProvider>
        </AppDataProvider>
      </ErrorBoundary>
    </HashRouter>
  );
}

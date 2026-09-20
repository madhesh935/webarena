import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageSkeleton } from "./components/PageSkeleton";
import { AppDataProvider } from "./context/AppDataContext";
import { SavedProvider } from "./context/SavedContext";

// Route-level code splitting via React.lazy
const StoriesPage = lazy(() => import("./pages/Stories").then((m) => ({ default: m.StoriesPage })));
const ChapterPage = lazy(() => import("./pages/Chapter").then((m) => ({ default: m.ChapterPage })));
const ExplorePage = lazy(() => import("./pages/Explore").then((m) => ({ default: m.ExplorePage })));
const ConnectionsPage = lazy(() => import("./pages/Connections").then((m) => ({ default: m.ConnectionsPage })));
const SavedPage = lazy(() => import("./pages/Saved").then((m) => ({ default: m.SavedPage })));

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppDataProvider>
          <SavedProvider>
            <Suspense fallback={<PageSkeleton />}>
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
    </BrowserRouter>
  );
}

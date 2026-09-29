import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const Gallery = lazy(() => import("./dev/Gallery"));
const IconSheet = lazy(() => import("./dev/IconSheet"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {location.hash === "#gallery" || location.hash === "#icons" ? (
      <Suspense>{location.hash === "#icons" ? <IconSheet /> : <Gallery />}</Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

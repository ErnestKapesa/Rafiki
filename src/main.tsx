import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const Gallery = lazy(() => import("./dev/Gallery"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {location.hash === "#gallery" ? (
      <Suspense>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

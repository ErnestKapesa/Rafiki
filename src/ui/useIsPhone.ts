import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 900px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** True on phone-sized layouts (matches the CSS breakpoint). */
export const useIsPhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);

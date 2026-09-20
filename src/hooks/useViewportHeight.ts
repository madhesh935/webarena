import { useEffect } from "react";
import { debounce } from "../utils/debounce";

export function useViewportHeight() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    const onResize = debounce(apply, 100);
    apply();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);
}

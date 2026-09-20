import { useEffect, useState, type RefObject } from "react";

export function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.12, ...options });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
}

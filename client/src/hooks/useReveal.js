import { useEffect } from 'react';

// Fades in every element with class "reveal" as it scrolls into view.
// Pass values that change the page content (e.g. loaded data) so newly
// rendered elements are picked up too.
export function useReveal(deps = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

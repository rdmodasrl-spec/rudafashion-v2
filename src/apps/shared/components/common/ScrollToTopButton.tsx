import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 420);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="回到页面顶部"
      title="回到顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-3 z-40 inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white/95 text-neutral-900 shadow-md backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-neutral-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 md:bottom-5 md:right-5"
    >
      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
};

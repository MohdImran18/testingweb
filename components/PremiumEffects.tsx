'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Waves } from 'lucide-react';
export default function PremiumEffects() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
      setShowTop(window.scrollY > 520);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    const cards = document.querySelectorAll('.project-card,.product-card,.service-card,.process-card,.detail-panel');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('cb-in-view'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    cards.forEach((card) => { card.classList.add('cb-reveal'); observer.observe(card); });
    return () => { window.removeEventListener('scroll', update); observer.disconnect(); };
  }, []);
  return <>
    <div className="cb-scroll-progress" aria-hidden="true"><motion.div animate={{ width: `${progress}%` }} transition={{ type: 'tween', ease: 'linear', duration: .08 }} /></div>
    <div className="cb-brand-mark" aria-hidden="true"><Waves size={15} strokeWidth={2.2}/><span>CLEANER WATERWAYS</span></div>
    {showTop && <motion.button className="cb-back-top" type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><ArrowUp size={18}/></motion.button>}
  </>;
}

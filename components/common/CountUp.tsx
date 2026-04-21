import React, { useEffect, useState } from 'react';

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  className?: string;
}

const CountUp: React.FC<CountUpProps> = ({ end, duration = 2000, decimals = 2, className }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = 0; // Always start from 0 for entry animation

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Ease-out quart function for smooth slowdown
      const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);
      
      const currentCount = startValue + (end - startValue) * easeOutQuart(progress);
      
      setCount(currentCount);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [end, duration]);

  const formattedValue = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(count);

  return <span className={className}>{formattedValue}</span>;
};

export default CountUp;
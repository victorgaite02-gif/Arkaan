import React from 'react';

interface PrivacyValueProps {
  isPrivate: boolean;
  value: number;
  isCurrency?: boolean;
  prefix?: string;
  className?: string;
  as?: React.ElementType;
  animate?: boolean; // Kept for interface compatibility but ignored logic
}

const PrivacyValue: React.FC<PrivacyValueProps> = ({
  isPrivate,
  value,
  isCurrency = true,
  prefix = '',
  className = '',
  as: Component = 'span',
}) => {
  
  const content = isPrivate ? (
    "****"
  ) : (
    <>
      {prefix}{isCurrency && 'R$ '}
      {new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)}
    </>
  );

  if (isPrivate) {
    return (
      <Component className={`${className} blur-sm hover:blur-none transition-all cursor-pointer select-none`}>
        {prefix}{isCurrency && 'R$ '}****
      </Component>
    );
  }

  return <Component className={className}>{content}</Component>;
};

export default PrivacyValue;
import React from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  [key: string]: any; // To allow passing other props like 'required', 'className', etc.
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Keep only numbers
    const onlyNumbers = rawValue.replace(/[^\d]/g, '');
    const numericValue = Number(onlyNumbers) / 100;

    if (!isNaN(numericValue)) {
      onChange(numericValue);
    }
  };

  // Format the numeric value into a BRL currency string
  const formattedValue = value > 0
    ? new Intl.NumberFormat('pt-BR', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    : '';

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={formattedValue}
      onChange={handleChange}
      placeholder="0,00"
    />
  );
};

export default CurrencyInput;

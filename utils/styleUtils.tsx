import React from 'react';
import { Status, PaymentMethod } from '../types';
import { CreditCard, Landmark, QrCode, FileText, Coins } from 'lucide-react';

export const getStatusColor = (status: Status): string => {
  switch (status) {
    case Status.Active:
    case Status.InProgress:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case Status.Paid:
    case Status.Settled:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case Status.Pending:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case Status.Canceled:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    case Status.Overdue:
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const getPaymentMethodIcon = (method: string): React.ReactNode => {
    switch (method) {
        case PaymentMethod.CreditCard:
            return <CreditCard size={18} className="text-sky-500" />;
        case PaymentMethod.PIX:
            return <QrCode size={18} className="text-green-500" />;
        case PaymentMethod.Boleto:
            return <FileText size={18} className="text-orange-500" />;
        case PaymentMethod.Dinheiro:
            return <Coins size={18} className="text-amber-500" />;
        default:
            return null;
    }
}
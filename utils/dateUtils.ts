import { Purchase, CreditCard, PaymentMethod } from '../types';

/**
 * Calculates the statement date for a purchase, considering the card's closing date.
 * For non-credit card payments, it returns the first day of the purchase month.
 * Uses UTC dates to avoid timezone issues.
 * @param purchase The purchase object.
 * @param card The credit card object associated with the purchase.
 * @returns A Date object (set to the first day) representing the year and month of the effective expense.
 */
export const getStatementDateForPurchase = (purchase: Purchase, card?: CreditCard): Date => {
    const purchaseDate = new Date(`${purchase.purchase_date}T00:00:00Z`);
    const closingDate = purchase.card_closing_date ?? card?.closingDate;

    // If it's not a credit card purchase, or if card details are missing, attribute to the purchase month.
    if (purchase.payment_method !== PaymentMethod.CreditCard || closingDate === undefined) {
        return new Date(Date.UTC(purchaseDate.getUTCFullYear(), purchaseDate.getUTCMonth(), 1));
    }
    
    // Start with the first day of the purchase month.
    const stmtDate = new Date(Date.UTC(purchaseDate.getUTCFullYear(), purchaseDate.getUTCMonth(), 1));

    // If the purchase day is AFTER the closing day, the statement is for the next month.
    if (purchaseDate.getUTCDate() > closingDate) {
      stmtDate.setUTCMonth(stmtDate.getUTCMonth() + 1);
    }
    
    return stmtDate;
};

/**
 * Formats a Date object into a 'YYYY-MM-DD' string using UTC values to avoid timezone issues.
 * @param date The date object to format.
 * @returns A string in 'YYYY-MM-DD' format.
 */
export const formatToUTCDateString = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
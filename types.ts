

export type View = 'dashboard' | 'subscriptions' | 'fixedExpenses' | 'purchases' | 'debts' | 'debtors' | 'incomes' | 'reports' | 'settings' | 'smartGoals' | 'admin' | 'support';

export type ViewFilterType = 'all' | 'own';

export enum Status {
  Active = 'Ativo', Canceled = 'Cancelado', Paid = 'Pago', Pending = 'Pendente',
  Overdue = 'Atrasado', Settled = 'Quitado', InProgress = 'Em Dia',
}

export enum PaymentMethod {
  CreditCard = 'Cartão de Crédito', PIX = 'PIX', Boleto = 'Boleto', Dinheiro = 'Dinheiro',
}

export enum NegotiationStatus {
  Renegotiated = 'Renegociada', Pending = 'Pendente de Negociação',
}

export interface CreditCard { id: string; nickname: string; closingDate: number; dueDate: number; }
export interface Company { id: number; user_id: string; name: string; tax_rate: number; }

// Person represents a manually added person by name
export interface Person { 
  id: string; 
  name: string; 
}

// Main table interfaces
export interface AppSettings {
  id: number;
  user_id: string;
  user_name: string; user_email: string; phone?: string; avatar_url?: string;
  usd_rate: number; iof_rate: number;
  income_categories: string[]; subscription_categories: string[]; fixed_expense_categories: string[];
  purchase_categories: string[]; debt_categories: string[]; debtor_categories: string[];
  credit_cards: CreditCard[]; people: Person[];
  accounting_cost: number;
  whatsapp_phone_number?: string;
  is_onboarded: boolean;
  gender?: string;
  profession?: string;
  birth_date?: string;
  is_admin?: boolean;
  plan?: 'free' | 'pro' | 'vip';
}

export interface Subscription {
  id: number; user_id: string; service_name: string; category: string; monthly_value: number;
  currency: 'BRL' | 'USD'; billing_date: number; start_date: string; cancellation_date?: string;
  payment_method: PaymentMethod; status: Status; notes: string;
  credit_card_id?: string;
  applied_usd_rate?: number; applied_iof_rate?: number;
}

export interface FixedExpense {
  id: number; user_id: string; category: string; value: number; due_date: number;
  paid_months?: string[]; payment_method: PaymentMethod; notes: string;
}

export interface Debt {
  id: number; user_id: string; creditor: string; description: string; category: string;
  original_value: number; current_value: number; start_date: string; next_installment_date: string;
  status: Status; negotiation_status: NegotiationStatus; person_id?: string; notes: string;
  total_installments?: number; paid_installments?: number; paid_months?: string[];
}

export interface Debtor {
  id: number; user_id: string; person_name: string; description: string; category: string;
  total_value: number; payment_type: 'OneTime' | 'Installments' | 'Monthly';
  installments_total?: number; installments_paid?: number; monthly_due_date?: number;
  start_date: string; 
  status: Status; notes: string; paid_months?: string[];
}

export interface Income {
  id: number; user_id: string; source: string; value: number; receipt_date: string;
  is_recurring: boolean; category: string; notes: string;
  company_id?: number;
}

export interface Purchase {
  id: number; user_id: string;
  description: string;
  category: string; value: number;
  purchase_date: string; 
  payment_method: string; // Changed to string to be more flexible, but maps to PaymentMethod enum
  is_installment: boolean; installments: number;
  person_id?: string; credit_card_id?: string; paid_months?: string[];
  card_closing_date?: number; card_due_date?: number;
  created_at?: string;
  pending_review?: boolean;
  is_refunded?: boolean;
}

export interface CategoryLimit {
    category: string;
    limit: number;
    percentage?: number; // Percentage of monthly income
}

export interface GoalPlan {
    limits: CategoryLimit[];
    recommendations: string[];
    reasoning: string;
}

export interface SmartGoal {
    id: number;
    user_id: string;
    description: string;
    target_value: number;
    target_date: string; // YYYY-MM-DD
    saved_value: number;
    category_limits: GoalPlan; // Mapped to JSONB column
    is_active: boolean;
}

export interface Refund {
  id: number;
  user_id: string;
  purchase_id: number;
  refund_date: string; // YYYY-MM-DD
  value: number;
  credit_card_id?: string;
  description?: string;
  created_at?: string;
}

export interface SystemAnnouncement {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  is_active: boolean;
  created_at: string;
  user_id?: string | null; // Null for global, string for targeted
}

export interface PlatformSetting {
  key: string;
  value: boolean;
  description: string;
}

export interface SupportTicket {
  id: number;
  user_id: string;
  title: string;
  description: string;
  type: 'bug' | 'suggestion' | 'complaint' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_response?: string;
  created_at: string;
  updated_at: string;
  user_email?: string; // Populated on fetch for admin
  user_name?: string; // Populated on fetch for admin
}

export type TransactionType = 'purchase' | 'subscription' | 'fixedExpense' | 'debt' | 'income' | 'debtor';

export interface PrefillData {
  type: TransactionType;
  data: Partial<Omit<Purchase & Subscription & FixedExpense & Debt & Income & Debtor, 'id' | 'user_id'>> & {
    personName?: string; cardNickname?: string;
  };
}
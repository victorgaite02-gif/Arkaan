
import { AppSettings, CreditCard } from '../types';

export const initialCreditCards: CreditCard[] = [
    { id: 'c1', nickname: 'Principal', closingDate: 20, dueDate: 28 },
];

export const initialSettings: Omit<AppSettings, 'id' | 'user_id'> = {
    user_name: 'Novo Usuário',
    user_email: '',
    phone: '',
    avatar_url: '',
    gender: '',
    usd_rate: 5.25,
    iof_rate: 5.38,
    income_categories: [
        'Salário', 
        'Freelancer', 
        'Vendas', 
        'Outros'
    ],
    subscription_categories: [
        'Netflix', 
        'Spotify', 
        'Disney+', 
        'Youtube Premium', 
        'ChatGPT Plus', 
        'Midjourney', 
        'Adobe', 
        'Microsoft 365', 
        'iCloud', 
        'Google One', 
        'Gympass / Academia', 
        'Sem Parar'
    ],
    fixed_expense_categories: [
        'Aluguel + Condomínio', 
        'Energia', 
        'Internet', 
        'Plano de Dados', 
        'Plano de Saúde', 
        'Escola'
    ],
    purchase_categories: [
        'Amazon', 
        'Mercado Livre', 
        'Shopee', 
        'AliExpress', 
        'Shein', 
        'Ifood', 
        'Uber / 99', 
        'Vestuário', 
        'Supermercado', 
        'Farmácia', 
        'Restaurante'
    ],
    debt_categories: ['Empréstimo', 'Financiamento', 'Cartão de Crédito', 'Outros'],
    debtor_categories: ['Empréstimo', 'Venda', 'Assinatura Compartilhada', 'Compra no Cartão', 'Outros'],
    people: [],
    credit_cards: initialCreditCards,
    accounting_cost: 0,
    is_onboarded: false,
    is_admin: false,
    plan: 'free',
};
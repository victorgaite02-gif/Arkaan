
import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, User as UserIcon, Send, Loader2, Eraser } from 'lucide-react';
import { AppSettings, PrefillData, PaymentMethod } from '../types';
import { GoogleGenAI, FunctionDeclaration, Type, Content } from '@google/genai';

// We keep this to avoid changing the state management logic too much.
type ChatCompletionMessageParam = any;

interface ChatbotProps {
  isOpen: boolean;
  appSettings: AppSettings;
  onClose: () => void;
  onTransactionCreate: (data: PrefillData) => Promise<void>;
  onTransactionDelete: (description: string) => Promise<string>;
  onFinancialDataRequest: () => string;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, appSettings, onClose, onTransactionCreate, onTransactionDelete, onFinancialDataRequest }) => {
  const [messages, setMessages] = useState<ChatCompletionMessageParam[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const createTransactionDeclaration: FunctionDeclaration = {
      name: "create_transaction",
      description: "Cria uma nova compra. Entende datas relativas como 'hoje', 'ontem', e 'anteontem', e datas específicas. Para compras parceladas, o 'value' deve ser o valor TOTAL da compra e 'installments' o número de parcelas.",
      parameters: {
          type: Type.OBJECT,
          properties: {
              description: { type: Type.STRING, description: "A descrição da compra. Ex: 'iFood', 'Uber'" },
              value: { type: Type.NUMBER, description: "O valor TOTAL da compra." },
              category: { type: Type.STRING, description: "A categoria da compra. Use uma das categorias disponíveis."},
              purchase_date: { type: Type.STRING, description: "Data da compra no formato YYYY-MM-DD. Também entende 'hoje', 'ontem', 'anteontem'. O padrão é 'hoje'."},
              installments: { type: Type.NUMBER, description: "O número de parcelas, se for uma compra parcelada. O padrão é 1 (à vista)." },
              payment_method: { type: Type.STRING, description: "O método de pagamento exato. Deve ser um destes: 'Cartão de Crédito', 'PIX', 'Boleto', 'Dinheiro'." }
          },
          required: ["description", "value"],
      },
  };
  
  const deleteTransactionDeclaration: FunctionDeclaration = {
      name: "delete_transaction",
      description: "Exclui a transação de compra mais recente que corresponde a uma descrição.",
      parameters: {
          type: Type.OBJECT,
          properties: {
              description: { type: Type.STRING, description: "A descrição da compra a ser excluída. Ex: 'Uber', 'iFood'" },
          },
          required: ["description"],
      },
  };

  const getFinancialDataDeclaration: FunctionDeclaration = {
      name: "get_financial_data",
      description: "Obtém um resumo completo dos dados financeiros do usuário para o mês atual, incluindo receitas, despesas, dívidas, metas, etc.",
      parameters: {
          type: Type.OBJECT,
          properties: {},
      },
  };

  const tools: FunctionDeclaration[] = [createTransactionDeclaration, deleteTransactionDeclaration, getFinancialDataDeclaration];

  useEffect(() => {
    if (messages.length === 0 && isOpen) {
        const systemMessage: ChatCompletionMessageParam = { 
            role: 'system', 
            content: `Você é Kaan, o assistente financeiro pessoal de ${appSettings.user_name}. 
            
            Suas capacidades:
            1. Criar compras com 'create_transaction'. Se o usuário disser "no pix", "em dinheiro", etc, preencha o campo payment_method.
            2. Deletar compras com 'delete_transaction'.
            3. Analisar finanças com 'get_financial_data'.
            
            Regras de estilo:
            - Seja amigável e direto.
            - Mantenha o contexto.
            - Use o formato YYYY-MM-DD para datas.
            
            Informações Atuais:
            - Hoje: ${new Date().toLocaleDateString('pt-BR')}
            - Categorias disponíveis: ${appSettings.purchase_categories.join(', ')}.
            `
        };
        const welcomeMessage: ChatCompletionMessageParam = { role: 'assistant', content: `Olá, ${appSettings.user_name.split(' ')[0]}! Sou o Kaan. Como posso ajudar com suas finanças hoje?` };
        setMessages([systemMessage, welcomeMessage]);
    }
  }, [appSettings, isOpen, messages.length]);

  useEffect(() => {
    if (isOpen) {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isLoading, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const userMessage: ChatCompletionMessageParam = { role: 'user', content: userInput };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setUserInput('');
    setIsLoading(true);
    
    // Updated to use gemini-2.5-flash for reliability
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});

    const buildGeminiHistory = (msgs: ChatCompletionMessageParam[]): { history: Content[], systemInstruction: string } => {
        const systemInstruction = msgs.find(m => m.role === 'system')?.content || '';
        const history: Content[] = [];

        for (const msg of msgs) {
            if (msg.role === 'system') continue;
            if (msg.role === 'user') {
                history.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (msg.role === 'assistant') {
                if (msg.tool_calls) {
                    history.push({ role: 'model', parts: msg.tool_calls.map((tc: any) => ({ functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) } })) });
                } else if (msg.content) {
                    history.push({ role: 'model', parts: [{ text: msg.content }] });
                }
            } else if (msg.role === 'tool') {
                history.push({ role: 'user', parts: [{ functionResponse: { name: msg.name, response: { result: msg.content } } }] });
            }
        }
        return { history, systemInstruction };
    };

    try {
        const { history, systemInstruction } = buildGeminiHistory(currentMessages);
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: history,
            config: { 
                systemInstruction,
                tools: [{ functionDeclarations: tools }],
            }
        });

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            const assistantMessageWithToolCall = {
                role: 'assistant',
                content: response.text, 
                tool_calls: functionCalls.map(fc => ({
                    id: fc.id,
                    type: 'function',
                    function: {
                        name: fc.name,
                        arguments: JSON.stringify(fc.args)
                    }
                }))
            };

            let messagesAfterToolCall = [...currentMessages, assistantMessageWithToolCall];
            let toolMessagesForState: ChatCompletionMessageParam[] = [];
            
            for (const fc of functionCalls) {
                const functionName = fc.name;
                const functionArgs = fc.args as any;
                let functionResponseContent;

                if (functionName === 'create_transaction') {
                    const { description, value, category, purchase_date, installments, payment_method } = functionArgs;
                    
                    let transactionDate: Date;
                    const dateArg = purchase_date || 'hoje';

                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
                        transactionDate = new Date(`${dateArg}T00:00:00Z`);
                    } else {
                        const today = new Date();
                        today.setUTCHours(0, 0, 0, 0);
                        
                        if (typeof dateArg === 'string' && dateArg.toLowerCase().includes('ontem')) {
                            transactionDate = new Date(today);
                            transactionDate.setUTCDate(today.getUTCDate() - 1);
                        } else if (typeof dateArg === 'string' && dateArg.toLowerCase().includes('anteontem')) {
                            transactionDate = new Date(today);
                            transactionDate.setUTCDate(today.getUTCDate() - 2);
                        } else {
                            transactionDate = today;
                        }
                    }
                    
                    const dateString = transactionDate.toISOString().split('T')[0];
                    const numInstallments = installments || 1;
                    
                    // Map generic strings to exact Enum if needed, though Gemini usually does well with the description
                    let mappedPaymentMethod = payment_method || PaymentMethod.CreditCard;
                    if (payment_method && payment_method.toLowerCase().includes('pix')) mappedPaymentMethod = PaymentMethod.PIX;
                    else if (payment_method && payment_method.toLowerCase().includes('dinheiro')) mappedPaymentMethod = PaymentMethod.Dinheiro;
                    else if (payment_method && payment_method.toLowerCase().includes('boleto')) mappedPaymentMethod = PaymentMethod.Boleto;

                    const prefillData: PrefillData = {
                        type: 'purchase',
                        data: {
                            description, value,
                            category: category || appSettings.purchase_categories[0],
                            purchase_date: dateString,
                            installments: numInstallments,
                            is_installment: numInstallments > 1,
                            payment_method: mappedPaymentMethod,
                            pending_review: true,
                        }
                    };
                    await onTransactionCreate(prefillData);
                    const formattedDate = transactionDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                    const installmentText = numInstallments > 1 ? ` em ${numInstallments}x` : '';
                    functionResponseContent = `Transação de R$ ${value.toFixed(2)}${installmentText} para "${description}" (${mappedPaymentMethod}) criada com sucesso para a data ${formattedDate} e aguardando sua revisão.`;
                
                } else if (functionName === 'delete_transaction') {
                    functionResponseContent = await onTransactionDelete(functionArgs.description);
                
                } else if (functionName === 'get_financial_data') {
                    functionResponseContent = onFinancialDataRequest();
                }
                
                 const toolMessage: ChatCompletionMessageParam = {
                    tool_call_id: fc.id,
                    role: "tool",
                    name: functionName,
                    content: functionResponseContent || "Função executada.",
                };
                toolMessagesForState.push(toolMessage);
            }

            messagesAfterToolCall.push(...toolMessagesForState);
            const { history: secondHistory } = buildGeminiHistory(messagesAfterToolCall);

            const secondResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: secondHistory,
            });
            
            const finalAssistantMessage = { role: 'assistant', content: secondResponse.text };
            setMessages(prev => [...prev, assistantMessageWithToolCall, ...toolMessagesForState, finalAssistantMessage]);

        } else {
            const assistantMessage = { role: 'assistant', content: response.text };
            setMessages(prev => [...prev, assistantMessage]);
        }
    } catch (error: any) {
        console.error("Error with GenAI API:", error);
        let errorText = "Desculpe, tive um problema para me conectar.";
        if (error.message) errorText += ` (${error.message})`;
        const errorMessage: ChatCompletionMessageParam = { role: 'assistant', content: errorText };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  const visibleMessages = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');

  return (
    <>
        {isOpen && <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose}></div>}
        
        <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Sparkles size={20} className="text-white"/>
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 dark:text-white">Kaan</h2>
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Assistente</span>
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/10" title="Limpar conversa">
                        <Eraser size={20}/>
                    </button>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X size={24}/>
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-50 dark:bg-slate-950/50">
                {visibleMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-8 opacity-60">
                        <Sparkles size={48} className="mb-4 text-indigo-300"/>
                        <p className="text-sm">Pergunte sobre suas finanças ou peça para lançar uma compra.</p>
                    </div>
                )}
                {visibleMessages.map((msg, index) => (
                    <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start animate-fade-in'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                                <Sparkles size={14} className="text-indigo-500"/>
                            </div>
                        )}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none'
                        }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 justify-start animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                            <Sparkles size={14} className="text-indigo-500"/>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-indigo-500"/>
                            <span className="text-xs text-slate-400 font-medium">Processando...</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} className="h-2"/>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="w-full pl-4 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-indigo-500/50 placeholder-slate-400 text-sm transition-all"
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !userInput.trim()}
                        className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                    >
                        <Send size={18}/>
                    </button>
                </form>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                    Powered by Gemini 2.5 Flash
                </p>
            </div>
        </div>
    </>
  );
};

export default Chatbot;

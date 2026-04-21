
import React, { useState, useRef, useCallback } from 'react';
import { AppSettings, CreditCard, Person } from '../types';
import { supabase } from '../services/supabaseClient';
import { 
  ArrowRight, Check, Plus, X, User, 
  TrendingUp, CreditCard as CardIcon, Home, ShoppingCart, 
  Building2, Users, Camera, ChevronRight, ChevronLeft, Loader2, AlertCircle, ZoomIn, SkipForward, Briefcase, Calendar, Wallet, Zap, AlertTriangle 
} from 'lucide-react';
import LogoLoader from './common/LogoLoader';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/canvasUtils';
import Modal from './common/Modal';
import CurrencyInput from './common/CurrencyInput';

interface OnboardingProps {
  appSettings: AppSettings;
  onComplete: (
      settings: AppSettings, 
      extraData?: { 
          companyData?: { name: string, tax_rate: number },
          initialIncome?: { value: number, source: string, company_id?: number }
      }
  ) => Promise<void>;
}

const steps = [
  { id: 'profile', title: 'Seu Perfil', icon: User },
  { id: 'financial_profile', title: 'Renda Principal', icon: Wallet },
  { id: 'context', title: 'Uso do Sistema', icon: Users },
  { id: 'cards', title: 'Cartões', icon: CardIcon },
  { id: 'categories', title: 'Categorias', icon: ShoppingCart },
];

const Onboarding: React.FC<OnboardingProps> = ({ appSettings, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [localSettings, setLocalSettings] = useState<AppSettings>(appSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals State
  const [showUnsavedCardModal, setShowUnsavedCardModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  // Crop States
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Extended Profile States
  const [phone, setPhone] = useState(appSettings.phone || '');
  const [profession, setProfession] = useState(appSettings.profession || '');
  const [birthDate, setBirthDate] = useState(appSettings.birth_date || '');

  // Financial / Company States
  const [incomeType, setIncomeType] = useState<'PF' | 'PJ'>('PF');
  const [incomeValue, setIncomeValue] = useState(0); // Liquido or Bruto based on type
  const [companyName, setCompanyName] = useState('');
  const [companyTax, setCompanyTax] = useState('');

  // Context States
  const [isSharedAccount, setIsSharedAccount] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  
  // Cards State
  const [newCardNick, setNewCardNick] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('');
  const [newCardDue, setNewCardDue] = useState('');

  // Generic Input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const changeStep = (direction: 'next' | 'prev') => {
    setAnimDirection(direction === 'next' ? 'forward' : 'backward');
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setErrorMsg(null);
    
    if (direction === 'next') {
        // Check for unsaved Card Data
        if (steps[currentStep].id === 'cards') {
            const hasPendingCardData = newCardNick.trim() !== '' || newCardClosing !== '' || newCardDue !== '';
            
            if (hasPendingCardData) {
                setShowUnsavedCardModal(true);
                return;
            }
        }
        goNext();
    } else {
        if (currentStep > 0) setCurrentStep(c => c - 1);
    }
  };

  const goNext = () => {
      if (currentStep < steps.length - 1) setCurrentStep(c => c + 1);
      else finishOnboarding();
  }

  const handleCardModalSave = () => {
      const success = handleAddCard();
      if (success) {
          setShowUnsavedCardModal(false);
          goNext();
      }
      // If validation fails, handleAddCard sets errorMsg, user sees it in modal or main screen
  };

  const handleCardModalDiscard = () => {
      setNewCardNick(''); setNewCardClosing(''); setNewCardDue('');
      setShowUnsavedCardModal(false);
      goNext();
  };

  const calculateNetIncome = () => {
      if (incomeType === 'PF') return incomeValue || 0;
      const tax = parseFloat(companyTax.replace(',', '.')) || 0;
      const gross = incomeValue || 0;
      return gross * (1 - (tax / 100));
  };

  const finishOnboarding = async () => {
      setIsSaving(true);
      setErrorMsg(null);
      try {
        const finalSettings = { 
            ...localSettings, 
            phone,
            profession,
            birth_date: birthDate,
            is_onboarded: true 
        };
        
        const companyData = incomeType === 'PJ' && companyName 
            ? { name: companyName, tax_rate: parseFloat(companyTax.replace(',', '.')) || 0 } 
            : undefined;
        
        const initialIncome = incomeValue > 0 ? {
            value: calculateNetIncome(),
            source: incomeType === 'PJ' ? 'Pró-labore / Distribuição' : 'Salário Líquido',
        } : undefined;

        await onComplete(finalSettings, { companyData, initialIncome });
      } catch (error: any) {
        console.error("Erro ao salvar onboarding:", error);
        setErrorMsg(`Não foi possível salvar: ${error.message || 'Erro desconhecido'}`);
        setIsSaving(false);
      }
  };

  const handleSkipConfirm = async () => {
      setIsSaving(true);
      setErrorMsg(null);
      setShowSkipModal(false);

      try {
        // Tenta capturar dados financeiros parciais caso o usuário tenha preenchido
        // Safe check for numbers
        const taxRate = parseFloat(companyTax.replace(',', '.')) || 0;
        
        const companyData = incomeType === 'PJ' && companyName 
            ? { name: companyName, tax_rate: taxRate } 
            : undefined;
        
        const initialIncome = (incomeValue || 0) > 0 ? {
            value: calculateNetIncome(),
            source: incomeType === 'PJ' ? 'Pró-labore / Distribuição' : 'Salário Líquido',
        } : undefined;

        const finalSettings = { 
            ...localSettings, 
            phone,
            profession,
            birth_date: birthDate,
            is_onboarded: true 
        };
        
        await onComplete(finalSettings, { companyData, initialIncome });
      } catch (error: any) {
        console.error("Erro ao pular:", error);
        setErrorMsg(`Erro ao pular: ${error.message || 'Tente novamente'}`);
        setIsSaving(false);
      }
  };

  // --- Image Handling ---

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setIsCropModalOpen(true);
      });
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      setIsUploading(true);
      setIsCropModalOpen(false); 

      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) throw new Error('Falha ao recortar imagem');

      const fileName = `${localSettings.user_id}_${Date.now()}.jpeg`;
      const fileToUpload = new File([croppedBlob], fileName, { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, fileToUpload, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = `${data.publicUrl}`;

      setLocalSettings(prev => ({ ...prev, avatar_url: publicUrl }));
      setImageSrc(null);
      setZoom(1);

    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setErrorMsg(`Erro no upload: ${error.message || 'Verifique sua conexão.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // --- Handlers ---

  const handleAddPerson = () => {
      if (newPersonName.trim()) {
          const newPerson: Person = { id: Date.now().toString(), name: newPersonName.trim() };
          setLocalSettings({ ...localSettings, people: [...localSettings.people, newPerson] });
          setNewPersonName('');
      }
  };

  const handleRemovePerson = (id: string) => {
      setLocalSettings({ ...localSettings, people: localSettings.people.filter(p => p.id !== id) });
  };

  const handleAddCard = (): boolean => {
      const closing = parseInt(newCardClosing);
      const due = parseInt(newCardDue);
      if (newCardNick && closing > 0 && closing <= 31 && due > 0 && due <= 31) {
          const newCard: CreditCard = { id: Date.now().toString(), nickname: newCardNick, closingDate: closing, dueDate: due };
          setLocalSettings({ ...localSettings, credit_cards: [...(localSettings.credit_cards || []), newCard] });
          setNewCardNick(''); setNewCardClosing(''); setNewCardDue('');
          setErrorMsg(null);
          return true;
      } else {
          setErrorMsg("Preencha os dados do cartão corretamente (dias entre 1 e 31).");
          return false;
      }
  };

  const handleRemoveCard = (id: string) => {
      setLocalSettings({ ...localSettings, credit_cards: (localSettings.credit_cards || []).filter(c => c.id !== id) });
  };

  const handleRemoveCategory = (key: keyof AppSettings, item: string) => {
    setLocalSettings({ ...localSettings, [key]: (localSettings[key] as string[]).filter(c => c !== item) });
  };

  // --- Sub Components ---

  const CategoryInputBlock = ({ sKey, title, icon: Icon, colorClass, bgClass }: { sKey: keyof AppSettings, title: string, icon: any, colorClass: string, bgClass: string }) => {
      const [val, setVal] = useState('');
      const add = () => {
          if(val.trim() && !(localSettings[sKey] as string[]).includes(val.trim())) {
              setLocalSettings({ ...localSettings, [sKey]: [...(localSettings[sKey] as string[]), val.trim()]});
              setVal('');
          }
      };
      return (
          <div className={`p-5 rounded-2xl border border-white/50 shadow-sm ${bgClass} bg-opacity-20`}>
               <h3 className={`flex items-center gap-2 font-bold mb-4 text-sm uppercase tracking-wide ${colorClass}`}>
                    <Icon size={18} /> {title}
               </h3>
               <div className="flex gap-2 mb-4">
                   <input type="text" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Adicionar nova..." className="flex-grow px-4 py-2 bg-white dark:bg-slate-800 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder-slate-400" />
                   <button onClick={add} className={`text-white p-2.5 rounded-xl hover:opacity-90 transition-opacity ${bgClass.replace('bg-opacity-20', '')}`}><Plus size={20}/></button>
               </div>
               <div className="flex flex-wrap gap-2">
                    {(localSettings[sKey] as string[]).map((cat, i) => (
                         <span key={cat} style={{ animationDelay: `${i * 30}ms` }} className="animate-fade-in flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg shadow-sm text-xs font-medium hover:scale-105 transition-transform cursor-default">
                            {cat} <X size={14} className="cursor-pointer text-slate-300 hover:text-rose-400 transition-colors" onClick={() => handleRemoveCategory(sKey, cat)}/>
                        </span>
                    ))}
               </div>
          </div>
      )
  };

  const renderStep = () => {
    const animationClass = animDirection === 'forward' ? 'animate-blur-in-up' : 'animate-blur-in';

    switch (steps[currentStep].id) {
        case 'profile':
            return (
                <div className={`space-y-6 ${animationClass}`}>
                    <div className="text-center pt-2">
                        <div 
                            className="w-28 h-28 bg-blue-50 dark:bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center relative group cursor-pointer border-4 border-white dark:border-slate-700 shadow-xl hover:shadow-blue-200/50 transition-all overflow-hidden"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {localSettings.avatar_url ? (
                                <img src={localSettings.avatar_url} alt="Avatar" className="w-full h-full object-cover animate-fade-in" />
                            ) : (
                                <Camera size={36} className="text-blue-300 group-hover:text-blue-400 transition-colors"/>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 bg-white/60 dark:bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                    <Loader2 className="animate-spin text-blue-600" size={24} />
                                </div>
                            )}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange}/>
                        
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-1">Olá, {localSettings.user_name.split(' ')[0]}!</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Vamos completar seu cadastro.</p>
                    </div>

                    <div className="space-y-4 max-w-sm mx-auto">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 mb-2 ml-1"><User size={12}/> Nome Completo</label>
                            <input 
                                type="text" value={localSettings.user_name} 
                                onChange={(e) => setLocalSettings({...localSettings, user_name: e.target.value})}
                                className="w-full px-5 py-3 bg-indigo-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-300 text-slate-800 dark:text-slate-200 focus:outline-none transition-all placeholder-slate-400"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 mb-2 ml-1"><Calendar size={12}/> Nascimento</label>
                                <input 
                                    type="date" value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-indigo-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-300 text-slate-800 dark:text-slate-200 text-sm focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 mb-2 ml-1"><Briefcase size={12}/> Profissão</label>
                                <input 
                                    type="text" value={profession}
                                    onChange={(e) => setProfession(e.target.value)}
                                    placeholder="Ex: Dev"
                                    className="w-full px-4 py-3 bg-indigo-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-300 text-slate-800 dark:text-slate-200 text-sm focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 mb-2 ml-1"><Users size={12}/> Gênero</label>
                            <div className="flex gap-2">
                                {['Masculino', 'Feminino', 'Outro'].map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setLocalSettings({...localSettings, gender: g})}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${localSettings.gender === g ? 'bg-blue-600 text-white shadow-md border-transparent' : 'bg-indigo-50 dark:bg-slate-800/50 text-slate-500 border-transparent hover:bg-indigo-100'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 mb-2 ml-1"><Users size={12}/> WhatsApp</label>
                            <input 
                                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000"
                                className="w-full px-5 py-3 bg-indigo-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-300 text-slate-800 dark:text-slate-200 focus:outline-none transition-all placeholder-slate-400"
                            />
                        </div>
                    </div>
                </div>
            );

        case 'financial_profile':
            return (
                <div className={`space-y-8 ${animationClass}`}>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Cadastre suas Rendas</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Entender sua fonte principal ajuda na organização.</p>
                    </div>

                    {/* Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl max-w-sm mx-auto">
                        <button onClick={() => setIncomeType('PF')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${incomeType === 'PF' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`}>
                            Sou CLT / Autônomo
                        </button>
                        <button onClick={() => setIncomeType('PJ')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${incomeType === 'PJ' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400'}`}>
                            Tenho Empresa / PJ
                        </button>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800/30 shadow-sm space-y-5 max-w-sm mx-auto animate-fade-in-up">
                        {incomeType === 'PF' ? (
                            <div>
                                <label className="block text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-2 ml-1">Renda Líquida Mensal</label>
                                <CurrencyInput value={incomeValue} onChange={setIncomeValue} className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-emerald-400 text-slate-800 dark:text-slate-200 font-bold text-lg shadow-sm" placeholder="R$ 0,00" />
                                <p className="text-[10px] text-emerald-600/70 mt-2 ml-1">O valor que realmente cai na sua conta.</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-2 ml-1">Nome da Empresa</label>
                                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Minha Holding" className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-emerald-400 text-slate-800 dark:text-slate-200 text-sm shadow-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-2 ml-1">Faturamento (R$)</label>
                                        <CurrencyInput value={incomeValue} onChange={setIncomeValue} className="w-full px-3 py-3 bg-white dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-emerald-400 text-slate-800 dark:text-slate-200 font-bold text-sm shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-2 ml-1">Imposto (%)</label>
                                        <input type="number" value={companyTax} onChange={e => setCompanyTax(e.target.value)} placeholder="6" className="w-full px-3 py-3 bg-white dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-emerald-400 text-slate-800 dark:text-slate-200 font-bold text-sm shadow-sm text-center" />
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-emerald-200/50">
                                    <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-200">
                                        <span className="text-xs font-medium">Líquido Estimado:</span>
                                        <span className="text-lg font-bold">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateNetIncome())}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            );

        case 'context':
            return (
                <div className={`space-y-8 ${animationClass}`}>
                     <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Uso do Sistema</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Você divide as contas com alguém?</p>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button onClick={() => setIsSharedAccount(false)} className={`w-36 p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-95 ${!isSharedAccount ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20 shadow-md' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                            <User size={32} className={`mx-auto mb-2 ${!isSharedAccount ? 'text-violet-600' : 'text-slate-400'}`}/>
                            <span className={`text-sm font-bold ${!isSharedAccount ? 'text-violet-700' : 'text-slate-500'}`}>Pessoal</span>
                        </button>
                         <button onClick={() => setIsSharedAccount(true)} className={`w-36 p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-95 ${isSharedAccount ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20 shadow-md' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                            <Users size={32} className={`mx-auto mb-2 ${isSharedAccount ? 'text-violet-600' : 'text-slate-400'}`}/>
                            <span className={`text-sm font-bold ${isSharedAccount ? 'text-violet-700' : 'text-slate-500'}`}>Família / Casal</span>
                        </button>
                    </div>

                    {isSharedAccount && (
                        <div className="animate-fade-in-up bg-violet-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-violet-100 dark:border-slate-800 shadow-sm max-w-sm mx-auto">
                             <h4 className="font-bold text-violet-700 dark:text-violet-300 mb-3 text-xs uppercase ml-1">Adicionar Pessoas</h4>
                             <div className="flex gap-2 mb-4">
                                <input type="text" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="Nome (ex: Esposa)" className="flex-grow px-4 py-2.5 bg-white dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-violet-300 shadow-sm" onKeyDown={e => e.key === 'Enter' && handleAddPerson()} />
                                <button onClick={handleAddPerson} className="bg-violet-500 text-white p-2.5 rounded-xl hover:bg-violet-600 transition-colors shadow-md"><Plus size={20}/></button>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                {localSettings.people.map((p, i) => (
                                    <span key={p.id} className="animate-fade-in flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-200 rounded-lg font-medium text-xs shadow-sm">
                                        {p.name} <X size={14} className="cursor-pointer text-slate-300 hover:text-rose-400" onClick={() => handleRemovePerson(p.id)}/>
                                    </span>
                                ))}
                             </div>
                        </div>
                    )}
                </div>
            );
        
        case 'cards':
            return (
                <div className={`space-y-6 ${animationClass}`}>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Cartões de Crédito</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Fundamental para controlar parcelas.</p>
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-3xl border border-orange-100 dark:border-orange-800/30 shadow-sm max-w-sm mx-auto">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="col-span-2 sm:col-span-4">
                                <label className="block text-[10px] font-bold uppercase text-orange-700/60 mb-1 ml-1">Apelido</label>
                                <input type="text" placeholder="Ex: Nubank" value={newCardNick} onChange={e => setNewCardNick(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-300 shadow-sm"/>
                            </div>
                            <div className="col-span-1 sm:col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-orange-700/60 mb-1 ml-1">Fecha</label>
                                <input type="number" placeholder="05" min="1" max="31" value={newCardClosing} onChange={e => setNewCardClosing(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-300 text-center shadow-sm"/>
                            </div>
                            <div className="col-span-1 sm:col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-orange-700/60 mb-1 ml-1">Vence</label>
                                <input type="number" placeholder="12" min="1" max="31" value={newCardDue} onChange={e => setNewCardDue(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-300 text-center shadow-sm"/>
                            </div>
                        </div>
                        <button onClick={handleAddCard} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-200 active:scale-95">
                            <Plus size={16}/> Adicionar Cartão
                        </button>
                    </div>

                    <div className="space-y-2 max-w-sm mx-auto">
                        {(localSettings.credit_cards || []).map((card, i) => (
                            <div key={card.id} style={{ animationDelay: `${i * 100}ms` }} className="animate-fade-in flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500">
                                        <CardIcon size={18}/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">{card.nickname}</h4>
                                        <div className="flex gap-2 text-[10px] text-slate-500">
                                            <span>Fecha: {card.closingDate}</span>
                                            <span>Vence: {card.dueDate}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => handleRemoveCard(card.id)} className="p-2 text-slate-300 hover:text-rose-400 transition-colors"><X size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            );

        case 'categories':
             return (
                <div className={`space-y-6 ${animationClass}`}>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Categorias Rápidas</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Classifique seus gastos para relatórios melhores.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        <CategoryInputBlock sKey="income_categories" title="Fontes de Renda" icon={TrendingUp} colorClass="text-emerald-500" bgClass="bg-emerald-500 bg-opacity-20" />
                        <CategoryInputBlock sKey="fixed_expense_categories" title="Contas Fixas" icon={Home} colorClass="text-teal-500" bgClass="bg-teal-500 bg-opacity-20" />
                        <CategoryInputBlock sKey="subscription_categories" title="Assinaturas" icon={Zap} colorClass="text-violet-500" bgClass="bg-violet-500 bg-opacity-20" />
                        <CategoryInputBlock sKey="purchase_categories" title="Compras Variáveis" icon={ShoppingCart} colorClass="text-sky-500" bgClass="bg-sky-500 bg-opacity-20" />
                    </div>
                </div>
            );
    }
  };

  return (
    <>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-0 sm:p-4 font-sans">
            <div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 sm:rounded-[2.5rem] shadow-none sm:shadow-xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[85vh] border-0 sm:border border-white dark:border-slate-800 ring-0 sm:ring-1 ring-slate-100 dark:ring-slate-800 relative">
                
                {/* Header / Progress */}
                <div className="px-5 sm:px-8 pt-8 pb-4 bg-white dark:bg-slate-900 z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            {/* Arkaan Dots Logo */}
                            <div className="flex gap-1.5 mr-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Passo {currentStep + 1} / {steps.length}</span>
                        </div>
                        <div className="flex gap-1.5">
                            {steps.map((_, i) => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ease-out ${i === currentStep ? 'w-8 bg-blue-600' : i < currentStep ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-slate-100 dark:bg-slate-800'}`} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div ref={contentRef} className="flex-1 px-5 sm:px-8 pb-4 overflow-y-auto custom-scrollbar relative">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 rounded-2xl flex items-center gap-3 text-sm text-rose-500 dark:text-rose-300 animate-fade-in shadow-sm">
                            <AlertCircle size={20} className="flex-shrink-0"/>
                            <p className="font-medium">{errorMsg}</p>
                        </div>
                    )}
                    {renderStep()}
                </div>

                {/* Footer Actions */}
                <div className="p-5 sm:p-8 border-t border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 flex justify-between items-center pb-8 sm:pb-8">
                    <button 
                        onClick={() => changeStep('prev')}
                        disabled={currentStep === 0}
                        className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-0 transition-all font-bold text-sm hover:-translate-x-1"
                    >
                        <ChevronLeft size={18} /> Voltar
                    </button>
                    
                    <button 
                        onClick={() => changeStep('next')}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                    >
                        {isSaving ? <LogoLoader size="sm" fullScreen={false} className="text-white"/> : (
                            <>
                                {currentStep === steps.length - 1 ? 'Concluir' : 'Continuar'}
                                {currentStep !== steps.length - 1 && <ChevronRight size={18} />}
                                {currentStep === steps.length - 1 && <Check size={18} />}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Skip Button - Outside Box */}
            <div className="mt-6 mb-4 sm:mb-0">
                <button type="button" onClick={() => setShowSkipModal(true)} disabled={isSaving} className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1.5 transition-colors opacity-70 hover:opacity-100 disabled:opacity-50">
                    Pular configuração inicial <SkipForward size={12} />
                </button>
            </div>
        </div>

        {/* CROP MODAL */}
        <Modal isOpen={isCropModalOpen} onClose={() => setIsCropModalOpen(false)} title="Ajustar Foto">
             <div className="relative w-full h-80 bg-slate-900 rounded-2xl overflow-hidden mb-6 shadow-inner ring-1 ring-white/10">
                {imageSrc && (
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                )}
            </div>
            
            <div className="flex items-center gap-3 mb-6 px-2">
                <ZoomIn size={18} className="text-slate-400"/>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
            </div>

            <div className="flex justify-end gap-3">
                <button onClick={() => setIsCropModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button onClick={handleCropSave} disabled={isUploading} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-200 transition-all hover:scale-105">
                    {isUploading && <Loader2 size={16} className="animate-spin" />}
                    {isUploading ? 'Salvando...' : 'Salvar Foto'}
                </button>
            </div>
        </Modal>

        {/* Unsaved Card Warning Modal */}
        <Modal isOpen={showUnsavedCardModal} onClose={() => setShowUnsavedCardModal(false)} title="Dados não Salvos">
            <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-700 dark:text-orange-300">
                    <AlertTriangle size={24} className="flex-shrink-0"/>
                    <p className="text-sm font-medium">Você preencheu os dados de um cartão mas não clicou em "Adicionar Cartão".</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 px-1">
                    O que deseja fazer com esses dados?
                </p>
                <div className="flex flex-col gap-3 mt-4">
                    <button onClick={handleCardModalSave} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors">
                        Salvar Cartão e Continuar
                    </button>
                    <button onClick={handleCardModalDiscard} className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors">
                        Descartar e Continuar
                    </button>
                    <button onClick={() => setShowUnsavedCardModal(false)} className="w-full py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold transition-colors">
                        Voltar e Revisar
                    </button>
                </div>
            </div>
        </Modal>

        {/* Skip Confirmation Modal */}
        <Modal isOpen={showSkipModal} onClose={() => setShowSkipModal(false)} title="Pular Configuração?">
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Os dados que você já preencheu serão salvos, mas seu perfil pode ficar incompleto. Você poderá editar tudo depois nas Configurações.
                </p>
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={() => setShowSkipModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSkipConfirm} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <SkipForward size={16}/>}
                        Confirmar e Pular
                    </button>
                </div>
            </div>
        </Modal>
    </>
  );
};

export default Onboarding;

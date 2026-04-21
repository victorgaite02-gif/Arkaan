
import React, { useState, useMemo, useEffect, ChangeEvent, useRef } from 'react';
import { AppSettings, CreditCard, Person, Company } from '../types';
import { CrudHooks } from '../App';
import { Plus, Trash2, SlidersHorizontal, User, Tag, Users, CreditCard as CreditCardIcon, Upload, GripVertical, Loader2, Building2, X, Image as ImageIcon, Briefcase, Calendar } from 'lucide-react';
import ViewHeader from './common/ViewHeader';
import CurrencyInput from './common/CurrencyInput';
import { supabase } from '../services/supabaseClient';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/canvasUtils';
import Modal from './common/Modal';

interface SettingsProps {
  appSettings: AppSettings;
  setAppSettings: (settings: AppSettings) => Promise<void>;
  setIsSidebarOpen: (isOpen: boolean) => void;
  companies: Company[];
  crudHooks: { companies: CrudHooks<Company> };
  isMobile: boolean;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

type CategoryType = 'income' | 'subscription' | 'fixed_expense' | 'purchase' | 'debt' | 'debtor';
type Tab = 'profile' | 'general' | 'categories' | 'people' | 'cards' | 'companies';

interface CategoryManagerProps {
    title: string;
    categories: string[];
    onAdd: (category: string) => void;
    onRemove: (category: string) => void;
    onReorder: (reordered: string[]) => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ title, categories, onAdd, onRemove, onReorder }) => {
    const [newCategory, setNewCategory] = useState('');
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);

    const handleAdd = () => {
        if (newCategory.trim() && !(categories || []).includes(newCategory.trim())) {
            onAdd(newCategory.trim());
            setNewCategory('');
        } else { alert('Categoria inválida ou já existente.'); }
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        dragItem.current = index;
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        dragOverItem.current = index;
    };

    const handleDrop = () => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }
        const newCategories = [...(categories || [])];
        const dragItemContent = newCategories.splice(dragItem.current, 1)[0];
        newCategories.splice(dragOverItem.current, 0, dragItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        onReorder(newCategories);
    };


    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{title}</h3>
            <div className="flex gap-2 mb-4">
                <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder={`Nova categoria`} className="flex-grow px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                <button onClick={handleAdd} className="bg-green-500 hover:bg-green-600 text-white font-bold p-2 rounded-lg transition-colors flex items-center justify-center"><Plus size={20} /></button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {(categories || []).map((cat, index) => (
                    <div 
                        key={cat} 
                        className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded-md group"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragEnd={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                    >
                       <div className="flex items-center gap-2">
                            <GripVertical size={16} className="text-slate-400 cursor-grab group-active:cursor-grabbing" />
                            <span className="text-sm">{cat}</span>
                        </div>
                        <button onClick={() => onRemove(cat)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Settings: React.FC<SettingsProps> = ({ 
    appSettings, setAppSettings, setIsSidebarOpen, companies, crudHooks,
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [localSettings, setLocalSettings] = useState(appSettings);
  const [newPersonName, setNewPersonName] = useState('');
  const [newCardNickname, setNewCardNickname] = useState('');
  const [newCardClosingDate, setNewCardClosingDate] = useState('');
  const [newCardDueDate, setNewCardDueDate] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTax, setNewCompanyTax] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Crop State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const prevAppSettingsRef = useRef(appSettings);

  useEffect(() => {
    if (JSON.stringify(appSettings) !== JSON.stringify(prevAppSettingsRef.current)) {
        setLocalSettings(appSettings);
        prevAppSettingsRef.current = appSettings;
    }
  }, [appSettings]);
  
  const handleImmediateSave = async (updatedSettings: AppSettings) => {
    setLocalSettings(updatedSettings);
    prevAppSettingsRef.current = updatedSettings; // Update ref to prevent loop
    await setAppSettings(updatedSettings);
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setIsCropModalOpen(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      
      setIsUploading(true);
      setIsCropModalOpen(false); // Close modal while processing

      // 1. Get Cropped & Compressed Blob
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) throw new Error('Falha ao recortar imagem');

      // 2. Upload to Supabase
      const fileExt = 'jpeg'; // Always jpeg due to canvas export
      const filePath = `${appSettings.user_id}.${fileExt}`;
      
      // Create a File object from the Blob to satisfy Supabase types if needed, or just upload blob
      const fileToUpload = new File([croppedBlob], filePath, { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, fileToUpload, { upsert: true });

      if (uploadError) throw uploadError;

      // 3. Get URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newAvatarUrl = `${data.publicUrl}?t=${new Date().getTime()}`; // bust cache
      
      // 4. Save to Profile
      const updatedSettings = { ...localSettings, avatar_url: newAvatarUrl };
      await handleImmediateSave(updatedSettings);
      await supabase.auth.updateUser({ data: { avatar_url: newAvatarUrl } });
      
      // Cleanup
      setImageSrc(null);
      setZoom(1);

    } catch (error: any) {
      console.error(error);
      alert(`Erro no upload: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
      if(confirm("Tem certeza que deseja remover sua foto de perfil?")) {
          setIsUploading(true);
          try {
              // We don't necessarily need to delete from storage, just unlink from profile
              const updatedSettings = { ...localSettings, avatar_url: '' };
              await handleImmediateSave(updatedSettings);
              await supabase.auth.updateUser({ data: { avatar_url: '' } });
          } catch (e: any) {
              alert("Erro ao remover foto: " + e.message);
          } finally {
              setIsUploading(false);
          }
      }
  };

  // Debounced save for text fields
  useEffect(() => {
    if (JSON.stringify(localSettings) === JSON.stringify(appSettings)) return;
    const handler = setTimeout(() => { setAppSettings(localSettings); }, 1000);
    return () => clearTimeout(handler);
  }, [localSettings, appSettings, setAppSettings]);

  const addCategory = (type: CategoryType, category: string) => {
      const key = `${type}_categories` as keyof AppSettings;
      const updatedList = [...((localSettings[key] as string[]) || []), category];
      handleImmediateSave({...localSettings, [key]: updatedList });
  };
  
  const removeCategory = (type: CategoryType, categoryToRemove: string) => {
      const key = `${type}_categories` as keyof AppSettings;
      const updatedList = ((localSettings[key] as string[]) || []).filter(cat => cat !== categoryToRemove);
      handleImmediateSave({...localSettings, [key]: updatedList });
  };
  
  const reorderCategory = (type: CategoryType, reorderedCategories: string[]) => {
    const key = `${type}_categories` as keyof AppSettings;
    handleImmediateSave({ ...localSettings, [key]: reorderedCategories });
  };
  
  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      const newPerson: Person = { id: new Date().getTime().toString(), name: newPersonName.trim() };
      handleImmediateSave({ ...localSettings, people: [...(localSettings.people || []), newPerson] });
      setNewPersonName('');
    } else {
      alert('Por favor, insira um nome válido.');
    }
  };

  const handleRemovePerson = (id: string) => {
    handleImmediateSave({ ...localSettings, people: (localSettings.people || []).filter(p => p.id !== id) });
  };
  
  const handleAddCard = () => {
    const closingDate = parseInt(newCardClosingDate, 10);
    const dueDate = parseInt(newCardDueDate, 10);
    if (newCardNickname.trim() && closingDate > 0 && closingDate <= 31 && dueDate > 0 && dueDate <= 31) {
        const newCard: CreditCard = { id: new Date().getTime().toString(), nickname: newCardNickname.trim(), closingDate, dueDate };
        handleImmediateSave({ ...localSettings, credit_cards: [...(localSettings.credit_cards || []), newCard]});
        setNewCardNickname(''); setNewCardClosingDate(''); setNewCardDueDate('');
    } else { alert('Por favor, preencha todos os campos do cartão com dias válidos (1-31).'); }
  };

  const handleRemoveCard = (id: string) => handleImmediateSave({ ...localSettings, credit_cards: (localSettings.credit_cards || []).filter(c => c.id !== id)});
  
  const handleAddCompany = async () => {
    const name = newCompanyName.trim();
    const taxStr = newCompanyTax.trim();
    const taxRate = taxStr === '' ? 0 : parseFloat(taxStr.replace(',', '.'));

    if (name && !isNaN(taxRate) && taxRate >= 0) {
      await crudHooks.companies.addItem({ name, tax_rate: taxRate });
      setNewCompanyName('');
      setNewCompanyTax('');
    } else {
      alert('Por favor, insira um nome válido e uma taxa de imposto numérica (pode ser 0).');
    }
  };

  const handleRemoveCompany = async (id: number) => {
    await crudHooks.companies.deleteItem(id);
  };

  const tabs = [
    { id: 'profile' as Tab, label: 'Perfil', icon: User },
    { id: 'general' as Tab, label: 'Geral', icon: SlidersHorizontal },
    { id: 'categories' as Tab, label: 'Categorias', icon: Tag },
    { id: 'people' as Tab, label: 'Pessoas', icon: Users },
    { id: 'cards' as Tab, label: 'Cartões', icon: CreditCardIcon },
    { id: 'companies' as Tab, label: 'Empresas', icon: Building2 },
  ];

  const renderTabContent = () => {
      switch(activeTab) {
          case 'profile':
              return (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Seu Perfil</h2>
                      <div className="flex flex-col items-center sm:flex-row gap-6">
                        
                        {/* Avatar Section */}
                        <div className="relative flex flex-col items-center gap-3">
                          <div className="relative">
                            <img 
                                src={localSettings.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(localSettings.user_name)}&background=3b82f6&color=fff&size=128`}
                                alt="Avatar"
                                className="w-32 h-32 rounded-full object-cover ring-4 ring-slate-200 dark:ring-slate-700 shadow-md"
                            />
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                    <Loader2 className="text-white animate-spin" size={24} />
                                </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                              <label htmlFor="avatar-upload" className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
                                <Upload size={14} /> Alterar Foto
                              </label>
                              <input type="file" id="avatar-upload" accept="image/*" className="hidden" onChange={onFileChange} disabled={isUploading} />
                              
                              {localSettings.avatar_url && (
                                <button 
                                    onClick={handleRemoveAvatar}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Remover foto"
                                >
                                    <Trash2 size={16} />
                                </button>
                              )}
                          </div>
                        </div>

                        <div className="space-y-4 flex-1 w-full">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                              <input type="text" value={localSettings.user_name} readOnly className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                              <input type="email" value={localSettings.user_email} readOnly className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                                  <input type="tel" value={localSettings.phone || ''} onChange={(e) => setLocalSettings({...localSettings, phone: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm" placeholder="(00) 00000-0000"/>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Nascimento</label>
                                  <input type="date" value={localSettings.birth_date || ''} onChange={(e) => setLocalSettings({...localSettings, birth_date: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Profissão</label>
                                  <div className="relative">
                                      <Briefcase size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                                      <input type="text" value={localSettings.profession || ''} onChange={(e) => setLocalSettings({...localSettings, profession: e.target.value})} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm" placeholder="Ex: Desenvolvedor"/>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Gênero</label>
                                  <select value={localSettings.gender || ''} onChange={(e) => setLocalSettings({...localSettings, gender: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm">
                                      <option value="">Selecione</option>
                                      <option value="Masculino">Masculino</option>
                                      <option value="Feminino">Feminino</option>
                                      <option value="Outro">Outro</option>
                                  </select>
                              </div>
                          </div>
                        </div>
                      </div>
                  </div>
              );
          case 'general':
              return (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Taxas e Câmbio</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cotação do Dólar (USD para BRL)</label>
                          <input type="number" value={localSettings.usd_rate} onChange={(e) => setLocalSettings({ ...localSettings, usd_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm" step="0.01"/>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Afeta apenas novas assinaturas em dólar.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Taxa de IOF (%)</label>
                          <input type="number" value={localSettings.iof_rate} onChange={(e) => setLocalSettings({ ...localSettings, iof_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm" step="0.01"/>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Aplicado sobre compras internacionais.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Outros Custos</h2>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo Mensal de Contabilidade (R$)</label>
                           <CurrencyInput value={localSettings.accounting_cost || 0} onChange={(val) => setLocalSettings({ ...localSettings, accounting_cost: val })} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                       <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Zona de Configuração</h2>
                       <button onClick={() => setAppSettings({...localSettings, is_onboarded: false})} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm">
                           Reiniciar Assistente de Boas-Vindas
                       </button>
                       <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Use isso se quiser refazer o cadastro inicial.</p>
                    </div>
                </div>
              );
          case 'categories':
              return (
                  <div className="space-y-6">
                      <CategoryManager title="Categorias de Receita" categories={localSettings.income_categories} onAdd={(c) => addCategory('income', c)} onRemove={(c) => removeCategory('income', c)} onReorder={(c) => reorderCategory('income', c)} />
                      <CategoryManager title="Categorias de Assinatura" categories={localSettings.subscription_categories} onAdd={(c) => addCategory('subscription', c)} onRemove={(c) => removeCategory('subscription', c)} onReorder={(c) => reorderCategory('subscription', c)} />
                      <CategoryManager title="Categorias de Despesa Fixa" categories={localSettings.fixed_expense_categories} onAdd={(c) => addCategory('fixed_expense', c)} onRemove={(c) => removeCategory('fixed_expense', c)} onReorder={(c) => reorderCategory('fixed_expense', c)} />
                      <CategoryManager title="Categorias de Compra" categories={localSettings.purchase_categories} onAdd={(c) => addCategory('purchase', c)} onRemove={(c) => removeCategory('purchase', c)} onReorder={(c) => reorderCategory('purchase', c)} />
                      <CategoryManager title="Categorias de Dívida" categories={localSettings.debt_categories} onAdd={(c) => addCategory('debt', c)} onRemove={(c) => removeCategory('debt', c)} onReorder={(c) => reorderCategory('debt', c)} />
                      <CategoryManager title="Categorias de Devedores" categories={localSettings.debtor_categories} onAdd={(c) => addCategory('debtor', c)} onRemove={(c) => removeCategory('debtor', c)} onReorder={(c) => reorderCategory('debtor', c)} />
                  </div>
              );
          case 'people':
              return (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Gerenciar Pessoas</h2>
                      <div className="flex gap-2 mb-4">
                          <input type="text" value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} placeholder="Nome da pessoa" className="flex-grow px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                          <button onClick={handleAddPerson} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg"><Plus size={20}/></button>
                      </div>
                      <div className="space-y-2">
                          {(localSettings.people || []).map(p => (
                              <div key={p.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded-md">
                                  <span>{p.name}</span>
                                  <button onClick={() => handleRemovePerson(p.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          ))}
                           {(localSettings.people || []).length === 0 && <p className="text-slate-500 text-sm">Nenhuma pessoa cadastrada.</p>}
                      </div>
                  </div>
              );
          case 'cards':
               return (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Gerenciar Cartões de Crédito</h2>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                          <input type="text" value={newCardNickname} onChange={(e) => setNewCardNickname(e.target.value)} placeholder="Apelido (ex: Nubank)" className="md:col-span-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                          <input type="number" value={newCardClosingDate} onChange={(e) => setNewCardClosingDate(e.target.value)} placeholder="Dia Fechamento" min="1" max="31" className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                          <div className="flex gap-2">
                            <input type="number" value={newCardDueDate} onChange={(e) => setNewCardDueDate(e.target.value)} placeholder="Dia Vencimento" min="1" max="31" className="flex-grow px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                            <button onClick={handleAddCard} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg"><Plus size={20}/></button>
                          </div>
                      </div>
                      <div className="space-y-2">
                          {(localSettings.credit_cards || []).map(c => (
                              <div key={c.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded-md">
                                  <div>
                                      <span className="font-semibold">{c.nickname}</span>
                                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Fecha dia {c.closingDate} / Vence dia {c.dueDate}</span>
                                  </div>
                                  <button onClick={() => handleRemoveCard(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          ))}
                          {(localSettings.credit_cards || []).length === 0 && <p className="text-slate-500 text-sm">Nenhum cartão cadastrado.</p>}
                      </div>
                  </div>
              );
          case 'companies':
              return (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Gerenciar Empresas (PJ)</h2>
                       <div className="flex gap-2 mb-4">
                          <input type="text" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Nome da Empresa" className="flex-grow px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                          <input type="number" value={newCompanyTax} onChange={(e) => setNewCompanyTax(e.target.value)} placeholder="Imposto (%)" className="w-24 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"/>
                          <button onClick={handleAddCompany} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg"><Plus size={20}/></button>
                      </div>
                      <div className="space-y-2">
                          {companies.map(c => (
                              <div key={c.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 p-2 rounded-md">
                                  <div>
                                      <span className="font-semibold">{c.name}</span>
                                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Imposto: {c.tax_rate}%</span>
                                  </div>
                                  <button onClick={() => handleRemoveCompany(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          ))}
                          {companies.length === 0 && <p className="text-slate-500 text-sm">Nenhuma empresa cadastrada.</p>}
                      </div>
                  </div>
              );
          default:
              return null;
      }
  };

  return (
    <>
        <ViewHeader 
            title="Configurações" 
            setIsSidebarOpen={setIsSidebarOpen}
            isPrivacyMode={isPrivacyMode}
            setIsPrivacyMode={setIsPrivacyMode}
            isAnimationsEnabled={isAnimationsEnabled}
            setIsAnimationsEnabled={setIsAnimationsEnabled}
        />
        
        {/* Mobile Tabs (Dropdown or Scroll) */}
        <div className="md:hidden mb-6 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="flex space-x-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Desktop Sidebar Tabs */}
            <div className="hidden md:block w-64 bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden sticky top-6">
                <nav className="flex flex-col">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 border-l-4 border-transparent'}`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 w-full min-w-0">
                {renderTabContent()}
            </div>
        </div>

        {/* Crop Modal */}
        <Modal isOpen={isCropModalOpen} onClose={() => setIsCropModalOpen(false)} title="Ajustar Foto">
             <div className="relative w-full h-64 bg-slate-900 rounded-lg overflow-hidden mb-4">
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
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-slate-500">Zoom</span>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1"
                />
            </div>
            <div className="flex justify-end gap-2">
                <button onClick={() => setIsCropModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-md">Cancelar</button>
                <button 
                    onClick={handleCropSave} 
                    disabled={isUploading}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md flex items-center gap-2"
                >
                    {isUploading && <Loader2 size={14} className="animate-spin" />}
                    Salvar Foto
                </button>
            </div>
        </Modal>
    </>
  );
};

export default Settings;

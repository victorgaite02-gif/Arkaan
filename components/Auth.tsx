
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { KeyRound, Mail, ArrowLeft, Eye, EyeOff, AlertTriangle, Hammer } from 'lucide-react';
import LogoLoader from './common/LogoLoader';

// Defined constant to avoid module resolution errors with JSON imports in browser environments
const APP_VERSION = '1.2.5';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Maintenance State
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [bypassAdmin, setBypassAdmin] = useState(false);

  useEffect(() => {
      const checkMaintenance = async () => {
          const { data } = await supabase.from('platform_settings').select('*').eq('key', 'maintenance_mode').single();
          if (data && data.value === true) {
              setIsMaintenance(true);
          }
      };
      checkMaintenance();
  }, []);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          }
        }
      });
      if (error) setError(error.message);
      else setMessage('Verifique seu e-mail para o link de confirmação!');
    }
    setLoading(false);
  };

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      setError('Por favor, digite seu e-mail.');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Instruções de recuperação enviadas para seu e-mail.');
    }
    setLoading(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setIsRecovery(false);
    setMessage('');
    setError('');
  };

  const toggleRecovery = () => {
    setIsRecovery(!isRecovery);
    setMessage('');
    setError('');
  };

  if (isMaintenance && !bypassAdmin) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 text-white">
              <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl text-center max-w-md border border-slate-700">
                  <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Hammer size={40} className="text-yellow-500 animate-pulse" />
                  </div>
                  <h1 className="text-3xl font-bold mb-4">Estamos em Manutenção</h1>
                  <p className="text-slate-400 mb-8">
                      O Arkaan está passando por melhorias para te atender melhor. 
                      Voltaremos em breve com novidades incríveis!
                  </p>
                  <p className="text-xs text-slate-600 font-mono">Status: Sistema Offline</p>
                  
                  <button 
                    onClick={() => setBypassAdmin(true)}
                    className="mt-12 text-xs text-slate-700 hover:text-slate-500 transition-colors"
                  >
                      Sou Administrador
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 animate-blur-in-up relative z-10">
        <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                    <span className="w-3 h-3 rounded-full bg-blue-600/50"></span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Arkaan</h1>
            </div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            {isRecovery 
              ? 'Recuperar Senha' 
              : (isLogin ? 'Bem-vindo de volta' : 'Crie sua conta')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {isRecovery 
              ? 'Digite seu e-mail para receber as instruções' 
              : (isLogin ? 'Faça login para gerenciar suas finanças' : 'Comece a organizar sua vida financeira hoje')}
          </p>
        </div>

        {isRecovery ? (
          // RECOVERY FORM
          <form className="mt-8 space-y-6 animate-fade-in" onSubmit={handleRecovery}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email-recovery" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email-recovery" name="email" type="email" autoComplete="email" required
                    className="appearance-none block w-full pl-10 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 placeholder-slate-400 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                    placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 min-h-[44px]"
              >
                {loading ? <LogoLoader size="sm" fullScreen={false} className="bg-white/20 px-3 py-1 rounded-full" /> : 'Enviar E-mail de Recuperação'}
              </button>
            </div>

            <div className="text-center">
              <button type="button" onClick={toggleRecovery} className="inline-flex items-center text-sm text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                <ArrowLeft size={16} className="mr-1" /> Voltar para o Login
              </button>
            </div>
          </form>
        ) : (
          // LOGIN / SIGNUP FORM
          <form className="mt-8 space-y-6 animate-fade-in" onSubmit={handleAuth}>
            <div className="rounded-md shadow-sm space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label htmlFor="full-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                    <input
                      id="full-name" name="full_name" type="text" autoComplete="name" required
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 placeholder-slate-400 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                      placeholder="Seu Nome" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                   <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                    <input
                      id="phone" name="phone" type="tel" autoComplete="tel"
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 placeholder-slate-400 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                      placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email-address" name="email" type="email" autoComplete="email" required
                    className="appearance-none block w-full pl-10 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 placeholder-slate-400 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                    placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password-input" 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    autoComplete="current-password" 
                    required
                    className="appearance-none block w-full pl-10 pr-10 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 placeholder-slate-400 text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 min-h-[44px]"
              >
                {loading ? <LogoLoader size="sm" fullScreen={false} className="bg-white/20 px-3 py-1 rounded-full" /> : (isLogin ? 'Entrar' : 'Criar Conta')}
              </button>
            </div>
          </form>
        )}

        {message && (
          <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 animate-fade-in">
            <p className="text-sm text-center text-green-600 dark:text-green-400">{message}</p>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 animate-fade-in">
            <p className="text-sm text-center text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!isRecovery && (
          <div className="text-center border-t dark:border-slate-700 pt-6 flex flex-col gap-3">
            {isLogin && (
                 <button
                  type="button"
                  onClick={toggleRecovery}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  Esqueceu a senha?
                </button>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button onClick={toggleMode} className="ml-1 font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors hover:underline">
                {isLogin ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Footer with Copyright and Version */}
      <div className="mt-8 text-center animate-fade-in delay-500">
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} Whale Corporate. Todos os direitos reservados.
        </p>
        <div className="flex items-center justify-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
            <p className="text-[10px] text-slate-300 dark:text-slate-600 font-mono tracking-wide">
                v{APP_VERSION}
            </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
    } else {
      // Salva sessão local se rememberMe estiver marcado
      if (rememberMe) {
        localStorage.setItem('edenilson-remember', 'true');
      } else {
        localStorage.removeItem('edenilson-remember');
      }
      navigate('/');
    }
    setLoading(false);
  };

  React.useEffect(() => {
    // Se rememberMe estiver salvo, não pede login novamente
    if (localStorage.getItem('edenilson-remember')) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate('/');
        }
      });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-100 to-white animate-fade-in">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-indigo-100 p-3 rounded-full mb-2">
            <Lock className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Entrar</h2>
          <p className="text-gray-500 text-sm">Acesse o sistema de empréstimos</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="form-input w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition"
              placeholder="Digite seu email"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm mb-1">Senha</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="form-input w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition pr-20"
                placeholder="Digite sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-2 text-xs text-indigo-500 hover:underline focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="mr-2 accent-indigo-500"
              id="rememberMe"
            />
            <label htmlFor="rememberMe" className="text-gray-600 text-sm cursor-pointer">Manter login salvo</label>
          </div>
          {error && <div className="mb-4 text-center text-red-600 font-semibold bg-red-50 border border-red-200 rounded p-2 animate-shake">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-lg shadow transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('edenilson-remember');
            navigate('/login');
          }}
          className="mt-4 w-full py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold shadow transition-all duration-150"
        >
          Sair
        </button>
      </div>
    </div>
  );
};

export default Login;

// app/login/page.tsx
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/login-form';
import { useEffect } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      console.log('[LoginPage] Usuário autenticado, redirecionando para /dashboard');
      redirect('/dashboard');
    }
  }, [status]);

  if (status === 'loading') {
    return <div>Carregando...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoginForm />
    </div>
  );
}
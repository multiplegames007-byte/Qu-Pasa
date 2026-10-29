import React, { useState, useEffect } from 'react';
import { UserAccount } from './types/index.ts';
import { ownerVerifyToken } from './services/api.ts';
import { LandingScreen } from './components/LandingScreen.tsx';
import { BookingWizard } from './components/BookingWizard.tsx';
import { AdminLogin } from './components/admin/AdminLogin.tsx';
import { AdminPanel } from './components/admin/AdminPanel.tsx';
import { PrivacyModal } from './components/PrivacyModal.tsx';

type AppViewMode = 'landing' | 'client' | 'admin';

export default function App() {
  const [viewMode, setViewMode] = useState<AppViewMode>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin')) {
      return 'admin';
    }
    return 'landing';
  });

  const [currentOwner, setCurrentOwner] = useState<UserAccount | null>(null);
  const [isVerifyingOwner, setIsVerifyingOwner] = useState<boolean>(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);

  useEffect(() => {
    // Check if URL is admin
    const path = window.location.pathname.toLowerCase();
    const isAdmin = path.startsWith('/admin');

    if (isAdmin) {
      setViewMode('admin');
    }

    // Always check for existing saved owner token in background for seamless login
    ownerVerifyToken()
      .then((user) => {
        if (user) {
          setCurrentOwner(user);
        }
      })
      .finally(() => {
        setIsVerifyingOwner(false);
      });

    // Listen to browser navigation popstate
    const handlePopState = () => {
      const currentPath = window.location.pathname.toLowerCase();
      if (currentPath.startsWith('/admin')) {
        setViewMode('admin');
      } else {
        setViewMode('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setViewMode('admin');
  };

  const handleSelectClient = () => {
    window.history.pushState({}, '', '/');
    setViewMode('client');
  };

  const handleReturnToLanding = () => {
    window.history.pushState({}, '', '/');
    setViewMode('landing');
  };

  /* ======================================================================== */
  /* 1. INITIAL LANDING SCREEN (COM OPÇÕES CLIENTE E ADMIN + ARTE NIKKEI)      */
  /* ======================================================================== */
  if (viewMode === 'landing') {
    return (
      <LandingScreen
        onSelectClient={handleSelectClient}
        onSelectAdmin={handleSelectAdmin}
      />
    );
  }

  /* ======================================================================== */
  /* 2. PRIVATE OWNER DASHBOARD (ADMIN LOGIN OU PAINEL)                        */
  /* ======================================================================== */
  if (viewMode === 'admin') {
    if (isVerifyingOwner) {
      return (
        <div className="min-h-dvh w-full bg-slate-950 text-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-semibold tracking-wider">
              A verificar credenciais do dono...
            </span>
          </div>
        </div>
      );
    }

    if (!currentOwner) {
      return (
        <AdminLogin
          onLoginSuccess={(user) => {
            setCurrentOwner(user);
          }}
          onBackToHome={handleReturnToLanding}
        />
      );
    }

    return (
      <AdminPanel
        user={currentOwner}
        onLogout={() => {
          setCurrentOwner(null);
          handleReturnToLanding();
        }}
      />
    );
  }

  /* ======================================================================== */
  /* 3. PUBLIC CLIENT BOOKING FLOW (FULL-BLEED EXPANSIVE LAYOUT)              */
  /* ======================================================================== */
  return (
    <div className="min-h-dvh w-full bg-white text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <main className="flex-1 w-full flex flex-col">
        <BookingWizard
          onBackToLanding={handleReturnToLanding}
          onSuccessReturnHome={handleReturnToLanding}
        />
      </main>

      {/* Privacy Modal (Available through RGPD link in form) */}
      <PrivacyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
}

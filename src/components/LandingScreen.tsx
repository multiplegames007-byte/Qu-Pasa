import React from 'react';

interface LandingScreenProps {
  onSelectClient: () => void;
  onSelectAdmin: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onSelectClient,
  onSelectAdmin,
}) => {
  return (
    <div className="relative min-h-dvh w-full flex-1 flex flex-col bg-black select-none">
      {/* 1. Full-screen Background Photo */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/quepasa-poster.jpg"
          alt="Qué Pasa · Nikkei · Barba Azul"
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              '/src/assets/images/quepasa_nikkei_poster_1793031254762.jpg';
          }}
        />
        {/* Subtle dark tint to ensure text contrast while respecting the poster */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      </div>

      {/* 2. Top Half: ONLY "Clientes" */}
      <button
        onClick={onSelectClient}
        className="relative z-10 w-full flex-1 min-h-[50dvh] flex items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 hover:bg-black/20 active:bg-black/40 group focus:outline-none"
        aria-label="Clientes"
      >
        <span className="text-5xl sm:text-7xl md:text-8xl font-londrina font-normal tracking-wide text-white uppercase drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] transition-all duration-300 group-hover:scale-105 group-hover:text-amber-300">
          Clientes
        </span>
      </button>

      {/* 3. Horizontal Line at the Middle of the Screen */}
      <div className="relative z-20 w-full h-[1px] bg-white/30 backdrop-blur-sm shrink-0" />

      {/* 4. Bottom Half: ONLY "Admin" */}
      <button
        onClick={onSelectAdmin}
        className="relative z-10 w-full flex-1 min-h-[50dvh] flex items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 hover:bg-black/20 active:bg-black/40 group focus:outline-none"
        aria-label="Admin"
      >
        <span className="text-5xl sm:text-7xl md:text-8xl font-londrina font-normal tracking-wide text-white uppercase drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] transition-all duration-300 group-hover:scale-105 group-hover:text-amber-300">
          Admin
        </span>
      </button>
    </div>
  );
};

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl shadow-lg border border-amber-500 animate-fade-in">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Modo sin conexión — Mostrando enlaces guardados en memoria local.</span>
    </div>
  );
};

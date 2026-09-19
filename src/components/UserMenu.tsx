import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon,
  ChevronDown,
  LogOut,
  Users,
  Check,
  ShieldCheck,
  UserCog,
  Camera,
  ChevronRight,
  Settings
} from 'lucide-react';
import { useAuth, DEMO_TEAM_MEMBERS } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';

interface UserMenuProps {
  onOpenAuthModal: () => void;
  onOpenSupabaseModal?: () => void;
  onOpenEditProfile?: () => void;
  onOpenUsersManagement?: () => void;
  onOpenSettings?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  onOpenAuthModal,
  onOpenSupabaseModal,
  onOpenEditProfile,
  onOpenUsersManagement,
  onOpenSettings,
}) => {
  const { user, logout, switchUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        id="btn-login-header"
        type="button"
        onClick={onOpenAuthModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-xl shadow-2xs transition-all cursor-pointer"
      >
        <UserIcon className="w-3.5 h-3.5 text-neutral-500" />
        <span>Iniciar Sesión</span>
      </button>
    );
  }

  const initials = (user.fullName || user.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="btn-user-profile-menu"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200/90 shadow-2xs transition-all cursor-pointer text-left"
        aria-expanded={isOpen}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-lg object-cover border border-neutral-200 shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
            {initials}
          </div>
        )}

        <div className="hidden sm:block text-left min-w-0 max-w-[120px]">
          <p className="text-xs font-bold text-neutral-900 truncate leading-tight">
            {user.fullName || user.email.split('@')[0]}
          </p>
          <p className="text-[10px] text-neutral-500 truncate leading-none mt-0.5">
            {user.email}
          </p>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-neutral-200 py-2 z-50 animate-fade-in">
          {/* User Info Header with quick edit */}
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between gap-3 bg-neutral-50/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative group shrink-0">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover border border-neutral-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs">
                    {initials}
                  </div>
                )}
                {onOpenEditProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenEditProfile();
                    }}
                    className="absolute -bottom-1 -right-1 p-1 bg-neutral-900 text-white rounded-md shadow hover:bg-neutral-800 transition-transform cursor-pointer"
                    title="Cambiar foto de perfil"
                  >
                    <Camera className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-neutral-900 truncate">
                    {user.fullName}
                  </p>
                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">
                    {user.role === 'admin' ? 'Admin' : user.role === 'editor' ? 'Editor' : 'Usuario'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Core Profile Actions */}
          <div className="p-1 space-y-1 text-xs text-neutral-700">
            {/* Option 1: Edit Profile (Photo, Name, Email) */}
            {onOpenEditProfile && (
              <button
                id="btn-open-edit-profile"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenEditProfile();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-neutral-100 text-left transition-colors cursor-pointer text-neutral-800 font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <UserCog className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-neutral-900 leading-tight">Editar mi perfil</p>
                    <p className="text-[10px] text-neutral-400 leading-tight">Cambiar foto, nombre o correo</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            )}

            {/* Option 2: Configuración (Categorías) */}
            {onOpenSettings && (
              <button
                id="btn-open-settings"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-neutral-100 text-left transition-colors cursor-pointer text-neutral-800 font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-violet-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-neutral-900 leading-tight">Configuración</p>
                    <p className="text-[10px] text-neutral-400 leading-tight">Categorías, nombres y colores</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            )}

            {/* Option 2: Admin Users Management Button */}
            {user.role === 'admin' && onOpenUsersManagement && (
              <div className="py-1">
                <button
                  id="btn-open-users-management"
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenUsersManagement();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-violet-50/80 hover:bg-violet-100 text-left transition-all cursor-pointer border border-violet-200/90 text-violet-950 font-semibold shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-violet-950 leading-tight">
                        Gestión de Usuarios
                      </p>
                      <p className="text-[10px] text-violet-700 leading-tight">
                        Tabla completa de usuarios en BD
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-violet-200/80 text-violet-800 px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                </button>
              </div>
            )}

            {/* Admin fast user switch */}
            {user.role === 'admin' && (
              <>
                <div className="border-t border-neutral-100 my-1"></div>
                <div className="pt-1.5 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Users className="w-3 h-3 text-indigo-500" />
                    Cambiar a usuario demo:
                  </p>
                  <div className="space-y-1">
                    {DEMO_TEAM_MEMBERS.map((m) => {
                      const isActive = user.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            switchUser(m);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition-colors cursor-pointer text-xs ${
                            isActive
                              ? 'bg-indigo-50 font-semibold text-indigo-900'
                              : 'hover:bg-neutral-50 text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={m.avatarUrl}
                              alt={m.fullName}
                              referrerPolicy="no-referrer"
                              className="w-5 h-5 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate leading-tight font-medium">{m.fullName}</p>
                              <p className="text-[10px] text-neutral-400 truncate">{m.role === 'admin' ? 'Admin' : m.jobTitle}</p>
                            </div>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-neutral-100 my-1"></div>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenAuthModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-neutral-50 text-left transition-colors cursor-pointer text-neutral-700"
                >
                  <UserIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span>Conectar otra cuenta / Registrar</span>
                </button>
              </>
            )}

            <div className="border-t border-neutral-100 my-1"></div>

            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                await logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 text-left transition-colors cursor-pointer text-rose-600 font-medium"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar sesión</span>
            </button>

            <div className="border-t border-neutral-100 mt-1.5 pt-2 pb-1 px-3 flex items-center justify-between text-[10px] text-neutral-400">
              <span className="font-medium">ReewAI</span>
              <span className="font-mono bg-neutral-100 px-1.5 py-0.2 rounded text-neutral-500 font-semibold border border-neutral-200/60">{APP_VERSION}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

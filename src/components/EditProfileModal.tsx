import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  Check,
  Camera,
  Trash2,
  Sparkles,
  Save,
  AlertCircle,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../constants/version';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, isSupabase } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && isOpen) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatarUrl || '');
      setCustomUrlInput(user.avatarUrl || '');
      setErrorMessage('');
      setSuccessMessage('');
      setIsUrlMode(false);
    }
  }, [user, isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('La imagen es demasiado pesada. El tamaño máximo recomendado es 5 MB.');
      return;
    }

    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        setCustomUrlInput('');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Ocurrió un error al leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    const trimmed = customUrlInput.trim();
    if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/'))) {
      setAvatarUrl(trimmed);
      setErrorMessage('');
      setIsUrlMode(false);
    } else {
      setErrorMessage('Por favor, introduce una URL de imagen válida que empiece por https://');
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('');
    setCustomUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('El nombre no puede quedar vacío.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor, introduce un correo electrónico válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateProfile({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        avatarUrl: avatarUrl.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo guardar los cambios.');
      } else {
        setSuccessMessage('¡Perfil actualizado con éxito en la base de datos!');
        setTimeout(() => {
          onClose();
        }, 1100);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado al guardar el perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = (fullName || email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs overflow-hidden animate-in fade-in duration-150">
      <div
        id="modal-edit-profile"
        className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 leading-tight">
                Editar Perfil de Usuario
              </h2>
              <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                <span>Actualiza tu foto, nombre y correo</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  <Database className="w-2.5 h-2.5" />
                  {isSupabase ? 'Supabase DB' : 'Base de datos'}
                </span>
              </p>
            </div>
          </div>

          <button
            id="btn-close-edit-profile"
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section: Change Avatar Photo */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3.5">
            <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Foto de Perfil
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Avatar Preview */}
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md ring-1 ring-neutral-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xl font-bold shadow-md">
                    {initials}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-neutral-900 text-white rounded-xl shadow hover:bg-neutral-800 transition-transform active:scale-95 cursor-pointer"
                  title="Cambiar foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Upload actions */}
              <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Subir imagen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUrlMode(!isUrlMode)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{isUrlMode ? 'Ocultar URL' : 'Pegar URL'}</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                      title="Quitar foto actual"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-neutral-500">
                  Formatos soportados: JPG, PNG, WebP o enlaces HTTPS directos.
                </p>
              </div>
            </div>

            {/* Custom URL Input block */}
            {isUrlMode && (
              <div className="pt-2 border-t border-neutral-200/80 space-y-2">
                <label className="block text-[11px] font-semibold text-neutral-600">
                  URL pública de la imagen:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            {/* Quick Preset Avatars */}
            <div className="pt-2 border-t border-neutral-200/80">
              <p className="text-[11px] font-semibold text-neutral-500 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                O elige una foto de muestra:
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(url);
                      setCustomUrlInput('');
                    }}
                    className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      avatarUrl === url
                        ? 'border-indigo-600 ring-2 ring-indigo-200 scale-105'
                        : 'border-transparent hover:border-neutral-300 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Avatar ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-800">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              id="input-profile-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre y apellidos"
              required
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900"
            />
          </div>

          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-800">
              Correo Electrónico <span className="text-red-500">*</span>
            </label>
            <input
              id="input-profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900"
            />
            <p className="text-[11px] text-neutral-500">
              Se utilizará para tus inicios de sesión y asociación de enlaces en base de datos.
            </p>
          </div>

          {/* Role badge display */}
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-600">
            <span>Rol en el sistema:</span>
            <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
              {user.role === 'admin' ? 'Administrador' : user.role === 'editor' ? 'Editor' : 'Usuario'}
            </span>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-neutral-100">
            <span className="text-[10px] font-mono text-neutral-400 font-medium">{APP_VERSION}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                id="btn-save-profile"
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Guardando en BD...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Search,
  Trash2,
  Edit2,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Database,
  AlertTriangle,
  X,
  Save,
  CheckCircle2,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { APP_VERSION } from '../constants/version';

interface UsersManagementViewProps {
  onBack: () => void;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({ onBack }) => {
  const {
    user: currentUser,
    availableUsers,
    isSupabase,
    updateUserRole,
    updateAnyUser,
    deleteUser,
    createUser,
    refreshUsers,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'editor' | 'user'>('all');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals inside management
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states for Create/Edit
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'editor' | 'user'>('user');
  const [formAvatar, setFormAvatar] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Role stats
  const stats = useMemo(() => {
    const total = availableUsers.length;
    const admins = availableUsers.filter((u) => u.role === 'admin').length;
    const editors = availableUsers.filter((u) => u.role === 'editor').length;
    const users = availableUsers.filter((u) => u.role === 'user' || !u.role).length;
    return { total, admins, editors, users };
  }, [availableUsers]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return availableUsers.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRole =
        roleFilter === 'all'
          ? true
          : roleFilter === 'user'
          ? u.role === 'user' || !u.role
          : u.role === roleFilter;

      return matchSearch && matchRole;
    });
  }, [availableUsers, searchQuery, roleFilter]);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUsers();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleQuickRoleChange = async (userId: string, newRole: 'admin' | 'editor' | 'user') => {
    await updateUserRole(userId, newRole);
  };

  const openCreateModal = () => {
    setUserToEdit(null);
    setFormName('');
    setFormEmail('');
    setFormRole('user');
    setFormAvatar('');
    setFormPassword('');
    setFormConfirmPassword('');
    setShowPassword(false);
    setFormError('');
    setFormSuccess('');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (targetUser: UserProfile) => {
    setUserToEdit(targetUser);
    setFormName(targetUser.fullName);
    setFormEmail(targetUser.email);
    setFormRole(targetUser.role || 'user');
    setFormAvatar(targetUser.avatarUrl || '');
    setFormPassword('');
    setFormConfirmPassword('');
    setShowPassword(false);
    setFormError('');
    setFormSuccess('');
    setIsCreateModalOpen(true);
  };

  const handleSaveUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formName.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFormError('Introduce un email válido.');
      return;
    }

    // Password validation
    if (!userToEdit) {
      // Creating user: password is required
      if (!formPassword.trim()) {
        setFormError('La contraseña es obligatoria para que el nuevo usuario pueda ingresar al programa.');
        return;
      }
      if (formPassword.trim().length < 6) {
        setFormError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (formPassword !== formConfirmPassword) {
        setFormError('Las contraseñas no coinciden. Por favor, revísalas.');
        return;
      }
    } else {
      // Editing user: password is optional, but if entered, validate
      if (formPassword.trim()) {
        if (formPassword.trim().length < 6) {
          setFormError('La nueva contraseña debe tener al menos 6 caracteres.');
          return;
        }
        if (formPassword !== formConfirmPassword) {
          setFormError('Las contraseñas no coinciden. Por favor, revísalas.');
          return;
        }
      }
    }

    setIsSavingUser(true);
    try {
      if (userToEdit) {
        // Edit existing
        const updates: Partial<UserProfile> = {
          fullName: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          avatarUrl: formAvatar.trim(),
        };
        if (formPassword.trim()) {
          updates.password = formPassword.trim();
        }

        const res = await updateAnyUser(userToEdit.id, updates);
        if (!res.success) {
          setFormError(res.error || 'Error al actualizar usuario.');
        } else {
          setFormSuccess('Usuario y credenciales actualizados en la base de datos.');
          setTimeout(() => setIsCreateModalOpen(false), 700);
        }
      } else {
        // Create new
        const res = await createUser({
          fullName: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          avatarUrl: formAvatar.trim(),
          password: formPassword.trim(),
        });
        if (!res.success) {
          setFormError(res.error || 'Error al registrar usuario.');
        } else {
          setFormSuccess('Usuario creado exitosamente con su contraseña para iniciar sesión.');
          setTimeout(() => setIsCreateModalOpen(false), 700);
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Error inesperado.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleFileUploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormAvatar(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-[85vh] flex flex-col space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-links"
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Enlaces</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                Gestión de Usuarios
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                <ShieldCheck className="w-3 h-3" />
                Panel Admin
              </span>
              <span className="inline-flex items-center text-[10px] font-mono font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                {APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
              <span>Control y permisos de usuarios registrados en la base de datos</span>
              <span className="text-neutral-300">•</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                <Database className="w-2.5 h-2.5" />
                {isSupabase ? 'Supabase PostgreSQL' : 'Almacenamiento Persistente'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl shadow-2xs transition-all cursor-pointer"
            title="Sincronizar usuarios de la base de datos"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            id="btn-create-new-user"
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Total Usuarios</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">{stats.total}</p>
          <span className="text-[10px] text-neutral-400">En base de datos</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-violet-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-700">Administradores</span>
            <ShieldCheck className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-2xl font-black text-violet-950 mt-1">{stats.admins}</p>
          <span className="text-[10px] text-violet-500">Acceso total</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">Editores</span>
            <UserCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-950 mt-1">{stats.editors}</p>
          <span className="text-[10px] text-indigo-500">Gestión de contenido</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Usuarios Estándar</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-1">{stats.users}</p>
          <span className="text-[10px] text-neutral-400">Guardado personal</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-neutral-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-users"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
            Rol:
          </span>
          {(['all', 'admin', 'editor', 'user'] as const).map((r) => {
            const labels: Record<string, string> = {
              all: 'Todos',
              admin: 'Admins',
              editor: 'Editores',
              user: 'Usuarios',
            };
            const isActive = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {labels[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Usuario</th>
                <th className="py-3.5 px-4">Correo Electrónico</th>
                <th className="py-3.5 px-4">Rol en Sistema</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Fecha Registro</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    <Users className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-neutral-700">No se encontraron usuarios</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Prueba con otro término de búsqueda o cambia el filtro de roles.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const initials = (u.fullName || u.email || 'U')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-neutral-50/60 transition-colors ${
                        isCurrent ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      {/* User Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl object-cover border border-neutral-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-neutral-900 truncate">{u.fullName}</p>
                              {isCurrent && (
                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                  Tú
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-400 font-mono truncate">
                              ID: {u.id.slice(0, 16)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email Column */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-neutral-700">
                            <span className="truncate max-w-[200px] font-medium">{u.email}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(u.email)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
                              title="Copiar email"
                            >
                              {copiedEmail === u.email ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {u.password ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded w-fit border border-emerald-200/60">
                              <Key className="w-2.5 h-2.5" />
                              <span>Clave activa</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded w-fit border border-amber-200/60">
                              <Key className="w-2.5 h-2.5" />
                              <span>Sin clave asignada</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role Selector in DB Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role || 'user'}
                            onChange={(e) =>
                              handleQuickRoleChange(
                                u.id,
                                e.target.value as 'admin' | 'editor' | 'user'
                              )
                            }
                            className={`text-xs font-semibold py-1 px-2.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                              u.role === 'admin'
                                ? 'bg-violet-50 text-violet-800 border-violet-200'
                                : u.role === 'editor'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                            }`}
                          >
                            <option value="admin">Administrador</option>
                            <option value="editor">Editor</option>
                            <option value="user">Usuario Estándar</option>
                          </select>
                        </div>
                      </td>

                      {/* Date Column */}
                      <td className="py-3 px-4 hidden md:table-cell text-neutral-500 text-[11px]">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Activo'}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar datos del usuario"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            disabled={isCurrent}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCurrent
                                ? 'text-neutral-300 cursor-not-allowed'
                                : 'text-neutral-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                            }`}
                            title={
                              isCurrent
                                ? 'No puedes eliminar tu propia cuenta activa'
                                : 'Eliminar usuario de base de datos'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discreet Users Footer with Version */}
      <footer className="pt-6 pb-6 border-t border-neutral-200/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-500">ReewAI</span>
          <span>•</span>
          <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200/70">
            {APP_VERSION}
          </span>
          <span>•</span>
          <span>Gestión de Usuarios</span>
        </div>
        <div className="text-[11px] text-neutral-400">
          {filteredUsers.length} {filteredUsers.length === 1 ? 'usuario registrado' : 'usuarios registrados'}
        </div>
      </footer>

      {/* Delete User Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!userToDelete}
        title={`¿Eliminar usuario "${userToDelete?.fullName}" (${userToDelete?.email}) de la base de datos?`}
        onConfirm={async () => {
          if (userToDelete) {
            await deleteUser(userToDelete.id);
            setUserToDelete(null);
          }
        }}
        onCancel={() => setUserToDelete(null)}
      />

      {/* Create / Edit User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs overflow-hidden animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {userToEdit ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Se guardará en la base de datos del sistema
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserForm} className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Avatar Preview & Upload */}
              <div className="flex items-center gap-3.5">
                {formAvatar ? (
                  <img
                    src={formAvatar}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl object-cover border border-neutral-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
                <div className="space-y-1 text-xs">
                  <label className="block font-semibold text-neutral-700">Foto de Usuario</label>
                  <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 cursor-pointer">
                    <Camera className="w-3 h-3" />
                    <span>Seleccionar archivo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUploadAvatar}
                      className="hidden"
                    />
                  </label>
                  {formAvatar && (
                    <button
                      type="button"
                      onClick={() => setFormAvatar('')}
                      className="block text-[10px] text-red-600 hover:underline cursor-pointer"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Laura Gómez"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="laura@empresa.com"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Rol Asignado
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="user">Usuario Estándar (Ver y guardar sus propios enlaces)</option>
                  <option value="editor">Editor (Gestionar y categorizar contenido)</option>
                  <option value="admin">Administrador (Acceso total y gestión de usuarios)</option>
                </select>
              </div>

              {/* Password Section */}
              <div className="pt-2 border-t border-neutral-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>
                      {userToEdit ? 'Cambiar Contraseña de Acceso' : 'Contraseña de Acceso *'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-neutral-500 hover:text-neutral-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Ver</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={
                        userToEdit
                          ? 'Dejar en blanco para mantener la actual'
                          : 'Mínimo 6 caracteres para entrar'
                      }
                      required={!userToEdit}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    {userToEdit
                      ? 'Si defines una nueva contraseña, sustituirá a la contraseña anterior de este usuario.'
                      : 'El usuario usará esta contraseña junto con su correo para iniciar sesión en la plataforma.'}
                  </p>
                </div>

                {/* Confirm Password */}
                {(!userToEdit || formPassword.length > 0) && (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-800">
                      Confirmar Contraseña *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      placeholder="Vuelve a escribir la contraseña"
                      required
                      className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 ${
                        formConfirmPassword && formPassword !== formConfirmPassword
                          ? 'border-red-300 focus:ring-red-400 bg-red-50/20'
                          : 'border-neutral-300 focus:ring-indigo-500'
                      }`}
                    />
                    {formConfirmPassword && formPassword !== formConfirmPassword && (
                      <p className="text-[10px] text-red-600 font-medium">
                        Las contraseñas no coinciden.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Informative Supabase note */}
              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/70 text-[11px] text-indigo-900 space-y-1">
                <p className="font-semibold flex items-center gap-1 text-indigo-950">
                  <span>💡 Acceso inmediato sin confirmación de email:</span>
                </p>
                <p className="text-[10.5px] text-neutral-600 leading-normal">
                  Para que los nuevos usuarios puedan iniciar sesión al instante con esta contraseña sin necesidad de confirmar un enlace por correo, desactiva <strong>«Confirm email»</strong> en tu panel de Supabase (<em>Authentication $\rightarrow$ Providers $\rightarrow$ Email</em>).
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingUser ? 'Guardando...' : 'Guardar Usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

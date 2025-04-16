import ManageAdmins from '@/components/super-admin/manage-admins';

export default function SuperAdminPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Gerenciar Administradores</h1>
      <ManageAdmins />
    </div>
  );
}
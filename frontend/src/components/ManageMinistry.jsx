import { useEffect, useState } from 'react';
import { useLanguage } from './LanguageToggle';
import LoadingSpinner from './LoadingSpinner';
import TempPasswordModal from './TempPasswordModal';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';
import {
  getMinistryUsers,
  createMinistryUser,
  updateMinistryUser,
  deleteMinistryUser,
} from '../services/api';
import './ManageMinistry.css';

export default function ManageMinistry({ onBack }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', role: 'ministry' });
  const [savingId, setSavingId] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMinistryUsers();
      setUsers(res?.users || []);
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to load users';
      setError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSavingId('new');
      setError('');
      
      // Call API without password to generate temporary one
      const response = await createMinistryUser({
        email: form.email,
        role: form.role,
        // Don't send password - let backend generate it
      });
      
      // Show modal with temporary password
      if (response.success && response.temporaryPassword) {
        setCreatedUser(response.user);
        setTempPassword(response.temporaryPassword);
        setShowPasswordModal(true);
      }
      
      // Reset form
      setForm({ email: '', password: '', role: 'ministry' });
      
      // Reload users list
      await loadUsers();
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to create user';
      setError(message);
    }
    setSavingId(null);
  };

  const handleCloseModal = () => {
    setShowPasswordModal(false);
    setCreatedUser(null);
    setTempPassword('');
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      setSavingId(userId);
      setError('');
      await updateMinistryUser(userId, { is_active: isActive });
      await loadUsers();
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to update user';
      setError(message);
    }
    setSavingId(null);
  };

  const handleDelete = (userId, userEmail) => {
    setConfirmDelete({ userId, userEmail });
  };

  const confirmDeleteUser = async () => {
    if (!confirmDelete) return;
    const { userId, userEmail } = confirmDelete;
    
    try {
      setSavingId(userId);
      setError('');
      setConfirmDelete(null);
      await deleteMinistryUser(userId);
      await loadUsers();
      setToast({ message: `User "${userEmail}" deleted successfully`, type: 'success' });
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to delete user';
      setError(message);
    }
    setSavingId(null);
  };

  return (
    <div className="container-fluid py-4">
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-people-fill me-2"></i>
            {t('user_management')}
          </h2>
          <p className="text-muted mb-0">{t('create_manage_users')}</p>
        </div>
        <button className="btn btn-outline-secondary" onClick={onBack}>
          <i className="bi bi-arrow-left me-2"></i>
          {t('back')}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Create User Card */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-success text-white">
          <h5 className="mb-0 text-white">
            <i className="bi bi-person-plus-fill me-2 text-white"></i>
            {t('create_new_user')}
          </h5>
        </div>
        <div className="card-body">
          <div className="alert alert-info mb-3">
            <i className="bi bi-info-circle-fill me-2"></i>
            {t('secure_temp_password')}
          </div>
          <form onSubmit={handleCreate}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  <i className="bi bi-envelope me-1"></i>
                  {t('email_address')} <span className="text-danger">*</span>
                </label>
                <input
                  className="form-control form-control-lg"
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={savingId === 'new'}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-bold">
                  <i className="bi bi-shield-check me-1"></i>
                  {t('role')} <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-lg"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  disabled={savingId === 'new'}
                >
                  <option value="ministry">{t('ministry')}</option>
                  <option value="admin">{t('admin')}</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">&nbsp;</label>
                <button 
                  className="btn btn-success btn-lg w-100" 
                  disabled={savingId === 'new'}
                  type="submit"
                >
                  {savingId === 'new' ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {t('creating')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-plus-circle me-2"></i>
                      {t('create_user')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Existing Users Card */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-white">
            <i className="bi bi-people me-2 text-white"></i>
            {t('existing_users')}
          </h5>
          <span className="badge bg-light text-primary">{users.length} {t('total')}</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <LoadingSpinner label={t('loading')} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#ccc' }}></i>
              <p className="text-muted mt-3 mb-0">{t('no_users_yet')}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '5%' }}>
                      <i className="bi bi-hash"></i>
                    </th>
                    <th style={{ width: '35%' }}>
                      <i className="bi bi-envelope me-1"></i>
                      {t('email')}
                    </th>
                    <th style={{ width: '15%' }}>
                      <i className="bi bi-shield me-1"></i>
                      {t('role')}
                    </th>
                    <th style={{ width: '15%' }}>
                      <i className="bi bi-toggle-on me-1"></i>
                      {t('status')}
                    </th>
                    <th style={{ width: '15%' }}>
                      <i className="bi bi-key me-1"></i>
                      {t('password')}
                    </th>
                    <th style={{ width: '15%' }} className="text-end">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.id}>
                      <td className="text-muted">{index + 1}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar-circle bg-primary text-white me-2" style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {user.email?.charAt(0).toUpperCase()}
                          </div>
                          <span className="fw-medium">{user.email}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${user.role === 'admin' ? 'bg-danger' : 'bg-info'}`}>
                          <i className={`bi ${user.role === 'admin' ? 'bi-star-fill' : 'bi-person-badge'} me-1`}></i>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <select
                          className={`form-select form-select-sm ${user.is_active ? 'border-success' : 'border-secondary'}`}
                          value={user.is_active ? 'active' : 'inactive'}
                          onChange={(e) => handleStatusChange(user.id, e.target.value === 'active' ? 1 : 0)}
                          disabled={savingId === user.id}
                          style={{ maxWidth: '120px' }}
                        >
                          <option value="active">✓ {t('active')}</option>
                          <option value="inactive">✗ {t('inactive')}</option>
                        </select>
                      </td>
                      <td>
                        {user.must_change_password ? (
                          <span className="badge bg-warning text-dark">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            {t('must_change')}
                          </span>
                        ) : (
                          <span className="badge bg-success">
                            <i className="bi bi-check-circle me-1"></i>
                            {t('changed')}
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDelete(user.id, user.email)}
                          disabled={savingId === user.id}
                          title="Delete user"
                        >
                          {savingId === user.id ? (
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                          ) : (
                            <>
                              <i className="bi bi-trash me-1"></i>
                              {t('delete')}
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {showPasswordModal && createdUser && (
        <TempPasswordModal
          user={createdUser}
          temporaryPassword={tempPassword}
          onClose={handleCloseModal}
        />
      )}
      
      {confirmDelete && (
        <ConfirmModal
          title={t('delete_user')}
          message={`${t('delete_user_confirm')} ${confirmDelete.userEmail}? ${t('cannot_be_undone')}`}
          userEmail={confirmDelete.userEmail}
          confirmText={t('delete')}
          cancelText={t('cancel')}
          variant="danger"
          onConfirm={confirmDeleteUser}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
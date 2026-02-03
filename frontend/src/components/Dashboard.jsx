import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from './LanguageToggle';
import CropGrid from './CropGrid';
import ManageMinistry from './ManageMinistry';
import Profile from './Profile';
import FarmerDetail from './FarmerDetail';
import LoadingSpinner from './LoadingSpinner';
import FarmerFormModal from './CropFormModal';
import { getPlants, getFarmers, createFarmer } from '../services/api';
import logoAgri from '../img/logoAgri_NoBG.png';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const { role, logout } = useAuth();
  const { t, toggleLang, lang } = useLanguage();
  const [crops, setCrops] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [showManage, setShowManage] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFarmerDetail, setShowFarmerDetail] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState(null);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFarmerForm, setShowFarmerForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch both crops and farmers in parallel
      const [cropsRes, farmersRes] = await Promise.all([
        getPlants({ includeLatest: true }).catch(() => ({ data: [] })),
        getFarmers().catch(() => ({ data: [] }))
      ]);
      
      setCrops(cropsRes?.data || []);
      setFarmers(farmersRes?.data || []);
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to load data';
      setError(message);
    }
    setLoading(false);
  };

  const handleViewFarmer = (farmerId) => {
    const existing = (Array.isArray(farmers) ? farmers : []).find((f) => String(f.id) === String(farmerId)) || null;
    setSelectedFarmer(existing);
    setSelectedFarmerId(farmerId);
    setShowFarmerDetail(true);
    setShowManage(false);
    setShowProfile(false);
  };

  const handleFeedbackViewed = (farmerId) => {
    // Update the farmer's hasUnviewedFeedback status locally
    setFarmers(prev => prev.map(farmer => 
      farmer.id === farmerId 
        ? { ...farmer, hasUnviewedFeedback: false }
        : farmer
    ));
  };

  const handleAddFarmer = async (farmerData) => {
    try {
      setLoading(true);
      
      // Send to backend API
      const response = await createFarmer(farmerData);
      
      if (response.success && response.farmer) {
        // Add the farmer returned from backend to the list
        setFarmers(prev => [response.farmer, ...prev]);
      }
      
      // Close the form modal
      setShowFarmerForm(false);
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to create farmer';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Combine crops and farmers for display
  const allItems = [
    ...farmers,
    ...crops.map(c => ({ ...c, type: 'crop' }))
  ];

  return (
    <>
      <nav className="navbar sticky-top">
        <div
          className="container-fluid"
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: '0.5rem',
            padding: '0.5rem 1rem',
          }}
        >
          <Link
            to="/"
            className="navbar-brand d-flex align-items-center"
            style={{ textDecoration: 'none', flex: '1 1 auto', minWidth: '260px' }}
          >
           <img 
            src={logoAgri} 
            alt="Logo" 
            className="navbar-logo"
            style={{ 
              height: 'clamp(44px, 8vw, 80px)',
              width: 'clamp(44px, 8vw, 80px)',
              marginRight: 'clamp(8px, 2vw, 15px)',
              padding: '0px',
              backgroundColor: 'transparent',
              borderRadius: '50%',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              objectFit: 'cover',
              
            }} 
          />
            <span className="navbar-title" style={{ 
              fontSize: 'clamp(1.25rem, 4vw, 2rem)',
              fontWeight: '700',
              color: '#ffffff',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              letterSpacing: '1px'
            }}>
            {t('crop_tracking')}
            </span>
          </Link>
          <div
            className="navbar-buttons-container"
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '0.5rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginLeft: 'auto',
              paddingRight: '0.5rem',
              justifyContent: 'flex-end',
            }}
          >
            <button 
            className="btn btn-light" 
            style={{
                backgroundColor: '#ffffff',
                color: '#198754',
                border: '2px solid #ffffff',
                borderRadius: '6px',
                padding: '0.375rem 0.75rem',
                minWidth: 'auto',
                maxWidth: 'fit-content',
                whiteSpace: 'nowrap',
                fontSize: 'clamp(0.75rem, 2.6vw, 0.875rem)',
                fontWeight: '500'
              }}onClick={toggleLang}>
              <i className="bi bi-translate"></i>
              <span className="d-none d-md-inline ms-2">{lang === 'en' ? 'KH' : 'EN'}</span>
            </button>
            <button 
              className="btn btn-light" 
              style={{
                backgroundColor: '#ffffff',
                color: '#198754',
                border: '2px solid #ffffff',
                borderRadius: '6px',
                padding: '0.375rem 0.75rem',
                minWidth: 'auto',
                maxWidth: 'fit-content',
                whiteSpace: 'nowrap',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
              onClick={() => {
                setShowProfile(true);
                setShowManage(false);
              }}
            >
              <i className="bi bi-person-circle"></i>
              <span className="d-none d-md-inline ms-2">{t('profile')}</span>
            </button>
            <button 
              className="btn btn-light" 
              style={{
                  backgroundColor: '#ffffff',
                  color: '#198754',
                  border: '2px solid #ffffff',
                  borderRadius: '6px',
                  padding: '0.375rem 0.75rem',
                  minWidth: 'auto',
                  maxWidth: 'fit-content',
                  whiteSpace: 'nowrap',
                  fontSize: '0.875rem',
                  fontWeight: '500'
              }}
              onClick={logout}>
              <i className="bi bi-box-arrow-right"></i>
              <span className="d-none d-md-inline ms-2">{t('logout')}</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="container mt-4">
        {showManage ? (
          <ManageMinistry onBack={() => setShowManage(false)} />
        ) : showProfile ? (
          <Profile onBack={() => setShowProfile(false)} />
        ) : showFarmerDetail ? (
          <FarmerDetail
            farmerId={selectedFarmerId}
            initialFarmer={selectedFarmer}
            onBack={() => setShowFarmerDetail(false)}
            onFeedbackViewed={handleFeedbackViewed}
          />
        ) : (
          <>
            <h1 className="mb-4" style={{ 
              color: '#198754', 
              fontWeight: '600',
              fontSize: '2rem'
            }}>
              {t('crops_list')}
            </h1>
            {role === 'admin' && (
              <div className="mb-4 d-flex flex-wrap gap-3">
                <button 
                  className="btn btn-success" 
                  onClick={() => setShowFarmerForm(true)}
                >
                  <i className="bi bi-person-plus-fill me-2"></i>
                  <span className="d-none d-sm-inline">{t('add_new_farmer')}</span>
                  <span className="d-sm-none">{t('add_farmer') || 'Add'}</span>
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setShowManage(true);
                    setShowProfile(false);
                  }}
                >
                  <i className="bi bi-people-fill me-2"></i>
                  <span className="d-none d-sm-inline">{t('manage_users')}</span>
                  <span className="d-sm-none">{t('users') || 'Users'}</span>
                </button>
              </div>
            )}

            {loading && <LoadingSpinner label={t('loading')} />}
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            {!loading && <CropGrid crops={allItems} onCropsUpdate={fetchData} onViewFarmer={handleViewFarmer} onFeedbackViewed={handleFeedbackViewed} />}
          </>
        )}
      </div>

      {/* Farmer Form Modal */}
      <FarmerFormModal 
        show={showFarmerForm}
        onClose={() => setShowFarmerForm(false)}
        onAdd={handleAddFarmer}
      />
    </>
  );
}
import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getPublicFarmer, scanFarmerQR } from "../services/api";
import { translations } from "../utils/translations";
import logoAgri from "../img/logoAgri_NoBG.png";

const FarmerProfile = () => {
  const { id, token } = useParams();

  // Determine farmer ID or token from URL
  const farmerId = id;
  const qrToken = token;

  const [language, setLanguage] = useState("km");
  const [farmerData, setFarmerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const t = translations[language];

  // Memoize displayed cultivation history to show only recent 5 weeks initially
  const displayedHistory = useMemo(() => {
    if (!farmerData?.cultivationHistory) return [];
    
    if (showAllHistory) {
      return farmerData.cultivationHistory;
    }
    
    // Show only the 5 most recent weeks initially
    return farmerData.cultivationHistory.slice(-5);
  }, [farmerData?.cultivationHistory, showAllHistory]);

  useEffect(() => {
    // Fetch farmer data from backend
    const loadFarmerData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check cache first
        const cacheKey = qrToken ? `farmer_qr_${qrToken}` : `farmer_${farmerId}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);
        
        // Use cache if less than 5 minutes old
        if (cachedData && cacheTime && (Date.now() - parseInt(cacheTime)) < 300000) {
          const transformedData = JSON.parse(cachedData);
          setFarmerData(transformedData);
          setLoading(false);
          return;
        }
        
        let response;
        
        // If we have a token, use the scan endpoint
        if (qrToken) {
          response = await scanFarmerQR(qrToken);
        } 
        // Otherwise use direct ID lookup
        else if (farmerId) {
          // Extract numeric ID and convert to integer (handles "farmer-001" -> 1, "farmer-1" -> 1, "1" -> 1)
          const numericId = parseInt(farmerId.toString().replace('farmer-', ''), 10);
          response = await getPublicFarmer(numericId);
        } else {
          throw new Error("No farmer ID or token provided");
        }
        
        if (!response || !response.success) {
          const errorMsg = response?.error || "Failed to load farmer data";
          throw new Error(errorMsg);
        }
        
        const backendData = response.data;
        
        // Format location
        const location = `${backendData.villageName}, ${backendData.districtName}, ${backendData.provinceCity}`;
        
        // Format dates
        const formatDate = (dateStr) => {
          if (!dateStr) return { en: "N/A", km: "មិនមាន" };
          try {
            const date = new Date(dateStr);
            const enDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const kmDate = date.toLocaleDateString('km-KH', { year: 'numeric', month: 'long', day: 'numeric' });
            return { en: enDate, km: kmDate };
          } catch {
            return { en: "Invalid date", km: "កាលបរិច្ឆេទមិនត្រឹមត្រូវ" };
          }
        };
        
        const plantingDate = formatDate(backendData.plantingDate);
        const harvestDate = formatDate(backendData.harvestDate);
        
        // Get crop safety score from backend data (if available)
        let cropSafetyScore = {
          score: null,
          maxScore: 10
        };
        
        if (backendData.cropSafetyScore && backendData.cropSafetyScore.score !== null) {
          cropSafetyScore = {
            score: backendData.cropSafetyScore.score,
            maxScore: backendData.cropSafetyScore.maxScore || 10,
            soilStatus: backendData.cropSafetyScore.soilStatus
          };
        }
        
        // Transform cultivation history from backend
        let cultivationHistory = [];
        
        if (backendData.cultivationHistory && Array.isArray(backendData.cultivationHistory) && backendData.cultivationHistory.length > 0) {
          
          // Status label mappings
          const statusLabels = {
            appropriate: {
              en: "Appropriate",
              km: "សមស្រប"
            },
            warning: {
              en: "Needs Attention",
              km: "ត្រូវការការយកចិត្តទុកដាក់"
            },
            critical: {
              en: "Critical",
              km: "ស្ថានភាពធ្ងន់ធ្ងរ"
            },
            pending: {
              en: "Data entry in progress",
              km: "កំពុងបញ្ចូលទិន្នន័យ"
            }
          };
          
          cultivationHistory = backendData.cultivationHistory.map(weekData => {
            // Format week dates
            const weekStart = new Date(weekData.weekStart);
            const weekEnd = new Date(weekData.weekEnd);
            
            const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const weekStartKm = weekStart.toLocaleDateString('km-KH', { month: 'long', day: 'numeric', year: 'numeric' });
            const weekEndKm = weekEnd.toLocaleDateString('km-KH', { month: 'long', day: 'numeric', year: 'numeric' });
            
            return {
              week: weekData.week,
              weekLabel: {
                en: `Week ${weekData.week} (${weekStartStr} - ${weekEndStr})`,
                km: `អាទិត្យទី${weekData.week} (${weekStartKm} - ${weekEndKm})`
              },
              wateringStatus: {
                status: weekData.wateringStatus,
                label: statusLabels[weekData.wateringStatus] || statusLabels.pending
              },
              soilNutrientLevel: {
                status: weekData.soilNutrientStatus,
                label: statusLabels[weekData.soilNutrientStatus] || statusLabels.pending
              },
              hasData: weekData.hasData
            };
          });
        }
        
        // Transform backend data to match component structure
        const transformedData = {
          id: backendData.id,
          profile: {
            name: {
              en: `${backendData.lastName} ${backendData.firstName}`,
              km: `${backendData.lastName} ${backendData.firstName}`
            },
            phoneNumber: backendData.phoneNumber,
            profileImage: backendData.profileImageUrl || "https://via.placeholder.com/150"
          },
          cropSafetyScore: cropSafetyScore,
          cropInformation: {
            cropType: {
              en: backendData.cropType,
              km: backendData.cropType
            },
            farmLocation: {
              en: location,
              km: location
            },
            plantingDate: plantingDate,
            harvestDate: harvestDate
          },
          // Use real cultivation history from backend
          cultivationHistory: cultivationHistory
        };
        
        setFarmerData(transformedData);
        
        // Cache the data
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(transformedData));
          sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
        } catch (cacheErr) {
          // Failed to cache data
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Failed to load farmer data");
      } finally {
        setLoading(false);
      }
    };

    if (qrToken || farmerId) {
      loadFarmerData();
    } else {
      setError("Invalid QR code");
      setLoading(false);
    }
  }, [farmerId, qrToken, id]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "km" ? "en" : "km"));
  };

  if (loading) {
    return (
      <div className="farmer-profile-container">
        <div className="bg-light border-bottom">
          <div className="container py-2 py-md-3">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <img src={logoAgri} alt="Agriculture Logo" className="header-logo" />
                <h5 className="mb-0 text-success header-title">
                  <i className="bi bi-leaf me-1 me-md-2"></i>
                  {t.smart_agriculture}
                </h5>
              </div>
            </div>
          </div>
        </div>
        <div className="container my-3 my-md-4">
          {/* Profile Skeleton */}
          <div className="card shadow-sm mb-3 mb-md-4">
            <div className="card-body text-center py-3 py-md-4">
              <div className="placeholder-glow">
                <div className="rounded-circle bg-secondary mx-auto mb-3" style={{width: '100px', height: '100px'}}></div>
                <div className="placeholder col-6 mb-2"></div>
                <div className="placeholder col-4"></div>
              </div>
            </div>
          </div>
          
          {/* Score Skeleton */}
          <div className="card shadow-sm mb-3 mb-md-4">
            <div className="card-body py-3 py-md-4">
              <div className="placeholder-glow">
                <div className="placeholder col-4 mb-3"></div>
                <div className="placeholder col-8"></div>
              </div>
            </div>
          </div>
          
          {/* Info Skeleton */}
          <div className="card shadow-sm mb-3 mb-md-4">
            <div className="card-header bg-success">
              <div className="placeholder-glow">
                <span className="placeholder col-5 bg-light"></span>
              </div>
            </div>
            <div className="card-body py-3 py-md-4">
              <div className="placeholder-glow">
                <div className="placeholder col-12 mb-2"></div>
                <div className="placeholder col-8 mb-3"></div>
                <div className="placeholder col-10 mb-2"></div>
                <div className="placeholder col-6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger text-center" role="alert">
          <h4 className="alert-heading">
            {t.error}
          </h4>
          <p>{error}</p>
          <hr />
          <small className="text-muted">
            {t.try_regenerate}
          </small>
        </div>
      </div>
    );
  }

  if (!farmerData) return null;

  return (
    <div className="farmer-profile-container">
      {/* Header with Language Toggle */}
      <div className="bg-light border-bottom sticky-top">
        <div className="container py-2 py-md-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            <div className="d-flex align-items-center header-branding">
              <img 
                src={logoAgri} 
                alt="Agriculture Logo" 
                className="header-logo"
              />
              <h5 className="mb-0 text-success header-title">
                <i className="bi bi-leaf me-1 me-md-2"></i>
                {t.smart_agriculture}
              </h5>
            </div>
            <button
              className="btn btn-outline-success btn-sm language-toggle"
              onClick={toggleLanguage}
            >
              <i className="bi bi-translate me-1 me-md-2"></i>
              {language === "en" ? "KH" : "EN"}
            </button>
          </div>
        </div>
      </div>

      <div className="container my-3 my-md-4">
        {/* Profile Section */}
        <div className="card shadow-sm mb-3 mb-md-4">
          <div className="card-body text-center py-3 py-md-4">
            <div className="mb-3">
              <img
                src={farmerData.profile.profileImage}
                alt="Farmer Profile"
                className="rounded-circle border border-3 border-success profile-image"
              />
            </div>
            <h4 className="mb-2 profile-name">{farmerData.profile.name[language]}</h4>
            <p className="text-muted mb-0 profile-phone">
              <i className="bi bi-telephone me-1 me-md-2"></i>
              {farmerData.profile.phoneNumber}
            </p>
          </div>
        </div>

        {/* Crop Safety Score */}
        {farmerData.cropSafetyScore && farmerData.cropSafetyScore.score !== null && farmerData.cropSafetyScore.score !== undefined ? (
          <div className="card shadow-sm mb-3 mb-md-4">
            <div className="card-body py-3 py-md-4">
              <h6 className="card-subtitle mb-2 text-muted score-subtitle">
                {t.crop_safety_score}
              </h6>
              <p className="text-muted mb-3" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-clock-history me-1"></i>
                {language === 'en' 
                  ? 'Overall average from planting date to expected harvest date' 
                  : 'មធ្យមភាគរួមចាប់ពីកាលបរិច្ឆេទដាំដុះរហូតមកដល់ថ្ងៃប្រមូលផលដែលបានរំពឹងទុក'}
              </p>
              <div className="d-flex align-items-center flex-wrap">
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center me-3 score-icon ${
                    farmerData.cropSafetyScore.score >= 8 
                      ? 'bg-success' 
                      : farmerData.cropSafetyScore.score >= 6 
                      ? 'bg-warning' 
                      : 'bg-danger'
                  }`}
                >
                  <i className={`text-white fs-4 ${
                    farmerData.cropSafetyScore.score >= 8 
                      ? 'bi bi-check-circle' 
                      : farmerData.cropSafetyScore.score >= 6 
                      ? 'bi bi-exclamation-triangle' 
                      : 'bi bi-x-circle'
                  }`}></i>
                </div>
                <div>
                  <h2 className={`mb-0 score-value ${
                    farmerData.cropSafetyScore.score >= 8 
                      ? 'text-success' 
                      : farmerData.cropSafetyScore.score >= 6 
                      ? 'text-warning' 
                      : 'text-danger'
                  }`}>
                    {farmerData.cropSafetyScore.score}/{farmerData.cropSafetyScore.maxScore}
                  </h2>
                  <small className="text-muted score-label">
                    {t.safety_score}
                    {farmerData.cropSafetyScore.soilStatus && (
                      <> - {farmerData.cropSafetyScore.soilStatus}</>
                    )}
                  </small>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card shadow-sm mb-3 mb-md-4">
            <div className="card-body py-3 py-md-4 text-center">
              <h6 className="card-subtitle mb-3 text-muted score-subtitle">
                {t.crop_safety_score}
              </h6>
              <div className="text-muted">
                <i className="bi bi-info-circle me-2"></i>
                <small>
                  {language === 'en' 
                    ? 'Crop safety score will be available once sensor data is collected' 
                    : 'ពិន្ទុសុវត្ថិភាពដំណាំនឹងមាននៅពេលប្រមូលទិន្នន័យចាប់សញ្ញា'}
                </small>
              </div>
            </div>
          </div>
        )}

        {/* Crop Information */}
        <div className="card shadow-sm mb-3 mb-md-4">
          <div className="card-header" style={{ backgroundColor: '#198754', color: '#ffffff' }}>
            <h5 className="mb-0 card-header-title" style={{ color: '#ffffff' }}>
              <i className="bi bi-info-circle me-1 me-md-2"></i>
              {t.crop_information}
            </h5>
          </div>
          <div className="card-body py-3 py-md-4">
            <div className="row g-2 g-md-3">
              <div className="col-12">
                <div className="border-bottom pb-2">
                  <small className="text-muted d-block info-label">{t.type_of_crop}</small>
                  <strong className="info-value">{farmerData.cropInformation.cropType[language]}</strong>
                </div>
              </div>
              <div className="col-12">
                <div className="border-bottom pb-2">
                  <small className="text-muted d-block info-label">{t.farm_location}</small>
                  <strong className="info-value">{farmerData.cropInformation.farmLocation[language]}</strong>
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <div className="border-bottom pb-2">
                  <small className="text-muted d-block info-label">{t.planting_date}</small>
                  <strong className="info-value">{farmerData.cropInformation.plantingDate[language]}</strong>
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <div className="border-bottom pb-2">
                  <small className="text-muted d-block info-label">{t.harvest_date}</small>
                  <strong className="info-value">{farmerData.cropInformation.harvestDate[language]}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cultivation History */}
        <div className="card shadow-sm mb-3 mb-md-4">
          <div className="card-header" style={{ backgroundColor: '#198754', color: '#ffffff' }}>
            <h5 className="mb-0 card-header-title" style={{ color: '#ffffff' }}>
              <i className="bi bi-calendar-check me-1 me-md-2"></i>
              {t.cultivation_history}
            </h5>
          </div>
          <div className="card-body py-3 py-md-4">
            {farmerData.cultivationHistory && farmerData.cultivationHistory.length > 0 ? (
              <>
                {displayedHistory.map((week, index) => (
                <div
                  key={week.week}
                  className={`mb-3 ${
                    index !== displayedHistory.length - 1
                      ? "border-bottom pb-3"
                      : ""
                  }`}
                >
                  <h6 className="text-primary mb-2 mb-md-3 week-label">{week.weekLabel[language]}</h6>
                  
                  {/* Watering Status */}
                  <div className="mb-2">
                    <div className="d-flex align-items-center mb-1 flex-wrap">
                      <small className="text-muted me-2 status-label">{t.watering_status}:</small>
                      <span
                        className={`badge status-badge ${
                          week.wateringStatus.status === "appropriate"
                            ? "bg-success"
                            : week.wateringStatus.status === "warning"
                            ? "bg-warning text-dark"
                            : week.wateringStatus.status === "critical"
                            ? "bg-danger"
                            : "bg-secondary"
                        }`}
                      >
                        {week.wateringStatus.label[language]}
                      </span>
                    </div>
                  </div>

                  {/* Soil Nutrient Level */}
                  <div className="mb-2">
                    <div className="d-flex align-items-center mb-1 flex-wrap">
                      <small className="text-muted me-2 status-label">{t.soil_nutrient_level}:</small>
                      <span
                        className={`badge status-badge ${
                          week.soilNutrientLevel.status === "appropriate"
                            ? "bg-success"
                            : week.soilNutrientLevel.status === "warning"
                            ? "bg-warning text-dark"
                            : week.soilNutrientLevel.status === "critical"
                            ? "bg-danger"
                            : "bg-secondary"
                        }`}
                      >
                        {week.soilNutrientLevel.label[language]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Load More / Show Less Button */}
              {farmerData.cultivationHistory.length > 5 && (
                <div className="text-center mt-3">
                  <button
                    className="btn btn-outline-success btn-sm"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                  >
                    {showAllHistory ? (
                      <>
                        <i className="bi bi-chevron-up me-2"></i>
                        {language === 'en' ? 'Show Less' : 'បង្ហាញតិច'}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-chevron-down me-2"></i>
                        {language === 'en' 
                          ? `Show All (${farmerData.cultivationHistory.length} weeks)` 
                          : `បង្ហាញទាំងអស់ (${farmerData.cultivationHistory.length} សប្តាហ៍)`}
                      </>
                    )}
                  </button>
                </div>
              )}
              </>
            ) : (
              <div className="text-center text-muted">
                <i className="bi bi-info-circle me-2"></i>
                <small>
                  {language === 'en' 
                    ? 'Cultivation history will be available as sensor data is collected over time' 
                    : 'ប្រវត្តិដាំដុះនឹងមាននៅពេលប្រមូលទិន្នន័យចាប់សញ្ញាតាមពេលវេលា'}
                </small>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-muted mb-3 mb-md-4">
          <small className="footer-note">
            <i className="bi bi-shield-check me-1 me-md-2"></i>
            {t.info_verified}
          </small>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        .farmer-profile-container {
          min-height: 100vh;
          background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
        }
        
        .card {
          border: none;
          border-radius: 12px;
          overflow: hidden;
        }
        
        .card-header {
          border: none;
          border-radius: 0;
        }
        
        /* Header Responsive Styles */
        .header-logo {
          height: 50px;
          margin-right: 8px;
        }
        
        .header-title {
          font-size: 1rem;
        }
        
        .language-toggle {
          font-size: 0.875rem;
          padding: 0.375rem 0.5rem;
          min-width: auto;
          max-width: fit-content;
          white-space: nowrap;
        }
        
        /* Profile Section */
        .profile-image {
          width: 100px;
          height: 100px;
          object-fit: cover;
        }
        
        .profile-name {
          font-size: 1.25rem;
        }
        
        .profile-phone {
          font-size: 0.9rem;
        }
        
        /* Score Section */
        .score-icon {
          width: 45px;
          height: 45px;
        }
        
        .score-subtitle {
          font-size: 0.875rem;
        }
        
        .score-value {
          font-size: 1.5rem;
        }
        
        .score-label {
          font-size: 0.8rem;
        }
        
        /* Card Header */
        .card-header-title {
          font-size: 1rem;
        }
        
        /* Info Section */
        .info-label {
          font-size: 0.75rem;
        }
        
        .info-value {
          font-size: 0.9rem;
          word-break: break-word;
        }
        
        /* History Section */
        .week-label {
          font-size: 0.95rem;
        }
        
        .status-label {
          font-size: 0.75rem;
        }
        
        .status-badge {
          font-size: 0.75rem;
        }
        
        /* Footer */
        .footer-note {
          font-size: 0.8rem;
        }
        
        /* Tablet and Desktop */
        @media (min-width: 576px) {
          .header-logo {
            height: 60px;
            margin-right: 10px;
          }
          
          .header-title {
            font-size: 1.15rem;
          }
          
          .profile-image {
            width: 110px;
            height: 110px;
          }
          
          .profile-name {
            font-size: 1.35rem;
          }
          
          .score-icon {
            width: 48px;
            height: 48px;
          }
          
          .score-value {
            font-size: 1.75rem;
          }
          
          .card-header-title {
            font-size: 1.1rem;
          }
          
          .info-value {
            font-size: 0.95rem;
          }
          
          .week-label {
            font-size: 1rem;
          }
        }
        
        @media (min-width: 768px) {
          .header-logo {
            height: 75px;
            margin-right: 12px;
          }
          
          .header-title {
            font-size: 1.25rem;
          }
          
          .language-toggle {
            font-size: 0.9rem;
            padding: 0.4rem 0.6rem;
            max-width: fit-content;
          }
          
          .profile-image {
            width: 120px;
            height: 120px;
          }
          
          .profile-name {
            font-size: 1.5rem;
          }
          
          .profile-phone {
            font-size: 1rem;
          }
          
          .score-icon {
            width: 50px;
            height: 50px;
          }
          
          .score-subtitle {
            font-size: 0.95rem;
          }
          
          .score-value {
            font-size: 2rem;
          }
          
          .score-label {
            font-size: 0.875rem;
          }
          
          .card-header-title {
            font-size: 1.25rem;
          }
          
          .info-label {
            font-size: 0.8rem;
          }
          
          .info-value {
            font-size: 1rem;
          }
          
          .week-label {
            font-size: 1.05rem;
          }
          
          .status-label {
            font-size: 0.8rem;
          }
          
          .status-badge {
            font-size: 0.8rem;
          }
          
          .footer-note {
            font-size: 0.875rem;
          }
        }
        
        /* Mobile specific adjustments */
        @media (max-width: 576px) {
          .container {
            padding-left: 10px;
            padding-right: 10px;
          }
          
          .header-branding {
            flex: 1;
          }
          
          .card-body {
            padding: 1rem;
          }
          
          .card-header {
            padding: 0.75rem 1rem;
          }
          
          /* Prevent text overflow on mobile */
          h4, h5, h6 {
            word-break: break-word;
          }
        }
        
        /* Extra small devices */
        @media (max-width: 375px) {
          .header-logo {
            height: 40px;
            margin-right: 6px;
          }
          
          .header-title {
            font-size: 0.9rem;
          }
          
          .language-toggle {
            font-size: 0.8rem;
            padding: 0.25rem 0.4rem;
            max-width: fit-content;
          }
          
          .profile-image {
            width: 90px;
            height: 90px;
          }
          
          .profile-name {
            font-size: 1.1rem;
          }
          
          .profile-phone {
            font-size: 0.85rem;
          }
          
          .score-icon {
            width: 40px;
            height: 40px;
          }
          
          .score-value {
            font-size: 1.35rem;
          }
        }
      `}</style>
    </div>
  );
};

export default FarmerProfile;

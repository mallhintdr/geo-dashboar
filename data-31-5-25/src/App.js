// src/App.js
import React, {
  useState,
  useEffect,
  useRef,
  Suspense,
  lazy,
  useCallback,
} from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Spinner, Container } from 'react-bootstrap';
import { useAuth } from './AuthContext';
import Header from './App/Header';
import Modals from './App/Modals';
import NavigationMenu from './App/NavigationMenu';
import UserRegistration from './UserRegistration';
import UserList from './UserList';
import UserDetail from './UserDetail';
import Statistics from './Statistics';
import Login from './Login';
import GoToLocationForm from './Map Component/GoToLocationForm';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/global.css';
import './styles/navbar.css';
import './styles/dropdown.css';

// Lazy load MapComponent
const MapComponent = lazy(() => import('./Map Component/MapComponent'));

const App = () => {
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showGoToForm, setShowGoToForm] = useState(false);

  const [goToMarkers, setGoToMarkers] = useState([]);
  const mapRef = useRef(null);

  const [selectedMauza, setSelectedMauza] = useState('');
  const [geoJsonPath, setGeoJsonPath] = useState(null);
  const [murabbaOptions, setMurabbaOptions] = useState([]);
  const [selectedMurabba, setSelectedMurabba] = useState(null);
  const [shajraEnabled, setShajraEnabled] = useState(false);
  const [shajraVisible, setShajraVisible] = useState(false);

  const { user, loading, modalError, setModalError, warning, setWarning } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    if (warning) setShowWarningModal(true);
    else setShowWarningModal(false);
  }, [warning]);

  const handleWarningModalClose = () => {
    setShowWarningModal(false);
    setWarning(null);
  };

  const clearCachedTiles = async () => {
    if ('indexedDB' in window) {
      const req = window.indexedDB.deleteDatabase('rasterDB');
      req.onsuccess = () => console.log('IndexedDB cache cleared.');
      req.onerror = (e) => console.error('IndexedDB cache error:', e.target.error);
    }
  };

  const clearAppData = async () => {
    await clearCachedTiles();
    localStorage.clear();
    window.location.reload();
  };

  useEffect(() => {
    const setVH = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    return () => window.removeEventListener('resize', setVH);
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') setShowGoToForm(false);
  }, [location]);

  const handleMauzaChange = useCallback((mauza) => {
    if (!user) return;
    setGeoJsonPath(`/JSON Murabba/${user.tehsil}/${mauza}.geojson`);
    setSelectedMauza(mauza);
    setMurabbaOptions([]);
    setSelectedMurabba(null);
    setShajraEnabled(false);
    setShajraVisible(false);
    clearCachedTiles();
  }, [user]);

  const handleSetMurabbaOptions = useCallback((opts) => {
    setMurabbaOptions((prev) =>
      JSON.stringify(prev) !== JSON.stringify(opts) ? opts : prev
    );
  }, []);

  const handleGoToLocation = ({ lat, lng }) => {
    setGoToMarkers((prev) => [...prev, { id: Date.now(), coords: [lat, lng] }]);
    setShowGoToForm(false);
    mapRef.current?.flyTo([lat, lng], 18, { animate: true, duration: 1.2 });
  };

  const handleMapInit = useCallback((map) => {
    mapRef.current = map;
  }, []);

  return (
    <Container
      fluid
      className="app-container px-0"
      style={{ height: 'calc(var(--vh,1vh)*100)', overflowY: 'auto' }}
    >
      <Header
        handleMenuToggle={() => setShowMenu(v => !v)}
        handleProfileClick={() => user ? setShowProfileModal(true) : navigate('/login')}
        handleMauzaChange={handleMauzaChange}
        selectedMauza={selectedMauza}
        setSelectedMauza={setSelectedMauza}
        murabbaOptions={murabbaOptions}
        handleMurabbaSelection={setSelectedMurabba}
        setShajraEnabled={setShajraEnabled}
      />

      <NavigationMenu
        showMenu={showMenu}
        handleMenuToggle={() => setShowMenu(v => !v)}
        onGoToLocationClick={() => {
          if (location.pathname === '/') {
            setShowGoToForm(true);
            setShowMenu(false);
          }
        }}
        clearAppData={clearAppData}
        shajraEnabled={shajraEnabled}
        shajraVisible={shajraVisible}
        toggleShajraVisible={() => {
          if (shajraEnabled) {
            setShajraVisible(v => !v);
            if (!shajraVisible) console.log('Loading Shajra...');
            else {
              console.log('Unloading Shajra.');
              clearCachedTiles();
            }
          }
        }}
      />

      {loading ? (
        <div className="d-flex justify-content-center align-items-center h-100">
          <Spinner animation="border" />
        </div>
      ) : (
        <Suspense fallback={
          <div className="d-flex justify-content-center align-items-center h-100">
            <Spinner animation="border" />
          </div>
        }>
          <Routes>
            <Route
              path="/"
              element={
                <MapComponent
                  geoJsonUrl={geoJsonPath}
                  goToMarkers={goToMarkers}
                  onClearMarkers={() => setGoToMarkers([])}
                  setMurabbaOptions={handleSetMurabbaOptions}
                  selectedMurabba={selectedMurabba}
                  shajraVisible={shajraVisible}
                  user={user}
                  selectedMauza={selectedMauza}
                  onMapInit={handleMapInit}
                />
              }
            />
            <Route path="/register" element={<UserRegistration />} />
            <Route path="/users" element={<UserList />} />
            <Route path="/users/:userId/details" element={<UserDetail />} />
            <Route path="/stats" element={<Statistics />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </Suspense>
      )}

      {showGoToForm && location.pathname === '/' && (
        <GoToLocationForm
          onGoToLocation={handleGoToLocation}
          onClose={() => setShowGoToForm(false)}
          onClearMarkers={() => setGoToMarkers([])}
        />
      )}

      <Modals
        showWarningModal={showWarningModal}
        setShowWarningModal={setShowWarningModal}
        warningContent={warning}
        onWarningModalClose={handleWarningModalClose}
        showProfileModal={showProfileModal}
        setShowProfileModal={setShowProfileModal}
        showChangePassword={showChangePassword}
        setShowChangePassword={setShowChangePassword}
        errorModal={modalError}
        setErrorModal={setModalError}
      />
    </Container>
  );
};

export default App;

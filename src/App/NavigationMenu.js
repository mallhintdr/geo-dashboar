// src/NavigationMenu.js
import React, { useState } from 'react';
import { Offcanvas, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const NavigationMenu = ({
  showMenu,
  handleMenuToggle,
  onGoToLocationClick,
  clearAppData,
  onOpenShiftModal,    // Handler for opening the Shift/Transform Mauza form
  canShiftMauza = false, // Controls visibility of the Shift/Transform Mauza item
  onSaveLayer,
  drawnGeoJson,
  savedLayers = [],
  onLoadLayer,
  onDeleteLayer,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Helper to navigate and close the menu
  const go = (path) => {
    navigate(path);
    handleMenuToggle();
  };

 const [showLayers, setShowLayers] = useState(false);
  const [showLoadList, setShowLoadList] = useState(false);

  return (
    <Offcanvas show={showMenu} onHide={handleMenuToggle} placement="start">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Geo Map Menu</Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body style={{ minWidth: 220, maxWidth: 300 }}>
        <Nav className="flex-column">

          {/* Main map */}
          <Nav.Link onClick={() => go('/')}>🌍 Map</Nav.Link>

          {/* Admin-only links */}
          {user?.userType === 'admin' && (
            <>
              <Nav.Link onClick={() => go('/register')}>📝 Register User</Nav.Link>
              <Nav.Link onClick={() => go('/users')}>👥 View Users</Nav.Link>
              <Nav.Link onClick={() => go('/stats')}>📊 Statistics</Nav.Link>
              <Nav.Link onClick={() => go('/subscription-management')}>🔄 Subscription Management</Nav.Link>
            </>
          )}

          {/* Auth links */}
          {user ? (
            <Nav.Link onClick={() => { logout(); handleMenuToggle(); }}>
              🔓 Logout
            </Nav.Link>
          ) : (
            <Nav.Link onClick={() => go('/login')}>🔐 Login</Nav.Link>
         )}

                   {/* Go-to-location tool */}
          <Nav.Link onClick={onGoToLocationClick}>📍 Go To Location</Nav.Link>

          {/* Land records */}
          <Nav.Link onClick={() => go('/land-records')}>📑 Land Records</Nav.Link>

          {/* Layer management */}
          {user && (
            <>
<Nav.Link onClick={() => setShowLayers(v => !v)}>
                📁 Layers {showLayers ? '▲' : '▼'}
              </Nav.Link>
              {showLayers && (
                <div style={{ marginLeft: '1rem' }}>
                  <Nav.Link
                    onClick={() => { onSaveLayer(); handleMenuToggle(); }}
                    disabled={
                      !drawnGeoJson ||
                      !drawnGeoJson.features?.length ||
                      savedLayers.length >= 10
                    }
                  >
                    💾 Save Current
                  </Nav.Link>
                  <Nav.Link onClick={() => setShowLoadList(v => !v)}>
                    📂 Load {showLoadList ? '▲' : '▼'}
                  </Nav.Link>
                  {showLoadList && (
                    <div style={{ marginLeft: '1rem' }}>
                      {savedLayers.length > 0 ? (
                        savedLayers.map(layer => (
                          <div key={layer._id} style={{ marginBottom: '4px' }}>
                            <span>{layer.name}</span>
                            <button
                              style={{ marginLeft: '6px' }}
                              onClick={() => { onLoadLayer(layer); handleMenuToggle(); }}
                            >
                              Load
                            </button>
                            <button
                              style={{ marginLeft: '6px' }}
                              onClick={() => onDeleteLayer(layer)}
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      ) : (
                        <Nav.Item style={{ paddingLeft: '1rem' }}>
                          No Layers
                        </Nav.Item>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* Shift/Transform Mouza (only if a Mauza is loaded) */}
          {user && onOpenShiftModal && canShiftMauza && (
            <Nav.Link
              onClick={() => {
                onOpenShiftModal();
                handleMenuToggle();
              }}
            >
              ✨ Transform/Shift Mouza
            </Nav.Link>
          )}

          {/* Clear cache */}
          <Nav.Link
            onClick={() => { clearAppData(); handleMenuToggle(); }}
          >
            🔄 Clear Cache
          </Nav.Link>
        </Nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default NavigationMenu;

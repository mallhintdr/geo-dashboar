// NavigationMenu.js
import React, { useState } from 'react';
import { Offcanvas, Nav, Accordion } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const NavigationMenu = ({
  showMenu,
  handleMenuToggle,
  onGoToLocationClick,
  clearAppData,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /* local state – is the My‑Drawings submenu open? */
  const [openDrawMenu, setOpenDrawMenu] = useState(false);

  const go = (path) => {
    navigate(path);
    handleMenuToggle();
  };

  /* tiny helper so we can add ?save=1 */
  const goWithQuery = (path) => {
    navigate(path);
    handleMenuToggle();
    setOpenDrawMenu(false);
  };

  return (
    <Offcanvas show={showMenu} onHide={handleMenuToggle} placement="start">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Navigation</Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body style={{ minWidth: 220, maxWidth: 300 }}>
        <Nav className="flex-column">

          {/* Main map */}
          <Nav.Link onClick={() => go('/')}>🌍 Map</Nav.Link>
                
          {/* Admin‑only links */}
          {user?.userType === 'admin' && (
            <>
              <Nav.Link onClick={() => go('/register')}>📝 Register User</Nav.Link>
              <Nav.Link onClick={() => go('/users')}>👥 View Users</Nav.Link>
              <Nav.Link onClick={() => go('/stats')}>📊 Statistics</Nav.Link>
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

          {/* Go‑to‑location tool */}
          <Nav.Link onClick={onGoToLocationClick}>📍 Go To Location</Nav.Link>

          {/* Clear cache */}
          <Nav.Link
            onClick={() => { clearAppData(); handleMenuToggle(); }}
          >
            🔄 Clear Cache
          </Nav.Link>
        </Nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default NavigationMenu;

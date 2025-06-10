import React from 'react';
import { Modal, Button, Alert } from 'react-bootstrap';
import ChangePasswordForm from '../ChangePasswordForm';
import { useAuth } from '../AuthContext';
import { calculateEndDate, calculateDaysRemaining } from '../userUtils';

const Modals = ({
  showWarningModal,
  setShowWarningModal,
  warningContent,
  showProfileModal,
  setShowProfileModal,
  showChangePassword,
  setShowChangePassword,
  errorModal, // Error modal state from AuthContext
  setErrorModal, // Function to update error modal state
}) => {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Warning Modal */}
      <Modal show={showWarningModal} onHide={() => setShowWarningModal(false)} centered>
        <Modal.Header className="profile-modal-header" closeButton>
          <Modal.Title>{warningContent?.title || 'Subscription Expiration Warning'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="profile-modal-body">
          {warningContent ? (
            <>
              <p><strong>User Name:</strong> {warningContent.userName}</p>
              <p><strong>Start Date:</strong> {warningContent.startDate}</p>
              <p><strong>End Date:</strong> {warningContent.endDate}</p>
              <p><strong>Days Remaining:</strong> {warningContent.daysRemaining}</p>
              <Alert variant="warning">{warningContent.message}</Alert>
            </>
          ) : (
            <Alert variant="warning">Subscription details are unavailable.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer className="modal-footer">
          <Button className="btn" onClick={() => setShowWarningModal(false)}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Profile Modal */}
      {user && showProfileModal && (
        <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered>
          <Modal.Header className="profile-modal-header" closeButton>
            <Modal.Title>User Profile</Modal.Title>
          </Modal.Header>
          <Modal.Body className="profile-modal-body">
            <p><strong>User Name:</strong> {user.userName}</p>
            <p><strong>User ID:</strong> {user.userId}</p>
            <p><strong>Mobile Number:</strong> {user.mobileNumber}</p>
            <p><strong>Subscription Type:</strong> {user.subscriptionType}</p>
            <p><strong>Start Date:</strong> {new Date(user.startDate).toLocaleDateString()}</p>
            <p>
              <strong>End Date:</strong>{' '}
              {calculateEndDate(user.startDate, user.subscriptionType)?.toLocaleDateString()}
            </p>
            <p>
              <strong>Days Remaining:</strong>{' '}
              {calculateDaysRemaining(user.startDate, user.subscriptionType)}
            </p>
          </Modal.Body>
          <div className="modal-footer">
            <Button className="btn btn-warning" onClick={() => setShowChangePassword(true)}>
              Change Password
            </Button>
            <Button className="btn btn-danger" onClick={() => logout()}>
              Logout
            </Button>
          </div>
        </Modal>
      )}

      {/* Change Password Modal */}
      <ChangePasswordForm show={showChangePassword} onHide={() => setShowChangePassword(false)} userId={user?.userId} />

      {/* Error Modal */}
      <Modal show={errorModal?.show} onHide={() => setErrorModal({ show: false, title: '', message: '' })} centered>
        <Modal.Header className="error-modal-header" closeButton>
          <Modal.Title>{errorModal?.title || 'Error'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="error-modal-body">
          <Alert variant="danger">{errorModal?.message || 'An unexpected error occurred.'}</Alert>
        </Modal.Body>
        <Modal.Footer className="modal-footer">
          <Button className="btn btn-primary" onClick={() => setErrorModal({ show: false, title: '', message: '' })}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Modals;

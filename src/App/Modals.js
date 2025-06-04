import React, { useState } from 'react';
import { Modal, Button, Alert, Form, Spinner } from 'react-bootstrap';
import { useAuth } from '../AuthContext';
import { calculateEndDate, calculateDaysRemaining } from '../userUtils';
import axios from 'axios';
import EditProfileForm from '../EditProfileForm';

const Modals = ({
  showWarningModal,
  setShowWarningModal,
  warningContent,
  showProfileModal,
  setShowProfileModal,
  showChangePassword,
  setShowChangePassword,
  errorModal,
  setErrorModal,
  showForgotPasswordModal = false,
  setShowForgotPasswordModal = () => {},
}) => {
  const { user, logout } = useAuth();

  // For Forgot Password modal
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // For Edit Profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Forgot Password Handler
  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotMsg(null);
    setForgotLoading(true);
    try {
      const apiBaseUrl = process.env.REACT_APP_API_URL || '';
      await axios.post(`${apiBaseUrl}/forgot-password`, { email: forgotEmail });
      setForgotMsg({
        type: 'success',
        text: 'If this email is registered, a reset link has been sent. Please check your inbox.',
      });
      setForgotEmail('');
    } catch {
      setForgotMsg({
        type: 'danger',
        text: 'Failed to send reset email. Please try again later.',
      });
    }
    setForgotLoading(false);
  };

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
            <p><strong>Email:</strong> {user.email || 'Not set'}</p>
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
            <Button
              className="btn btn-warning"
              onClick={() => setShowEditProfile(true)}
            >
              Edit Profile
            </Button>
            <Button className="btn btn-danger" onClick={() => logout()}>
              Logout
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit Profile Modal */}
      <EditProfileForm
        show={showEditProfile}
        onHide={() => setShowEditProfile(false)}
        user={user}
      />

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

      {/* Forgot Password Modal */}
      <Modal show={showForgotPasswordModal} onHide={() => {
        setShowForgotPasswordModal(false);
        setForgotMsg(null);
        setForgotEmail('');
      }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Forgot Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {forgotMsg && <Alert variant={forgotMsg.type}>{forgotMsg.text}</Alert>}
          <Form onSubmit={handleForgot}>
            <Form.Group className="mb-3">
              <Form.Label>Enter your registered email address</Form.Label>
              <Form.Control
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={forgotLoading}
              />
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              className="w-100"
              disabled={forgotLoading}
            >
              {forgotLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Send Reset Link'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default Modals;

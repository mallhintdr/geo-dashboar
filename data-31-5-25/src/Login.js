import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Card, Container, Row, Col } from 'react-bootstrap';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // Importing eye icons

const Login = () => {
  const [formData, setFormData] = useState({ userId: '', password: '', rememberMe: false });
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility
  const { login, loading, setModalError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedUserId = localStorage.getItem('userId');
    const savedPassword = localStorage.getItem('password');
    if (savedUserId && savedPassword) {
      setFormData({ userId: savedUserId, password: savedPassword, rememberMe: true });
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    try {
      await login({ userId: formData.userId, password: formData.password });

      if (formData.rememberMe) {
        localStorage.setItem('userId', formData.userId);
        localStorage.setItem('password', formData.password);
      } else {
        localStorage.removeItem('userId');
        localStorage.removeItem('password');
      }

      setMessage({ type: 'success', text: 'Login successful!' });
      navigate('/');
    } catch (error) {
      if (error.type === 'invalidCredentials') {
        setModalError({
          show: true,
          title: 'Invalid ID/Password',
          message: 'User ID or Password is incorrect. Please login again with Correct ID/Password',
        });
      } else if (error.type === 'subscriptionExpired') {
        setModalError({
          show: true,
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Please contact 0304-8840264 to renew Subscription.',
        });
      } else {
        setMessage({ type: 'danger', text: 'Login failed. Please try again.' });
      }
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <Row className="w-100">
        <Col md={6} className="mx-auto">
          <Card className="p-4 shadow">
            <h3 className="text-center mb-4">Login</h3>
            {message && <Alert variant={message.type}>{message.text}</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>User ID</Form.Label>
                <Form.Control
                  type="text"
                  name="userId"
                  value={formData.userId}
                  onChange={handleChange}
                  placeholder="Enter user ID"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3 position-relative">
                <Form.Label>Password</Form.Label>
                <div className="d-flex align-items-center position-relative">
                  <Form.Control
                    type={showPassword ? 'text' : 'password'} // Toggle between text and password
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter password"
                    required
                  />
                  <span
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      cursor: 'pointer',
                      color: '#6c757d',
                    }}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  name="rememberMe"
                  label="Remember Me"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
              </Form.Group>

              <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;

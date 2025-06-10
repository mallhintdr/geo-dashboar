import React, { useState } from 'react';
import { Form, Button, Alert, Card, Container, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getCurrentDate, subscriptionOptions } from './userUtils';
import './styles/global.css';
import './styles/form.css';

const UserRegistration = () => {
  // State for form data and messages
  const [formData, setFormData] = useState({
    userName: '',
    userId: '',
    password: '',
    tehsil: '',
    mobileNumber: '',
    mauzaList: '',
    startDate: getCurrentDate(),
    subscriptionType: 'Trial',
    userType: 'user',
    fee: 1000,               // ← new field with default
  });
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'fee' ? Number(value) : value
    }));
  };

  // Submit registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/register`,
        {
          ...formData,
          mauzaList: formData.mauzaList.split(',').map(m => m.trim())
        }
      );
      setMessage({
        type: 'success',
        text: `User "${formData.userName}" registered successfully!`
      });
      // Reset form (including fee back to 1000)
      setFormData({
        userName: '',
        userId: '',
        password: '',
        tehsil: '',
        mobileNumber: '',
        mauzaList: '',
        startDate: getCurrentDate(),
        subscriptionType: 'Trial',
        userType: 'user',
        fee: 1000
      });
    } catch (error) {
      setMessage({
        type: 'danger',
        text: error.response?.data.error || 'Registration failed'
      });
    }
  };

  // Cancel and clear
  const handleCancel = () => {
    setFormData({
      userName: '',
      userId: '',
      password: '',
      tehsil: '',
      mobileNumber: '',
      mauzaList: '',
      startDate: getCurrentDate(),
      subscriptionType: 'Trial',
      userType: 'user',
      fee: 1000
    });
    setMessage(null);
  };

  return (
    <Container className="registration-container">
      <Row className="justify-content-center align-items-center">
        <Col md={8} lg={6}>
          <Card className="p-4 shadow">
            <h4 className="text-center mb-1">User Registration</h4>

            {message && <Alert variant={message.type}>{message.text}</Alert>}

            <div className="scrollable-form-container">
              <Form onSubmit={handleSubmit}>
                {/* Row 1: Name & ID */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>User Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="userName"
                        value={formData.userName}
                        onChange={handleChange}
                        placeholder="Enter user name"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
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
                  </Col>
                </Row>

                {/* Row 2: Password & Tehsil */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter password"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tehsil</Form.Label>
                      <Form.Control
                        type="text"
                        name="tehsil"
                        value={formData.tehsil}
                        onChange={handleChange}
                        placeholder="Enter tehsil"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Row 3: Mobile & Mauza */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Mobile Number</Form.Label>
                      <Form.Control
                        type="text"
                        name="mobileNumber"
                        value={formData.mobileNumber}
                        onChange={handleChange}
                        placeholder="Enter mobile number"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Mauza List (comma-separated)</Form.Label>
                      <Form.Control
                        type="text"
                        name="mauzaList"
                        value={formData.mauzaList}
                        onChange={handleChange}
                        placeholder="Enter mauza list"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Row 4: Subscription & Start Date */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Start Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Subscription Type</Form.Label>
                      <Form.Select
                        name="subscriptionType"
                        value={formData.subscriptionType}
                        onChange={handleChange}
                      >
                        {subscriptionOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.value}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Row 5: User Type & Fee */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>User Type</Form.Label>
                      <Form.Select
                        name="userType"
                        value={formData.userType}
                        onChange={handleChange}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Fee</Form.Label>
                      <Form.Control
                        type="number"
                        name="fee"
                        value={formData.fee}
                        onChange={handleChange}
                        min={0}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Buttons */}
                <Row className="mt-3">
                  <Col>
                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100"
                      style={{ fontSize: '0.875rem', padding: '10px 15px' }}
                    >
                      Register
                    </Button>
                  </Col>
                  <Col>
                    <Button
                      variant="secondary"
                      onClick={handleCancel}
                      className="w-100"
                      style={{ fontSize: '0.875rem', padding: '10px 15px' }}
                    >
                      Cancel
                    </Button>
                  </Col>
                </Row>
              </Form>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default UserRegistration;

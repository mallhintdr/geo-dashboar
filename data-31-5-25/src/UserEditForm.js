// src/UserEditForm.js
import React, { useState, useEffect } from 'react';
import {
  Form, Button, Alert, Row, Col, Modal, InputGroup
} from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from './AuthContext';

import {
  subscriptionOptions,
  calculateEndDate,
  calculateStatus
} from './userUtils';

import './styles/global.css';
import './styles/form.css';
import './styles/modal.css';
import './styles/profile.css';

axios.defaults.withCredentials = true;

// ------------------------------------------------------------------
// Helper: fetch mauza list from PHP on frontend
// ------------------------------------------------------------------
const fetchMauzas = async (tehsil) => {
  if (!tehsil?.trim()) return [];
  try {
    // Use your production URL:
    const phpURL = `https://dashboard.naqsha-zameen.pk/get_mauza_list.php?tehsil=${encodeURIComponent(tehsil)}`;
    const { data } = await axios.get(phpURL, { withCredentials: false });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('fetch mauzas PHP error:', err.message);
    return [];
  }
};

const toArray = (str) =>
  str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];

const uniqSort = (arr) =>
  Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
export default function UserEditForm({ userId, handleClose, refreshUsers }) {
  const { loading } = useAuth();

  const [form, setForm]     = useState(null);  // all form fields
  const [options, setOpts]  = useState([]);    // mauza list from PHP
  const [filter, setFilter] = useState('');    // search text
  const [msg, setMsg]       = useState(null);  // alert

  // ---------- initial load ----------
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: u } = await axios.get(
          `${process.env.REACT_APP_API_URL}/users/${userId}`
        );

        const saved = toArray(u.mauzaList?.join ? u.mauzaList.join(',') : u.mauzaList);
        const list  = await fetchMauzas(u.tehsil);

        setOpts(uniqSort([...list, ...saved]));

        const sd = u.startDate ? new Date(u.startDate).toISOString().split('T')[0] : '';
        const ed = sd && u.subscriptionType ? calculateEndDate(sd, u.subscriptionType) : '';
        const st = ed ? calculateStatus(ed) : 'Unknown';

        setForm({
          userName: u.userName       || '',
          userId:   u.userId         || '',
          password: '',
          tehsil:   u.tehsil         || '',
          mobile:   u.mobileNumber   || '',
          mauzaStr: saved.join(', '),
          selected: saved,                // for checklist
          startDate: sd,
          subscriptionType: u.subscriptionType || '',
          endDate: ed,
          status: st,
          fee: u.fee ?? 1000
        });
      } catch (err) {
        setMsg({ type: 'danger', text: 'Failed to load user.' });
      }
    })();
  }, [userId]);

  // ---------- refresh list on tehsil change ----------
  useEffect(() => {
    if (!form?.tehsil) return;
    (async () => {
      const list = await fetchMauzas(form.tehsil);
      setOpts(uniqSort([...list, ...form.selected]));
    })();
    // eslint-disable-next-line
  }, [form?.tehsil]);

  // ---------- helpers ----------
  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const syncFromTextarea = (str) => {
    const arr = toArray(str);
    setForm(p => ({
      ...p,
      mauzaStr: str,
      selected: uniqSort(arr)
    }));
  };

  const toggle = (m) =>
    setForm(p => {
      const s = new Set(p.selected);
      s.has(m) ? s.delete(m) : s.add(m);
      const arr = [...s].sort();
      return { ...p, selected: arr, mauzaStr: arr.join(', ') };
    });

  const selectAll = () => {
    setForm(p => ({ ...p, selected: options, mauzaStr: options.join(', ') }));
  };
  const clearAll  = () => {
    setForm(p => ({ ...p, selected: [], mauzaStr: '' }));
  };

  const vis = options.filter(m =>
    m.toLowerCase().includes(filter.toLowerCase())
  );

  // ---------- submit ----------
  const save = async (e) => {
    e.preventDefault();
    setMsg(null);

    const payload = {
      ...form,
      mobileNumber: form.mobile,
      mauzaList: form.selected,
    };
    delete payload.selected;
    delete payload.mauzaStr;

    if (!payload.password.trim()) delete payload.password;

    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/users/${userId}`,
        payload
      );
      refreshUsers();
      handleClose();
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.message || err.message });
    }
  };

  if (loading || !form) return <Alert variant="info">Loading…</Alert>;

  return (
    <Modal show onHide={handleClose} centered size="lg">
      <Modal.Header closeButton><Modal.Title>Edit User</Modal.Title></Modal.Header>

      <Modal.Body style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {msg && <Alert variant={msg.type}>{msg.text}</Alert>}

        <Form onSubmit={save}>
          {/* ---------- basic info ---------- */}
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>User Name</Form.Label>
                <Form.Control
                  value={form.userName}
                  onChange={e => setField('userName', e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>User ID</Form.Label>
                <Form.Control value={form.userId} disabled />
              </Form.Group>
            </Col>
          </Row>

          {/* ---------- auth & tehsil ---------- */}
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={form.password}
                  placeholder="Leave blank to keep current"
                  onChange={e => setField('password', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tehsil</Form.Label>
                <Form.Control
                  value={form.tehsil}
                  onChange={e => setField('tehsil', e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>

          {/* ---------- mobile & mauza ---------- */}
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Mobile Number</Form.Label>
                <Form.Control
                  value={form.mobile}
                  onChange={e => setField('mobile', e.target.value)}
                  required
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              {/* textarea */}
              <Form.Group className="mb-2">
                <Form.Label>Mauza List (comma‑separated)</Form.Label>
                <Form.Control
                  as="textarea" rows={2}
                  value={form.mauzaStr}
                  onChange={e => syncFromTextarea(e.target.value)}
                />
              </Form.Group>

              {/* search & checklist */}
              <Form.Label>Filter / Select</Form.Label>
              <InputGroup className="mb-1">
                <Form.Control
                  placeholder="Search…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
                <Button variant="outline-secondary" onClick={() => setFilter('')}>×</Button>
              </InputGroup>

              <div className="d-flex justify-content-end mb-1">
                <Button size="sm" variant="outline-secondary" className="me-1" onClick={selectAll}>
                  All
                </Button>
                <Button size="sm" variant="outline-secondary" onClick={clearAll}>
                  None
                </Button>
              </div>

              <div className="border rounded p-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {options.length === 0 ? (
                  <small className="text-muted">No mauzas for this tehsil.</small>
                ) : vis.length === 0 ? (
                  <small className="text-muted">No matches.</small>
                ) : vis.map(m => (
                  <Form.Check
                    key={m}
                    type="checkbox"
                    label={m}
                    checked={form.selected.includes(m)}
                    onChange={() => toggle(m)}
                    className="mb-1"
                  />
                ))}
              </div>
              <small className="text-muted">Selected: {form.selected.length}</small>
            </Col>
          </Row>

          {/* ---------- subscription ---------- */}
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                  type="date"
                  value={form.startDate}
                  onChange={e => setField('startDate', e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Subscription Type</Form.Label>
                <Form.Select
                  value={form.subscriptionType}
                  onChange={e => setField('subscriptionType', e.target.value)}
                >
                  <option value="">Select Type</option>
                  {subscriptionOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.value}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          {/* ---------- status ---------- */}
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control value={form.endDate} disabled />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Control value={form.status} disabled />
              </Form.Group>
            </Col>
          </Row>

          {/* ---------- fee ---------- */}
          <Row>
            <Col md={6}>
              <Form.Group className="mb-4">
                <Form.Label>Fee</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={form.fee}
                  onChange={e => setField('fee', e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          {/* ---------- footer ---------- */}
          <div className="d-flex justify-content-end">
            <Button type="submit" className="me-2">Save</Button>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}

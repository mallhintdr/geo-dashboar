import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Table } from 'react-bootstrap';
import { useAuth } from './AuthContext';

const LandRecords = () => {
  const { user } = useAuth();
  const [tehsils, setTehsils] = useState([]);
  const [mauzas, setMauzas] = useState([]);
  const [khewats, setKhewats] = useState([]);

  const [tehsil, setTehsil] = useState('');
  const [mauza, setMauza] = useState('');
  const [khewatId, setKhewatId] = useState('');
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (!user) return;
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/landrecords/tehsils`, { withCredentials: true })
      .then(res => setTehsils(res.data))
      .catch(err => console.error(err));
  }, [user]);

  useEffect(() => {
    if (!tehsil) return;
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/landrecords/mauzas/${encodeURIComponent(tehsil)}`, { withCredentials: true })
      .then(res => setMauzas(res.data))
      .catch(err => console.error(err));
  }, [tehsil]);

  useEffect(() => {
    if (!tehsil || !mauza) return;
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/landrecords/khewats/${encodeURIComponent(tehsil)}/${encodeURIComponent(mauza)}`, { withCredentials: true })
      .then(res => setKhewats(res.data))
      .catch(err => console.error(err));
  }, [tehsil, mauza]);

  const handleKhewatChange = (id) => {
    setKhewatId(id);
    if (!id) { setDetails(null); return; }
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/landrecords/details/${id}`, { withCredentials: true })
      .then(res => setDetails(res.data))
      .catch(err => console.error(err));
  };

  return (
    <div className="container mt-3">
      <h3>Land Records</h3>

      <Form.Group className="mb-2">
        <Form.Label>Tehsil</Form.Label>
        <Form.Select value={tehsil} onChange={e => { setTehsil(e.target.value); setMauza(''); setKhewatId(''); setDetails(null); }}>
          <option value="">Select Tehsil</option>
          {tehsils.map(t => (<option key={t} value={t}>{t}</option>))}
        </Form.Select>
      </Form.Group>

      {tehsil && (
        <Form.Group className="mb-2">
          <Form.Label>Mauza</Form.Label>
          <Form.Select value={mauza} onChange={e => { setMauza(e.target.value); setKhewatId(''); setDetails(null); }}>
            <option value="">Select Mauza</option>
            {mauzas.map(m => (<option key={m} value={m}>{m}</option>))}
          </Form.Select>
        </Form.Group>
      )}

      {mauza && (
        <Form.Group className="mb-2">
          <Form.Label>Khewat</Form.Label>
          <Form.Select value={khewatId} onChange={e => handleKhewatChange(e.target.value)}>
            <option value="">Select Khewat</option>
            {khewats.map(k => (
              <option key={k.khewatId} value={k.khewatId}>{k.khewatNo || k.khewatId}</option>
            ))}
          </Form.Select>
        </Form.Group>
      )}

      {details && (
        <Table bordered size="sm" className="mt-3">
          <thead>
            <tr>
              <th>Owner Name</th>
              <th>Share</th>
              <th>Khasra IDs</th>
              <th>Khewat No</th>
            </tr>
          </thead>
          <tbody>
            {details.owners.map((o, idx) => (
              <tr key={idx}>
                <td>{o.first_name} {o.last_name}</td>
                <td>{o.person_share}</td>
                <td>{details.khasraIds.join(', ')}</td>
                <td>{details.khewatNo}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default LandRecords;

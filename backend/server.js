// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();

const PORT = process.env.PORT;
const SECRET_KEY = process.env.SECRET_KEY;
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const MONGO_URI = process.env.MONGO_URI;

// Paths for serving static files
const ROOT        = path.join(__dirname, '..');        // geo-dashboard/
const PUBLIC_ROOT = path.join(ROOT, 'public');         // geo-dashboard/public
const GEO_ROOT    = path.join(PUBLIC_ROOT, 'JSON Murabba');
const TILE_ROOT   = path.join(PUBLIC_ROOT, 'Shajra Parcha');

// Middleware Configuration
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static tiles
app.use('/Shajra Parcha', express.static(TILE_ROOT));

// MongoDB Connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('MongoDB connection error:', error));

// Sub‐schema for session tracking
const sessionSchema = new mongoose.Schema({
  start: Date,
  end: Date,
  duration: Number,        // in seconds
  ipAddress: String
}, { _id: false });

// Sub‐schema for renewal history
const renewalEntrySchema = new mongoose.Schema({
  date: { type: Date,   required: true },
  type: { type: String, required: true }
}, { _id: false });

// User Schema
const userSchema = new mongoose.Schema({
  userName: String,
  userId: { type: String, unique: true, required: true },
  password: String,
  tehsil: String,
  mobileNumber: String,
  mauzaList: [String],
  startDate: Date,
  subscriptionType: String,
  endDate: Date,
  daysRemaining: Number,
  status: String,
  userType: { type: String, enum: ['user', 'admin'], default: 'user' },
  email: { type: String, unique: true, sparse: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
 fee: { type: Number, default: 1000 },
  renewalHistory: { type: [renewalEntrySchema], default: [] },
  renewalCount: { type: Number, default: 0 },
  sessions: [sessionSchema],
  lastActive: Date
});

// --- GeoJSON Schema & Model ---
const geoJsonSchema = new mongoose.Schema({
  tehsil: { type: String, required: true, index: true },
  mauza:  { type: String, required: true, index: true },
  data:   { type: mongoose.Schema.Types.Mixed, required: true },
  defaultBounds: { type: [[Number]], default: null } // [[swLat, swLng], [neLat, neLng]]
});

const GeoJson = mongoose.model('GeoJson', geoJsonSchema);

// --- UserLayer Schema & Model ---
const userLayerSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:     { type: String, required: true },
  geojson:  { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt:{ type: Date, default: Date.now }
});
const UserLayer = mongoose.model('UserLayer', userLayerSchema);

// --- LandRecord Schema & Model ---
const landRecordSchema = new mongoose.Schema({
  district: String,
  tehsil: String,
  mouza: String,
  khewatId: Number,
  khewatNo: String,
  khasraIds: [Number],
  owners: [mongoose.Schema.Types.Mixed]
});

const LandRecord = mongoose.model('LandRecord', landRecordSchema);


// Helper: Calculate End Date, Days Remaining, and Status
const calculateDatesAndStatus = (startDate, subscriptionType) => {
  const subscriptionDays = {
    Trial: 5,
    Monthly: 30,
    Quarterly: 90,
    Biannual: 180,
    Annual: 365
  };
  const days = subscriptionDays[subscriptionType] || 0;
  const start = new Date(startDate);
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + days);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysRemaining = Math.max(
    Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)),
    0
  );
  const status = daysRemaining > 0 ? 'Active' : 'Inactive';

  return { endDate, daysRemaining, status };
};

const FEET_TO_METERS = 0.3048;

/**
 * shiftCoordinates(coords, dx, dy)
 *
 * Uses pure‐JS Web-Mercator formulas (no Leaflet) to convert [lon, lat] ↔ [X, Y] in meters,
 * add (dx, dy), then convert back to [lon, lat]. Recurses into nested arrays for Polygon/MultiPolygon.
 */
function shiftCoordinates(coords, dx, dy) {
  if (
    Array.isArray(coords) &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    const lon = coords[0];
    const lat = coords[1];

    // Web-Mercator constants
    const R = 6378137;
    // Project to meters
    const x0 = (lon * Math.PI * R) / 180;
    const y0 = Math.log(Math.tan((90 + lat) * Math.PI / 360)) * R;

    // Apply shift in meters
    const x1 = x0 + dx;
    const y1 = y0 + dy;

    // Unproject
    const lon1 = (x1 / R) * (180 / Math.PI);
    const lat1 = (360 / Math.PI) * Math.atan(Math.exp(y1 / R)) - 90;

    return [lon1, lat1];
  }
  return coords.map(c => shiftCoordinates(c, dx, dy));
}

// Utility: Compute bounding box of a FeatureCollection
function getGeoJsonBounds(features) {
  const coords = [];
  features.forEach((f) => {
    let arr = [];
    if (f.geometry?.type === 'Polygon') arr = f.geometry.coordinates.flat();
    if (f.geometry?.type === 'MultiPolygon') arr = f.geometry.coordinates.flat(2);
    coords.push(...arr);
  });
  if (!coords.length) return null;
  const lats = coords.map(c => c[1]);
  const lngs = coords.map(c => c[0]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ];
}

// Compute dx, dy (in meters) needed to move current bounds → target bounds (align SW corners)
function computeShift(current, target) {
  const [curLat, curLng] = current[0];
  const [tgtLat, tgtLng] = target[0];
  const dLat = tgtLat - curLat;
  const dLng = tgtLng - curLng;
  const metersY = dLat * 111320;
  const metersX = dLng * 111320 * Math.cos(curLat * Math.PI / 180);
  return { dx: metersX, dy: metersY };
}

// Middleware: Hash Password and Calculate Status before Save
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    const { endDate, daysRemaining, status } = calculateDatesAndStatus(
      this.startDate,
      this.subscriptionType
    );
    this.endDate = endDate;
    this.daysRemaining = daysRemaining;
    this.status = status;
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

// --------------------------------------------------------------------------------
// Authentication / Authorization Middleware
// --------------------------------------------------------------------------------

const isAuthenticated = async (req, res, next) => {
  const token = req.cookies.authToken;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });

  jwt.verify(token, SECRET_KEY, async (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });

    try {
      const user = await User.findOne({ userId: decoded.userId });
      if (!user) return res.status(404).json({ message: 'User not found' });

      const { status } = calculateDatesAndStatus(
        user.startDate,
        user.subscriptionType
      );
      if (status === 'Inactive') {
        res.clearCookie('authToken');
        return res.status(403).json({ message: 'Subscription Expired' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Error in isAuthenticated middleware:', error.message);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admins only' });
  }
  next();
};

const isSelfOrAdmin = (req, res, next) => {
  if (req.user.userType === 'admin' || req.user.userId === req.params.userId) {
    return next();
  }
  res.status(403).json({ message: 'Forbidden' });
};

// --------------------------------------------------------------------------------
// Public & User Routes
// --------------------------------------------------------------------------------

// GET dynamic GeoJSON from MongoDB
app.get('/api/geojson/:tehsil/:mauza', async (req, res) => {
  const { tehsil, mauza } = req.params;
  const reqTime = new Date().toISOString();
  console.log(`[${reqTime}] GeoJSON fetch requested: tehsil="${tehsil}", mauza="${mauza}"`);

  try {
    const doc = await GeoJson.findOne({ tehsil, mauza });
    if (!doc) {
      console.log(`[${reqTime}] GeoJSON NOT FOUND for: "${tehsil}/${mauza}"`);
      return res.status(404).json({ message: 'GeoJSON not found' });
    }

    const featuresCount = Array.isArray(doc.data.features)
      ? doc.data.features.length
      : 0;
    console.log(
      `[${reqTime}] GeoJSON FOUND for: "${tehsil}/${mauza}". Features: ${featuresCount}`
    );
    res.json(doc.data);
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Error fetching GeoJSON for "${tehsil}/${mauza}":`,
      err
    );
    res.status(500).json({ message: 'Server error' });
  }
});

// User login
app.post('/login', async (req, res) => {
    const { userId, password } = req.body;

  try {
    // 1) Lookup user
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(401).json({ message: 'Invalid user ID or password.' });
    }

    // 2) Check subscription
    const { status, endDate, daysRemaining } = calculateDatesAndStatus(
      user.startDate,
      user.subscriptionType
    );
    if (status === 'Inactive') {
      return res.status(403).json({
        message: 'Subscription Expired',
        userDetails: {
          userName:     user.userName,
          startDate:    user.startDate,
          endDate,
          daysRemaining
        }
      });
    }

    // 3) Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid user ID or password.' });
    }

    // 4) Sign a 30-day JWT
    const token = jwt.sign({ userId: user.userId }, SECRET_KEY, { expiresIn: '30d' });

    // 5) Prune old sessions & add this one
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    user.sessions = user.sessions.filter(s => s.start.getTime() >= cutoff);
    user.sessions.push({ start: new Date(), ipAddress: req.ip });
    user.lastActive = new Date();
    await user.save();

    // 6) Set cookie & return success
    return res
      .cookie('authToken', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:   30 * 24 * 60 * 60 * 1000
      })
      .json({ message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Admin: login as another user
app.post('/admin/login-as/:userId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const target = await User.findOne({ userId: req.params.userId });
    if (!target) return res.status(404).json({ message: 'User not found' });

    const adminToken = req.cookies.authToken;
    const token = jwt.sign({ userId: target.userId }, SECRET_KEY, { expiresIn: '30d' });

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    target.sessions = target.sessions.filter(s => s.start.getTime() >= cutoff);
    target.sessions.push({ start: new Date(), ipAddress: req.ip });
    target.lastActive = new Date();
    await target.save();

    res
      .cookie('authToken', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:   30 * 24 * 60 * 60 * 1000
      })
      .cookie('adminAuthToken', adminToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:   30 * 24 * 60 * 60 * 1000
      })
      .json({ message: 'Impersonation successful' });
  } catch (err) {
    console.error('login-as error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public: Check if a userId exists (for Forgot Password flow)
app.get('/api/public/check-userid/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.json({ exists: false });

    const exists = await User.exists({ userId });
    res.json({ exists: !!exists });
  } catch (error) {
    console.error('check-userid error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// Forgot password (sends link)
app.post('/forgot-password', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'User ID is required' });

  try {
    const user = await User.findOne({ userId });
    if (!user || !user.email) {
      // Always respond success to avoid user enumeration
      return res.json({ message: 'If this user exists, a reset link has been sent.' });
    }

    // Generate a reset token (valid 1 hour)
    const resetToken = jwt.sign({ userId: user.userId }, SECRET_KEY, { expiresIn: '1h' });

    // Construct front-end link
    const resetLink = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`;

    // Email setup
    let transporter = nodemailer.createTransport({
      host: 'smtp.stackmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Naqsha Zameen" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Reset your password',
      html: `
        <p>Dear ${user.userName},</p>
        <p>To reset your password, click below (valid for 1 hour):</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>If you did not request this, please ignore.</p>
      `
    });

res.json({ message: 'If this user exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset email.' });
  }
});

// Password reset request (via token stored in DB)
app.post('/api/auth/request-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required.' });

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'No user with this email.' });

  // Generate token & expiry
  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
  await user.save();

  // Construct front-end link
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Reset your password',
    html: `<p>Click the link below to reset (valid 1h):<br>
           <a href="${resetLink}">${resetLink}</a></p>`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Password reset link sent. Check your email.' });
  } catch (err) {
    console.error('Reset email error:', err);
    res.status(500).json({ message: 'Failed to send email.' });
  }
});

// Perform password reset
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Invalid request.' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ userId: decoded.userId });
    if (!user) return res.status(400).json({ message: 'Invalid token/user.' });

    user.password = password; // Will be hashed in pre-save
    await user.save();
    res.json({ message: 'Password reset successful. You may now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(400).json({ message: 'Token invalid or expired.' });
  }
});

// Logout
app.post('/logout', isAuthenticated, async (req, res) => {  
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (user) {
      if (user.sessions.length) {
        const lastSession = user.sessions[user.sessions.length - 1];
        if (!lastSession.end) {
          lastSession.end = new Date();
          lastSession.duration = Math.ceil((lastSession.end - lastSession.start) / 1000);
        }
      }
      user.lastActive = null;
      await user.save();
    }
  } catch (error) {
    console.error('Logout session error:', error);
  } finally {
    const adminToken = req.cookies.adminAuthToken;
    if (adminToken) {
      res
        .clearCookie('adminAuthToken', { httpOnly: true, path: '/' })
        .cookie('authToken', adminToken, {
          httpOnly: true,
          secure:   process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge:   30 * 24 * 60 * 60 * 1000
        })
        .json({ message: 'Logout successful', adminRestored: true });
    } else {
      res.clearCookie('authToken', { httpOnly: true, path: '/' })
         .json({ message: 'Logout successful' });
    }
  }
});

// Register (open endpoint)
app.post('/register', async (req, res) => {
  try {
    const { password, ...userData } = req.body;
    const newUser = new User({
      ...userData,
      password,
      mauzaList: req.body.mauzaList.map((m) => m.trim()),
    });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Registration failed:', error.message);
    res.status(400).json({ error: 'Registration failed', details: error.message });
  }
});

// Renewal
app.post('/users/:userId/renew', isAuthenticated, async (req, res) => {
  try {
    const { subscriptionType } = req.body;
    const now = new Date();
        const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.renewalHistory.push({ date: now, type: subscriptionType });
    user.renewalCount++;
    user.startDate = now;
    user.subscriptionType = subscriptionType;
    const { endDate, daysRemaining, status } = calculateDatesAndStatus(now, subscriptionType);
    user.endDate = endDate;
    user.daysRemaining = daysRemaining;
    user.status = status;
    await user.save();

    res.json({ message: 'Subscription renewed', user });
  } catch (error) {
    console.error('Renewal error:', error);
    res.status(500).json({ message: 'Failed to renew subscription' });
  }
});

// Change Password (authenticated)
app.post('/change-password', isAuthenticated, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect old password.' });

    user.password = newPassword;
    await user.save();
    res.clearCookie('authToken', { httpOnly: true, path: '/' })
       .status(200)
       .json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error('Password change error:', error.message);
    res.status(500).json({ message: 'Failed to change password.' });
  }
});

// Profile
app.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    console.error('Failed to fetch profile:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Heartbeat – update user's last active timestamp
app.post('/heartbeat', isAuthenticated, async (req, res) => {
  try {
    await User.updateOne(
      { userId: req.user.userId },
      { lastActive: new Date() }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Heartbeat error', err);
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
});

// --------------------------------------------------------------------------------
// Admin / Protected CRUD Routes
// --------------------------------------------------------------------------------

app.get('/api/users/search', isAuthenticated, isAdmin, async (req, res) => {
  const query = req.query.query?.toLowerCase() || '';
  if (!query) return res.json([]);
  try {
    const users = await User.find({
      $or: [
        { userId:   { $regex: query, $options: 'i' } },
        { userName: { $regex: query, $options: 'i' } }
      ]
    }).limit(15).select('userId userName -_id');
    res.json(users);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json([]);
  }
});

app.get('/api/tehsil-list', async (req, res) => {
  const fsP = require('fs/promises');
  try {
    const [dbTehsils, geoDirs, tileDirs] = await Promise.all([
      GeoJson.distinct('tehsil').catch(() => []),
      fsP.readdir(GEO_ROOT,  { withFileTypes: true }).catch(() => []),
      fsP.readdir(TILE_ROOT, { withFileTypes: true }).catch(() => [])
    ]);

    const geoNames  = geoDirs
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const tileNames = tileDirs
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const names = new Set([...dbTehsils, ...geoNames, ...tileNames]);

    res.json([...names].sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    console.error('tehsil-list error:', err);
    res.status(500).json([]);
  }
});

// GET all users (admin only)
app.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET user by ID (self or admin)
app.get('/users/:userId', isAuthenticated, isSelfOrAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error.message);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// UPDATE user (self or admin)
app.put('/users/:userId', isAuthenticated, isSelfOrAdmin, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (!updateData.password || !updateData.password.trim()) {
      delete updateData.password;
    }

    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (
      req.user.userType !== 'admin' &&
      'email' in updateData &&
      user.email &&
      updateData.email !== user.email
    ) {
      return res.status(403).json({ message: 'Email can only be changed by an admin' });
    }

    let isRenewal = false;
    if (
      (updateData.subscriptionType && updateData.subscriptionType !== user.subscriptionType) ||
      (updateData.startDate &&
        new Date(updateData.startDate).getTime() !== new Date(user.startDate).getTime())
    ) {
      isRenewal = true;
    }

    Object.assign(user, updateData);

    if (isRenewal) {
      user.renewalHistory.push({
        date: new Date(),
        type: user.subscriptionType
      });
      user.renewalCount = (user.renewalCount || 0) + 1;
    }

    await user.save();
    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Failed to update user:', error.message);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE user (admin only)
app.delete('/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: 'User deleted successfully!' });
  } catch (error) {
    console.error('Failed to delete user:', error.message);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Stats (public)
app.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeCutoff = new Date(Date.now() - 2 * 60 * 1000);
    const totalOnline = await User.countDocuments({ lastActive: { $gte: activeCutoff } });
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessions = await User.aggregate([
      { $unwind: '$sessions' },
      { $match: { 'sessions.start': { $gte: cutoff } } },
      { $project: { start: '$sessions.start', end: '$sessions.end' } }
    ]);
    res.json({ totalUsers, totalOnline, sessions });
  } catch (err) {
    console.error('Stats error', err);
    res.status(500).json({ error: 'Unable to fetch statistics' });
  }
});

/* ------------------------------------------------------------------
   FULL mauza list = geojson names ∪ folder names
------------------------------------------------------------------ */
app.get('/api/mauza-list/:tehsil', async (req, res) => {
  const fsP = require('fs/promises');
  const tehsil = req.params.tehsil.trim();

  const geoDir  = path.resolve(GEO_ROOT,  tehsil);
  const tileDir = path.resolve(TILE_ROOT, tehsil);

  try {
    const [geoFiles, tileDirents] = await Promise.all([
      fsP.readdir(geoDir).catch(() => []),
      fsP.readdir(tileDir, { withFileTypes: true }).catch(() => [])
    ]);

    const geoNames  = geoFiles
      .filter(f => f.toLowerCase().endsWith('.geojson'))
      .map(f => path.parse(f).name);

    const tileNames = tileDirents
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const names = new Set([...geoNames, ...tileNames]);

    console.log('[mauza-list]', tehsil,
                'geo:', geoNames.length,
                'tiles:', tileNames.length,
                'total:', names.size);

    res.json([...names].sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    console.error('mauza-list error:', err);
    res.json([]);   // fail soft
  }
});

/* ------------------------------------------------------------------
   LIVE list of users whose last session has no `end` timestamp
------------------------------------------------------------------ */
app.get('/online-users', isAuthenticated, async (_req, res) => {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const users  = await User.find({ lastActive: { $gte: cutoff } });

    const list = users.map(u => {
      const last = u.sessions[u.sessions.length - 1] || {};
      return {
        userName:         u.userName,
        userId:           u.userId,
        tehsil:           u.tehsil,
        subscriptionType: u.subscriptionType,
        ipAddress:        last.ipAddress,
        start:            last.start,
        lastActive:       u.lastActive
      };
    }).sort((a, b) => (b.start || 0) - (a.start || 0));

    res.json(list);
  } catch (err) {
    console.error('online-users error', err);
    res.status(500).json({ error: 'Unable to fetch online users' });
  }
});

// POST: Shift GeoJSON
app.post('/api/geojson/:tehsil/:mauza/shift', isAuthenticated, async (req, res) => {
  const { tehsil, mauza } = req.params;
  const { distance, direction } = req.body;
  const meters = parseFloat(distance) * FEET_TO_METERS;

  let dx = 0, dy = 0;
  if (direction === 'East')  dx = meters;
  if (direction === 'West')  dx = -meters;
  if (direction === 'North') dy = meters;
  if (direction === 'South') dy = -meters;

  const doc = await GeoJson.findOne({ tehsil, mauza });
  if (!doc) return res.status(404).json({ message: 'GeoJSON not found' });

  // Save defaultBounds if missing
  if (!doc.defaultBounds) {
    const bounds = getGeoJsonBounds(doc.data.features);
    if (!bounds) return res.status(400).json({ message: 'No geometry found' });
    doc.defaultBounds = bounds;
  }

  // Shift each feature’s coordinates in place
  doc.data.features.forEach((f) => {
    f.geometry.coordinates = shiftCoordinates(f.geometry.coordinates, dx, dy);
  });

  // ← Mark the Mixed field as modified before saving
  doc.markModified('data');

  await doc.save();

  console.log(
    `[${new Date().toISOString()}] Shifted GeoJSON stored back to DB for ${tehsil}/${mauza}`
  );
  res.json({ success: true, data: doc.data });
});

// POST: Reset GeoJSON to Default Bounds
app.post('/api/geojson/:tehsil/:mauza/reset', isAuthenticated, async (req, res) => {
    const { tehsil, mauza } = req.params;
  const doc = await GeoJson.findOne({ tehsil, mauza });
  if (!doc || !doc.defaultBounds) return res.status(400).json({ message: 'No default bounds set' });

  const currentBounds = getGeoJsonBounds(doc.data.features);
  if (!currentBounds) return res.status(400).json({ message: 'No geometry found' });

  const { dx, dy } = computeShift(currentBounds, doc.defaultBounds);

  // Shift back
  doc.data.features.forEach(f => {
    f.geometry.coordinates = shiftCoordinates(f.geometry.coordinates, dx, dy);
  });

  // ← Mark the Mixed field as modified before saving
  doc.markModified('data');

await doc.save();
  res.json({ success: true, data: doc.data });
});

/* ------------------------------------------------------------------
   User Layer Routes
------------------------------------------------------------------ */
// Create new layer (max 10 per user)
app.post('/api/user-layers', isAuthenticated, async (req, res) => {
  const { name, geojson } = req.body;
  if (!name || !geojson) return res.status(400).json({ message: 'Name and geojson required' });

  const count = await UserLayer.countDocuments({ userId: req.user._id });
  if (count >= 10) return res.status(400).json({ message: 'Layer limit reached' });

  const layer = new UserLayer({
    userId: req.user._id,
    name,
    geojson
  });

  await layer.save();
  res.status(201).json(layer);
});

// List layers for logged-in user
app.get('/api/user-layers', isAuthenticated, async (req, res) => {
  const layers = await UserLayer.find({ userId: req.user._id }).sort('-updatedAt');
  res.json(layers);
});

// Update a layer
app.put('/api/user-layers/:id', isAuthenticated, async (req, res) => {
  const { name, geojson } = req.body;
  const layer = await UserLayer.findOne({ _id: req.params.id, userId: req.user._id });
  if (!layer) return res.status(404).json({ message: 'Layer not found' });
  if (name !== undefined) layer.name = name;
  if (geojson !== undefined) layer.geojson = geojson;
  layer.updatedAt = new Date();
  await layer.save();
  res.json(layer);
});

// Delete a layer
app.delete('/api/user-layers/:id', isAuthenticated, async (req, res) => {
  const layer = await UserLayer.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!layer) return res.status(404).json({ message: 'Layer not found' });
  res.json({ success: true });
});
/* ------------------------------------------------------------------
   Land Record Routes
------------------------------------------------------------------ */

// List available tehsils
app.get('/api/landrecords/tehsils', isAuthenticated, async (_req, res) => {
  try {
    const tehsils = await LandRecord.distinct('tehsil');
    res.json(tehsils.sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    console.error('landrecords/tehsils error:', err);
    res.status(500).json({ error: 'Unable to fetch tehsils' });
  }
});

// List mauzas for a tehsil
app.get('/api/landrecords/mauzas/:tehsil', isAuthenticated, async (req, res) => {
  try {
    const mauzas = await LandRecord.distinct('mouza', { tehsil: req.params.tehsil });
    res.json(mauzas.sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    console.error('landrecords/mauzas error:', err);
    res.status(500).json({ error: 'Unable to fetch mauzas' });
  }
});

// List khewats for a mauza
app.get('/api/landrecords/khewats/:tehsil/:mauza', isAuthenticated, async (req, res) => {
  const { tehsil, mauza } = req.params;
  try {
    const recs = await LandRecord.find({ tehsil, mauza }).select('khewatId khewatNo -_id').sort('khewatNo');
    res.json(recs);
  } catch (err) {
    console.error('landrecords/khewats error:', err);
    res.status(500).json({ error: 'Unable to fetch khewats' });
  }
});

// Full details for a khewat
app.get('/api/landrecords/details/:khewatId', isAuthenticated, async (req, res) => {
  const khewatId = parseInt(req.params.khewatId, 10);
  try {
    const rec = await LandRecord.findOne({ khewatId });
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    res.json(rec);
  } catch (err) {
    console.error('landrecords/details error:', err);
    res.status(500).json({ error: 'Unable to fetch record' });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

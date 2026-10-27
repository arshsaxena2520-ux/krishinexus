const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();

// ==========================================
// 1. MIDDLEWARE CONFIGURATION
// ==========================================
app.use(express.json());
app.use(cors());

// ==========================================
// 2. MONGOOSE DATABASE SCHEMAS & MODELS
// ==========================================

// User Schema (Farmers & Laborers)
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  role: { type: String, enum: ['farmer', 'labour'], default: 'farmer' },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// OTP Schema (Auto-expires in 5 minutes via TTL index)
const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } // 300 seconds = 5 mins
});

const Otp = mongoose.model('Otp', otpSchema);

// ==========================================
// 3. DATABASE CONNECTION
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/krishi_nexus';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// 4. API ROUTES
// ==========================================

// Healthcheck Route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Krishi Nexus Backend API is running smoothly.' });
});

/**
 * @route   POST /api/auth/send-otp
 * @desc    Generate a 6-digit OTP and dispatch via Fast2SMS
 */
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    }

    if (!process.env.FAST2SMS_API_KEY) {
      return res.status(503).json({ success: false, message: 'SMS service is not configured' });
    }

    // Generate random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove old active OTPs for this phone number
    await Otp.deleteMany({ phone });

    // Store new OTP record
    await Otp.create({ phone, otp: generatedOtp });

    // Send SMS via Fast2SMS API (Replace route or API parameters if using another provider)
    let smsResponse = null;
    if (process.env.FAST2SMS_API_KEY) {
      const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: process.env.FAST2SMS_API_KEY,
          variables_values: generatedOtp,
          route: 'otp',
          numbers: phone
        }
      });
      smsResponse = response.data;
    } else {
      console.log(`[DEV MODE] OTP for ${phone} is: ${generatedOtp}`);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP generated and sent successfully',
      smsResponse
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
  }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP, register/login user, and return JWT Token
 */
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp, fullName, role } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
    }

    // Verify OTP record
    const validOtp = await Otp.findOne({ phone, otp });
    if (!validOtp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Fetch existing user or create a new user profile
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        fullName: fullName || 'Krishi User',
        phone,
        role: role || 'farmer',
        isVerified: true
      });
    } else {
      user.isVerified = true;
      await user.save();
    }

    // Delete used OTP
    await Otp.deleteOne({ _id: validOtp._id });

    // Generate JWT Access Token
    const token = jwt.sign(
      { userId: user._id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token,
      user
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Authentication failed', error: error.message });
  }
});

// ==========================================
// 5. SERVER INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Krishi Nexus server running on port ${PORT}`);
});

const twilio = require("twilio");

function getClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    const error = new Error("OTP service is not configured.");
    error.statusCode = 500;
    throw error;
  }
  return {
    client: twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
    serviceSid: TWILIO_VERIFY_SERVICE_SID
  };
}

function isValidPhone(phone) {
  return typeof phone === "string" && /^\+[1-9]\d{7,14}$/.test(phone);
}

function sendMethodError(res) {
  res.setHeader("Allow", "POST");
  return res.status(405).json({ success: false, message: "Method not allowed." });
}

function tooManyRequests(res) {
  res.setHeader("Retry-After", "60");
  return res.status(429).json({
    success: false,
    message: "Too many requests. Please wait before trying again."
  });
}

module.exports = { getClient, isValidPhone, sendMethodError, tooManyRequests };
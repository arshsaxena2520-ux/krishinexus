const { getClient, isValidPhone, sendMethodError } = require("../../lib/otp/shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendMethodError(res);

  const body = req.body || {};
  const phone = body.phone;
  const code = body.code;

  if (!isValidPhone(phone) || typeof code !== "string" || !/^\d{4,10}$/.test(code)) {
    return res.status(400).json({
      success: false,
      verified: false,
      message: "Enter a valid phone number and OTP."
    });
  }

  try {
    const { client, serviceSid } = getClient();
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: phone, code });

    if (check.status === "approved") {
      return res.status(200).json({
        success: true,
        verified: true,
        message: "Phone number verified."
      });
    }

    return res.status(400).json({
      success: false,
      verified: false,
      message: "Incorrect or expired OTP. Please try again."
    });
  } catch (error) {
    console.error("OTP verification failed:", error.statusCode || error.code || "provider_error");
    const status = error.statusCode === 500 ? 500 : 400;
    return res.status(status).json({
      success: false,
      verified: false,
      message: status === 500
        ? "OTP service is not configured. Check server environment variables."
        : "OTP verification failed or the code has expired."
    });
  }
};

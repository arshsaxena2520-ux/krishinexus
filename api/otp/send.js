const { getClient, isValidPhone, sendMethodError } = require("../../lib/otp/shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendMethodError(res);

  const phone = req.body && req.body.phone;
  if (!isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid phone number with country code, e.g. +919876543210."
    });
  }

  try {
    const { client, serviceSid } = getClient();
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({ to: phone, channel: "sms" });

    return res.status(200).json({
      success: true,
      status: verification.status,
      message: "If the SMS request was accepted, your OTP should arrive shortly."
    });
  } catch (error) {
    console.error("OTP send failed:", error.statusCode || error.code || "provider_error");
    const status = error.statusCode === 500 ? 500 : 502;
    return res.status(status).json({
      success: false,
      message: status === 500
        ? "OTP service is not configured. Check server environment variables."
        : "Could not send the OTP. Check the number and try again later."
    });
  }
};

const nodemailer = require("nodemailer");

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  await mailer.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Đặt lại mật khẩu",
    text: `Chào ${name},\n\nMở link sau để đặt lại mật khẩu: ${resetUrl}\n\nLink hết hạn sau 15 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `<p>Chào ${name},</p><p>Nhấn vào link sau để đặt lại mật khẩu:</p><p><a href="${resetUrl}">Đặt lại mật khẩu</a></p><p>Link hết hạn sau 15 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  });
};

module.exports = { mailer, sendPasswordResetEmail };

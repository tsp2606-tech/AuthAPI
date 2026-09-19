const admin = require("firebase-admin");

let firebaseAdmin = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    // Tự động bổ sung dấu ngoặc nhọn nếu copy thiếu
    if (!raw.startsWith("{")) raw = "{" + raw;
    if (!raw.endsWith("}")) raw = raw + "}";

    const serviceAccount = JSON.parse(raw);

    // Đảm bảo ký tự xuống dòng trong private_key hợp lệ
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }

    firebaseAdmin = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
    console.log("[Firebase Admin] Khởi tạo thành công!");
  } else {
    console.warn("[Firebase Warning] Thiếu biến môi trường FIREBASE_SERVICE_ACCOUNT.");
  }
} catch (error) {
  console.error("[Firebase Error] Không thể khởi tạo Firebase Admin:", error.message);
}

module.exports = firebaseAdmin;
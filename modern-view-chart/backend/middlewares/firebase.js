import firebaseAdmin from "firebase-admin";
import multer from "multer";
import path from "path";

const serviceAccount = require("../serviceAccountKey.json");

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  storageBucket: "big-project-12152.appspot.com",
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const uploadImageToFirebase = async (req, res) => {
  try {
    // Lấy file từ request
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const bucket = firebaseAdmin.storage().bucket();

    const fileName = `${Date.now()}-${file.originalname}`;
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
      contentType: file.mimetype,
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;

    res.status(200).json({ success: true, imageUrl: publicUrl });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error uploading image", error });
  }
};

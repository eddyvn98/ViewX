import multer from "multer";
import path from "path";

// Tạo nơi lưu ảnh
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // thư mục uploads/
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext); // tên file mới
  },
});

export const upload = multer({ storage });

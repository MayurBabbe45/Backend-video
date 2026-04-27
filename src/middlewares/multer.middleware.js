import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), "public", "temp"));
  },
  filename: function (req, file, cb) {
    // 1. Create a unique suffix using the current timestamp and a random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    // 2. Extract the original file extension (e.g., .mp4, .jpg)
    const extension = path.extname(file.originalname);
    
    // 3. Combine them to guarantee a completely unique filename
    // Result looks like: videoFile-1678901234567-123456789.mp4
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  },
});

export const upload = multer({ 
    storage,
    limits: {
        // Limit file size to 100MB to protect your server
        // Adjust this number based on your platform's needs
        fileSize: 100 * 1024 * 1024 
    }
});
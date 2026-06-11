import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            type: "authenticated" // 🚨 THE MAGIC WORD: Locks the file in the CDN Vault
        });

        // Safely delete the local file
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath); 
        }
        
        // 🚨 IMPORTANT: The backend MUST save response.public_id to the database!
        return response;
        
    } catch (error) {
        console.error("🔥 CLOUDINARY UPLOAD ERROR DETAILS:", error);
        
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath); 
        }
        return null;
    }
}

// 🚨 UPDATED: Now accepts the exact publicId instead of trying to parse a secure URL
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    try {
        if (!publicId) return null;
        
        // Pass the exact public_id and resource_type
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            type: "authenticated" // Tell Cloudinary we are deleting an authenticated file
        });

        return response;
    } catch (error) {
        console.log("Error deleting from cloudinary:", error);
        return null;
    }
}

export { uploadOnCloudinary, deleteFromCloudinary }
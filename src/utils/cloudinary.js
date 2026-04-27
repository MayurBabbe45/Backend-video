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
            resource_type: "auto"
        });

        fs.unlinkSync(localFilePath); 
        return response;
        
    } catch (error) {
        fs.unlinkSync(localFilePath); 
        return null;
    }
}

// Added resourceType parameter with a default of "image"
const deleteFromCloudinary = async (fileUrl, resourceType = "image") => {
    try {
        if (!fileUrl) return null;
        
        // 1. Split the URL to isolate the part after "/upload/"
        const parts = fileUrl.split("/upload/");
        if (parts.length < 2) {
            console.error("Invalid Cloudinary URL format");
            return null; 
        }
        
        let pathAfterUpload = parts[1];
        
        // 2. Remove the version number (e.g., "v1623456789/") if it exists
        if (pathAfterUpload.match(/^v\d+\//)) {
            pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");
        }

        // 3. Remove the file extension (e.g., ".mp4", ".jpg")
        const publicId = pathAfterUpload.substring(0, pathAfterUpload.lastIndexOf('.'));
        
        // 4. Pass the exact resource_type (crucial for videos)
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });

        return response;
    } catch (error) {
        console.log("Error deleting from cloudinary:", error);
        return null;
    }
}

export { uploadOnCloudinary, deleteFromCloudinary }
import  {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath)=>{
    try{
        if(!localFilePath)return null;

        //upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })

        //file has been uploaded successfully
        // console.log("file is uploaded on cloudinary ",response.url);
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file
        return response;
        
    }catch(error){
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}

const deleteFromCloudinary = async (fileUrl) => {
    try {
        if(!fileUrl) return null;
        
        // Extract public_id from cloudinary URL
        // URL format: https://res.cloudinary.com/cloud_name/image/upload/public_id.format
        const urlParts = fileUrl.split('/')
        const fileNameWithExtension = urlParts[urlParts.length - 1]
        const publicId = fileNameWithExtension.split('.')[0]
        
        const response = await cloudinary.uploader.destroy(publicId)
        return response
    } catch(error) {
        console.log("Error deleting from cloudinary:", error)
        return null
    }
}

export {uploadOnCloudinary, deleteFromCloudinary}
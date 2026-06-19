import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async(req,_,next)=>{
  try {
      const authHeader = req.header("Authorization")
      const token = req.cookies?.accessToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)
  
      if(!token){
          throw new ApiError(401,"Unauthorized request");
      }

      let decodedToken;
      try {
          decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET)
      } catch (jwtError) {
          throw new ApiError(401, "Invalid or expired token")
      }
  
      const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
  
      if(!user){
          throw new ApiError(401,"Invalid Access Token");
      }
  
      req.user = user;
      next();
  } catch (error) {
    throw new ApiError(401,error?.message)
  }
}) 

export const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        // verifyJWT runs first, so req.user is already securely populated
        if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
            throw new ApiError(
                403, 
                "Access Denied: Your account role does not have permission to perform this action."
            );
        }
        
        // If they have the correct role, let them through!
        next();
    };
};
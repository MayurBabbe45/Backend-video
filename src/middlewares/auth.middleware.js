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
          decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
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
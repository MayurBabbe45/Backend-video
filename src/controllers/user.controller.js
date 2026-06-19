import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from "../utils/ApiError.js";
import  User  from "../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { InviteToken } from "../models/invite.model.js";
import { Membership } from "../models/membership.model.js";

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async(req, res) => {
    // 🚨 Extract role AND inviteToken from the request body
    const { fullName, email, username, password, role, inviteToken } = req.body;
  
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    let coverImageLocalPath;
    
    if (req.files && req.files.coverImage && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "MULTER ERROR: Avatar file is required but was not received by the server.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    let coverImage = null;
    
    if (coverImageLocalPath) {
        coverImage = await uploadOnCloudinary(coverImageLocalPath);
    }

    if (!avatar) {
        throw new ApiError(400, "CLOUDINARY ERROR: Failed to upload the avatar image to the cloud.");
    }

    // Save the user and their role to the database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
        role: role || "EMPLOYEE" // Default to EMPLOYEE if they don't explicitly pass BUSINESS
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    // ================================================================
    // 🚨 THE MAGIC LINK INTERCEPTOR
    // ================================================================
    // If an employee registers using a valid 48-hour invite link, 
    // instantly grant them full corporate access to the Business's vault.
    if (inviteToken && createdUser.role === "EMPLOYEE") {
        const activeInvite = await InviteToken.findOne({ 
            token: inviteToken,
            expiresAt: { $gt: new Date() } // Double check time just in case of MongoDB TTL lag
        });

        if (activeInvite) {
            await Membership.create({
                business: activeInvite.business,
                employee: createdUser._id,
                status: "APPROVED"
            });
        }
    }
    // ================================================================

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

const loginUser = asyncHandler(async(req, res) => {
    

    //req body -> data
    //username or email
    //find the user 
    //password check 
    //access and refresh token 
    //send cookies (including access and refresh token)

    const {email , username , password} = req.body;

    if(!email && !username){
        throw new ApiError(400,"Username or email is required");
    }

    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials");
    }

    const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly : true,
        secure: true,
        sameSite: "none"
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged In Successfully"
        )
    )


})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(req.user._id,
        {
            $unset: {refreshToken: 1}//this will remove the refresh token from the user document in the database.
        },
        {new:true}
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User logged out successfully")
    )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
   const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken

   if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorized request");
   }

   try {
    const decodedToken = jwt.verify(
     incomingRefreshToken,
     process.env.REFRESH_TOKEN_SECRET
    )
 
    const user = await User.findById(decodedToken?._id)
 
    if(!user){
     throw new ApiError(401,"invalid refresh token");
    }
 
    if(incomingRefreshToken !== user?.refreshToken){
     throw new ApiError(401,"refresh token is expired or used");
    }
 
    const options = {
     httpOnly:true,
     secure:true
    }
 
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)
 
    return res
    .status(200)
    .cookie("accessToken", accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
     new ApiResponse(
         200,
         {accessToken,refreshToken},
         "Access token refreshed"
     )
    )
   } catch (error) {
    throw new ApiError(401,error?.message||"Invalid refresh token");
   }

})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    
    const{ oldPassword, newPassword}= req.body;
    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password");
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"Current user details fetched successfully"));
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName, email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar File is missing")
    }

    // Fetch current user to get old avatar URL
    const currentUser = await User.findById(req.user?._id);
    
    // Delete old avatar from cloudinary if it exists
    if(currentUser?.avatar){
        await deleteFromCloudinary(currentUser.avatar);
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
         throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        { 
            $set:{
                avatar: avatar.url
            }
        },

        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))


})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover File is missing")
    }

    // Fetch current user to get old cover image URL
    const currentUser = await User.findById(req.user?._id);
    
    // Delete old cover image from cloudinary if it exists
    if(currentUser?.coverImage){
        await deleteFromCloudinary(currentUser.coverImage);
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
         throw new ApiError(400,"Error while uploading on cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,

        { 
            $set:{
                coverImage: coverImage.url
            }
        },

        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover Image updated successfully"))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        // 1. Lookup subscribers (Users who subscribed to this channel)
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        // 2. Lookup channels this user is subscribed to
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        // 3. Calculate counts and the isSubscribed boolean
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { 
                            // Check if logged-in user is in the subscribers array
                            $in: [req.user?._id || null, "$subscribers.subscriber"] 
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        // 4. Project only the necessary fields to the frontend
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                email: 1, // Optional depending on your privacy needs
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1 // 🚨 CRITICAL: The boolean we just calculated!
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist");
    }

    return res.status(200).json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

 const getWatchHistory = asyncHandler(async (req, res) => {
    // 1. Construct the inner pipeline to process each video in the history
    const videoPipeline = [
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        { $unwind: "$owner" }
    ];

    // ============================================================================
    // 🚨 THE ZERO-TRUST BOUNCER (Intercepting Watch History)
    // ============================================================================
    if (req.user.role === "EMPLOYEE") {
        videoPipeline.push({
            $lookup: {
                from: "memberships",
                let: { videoOwnerId: "$owner._id" }, // Check the populated owner's ID
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$business", "$$videoOwnerId"] },
                                    { $eq: ["$employee", new mongoose.Types.ObjectId(req.user._id)] },
                                    { $eq: ["$status", "APPROVED"] } // Must STILL be approved
                                ]
                            }
                        }
                    }
                ],
                as: "accessRights"
            }
        });

        // Drop the video from the history array if access was revoked
        videoPipeline.push({
            $match: { accessRights: { $ne: [] } }
        });
    } else if (req.user.role === "BUSINESS") {
        // Businesses only see their own internal media in history
        videoPipeline.push({
            $match: { "owner._id": new mongoose.Types.ObjectId(req.user._id) }
        });
    }
    // ============================================================================

    // 2. Add the final formatting to the inner pipeline
    videoPipeline.push({
        $project: {
            title: 1,
            thumbnail: 1,
            duration: 1,
            views: 1,
            createdAt: 1,
            "owner._id": 1,
            "owner.username": 1,
            "owner.fullName": 1,
            "owner.avatar": 1
        }
    });

    // 3. Run the main aggregation
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: videoPipeline // 🚨 Apply the secure sub-pipeline here!
            }
        }
    ]);

    if (!user?.length) {
        throw new ApiError(404, "User not found");
    }

    const history = user[0].watchHistory.reverse();

    return res.status(200).json(
        new ApiResponse(200, history, "Secure watch history fetched successfully")
    );
});

 const clearWatchHistory = asyncHandler(async (req, res) => {
    // Simply set the watchHistory array back to empty!
    await User.findByIdAndUpdate(req.user._id, {
        $set: { watchHistory: [] }
    });

    return res.status(200).json(
        new ApiResponse(200, {}, "Watch history cleared successfully")
    );
});

const searchBusinesses = asyncHandler(async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(200).json(new ApiResponse(200, [], "No query provided"));
    }

    // Use aggregation to find businesses AND check the user's membership status with them
    const businesses = await User.aggregate([
        {
            $match: {
                role: "BUSINESS",
                $or: [
                    { username: { $regex: query, $options: "i" } },
                    { fullName: { $regex: query, $options: "i" } }
                ]
            }
        },
        {
            $lookup: {
                from: "memberships",
                let: { businessId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$business", "$$businessId"] },
                                    { $eq: ["$employee", new mongoose.Types.ObjectId(req.user._id)] }
                                ]
                            }
                        }
                    }
                ],
                as: "membershipData"
            }
        },
        {
            $addFields: {
                // Extract the status if a membership exists, otherwise set to "NONE"
                membershipStatus: {
                    $cond: {
                        if: { $gt: [{ $size: "$membershipData" }, 0] },
                        then: { $arrayElemAt: ["$membershipData.status", 0] },
                        else: "NONE"
                    }
                }
            }
        },
        {
            $project: {
                _id: 1,
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                membershipStatus: 1 // 🚨 Now the frontend knows the exact status!
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, businesses, "Businesses retrieved successfully")
    );
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
    clearWatchHistory,
    searchBusinesses
}

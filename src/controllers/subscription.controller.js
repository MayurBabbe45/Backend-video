export const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!mongoose.isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const subscribers = await Subscription.aggregate([
        // 1. Find all subscriptions where the 'channel' matches the ID
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        // 2. Look up the user details for the 'subscriber'
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriberDetails"
            }
        },
        {
            $unwind: "$subscriberDetails"
        },
        // 3. Keep only the safe data
        {
            $project: {
                _id: 1,
                "subscriberDetails._id": 1,
                "subscriberDetails.username": 1,
                "subscriberDetails.fullName": 1,
                "subscriberDetails.avatar": 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, subscribers, "Subscribers fetched successfully")
    );
});

export const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!mongoose.isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    const subscribedChannels = await Subscription.aggregate([
        // 1. Find all subscriptions where the 'subscriber' matches the ID
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        // 2. Look up the user details for the 'channel'
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channelDetails"
            }
        },
        {
            $unwind: "$channelDetails"
        },
        // 3. Keep only the safe data
        {
            $project: {
                _id: 1,
                "channelDetails._id": 1,
                "channelDetails.username": 1,
                "channelDetails.fullName": 1,
                "channelDetails.avatar": 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, subscribedChannels, "Subscribed channels fetched successfully")
    );
});
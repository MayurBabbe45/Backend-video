import { Schema, Types } from "mongoose";
import mongoose  from "mongoose";

const subscriptionSchema = new Schema({
    subscriber:{
        type: Schema.Types.ObjectId,//One who us subscribing
        ref:"User"
    },
    channel:{
        type: Schema.Types.ObjectId,//One to whom 'subscriber' is subscribing
        ref:"User"
    }
},{timestamps:true})

export const Subscription = mongoose.model("Subscription",subscriptionSchema);

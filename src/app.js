import express from 'express';
import cors from "cors"
import cookieParser from 'cookie-parser';

const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}));

//this means that the server can accept json data with a maximum size of 16kb in the request body.
app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true,limit:"16kb"}));
app.use(express.static("public"));
app.use(cookieParser());


//routes
import userRouter from './routes/user.route.js'

//routes declaration
app.use("/api/v1/users",userRouter);

export { app };
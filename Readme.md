# 🚀 Video Hosting Platform API (MERN Stack)

A complex, highly scalable REST API built with Node.js, Express, and MongoDB. This backend architecture powers a fully functional video hosting platform (similar to YouTube) with advanced features like JWT-based authentication, cloud media uploads, polymorphic relationships, and complex database aggregations.

## 🌟 Key Features

* **Secure Authentication & Authorization:** Custom Access and Refresh token logic using JWT. Passwords are securely hashed using bcrypt.
* **Cloud Media Management:** Seamless integration with Cloudinary and Multer for uploading, storing, and serving video files and image avatars.
* **Polymorphic Database Design:** A highly efficient "Likes" system where a single collection dynamically references Videos, Comments, or Tweets.
* **Complex Aggregation Pipelines:** Advanced MongoDB queries to calculate metrics like total channel views, subscriber counts, and video statistics.
* **Complete Content Management:** Full CRUD operations for Videos, text-based Tweets, user Comments, and custom Playlists.

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB & Mongoose ORM
* **Authentication:** JSON Web Tokens (JWT), bcrypt
* **File Handling:** Multer, Cloudinary API
* **Environment:** dotenv

## 📚 API Documentation

Explore the complete API documentation, including request bodies, parameters, and example responses.

* [Auth & User Management API](https://documenter.getpostman.com/view/26904720/2sBXqKnzM2)
* [Video & Upload API](https://documenter.getpostman.com/view/26904720/2sBXqKnzM3)
* [Comments API](https://documenter.getpostman.com/view/26904720/2sBXqKnzGc)
* [Tweets API](https://documenter.getpostman.com/view/26904720/2sBXqKnzLw)
* [Playlists API](https://documenter.getpostman.com/view/26904720/2sBXqKnzGg)
* [Dashboard Analytics API](https://documenter.getpostman.com/view/26904720/2sBXqKnzGf)

## 🗄️ Database Architecture

This platform utilizes a highly relational MongoDB schema spanning 8 distinct collections:
1. **Users:** Handles channels, watch history, and authentication.
2. **Videos:** Stores video metadata, Cloudinary URLs, and view counts.
3. **Subscriptions:** Manages the follower/following relationships between users.
4. **Likes (Polymorphic):** Connects users to liked Videos, Comments, or Tweets.
5. **Comments:** Nested discussions attached to specific videos.
6. **Tweets:** Text-based posts for the channel's community tab.
7. **Playlists:** Custom user-curated arrays of video references.

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* MongoDB URI (Local or Atlas)
* Cloudinary Account (Free tier)

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/your-repo-name.git](https://github.com/yourusername/your-repo-name.git)
   ```

2. Install dependencies:
   ```bash
   cd your-repo-name
   npm install
   ```

3. Set up your Environment Variables:
   Create a `.env` file in the root directory and add the following credentials:
   ```env
   PORT=8000
   MONGODB_URI=your_mongodb_connection_string
   CORS_ORIGIN=*
   ACCESS_TOKEN_SECRET=your_access_token_secret
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   REFRESH_TOKEN_EXPIRY=10d
   CLOUDINARY_CLOUD_NAME=your_cloudinary_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! 

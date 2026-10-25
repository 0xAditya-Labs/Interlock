# Interlock — Fullstack Real-Time Chat App

> A full-featured real-time chat application built using the MERN stack (MongoDB, Express, React, Node.js) and Socket.io with TailwindCSS and DaisyUI for clean, responsive UI components.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Render-brightgreen?style=for-the-badge&logo=render)](https://interlock-mv9m.onrender.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4-010101?style=for-the-badge&logo=socketdotio)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

---

> 🚀 **Looking for the Distributed Architecture & Redis Scale-Out?**  
> Check out the [`distributed-backend`](https://github.com/0xAditya-Labs/Interlock/tree/distributed-backend) branch for multi-node Redis Pub/Sub clustering, atomic presence tracking, cache-aside history, and the complete performance telemetry report.

---

## 🚀 Live Demo

🔗 **[https://interlock-mv9m.onrender.com/](https://interlock-mv9m.onrender.com/)**

---

## 🚀 Features

* 👥 **User Authentication:** JWT-based user login & registration with Bcrypt password hashing.
* 💬 **Real-Time 1-to-1 Chat:** Instant messaging using Socket.io WebSockets.
* 🟢 **Online Status:** Real-time online/offline presence indicators.
* 🖼️ **Media Sharing:** Image uploads and CDN transformations via Cloudinary.
* 🌈 **Modern Themeable UI:** Clean interface built with TailwindCSS and DaisyUI with 32 selectable themes.
* ⚡ **Global State:** Lightweight state management with Zustand.

---

## 🧠 Tech Stack

### Frontend
* React 18 & Vite
* TailwindCSS & DaisyUI
* Axios
* Zustand
* Socket.io Client

### Backend
* Node.js & Express.js
* MongoDB & Mongoose ODM
* Socket.io v4
* JWT Authentication
* Cloudinary API
* dotenv

---

## 🛠️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/0xAditya-Labs/Interlock.git
cd Interlock
```

### 2. Environment Variables

Create `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/interlock
JWT_SECRET=your_jwt_secret_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Create `frontend/.env`:
```env
VITE_BASE_URL=http://localhost:5000
```

### 3. Install Dependencies & Build

```bash
npm run build
```

This single command installs all dependencies in both `backend/` and `frontend/`, and builds the frontend production bundle via Vite.

---

## 🔄 Running the App (Development Mode)

### Option 1: Run Backend and Frontend Separately

**Backend:**
```bash
npm start
```
*(Runs on `http://localhost:5000`)*

**Frontend:**
```bash
cd frontend
npm run dev
```
*(Runs on `http://localhost:5173`)*

---

### Option 2: Run Both Fullstack in One Command

Run concurrently from the root directory:
```bash
npm run start
```

---

## 📁 Folder Structure

```
Interlock/
├── backend/                   # Node.js + Express API
│   ├── src/
│   │   ├── controllers/       # Auth and message controllers
│   │   ├── models/            # Mongoose schemas (User, Message)
│   │   ├── routes/            # Express REST routes
│   │   ├── middleware/        # JWT auth verification
│   │   └── lib/               # DB, Cloudinary, and Socket.io setup
│   └── .env                   # Backend environment variables
│
├── frontend/                  # React + Vite client
│   ├── src/
│   │   ├── components/        # Chat containers, sidebars, headers
│   │   ├── pages/             # Login, SignUp, Profile, Settings, Home
│   │   └── store/             # Zustand stores (useAuthStore, useChatStore)
│   └── .env                   # Frontend environment variables
│
├── package.json               # Root scripts
└── README.md                  # Project documentation
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 👤 Author

**Aditya Chauhan**  
GitHub: [@0xAditya-Labs](https://github.com/0xAditya-Labs)

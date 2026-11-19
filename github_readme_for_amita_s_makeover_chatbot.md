# 💄 Amita's Makeover — WhatsApp Automated Booking & Inquiry Chatbot

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)
![WhatsApp Cloud API](https://img.shields.io/badge/WhatsApp_Cloud_API-v25.0-25D366?logo=whatsapp&logoColor=white)
![Google Workspace](https://img.shields.io/badge/Google_Sheets_%26_Calendar-Integrated-4285F4?logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

An end-to-end automated **WhatsApp Business Cloud API** chatbot built with **Node.js** and **Express** for **Amita's Makeover (Glamour Studio Parlour)**. Designed to integrate seamlessly with **Meta Click-to-WhatsApp Ads** (Instagram & Facebook), the bot captures leads, handles FAQs and custom inquiries, presents visual service menus, prevents double-bookings via Google Calendar, processes ₹1,000 UPI advance payments, and syncs confirmed appointments to **Google Sheets**, **Google Calendar**, and a local **CSV** log.

---

## 📋 Table of Contents

- [Features](#-features)
- [Conversation Flow](#-conversation-flow)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment & Meta Webhook Setup](#-deployment--meta-webhook-setup)
- [Admin & Booking Management](#-admin--booking-management)
- [Security Best Practices](#-security-best-practices)

---

## ✨ Features

- **Upfront Lead Capture:** Greets users coming from organic chats or Instagram/Facebook ads and collects their **Full Name** and validated **10-digit Indian Mobile Number** before showing options.
- **Smart Inquiry & Custom Q&A:**
  - Interactive FAQ list covering makeup inclusions, home-visit travel charges, bridal jewellery rent, nail art pricing, and advance policies.
  - Supports **"Ask Another Question"** for open-ended customer queries (powered by smart keyword matching / optional Gemini AI).
- **Dual Service Categories:**
  - **💅 Nail Art:** Sends the official Nail Art Rate Card image alongside an interactive list (*Original Nails Hand/Foot*, *Press On Nails*, *Extra Art*, *Nail Extensions ₹1,000 / ₹1,200 / ₹1,500*). Confirms **without requiring advance payment**.
  - **👰 Makeup Packages:** Displays packages (*Bridal Package*, *HD Makeup*, *Luxury Makeup*, *Per Touch-Up*) and requires a **₹1,000 UPI advance payment** via QR scanner before issuing a booking receipt.
- **Multi-Step Date & Time Slot Picker:** Lets users choose **Month → Date Range → Specific Day** and **Time Slot**, bypassing WhatsApp's 10-row list limit.
- **Service Mode Selection:** Supports both **Parlour Visit** and **Home Visit** (collecting full address or WhatsApp live location pin).
- **Real-Time Double-Booking Prevention:** Checks **Google Calendar** and local CSV records before locking a slot; notifies the customer and shares the studio contact number if unavailable.
- **Automated Sync & Official Bill Receipt:**
  - Appends a 13-column record to **Google Sheets**.
  - Blocks the date and time slot on **Google Calendar**.
  - Logs appointments to `bookings.csv`.
  - Sends a formatted **Official Appointment & Payment Receipt** on WhatsApp.

---

## 🔄 Conversation Flow

```text
User ("Hii" / Instagram Ad Click)
  │
  ▼
[1] Capture Full Name & Validated 10-Digit Mobile Number
  │
  ▼
[2] Main Menu ──► [Inquiry] ──► Preset FAQs / Custom Question ──┐
  │                                                             │
  └──► [Book Appointment] ◄─────────────────────────────────────┘
         │
         ├──► [Nail Art] ─────────► Menu Image + Options (No Advance) ──┐
         │                                                              │
         └──► [Makeup Packages] ──► Package List + Details ─────────────┤
                                                                        ▼
                                   [3] Pick Month → Date Range → Day & Time Slot
                                                                        │
                                                                        ▼
                                   [4] Availability Check (Google Calendar + CSV)
                                                                        │
                                                                        ▼
                                   [5] Parlour Visit vs. Home Visit (Address/Pin)
                                                                        │
                                                                        ▼
                                   [6] Confirm & ₹1,000 UPI QR (Makeup Only)
                                                                        │
                                                                        ▼
                                   [7] Sync Sheets/Calendar/CSV + Send Bill Receipt
```

---

## 🛠️ Tech Stack

- **Runtime & Framework:** Node.js, Express.js
- **Messaging API:** Meta WhatsApp Cloud API (`v25.0`)
- **Cloud Integrations:** Google Sheets API & Google Calendar API (`googleapis`)
- **Media Hosting:** Cloudinary (serving PNG-formatted menu & UPI QR images)
- **Hosting:** Render (HTTPS Web Service)

---

## 📁 Project Structure

```text
glamour-whatsapp-bot/
├── server.js          # Express webhook server, state machine & Google API integrations
├── package.json       # Project dependencies and start script
├── package-lock.json  # Locked dependency tree
├── bookings.csv       # Auto-generated local CSV log of confirmed bookings
├── .env               # Environment variables (ignored by Git)
└── .gitignore         # Ignores node_modules/, .env, and service account JSON files
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (`v18` or higher)
- A [Meta Developer Account](https://developers.facebook.com/) with WhatsApp Business Cloud API configured
- A [Google Cloud Project](https://console.cloud.google.com/) with **Google Sheets API** and **Google Calendar API** enabled
- Publicly hosted `.png` or `.jpg` images for your UPI QR scanner and Nail Art menu

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/glamour-whatsapp-bot.git
   cd glamour-whatsapp-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the root directory and configure the variables listed below.

4. **Run the server locally:**
   ```bash
   npm start
   ```
   The server will listen on `http://localhost:3000`.

---

## ⚙️ Environment Variables

Add these variables to your local `.env` file or your hosting provider's environment settings:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `PORT` | No | Server port (defaults to `3000`) |
| `WHATSAPP_TOKEN` | **Yes** | Permanent System User Access Token from Meta Business Settings |
| `PHONE_NUMBER_ID` | **Yes** | WhatsApp Business Phone Number ID from Meta Developer Portal |
| `VERIFY_TOKEN` | **Yes** | Custom secret string used to verify the Meta Webhook |
| `PAYMENT_QR_IMAGE_URL` | **Yes** | Direct `.png` / `.jpg` URL of your UPI QR code (use `f_png/` on Cloudinary) |
| `NAIL_MENU_IMAGE_URL` | **Yes** | Direct `.png` / `.jpg` URL of the Nail Art rate card image |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Yes** | Full JSON credentials string of your Google Cloud Service Account |
| `GOOGLE_SHEET_ID` | **Yes** | Target Google Sheet ID (from the spreadsheet URL) |
| `GOOGLE_CALENDAR_ID` | **Yes** | Target Google Calendar ID (e.g., studio Gmail address) |
| `ADMIN_KEY` | Recommended | Secret password protecting the `/bookings.csv?key=...` endpoint |
| `ADMIN_PHONE` | Optional | Owner's WhatsApp number (`91XXXXXXXXXX`) for instant booking alerts |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for open-ended customer inquiries |

---

## ☁️ Deployment & Meta Webhook Setup

1. **Google Cloud Permissions:**
   - Share your **Google Sheet** and **Google Calendar** with your Service Account email (`...@...iam.gserviceaccount.com`) with **Editor / Make changes to events** permissions.
2. **Deploy to Render:**
   - Push this repository to a **Private** GitHub repo.
   - Create a new **Web Service** on [Render](https://render.com) with Build Command `npm install` and Start Command `node server.js`.
   - Add all environment variables under **Environment**.
3. **Configure Meta Developer App:**
   - Set **Privacy Policy URL** under **App Settings → Basic** to `https://your-app.onrender.com/privacy` and toggle **App Mode** to **Live**.
   - Under **WhatsApp → Configuration**, set **Callback URL** to `https://your-app.onrender.com/webhook` and enter your `VERIFY_TOKEN`.
   - Subscribe to the `messages` webhook field.

---

## 📊 Admin & Booking Management

- **Google Sheets (Live Database):** Tracks `BookingID`, `CreatedAt`, `ClientName`, `Mobile`, `Category`, `Service`, `Date`, `TimeSlot`, `ServiceMode`, `Address`, `TotalRate`, `AdvancePaid`, and `BalanceDue` in real time.
- **Google Calendar:** Displays blocked slots with client contact info and service details.
- **Protected CSV Download:** Download local records via `https://your-app.onrender.com/bookings.csv?key=YOUR_ADMIN_KEY`.

---

## 🔒 Security Best Practices

- **Never commit secrets:** Ensure `.env` and service account `.json` files remain in `.gitignore`.
- **Cloudinary Image Formats:** Always use `f_png/` or `f_jpg/` transformations—Meta's WhatsApp API rejects `WebP`/`AVIF` images returned by `f_auto`.
- **Interactive Button Character Limit:** Keep all WhatsApp reply button titles at **20 characters or fewer** to avoid `400 Bad Request` rejections.
- **Restricted Sharing:** Keep your Google Sheet and Calendar set to **Restricted** so only the owner and service account can view customer records.
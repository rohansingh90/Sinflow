Sinflow

A clean, modern E-Signature platform (DocuSign alternative) built for uploading documents, previewing PDFs, and adding digital signatures smoothly—without the bloat.

What It Does
Upload & Preview: Drag and drop PDFs or documents to render them instantly on a clean interface.

Digital Signatures: Draw custom signatures or add text overlays onto documents with exact positioning.

Cloud Storage & Sync: Powered by Firebase for authentication, database records, and secure document handling.

Asset Optimization: Integrated Cloudinary storage for managing signature overlays and uploaded files efficiently.

Email Workflows: Sends automated notification triggers via EmailJS whenever a document is signed or shared.

PDF Export Engine: Preserves original layouts and signatures using html2canvas and jsPDF for crisp client-ready downloads.

🛠️ Tech Stack
Frontend: React.js, Vite

Styling: Tailwind CSS, Lucide React (Icons)

Backend & Services: Firebase (Auth & Firestore)

Media & Delivery: Cloudinary, EmailJS

Rendering Engine: html2canvas, jspdf

🚀 Getting Started Locally

1. Clone & Install
   Bash
   git clone https://github.com/rohansingh6791/sinflow.git
   cd sinflow
   npm install
2. Configure Environment Variables
   Create a .env file in the root directory and add your credentials:

Code snippet

# Firebase Configuration

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Cloudinary Integration

VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset

# EmailJS Configuration

VITE_EMAILJS_PUBLIC_KEY=your_public_key
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_SIGNING=your_signing_template_id
VITE_EMAILJS_TEMPLATE_OWNER=your_owner_template_id 3. Run the App
Bash

# Start development server

npm run dev

# Build for production

npm run build

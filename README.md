# UniShip: Unified University Placement & Testing Ecosystem

UniShip is a high-performance management platform designed to streamline the lifecycle of university internships and placement drives. By bridging the gap between students and university administrators, UniShip provides a centralized hub for assessments, proctoring, and career development.

---

## 🚀 Features

* **Multi-Tier Role Management**: Secure, dedicated dashboards for Students, University Admins, and Super Admins.
* **Integrated Test Portal**: A robust assessment environment featuring a Monaco-powered code editor and real-time proctoring.
* **AI-Driven Analysis**: Automated evaluation of test results and student performance using Google Gemini and Groq.
* **Dynamic Resume Builder**: Tools for students to create and export professional resumes directly to PDF.
* **Event Orchestration**: University admins can manage student databases, create events, and oversee the entire placement cycle.

---

## 🛠 Tech Stack

* **Framework**: Next.js 16 (App Router)
* **Frontend**: React 19, Tailwind CSS 4, Lucide Icons
* **Database & Auth**: Firebase (Auth, Firestore, Cloud Storage)
* **Artificial Intelligence**: Google Generative AI (@google/generative-ai), Groq SDK
* **Development Tools**: TypeScript, ESLint, Monaco Editor

---

## 📦 Installation

To get a local copy up and running, follow these steps:

1. **Clone the repository**
```bash
git clone https://github.com/your-username/uniship.git
cd uniship

```


2. **Install dependencies**

   Requires **Node 22 LTS** (see `.nvmrc`). With nvm: `nvm use`. With Homebrew: `brew install node@22`.

```bash
npm ci

```


3. **Configure Environment Variables** Create a `.env.local` file in the root directory and add your credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_id

```


4. **Run Development Server**
```bash
npm run dev

```



---

## 💻 Usage

* **As a Student**: Log in to access the Test Portal, build your AI-powered resume, and apply for active internships.
* **As a University Admin**: Monitor active test sessions via the Proctoring Dashboard and manage the student database.
* **As a Super Admin**: Manage university registrations and administrative accounts globally.

---

## 📂 Project Structure

```text
├── app/
│   ├── (protected)/     # Role-based protected routes (user, uniadmin, superadmin)
│   ├── api/             # API routes for compilation and backend tasks
│   └── actions/         # Server actions for processing test results
├── components/          # Reusable UI components (Navbar, ThemeToggle)
├── contexts/            # Global state management (AuthContext)
├── lib/                 # Core service initializations (Firebase, Groq)
└── public/              # Static assets and icons

```




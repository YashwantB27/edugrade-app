# EduGrade - Student Academic Management System

A modern, full-stack student academic management platform built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Supabase**. Track your SGPA, CGPA, semesters, subjects, attendance, and academic targets with a beautiful, responsive UI.

---

## ✨ Features

### 🎓 Academic Tracking
- **Semester Management**: Track multiple semesters (1-1 through 4-2)
- **Subject Management**: Add subjects with credits and grades
- **10-Point Grading Scale**: S (10), A (9), B (8), C (7), D (6), E (5), F (0), Completed
- **SGPA Calculation**: Credit-weighted SGPA per semester
- **CGPA Calculation**: Overall CGPA across all semesters
- **SGPA Trend Chart**: Visual sparkline showing academic progress
- **CGPA Badge**: Distinction (≥9), First Class (≥7), Pass (≥5), At Risk (<5)

### 🔐 Authentication & Security
- **Supabase Auth**: Secure email/password authentication
- **Session Persistence**: Stay logged in across browser sessions
- **Row Level Security (RLS)**: Students can only access their own data
- **Protected Routes**: Authentication-gated dashboard access

### 🎨 User Experience
- **Dark/Light Mode**: Toggle between themes with persistence
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Professional UI**: Clean SaaS-style interface with Tailwind CSS
- **Real-time Calculations**: Instant SGPA/CGPA updates
- **Toast Notifications**: User-friendly feedback messages
- **Modal-based Forms**: Intuitive semester creation workflow

### 🗄️ Database Architecture
- **PostgreSQL via Supabase**: Production-ready relational database
- **Normalized Schema**: Separate tables for profiles, semesters, subjects, attendance, targets
- **Foreign Key Constraints**: Data integrity with CASCADE deletes
- **Indexes**: Optimized queries on user_id and relationships
- **Automatic Timestamps**: created_at and updated_at tracking

---

## 🏗️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite |
| **Styling** | Tailwind CSS, CSS Custom Properties |
| **Routing** | React Router v6 |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Type Safety** | TypeScript with strict mode |
| **Build Tool** | Vite |
| **Deployment** | Netlify / Vercel (recommended) |

---

## 📦 Prerequisites

- **Node.js**: v18+ (recommended: v20+)
- **npm**: v9+ or **pnpm** / **yarn**
- **Supabase Account**: Free tier available at [supabase.com](https://supabase.com)

---

## 🚀 Setup Instructions

### 1. Clone the Repository

```bash
cd EduGrade-main/edugrade-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase Project

#### 3.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: EduGrade
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Select closest to your users
4. Click **"Create new project"** (takes ~2 minutes)

#### 3.2 Run the Database Schema
1. In your Supabase project dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy the entire contents of `supabase-schema.sql` and paste it
4. Click **"Run"** (bottom right)
5. Verify: You should see "Success. No rows returned" for most statements

#### 3.3 Verify RLS is Enabled
1. Go to **Authentication** → **Policies** (left sidebar)
2. You should see policies for: `profiles`, `semesters`, `subjects`, `attendance`, `targets`
3. Each table should have 4 policies: `SELECT`, `INSERT`, `UPDATE`, `DELETE`

### 4. Configure Environment Variables

#### 4.1 Get Supabase Credentials
1. In Supabase dashboard, go to **Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

#### 4.2 Create `.env` File
```bash
# In edugrade-app directory
cp .env.example .env
```

#### 4.3 Edit `.env`
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **IMPORTANT**: 
- Never commit `.env` to git (it's in `.gitignore`)
- Only use the **anon key**, never the service_role key in the frontend
- The anon key is safe for client-side use (RLS protects data)

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 6. Test the Application

1. **Sign Up**: Create a new account with email/password
2. **Verify Email** (if Supabase email confirmation is enabled):
   - Check your email inbox
   - Click the verification link
   - Return to login page
3. **Log In**: Use your credentials
4. **Add Semester**: Click "Add Semester" button
5. **Enter Subjects**: Fill in subject names, credits, grades
6. **View CGPA**: Hero card updates automatically

---

## 🗂️ Project Structure

```
edugrade-app/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx          # Top navigation with logout
│   │   └── ProtectedRoute.tsx  # Auth guard for routes
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Supabase auth state management
│   │   └── ThemeContext.tsx    # Dark/light mode toggle
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client + types
│   │   └── grading.ts          # SGPA/CGPA calculation logic
│   ├── pages/
│   │   ├── Login.tsx           # Login/Signup page
│   │   └── Dashboard.tsx       # Main dashboard with semesters
│   ├── App.tsx                 # Root component with routing
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind + custom styles
├── supabase-schema.sql         # Database schema with RLS
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies
├── tailwind.config.js          # Tailwind configuration
├── postcss.config.js           # PostCSS configuration
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration
```

---

## 🔒 Security Features

### Row Level Security (RLS)
Every table has RLS policies that enforce:
- Users can **only** see their own data
- Users **cannot** access other students' semesters, subjects, or grades
- Authorization is enforced at the **database level**, not just the UI

### Authentication
- Passwords hashed with bcrypt (handled by Supabase)
- Session tokens stored securely in HTTP-only cookies
- PKCE flow for secure authentication
- Automatic token refresh

### Environment Variables
- Sensitive keys stored in `.env` (never committed to git)
- Only anon key exposed to browser (safe with RLS)
- Service role key kept server-side only

---

## 🧮 Grading Logic

### 10-Point Scale
| Grade | Points | Description |
|-------|--------|-------------|
| S     | 10     | Outstanding |
| A     | 9      | Excellent |
| B     | 8      | Very Good |
| C     | 7      | Good |
| D     | 6      | Satisfactory |
| E     | 5      | Pass |
| F     | 0      | Fail |
| Completed | — | Non-credit course (excluded from SGPA) |

### SGPA Calculation
```
SGPA = Σ(Credit × Grade Point) / Σ(Credits)
```
- Excludes **'Completed'** and **'F'** grades from calculation
- Computed per semester

### CGPA Calculation
```
CGPA = Σ(All Credits × Grade Points) / Σ(All Credits across all semesters)
```
- Aggregates all semesters
- Same exclusion rules as SGPA

### Badge System
- **Distinction**: CGPA ≥ 9.0 (Green badge)
- **First Class**: CGPA ≥ 7.0 (Blue badge)
- **Pass**: CGPA ≥ 5.0 (Yellow badge)
- **At Risk**: CGPA < 5.0 (Red badge)

---

## 📊 Database Schema

### Tables

#### `profiles`
- `id` (UUID, FK to auth.users)
- `email` (TEXT, UNIQUE)
- `full_name` (TEXT, nullable)
- `avatar_url` (TEXT, nullable)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `semesters`
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `label` (TEXT, e.g., "1-1")
- `year` (INTEGER, 1-4)
- `semester_number` (INTEGER, 1 or 2)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `subjects`
- `id` (UUID, PK)
- `semester_id` (UUID, FK to semesters)
- `user_id` (UUID, FK to auth.users)
- `name` (TEXT)
- `credits` (INTEGER, 0-10)
- `grade` (TEXT, S/A/B/C/D/E/F/Completed)
- `grade_points` (INTEGER, 0-10)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `attendance` (Future feature)
- `id` (UUID, PK)
- `subject_id` (UUID, FK to subjects)
- `user_id` (UUID, FK to auth.users)
- `classes_attended` (INTEGER)
- `total_classes` (INTEGER)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### `targets` (Future feature)
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `target_cgpa` (DECIMAL 3,2)
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## 🚀 Deployment

### Option 1: Netlify (Recommended)

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**:
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli

   # Login
   netlify login

   # Deploy
   netlify deploy --prod
   ```

3. **Set Environment Variables** in Netlify:
   - Go to **Site settings** → **Environment variables**
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Option 2: Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables** in Vercel dashboard

### Production Checklist
- ✅ Environment variables configured
- ✅ Supabase email confirmation enabled (optional)
- ✅ Database backups enabled in Supabase
- ✅ RLS policies tested
- ✅ HTTPS enforced (automatic on Netlify/Vercel)

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Sign up with new email
- [ ] Log in with credentials
- [ ] Add a semester (e.g., 1-1)
- [ ] Add 5+ subjects with various grades
- [ ] Verify SGPA calculation is correct
- [ ] Add another semester
- [ ] Verify CGPA updates correctly
- [ ] Delete a subject
- [ ] Delete a semester
- [ ] Toggle dark/light mode
- [ ] Log out and log back in
- [ ] Verify data persists

---

## 🐛 Troubleshooting

### Issue: "Missing Supabase environment variables"
**Solution**: Make sure `.env` file exists with correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Issue: "Row Level Security policy violation"
**Solution**: 
1. Check that RLS policies are enabled: `supabase-schema.sql` ran successfully
2. Verify user is logged in: `supabase.auth.getUser()` returns a user
3. Check `user_id` matches `auth.uid()` in database

### Issue: Login fails with "Invalid credentials"
**Solution**:
1. Verify email/password are correct
2. Check if email confirmation is required (Supabase → Auth → Settings)
3. Check browser console for errors

### Issue: Build fails with TypeScript errors
**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Future Enhancements

- [ ] **Attendance Tracking**: Track class attendance per subject
- [ ] **Target Calculator**: Set CGPA targets and calculate required grades
- [ ] **Analytics Dashboard**: Charts for grade distribution, trends, predictions
- [ ] **Export Data**: Download semester reports as PDF
- [ ] **Faculty Role**: Separate role for teachers to manage student grades
- [ ] **Admin Dashboard**: System administration panel
- [ ] **Mobile App**: React Native version
- [ ] **Notifications**: Email/push notifications for grade updates
- [ ] **Multi-language**: Support for Hindi, Telugu, Tamil, etc.

---

## 🤝 Contributing

This is a student project. Contributions welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **Supabase** for the amazing backend-as-a-service platform
- **Tailwind CSS** for the utility-first CSS framework
- **Vite** for the lightning-fast build tool
- **React** team for the excellent framework

---

## 📧 Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Search existing GitHub issues
3. Open a new issue with details (steps to reproduce, screenshots, error messages)

---

**Built with ❤️ for engineering students by students**

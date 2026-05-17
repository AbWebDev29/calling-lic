# LeadTrack Setup Guide

## 🚀 Quick Start

This is a refactored, professional Next.js application for Lead Management & Call Tracking with Supabase integration.

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier at supabase.com)

### Environment Setup

1. **Clone & Install**
   ```bash
   npm install
   ```

2. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Copy your Project URL and anon public key

3. **Set Environment Variables**
   
   Create `.env.local` in the project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run Supabase Schema**
   
   - Open your Supabase project dashboard
   - Go to **SQL Editor**
   - Open and run the SQL from `supabase-schema.sql`
   
   This creates:
   - `leads` table (with user isolation via Row Level Security)
   - `call_logs` table (with user isolation via Row Level Security)
   - All necessary indexes and policies

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   Visit [http://localhost:3000](http://localhost:3000)

### First Login

1. Go to `/login`
2. Click "Sign Up" and create an account
3. Confirm your email (check spam folder if needed)
4. Log in with your credentials
5. You'll be redirected to the dashboard

## 📁 Project Structure

```
app/
├── page.tsx                 # Root redirect (login → dashboard)
├── login/page.tsx          # Beautiful centered login/signup card
├── dashboard/page.tsx      # Main protected dashboard
├── layout.tsx              # Root layout
├── globals.css             # Global styles & animations
└── components.css          # Component-specific styles

components/
├── AuthGuard.tsx           # Client-side auth protection
├── LeadsTable.tsx          # Leads management & upload
├── CallModal.tsx           # Call disposition modal
├── Analytics.tsx           # Charts & metrics
├── ExcelInfo.tsx           # Data requirements & template download
└── SafeDate.tsx            # Client-side date formatting

lib/
└── supabaseClient.ts       # Supabase client configuration
```

## ✨ Key Features

### ✅ Authentication
- Email/password signup and login
- Supabase Auth integration
- Row Level Security (RLS) for data isolation
- Users only see their own leads and call logs

### ✅ Lead Management
- Upload leads from Excel (.xlsx, .xls, .csv)
- Search, filter, and view leads
- Track lead status (New, Contacted, Interested, Follow Up, Not Interested)
- Display required Excel format (Name, Phone, Email, Company)
- Download sample Excel template

### ✅ Call Tracking
- Click "Call" to open device dialer (tel: URI)
- Log call disposition and notes
- View call history with filters
- Track call metrics and analytics

### ✅ Analytics
- 7-day call volume chart
- Disposition breakdown (pie chart)
- Top performing leads table
- Conversion rate metrics
- Export call logs to CSV

### ✅ UI/UX
- Modern SaaS design with Tailwind CSS
- Animated login page with gradient background
- Responsive layout
- Real-time data updates
- Loading states and error handling
- No hydration errors (client-side date formatting)

## 🔐 Supabase Row Level Security (RLS)

All data is automatically isolated per user:

```sql
-- Users can only access their own leads
SELECT * FROM leads WHERE user_id = current_user_id()

-- Users can only access their own call logs
SELECT * FROM call_logs WHERE user_id = current_user_id()
```

## 📊 Excel Upload Format

Your Excel file must contain these exact column headers:
- **Name** (Required) - Lead name
- **Phone** (Required) - Phone number
- **Email** (Required) - Email address
- **Company** (Required) - Company name

Other columns are ignored. Download the sample template from the app for reference.

## 🚀 Deployment (Vercel)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Production ready refactor"
   git push origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Deploy!

## 🐛 Troubleshooting

### "Not authenticated" error
- Check that you're logged in at `/login`
- Verify Supabase URL and key in `.env.local`
- Check browser console for CORS errors

### Excel upload fails
- Ensure your columns are exactly: Name, Phone, Email, Company
- Check that the file is .xlsx, .xls, or .csv format
- Check browser console for parsing errors

### No data showing after upload
- Verify Row Level Security is enabled in Supabase
- Check that you're viewing your own leads (logged in as the uploader)
- Verify the `leads` table has the `user_id` column

### Call modal doesn't appear
- Ensure your device supports tel: URI protocol
- Check that the phone number format includes country code (+1, +91, etc.)
- Open browser console to check for JavaScript errors

## 📝 Data Types

### Lead
```typescript
{
  id: number;
  user_id: string; // UUID from auth.users
  name: string;
  phone: string;
  email: string;
  company: string;
  status: string; // "New", "Interested", "Follow Up", "Contacted", "Not Interested"
  source: string; // "Excel" or "Manual"
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
```

### CallLog
```typescript
{
  id: number;
  user_id: string; // UUID from auth.users
  lead_id: number; // Foreign key to leads
  lead_name: string;
  company: string;
  phone: string;
  disposition: string; // "Interested", "Not Interested", "No Answer", "Voicemail", "Follow Up", "Do Not Call"
  notes: string;
  called_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
}
```

## 💡 Best Practices

1. **Never commit `.env.local`** - It contains sensitive credentials
2. **Use Row Level Security** - Don't modify RLS policies without good reason
3. **Test login flow** - Always test signup, confirmation, and login before deploying
4. **Backup your data** - Export CSVs regularly for backup
5. **Monitor Supabase usage** - Check your quota to avoid overage charges

## 🔗 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React 19 Updates](https://react.dev)

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase logs in the dashboard
3. Check browser console for JavaScript errors
4. Verify all environment variables are set correctly

---

**Built with ⚡ Next.js, Supabase, and Tailwind CSS**

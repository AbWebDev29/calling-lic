This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Manager and submanager access

Apply the full `supabase-schema.sql` in the Supabase SQL Editor when setting up the database. It creates manager profiles for existing auth users, archives preexisting leads as a selectable history file, and adds row assignment, file history, and shared call history policies. Back up existing data before applying schema changes.

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` in `.env.local` and the production server environment. Keep this server key private; it is only used by the account creation API. Restart `npm run dev` after adding it. New self sign-ups receive manager profiles. Managers create submanager accounts from **People and Access** by uploading a spreadsheet with `submanagerName`, `email`, and `password` columns. Master lead uploads read `agentCode`, `name`, `mobile`, `submanagerName`, `leaderCode`, `data1`, `data2`, `data3`, and `data4`, in that order. Older lead values are migrated from email, phone, NOP, PREM, UTSAAV, and ULIP to the new field names when the schema is applied.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

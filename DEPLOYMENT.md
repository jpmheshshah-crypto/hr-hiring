# AI Hiring Dashboard Deployment

This project is ready to deploy as a Next.js app on Vercel.

## Recommended Hosting

- Frontend/API hosting: Vercel
- Database: Supabase
- Candidate operations table: Airtable
- Email: Gmail SMTP for testing
- Calling: Vapi

## Vercel Environment Variables

Add these in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=

AIRTABLE_PERSONAL_ACCESS_TOKEN=
AIRTABLE_BASE_ID=
AIRTABLE_TABLE_ID=

EMAIL_FROM_ADDRESS=
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=

VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_PHONE_NUMBER_ID=
VAPI_WEBHOOK_URL=
```

Do not commit `.env.local` to GitHub.

## Vapi Webhook After Deployment

After Vercel gives you a live URL, update Vapi assistant server URL to:

```text
https://your-vercel-app.vercel.app/api/vapi/webhook
```

Also keep this Vapi server message enabled:

```text
end-of-call-report
```

## Deployment Steps

1. Create a GitHub repository.
2. Upload this project to GitHub.
3. Import the GitHub repository into Vercel.
4. Add all environment variables listed above.
5. Deploy.
6. Open the live Vercel URL.
7. Update Vapi webhook from ngrok URL to the Vercel webhook URL.
8. Test:
   - create hiring request
   - add candidate
   - sync to Airtable
   - schedule interview email
   - selected/rejected email
   - Vapi call
   - Vapi call summary webhook

## Before Real Production

- Rotate Airtable token, Gmail app password, and Vapi private key if they were shared during setup.
- Upgrade Twilio/Vapi phone account to remove trial call message.
- Add authentication before giving access to real clients.
- Add client/company separation before onboarding multiple BPO clients.

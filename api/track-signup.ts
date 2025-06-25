// api/track-signup.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Define the shape of the parameters we send to FirstPromoter
interface FirstPromoterSignupParams {
  email?: string; // Optional if uid is provided
  uid?: string;   // Optional if email is provided
  tid: string;    // Required
  ip?: string;    // Optional
  ref_id?: string; // Optional
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // 1. Ensure it's a POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed', error: 'Only POST requests are supported.' });
  }

  // 2. Retrieve the _fprom_tid cookie
  // Vercel's req object automatically parses cookies if sent from the browser.
  const tid: string | undefined = req.cookies['_fprom_tid'];

  // 3. Extract email or uid from the request body
  // We explicitly cast req.body to a more specific type if known, or handle potential undefined
  const { email, uid }: { email?: string; uid?: string } = req.body || {};

  // 4. Basic Validation
  if (!tid) {
    console.error("Error: Missing _fprom_tid cookie in request.");
    return res.status(400).json({ message: 'Bad Request', error: 'Missing _fprom_tid cookie. Ensure your frontend sends cookies.' });
  }
  if (!email && !uid) {
    console.error("Error: Missing email or uid in request body.");
    return res.status(400).json({ message: 'Bad Request', error: 'Missing email or uid in request body.' });
  }

  // 5. SECURELY GET YOUR API KEY AND ACCOUNT ID FROM VERCEL ENVIRONMENT VARIABLES
  // THIS IS THE ONLY PLACE THESE SENSITIVE VALUES SHOULD BE ACCESSED.
  const FIRSTPROMOTER_API_TOKEN: string | undefined = process.env.FIRSTPROMOTER_API_TOKEN;
  const FIRSTPROMOTER_ACCOUNT_ID: string | undefined = process.env.FIRSTPROMOTER_ACCOUNT_ID;

  // Crucial check: ensure the environment variables are actually set
  if (!FIRSTPROMOTER_API_TOKEN || !FIRSTPROMOTER_ACCOUNT_ID) {
    console.error("Server Configuration Error: FirstPromoter API credentials (FIRSTPROMOTER_API_TOKEN or FIRSTPROMOTER_ACCOUNT_ID) are not set as Vercel environment variables.");
    return res.status(500).json({ message: "Internal Server Error", error: "API credentials missing. Please configure them in your Vercel project settings." });
  }

  // 6. Prepare parameters for the FirstPromoter API
  const params: FirstPromoterSignupParams = {
    tid: tid,
  };

  if (email) {
    params.email = email;
  }
  if (uid) {
    params.uid = uid;
  }

  // Optional: Pass IP if needed. Vercel sets x-forwarded-for for client IP.
  // params.ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress as string;

  // 7. Make the POST request to FirstPromoter API
  try {
    const firstPromoterResponse = await axios.post(
      "https://v2.firstpromoter.com/api/v2/track/signup",
      params,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${FIRSTPROMOTER_API_TOKEN}`, // Used directly from Vercel Env Var
          "Account-ID": FIRSTPROMOTER_ACCOUNT_ID, // Used directly from Vercel Env Var
        },
      }
    );

    console.log("FirstPromoter API Success Response:", JSON.stringify(firstPromoterResponse.data));
    // Respond to the frontend with success
    res.status(200).json({
      success: true,
      message: "Signup tracked successfully with FirstPromoter.",
      firstPromoterResponse: firstPromoterResponse.data,
    });

  } catch (error: unknown) { // Use 'unknown' for safer error handling in TypeScript
    let errorMessage = "An unknown error occurred.";
    let statusCode = 500;

    if (axios.isAxiosError(error)) {
      // This is an Axios error (e.g., network error, or API responded with non-2xx status)
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Error calling FirstPromoter API (Axios response):", error.response.data);
        errorMessage = error.response.data?.message || JSON.stringify(error.response.data);
        statusCode = error.response.status;
      } else if (error.request) {
        // The request was made but no response was received
        console.error("Error calling FirstPromoter API (Axios request): No response received.", error.message);
        errorMessage = "No response from FirstPromoter API.";
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error calling FirstPromoter API (Axios config):", error.message);
        errorMessage = `Request setup error: ${error.message}`;
      }
    } else if (error instanceof Error) {
      // A generic JavaScript error
      console.error("Generic Error calling FirstPromoter API:", error.message);
      errorMessage = error.message;
    } else {
      // Any other unexpected error type
      console.error("Unknown Error calling FirstPromoter API:", error);
    }

    res.status(statusCode).json({
      success: false,
      message: "Failed to track signup with FirstPromoter.",
      error: errorMessage,
    });
  }
}
import { google } from 'googleapis';
import readline from 'readline';
import { env } from '../src/config/env.js';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function getAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = env;

  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    GOOGLE_CLIENT_ID.includes('your-client-id')
  ) {
    console.error('❌ Error: Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
  });

  console.log('====================================================');
  console.log('🔑 Google Drive OAuth 2.0 Token Generator');
  console.log('====================================================\n');
  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl, '\n');
  console.log('2. Log in with your personal @gmail.com account.');
  console.log('3. Grant the required permissions.');
  console.log('4. You will be redirected to a page that starts with http://127.0.0.1:3000');
  console.log('   - It does not matter if the page loads successfully or shows an error.');
  console.log('   - Look at the URL in your browser address bar.');
  console.log('   - Copy ONLY the value after "code=" and before "&scope=".\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Paste the authorization code here: ', async (code) => {
    rl.close();
    try {
      console.log('\nExchanging code for tokens...');
      const { tokens } = await oAuth2Client.getToken(code);
      
      console.log('\n✅ Success! Here is your Refresh Token:');
      console.log('----------------------------------------------------');
      console.log(tokens.refresh_token);
      console.log('----------------------------------------------------\n');
      console.log('Copy this token and paste it as GOOGLE_REFRESH_TOKEN in your .env file.\n');
    } catch (error: any) {
      console.error('\n❌ Error retrieving access token:', error.message);
    }
  });
}

getAccessToken();

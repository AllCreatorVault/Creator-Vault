// .netlify/functions/youtube-auth.js
const https = require('https');
const querystring = require('querystring');

exports.handler = async (event) => {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/youtube-callback';

    // If this is the initial request (no code), redirect to Google
    if (!event.queryStringParameters || !event.queryStringParameters.code) {
        const params = querystring.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/youtube.readonly',
            access_type: 'offline',
            prompt: 'consent'
        });

        return {
            statusCode: 302,
            headers: {
                'Location': `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
                'Cache-Control': 'no-cache'
            },
            body: ''
        };
    }

    // If we have a code, this shouldn't be called directly
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'YouTube auth endpoint ready' })
    };
};

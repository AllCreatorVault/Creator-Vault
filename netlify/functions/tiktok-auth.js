// .netlify/functions/tiktok-auth.js
const querystring = require('querystring');

exports.handler = async (event) => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/tiktok-callback';

    // Generate CSRF token for security
    const csrfToken = Math.random().toString(36).substring(7);

    const params = querystring.stringify({
        client_key: clientKey,
        response_type: 'code',
        scope: 'user.info.basic,creator.info.basic,creator.earnings.read',
        redirect_uri: redirectUri,
        state: csrfToken
    });

    return {
        statusCode: 302,
        headers: {
            'Location': `https://www.tiktok.com/v1/oauth/authorize?${params}`,
            'Cache-Control': 'no-cache'
        },
        body: ''
    };
};

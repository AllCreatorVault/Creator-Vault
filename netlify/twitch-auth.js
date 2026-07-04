// .netlify/functions/twitch-auth.js
const querystring = require('querystring');

exports.handler = async (event) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/twitch-callback';

    const params = querystring.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'bits:read analytics:read:extensions analytics:read:games user:read:email',
        force_verify: true
    });

    return {
        statusCode: 302,
        headers: {
            'Location': `https://id.twitch.tv/oauth2/authorize?${params}`,
            'Cache-Control': 'no-cache'
        },
        body: ''
    };
};

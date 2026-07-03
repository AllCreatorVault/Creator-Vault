// .netlify/functions/spotify-auth.js
const querystring = require('querystring');

exports.handler = async (event) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/spotify-callback';

    const params = querystring.stringify({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'user-read-email user-read-private user-library-read'
    });

    return {
        statusCode: 302,
        headers: {
            'Location': `https://accounts.spotify.com/authorize?${params}`,
            'Cache-Control': 'no-cache'
        },
        body: ''
    };
};

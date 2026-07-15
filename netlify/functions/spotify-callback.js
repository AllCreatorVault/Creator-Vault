// .netlify/functions/spotify-callback.js
// PRIVACY-FIRST VERSION: no data is stored server-side, and the raw access
// token is never sent to the browser. Data is fetched once, used once, and
// discarded. The frontend only ever sees the display fields it needs.

const https = require('https');
const querystring = require('querystring');

function httpsPost(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body });
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function httpsGet(url, headers) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body });
                }
            });
        }).on('error', reject);
    });
}

exports.handler = async (event) => {
    const code = event.queryStringParameters?.code;
    const error = event.queryStringParameters?.error;

    // No-store headers on every response — nothing here should be cached
    // by browsers, CDNs, or intermediate proxies.
    const noStoreHeaders = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

    if (error) {
        return { statusCode: 400, headers: noStoreHeaders, body: JSON.stringify({ error: `Spotify auth failed: ${error}` }) };
    }
    if (!code) {
        return { statusCode: 400, headers: noStoreHeaders, body: JSON.stringify({ error: 'No authorization code provided' }) };
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/spotify-callback';

    try {
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenData = querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri
        });

        const tokenResponse = await httpsPost({
            hostname: 'accounts.spotify.com',
            path: '/api/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(tokenData)
            }
        }, tokenData);

        if (tokenResponse.status !== 200 || tokenResponse.body.error) {
            return { statusCode: 400, headers: noStoreHeaders, body: JSON.stringify({ error: 'Failed to get access token' }) };
        }

        // Token lives only in this function's memory for the rest of this
        // request. It is never written to a database, never logged, and
        // never sent back to the browser.
        const accessToken = tokenResponse.body.access_token;

        // Fetch whatever data the dashboard needs RIGHT NOW, while the
        // token is valid. Add more calls here (e.g. top tracks, playlists)
        // as needed — do it all in this one request.
        const userResponse = await httpsGet('https://api.spotify.com/v1/me', {
            'Authorization': `Bearer ${accessToken}`
        });

        if (userResponse.status !== 200) {
            return { statusCode: 400, headers: noStoreHeaders, body: JSON.stringify({ error: 'Failed to fetch user data' }) };
        }

        const userData = userResponse.body;

        // Only display-safe fields go to the browser. No accessToken,
        // no refresh token, no raw email unless you specifically want to
        // show it back to the user in the UI.
        const displayData = {
            platform: 'spotify',
            displayName: userData.display_name,
            connectedAt: new Date().toISOString()
            // add derived stats here, e.g. followerCount: userData.followers?.total
        };

        // Passed via URL FRAGMENT (#), not a query string (?). Fragments are
        // never sent to the server, never appear in Netlify's access logs,
        // and are never leaked via a Referer header. The browser keeps it
        // entirely client-side.
        const dataEncoded = encodeURIComponent(JSON.stringify(displayData));

        return {
            statusCode: 302,
            headers: {
                ...noStoreHeaders,
                'Location': `https://allcreatorvault.netlify.app/#spotify_data=${dataEncoded}`
            },
            body: ''
        };

    } catch (err) {
        // Never log the token or code itself — only the error message.
        console.error('Spotify callback error:', err.message);
        return { statusCode: 500, headers: noStoreHeaders, body: JSON.stringify({ error: 'Server error' }) };
    }
};
          

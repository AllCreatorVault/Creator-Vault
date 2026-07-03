// .netlify/functions/spotify-callback.js
const https = require('https');
const querystring = require('querystring');

function httpsPost(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        body: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        body: body
                    });
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
        const options = { headers };
        https.get(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        body: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        body: body
                    });
                }
            });
        }).on('error', reject);
    });
}

exports.handler = async (event) => {
    const code = event.queryStringParameters?.code;
    const error = event.queryStringParameters?.error;

    if (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `Spotify auth failed: ${error}` })
        };
    }

    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No authorization code provided' })
        };
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/spotify-callback';

    try {
        // Exchange code for access token
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
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Failed to get access token' })
            };
        }

        const accessToken = tokenResponse.body.access_token;

        // Fetch Spotify user profile
        const userResponse = await httpsGet(
            'https://api.spotify.com/v1/me',
            {
                'Authorization': `Bearer ${accessToken}`
            }
        );

        if (userResponse.status !== 200) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Failed to fetch user data' })
            };
        }

        const userData = userResponse.body;

        // Return response that redirects to dashboard
        const earnings = {
            platform: 'spotify',
            userId: userData.id,
            displayName: userData.display_name,
            email: userData.email,
            accessToken: accessToken,
            connected: true,
            lastSync: new Date().toISOString()
        };

        const dataEncoded = encodeURIComponent(JSON.stringify(earnings));

        return {
            statusCode: 302,
            headers: {
                'Location': `https://allcreatorvault.netlify.app/?spotify_data=${dataEncoded}`,
                'Cache-Control': 'no-cache'
            },
            body: ''
        };

    } catch (error) {
        console.error('Spotify callback error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error: ' + error.message })
        };
    }
};

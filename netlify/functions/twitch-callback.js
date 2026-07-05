// .netlify/functions/twitch-callback.js
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
            body: JSON.stringify({ error: `Twitch auth failed: ${error}` })
        };
    }

    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No authorization code provided' })
        };
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/twitch-callback';

    try {
        // Exchange code for access token
        const tokenData = querystring.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        });

        const tokenResponse = await httpsPost({
            hostname: 'id.twitch.tv',
            path: '/oauth2/token',
            method: 'POST',
            headers: {
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

        // Fetch Twitch user info
        const userResponse = await httpsGet(
            'https://api.twitch.tv/helix/users',
            {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        );

        if (userResponse.status !== 200) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Failed to fetch user data' })
            };
        }

        const userData = userResponse.body.data?.[0];

        // Return response that redirects to dashboard
        const earnings = {
            platform: 'twitch',
            userId: userData.id,
            userName: userData.display_name,
            accessToken: accessToken,
            connected: true,
            lastSync: new Date().toISOString()
        };

        const dataEncoded = encodeURIComponent(JSON.stringify(earnings));

        return {
            statusCode: 302,
            headers: {
                'Location': `https://allcreatorvault.netlify.app/?twitch_data=${dataEncoded}`,
                'Cache-Control': 'no-cache'
            },
            body: ''
        };

    } catch (error) {
        console.error('Twitch callback error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error: ' + error.message })
        };
    }
};

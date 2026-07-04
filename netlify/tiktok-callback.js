// .netlify/functions/tiktok-callback.js
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

exports.handler = async (event) => {
    const code = event.queryStringParameters?.code;
    const error = event.queryStringParameters?.error;
    const state = event.queryStringParameters?.state;

    if (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `TikTok auth failed: ${error}` })
        };
    }

    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No authorization code provided' })
        };
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/tiktok-callback';

    try {
        // Exchange code for access token
        const tokenData = querystring.stringify({
            client_key: clientKey,
            client_secret: clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        });

        const tokenResponse = await httpsPost({
            hostname: 'open.tiktokapis.com',
            path: '/v1/oauth/token',
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

        const accessToken = tokenResponse.body.data.access_token;
        const openId = tokenResponse.body.data.open_id;

        // Return response that redirects to dashboard
        const earnings = {
            platform: 'tiktok',
            openId: openId,
            accessToken: accessToken,
            connected: true,
            lastSync: new Date().toISOString()
        };

        const dataEncoded = encodeURIComponent(JSON.stringify(earnings));

        return {
            statusCode: 302,
            headers: {
                'Location': `https://allcreatorvault.netlify.app/?tiktok_data=${dataEncoded}`,
                'Cache-Control': 'no-cache'
            },
            body: ''
        };

    } catch (error) {
        console.error('TikTok callback error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error: ' + error.message })
        };
    }
};

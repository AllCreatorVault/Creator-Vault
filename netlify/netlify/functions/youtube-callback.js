// .netlify/functions/youtube-callback.js
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

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
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
            body: JSON.stringify({ error: `Google auth failed: ${error}` })
        };
    }

    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No authorization code provided' })
        };
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = 'https://allcreatorvault.netlify.app/.netlify/functions/youtube-callback';

    try {
        // Exchange code for access token
        const tokenData = querystring.stringify({
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        const tokenResponse = await httpsPost({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(tokenData)
            }
        }, tokenData);

        if (tokenResponse.status !== 200) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Failed to get access token' })
            };
        }

        const accessToken = tokenResponse.body.access_token;

        // Fetch YouTube earnings (AdSense revenue)
        // Note: Actual earnings data requires AdSense API access
        // For now, return channel info and estimates
        const channelResponse = await httpsGet(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true&access_token=${accessToken}`
        );

        if (channelResponse.status !== 200) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Failed to fetch channel data' })
            };
        }

        const channelData = channelResponse.body.items?.[0];
        
        if (!channelData) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No channel found' })
            };
        }

        // Return response that redirects to dashboard
        const earnings = {
            platform: 'youtube',
            channelName: channelData.snippet.title,
            subscribers: parseInt(channelData.statistics.subscriberCount) || 0,
            views: parseInt(channelData.statistics.viewCount) || 0,
            videos: parseInt(channelData.statistics.videoCount) || 0,
            accessToken: accessToken,
            connected: true,
            lastSync: new Date().toISOString()
        };

        // Redirect back to dashboard with data
        const dataEncoded = encodeURIComponent(JSON.stringify(earnings));
        
        return {
            statusCode: 302,
            headers: {
                'Location': `https://allcreatorvault.netlify.app/?youtube_data=${dataEncoded}`,
                'Cache-Control': 'no-cache'
            },
            body: ''
        };

    } catch (error) {
        console.error('YouTube callback error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server error: ' + error.message })
        };
    }
};

import { app, BrowserWindow } from 'electron';
import crypto from 'crypto';
import http from 'http';
import { URL } from 'url';
import { MicrosoftAuthenticator } from '@xmcl/user';
import type { Account } from '../../shared/constants';
import { CONFIG } from '../../shared/config';
const REDIRECT_URI = 'http://localhost:8080/callback';
const SCOPES = 'XboxLive.signin%20XboxLive.offline_access';
const AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';

const microsoftAuth = new MicrosoftAuthenticator({});

/**
 * Start Microsoft OAuth2 flow using a local HTTP server for callback.
 * 1. Start a temporary server on localhost:8080
 * 2. Open the system browser to Microsoft login
 * 3. Catch the redirect with auth code
 * 4. Exchange auth code → Microsoft token → Xbox token → Minecraft token
 */
export async function authenticateMicrosoft(): Promise<Account | null> {
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const authUrl =
    `${AUTHORITY}/authorize?` +
    `client_id=${CONFIG.MICROSOFT_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${SCOPES}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  try {
    // Start HTTP server to catch the callback
    const authCode = await new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (!req.url) return;

        const url = new URL(req.url, REDIRECT_URI);

        if (req.url.startsWith('/callback')) {
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');

          if (returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h2>State mismatch — 认证失败</h2>');
            reject(new Error('OAuth state mismatch'));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h2>认证成功！你可以关闭此窗口。</h2><script>window.close()</script>');
            resolve(code);
          } else {
            const err = url.searchParams.get('error') || 'unknown';
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h2>认证失败: ${err}</h2>`);
            reject(new Error(`OAuth error: ${err}`));
          }

          server.close();
        }
      });

      server.listen(8080, () => {
        // Open the system browser for Microsoft login
        // In Electron, we use shell.openExternal for the system browser
        // But for dev, we can open a BrowserWindow
        const loginWindow = new BrowserWindow({
          width: 800,
          height: 700,
          title: 'Microsoft 登录 — RLV',
          resizable: false,
          frame: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        loginWindow.loadURL(authUrl);

        loginWindow.on('closed', () => {
          server.close();
          reject(new Error('Login window closed by user'));
        });

        // Also intercept navigation in case the redirect matches
        loginWindow.webContents.on('will-redirect', (_event, url) => {
          if (url.startsWith(REDIRECT_URI)) {
            const code = new URL(url).searchParams.get('code');
            if (code) {
              resolve(code);
              server.close();
              loginWindow.close();
            }
          }
        });
      });
    });

    // Exchange auth code for access token
    const tokenResponse = await exchangeCodeForToken(authCode, codeVerifier);
    if (!tokenResponse.access_token) {
      throw new Error('No access token in response');
    }

    // Exchange Microsoft token for Xbox/Minecraft tokens via @xmcl/user
    const xboxInfo = await microsoftAuth.acquireXBoxToken(tokenResponse.access_token);

    const minecraftResponse = await microsoftAuth.loginMinecraftWithXBox(
      xboxInfo.minecraftXstsResponse.DisplayClaims.xui[0].uhs,
      xboxInfo.minecraftXstsResponse.Token,
    );

    // Get Xbox profile for username/avatar
    const xboxProfile = await microsoftAuth.getXboxGameProfile(
      xboxInfo.liveXstsResponse.DisplayClaims.xui[0].xid,
      xboxInfo.liveXstsResponse.DisplayClaims.xui[0].uhs,
      xboxInfo.liveXstsResponse.Token,
    );

    const xboxUser = xboxProfile.profileUsers[0];
    const gamertag = xboxUser.settings.find((s) => s.id === 'Gamertag')?.value ?? 'Unknown';
    const avatarUrl = xboxUser.settings.find((s) => s.id === 'PublicGamerpic')?.value;

    const account: Account = {
      id: crypto.randomUUID(),
      type: 'microsoft',
      name: gamertag,
      uuid: minecraftResponse.username,
      avatarUrl,
      msAccessToken: tokenResponse.access_token,
      msRefreshToken: tokenResponse.refresh_token,
      minecraftToken: minecraftResponse.access_token,
      xboxGamertag: gamertag,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    };

    return account;
  } catch (error) {
    console.error('Microsoft authentication failed:', error);
    return null;
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/** Exchange OAuth authorization code for access/refresh tokens */
async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CONFIG.MICROSOFT_CLIENT_ID,
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const response = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Refresh a Microsoft account's tokens using the refresh token.
 */
export async function refreshMicrosoftAccount(account: Account): Promise<Account | null> {
  if (account.type !== 'microsoft' || !account.msRefreshToken) return null;

  try {
    const body = new URLSearchParams({
      client_id: CONFIG.MICROSOFT_CLIENT_ID,
      refresh_token: account.msRefreshToken,
      redirect_uri: REDIRECT_URI,
      grant_type: 'refresh_token',
    });

    const response = await fetch(`${AUTHORITY}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) return null;

    const tokenData = (await response.json()) as TokenResponse;

    // Re-do the Xbox/Minecraft exchange with the new token
    const xboxInfo = await microsoftAuth.acquireXBoxToken(tokenData.access_token);
    const minecraftResponse = await microsoftAuth.loginMinecraftWithXBox(
      xboxInfo.minecraftXstsResponse.DisplayClaims.xui[0].uhs,
      xboxInfo.minecraftXstsResponse.Token,
    );

    return {
      ...account,
      msAccessToken: tokenData.access_token,
      msRefreshToken: tokenData.refresh_token ?? account.msRefreshToken,
      minecraftToken: minecraftResponse.access_token,
      lastUsed: Date.now(),
    };
  } catch (error) {
    console.error('Microsoft token refresh failed:', error);
    return null;
  }
}

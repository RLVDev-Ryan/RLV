import { shell, dialog, clipboard, BrowserWindow } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { MicrosoftAuthenticator } from '@xmcl/user';
import type { Account } from '../../shared/constants';
import { CONFIG } from '../../shared/config';
import { IPC_CHANNELS } from '../../shared/constants';

const AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
// Xbox Live + offline access, same scope set as the interactive flow.
const SCOPES = 'XboxLive.signin offline_access';
// Device-code grants are valid for 15 min server-side — match that so the
// user never feels rushed.
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

const microsoftAuth = new MicrosoftAuthenticator({});

/**
 * Open a URL in an Edge InPrivate (无痕) window when available — it has no
 * cache/extensions, which commonly break Microsoft login in a regular tab.
 * Falls back to the system default browser.
 */
function openLoginUrl(url: string): void {
  const programDirs = [
    process.env['ProgramFiles(x86)'],
    process.env.ProgramFiles,
  ].filter((d): d is string => !!d);

  const edgeExe = programDirs
    .map((d) => path.join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
    .find((p) => fs.existsSync(p));

  if (edgeExe) {
    execFile(edgeExe, ['--inprivate', url], (err) => {
      if (err) {
        console.error('[MSAuth] Edge InPrivate failed, using default browser:', err.message);
        shell.openExternal(url).catch((e) => console.error('[MSAuth] openExternal failed:', e));
      }
    });
    return;
  }

  shell.openExternal(url).catch((e) => console.error('[MSAuth] openExternal failed:', e));
}

interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/** Step 1 — ask Microsoft for a device code + user code. */
async function requestDeviceCode(): Promise<DeviceCode> {
  const body = new URLSearchParams({
    client_id: CONFIG.MICROSOFT_CLIENT_ID,
    scope: SCOPES,
  });

  const response = await fetch(`${AUTHORITY}/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`设备码请求失败: HTTP ${response.status}`);
  }
  const data = (await response.json()) as DeviceCode & { error?: string; error_description?: string };
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data;
}

/** Step 2 — poll the token endpoint until the user approves (or times out). */
async function pollDeviceCode(device: DeviceCode): Promise<TokenResponse> {
  const start = Date.now();
  const intervalMs = Math.max(device.interval || 5, 5) * 1000;

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const body = new URLSearchParams({
      client_id: CONFIG.MICROSOFT_CLIENT_ID,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: device.device_code,
    });

    const response = await fetch(`${AUTHORITY}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as TokenResponse & {
      error?: string;
      error_description?: string;
    };

    if (data.access_token) return data;

    if (data.error === 'authorization_pending') {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    if (data.error === 'authorization_declined') throw new Error('用户拒绝了授权');
    if (data.error === 'expired_token') throw new Error('登录代码已过期，请重新登录');
    throw new Error(data.error_description || data.error || '登录失败，请重试');
  }

  throw new Error('登录超时，请重试');
}

/**
 * Authenticate with a Microsoft account using the *device code flow* (the
 * same approach PCL/HMCL use). It only needs a 9-char code pasted into a
 * simple Microsoft web page — no multi-step login page, no callback server,
 * so it's far more reliable on restricted/CN networks.
 */
export async function authenticateMicrosoft(): Promise<Account | null> {
  if (!CONFIG.MICROSOFT_CLIENT_ID || CONFIG.MICROSOFT_CLIENT_ID.startsWith('00000000')) {
    console.error('[MSAuth] RLV_MICROSOFT_CLIENT_ID 未配置，无法进行微软登录');
    return null;
  }

  try {
    // 1. Get a device code (opens in ~1s, no multi-page login involved)
    const device = await requestDeviceCode();

    // 2. Open the verification page (InPrivate window preferred) + show the
    // code in the launcher UI (falling back to a dialog if no window).
    openLoginUrl(device.verification_uri || 'https://www.microsoft.com/link');
    clipboard.writeText(device.user_code); // auto-copy, like PCL does
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (win) {
      win.webContents.send(IPC_CHANNELS.MS_DEVICE_CODE, device.user_code);
    } else {
      void dialog.showMessageBox({
        type: 'info',
        title: 'Microsoft 登录 — RLV',
        message: '请在打开的网页中输入以下代码（已自动复制）：',
        detail: device.user_code,
        buttons: ['知道了'],
      });
    }
    console.log(`[MSAuth] Device code issued: ${device.user_code}, polling for approval…`);

    // 3. Wait for the user to approve in the browser
    const tokenResponse = await pollDeviceCode(device);

    // 4. Exchange Microsoft token → Xbox → Minecraft tokens
    const xboxInfo = await microsoftAuth.acquireXBoxToken(tokenResponse.access_token);

    const minecraftResponse = await microsoftAuth.loginMinecraftWithXBox(
      xboxInfo.minecraftXstsResponse.DisplayClaims.xui[0].uhs,
      xboxInfo.minecraftXstsResponse.Token,
    );

    const xboxProfile = await microsoftAuth.getXboxGameProfile(
      xboxInfo.liveXstsResponse.DisplayClaims.xui[0].xid,
      xboxInfo.liveXstsResponse.DisplayClaims.xui[0].uhs,
      xboxInfo.liveXstsResponse.Token,
    );

    const xboxUser = xboxProfile.profileUsers[0];
    const gamertag = xboxUser.settings.find((s) => s.id === 'Gamertag')?.value ?? 'Unknown';
    const avatarUrl = xboxUser.settings.find((s) => s.id === 'PublicGamerpic')?.value;

    return {
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
  } catch (error) {
    console.error('Microsoft authentication failed:', error);
    return null;
  }
}

import crypto from 'crypto';
import { YggdrasilClient } from '@xmcl/user';
import type { Account } from '../../shared/constants';

export interface YggdrasilAuthResult {
  success: boolean;
  account?: Account;
  /** Friendly, user-facing error message (Chinese) when success is false. */
  error?: string;
}

/**
 * Authenticate via a Yggdrasil-compatible auth server (e.g. LittleSkin).
 * Uses @xmcl/user's YggdrasilClient to handle the login flow.
 *
 * @param serverUrl - The Yggdrasil API root (e.g. https://littleskin.cn/api/yggdrasil)
 * @param username - The player's email / username
 * @param password - The player's password
 */
export async function authenticateYggdrasil(
  serverUrl: string,
  username: string,
  password: string,
): Promise<YggdrasilAuthResult> {
  const clientToken = crypto.randomUUID();

  try {
    const client = new YggdrasilClient(serverUrl);
    const result = await client.login({
      username,
      password,
      clientToken,
      requestUser: true,
    });

    const profile = result.selectedProfile;
    if (!profile) {
      return { success: false, error: '该账号没有可用的游戏角色（profile），请先在认证站点绑定角色' };
    }

    const account: Account = {
      id: crypto.randomUUID(),
      type: 'yggdrasil',
      name: profile.name,
      uuid: profile.id,
      avatarUrl: undefined, // Yggdrasil avatars need separate texture lookup
      yggdrasilServer: serverUrl,
      yggdrasilToken: result.accessToken,
      clientToken: result.clientToken,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    };

    return { success: true, account };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Yggdrasil authentication failed:', msg);

    // Map common Yggdrasil failures to friendly messages.
    const lower = msg.toLowerCase();
    if (
      lower.includes('forbiddenoperation') ||
      lower.includes('bad credentials') ||
      lower.includes('invalid credentials') ||
      lower.includes('wrong password') ||
      lower.includes('账号') ||
      lower.includes('密码')
    ) {
      return { success: false, error: '账号或密码错误，请检查后重试' };
    }
    if (
      lower.includes('network') ||
      lower.includes('fetch failed') ||
      lower.includes('enotfound') ||
      lower.includes('econnrefused') ||
      lower.includes('econnreset') ||
      lower.includes('getaddrinfo') ||
      lower.includes('timed out')
    ) {
      return { success: false, error: '无法连接认证服务器，请检查网络或服务器地址' };
    }
    if (lower.includes('400') || lower.includes('bad request') || lower.includes('404')) {
      return { success: false, error: '认证服务器地址有误，请确认已填写完整的 Yggdrasil API 地址' };
    }
    return { success: false, error: `登录失败：${msg}` };
  }
}

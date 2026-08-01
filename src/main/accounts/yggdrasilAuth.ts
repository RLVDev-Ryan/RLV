import crypto from 'crypto';
import { YggdrasilClient } from '@xmcl/user';
import type { Account } from '../../shared/constants';

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
): Promise<Account | null> {
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
      // Store the email so the dialog can pre-fill it next time
    };

    return account;
  } catch (error) {
    console.error('Yggdrasil authentication failed:', error);
    return null;
  }
}

import Link from 'next/link';
import { chatGPTSignOutPath, type ChatGPTUser } from '@/app/chatgpt-auth';
import { SiteHeader } from './SiteHeader';

export function PortalHeader({user}:{user:ChatGPTUser}) {
  return <><SiteHeader portal/><div className="account-bar"><div className="shell account-inner"><span>Signed in as <strong>{user.displayName}</strong>{user.role==='admin'&&<b className="admin-badge">Studio admin</b>}</span><div className="account-actions">{user.role==='admin'&&<Link href="/portal/operations">Production operations</Link>}<Link href={chatGPTSignOutPath('/')}>Sign out</Link></div></div></div></>;
}

import Link from 'next/link';
import { chatGPTSignOutPath, type ChatGPTUser } from '@/app/chatgpt-auth';
export function PortalHeader({user}:{user:ChatGPTUser}){return <><SiteHeader portal/><div className="account-bar"><div className="shell account-inner"><span>Signed in as <strong>{user.displayName}</strong></span><Link href={chatGPTSignOutPath('/')}>Sign out</Link></div></div></>}
import { SiteHeader } from './SiteHeader';

import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {AdminUserControls} from '@/components/AdminUserControls';
import {PortalHeader} from '@/components/PortalHeader';
import {isStudioAdmin,listStudioAdminUsers} from '@/lib/data';

export const dynamic='force-dynamic';
export const metadata={title:'Studio users'};
function shortDate(value:string|null){return value?new Date(value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Never';}
function label(value:string|null|undefined){return value?value.replaceAll('_',' ').replace(/\b\w/g,character=>character.toUpperCase()):'None';}

export default async function StudioUsersPage(){
  const admin=await requireChatGPTUser('/portal/users');
  if(!isStudioAdmin(admin))notFound();
  const users=await listStudioAdminUsers(admin);
  const totals={
    active:users.filter(user=>user.studio_access_status==='active').length,
    linked:users.filter(user=>user.account_user_id).length,
    partners:users.filter(user=>user.partner_status).length,
    sessions:users.reduce((sum,user)=>sum+user.active_sessions,0),
  };
  return <main className="portal-page"><PortalHeader user={admin}/>
    <section className="portal-head"><div className="shell portal-title-row"><div>
      <p className="eyebrow"><span>●</span> Studio admin only</p>
      <h1>Studio users</h1>
      <p>Account identity links, Studio access, Partner eligibility, projects, verification, and active sessions.</p>
    </div><Link className="button button-outline" href="/portal/operations">Production operations</Link></div></section>
    <section className="portal-content"><div className="shell">
      <div className="operations-stats">
        <div><span>Users</span><strong>{users.length}</strong></div>
        <div><span>Active</span><strong>{totals.active}</strong></div>
        <div><span>Account linked</span><strong>{totals.linked}</strong></div>
        <div><span>Partner records</span><strong>{totals.partners}</strong></div>
        <div><span>Active sessions</span><strong>{totals.sessions}</strong></div>
      </div>
      {users.length===0?<div className="empty-state"><span>00</span><h2>No Studio users yet.</h2></div>:
        <div className="studio-user-list">{users.map(user=>{
          const protectedAccount=user.id===admin.userId||user.studio_admin_claim===1||isStudioAdmin(user.email);
          return <article className={`portal-card studio-user-row ${user.studio_access_status==='suspended'?'suspended':''}`} key={user.id}>
            <div className="studio-user-heading"><div>
              <span>{user.studio_admin_claim?'ACCOUNT ADMIN':user.auth_source==='account'?'ACCOUNT LINKED':'LEGACY STUDIO'}</span>
              <h2>{user.display_name}</h2><p>{user.email}</p>
            </div><div className="studio-user-status"><b>{label(user.studio_access_status)}</b><small>Last login {shortDate(user.last_login_at)}</small></div></div>
            <div className="studio-user-facts">
              <div><span>Email</span><strong>{user.email_verified_at?'Verified':'Unverified'}</strong></div>
              <div><span>Plan</span><strong>{label(user.account_tier)} · {label(user.subscription_status)}</strong></div>
              <div><span>Partner eligibility</span><strong>{user.studio_partner_eligible?'Eligible':'Not eligible'}</strong></div>
              <div><span>Application</span><strong>{label(user.partner_status)}</strong></div>
              <div><span>Projects</span><strong>{user.project_count}</strong></div>
              <div><span>Sessions</span><strong>{user.active_sessions}</strong></div>
            </div>
            <div className="studio-user-verification">
              {user.partner_status&&<><span className={user.pro_verified?'done':''}>Pro</span><span className={user.identity_verified?'done':''}>Identity</span><span className={user.tax_verified?'done':''}>Tax + payout</span><Link href="/portal/studio-partners">Open application →</Link></>}
              {user.account_user_id&&<a href={`https://account.inchframe.com/admin/accounts/${user.account_user_id}`} target="_blank" rel="noreferrer">Open Account record ↗</a>}
            </div>
            <AdminUserControls id={user.id} suspended={user.studio_access_status==='suspended'} protectedAccount={protectedAccount}/>
          </article>;
        })}</div>}
    </div></section>
  </main>;
}

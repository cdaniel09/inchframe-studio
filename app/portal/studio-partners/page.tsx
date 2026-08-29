import Link from 'next/link';
import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { CreatorReviewControls } from '@/components/CreatorReviewControls';
import { isStudioAdmin,listCreatorApplications,listCreatorProjects } from '@/lib/data';
import { shortDate,titleCase } from '@/lib/format';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Studio Partner desk'};
function money(value:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);}
function changedFields(value:string){try{const parsed=JSON.parse(value) as unknown;return Array.isArray(parsed)?parsed.filter(item=>typeof item==='string') as string[]:[];}catch{return[];}}

export default async function PortalCreatorsPage(){
  const user=await requireChatGPTUser('/portal/studio-partners');
  const admin=isStudioAdmin(user),profiles=await listCreatorApplications(user);
  const requests=admin?[]:await listCreatorProjects(user);
  return <main className="portal-page"><PortalHeader user={user}/>
    <section className="portal-head"><div className="shell portal-title-row"><div><p className="eyebrow"><span>●</span> Inchframe Pro Studio</p><h1>{admin?'Studio Partner applications':'Studio Partner desk'}</h1><p>{admin?'Verify Paid Pro membership, identity, and tax/payout readiness before publishing approved profiles.':'Manage your Studio Partner profile, private requests, proposals, and Inchframe-led assignments.'}</p></div>{!admin&&<Link className="button button-green" href="/studio-partners/apply">{profiles.length?'Edit application':'Apply now'} →</Link>}</div></section>
    <section className="portal-content"><div className="shell">
      {!admin&&profiles.some(profile=>profile.status==='approved')&&<section className="creator-request-section"><div className="card-heading"><div><span>PRIVATE WORK QUEUE</span><h2>Project requests + assignments</h2></div></div>{requests.length===0?<div className="empty-state compact-empty"><span>00</span><h2>No requests yet.</h2><p>Customers can request you from your public Studio Partner page; Inchframe can also route one matched brief at a time.</p></div>:<div className="project-list">{requests.map((project,index)=><Link className="project-row" href={`/portal/projects/${project.id}`} key={project.id}><span className="project-number">{String(index+1).padStart(2,'0')}</span><div className="project-main"><span>{titleCase(project.project_type)}</span><h2>{project.title}</h2><small>Target {shortDate(project.due_date)}</small></div><div className="project-meta"><span className={`status ${project.status}`}>{titleCase(project.status)}</span><small>Updated {shortDate(project.updated_at)}</small></div><b aria-hidden="true">→</b></Link>)}</div>}</section>}

      {profiles.length===0?<div className="empty-state"><span>00</span><h2>{admin?'No Studio Partner applications yet.':'No application yet.'}</h2><p>{admin?'Studio Partner applications will appear here.':'Eligible paid members can submit a Studio Partner profile for review.'}</p>{!admin&&<Link className="button button-green" href="/studio-partners/apply">Start application</Link>}</div>:<div className="creator-admin-list">{profiles.map(profile=>{const changes=changedFields(profile.pending_change_fields);return <article className="portal-card creator-admin-card" key={profile.id}>{profile.avatar_object_key?<img src={`/api/creator-icons/${profile.id}`} alt=""/>:<div className="creator-avatar-placeholder" aria-hidden="true">IF</div>}<div><div className="card-heading"><div><span>{profile.status.toUpperCase()}</span><h2>{profile.display_name}</h2></div></div><strong>{profile.headline}</strong><p>{profile.bio}</p><div className="creator-admin-meta"><span>{profile.owner_email}</span><span>Pro email: {profile.inchframe_email}</span><span>{money(profile.rate_min)}–{money(profile.rate_max)} / {profile.rate_unit}</span><span>{profile.location}</span></div><div className="sample-list compact">{profile.samples.map(sample=><a href={sample.url} target="_blank" rel="noreferrer nofollow" key={sample.id}><strong>{sample.title}</strong><b>↗</b></a>)}</div>{profile.pending_change_at&&<div className="partner-change-notice"><strong>{admin?'Partner changed values':'Changes waiting for Studio review'}</strong><p>{admin?(changes.join(', ')||'Profile resubmitted'):'Your editable profile was submitted again for acceptance.'}</p><small>Submitted {shortDate(profile.pending_change_at)}</small></div>}{admin?<CreatorReviewControls id={profile.id} status={profile.status} proVerified={profile.pro_verified===1} identityVerified={profile.identity_verified===1} taxVerified={profile.tax_verified===1}/>:profile.status==='approved'?<Link className="button button-small button-outline" href={`/studio-partners/${profile.slug}`}>View public profile →</Link>:<p className="stage-message">Studio review status: <strong>{profile.status}</strong>. Updating the profile returns it to review.</p>}</div></article>})}</div>}
    </div></section>
  </main>;
}

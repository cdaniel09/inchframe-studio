import { notFound } from 'next/navigation';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { PortalHeader } from '@/components/PortalHeader';
import { UploadPanel } from '@/components/UploadPanel';
import { ReviewControls } from '@/components/ReviewControls';
import { AdminInquiryControls } from '@/components/AdminInquiryControls';
import { ProjectUnlockForm } from '@/components/ProjectUnlockForm';
import { AdvancedIntakeForm } from '@/components/AdvancedIntakeForm';
import { QuoteControls } from '@/components/QuoteControls';
import { CreatorAssignmentControls } from '@/components/CreatorAssignmentControls';
import { ProStudioRoutingControls } from '@/components/ProStudioRoutingControls';
import { ProductionAgreement } from '@/components/ProductionAgreement';
import { ProjectActivityLog } from '@/components/ProjectActivityLog';
import { getProjectBundle,isStudioAdmin,listProStudioProposals,listPublicCreators,platformFeeBps,studioMinimumCents } from '@/lib/data';
import { fileSize,shortDate,titleCase } from '@/lib/format';

export const dynamic='force-dynamic';
export default function ProjectPage({params}:{params:Promise<{id:string}>}){return <ProjectContent params={params}/>;}

async function ProjectContent({params}:{params:Promise<{id:string}>}) {
  const{id}=await params;
  const user=await requireChatGPTUser(`/portal/projects/${id}`);
  const bundle=await getProjectBundle(id,user);
  if(!bundle)notFound();
  const admin=isStudioAdmin(user);
  const creatorViewer=!admin&&bundle.project.owner_id!==user.userId;
  const viewer=admin?'admin':creatorViewer?'creator':'client';
  const clientUnlocked=Boolean(bundle.project.advanced_unlocked_at);
  const canDecide=!admin&&!creatorViewer;
  const seeds=bundle.assets.filter(asset=>asset.kind==='seed');
  const audio=bundle.assets.filter(asset=>asset.kind==='audio');
  const reviews=bundle.assets.filter(asset=>asset.kind==='review');
  const deliveries=bundle.assets.filter(asset=>asset.kind==='deliverable');
  let formats='To confirm';try{formats=(JSON.parse(bundle.project.aspect_ratios||'[]') as string[]).join(', ')||'To confirm';}catch{}
  const showProduction=admin||clientUnlocked;
  const advancedFormProject={advanced_brief:bundle.project.advanced_brief,must_have:bundle.project.must_have,avoid_notes:bundle.project.avoid_notes,reference_links:bundle.project.reference_links,audio_notes:bundle.project.audio_notes,aspect_ratios:bundle.project.aspect_ratios,style_notes:bundle.project.style_notes};
  const eligibleCreators=admin?(await listPublicCreators()).filter(creator=>creator.pro_verified===1&&creator.identity_verified===1&&creator.tax_verified===1).map(creator=>({id:creator.id,displayName:creator.display_name,minimum:Math.max(studioMinimumCents()/100,creator.rate_min)})):[];
  const proStudioProposals=admin?await listProStudioProposals(id,user):[];
  const quoteView=bundle.quote?{quote:bundle.quote.quote,offers:bundle.quote.offers,creator:{id:bundle.quote.creator.id,display_name:bundle.quote.creator.display_name,headline:bundle.quote.creator.headline,rate_min:bundle.quote.creator.rate_min}}:null;

  return <main className="portal-page">
    <PortalHeader user={user}/>
    <section className="project-banner"><div className="shell">
      <a className="back-link" href={creatorViewer?'/portal/creators':'/portal'}>← {creatorViewer?'Partner desk':'All projects'}</a>
      <div className="project-title-grid"><div><p className="eyebrow"><span>●</span> {titleCase(bundle.project.project_type)}</p><h1>{bundle.project.title}</h1><p>{bundle.project.brief}</p></div>
      <div className="project-facts"><div><span>Status</span><strong>{titleCase(bundle.project.status)}</strong></div><div><span>Target date</span><strong>{shortDate(bundle.project.due_date)}</strong></div><div><span>Budget</span><strong>{titleCase(bundle.project.budget_range)||'To discuss'}</strong></div>{bundle.quote&&<div><span>Creator</span><strong>{bundle.quote.creator.display_name}</strong></div>}</div></div>
    </div></section>
    <section className="project-content"><div className="shell project-layout">
      <aside><nav className="project-nav"><a href="#overview">Quote + assignment</a>{showProduction&&<><a href="#agreement">Work agreement</a><a href="#activity">Updates + messages <b>{bundle.activity.length}</b></a><a href="#advanced">Advanced brief</a><a href="#seeds">Seed library <b>{seeds.length}</b></a><a href="#audio">Audio <b>{audio.length}</b></a><a href="#review">Review queue <b>{reviews.length}</b></a><a href="#delivery">Final delivery <b>{deliveries.length}</b></a></>}</nav>
      <div className="brief-card"><span>Client</span><strong>{creatorViewer?'Private Studio client':bundle.project.owner_email}</strong><span>Audience</span><p>{bundle.project.audience||'Not specified'}</p><span>Platforms</span><p>{bundle.project.platforms||'Not specified'}</p><span>Budget</span><p>{titleCase(bundle.project.budget_range)||'Not specified'}</p>{showProduction&&<><span>Formats</span><p>{formats}</p><span>Style direction</span><p>{bundle.project.style_notes||'Not specified'}</p></>}</div></aside>
      <div className="project-sections">
        <section id="overview" className="portal-card"><div className="card-heading"><div><span>PRIVATE PROJECT DESK</span><h2>{bundle.quote?'Quote and Studio Partner':admin?'Route this inquiry':'What happens next'}</h2></div></div>
          {quoteView?<QuoteControls projectId={id} bundle={quoteView} viewer={viewer} platformMinimum={studioMinimumCents()} feeBps={platformFeeBps()}/>:admin?<><ProStudioRoutingControls projectId={id} status={bundle.project.marketplace_status} proposals={proStudioProposals}/><CreatorAssignmentControls projectId={id} creators={eligibleCreators}/><details className="legacy-access"><summary>Manual Studio access exception</summary><AdminInquiryControls projectId={id} status={bundle.project.status}/></details></>:<ClientGate projectId={id} status={bundle.project.status} unlocked={clientUnlocked}/>}
        </section>
        {showProduction&&<section id="agreement" className="portal-card"><div className="card-heading"><div><span>SCOPE + TIMEFRAME</span><h2>Production agreement</h2></div></div><ProductionAgreement projectId={id} agreement={bundle.agreement} viewer={viewer} defaultGoal={bundle.project.brief} defaultTargetDate={bundle.project.due_date}/></section>}
        {showProduction&&<section id="activity" className="portal-card"><div className="card-heading"><div><span>PROJECT RECORD</span><h2>Communication + progress log</h2></div></div><ProjectActivityLog projectId={id} items={bundle.activity} viewer={viewer}/></section>}
        {showProduction&&<section id="advanced" className="portal-card"><div className="card-heading"><div><span>ADVANCED INTAKE</span><h2>Production details</h2></div></div>{admin||creatorViewer?<AdvancedSummary project={bundle.project}/>:<AdvancedIntakeForm projectId={id} project={advancedFormProject}/>}</section>}
        {showProduction&&<section className="portal-card"><div className="card-heading"><div><span>UPLOADS</span><h2>{admin||creatorViewer?'Add work for review':'Add images and audio'}</h2></div></div><UploadPanel projectId={id} isAdmin={admin||creatorViewer}/></section>}
        {showProduction&&<><AssetSection title="Image seeds" id="seeds" empty="No seed images have been added yet." assets={seeds} comments={bundle.comments} decisions={bundle.decisions} projectId={id} canDecide={false}/><AssetSection title="Reference audio" id="audio" empty="No audio references have been added yet." assets={audio} comments={bundle.comments} decisions={bundle.decisions} projectId={id} canDecide={false}/><AssetSection title="Review queue" id="review" empty={admin||creatorViewer?'Upload a review version when it is ready for the client.':'Nothing needs your review right now.'} assets={reviews} comments={bundle.comments} decisions={bundle.decisions} projectId={id} canDecide={canDecide}/><AssetSection title="Final delivery" id="delivery" empty="Accepted final files will appear here." assets={deliveries} comments={bundle.comments} decisions={bundle.decisions} projectId={id} canDecide={canDecide}/></>}
      </div>
    </div></section>
  </main>;
}

function ClientGate({projectId,status,unlocked}:{projectId:string;status:string;unlocked:boolean}) {
  if(unlocked)return <div className="stage-message good"><strong>Advanced workspace unlocked.</strong><p>Add the detailed brief, seed images, reference audio, and links below.</p></div>;
  if(status==='accepted_pending_access')return <ProjectUnlockForm projectId={projectId}/>;
  if(status==='accepted_email_failed')return <div className="stage-message"><strong>Your inquiry was accepted.</strong><p>The Studio is retrying the access email. You do not need to submit another inquiry.</p></div>;
  if(status==='declined')return <div className="stage-message warn"><strong>This inquiry is not moving into production.</strong><p>Contact info@inchframe.com if the scope or budget has changed.</p></div>;
  if(status==='quote_declined')return <div className="stage-message warn"><strong>The current Studio Partner quote is closed.</strong><p>Return to the Studio Partner Directory or ask the Studio to route another fit.</p></div>;
  if(status==='pro_studio_requested')return <div className="stage-message"><strong>Pro Studio review requested.</strong><p>Inchframe is reviewing your brief and choosing the best production path.</p></div>;
  if(status==='pro_studio_published')return <div className="stage-message"><strong>Your Pro Studio opportunity is open.</strong><p>Studio Partner proposals are private. If one fits, Inchframe will send it to you for review.</p></div>;
  return <div className="stage-message"><strong>{status==='inquiry_received'?'Match request received.':'Studio Partner request sent.'}</strong><p>{status==='inquiry_received'?'Inchframe will route the brief to one Studio Partner.':'The selected Studio Partner will review the brief and send a private customer-facing quote.'}</p></div>;
}

function AdvancedSummary({project}:{project:import('@/lib/data').StudioProject}) {
  return <div className="advanced-summary"><div><span>Detailed context</span><p>{project.advanced_brief||'Not supplied yet.'}</p></div><div><span>Must have</span><p>{project.must_have||'Not supplied.'}</p></div><div><span>Avoid</span><p>{project.avoid_notes||'Not supplied.'}</p></div><div><span>Reference links</span><p className="preserve-lines">{project.reference_links||'Not supplied.'}</p></div><div><span>Audio notes</span><p>{project.audio_notes||'Not supplied.'}</p></div></div>;
}

function AssetSection({title,id,empty,assets,comments,decisions,projectId,canDecide}:{title:string;id:string;empty:string;assets:import('@/lib/data').StudioAsset[];comments:import('@/lib/data').StudioComment[];decisions:import('@/lib/data').StudioDecision[];projectId:string;canDecide:boolean}) {
  return <section id={id} className="portal-card"><div className="card-heading"><div><span>{String(assets.length).padStart(2,'0')} FILES</span><h2>{title}</h2></div></div>{assets.length===0?<p className="empty-line">{empty}</p>:<div className="asset-grid">{assets.map(asset=><article className="asset-card" key={asset.id}><div className={`asset-media ${asset.mime_type.startsWith('audio/')?'audio-media':''}`}>{asset.mime_type.startsWith('video/')?<video controls preload="metadata" src={`/api/files/${asset.id}`}/>:asset.mime_type.startsWith('audio/')?<audio controls preload="metadata" src={`/api/files/${asset.id}`}/>:<img src={`/api/files/${asset.id}`} alt={asset.label||asset.filename}/>}<span className={`asset-status ${asset.status}`}>{titleCase(asset.status)}</span></div><div className="asset-info"><div><span>{titleCase(asset.kind)} · V{asset.version}</span><strong>{asset.label||asset.filename}</strong><small>{fileSize(asset.byte_size)} · {shortDate(asset.created_at)}</small></div><a href={`/api/files/${asset.id}`} target="_blank" rel="noreferrer">Open ↗</a></div>{comments.filter(comment=>comment.asset_id===asset.id).length>0&&<div className="comment-list">{comments.filter(comment=>comment.asset_id===asset.id).map(comment=><div key={comment.id}><strong>{comment.author_email}</strong><p>{comment.body}</p><small>{shortDate(comment.created_at)}</small></div>)}</div>}{decisions.filter(decision=>decision.asset_id===asset.id).map(decision=><div className={`delivery-decision ${decision.decision}`} key={decision.id}><strong>{decision.decision==='approved'&&asset.kind==='deliverable'?'Final delivery accepted':titleCase(decision.decision)}</strong><p>{decision.note||'Recorded without an additional note.'}</p><small>{decision.author_email} · {shortDate(decision.created_at)}</small></div>)}{!['seed','audio'].includes(asset.kind)&&<ReviewControls projectId={projectId} assetId={asset.id} canDecide={canDecide}/>}</article>)}</div>}</section>;
}

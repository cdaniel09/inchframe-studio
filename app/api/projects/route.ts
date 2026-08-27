import { getChatGPTUser } from '@/app/chatgpt-auth';
import { checkRateLimit,createProject,getPublicCreatorBySlug } from '@/lib/data';
import { sendInquiryReceivedEmails,sendProjectWorkflowEmail } from '@/lib/email';

function clean(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function requestedSlug(request:Request,body:Record<string,unknown>){
  const direct=clean(body.creatorSlug,100);
  if(direct)return direct;
  try{
    const referer=request.headers.get('referer');
    return referer?new URL(referer).searchParams.get('creator')?.slice(0,100)||'':'';
  }catch{return'';}
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Your session is no longer valid. Sign in again to continue.'},{status:401});
  if(user.role!=='client')return Response.json({error:'Use a client account to submit an inquiry.'},{status:403});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site request rejected.'},{status:403});

  let body:Record<string,unknown>;
  try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({error:'Invalid request.'},{status:400});}
  if(clean(body.companyWebsite,200))return Response.json({error:'Could not submit this inquiry.'},{status:400});
  const allowed=await checkRateLimit('project-inquiry',user.userId,5,24*60*60*1000);
  if(!allowed)return Response.json({error:'You have reached today’s inquiry limit. Contact info@inchframe.com if you need help.'},{status:429});

  const title=clean(body.title,120),projectType=clean(body.projectType,40),brief=clean(body.brief,1500);
  const budgetRange=clean(body.budgetRange,40),audience=clean(body.audience,300),platforms=clean(body.platforms,300);
  if(!title||!projectType||!brief||!budgetRange)return Response.json({error:'Title, project type, brief, and budget are required.'},{status:400});
  if(!['music_video','visualizer','brand_film','launch_clip','other'].includes(projectType))return Response.json({error:'Invalid project type.'},{status:400});
  if(!['under_500','500_1000','1000_2500','2500_5000','5000_plus'].includes(budgetRange))return Response.json({error:'Invalid project budget.'},{status:400});
  const dueDate=clean(body.dueDate,10);
  if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return Response.json({error:'Invalid delivery date.'},{status:400});

  const creatorSlug=requestedSlug(request,body);
  const creator=creatorSlug?await getPublicCreatorBySlug(creatorSlug):null;
  if(creatorSlug&&!creator)return Response.json({error:'That Studio Partner is no longer available. Choose another partner or use a private Studio match.'},{status:409});
  const routingMode=creator?'direct':clean(body.routingMode,30)||'match';
  if(!['direct','match','pro_studio'].includes(routingMode))return Response.json({error:'Invalid routing option.'},{status:400});
  const marketplaceRequested=routingMode==='pro_studio';
  const id=await createProject(user,{title,projectType,brief,audience,platforms,dueDate:dueDate||null,budgetRange,requestedCreator:creator,marketplaceRequested});

  let emailSent=true;
  try{
    await sendInquiryReceivedEmails({
      email:user.email,displayName:user.displayName,projectId:id,title,projectType,
      brief:creator?`Requested Studio Partner: ${creator.display_name}\n\n${brief}`:marketplaceRequested?`Requested Pro Studio review\n\n${brief}`:brief,
      audience,platforms,dueDate:dueDate||null,budgetRange
    });
  }catch(error){emailSent=false;console.error('Inquiry notification email failed',error);}
  if(creator){
    try{await sendProjectWorkflowEmail({to:creator.owner_email,subject:`New private project request: ${title}`,heading:'A customer requested your production profile.',message:'Review the essential brief, then send the customer-facing total and scope note inside Studio.',projectId:id});}
    catch(error){emailSent=false;console.error('Creator request email failed',error);}
  }
  return Response.json({id,emailSent},{status:201});
}

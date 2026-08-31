import 'server-only';

export function studioComingSoon(){
  return (process.env.STUDIO_LAUNCH_STATUS||'coming_soon').trim().toLowerCase()!=='live';
}

export function studioPartnerApplicationsOpen(){
  return (process.env.STUDIO_PARTNER_APPLICATIONS_OPEN||'false').trim().toLowerCase()==='true';
}

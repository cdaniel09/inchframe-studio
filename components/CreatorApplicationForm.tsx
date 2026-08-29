'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreatorProfile } from '@/lib/data';

export function CreatorApplicationForm({profile,accountEmail,internalPartner=false}:{profile:CreatorProfile|null;accountEmail:string|null;internalPartner?:boolean}) {
  const router=useRouter();
  const[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/creators',{method:'POST',body:new FormData(event.currentTarget),credentials:'include'});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Could not submit your Studio Partner application.');router.push('/portal/studio-partners');router.refresh();}catch(reason){setError(reason instanceof Error?reason.message:'Could not submit your application.');setBusy(false);}}
  const samples=profile?.samples||[];
  return <form className="intake-form creator-application" onSubmit={submit}>
    <div className="form-section"><span className="form-step">01</span><div><h2>Production profile</h2><p>{internalPartner?'This internal profile is used for Studio assignments and remains out of the public directory.':'This becomes your public profile after Studio approval.'}</p></div></div>
    <div className="form-grid">
      <label><span>Studio Partner display name</span><input name="displayName" required maxLength={80} defaultValue={profile?.display_name||''}/></label>
      <label><span>Location / time zone</span><input name="location" required maxLength={100} placeholder="Los Angeles · Pacific" defaultValue={profile?.location||''}/></label>
      <label className="wide"><span>Profile headline</span><input name="headline" required maxLength={120} placeholder="AI filmmaker focused on music-led surrealism" defaultValue={profile?.headline||''}/></label>
      <label className="wide"><span>Short production bio</span><textarea name="bio" required maxLength={1200} rows={5} placeholder="Your strengths, production approach, and the kinds of briefs you handle best." defaultValue={profile?.bio||''}/></label>
      <label className="wide"><span>Specialties</span><input name="specialties" required maxLength={300} placeholder="Music videos, product films, character animation" defaultValue={profile?.specialties||''}/></label>
      <label><span>Availability</span><input name="availability" required maxLength={120} placeholder="2 projects / month" defaultValue={profile?.availability||''}/></label>
      <label><span>Rate basis</span><select name="rateUnit" required defaultValue={profile?.rate_unit||'project'}><option value="project">Per project</option><option value="day">Day rate</option><option value="hour">Hourly</option></select></label>
      <label><span>Rate from (USD)</span><input name="rateMin" type="number" min="1" max="1000000" required defaultValue={profile?.rate_min||''}/></label>
      <label><span>Rate to (USD)</span><input name="rateMax" type="number" min="1" max="1000000" required defaultValue={profile?.rate_max||''}/></label>
      <label className="wide"><span>Inchframe account email</span><input name="inchframeEmail" type="email" required readOnly={Boolean(profile)||Boolean(accountEmail)} maxLength={254} defaultValue={profile?.inchframe_email||accountEmail||''}/><small>{internalPartner?'Internal Studio account used for private production access.':'Used privately to verify your active Paid Pro subscription. It is never shown publicly.'}{profile?' Contact the Studio if this account changes.':''}</small></label>
    </div>
    <div className="form-section section-gap"><span className="form-step">02</span><div><h2>Icon + work links</h2><p>Upload one profile icon. Link to work hosted elsewhere—do not upload sample media.</p></div></div>
    <div className="form-grid">
      <label className="wide"><span>Profile icon {profile?.avatar_object_key?'(replace only if needed)':internalPartner?'(optional)':'(required)'}</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required={!profile?.avatar_object_key&&!internalPartner}/><small>JPG, PNG, or WebP · 3 MB maximum. Internal profiles use the Inchframe fallback icon when omitted.</small></label>
      {Array.from({length:5},(_,index)=><div className="sample-fields wide" key={index}><label><span>Sample {index+1} title</span><input name={`sampleTitle${index+1}`} maxLength={100} defaultValue={samples[index]?.title||''}/></label><label><span>Sample {index+1} link</span><input name={`sampleUrl${index+1}`} type="url" maxLength={500} placeholder="https://…" defaultValue={samples[index]?.url||''}/></label></div>)}
    </div>
    {internalPartner?<div className="creator-terms"><strong>Inchframe house production profile</strong><p>This account follows the same project, quote, agreement, communication, review, and delivery workflow. Independent-contractor verification does not apply.</p></div>:<><div className="creator-terms">
      <label className="rights-check"><input name="proConfirmed" type="checkbox" value="yes" required defaultChecked={profile?.pro_confirmed===1}/><span>I have an active paid Inchframe Pro subscription. I understand the Studio will verify it before certification.</span></label>
      <label className="rights-check"><input name="contractorConfirmed" type="checkbox" value="yes" required/><span>I understand Studio Partners work as independent production subcontractors on Inchframe-led projects, not as employees.</span></label>
      <label className="rights-check"><input name="contactConfirmed" type="checkbox" value="yes" required/><span>I will keep client contact, scoping, and project communication inside Inchframe. Inchframe handles Studio Partner introductions.</span></label>
    </div>
      <label className="rights-check"><input name="verificationConfirmed" type="checkbox" value="yes" required/><span>Before accepting paid work, I will complete identity, tax-form, and payout verification through Inchframe’s approved provider. I remain responsible for my own taxes and business obligations.</span></label></>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="submit-row"><p>Submitting returns the profile to Studio review.</p><button className="button button-green" disabled={busy} type="submit">{busy?'Submitting…':profile?'Update application →':'Apply for certification →'}</button></div>
  </form>;
}

export function titleCase(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
export function shortDate(value:string|null){if(!value)return'Not set';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));}
export function fileSize(bytes:number){if(bytes<1024*1024)return`${Math.max(1,Math.round(bytes/1024))} KB`;return`${(bytes/1024/1024).toFixed(1)} MB`;}

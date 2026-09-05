// Read-only recovery report. Never deletes files or releases quota.
import path from 'node:path';
import {stat} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';

const database=path.resolve(process.env.DATABASE_PATH||'data/inchframe-studio.sqlite');
const root=path.resolve(process.env.UPLOAD_DIR||'data/uploads');
const db=new DatabaseSync(database,{readOnly:true});
try{
  const rows=db.prepare('SELECT id,project_id,owner_id,byte_size,file_count,created_at,object_keys FROM upload_reservations ORDER BY created_at').all();
  const report=[];
  for(const row of rows){
    let keys;try{keys=JSON.parse(row.object_keys);}catch{keys=[];}
    const files=[];
    for(const key of Array.isArray(keys)?keys:[]){
      if(typeof key!=='string')continue;
      const target=path.resolve(root,...key.split('/'));
      if(!target.startsWith(root+path.sep)){files.push({key,error:'outside upload root'});continue;}
      const reference=db.prepare('SELECT id FROM assets WHERE object_key=?').get(key)
        ||db.prepare('SELECT id FROM creator_profiles WHERE avatar_object_key=?').get(key);
      try{const info=await stat(target);files.push({key,exists:true,bytes:info.size,referenced:Boolean(reference)});}
      catch(error){files.push({key,exists:error.code==='ENOENT'?false:null,error:error.code});}
    }
    report.push({...row,object_keys:undefined,files});
  }
  console.log(JSON.stringify({database,uploads:root,reservations:report},null,2));
}finally{db.close();}

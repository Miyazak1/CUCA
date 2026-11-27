// Retry-After is always a lower bound. Extended authoring jobs keep their
// checkpoints and wait longer rather than declaring an incomplete locale ready.
export function catalogTranslationRetryDelay(attempt,retryAfter=60,extended=false){
 const count=Math.max(1,Math.floor(Number(attempt)||1));
 const hint=Math.max(60,Number(retryAfter)||60);
 const delay=extended?(count<=6?Math.min(1800,60*2**Math.min(count-1,5)):Math.min(7200,1800*2**Math.min(count-6,2))):Math.min(300,60*count);
 return 1000*Math.max(hint,delay);
}

// Restarts must inherit the last provider event, not start a new short retry
// sequence or shift the cooldown forward from the restart time.
export function catalogTranslationResumeState(status){
 if(status?.state!=='rate-limited')return null;
 const retry=Number(status.retry),updatedAt=Date.parse(status.updatedAt),resumeAt=Date.parse(status.resumeAt);
 if(!Number.isSafeInteger(retry)||retry<1||!Number.isFinite(updatedAt)||!Number.isFinite(resumeAt)||resumeAt<updatedAt)throw new Error('Invalid persisted translation cooldown; retain checkpoints for inspection');
 return {retry,notBefore:Math.max(resumeAt,updatedAt+catalogTranslationRetryDelay(retry,60,true))};
}

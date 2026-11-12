import assert from "node:assert/strict";
import pg from "pg";
import {assertLocalDevelopmentState,localDatabaseUrl,localSyntheticAccounts} from "./local-development.ts";
import {decryptMfaSecret,mfaKeyringFromEnv,totpCode} from "../../src/server/auth/mfa-crypto.ts";

// Only the managed loopback fixture accounts may use this acceptance helper.
// Complete the normal UI/MFA flow; never disable MFA or its replay protection.
export async function localLayoutLogin(page,state,role){
 assertLocalDevelopmentState(state);
 const account=localSyntheticAccounts(state)[role];assert.ok(account);assert.match(account.email,/@local\.cuac\.invalid$/);
 await page.goto(`http://127.0.0.1:${state.applicationPort}/auth.html?lang=en&role=${role}`);
 await page.locator("[data-auth-email]").fill(account.email);await page.locator("[data-auth-password]").fill(account.password);await page.locator("[data-auth-submit]").click();
 await page.waitForFunction(()=>location.pathname!=="/auth.html"||document.querySelector('[data-auth-panel="mfa"]')?.classList.contains("active"));
 if(new URL(page.url()).pathname!=="/auth.html")return;
 const pool=new pg.Pool({connectionString:localDatabaseUrl(state),ssl:false});
 let factor;
 try{
  for(let attempt=0;attempt<10&&!factor;attempt++){
   factor=(await pool.query('select f.secret_ciphertext as ciphertext,f.secret_iv as iv,f.secret_tag as tag,f.key_id as "keyId",f.last_used_counter as "lastUsedCounter" from auth_mfa_factors f join users u on u.id=f.user_id where u.email=$1',[account.email])).rows[0];
   if(!factor)await new Promise(resolve=>setTimeout(resolve,200));
  }
 }finally{await pool.end();}
 assert.ok(factor,"Normal UI must create or find the synthetic staff MFA factor");
 const keyring=mfaKeyringFromEnv({CUAC_AUTH_MFA_ACTIVE_KEY_ID:"local-v1",CUAC_AUTH_MFA_KEYS_JSON:JSON.stringify({"local-v1":state.sessionSecret})});
 const secret=decryptMfaSecret(factor,keyring);
 let current=totpCode(secret);
 if(factor.lastUsedCounter!==null&&current.counter<=Number(factor.lastUsedCounter)){
  await new Promise(resolve=>setTimeout(resolve,((Number(factor.lastUsedCounter)+1)*30*1000-Date.now())+150));
  current=totpCode(secret);
 }
 await page.locator("[data-mfa-code]").fill(current.code);await page.locator("[data-mfa-submit]").click();
 await page.waitForFunction(()=>location.pathname!=="/auth.html"||!document.querySelector("[data-mfa-recovery-codes]")?.hidden);
 if(new URL(page.url()).pathname==="/auth.html")await page.locator("[data-mfa-continue]").click();
 await page.waitForURL(u=>u.pathname!=="/auth.html");
}

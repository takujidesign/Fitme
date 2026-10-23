// Shared, fail-closed policy; never trusts a client-side admin flag on the server.
export const integrations=['ai','mealPhoto','labelScan','bodyPhoto','payments','donations','line','email','maps'];
export const betaDefaults=()=>({enabled:true,...Object.fromEntries(integrations.map(k=>[k,false]))});
export function allowed(flags,key){return flags?.enabled===false||flags?.[key]===true;}
export function endpointIntegration(path){
 path=path.replace(/^\/api\//,'').split('?')[0];
 if(path.startsWith('admin/'))return null;
 if(path==='ai/meal-photo')return 'mealPhoto';if(path==='ai/body')return 'bodyPhoto';if(path==='label/analyze')return 'labelScan';
 if(path.startsWith('ai/'))return 'ai';
 if(path==='stripe/webhook')return null;// signed server-to-server call from Stripe
 if(/^(stripe\/|slip\/|quote$|orders\/|trainer\/connect|subscription$)/.test(path))return 'payments';
 if(/^(donate\/|supporter\/claim)/.test(path))return 'donations';
 if(/^(auth\/line\/|line\/)/.test(path))return 'line';
 if(/^(auth\/(forgot|resend))$/.test(path))return 'email';
 return null;
}

// Verificación de despliegue: exclusivamente GET a recursos públicos.
const commit=process.argv[2];
const base=process.argv[3]||'https://www.tamaku.co';
for(const route of ['/','/pages/mi-plan.html','/pages/crecimiento.html','/assets/js/core/planes.js','/sw.js']) {
  const response=await fetch(`${base}${route}`,{cache:'no-store'}),body=await response.text();
  console.log(JSON.stringify({route,status:response.status,contentType:response.headers.get('content-type'),title:body.match(/<title>([^<]*)<\/title>/)?.[1],plata:body.includes('<h3>Plata</h3>')||body.includes('nombre: "Plata"'),crecimiento:body.includes('crecimiento'),cache:body.match(/tamaku-v\d+-[\w-]+/)?.[0]}));
}
if(commit) {
  const response=await fetch(`https://api.github.com/repos/tatamako22-ux/tamako/commits/${encodeURIComponent(commit)}/status`,{headers:{'Accept':'application/vnd.github+json'}});
  const data=await response.json();
  console.log(JSON.stringify({githubStatus:response.status,state:data.state,statuses:data.statuses?.map(s=>({state:s.state,description:s.description,url:s.target_url}))}));
  const info=await fetch(`https://api.github.com/repos/tatamako22-ux/tamako/commits/${encodeURIComponent(commit)}`),revision=await info.json();
  if(revision.sha) {
    const despliegues=await fetch(`https://api.github.com/repos/tatamako22-ux/tamako/deployments?sha=${revision.sha}&per_page=5`);
    const lista=await despliegues.json();
    if(Array.isArray(lista))for(const deployment of lista){
      const status=await fetch(deployment.statuses_url),estados=await status.json();
      console.log(JSON.stringify({deployment:deployment.id,environment:deployment.environment,statuses:Array.isArray(estados)?estados.map(e=>({state:e.state,url:e.environment_url})):estados.message}));
    }
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/create-user.js';

test('eliminar acceso verifica propietario y tienda; nunca elimina Auth ni profesionales', async () => {
  const anterior = globalThis.fetch;
  const env = { ...process.env };
  process.env.SUPABASE_URL='https://example.test';
  process.env.SUPABASE_ANON_KEY='anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY='secret';
  try {
    for (const caso of ['ok','ajena','propietario','sinpermiso','error']) {
      const llamadas=[];
      globalThis.fetch=async (url, opciones={}) => {
        llamadas.push({url,opciones});
        let data;
        if(url.endsWith('/auth/v1/user')) data={id:'owner'};
        else if(url.includes('/tiendas?')) data=caso==='sinpermiso'?[]:[{id:'shop'}];
        else if(opciones.method==='DELETE') {
          return {ok:caso!=='error',json:async()=>caso==='error'?{message:'Referencia protegida'}:[{id:'profile'}]};
        } else data=caso==='ajena'?[]:[{id:'profile',user_id:caso==='propietario'?'owner':'staff'}];
        return {ok:true,json:async()=>data};
      };
      const res={status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
      await handler({method:'DELETE',headers:{authorization:'Bearer token'},body:{tienda_id:'shop',perfil_id:'profile'}},res);
      assert.equal(res.code, {ok:200,ajena:404,propietario:403,sinpermiso:403,error:400}[caso]);
      const borrados=llamadas.filter(c=>c.opciones.method==='DELETE');
      assert.equal(borrados.length, ['ok','error'].includes(caso)?1:0);
      for(const llamada of borrados){
        assert.match(llamada.url,/\/perfiles\?id=eq.profile&tienda_id=eq.shop&user_id=eq.staff/);
      }
    }
  } finally {globalThis.fetch=anterior;process.env=env;}
});

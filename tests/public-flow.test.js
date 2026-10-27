import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from '../tmp/ui-tests/node_modules/linkedom/esm/index.js';
import jsQR from '../tmp/qr-tests/node_modules/jsqr/dist/jsQR.js';

test('Inicio, Planes y Registro comparten navegación y enlaces válidos',()=>{
  const menus=[];
  for(const ruta of ['index.html','pages/servicios.html','pages/registro.html']) {
    const {document}=parseHTML(fs.readFileSync(ruta,'utf8'));
    const nav=document.getElementById('tamakuPublicNav');assert.ok(nav,ruta);
    menus.push([...nav.querySelectorAll('.nav-links a')].map(a=>a.textContent));
    for(const link of nav.querySelectorAll('a')) {
      const url=new URL(link.getAttribute('href'),`https://www.tamaku.co/${ruta}`);
      const archivo=url.pathname==='/'?'index.html':url.pathname.slice(1);
      assert.ok(fs.existsSync(archivo),`${ruta}: ${archivo}`);
      if(url.hash)assert.ok(parseHTML(fs.readFileSync(archivo,'utf8')).document.getElementById(url.hash.slice(1)),`${archivo}: ${url.hash}`);
    }
  }
  assert.deepEqual(menus[0],menus[1]);assert.deepEqual(menus[1],menus[2]);
});

test('entradas sin elección van a planes; los planes y enlaces de confirmación siguen abiertos',()=>{
  const codigo=fs.readFileSync('assets/js/core/registration-route.js','utf8');
  for(const [query,hash,redirige] of [['','','sí'],['?plan=incorrecto','','sí'],['?plan=plata','','no'],['?plan=ZAFIRO','','no'],['?plan=premium','','no'],['?plan=prueba','','no'],['?code=confirmacion','','no'],['','#access_token=confirmacion','no']]) {
    const redirecciones=[];vm.runInNewContext(codigo,{URL,URLSearchParams,window:{location:{search:query,hash,href:`https://www.tamaku.co/pages/registro.html${query}${hash}`,replace:url=>redirecciones.push(url)}}});
    assert.equal(redirecciones.length,redirige==='sí'?1:0,query);
    if(redirecciones.length)assert.match(redirecciones[0],/servicios\.html\?origen=registro#planes$/);
  }
});

test('QR comercial real se decodifica a planes en producción con margen de impresión',()=>{
  const {document}=parseHTML(fs.readFileSync('pages/servicios.html','utf8'));
  const contexto=vm.createContext({document,navigator:{userAgent:'Node'},location:{hash:''},URL,Blob,setTimeout,console});
  vm.runInContext(fs.readFileSync('assets/js/vendor/qrcode.min.js','utf8'),contexto);
  vm.runInContext(fs.readFileSync('assets/js/marketing-qr.js','utf8'),contexto);
  const seccion=document.getElementById('qr-comercial');seccion.open=true;
  const {window}=parseHTML('<html></html>');seccion.dispatchEvent(new window.Event('toggle'));
  const svg=document.querySelector('#commercialQrPreview svg');assert.ok(svg);
  const lado=Number(svg.getAttribute('viewBox').split(' ')[2]),escala=10,ancho=lado*escala;
  const pixels=new Uint8ClampedArray(ancho*ancho*4).fill(255);
  for(const match of svg.querySelector('path').getAttribute('d').matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const x=Number(match[1]),y=Number(match[2]);assert.ok(x>=4&&y>=4&&x<lado-4&&y<lado-4);
    for(let dy=0;dy<escala;dy++)for(let dx=0;dx<escala;dx++){const i=((y*escala+dy)*ancho+x*escala+dx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
  }
  const leido=jsQR(pixels,ancho,ancho);
  assert.equal(leido?.data,'https://www.tamaku.co/pages/servicios.html?origen=qr#planes');
  fs.mkdirSync('output/qr-comercial',{recursive:true});fs.writeFileSync('output/qr-comercial/TAMAKU-planes.svg',svg.outerHTML);
});

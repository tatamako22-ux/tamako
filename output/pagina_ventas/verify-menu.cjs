const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
function element() {
  const classes = new Set();
  return {inert:false,hidden:false,attrs:{},events:{},
    classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
    setAttribute(name,value){this.attrs[name]=value;},getAttribute(name){return this.attrs[name];},
    addEventListener(name,fn){this.events[name]=fn;},focus(){this.focused=true;},append(){},querySelectorAll(){return [];}
  };
}
const elements = Object.fromEntries(['menu-toggle','main-navigation','main-content','open-consumo-modal'].map(id=>[id,element()]));
const query = {matches:true,addEventListener(name,fn){this.change=fn;}};
const document = {body:element(),getElementById:id=>elements[id],createElement:()=>element(),addEventListener(){}};
const generated = fs.readFileSync(__dirname+'/index.html','utf8');
const source = generated.match(/<script>([\s\S]*?)<\/script>/)[1].split('const navItems =')[0];
vm.runInNewContext(source,{document,window:{matchMedia:()=>query}});
const button=elements['menu-toggle'],nav=elements['main-navigation'];
assert.equal(nav.inert,true);
button.events.click();
assert.equal(button.attrs['aria-expanded'],'true');
assert.equal(nav.classList.contains('mobile-open'),true);
assert.equal(nav.inert,false);
assert.equal(elements['main-content'].inert,true);
button.events.click();
assert.equal(nav.inert,true);
assert.equal(elements['main-content'].inert,false);
button.events.click();
nav.events.click({target:{closest(selector){assert.equal(selector,'a[target="_blank"]');return {};}}});
assert.equal(button.attrs['aria-expanded'],'false');
button.events.click();query.matches=false;query.change();
assert.equal(nav.inert,false);
assert.equal(nav.classList.contains('mobile-open'),false);
assert.equal(button.attrs['aria-expanded'],'false');
assert.equal(document.body.classList.contains('menu-open'),false);
const css=fs.readFileSync(__dirname+'/modern.css','utf8');
assert.ok(css.includes('@media(max-width:900px)'));
assert.ok(css.includes('.sidebar.mobile-open { visibility:visible; transform:translateX(0); pointer-events:auto; }'));
console.log('PASS: menú móvil abre/cierra, restaura interacción y cambia a escritorio sin bloquear navegación. Validación con DOM simulado; no sustituye prueba visual.');

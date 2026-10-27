(() => {
  const seccion=document.getElementById('qr-comercial');
  if(!seccion)return;
  // Dirección permanente de producción: nunca se imprime localhost.
  const destino='https://www.tamaku.co/pages/servicios.html?origen=qr#planes';
  const estado=document.getElementById('commercialQrStatus');
  let matriz;
  function generar(){
    if(matriz)return matriz;
    if(typeof QRCode!=='function')throw new Error('No se pudo cargar el generador QR. Recarga la página.');
    const codigo=new QRCode(document.getElementById('commercialQrSource'),{text:destino,width:256,height:256,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
    matriz=codigo._oQRCode;
    const ancho=matriz.getModuleCount(),lado=ancho+8;let trazado='';
    for(let y=0;y<ancho;y++)for(let x=0;x<ancho;x++)if(matriz.isDark(y,x))trazado+=`M${x+4} ${y+4}h1v1h-1z`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${lado*24}" height="${lado*24}" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img" aria-label="QR para conocer los planes de TAMAKU"><rect width="${lado}" height="${lado}" fill="white"/><path d="${trazado}" fill="black"/></svg>`;
    document.getElementById('commercialQrPreview').innerHTML=svg;
    return matriz;
  }
  function guardar(blob,nombre){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nombre;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function canvasQr(){const m=generar(),n=m.getModuleCount(),escala=24,c=document.createElement('canvas');c.width=c.height=(n+8)*escala;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(m.isDark(y,x))ctx.fillRect((x+4)*escala,(y+4)*escala,escala,escala);return c;}
  const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No fue posible generar la imagen.')),'image/png'));
  async function descargar(tipo){
    const botones=[...seccion.querySelectorAll('button')];botones.forEach(b=>b.disabled=true);estado.textContent='Preparando tu archivo…';
    try{
      generar();
      if(tipo==='svg')guardar(new Blob([document.getElementById('commercialQrPreview').innerHTML],{type:'image/svg+xml;charset=utf-8'}),'TAMAKU-QR-planes.svg');
      else if(tipo==='png')guardar(await png(canvasQr()),'TAMAKU-QR-planes.png');
      else {
        if(document.fonts)await document.fonts.ready;
        const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2400;const c=canvas.getContext('2d');
        c.fillStyle='#ffffff';c.fillRect(0,0,1800,2400);c.fillStyle='#0b0e10';c.fillRect(0,0,1800,1010);
        const logo=new Image();
        // Recurso del mismo sitio: no envía el enlace a servicios externos.
        await new Promise((resolve,reject)=>{logo.onload=resolve;logo.onerror=()=>reject(new Error('No fue posible cargar el logo. Intenta descargar solo el QR.'));logo.src=new URL('../assets/images/tamaku-logo.svg',location.href).href;});
        c.drawImage(logo,520,150,760,760*logo.naturalHeight/logo.naturalWidth);
        c.textAlign='center';c.fillStyle='#f3efe4';c.font='700 110px Montserrat, sans-serif';c.fillText('Tu negocio,',900,550);c.fillStyle='#e4c47c';c.fillText('mejor organizado.',900,695);
        c.fillStyle='#b8b9b5';c.font='400 46px Montserrat, sans-serif';c.fillText('Agenda · Clientes · Ventas',900,835);
        c.imageSmoothingEnabled=false;c.drawImage(canvasQr(),480,1120,840,840);
        c.fillStyle='#101416';c.font='700 48px Montserrat, sans-serif';c.fillText('Escanea y conoce nuestros planes',900,2070);
        c.fillStyle='#626664';c.font='400 34px Montserrat, sans-serif';c.fillText('Elige tu plan y prueba TAMAKU por 7 días.',900,2150);
        c.fillStyle='#876a30';c.font='700 42px Montserrat, sans-serif';c.fillText('tamaku.co',900,2280);
        guardar(await png(canvas),'TAMAKU-volante-planes-1800x2400.png');
      }
      estado.textContent='Archivo listo. El QR abre los planes de TAMAKU antes del registro.';
    }catch(error){estado.textContent=error.message;}finally{botones.forEach(b=>b.disabled=false);}
  }
  seccion.addEventListener('toggle',()=>{if(seccion.open)try{generar();}catch(error){estado.textContent=error.message;}});
  seccion.querySelectorAll('[data-qr-download]').forEach(b=>b.addEventListener('click',()=>descargar(b.dataset.qrDownload)));
  if(location.hash==='#qr-comercial'){seccion.open=true;try{generar();}catch(error){estado.textContent=error.message;}}
})();

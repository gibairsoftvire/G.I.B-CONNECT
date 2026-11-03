'use strict';
(()=>{
 const MAX_LENGTH=200000;
 function valid(data){return typeof data==='string'&&data.length<=MAX_LENGTH&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data);}
 async function compress(file){
  if(!file||!file.type.startsWith('image/'))throw Error('Choisis un fichier photo.');
  if(file.size>15*1024*1024)throw Error('Choisis une photo de moins de 15 Mo.');
  const url=URL.createObjectURL(file),image=new Image();let bitmap=null;
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Photo illisible. Essaie un fichier JPEG, PNG ou WebP.'));image.src=url;});
   if(typeof image.decode==='function')await image.decode();
   if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>48000000)throw Error('Cette photo est trop grande. Choisis une version réduite.');
   if(typeof createImageBitmap==='function'){try{bitmap=await createImageBitmap(file);}catch(_){/* Repli sur le décodeur image du navigateur. */}}
   const source=bitmap||image,w=bitmap?bitmap.width:image.naturalWidth,h=bitmap?bitmap.height:image.naturalHeight;
   let scale=Math.min(1,1280/Math.max(w,h));
   const canvas=document.createElement('canvas'),blank=document.createElement('canvas'),ctx=canvas.getContext('2d'),empty=blank.getContext('2d');
   if(!ctx||!empty)throw Error('Préparation de photo indisponible sur cet appareil.');
   for(let round=0;round<7;round++){
    canvas.width=blank.width=Math.max(1,Math.round(w*scale));canvas.height=blank.height=Math.max(1,Math.round(h*scale));
    ctx.fillStyle=empty.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);empty.fillRect(0,0,blank.width,blank.height);
    ctx.drawImage(source,0,0,w,h,0,0,canvas.width,canvas.height);
    for(const quality of [0.82,0.68,0.54,0.4]){
     const data=canvas.toDataURL('image/jpeg',quality);
     if(valid(data)){
      if(data===blank.toDataURL('image/jpeg',quality))throw Error('La conversion produit une image blanche. Aucun envoi effectué. Essaie un autre navigateur ou réenregistre la capture en JPG.');
      return data;
     }
    }
    scale*=0.75;
   }
   throw Error('Photo trop volumineuse après compression. Choisis une image plus simple ou recadrée.');
  }finally{bitmap?.close();URL.revokeObjectURL(url);image.src='';}
 }

 function picker({prefix,canAdd,onError}){const file=document.getElementById(prefix+'File'),choose=document.getElementById(prefix+'Choose'),preview=document.getElementById(prefix+'Preview'),image=document.getElementById(prefix+'Image'),remove=document.getElementById(prefix+'Remove'),status=document.getElementById(prefix+'Status');let data='',busy=false,epoch=0;function clear(){epoch++;data='';busy=false;file.value='';image.removeAttribute('src');preview.classList.add('hidden');status.textContent='';}choose.onclick=()=>{if(canAdd())file.click();};remove.onclick=clear;file.onchange=async()=>{if(!canAdd()){clear();return;}const selected=file.files?.[0];if(!selected)return;const current=++epoch;data='';busy=true;preview.classList.add('hidden');status.textContent='Préparation de la photo…';try{const prepared=await compress(selected);if(current!==epoch||!canAdd())return;data=prepared;image.src=data;preview.classList.remove('hidden');status.textContent='Photo prête à être envoyée.';}catch(e){if(current===epoch){status.textContent=e.message;onError(e.message);}}finally{if(current===epoch)busy=false;}};return {clear,peek(){return data;},get(){if(!canAdd())return '';if(busy)throw Error('Patiente pendant la préparation de la photo.');return data;}};}
 const dialog=()=>document.getElementById('photoViewer'),large=()=>document.getElementById('photoViewerImage');
 function close(){const d=dialog();if(d.open)d.close();large().removeAttribute('src');}
 function open(data){if(!valid(data))return;large().src=data;dialog().showModal();}
 function bindViewer(){document.getElementById('photoViewerClose').onclick=close;dialog().addEventListener('close',()=>large().removeAttribute('src'));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindViewer,{once:true});else bindViewer();
 window.gibPhotos=Object.freeze({valid,compress,picker,open,close});
})();

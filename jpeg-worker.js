/* JPEG conversion without browser canvas; codec license in vendor/. */
const window=self;
importScripts('./vendor/jpeg-decoder.js','./vendor/jpeg-encoder.js');
self.onmessage=event=>{try{
 const original=window['jpeg-js'].decode(new Uint8Array(event.data),{useTArray:true,maxResolutionInMP:16,maxMemoryUsageInMB:128});
 if(original.exifBuffer)throw Error('native');
 let scale=Math.min(1,1280/Math.max(original.width,original.height));
 for(let attempt=0;attempt<7;attempt++){
  const width=Math.max(1,Math.round(original.width*scale)),height=Math.max(1,Math.round(original.height*scale)),data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const sx=Math.min(original.width-1,Math.floor(x*original.width/width)),sy=Math.min(original.height-1,Math.floor(y*original.height/height)),a=(sy*original.width+sx)*4,b=(y*width+x)*4;
   data[b]=original.data[a];data[b+1]=original.data[a+1];data[b+2]=original.data[a+2];data[b+3]=255;
  }
  for(const quality of [82,68,54,40]){
   const out=window['jpeg-js'].encode({data,width,height},quality).data;
   if(out.length<=149980){self.postMessage({bytes:out.buffer},[out.buffer]);return;}
  }
  scale*=0.75;
 }
 throw Error('size');
}catch(error){self.postMessage({error:String(error.message||error)});}};

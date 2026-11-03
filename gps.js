'use strict';
(()=>{
 function checked(lat,lon){if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Coordonnées hors limites : latitude ±90°, longitude ±180°.');return {lat,lon};}
 function component(deg,min,sec,hemisphere,max){deg=Number(deg);min=Number(min);sec=Number(sec.replace(',','.'));if(min>=60||sec>=60||deg>max||deg===max&&(min!==0||sec!==0))throw Error('Coordonnées invalides : minutes et secondes doivent être inférieures à 60.');return (deg+min/60+sec/3600)*(['S','W','O'].includes(hemisphere)?-1:1);}
 function parse(text){const raw=String(text||'').trim().toUpperCase().replace(/[′’‘]/g,"'").replace(/[″“”]/g,'"').replace(/\u00a0/g,' ');if(!raw)return {lat:'',lon:''};const dms=/^(\d{1,3})\s*[°º]\s*(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*"\s*([NS])\s*[,;]?\s*(\d{1,3})\s*[°º]\s*(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*"\s*([EWO])$/.exec(raw);if(dms)return checked(component(dms[1],dms[2],dms[3],dms[4],90),component(dms[5],dms[6],dms[7],dms[8],180));const decimal=/^([+-]?\d+(?:\.\d+)?)(?:\s*[,;]\s*|\s+)([+-]?\d+(?:\.\d+)?)$/.exec(raw);if(decimal)return checked(Number(decimal[1]),Number(decimal[2]));throw Error('Colle les deux coordonnées, par exemple : 48°50\'41.2"N 0°58\'21.3"W.');}
 function axis(value,latitude){const tenthSeconds=Math.round(Math.abs(value)*36000),degrees=Math.floor(tenthSeconds/36000),minutes=Math.floor(tenthSeconds%36000/600),seconds=(tenthSeconds%600/10).toFixed(1).padStart(4,'0'),hemisphere=latitude?(value<0?'S':'N'):(value<0?'W':'E');return degrees+'°'+String(minutes).padStart(2,'0')+"'"+seconds+'"'+hemisphere;}
 function format(lat,lon){if(lat===''||lon==='')return '';checked(lat,lon);return axis(lat,true)+' '+axis(lon,false);}
 window.gibGPS=Object.freeze({parse,format});
})();

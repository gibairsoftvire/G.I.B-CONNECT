'use strict';
(()=>{
 let pending=null;
 const buttons=[...document.querySelectorAll('[data-install-app]')];
 const help=document.getElementById('installHelp'),instructions=document.getElementById('installInstructions');
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 function update(){document.querySelectorAll('.install-offer').forEach(e=>e.hidden=standalone());buttons.forEach(b=>{b.disabled=false;b.textContent='Installer l’application';});}
 function guide(){const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);instructions.textContent=ios?'Sur iPhone ou iPad : ouvre ce lien dans Safari, touche Partager, puis Sur l’écran d’accueil et Ajouter.':'Sur Android : ouvre le menu ⋮ de Chrome, puis Installer l’application ou Ajouter à l’écran d’accueil. Sur ordinateur : utilise Chrome ou Edge et l’icône d’installation dans la barre d’adresse. Si l’option manque, actualise la page après la mise à jour.';help.showModal();}
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;update();});
 window.addEventListener('appinstalled',()=>{pending=null;document.querySelectorAll('.install-offer').forEach(e=>e.hidden=true);if(help.open)help.close();});
 buttons.forEach(button=>button.addEventListener('click',async()=>{if(standalone())return update();if(!pending)return guide();const prompt=pending;pending=null;button.disabled=true;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome!=='accepted')update();}catch{update();guide();}finally{button.disabled=false;}}));
 document.getElementById('closeInstallHelp').onclick=()=>help.close();
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{document.querySelectorAll('[data-install-status]').forEach(e=>e.textContent='Installation indisponible : actualise la page en ligne après la mise à jour.');});
 update();
})();

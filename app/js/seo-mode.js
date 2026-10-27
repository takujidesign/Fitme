// Small external head script prevents a landing flash for returning/PWA visitors.
try{if(location.hash||navigator.standalone||matchMedia('(display-mode: standalone)').matches||JSON.parse(localStorage.getItem('fitme:v1')||'{}').onboarded)document.documentElement.classList.add('app-mode');}catch{}

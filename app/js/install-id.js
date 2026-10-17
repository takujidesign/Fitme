// Separate from opt-out telemetry identifiers; never synced between devices.
export function installId(){let id=localStorage.getItem('fitme:device-install');if(!id){id=crypto.randomUUID();localStorage.setItem('fitme:device-install',id);}return id;}

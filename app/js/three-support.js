// This module intentionally imports no renderer or assets.
export function supports3D(env=globalThis){
 if(env.navigator?.connection?.saveData||(env.navigator?.deviceMemory&&env.navigator.deviceMemory<4)||env.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return false;
 try{const canvas=env.document.createElement('canvas'),gl=canvas.getContext('webgl2');if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true;}catch{return false;}
}

const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{const url=new URL(typeof input==='string'?input:input.url);if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return nativeFetch(input,options);throw Error('External network disabled by round11 validation');};

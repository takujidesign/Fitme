// One address per page for search engines: www redirects to the main domain, everything else is a static file.
export default {
 fetch(req, env) {
  const url = new URL(req.url);
  if (url.hostname !== 'www.fixmee.app') return env.ASSETS.fetch(req);
  url.hostname = 'fixmee.app';
  return Response.redirect(url.href, 301);
 },
};

import { Router } from 'express';
import spec from './openapi';

export function documentationRoutes() {
  const router = Router();
  router.get('/openapi.json', (_req, res) => res.json(spec));
  router.get(
    ['/docs', '/docs/', '/swagger-ui', '/swagger-ui.html'],
    (_req, res) => {
      res.type('html').send(String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dayfeel Content API — Swagger UI</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><p id="loading">Loading Swagger UI. Internet access is needed to load the renderer.</p><div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>
if(window.SwaggerUIBundle){
  const base = window.location.pathname.replace(/\/(?:docs|swagger-ui(?:\.html)?)\/?$/, '');
  fetch(base + '/openapi.json')
    .then(response => { if (!response.ok) throw new Error('Definition request failed'); return response.json(); })
    .then(spec => {
      spec.servers = [{url: base || '/'}];
      document.getElementById('loading').remove();
      SwaggerUIBundle({spec,dom_id:'#swagger-ui',deepLinking:true,persistAuthorization:false,validatorUrl:null,displayRequestDuration:true});
    })
    .catch(() => { document.getElementById('loading').textContent = 'Unable to load the API definition. Refresh or check service availability.'; });
}
</script>
</body></html>`);
    },
  );
  return router;
}
